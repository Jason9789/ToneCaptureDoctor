export const AUDIO_ALGORITHM_VERSION = '0.1.0';
export const DEFAULT_FFT_SIZE = 2048;
export const DEFAULT_CLIPPING_THRESHOLD = 0.98;
export const DEFAULT_NOISE_FLOOR_WINDOW_SIZE = 30;

export type HumFrequency = 50 | 60;
export type AudioChannelData = readonly Float32Array[];

export interface AudioAnalysisOptions {
  clippingThreshold?: number;
  fftSize?: number;
  noiseFloorWindowSize?: number;
  sampleRate: number;
}

export interface AudioMetrics {
  algorithmVersion: string;
  channelCount: number;
  clippedSampleCount: number;
  clippingCandidate: boolean;
  crestFactorDb: number | null;
  dominantFrequencyHz: number | null;
  frameSampleCount: number;
  humFrequencyHz: HumFrequency | null;
  noiseFloorDbfs: number | null;
  peakDbfs: number;
  peakLinear: number;
  rmsDbfs: number;
  rmsLinear: number;
  sampleCount: number;
  sampleRate: number;
}

export interface AudioAnalyzer {
  pushFrame(channels: AudioChannelData): AudioMetrics;
  reset(): void;
}

interface FrameStatistics {
  clippedSampleCount: number;
  flatClippedSampleCount: number;
  peakLinear: number;
  rmsLinear: number;
  sampleCount: number;
}

function assertValidOptions(options: AudioAnalysisOptions): Required<AudioAnalysisOptions> {
  const fftSize = options.fftSize ?? DEFAULT_FFT_SIZE;
  const noiseFloorWindowSize = options.noiseFloorWindowSize ?? DEFAULT_NOISE_FLOOR_WINDOW_SIZE;
  const clippingThreshold = options.clippingThreshold ?? DEFAULT_CLIPPING_THRESHOLD;

  if (!Number.isFinite(options.sampleRate) || options.sampleRate <= 0) {
    throw new RangeError('sampleRate must be a positive finite number.');
  }
  if (!Number.isInteger(fftSize) || fftSize < 2 || (fftSize & (fftSize - 1)) !== 0) {
    throw new RangeError('fftSize must be a power of two greater than or equal to 2.');
  }
  if (!Number.isInteger(noiseFloorWindowSize) || noiseFloorWindowSize < 1) {
    throw new RangeError('noiseFloorWindowSize must be a positive integer.');
  }
  if (!Number.isFinite(clippingThreshold) || clippingThreshold <= 0 || clippingThreshold > 1) {
    throw new RangeError('clippingThreshold must be greater than 0 and less than or equal to 1.');
  }

  return { clippingThreshold, fftSize, noiseFloorWindowSize, sampleRate: options.sampleRate };
}

function validateChannels(channels: AudioChannelData): number {
  if (channels.length === 0) {
    throw new RangeError('At least one audio channel is required.');
  }

  const sampleCount = channels[0]?.length ?? 0;
  if (sampleCount === 0) {
    throw new RangeError('Audio channels must contain at least one sample.');
  }

  for (const channel of channels) {
    if (channel.length !== sampleCount) {
      throw new RangeError('All audio channels must contain the same number of samples.');
    }
  }

  return sampleCount;
}

export function linearToDbfs(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -Infinity;
}

function calculateFrameStatistics(
  channels: AudioChannelData,
  clippingThreshold: number,
): FrameStatistics {
  const frameSampleCount = validateChannels(channels);
  const totalSampleCount = frameSampleCount * channels.length;
  let sumSquares = 0;
  let peakLinear = 0;
  let clippedSampleCount = 0;
  let flatClippedSampleCount = 0;

  for (const channel of channels) {
    let flatRun = 0;
    let previousSample = 0;
    for (const sample of channel) {
      const magnitude = Math.abs(sample);
      peakLinear = Math.max(peakLinear, magnitude);
      sumSquares += sample * sample;
      if (magnitude >= clippingThreshold) {
        clippedSampleCount += 1;
      }
      const isFlatClippedSample =
        magnitude >= clippingThreshold && Math.abs(magnitude - 1) <= 0.001;
      if (
        isFlatClippedSample &&
        Math.abs(Math.abs(previousSample) - 1) <= 0.001 &&
        Math.sign(previousSample) === Math.sign(sample)
      ) {
        flatRun += 1;
      } else {
        flatRun = isFlatClippedSample ? 1 : 0;
      }
      if (flatRun >= 3) {
        flatClippedSampleCount += 1;
      }
      previousSample = sample;
    }
  }

  return {
    clippedSampleCount,
    flatClippedSampleCount,
    peakLinear,
    rmsLinear: Math.sqrt(sumSquares / totalSampleCount),
    sampleCount: frameSampleCount,
  };
}

function fftMagnitude(samples: readonly number[], fftSize: number): Float64Array {
  const real = new Float64Array(fftSize);
  const imaginary = new Float64Array(fftSize);

  for (let index = 0; index < fftSize; index += 1) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (fftSize - 1)));
    real[index] = (samples[index] ?? 0) * window;
  }

  for (let target = 0, source = 0; target < fftSize; target += 1) {
    if (target < source) {
      [real[target], real[source]] = [real[source], real[target]];
    }
    let bit = fftSize >> 1;
    while (source & bit) {
      source ^= bit;
      bit >>= 1;
    }
    source ^= bit;
  }

  for (let length = 2; length <= fftSize; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const halfLength = length >> 1;
    for (let start = 0; start < fftSize; start += length) {
      for (let offset = 0; offset < halfLength; offset += 1) {
        const phase = angle * offset;
        const cosine = Math.cos(phase);
        const sine = Math.sin(phase);
        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfLength;
        const oddReal = real[oddIndex] * cosine - imaginary[oddIndex] * sine;
        const oddImaginary = real[oddIndex] * sine + imaginary[oddIndex] * cosine;
        real[oddIndex] = real[evenIndex] - oddReal;
        imaginary[oddIndex] = imaginary[evenIndex] - oddImaginary;
        real[evenIndex] += oddReal;
        imaginary[evenIndex] += oddImaginary;
      }
    }
  }

  const magnitudes = new Float64Array(fftSize / 2 + 1);
  for (let index = 0; index < magnitudes.length; index += 1) {
    magnitudes[index] = (2 / fftSize) * Math.hypot(real[index], imaginary[index]);
  }
  return magnitudes;
}

function nearestBin(frequencyHz: number, sampleRate: number, fftSize: number): number {
  return Math.min(fftSize / 2, Math.max(0, Math.round((frequencyHz * fftSize) / sampleRate)));
}

function getDominantFrequency(
  magnitudes: Float64Array,
  sampleRate: number,
  fftSize: number,
): number | null {
  let dominantIndex = 1;
  for (let index = 2; index < magnitudes.length; index += 1) {
    if (magnitudes[index] > magnitudes[dominantIndex]) {
      dominantIndex = index;
    }
  }

  return magnitudes[dominantIndex] > 0 ? (dominantIndex * sampleRate) / fftSize : null;
}

function getHumFrequency(
  magnitudes: Float64Array,
  sampleRate: number,
  fftSize: number,
): HumFrequency | null {
  const candidates: Array<{ frequency: HumFrequency; magnitude: number }> = [50, 60].map(
    (frequency) => ({
      frequency: frequency as HumFrequency,
      magnitude: magnitudes[nearestBin(frequency, sampleRate, fftSize)] ?? 0,
    }),
  );
  const strongest = candidates.reduce((current, candidate) =>
    candidate.magnitude > current.magnitude ? candidate : current,
  );
  const dominantMagnitude = Math.max(...magnitudes.slice(1));

  return strongest.magnitude > 0 && strongest.magnitude >= dominantMagnitude * 0.25
    ? strongest.frequency
    : null;
}

function getFrequencyMetrics(
  samples: readonly number[],
  sampleRate: number,
  fftSize: number,
): Pick<AudioMetrics, 'dominantFrequencyHz' | 'humFrequencyHz'> {
  const magnitudes = fftMagnitude(samples, fftSize);
  return {
    dominantFrequencyHz: getDominantFrequency(magnitudes, sampleRate, fftSize),
    humFrequencyHz: getHumFrequency(magnitudes, sampleRate, fftSize),
  };
}

function mixChannels(channels: AudioChannelData, sampleCount: number): number[] {
  const mixed = new Array<number>(sampleCount).fill(0);
  for (const channel of channels) {
    for (let index = 0; index < sampleCount; index += 1) {
      mixed[index] += (channel[index] ?? 0) / channels.length;
    }
  }
  return mixed;
}

function analyzeNormalizedAudioFrame(
  channels: AudioChannelData,
  normalizedOptions: Required<AudioAnalysisOptions>,
): AudioMetrics {
  const statistics = calculateFrameStatistics(channels, normalizedOptions.clippingThreshold);
  const mixedSamples = mixChannels(channels, statistics.sampleCount);
  const frequencyMetrics =
    mixedSamples.length >= normalizedOptions.fftSize
      ? getFrequencyMetrics(
          mixedSamples.slice(-normalizedOptions.fftSize),
          normalizedOptions.sampleRate,
          normalizedOptions.fftSize,
        )
      : { dominantFrequencyHz: null, humFrequencyHz: null };
  const crestFactorDb =
    statistics.rmsLinear > 0 ? linearToDbfs(statistics.peakLinear / statistics.rmsLinear) : null;
  const clippingCandidate = statistics.flatClippedSampleCount >= 3;

  return {
    algorithmVersion: AUDIO_ALGORITHM_VERSION,
    channelCount: channels.length,
    clippedSampleCount: statistics.clippedSampleCount,
    clippingCandidate,
    crestFactorDb,
    dominantFrequencyHz: frequencyMetrics.dominantFrequencyHz,
    frameSampleCount: statistics.sampleCount,
    humFrequencyHz: frequencyMetrics.humFrequencyHz,
    noiseFloorDbfs: null,
    peakDbfs: linearToDbfs(statistics.peakLinear),
    peakLinear: statistics.peakLinear,
    rmsDbfs: linearToDbfs(statistics.rmsLinear),
    rmsLinear: statistics.rmsLinear,
    sampleCount: statistics.sampleCount,
    sampleRate: normalizedOptions.sampleRate,
  };
}

export function analyzeAudioFrame(
  channels: AudioChannelData,
  options: AudioAnalysisOptions,
): AudioMetrics {
  return analyzeNormalizedAudioFrame(channels, assertValidOptions(options));
}

export function createAudioAnalyzer(options: AudioAnalysisOptions): AudioAnalyzer {
  const normalizedOptions = assertValidOptions(options);
  let cumulativeSampleCount = 0;
  let noiseFloorFrames: number[] = [];
  let fftBuffer: number[] = [];

  return {
    pushFrame(channels) {
      const frame = analyzeNormalizedAudioFrame(channels, normalizedOptions);
      cumulativeSampleCount += frame.frameSampleCount;
      noiseFloorFrames = [...noiseFloorFrames, frame.rmsDbfs].slice(
        -normalizedOptions.noiseFloorWindowSize,
      );
      fftBuffer = [...fftBuffer, ...mixChannels(channels, frame.frameSampleCount)].slice(
        -normalizedOptions.fftSize,
      );

      const frequencyMetrics =
        fftBuffer.length === normalizedOptions.fftSize
          ? getFrequencyMetrics(fftBuffer, normalizedOptions.sampleRate, normalizedOptions.fftSize)
          : { dominantFrequencyHz: null, humFrequencyHz: null };

      return {
        ...frame,
        dominantFrequencyHz: frequencyMetrics.dominantFrequencyHz,
        humFrequencyHz: frequencyMetrics.humFrequencyHz,
        noiseFloorDbfs: Math.min(...noiseFloorFrames),
        sampleCount: cumulativeSampleCount,
      };
    },
    reset() {
      cumulativeSampleCount = 0;
      fftBuffer = [];
      noiseFloorFrames = [];
    },
  };
}

export const AUDIO_WORKLET_PROCESSOR_NAME = 'tone-capture-doctor-analyzer';
