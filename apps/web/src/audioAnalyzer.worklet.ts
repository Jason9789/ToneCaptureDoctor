import { createAudioAnalyzer, type AudioChannelData } from '@tone-capture-doctor/audio-core';

declare const currentTime: number;

interface WorkletProcessorOptions {
  processorOptions?: {
    fftSize?: number;
    sampleRate?: number;
  };
}

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;

  constructor(options?: WorkletProcessorOptions);
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processor: new (options?: WorkletProcessorOptions) => AudioWorkletProcessor,
): void;

class SignalAnalyzerProcessor extends AudioWorkletProcessor {
  private readonly analyzer;

  constructor(options?: WorkletProcessorOptions) {
    super(options);
    this.analyzer = createAudioAnalyzer({
      fftSize: options?.processorOptions?.fftSize,
      sampleRate: options?.processorOptions?.sampleRate ?? 48_000,
    });
  }

  process(inputs: Float32Array[][]): boolean {
    const channels = (inputs[0] ?? []) as AudioChannelData;
    if (channels.length > 0 && channels[0]?.length) {
      const metrics = this.analyzer.pushFrame(channels);
      this.port.postMessage({ ...metrics, timestampSeconds: currentTime });
    }
    return true;
  }
}

registerProcessor('tone-capture-doctor-analyzer', SignalAnalyzerProcessor);
