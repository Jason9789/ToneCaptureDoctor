import {
  AUDIO_WORKLET_PROCESSOR_NAME,
  createAudioAnalyzer,
  type AudioMetrics,
  type DryWetAnalysisResult,
} from '@tone-capture-doctor/audio-core';

export type AudioAnalysisStatus = 'starting' | 'active' | 'unavailable';
export type AudioAnalysisEngine = 'audio-worklet' | 'analyser-fallback';
export type AudioAnalysisDiagnosticCode =
  | 'audio-context-unavailable'
  | 'worklet-unsupported'
  | 'worklet-start-failed'
  | 'fallback-start-failed'
  | 'dry-wet-invalid-options'
  | 'dry-wet-worklet-unsupported'
  | 'dry-wet-start-failed'
  | 'dry-wet-processor-error'
  | 'unknown';

export interface AudioAnalysisDiagnostic {
  code: AudioAnalysisDiagnosticCode;
  detail: string;
  stage?: AudioAnalysisStartupStage;
}

export interface AudioAnalysisErrorOptions extends ErrorOptions {
  code?: AudioAnalysisDiagnosticCode;
  diagnostics?: AudioAnalysisDiagnostic[];
}

const ANALYSER_MIN_DBFS = -100;
const ANALYSER_MAX_DBFS = 0;
const MAX_ANALYSIS_CHANNELS = 2;
const SAFE_MONITOR_GAIN = 0.1;
const MONITOR_RAMP_SECONDS = 0.02;

export class AudioAnalysisError extends Error {
  readonly code: AudioAnalysisDiagnosticCode;
  readonly diagnostics: AudioAnalysisDiagnostic[];
  readonly status: AudioAnalysisStatus;

  constructor(status: AudioAnalysisStatus, message: string, options?: AudioAnalysisErrorOptions) {
    super(message, options);
    this.name = 'AudioAnalysisError';
    this.code = options?.code ?? 'unknown';
    this.diagnostics = options?.diagnostics ?? [];
    this.status = status;
  }
}

export interface AudioAnalysisFallback {
  code: 'worklet-unsupported' | 'worklet-start-failed';
  detail: string;
  stage?: AudioAnalysisStartupStage;
}

export type AudioAnalysisStartupStage =
  | 'audio-context'
  | 'audio-worklet-capability'
  | 'audio-worklet-module'
  | 'audio-worklet-node'
  | 'audio-graph'
  | 'audio-resume'
  | 'media-source';

export interface AudioAnalysisSession {
  analyser: AnalyserNode;
  channelAnalysers?: AnalyserNode[];
  channelSplitter?: ChannelSplitterNode;
  context: AudioContext;
  engine: AudioAnalysisEngine;
  fallback?: AudioAnalysisFallback;
  monitorGain: GainNode;
  muteGain: GainNode;
  node?: AudioWorkletNode;
  pollHandle?: number;
  source: MediaStreamAudioSourceNode;
}

export interface DryWetAnalysisSession {
  context: AudioContext;
  muteGain: GainNode;
  node: AudioWorkletNode;
  source: MediaStreamAudioSourceNode;
}

export type AudioMetricsHandler = (metrics: AudioMetrics) => void;
export type DryWetAnalysisHandler = (result: DryWetAnalysisResult) => void;

export interface DryWetAnalysisStatus {
  actualChannelCount: number;
  droppedQuantumCount: number;
  expectedChannelCount: number;
}

export interface AudioAnalysisOptions {
  sampleRate?: number;
}

export interface DryWetAnalysisOptions {
  dryChannelIndex: number;
  frameSize?: number;
  onError?: (error: AudioAnalysisError) => void;
  onStatus?: (status: DryWetAnalysisStatus) => void;
  sampleRate?: number;
  wetChannelIndex: number;
}

function hasAudioWorkletSupport(): boolean {
  return typeof AudioContext !== 'undefined' && typeof AudioWorkletNode !== 'undefined';
}

function createAudioContext(sampleRate?: number): AudioContext {
  if (typeof AudioContext === 'undefined') {
    throw new AudioAnalysisError(
      'unavailable',
      'This browser does not provide the Web Audio API.',
      { code: 'audio-context-unavailable' },
    );
  }
  return new AudioContext(sampleRate ? { sampleRate } : undefined);
}

function getAnalysisChannelCount(stream: MediaStream, source: MediaStreamAudioSourceNode): number {
  const trackChannelCount = stream.getAudioTracks()[0]?.getSettings().channelCount;
  const sourceChannelCount = source.channelCount;
  const requestedChannelCount = Number.isFinite(sourceChannelCount)
    ? sourceChannelCount
    : trackChannelCount;
  return Math.max(1, Math.min(MAX_ANALYSIS_CHANNELS, Math.round(requestedChannelCount || 1)));
}

export function setAudioMonitorEnabled(session: AudioAnalysisSession, enabled: boolean): void {
  const gain = session.monitorGain.gain;
  const target = enabled ? SAFE_MONITOR_GAIN : 0;
  const currentTime = session.context.currentTime;
  try {
    gain.cancelScheduledValues(currentTime);
    gain.setValueAtTime(gain.value, currentTime);
    gain.linearRampToValueAtTime(target, currentTime + MONITOR_RAMP_SECONDS);
  } catch {
    gain.value = target;
  }
}

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) {
    const cause = 'cause' in error ? error.cause : undefined;
    const causeText = cause instanceof Error ? `${cause.name}: ${cause.message}` : '';
    return `${error.name}: ${error.message}${causeText ? ` | cause ${causeText}` : ''}`.slice(
      0,
      320,
    );
  }
  return String(error).slice(0, 320);
}

export function describeAudioAnalysisError(error: unknown): string {
  if (error instanceof AudioAnalysisError) {
    if (error.diagnostics.length > 0) {
      return error.diagnostics
        .map((diagnostic) => diagnostic.detail)
        .join(' | ')
        .slice(0, 640);
    }
    const cause = 'cause' in error ? error.cause : undefined;
    return `${error.message}${cause ? ` | cause ${describeUnknownError(cause)}` : ''}`.slice(
      0,
      640,
    );
  }
  return describeUnknownError(error);
}

function audioAnalysisDiagnostic(
  error: unknown,
  fallbackCode: AudioAnalysisDiagnosticCode = 'unknown',
): AudioAnalysisDiagnostic {
  if (error instanceof AudioAnalysisError && error.diagnostics.length > 0) {
    return error.diagnostics[0] ?? { code: error.code, detail: describeUnknownError(error) };
  }
  return { code: fallbackCode, detail: describeUnknownError(error) };
}

function describeStartupFailure(stage: AudioAnalysisStartupStage, error: unknown): string {
  return `${stage}: ${describeUnknownError(error)}`;
}

function getAudioWorklet(context: AudioContext): AudioWorklet {
  const audioWorklet = context.audioWorklet;
  if (!audioWorklet || typeof audioWorklet.addModule !== 'function') {
    throw new AudioAnalysisError(
      'unavailable',
      'This browser does not provide a usable AudioWorklet instance.',
      { code: 'worklet-unsupported' },
    );
  }
  return audioWorklet;
}

async function startAudioWorkletAnalysis(
  stream: MediaStream,
  onMetrics: AudioMetricsHandler,
  options: AudioAnalysisOptions = {},
): Promise<AudioAnalysisSession> {
  if (!hasAudioWorkletSupport()) {
    throw new AudioAnalysisError(
      'unavailable',
      'This browser does not support local AudioWorklet measurement.',
      { code: 'worklet-unsupported' },
    );
  }

  let context: AudioContext;
  try {
    context = createAudioContext(options.sampleRate);
  } catch (error) {
    if (error instanceof AudioAnalysisError) {
      throw error;
    }
    throw new AudioAnalysisError(
      'unavailable',
      'The browser could not create a local audio context.',
      { cause: error, code: 'audio-context-unavailable' },
    );
  }
  let source: MediaStreamAudioSourceNode | undefined;
  let node: AudioWorkletNode | undefined;
  let analyser: AnalyserNode | undefined;
  let muteGain: GainNode | undefined;
  let monitorGain: GainNode | undefined;
  let stage: AudioAnalysisStartupStage = 'audio-worklet-capability';

  try {
    const audioWorklet = getAudioWorklet(context);
    stage = 'audio-worklet-module';
    await audioWorklet.addModule.call(
      audioWorklet,
      new URL('./audioAnalyzer.worklet.ts', import.meta.url),
    );
    stage = 'media-source';
    source = context.createMediaStreamSource(stream);
    stage = 'audio-worklet-node';
    node = new AudioWorkletNode(context, AUDIO_WORKLET_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      processorOptions: { sampleRate: context.sampleRate },
    });
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    analyser.minDecibels = ANALYSER_MIN_DBFS;
    analyser.maxDecibels = ANALYSER_MAX_DBFS;
    muteGain = context.createGain();
    muteGain.gain.value = 0;
    monitorGain = context.createGain();
    monitorGain.gain.value = 0;

    node.port.onmessage = (event: MessageEvent<AudioMetrics>) => onMetrics(event.data);
    stage = 'audio-graph';
    source.connect(node);
    source.connect(analyser);
    // Keep the graph alive without sending the microphone back to the speakers.
    node.connect(muteGain);
    analyser.connect(muteGain);
    muteGain.connect(context.destination);
    source.connect(monitorGain);
    monitorGain.connect(context.destination);
    stage = 'audio-resume';
    await context.resume();

    return { analyser, context, engine: 'audio-worklet', monitorGain, muteGain, node, source };
  } catch (error) {
    source?.disconnect();
    node?.disconnect();
    analyser?.disconnect();
    muteGain?.disconnect();
    monitorGain?.disconnect();
    await context.close().catch(() => undefined);
    throw new AudioAnalysisError(
      'unavailable',
      'The browser could not start local measurement. The input connection can remain active.',
      {
        cause: error,
        code: 'worklet-start-failed',
        diagnostics: [
          {
            code: 'worklet-start-failed',
            detail: describeStartupFailure(stage, error),
            stage,
          },
        ],
      },
    );
  }
}

async function startAnalyserFallback(
  stream: MediaStream,
  onMetrics: AudioMetricsHandler,
  options: AudioAnalysisOptions,
  fallback: AudioAnalysisFallback,
): Promise<AudioAnalysisSession> {
  let context: AudioContext;
  try {
    context = createAudioContext(options.sampleRate);
  } catch (error) {
    if (error instanceof AudioAnalysisError) {
      throw error;
    }
    throw new AudioAnalysisError(
      'unavailable',
      'The browser could not create the compatibility audio context.',
      { cause: error, code: 'fallback-start-failed' },
    );
  }

  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  let channelAnalysers: AnalyserNode[] = [];
  let channelSplitter: ChannelSplitterNode | undefined;
  let muteGain: GainNode | undefined;
  let monitorGain: GainNode | undefined;
  let pollHandle: number | undefined;

  try {
    source = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser();
    analyser.fftSize = 2_048;
    analyser.smoothingTimeConstant = 0;
    analyser.minDecibels = ANALYSER_MIN_DBFS;
    analyser.maxDecibels = ANALYSER_MAX_DBFS;
    const channelCount = getAnalysisChannelCount(stream, source);
    channelSplitter = context.createChannelSplitter(channelCount);
    channelAnalysers = Array.from({ length: channelCount }, () => {
      const channelAnalyser = context.createAnalyser();
      channelAnalyser.fftSize = 2_048;
      channelAnalyser.smoothingTimeConstant = 0;
      channelAnalyser.minDecibels = ANALYSER_MIN_DBFS;
      channelAnalyser.maxDecibels = ANALYSER_MAX_DBFS;
      return channelAnalyser;
    });
    muteGain = context.createGain();
    muteGain.gain.value = 0;
    monitorGain = context.createGain();
    monitorGain.gain.value = 0;
    const displayAnalyser = analyser;
    const outputGain = muteGain;
    const monitorOutputGain = monitorGain;
    if (!displayAnalyser || !outputGain || !monitorOutputGain) {
      throw new Error('The compatibility analyser graph could not be created.');
    }

    const frames = channelAnalysers.map(() => new Float32Array(displayAnalyser.fftSize));
    const analyzer = createAudioAnalyzer({
      fftSize: displayAnalyser.fftSize,
      sampleRate: context.sampleRate,
    });
    const poll = () => {
      channelAnalysers.forEach((channelAnalyser, channelIndex) => {
        const frame = frames[channelIndex];
        if (frame) {
          channelAnalyser.getFloatTimeDomainData(frame);
        }
      });
      onMetrics(analyzer.pushFrame(frames));
    };

    source.connect(analyser);
    source.connect(channelSplitter);
    channelAnalysers.forEach((channelAnalyser, channelIndex) => {
      channelSplitter?.connect(channelAnalyser, channelIndex);
      channelAnalyser.connect(outputGain);
    });
    // Keep the graph alive without sending the microphone back to the speakers.
    displayAnalyser.connect(outputGain);
    outputGain.connect(context.destination);
    source.connect(monitorOutputGain);
    monitorOutputGain.connect(context.destination);
    await context.resume();
    poll();
    pollHandle = window.setInterval(poll, 1_000 / 30);

    return {
      analyser,
      channelAnalysers,
      channelSplitter,
      context,
      engine: 'analyser-fallback',
      fallback,
      monitorGain: monitorOutputGain,
      muteGain,
      pollHandle,
      source,
    };
  } catch (error) {
    if (pollHandle !== undefined) {
      window.clearInterval(pollHandle);
    }
    source?.disconnect();
    analyser?.disconnect();
    channelAnalysers.forEach((channelAnalyser) => channelAnalyser.disconnect());
    channelSplitter?.disconnect();
    muteGain?.disconnect();
    monitorGain?.disconnect();
    await context.close().catch(() => undefined);
    throw new AudioAnalysisError(
      'unavailable',
      'The browser could not start compatibility measurement. The input connection can remain active.',
      {
        cause: error,
        code: 'fallback-start-failed',
        diagnostics: [
          fallback,
          {
            code: 'fallback-start-failed',
            detail: describeUnknownError(error),
          },
        ],
      },
    );
  }
}

export async function startAudioAnalysis(
  stream: MediaStream,
  onMetrics: AudioMetricsHandler,
  options: AudioAnalysisOptions = {},
): Promise<AudioAnalysisSession> {
  let workletFailure: AudioAnalysisError;
  try {
    return await startAudioWorkletAnalysis(stream, onMetrics, options);
  } catch (error) {
    workletFailure =
      error instanceof AudioAnalysisError
        ? error
        : new AudioAnalysisError(
            'unavailable',
            'The browser could not start AudioWorklet measurement.',
            { cause: error, code: 'worklet-start-failed' },
          );
  }

  const fallbackCode: AudioAnalysisFallback['code'] =
    workletFailure.code === 'worklet-unsupported' ? 'worklet-unsupported' : 'worklet-start-failed';
  const fallback: AudioAnalysisFallback = {
    code: fallbackCode,
    detail: describeAudioAnalysisError(workletFailure),
    stage: workletFailure.diagnostics[0]?.stage,
  };

  try {
    return await startAnalyserFallback(stream, onMetrics, options, fallback);
  } catch (error) {
    const fallbackFailure =
      error instanceof AudioAnalysisError
        ? error
        : new AudioAnalysisError(
            'unavailable',
            'The browser could not start compatibility measurement.',
            { cause: error, code: 'fallback-start-failed' },
          );
    throw new AudioAnalysisError(
      'unavailable',
      'The browser could not start local measurement. The input connection can remain active.',
      {
        cause: fallbackFailure,
        code: 'fallback-start-failed',
        diagnostics: [
          audioAnalysisDiagnostic(workletFailure, workletFailure.code),
          ...(fallbackFailure.diagnostics.length > 0
            ? fallbackFailure.diagnostics
            : [audioAnalysisDiagnostic(fallbackFailure, 'fallback-start-failed')]),
        ],
      },
    );
  }
}

export async function startDryWetAnalysis(
  stream: MediaStream,
  onResult: DryWetAnalysisHandler,
  options: DryWetAnalysisOptions,
): Promise<DryWetAnalysisSession> {
  if (!hasAudioWorkletSupport()) {
    throw new AudioAnalysisError(
      'unavailable',
      'This browser does not support local dry/wet measurement.',
      { code: 'dry-wet-worklet-unsupported' },
    );
  }
  if (
    !Number.isInteger(options.dryChannelIndex) ||
    options.dryChannelIndex < 0 ||
    !Number.isInteger(options.wetChannelIndex) ||
    options.wetChannelIndex < 0 ||
    options.dryChannelIndex === options.wetChannelIndex
  ) {
    throw new AudioAnalysisError('unavailable', 'Dry and wet channels must be different inputs.', {
      code: 'dry-wet-invalid-options',
    });
  }

  let context: AudioContext;
  let stage: AudioAnalysisStartupStage = 'audio-context';
  try {
    context = createAudioContext(options.sampleRate);
  } catch (error) {
    throw new AudioAnalysisError(
      'unavailable',
      'The browser could not create a local dry/wet audio context.',
      {
        cause: error,
        code: 'dry-wet-start-failed',
        diagnostics: [
          {
            code: 'dry-wet-start-failed',
            detail: describeStartupFailure(stage, error),
            stage,
          },
        ],
      },
    );
  }
  let source: MediaStreamAudioSourceNode | undefined;
  let node: AudioWorkletNode | undefined;
  let muteGain: GainNode | undefined;

  try {
    const audioWorklet = getAudioWorklet(context);
    stage = 'audio-worklet-module';
    await audioWorklet.addModule.call(
      audioWorklet,
      new URL('./dryWetAnalyzer.worklet.ts', import.meta.url),
    );
    stage = 'media-source';
    source = context.createMediaStreamSource(stream);
    stage = 'audio-worklet-node';
    node = new AudioWorkletNode(context, 'tone-capture-doctor-dry-wet-analyzer', {
      channelCount: Math.max(options.dryChannelIndex, options.wetChannelIndex) + 1,
      channelCountMode: 'explicit',
      numberOfInputs: 1,
      numberOfOutputs: 1,
      processorOptions: {
        dryChannelIndex: options.dryChannelIndex,
        frameSize: options.frameSize ?? 8_192,
        sampleRate: context.sampleRate,
        wetChannelIndex: options.wetChannelIndex,
      },
    });
    muteGain = context.createGain();
    muteGain.gain.value = 0;

    node.port.onmessage = (
      event: MessageEvent<{
        actualChannelCount?: number;
        droppedQuantumCount?: number;
        expectedChannelCount?: number;
        kind: string;
        message?: string;
        result?: DryWetAnalysisResult;
      }>,
    ) => {
      if (event.data.kind === 'result' && event.data.result) {
        onResult(event.data.result);
      } else if (
        event.data.kind === 'status' &&
        typeof event.data.actualChannelCount === 'number' &&
        typeof event.data.droppedQuantumCount === 'number' &&
        typeof event.data.expectedChannelCount === 'number'
      ) {
        options.onStatus?.({
          actualChannelCount: event.data.actualChannelCount,
          droppedQuantumCount: event.data.droppedQuantumCount,
          expectedChannelCount: event.data.expectedChannelCount,
        });
      } else if (event.data.kind === 'error') {
        options.onError?.(
          new AudioAnalysisError('unavailable', event.data.message ?? 'Dry/wet analysis failed.', {
            code: 'dry-wet-processor-error',
          }),
        );
      }
    };
    stage = 'audio-graph';
    source.connect(node);
    node.connect(muteGain);
    muteGain.connect(context.destination);
    stage = 'audio-resume';
    await context.resume();

    return { context, muteGain, node, source };
  } catch (error) {
    source?.disconnect();
    node?.disconnect();
    muteGain?.disconnect();
    await context.close().catch(() => undefined);
    throw new AudioAnalysisError(
      'unavailable',
      'The browser could not start dry/wet measurement. The input connection can remain active.',
      {
        cause: error,
        code: 'dry-wet-start-failed',
        diagnostics: [
          {
            code: 'dry-wet-start-failed',
            detail: describeStartupFailure(stage, error),
            stage,
          },
        ],
      },
    );
  }
}

export async function stopAudioAnalysis(session: AudioAnalysisSession): Promise<void> {
  if (session.pollHandle !== undefined) {
    window.clearInterval(session.pollHandle);
  }
  if (session.node) {
    session.node.port.onmessage = null;
  }
  session.source.disconnect();
  session.node?.disconnect();
  session.channelAnalysers?.forEach((channelAnalyser) => channelAnalyser.disconnect());
  session.channelSplitter?.disconnect();
  session.analyser.disconnect();
  setAudioMonitorEnabled(session, false);
  session.monitorGain.disconnect();
  session.muteGain.disconnect();
  await session.context.close().catch(() => undefined);
}

export async function stopDryWetAnalysis(session: DryWetAnalysisSession): Promise<void> {
  session.node.port.onmessage = null;
  session.source.disconnect();
  session.node.disconnect();
  session.muteGain.disconnect();
  await session.context.close().catch(() => undefined);
}
