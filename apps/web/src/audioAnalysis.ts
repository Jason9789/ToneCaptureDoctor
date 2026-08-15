import { AUDIO_WORKLET_PROCESSOR_NAME, type AudioMetrics } from '@tone-capture-doctor/audio-core';

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
  context: AudioContext;
  muteGain: GainNode;
  node: AudioWorkletNode;
  source: MediaStreamAudioSourceNode;
}

export type AudioMetricsHandler = (metrics: AudioMetrics) => void;

export interface AudioAnalysisOptions {
  sampleRate?: number;
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
  let muteGain: GainNode | undefined;

  try {
    await context.audioWorklet.addModule(new URL('./audioAnalyzer.worklet.ts', import.meta.url));
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, AUDIO_WORKLET_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      processorOptions: { sampleRate: context.sampleRate },
    });
    muteGain = context.createGain();
    muteGain.gain.value = 0;

    node.port.onmessage = (event: MessageEvent<AudioMetrics>) => onMetrics(event.data);
    source.connect(node);
    // Keep the graph alive without sending the microphone back to the speakers.
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
      'The browser could not start local measurement. The input connection can remain active.',
      { cause: error },
    );
  }
}

export async function stopAudioAnalysis(session: AudioAnalysisSession): Promise<void> {
  session.node.port.onmessage = null;
  session.source.disconnect();
  session.node.disconnect();
  session.muteGain.disconnect();
  await session.context.close().catch(() => undefined);
}
