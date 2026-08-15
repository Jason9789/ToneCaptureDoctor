import {
  AUDIO_WORKLET_PROCESSOR_NAME,
  type AudioMetrics,
  type DryWetAnalysisResult,
} from '@tone-capture-doctor/audio-core';

export type AudioAnalysisStatus = 'starting' | 'active' | 'unavailable';

export class AudioAnalysisError extends Error {
  readonly status: AudioAnalysisStatus;

  constructor(status: AudioAnalysisStatus, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AudioAnalysisError';
    this.status = status;
  }
}

export interface AudioAnalysisSession {
  analyser: AnalyserNode;
  context: AudioContext;
  muteGain: GainNode;
  node: AudioWorkletNode;
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
  return (
    typeof AudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    typeof AudioContext.prototype.audioWorklet?.addModule === 'function'
  );
}

export async function startAudioAnalysis(
  stream: MediaStream,
  onMetrics: AudioMetricsHandler,
  options: AudioAnalysisOptions = {},
): Promise<AudioAnalysisSession> {
  if (!hasAudioWorkletSupport()) {
    throw new AudioAnalysisError(
      'unavailable',
      'This browser does not support local AudioWorklet measurement.',
    );
  }

  const context = new AudioContext(
    options.sampleRate ? { sampleRate: options.sampleRate } : undefined,
  );
  let source: MediaStreamAudioSourceNode | undefined;
  let node: AudioWorkletNode | undefined;
  let analyser: AnalyserNode | undefined;
  let muteGain: GainNode | undefined;

  try {
    await context.audioWorklet.addModule(new URL('./audioAnalyzer.worklet.ts', import.meta.url));
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, AUDIO_WORKLET_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      processorOptions: { sampleRate: context.sampleRate },
    });
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    muteGain = context.createGain();
    muteGain.gain.value = 0;

    node.port.onmessage = (event: MessageEvent<AudioMetrics>) => onMetrics(event.data);
    source.connect(node);
    source.connect(analyser);
    // Keep the graph alive without sending the microphone back to the speakers.
    node.connect(muteGain);
    analyser.connect(muteGain);
    muteGain.connect(context.destination);
    await context.resume();

    return { analyser, context, muteGain, node, source };
  } catch (error) {
    source?.disconnect();
    node?.disconnect();
    analyser?.disconnect();
    muteGain?.disconnect();
    await context.close().catch(() => undefined);
    throw new AudioAnalysisError(
      'unavailable',
      'The browser could not start local measurement. The input connection can remain active.',
      { cause: error },
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
    );
  }
  if (
    !Number.isInteger(options.dryChannelIndex) ||
    options.dryChannelIndex < 0 ||
    !Number.isInteger(options.wetChannelIndex) ||
    options.wetChannelIndex < 0 ||
    options.dryChannelIndex === options.wetChannelIndex
  ) {
    throw new AudioAnalysisError('unavailable', 'Dry and wet channels must be different inputs.');
  }

  const context = new AudioContext(
    options.sampleRate ? { sampleRate: options.sampleRate } : undefined,
  );
  let source: MediaStreamAudioSourceNode | undefined;
  let node: AudioWorkletNode | undefined;
  let muteGain: GainNode | undefined;

  try {
    await context.audioWorklet.addModule(new URL('./dryWetAnalyzer.worklet.ts', import.meta.url));
    source = context.createMediaStreamSource(stream);
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
          new AudioAnalysisError('unavailable', event.data.message ?? 'Dry/wet analysis failed.'),
        );
      }
    };
    source.connect(node);
    node.connect(muteGain);
    muteGain.connect(context.destination);
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
      { cause: error },
    );
  }
}

export async function stopAudioAnalysis(session: AudioAnalysisSession): Promise<void> {
  session.node.port.onmessage = null;
  session.source.disconnect();
  session.node.disconnect();
  session.analyser.disconnect();
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
