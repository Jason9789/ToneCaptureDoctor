import {
  analyzeDryWet,
  type DryWetAnalysisResult,
  type DryWetFrame,
} from '@tone-capture-doctor/audio-core';

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;

  constructor(options?: { processorOptions?: Record<string, number | string> });
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processor: new (options?: {
    processorOptions?: Record<string, number | string>;
  }) => AudioWorkletProcessor,
): void;

interface DryWetProcessorOptions {
  processorOptions?: {
    dryChannelIndex?: number;
    frameSize?: number;
    sampleRate?: number;
    wetChannelIndex?: number;
  };
}

type DryWetWorkletMessage =
  | { kind: 'error'; message: string }
  | { kind: 'result'; result: DryWetAnalysisResult }
  | {
      actualChannelCount: number;
      droppedQuantumCount: number;
      expectedChannelCount: number;
      kind: 'status';
    };

class DryWetAnalyzerProcessor extends AudioWorkletProcessor {
  private readonly dryChannelIndex: number;
  private readonly drySamples: number[] = [];
  private readonly frameSize: number;
  private droppedQuantumCount = 0;
  private readonly expectedChannelCount: number;
  private frameStartSample = 0;
  private readonly sampleRate: number;
  private readonly wetChannelIndex: number;
  private readonly wetSamples: number[] = [];

  constructor(options?: DryWetProcessorOptions) {
    super(options);
    const processorOptions = options?.processorOptions ?? {};
    this.dryChannelIndex = processorOptions.dryChannelIndex ?? 0;
    this.frameSize = processorOptions.frameSize ?? 8_192;
    this.sampleRate = processorOptions.sampleRate ?? 48_000;
    this.wetChannelIndex = processorOptions.wetChannelIndex ?? 1;
    this.expectedChannelCount = Math.max(this.dryChannelIndex, this.wetChannelIndex) + 1;
  }

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0] ?? [];
    const dry = channels[this.dryChannelIndex];
    const wet = channels[this.wetChannelIndex];
    if (!dry || !wet || dry.length !== wet.length) {
      this.droppedQuantumCount += 1;
      if (this.droppedQuantumCount === 1 || this.droppedQuantumCount % 30 === 0) {
        this.post({
          actualChannelCount: channels.length,
          droppedQuantumCount: this.droppedQuantumCount,
          expectedChannelCount: this.expectedChannelCount,
          kind: 'status',
        });
      }
      return true;
    }

    for (let index = 0; index < dry.length; index += 1) {
      this.drySamples.push(dry[index] ?? 0);
      this.wetSamples.push(wet[index] ?? 0);
    }

    while (this.drySamples.length >= this.frameSize) {
      const drySamples = Float32Array.from(this.drySamples.splice(0, this.frameSize));
      const wetSamples = Float32Array.from(this.wetSamples.splice(0, this.frameSize));
      const dryFrame: DryWetFrame = {
        frameStartSample: this.frameStartSample,
        sampleRate: this.sampleRate,
        samples: drySamples,
      };
      const wetFrame: DryWetFrame = {
        frameStartSample: this.frameStartSample,
        sampleRate: this.sampleRate,
        samples: wetSamples,
      };
      this.frameStartSample += this.frameSize;

      try {
        this.post({
          kind: 'result',
          result: analyzeDryWet(
            { dry: dryFrame, wet: wetFrame },
            { correlationMethod: 'gcc-phat' },
          ),
        });
      } catch (error) {
        this.post({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Dry/wet analysis failed.',
        });
      }
    }
    return true;
  }

  private post(message: DryWetWorkletMessage): void {
    this.port.postMessage(message);
  }
}

registerProcessor('tone-capture-doctor-dry-wet-analyzer', DryWetAnalyzerProcessor);
