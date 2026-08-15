export const AUDIO_ALGORITHM_VERSION = '0.2.0';
export const DEFAULT_FFT_SIZE = 2048;
export const DEFAULT_FFT_HOP_SIZE = 1024;
export const DEFAULT_WELCH_SEGMENT_COUNT = 4;
export const DEFAULT_CLIPPING_THRESHOLD = 0.98;
export const DEFAULT_NOISE_FLOOR_WINDOW_SECONDS = 3;
export const DEFAULT_HUM_WINDOW_SECONDS = 1;

export * from './dryWet';

export type HumFrequency = 50 | 60;
export type MeasurementConfidence = 'high' | 'low' | 'medium';
export type AudioChannelData = readonly Float32Array[];

export interface FrequencyBandPower {
  id: 'high' | 'high-mid' | 'low-mid' | 'mid' | 'sub-low';
  levelDbfs: number;
  maximumHz: number;
  minimumHz: number;
  power: number;
}

export interface AudioAnalysisOptions {
  clippingThreshold?: number;
  fftHopSize?: number;
  fftSize?: number;
  humWindowSeconds?: number;
  noiseFloorWindowSeconds?: number;
  sampleRate: number;
  welchSegmentCount?: number;
}

export interface AudioMetrics {
  algorithmVersion: string;
  analysisFrameEndSample: number | null;
  analysisFrameStartSample: number | null;
  analysisWaveform: Float32Array | null;
  audioTimeSeconds: number;
  channelCount: number;
  clippedSampleCount: number;
  clippingCandidate: boolean;
  crestFactorDb: number | null;
  dominantFrequencyHz: number | null;
  frameSampleCount: number;
  frequencyBands: FrequencyBandPower[];
  humConfidence: MeasurementConfidence | null;
  humFrequencyHz: HumFrequency | null;
  noiseFloorConfidence: MeasurementConfidence | null;
  noiseFloorDbfs: number | null;
  peakDbfs: number;
  peakLinear: number;
  reportEndSample: number;
  reportStartSample: number;
  rmsDbfs: number;
  rmsLinear: number;
  sampleCount: number;
  sampleRate: number;
  spectrumBinHz: number;
  spectrumFftSize: number;
  spectrumPower: Float64Array | null;
  spectrumWindow: 'hann';
}

export interface AudioAnalyzer {
  pushFrame(channels: AudioChannelData): AudioMetrics;
  reset(): void;
}

export interface AudioMetricsAccumulator {
  flush(): AudioMetrics | null;
  push(metrics: AudioMetrics): void;
  reset(): void;
}

interface FrameStatistics {
  clippedSampleCount: number;
  flatClippedSampleCount: number;
  peakLinear: number;
  rmsLinear: number;
  sampleCount: number;
}

interface ClippingChannelState {
  flatRun: number;
  previousSample: number;
}

interface HumCandidate {
  frequency: HumFrequency;
  scoreDb: number;
  strongHarmonics: number;
}

type FrequencyState = Pick<
  AudioMetrics,
  | 'analysisFrameEndSample'
  | 'analysisFrameStartSample'
  | 'analysisWaveform'
  | 'dominantFrequencyHz'
  | 'frequencyBands'
  | 'spectrumPower'
>;

const EPSILON = 1e-20;
const NOISE_FLOOR_MINIMUM_SECONDS = 1;
const NOISE_SPECTRAL_FLATNESS_THRESHOLD = 0.08;
const HUM_HOP_RATIO = 0.5;

export const ANALYSIS_FREQUENCY_BANDS = [
  { id: 'sub-low', minimumHz: 20, maximumHz: 120 },
  { id: 'low-mid', minimumHz: 120, maximumHz: 500 },
  { id: 'mid', minimumHz: 500, maximumHz: 2_000 },
  { id: 'high-mid', minimumHz: 2_000, maximumHz: 6_000 },
  { id: 'high', minimumHz: 6_000, maximumHz: 20_000 },
] as const;

function assertValidOptions(options: AudioAnalysisOptions): Required<AudioAnalysisOptions> {
  const fftSize = options.fftSize ?? DEFAULT_FFT_SIZE;
  const fftHopSize = options.fftHopSize ?? Math.min(DEFAULT_FFT_HOP_SIZE, fftSize);
  const welchSegmentCount = options.welchSegmentCount ?? DEFAULT_WELCH_SEGMENT_COUNT;
  const clippingThreshold = options.clippingThreshold ?? DEFAULT_CLIPPING_THRESHOLD;
  const noiseFloorWindowSeconds =
    options.noiseFloorWindowSeconds ?? DEFAULT_NOISE_FLOOR_WINDOW_SECONDS;
  const humWindowSeconds = options.humWindowSeconds ?? DEFAULT_HUM_WINDOW_SECONDS;

  if (!Number.isFinite(options.sampleRate) || options.sampleRate <= 0) {
    throw new RangeError('sampleRate must be a positive finite number.');
  }
  if (!Number.isInteger(fftSize) || fftSize < 32 || (fftSize & (fftSize - 1)) !== 0) {
    throw new RangeError('fftSize must be a power of two greater than or equal to 32.');
  }
  if (!Number.isInteger(fftHopSize) || fftHopSize < 1 || fftHopSize > fftSize) {
    throw new RangeError('fftHopSize must be a positive integer no greater than fftSize.');
  }
  if (!Number.isInteger(welchSegmentCount) || welchSegmentCount < 1) {
    throw new RangeError('welchSegmentCount must be a positive integer.');
  }
  if (!Number.isFinite(clippingThreshold) || clippingThreshold <= 0 || clippingThreshold > 1) {
    throw new RangeError('clippingThreshold must be greater than 0 and less than or equal to 1.');
  }
  if (!Number.isFinite(noiseFloorWindowSeconds) || noiseFloorWindowSeconds < 1) {
    throw new RangeError('noiseFloorWindowSeconds must be at least one second.');
  }
  if (!Number.isFinite(humWindowSeconds) || humWindowSeconds < 0.5) {
    throw new RangeError('humWindowSeconds must be at least half a second.');
  }

  return {
    clippingThreshold,
    fftHopSize,
    fftSize,
    humWindowSeconds,
    noiseFloorWindowSeconds,
    sampleRate: options.sampleRate,
    welchSegmentCount,
  };
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

export function powerToDbfs(value: number): number {
  return value > 0 ? 10 * Math.log10(value) : -Infinity;
}

function createClippingStates(channelCount: number): ClippingChannelState[] {
  return Array.from({ length: channelCount }, () => ({ flatRun: 0, previousSample: 0 }));
}

function calculateFrameStatistics(
  channels: AudioChannelData,
  clippingThreshold: number,
  clippingStates = createClippingStates(channels.length),
): FrameStatistics {
  const frameSampleCount = validateChannels(channels);
  const totalSampleCount = frameSampleCount * channels.length;
  let sumSquares = 0;
  let peakLinear = 0;
  let clippedSampleCount = 0;
  let flatClippedSampleCount = 0;

  for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
    const channel = channels[channelIndex];
    const state = clippingStates[channelIndex] ?? { flatRun: 0, previousSample: 0 };
    for (const sample of channel) {
      const magnitude = Math.abs(sample);
      peakLinear = Math.max(peakLinear, magnitude);
      sumSquares += sample * sample;
      if (magnitude >= clippingThreshold) {
        clippedSampleCount += 1;
      }
      const isFlatClippedSample =
        magnitude >= clippingThreshold &&
        Math.abs(state.previousSample) >= clippingThreshold &&
        Math.sign(state.previousSample) === Math.sign(sample) &&
        Math.abs(sample - state.previousSample) <= 0.001;
      state.flatRun = isFlatClippedSample
        ? state.flatRun + 1
        : magnitude >= clippingThreshold
          ? 1
          : 0;
      if (state.flatRun >= 3) {
        flatClippedSampleCount += 1;
      }
      state.previousSample = sample;
    }
    clippingStates[channelIndex] = state;
  }

  return {
    clippedSampleCount,
    flatClippedSampleCount,
    peakLinear,
    rmsLinear: Math.sqrt(sumSquares / totalSampleCount),
    sampleCount: frameSampleCount,
  };
}

class FftPlan {
  readonly binHz: number;
  private readonly bitReversal: Uint32Array;
  private readonly cosine: Float64Array;
  private readonly imaginary: Float64Array;
  private readonly real: Float64Array;
  private readonly sine: Float64Array;
  private readonly window: Float64Array;
  private readonly windowPowerSum: number;

  constructor(
    private readonly size: number,
    sampleRate: number,
  ) {
    this.binHz = sampleRate / size;
    this.window = Float64Array.from(
      { length: size },
      (_, index) => 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1))),
    );
    this.windowPowerSum = this.window.reduce((sum, value) => sum + value * value, 0);
    this.real = new Float64Array(size);
    this.imaginary = new Float64Array(size);
    this.bitReversal = new Uint32Array(size);
    this.cosine = new Float64Array(size / 2);
    this.sine = new Float64Array(size / 2);

    const bitCount = Math.log2(size);
    for (let index = 0; index < size; index += 1) {
      let source = index;
      let reversed = 0;
      for (let bit = 0; bit < bitCount; bit += 1) {
        reversed = (reversed << 1) | (source & 1);
        source >>= 1;
      }
      this.bitReversal[index] = reversed;
    }
    for (let index = 0; index < size / 2; index += 1) {
      const phase = (-2 * Math.PI * index) / size;
      this.cosine[index] = Math.cos(phase);
      this.sine[index] = Math.sin(phase);
    }
  }

  powerSpectrum(samples: ArrayLike<number>): Float64Array {
    for (let index = 0; index < this.size; index += 1) {
      const target = this.bitReversal[index] ?? 0;
      this.real[target] = (samples[index] ?? 0) * (this.window[index] ?? 0);
      this.imaginary[target] = 0;
    }
    for (let length = 2; length <= this.size; length <<= 1) {
      const halfLength = length >> 1;
      const twiddleStep = this.size / length;
      for (let start = 0; start < this.size; start += length) {
        for (let offset = 0; offset < halfLength; offset += 1) {
          const twiddleIndex = offset * twiddleStep;
          const cosine = this.cosine[twiddleIndex] ?? 1;
          const sine = this.sine[twiddleIndex] ?? 0;
          const evenIndex = start + offset;
          const oddIndex = evenIndex + halfLength;
          const evenReal = this.real[evenIndex] ?? 0;
          const evenImaginary = this.imaginary[evenIndex] ?? 0;
          const oddReal =
            (this.real[oddIndex] ?? 0) * cosine - (this.imaginary[oddIndex] ?? 0) * sine;
          const oddImaginary =
            (this.real[oddIndex] ?? 0) * sine + (this.imaginary[oddIndex] ?? 0) * cosine;
          this.real[oddIndex] = evenReal - oddReal;
          this.imaginary[oddIndex] = evenImaginary - oddImaginary;
          this.real[evenIndex] = evenReal + oddReal;
          this.imaginary[evenIndex] = evenImaginary + oddImaginary;
        }
      }
    }

    const power = new Float64Array(this.size / 2 + 1);
    const scale = 1 / (this.size * this.windowPowerSum);
    for (let index = 0; index < power.length; index += 1) {
      const oneSidedScale = index === 0 || index === this.size / 2 ? 1 : 2;
      const real = this.real[index] ?? 0;
      const imaginary = this.imaginary[index] ?? 0;
      power[index] = (real * real + imaginary * imaginary) * scale * oneSidedScale;
    }
    return power;
  }
}

function averagePowerSpectra(spectra: readonly Float64Array[]): Float64Array {
  const output = new Float64Array(spectra[0]?.length ?? 0);
  for (const spectrum of spectra) {
    for (let index = 0; index < output.length; index += 1) {
      output[index] = (output[index] ?? 0) + (spectrum[index] ?? 0) / spectra.length;
    }
  }
  return output;
}

function sumRange(values: ArrayLike<number>, start: number, end: number): number {
  let total = 0;
  for (let index = Math.max(0, start); index < Math.min(end, values.length); index += 1) {
    total += values[index] ?? 0;
  }
  return total;
}

function getFrequencyBands(
  spectrumPower: Float64Array,
  sampleRate: number,
  fftSize: number,
): FrequencyBandPower[] {
  const binHz = sampleRate / fftSize;
  const nyquist = sampleRate / 2;
  return ANALYSIS_FREQUENCY_BANDS.map((band) => {
    const minimumHz = Math.min(band.minimumHz, nyquist);
    const maximumHz = Math.min(band.maximumHz, nyquist);
    const start = Math.max(0, Math.ceil(minimumHz / binHz));
    const end = Math.max(start + 1, Math.min(spectrumPower.length, Math.ceil(maximumHz / binHz)));
    const power = minimumHz >= nyquist ? 0 : sumRange(spectrumPower, start, end);
    return {
      id: band.id,
      levelDbfs: powerToDbfs(power),
      maximumHz: band.maximumHz,
      minimumHz: band.minimumHz,
      power,
    };
  });
}

function getDominantFrequency(
  spectrumPower: Float64Array,
  sampleRate: number,
  fftSize: number,
): number | null {
  if (spectrumPower.length < 3) {
    return null;
  }
  let dominantIndex = 1;
  for (let index = 2; index < spectrumPower.length - 1; index += 1) {
    if ((spectrumPower[index] ?? 0) > (spectrumPower[dominantIndex] ?? 0)) {
      dominantIndex = index;
    }
  }
  const centerPower = spectrumPower[dominantIndex] ?? 0;
  if (centerPower <= EPSILON) {
    return null;
  }
  const left = Math.log((spectrumPower[dominantIndex - 1] ?? 0) + EPSILON);
  const center = Math.log(centerPower + EPSILON);
  const right = Math.log((spectrumPower[dominantIndex + 1] ?? 0) + EPSILON);
  const denominator = left - 2 * center + right;
  const offset =
    Math.abs(denominator) > EPSILON
      ? Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / denominator))
      : 0;
  return ((dominantIndex + offset) * sampleRate) / fftSize;
}

function spectralFlatness(spectrum: Float64Array): number {
  let logSum = 0;
  let arithmeticSum = 0;
  let count = 0;
  for (let index = 1; index < spectrum.length; index += 1) {
    const value = Math.max(spectrum[index] ?? 0, EPSILON);
    logSum += Math.log(value);
    arithmeticSum += value;
    count += 1;
  }
  return count > 0 && arithmeticSum > EPSILON
    ? Math.exp(logSum / count) / (arithmeticSum / count)
    : 0;
}

function percentile(values: readonly number[], ratio: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * ratio)] ?? null;
}

function extractLatest(ring: Float32Array, writeIndex: number, count: number): Float32Array {
  const output = new Float32Array(count);
  const start = (writeIndex - count + ring.length) % ring.length;
  for (let index = 0; index < count; index += 1) {
    output[index] = ring[(start + index) % ring.length] ?? 0;
  }
  return output;
}

function goertzelPower(samples: Float32Array, frequencyHz: number, sampleRate: number): number {
  const coefficient = 2 * Math.cos((2 * Math.PI * frequencyHz) / sampleRate);
  let previous = 0;
  let previousPrevious = 0;
  let windowPowerSum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (samples.length - 1)));
    const current = (samples[index] ?? 0) * window + coefficient * previous - previousPrevious;
    previousPrevious = previous;
    previous = current;
    windowPowerSum += window * window;
  }
  const magnitudeSquared =
    previous * previous +
    previousPrevious * previousPrevious -
    coefficient * previous * previousPrevious;
  return (2 * Math.max(0, magnitudeSquared)) / (samples.length * windowPowerSum);
}

function humCandidateForFrequency(
  channelWindows: readonly Float32Array[],
  frequency: HumFrequency,
  sampleRate: number,
): HumCandidate {
  let scoreDb = 0;
  let strongHarmonics = 0;
  for (let harmonic = 1; harmonic <= 3; harmonic += 1) {
    const target = frequency * harmonic;
    const targetPower =
      channelWindows.reduce((sum, channel) => sum + goertzelPower(channel, target, sampleRate), 0) /
      channelWindows.length;
    const sidePower =
      channelWindows.reduce(
        (sum, channel) =>
          sum +
          (goertzelPower(channel, target - 3, sampleRate) +
            goertzelPower(channel, target + 3, sampleRate)) /
            2,
        0,
      ) / channelWindows.length;
    const ratioDb = 10 * Math.log10((targetPower + EPSILON) / (sidePower + EPSILON));
    scoreDb += ratioDb;
    if (ratioDb >= 6) {
      strongHarmonics += 1;
    }
  }
  return { frequency, scoreDb, strongHarmonics };
}

function emptyFrequencyState(): FrequencyState {
  return {
    analysisFrameEndSample: null,
    analysisFrameStartSample: null,
    analysisWaveform: null,
    dominantFrequencyHz: null,
    frequencyBands: [],
    spectrumPower: null,
  };
}

function createMetrics(
  statistics: FrameStatistics,
  options: Required<AudioAnalysisOptions>,
  frequencyState: FrequencyState,
  extras: {
    channelCount: number;
    cumulativeSampleCount: number;
    humConfidence: MeasurementConfidence | null;
    humFrequencyHz: HumFrequency | null;
    noiseFloorConfidence: MeasurementConfidence | null;
    noiseFloorDbfs: number | null;
  },
): AudioMetrics {
  const crestFactorDb =
    statistics.rmsLinear > 0 ? linearToDbfs(statistics.peakLinear / statistics.rmsLinear) : null;
  const reportEndSample = extras.cumulativeSampleCount;
  return {
    algorithmVersion: AUDIO_ALGORITHM_VERSION,
    ...frequencyState,
    audioTimeSeconds: reportEndSample / options.sampleRate,
    channelCount: extras.channelCount,
    clippedSampleCount: statistics.clippedSampleCount,
    clippingCandidate: statistics.flatClippedSampleCount > 0,
    crestFactorDb,
    frameSampleCount: statistics.sampleCount,
    humConfidence: extras.humConfidence,
    humFrequencyHz: extras.humFrequencyHz,
    noiseFloorConfidence: extras.noiseFloorConfidence,
    noiseFloorDbfs: extras.noiseFloorDbfs,
    peakDbfs: linearToDbfs(statistics.peakLinear),
    peakLinear: statistics.peakLinear,
    reportEndSample,
    reportStartSample: Math.max(0, reportEndSample - statistics.sampleCount),
    rmsDbfs: linearToDbfs(statistics.rmsLinear),
    rmsLinear: statistics.rmsLinear,
    sampleCount: reportEndSample,
    sampleRate: options.sampleRate,
    spectrumBinHz: options.sampleRate / options.fftSize,
    spectrumFftSize: options.fftSize,
    spectrumWindow: 'hann',
  };
}

export function analyzeAudioFrame(
  channels: AudioChannelData,
  options: AudioAnalysisOptions,
): AudioMetrics {
  const normalizedOptions = assertValidOptions(options);
  const statistics = calculateFrameStatistics(channels, normalizedOptions.clippingThreshold);
  let frequencyState = emptyFrequencyState();
  if (statistics.sampleCount >= normalizedOptions.fftSize) {
    const fftPlan = new FftPlan(normalizedOptions.fftSize, normalizedOptions.sampleRate);
    const channelWindows = channels.map((channel) => channel.slice(-normalizedOptions.fftSize));
    const spectrumPower = averagePowerSpectra(
      channelWindows.map((channel) => fftPlan.powerSpectrum(channel)),
    );
    frequencyState = {
      analysisFrameEndSample: statistics.sampleCount,
      analysisFrameStartSample: statistics.sampleCount - normalizedOptions.fftSize,
      analysisWaveform: new Float32Array(channelWindows[0]),
      dominantFrequencyHz: getDominantFrequency(
        spectrumPower,
        normalizedOptions.sampleRate,
        normalizedOptions.fftSize,
      ),
      frequencyBands: getFrequencyBands(
        spectrumPower,
        normalizedOptions.sampleRate,
        normalizedOptions.fftSize,
      ),
      spectrumPower,
    };
  }
  return createMetrics(statistics, normalizedOptions, frequencyState, {
    channelCount: channels.length,
    cumulativeSampleCount: statistics.sampleCount,
    humConfidence: null,
    humFrequencyHz: null,
    noiseFloorConfidence: null,
    noiseFloorDbfs: null,
  });
}

export function createAudioAnalyzer(options: AudioAnalysisOptions): AudioAnalyzer {
  const normalizedOptions = assertValidOptions(options);
  const fftPlan = new FftPlan(normalizedOptions.fftSize, normalizedOptions.sampleRate);
  const humWindowSampleCount = Math.ceil(
    normalizedOptions.sampleRate * normalizedOptions.humWindowSeconds,
  );
  const humHopSampleCount = Math.max(1, Math.floor(humWindowSampleCount * HUM_HOP_RATIO));
  const ringSize = Math.max(normalizedOptions.fftSize, humWindowSampleCount);
  const noiseHistoryLimit = Math.max(
    1,
    Math.ceil(
      (normalizedOptions.noiseFloorWindowSeconds * normalizedOptions.sampleRate) /
        normalizedOptions.fftHopSize,
    ),
  );
  const noiseMinimumCandidates = Math.max(
    1,
    Math.ceil(
      (NOISE_FLOOR_MINIMUM_SECONDS * normalizedOptions.sampleRate) / normalizedOptions.fftHopSize,
    ),
  );

  let cumulativeSampleCount = 0;
  let channelRings: Float32Array[] = [];
  let clippingStates: ClippingChannelState[] = [];
  let writeIndex = 0;
  let filledSampleCount = 0;
  let samplesSinceSpectrum = 0;
  let samplesSinceHum = 0;
  let welchSegments: Float64Array[] = [];
  let noisePowerHistory: number[] = [];
  let frequencyState = emptyFrequencyState();
  let humFrequencyHz: HumFrequency | null = null;
  let humConfidence: MeasurementConfidence | null = null;
  let humStreaks: Record<HumFrequency, number> = { 50: 0, 60: 0 };

  const resetSignalState = (channelCount: number) => {
    channelRings = Array.from({ length: channelCount }, () => new Float32Array(ringSize));
    clippingStates = createClippingStates(channelCount);
    writeIndex = 0;
    filledSampleCount = 0;
    samplesSinceSpectrum = 0;
    samplesSinceHum = 0;
    welchSegments = [];
    noisePowerHistory = [];
    frequencyState = emptyFrequencyState();
    humFrequencyHz = null;
    humConfidence = null;
    humStreaks = { 50: 0, 60: 0 };
  };

  const updateSpectrum = (frameEndSample: number) => {
    const channelWindows = channelRings.map((ring) =>
      extractLatest(ring, writeIndex, normalizedOptions.fftSize),
    );
    const periodogram = averagePowerSpectra(
      channelWindows.map((channel) => fftPlan.powerSpectrum(channel)),
    );
    welchSegments = [...welchSegments, periodogram].slice(-normalizedOptions.welchSegmentCount);
    const spectrumPower = averagePowerSpectra(welchSegments);
    const totalPower = sumRange(spectrumPower, 1, spectrumPower.length);
    if (
      spectralFlatness(spectrumPower) >= NOISE_SPECTRAL_FLATNESS_THRESHOLD ||
      powerToDbfs(totalPower) <= -50
    ) {
      noisePowerHistory = [...noisePowerHistory, totalPower].slice(-noiseHistoryLimit);
    }
    frequencyState = {
      analysisFrameEndSample: frameEndSample,
      analysisFrameStartSample: Math.max(0, frameEndSample - normalizedOptions.fftSize),
      analysisWaveform: channelWindows[0] ?? null,
      dominantFrequencyHz: getDominantFrequency(
        spectrumPower,
        normalizedOptions.sampleRate,
        normalizedOptions.fftSize,
      ),
      frequencyBands: getFrequencyBands(
        spectrumPower,
        normalizedOptions.sampleRate,
        normalizedOptions.fftSize,
      ),
      spectrumPower,
    };
  };

  const updateHum = () => {
    const channelWindows = channelRings.map((ring) =>
      extractLatest(ring, writeIndex, humWindowSampleCount),
    );
    const candidates = ([50, 60] as const)
      .map((frequency) =>
        humCandidateForFrequency(channelWindows, frequency, normalizedOptions.sampleRate),
      )
      .sort((left, right) => right.scoreDb - left.scoreDb);
    const strongest = candidates[0];
    const isPresent =
      strongest !== undefined &&
      strongest.scoreDb >= 24 &&
      (strongest.strongHarmonics >= 2 || strongest.scoreDb >= 42);
    for (const frequency of [50, 60] as const) {
      humStreaks[frequency] =
        isPresent && strongest?.frequency === frequency ? humStreaks[frequency] + 1 : 0;
    }
    if (strongest && humStreaks[strongest.frequency] >= 3) {
      humFrequencyHz = strongest.frequency;
      humConfidence = humStreaks[strongest.frequency] >= 5 ? 'medium' : 'low';
    } else {
      humFrequencyHz = null;
      humConfidence = null;
    }
  };

  return {
    pushFrame(channels) {
      const frameSampleCount = validateChannels(channels);
      if (channelRings.length !== channels.length) {
        resetSignalState(channels.length);
      }
      const statistics = calculateFrameStatistics(
        channels,
        normalizedOptions.clippingThreshold,
        clippingStates,
      );
      const frameStartSample = cumulativeSampleCount;
      for (let sampleIndex = 0; sampleIndex < frameSampleCount; sampleIndex += 1) {
        for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
          const ring = channelRings[channelIndex];
          if (ring) {
            ring[writeIndex] = channels[channelIndex]?.[sampleIndex] ?? 0;
          }
        }
        writeIndex = (writeIndex + 1) % ringSize;
        filledSampleCount = Math.min(ringSize, filledSampleCount + 1);
        samplesSinceSpectrum += 1;
        samplesSinceHum += 1;
        const absoluteFrameEnd = frameStartSample + sampleIndex + 1;
        if (
          filledSampleCount >= normalizedOptions.fftSize &&
          (frequencyState.spectrumPower === null ||
            samplesSinceSpectrum >= normalizedOptions.fftHopSize)
        ) {
          updateSpectrum(absoluteFrameEnd);
          samplesSinceSpectrum = 0;
        }
        if (filledSampleCount >= humWindowSampleCount && samplesSinceHum >= humHopSampleCount) {
          updateHum();
          samplesSinceHum = 0;
        }
      }

      cumulativeSampleCount += frameSampleCount;
      const floorPower =
        noisePowerHistory.length >= noiseMinimumCandidates
          ? percentile(noisePowerHistory, 0.2)
          : null;
      const noiseFloorConfidence: MeasurementConfidence | null =
        floorPower === null
          ? null
          : noisePowerHistory.length >= noiseHistoryLimit
            ? 'high'
            : 'medium';
      return createMetrics(statistics, normalizedOptions, frequencyState, {
        channelCount: channels.length,
        cumulativeSampleCount,
        humConfidence,
        humFrequencyHz,
        noiseFloorConfidence,
        noiseFloorDbfs: floorPower === null ? null : powerToDbfs(floorPower),
      });
    },
    reset() {
      cumulativeSampleCount = 0;
      resetSignalState(channelRings.length || 1);
    },
  };
}

export function createAudioMetricsAccumulator(): AudioMetricsAccumulator {
  let latest: AudioMetrics | null = null;
  let reportStartSample = 0;
  let totalFrameSamples = 0;
  let totalValues = 0;
  let sumSquares = 0;
  let peakLinear = 0;
  let clippedSampleCount = 0;
  let clippingCandidate = false;

  const reset = () => {
    latest = null;
    reportStartSample = 0;
    totalFrameSamples = 0;
    totalValues = 0;
    sumSquares = 0;
    peakLinear = 0;
    clippedSampleCount = 0;
    clippingCandidate = false;
  };

  return {
    flush() {
      if (!latest || totalValues === 0) {
        return null;
      }
      const rmsLinear = Math.sqrt(sumSquares / totalValues);
      const result: AudioMetrics = {
        ...latest,
        clippedSampleCount,
        clippingCandidate,
        crestFactorDb: rmsLinear > 0 ? linearToDbfs(peakLinear / rmsLinear) : null,
        frameSampleCount: totalFrameSamples,
        peakDbfs: linearToDbfs(peakLinear),
        peakLinear,
        reportStartSample,
        rmsDbfs: linearToDbfs(rmsLinear),
        rmsLinear,
      };
      reset();
      return result;
    },
    push(metrics) {
      if (!latest) {
        reportStartSample = metrics.reportStartSample;
      }
      latest = metrics;
      totalFrameSamples += metrics.frameSampleCount;
      const valueCount = metrics.frameSampleCount * metrics.channelCount;
      totalValues += valueCount;
      sumSquares += metrics.rmsLinear * metrics.rmsLinear * valueCount;
      peakLinear = Math.max(peakLinear, metrics.peakLinear);
      clippedSampleCount += metrics.clippedSampleCount;
      clippingCandidate ||= metrics.clippingCandidate;
    },
    reset,
  };
}

export const AUDIO_WORKLET_PROCESSOR_NAME = 'tone-capture-doctor-analyzer';

export * from './compare';
