export type DifferenceConfidence = 'high' | 'low' | 'medium';

export interface ComparisonMetrics {
  clippingCandidate: boolean;
  dominantFrequencyHz: number | null;
  noiseFloorDbfs: number | null;
  rmsDbfs: number;
}

export interface ComparisonInput {
  fftSize: number;
  id: string;
  label: string;
  metrics: ComparisonMetrics;
  sampleRate: number;
  spectrum: readonly number[];
  spectrumUnit: 'power-per-bin';
  waveform: readonly number[];
}

export interface FrequencyBandDelta {
  candidateLevel: number;
  deltaDb: number;
  label: string;
  maximumHz: number;
  minimumHz: number;
  referenceLevel: number;
}

export interface SnapshotComparison {
  alignmentCorrelation: number;
  alignmentLagSamples: number;
  candidateId: string;
  confidence: DifferenceConfidence;
  dominantFrequencyDifferenceHz: number | null;
  flags: {
    alignmentApplied: boolean;
    candidateClipping: boolean;
    frequencyBalanceChanged: boolean;
    loudnessNormalizationApplied: boolean;
    noiseFloorChanged: boolean;
    referenceClipping: boolean;
  };
  frequencyBands: FrequencyBandDelta[];
  normalizationGainDb: number;
  referenceId: string;
  spectrumMeanAbsoluteDelta: number;
  waveformRmsDelta: number;
  noiseFloorDifferenceDb: number | null;
}

export interface ComparisonSummary {
  count: number;
  medianSpectrumMeanAbsoluteDelta: number;
  medianWaveformRmsDelta: number;
  varianceWaveformRmsDelta: number;
}

export const DEFAULT_COMPARISON_MAX_LAG_SAMPLES = 256;

export const DEFAULT_FREQUENCY_BANDS = [
  { label: 'sub-low', minimumHz: 20, maximumHz: 120 },
  { label: 'low-mid', minimumHz: 120, maximumHz: 500 },
  { label: 'mid', minimumHz: 500, maximumHz: 2_000 },
  { label: 'high-mid', minimumHz: 2_000, maximumHz: 6_000 },
  { label: 'high', minimumHz: 6_000, maximumHz: 20_000 },
] as const;

const EPSILON = 1e-9;

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rms(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function linearToDb(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -Infinity;
}

function normalizedSpectrum(spectrum: readonly number[]): number[] {
  const totalPower = spectrum.reduce((sum, value) => sum + value, 0);
  return totalPower > 0 ? spectrum.map((value) => value / totalPower) : spectrum.map(() => 0);
}

function powerRatioToDb(candidatePower: number, referencePower: number): number {
  if (candidatePower > 0 && referencePower > 0) {
    return 10 * Math.log10(candidatePower / referencePower);
  }
  return 10 * Math.log10((candidatePower + EPSILON) / (referencePower + EPSILON));
}

function bandIndex(frequencyHz: number, binHz: number, spectrumLength: number): number {
  return Math.max(0, Math.min(spectrumLength, Math.ceil(frequencyHz / binHz)));
}

function sumRange(values: readonly number[], start: number, end: number): number {
  let sum = 0;
  for (
    let index = Math.min(start, values.length);
    index < Math.min(end, values.length);
    index += 1
  ) {
    sum += values[index] ?? 0;
  }
  return sum;
}

function validateComparisonInput(input: ComparisonInput, role: 'candidate' | 'reference'): void {
  if (input.spectrumUnit !== 'power-per-bin') {
    throw new RangeError(`${role} spectrumUnit must be power-per-bin.`);
  }
  if (!Number.isInteger(input.fftSize) || input.fftSize <= 0 || input.fftSize % 2 !== 0) {
    throw new RangeError(`${role} fftSize must be a positive even integer.`);
  }
  const expectedSpectrumLength = input.fftSize / 2 + 1;
  if (input.spectrum.length !== expectedSpectrumLength) {
    throw new RangeError(
      `${role} spectrum must contain ${expectedSpectrumLength} one-sided power bins.`,
    );
  }
  if (input.spectrum.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError(`${role} spectrum power values must be finite and non-negative.`);
  }
}

function calculateCorrelation(
  reference: readonly number[],
  candidate: readonly number[],
  lag: number,
): number {
  const start = Math.max(0, -lag);
  const end = Math.min(reference.length, candidate.length - lag);
  if (end <= start) {
    return 0;
  }

  const referenceMean = mean(reference.slice(start, end));
  const candidateMean = mean(candidate.slice(start + lag, end + lag));
  let numerator = 0;
  let referenceEnergy = 0;
  let candidateEnergy = 0;
  for (let index = start; index < end; index += 1) {
    const referenceValue = (reference[index] ?? 0) - referenceMean;
    const candidateValue = (candidate[index + lag] ?? 0) - candidateMean;
    numerator += referenceValue * candidateValue;
    referenceEnergy += referenceValue * referenceValue;
    candidateEnergy += candidateValue * candidateValue;
  }
  return numerator / Math.sqrt(referenceEnergy * candidateEnergy + EPSILON);
}

function findBestLag(
  reference: readonly number[],
  candidate: readonly number[],
  maximumLag: number,
): { correlation: number; lag: number } {
  let best = { correlation: -1, lag: 0 };
  for (let lag = -maximumLag; lag <= maximumLag; lag += 1) {
    const correlation = calculateCorrelation(reference, candidate, lag);
    if (correlation > best.correlation) {
      best = { correlation, lag };
    }
  }
  return best;
}

function alignedValues(
  reference: readonly number[],
  candidate: readonly number[],
  lag: number,
  candidateScale: number,
): { candidate: number[]; reference: number[] } {
  const start = Math.max(0, -lag);
  const end = Math.min(reference.length, candidate.length - lag);
  const alignedReference: number[] = [];
  const alignedCandidate: number[] = [];
  for (let index = start; index < end; index += 1) {
    alignedReference.push(reference[index] ?? 0);
    alignedCandidate.push((candidate[index + lag] ?? 0) * candidateScale);
  }
  return { candidate: alignedCandidate, reference: alignedReference };
}

function waveformDifference(reference: readonly number[], candidate: readonly number[]): number {
  if (reference.length === 0 || candidate.length === 0) {
    return 1;
  }
  const length = Math.min(reference.length, candidate.length);
  return rms(
    Array.from({ length }, (_, index) => (reference[index] ?? 0) - (candidate[index] ?? 0)),
  );
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

export function compareSnapshots(
  reference: ComparisonInput,
  candidate: ComparisonInput,
  options: { maxLagSamples?: number } = {},
): SnapshotComparison {
  validateComparisonInput(reference, 'reference');
  validateComparisonInput(candidate, 'candidate');
  if (reference.sampleRate !== candidate.sampleRate) {
    throw new RangeError('Snapshot sample rates must match for comparison.');
  }
  if (reference.fftSize !== candidate.fftSize) {
    throw new RangeError('Snapshot FFT sizes must match for comparison.');
  }
  if (reference.waveform.length === 0 || candidate.waveform.length === 0) {
    throw new RangeError('Snapshot waveforms are required for comparison.');
  }

  const referenceRms = rms(reference.waveform);
  const candidateRms = rms(candidate.waveform);
  const candidateScale = candidateRms > EPSILON ? referenceRms / candidateRms : 1;
  const normalizationGainDb = Number.isFinite(linearToDb(candidateScale))
    ? linearToDb(candidateScale)
    : 0;
  const maximumLag = Math.min(
    options.maxLagSamples ?? DEFAULT_COMPARISON_MAX_LAG_SAMPLES,
    Math.max(0, Math.min(reference.waveform.length, candidate.waveform.length) - 1),
  );
  const alignment = findBestLag(reference.waveform, candidate.waveform, maximumLag);
  const aligned = alignedValues(
    reference.waveform,
    candidate.waveform,
    alignment.lag,
    candidateScale,
  );
  const referenceSpectrum = normalizedSpectrum(reference.spectrum);
  const candidateSpectrum = normalizedSpectrum(candidate.spectrum);
  const spectrumLength = referenceSpectrum.length;
  const spectrumMeanAbsoluteDelta =
    spectrumLength === 0
      ? 0
      : mean(
          Array.from({ length: spectrumLength }, (_, index) =>
            Math.abs((referenceSpectrum[index] ?? 0) - (candidateSpectrum[index] ?? 0)),
          ),
        );
  const binHz = reference.sampleRate / reference.fftSize;
  const frequencyBands = DEFAULT_FREQUENCY_BANDS.map((band) => {
    const referenceStart = bandIndex(band.minimumHz, binHz, spectrumLength);
    const referenceEnd = bandIndex(band.maximumHz, binHz, spectrumLength);
    const referenceLevel = sumRange(
      referenceSpectrum,
      referenceStart,
      Math.max(referenceEnd, referenceStart + 1),
    );
    const candidateLevel = sumRange(
      candidateSpectrum,
      referenceStart,
      Math.max(referenceEnd, referenceStart + 1),
    );
    return {
      candidateLevel,
      deltaDb: powerRatioToDb(candidateLevel, referenceLevel),
      label: band.label,
      maximumHz: band.maximumHz,
      minimumHz: band.minimumHz,
      referenceLevel,
    };
  });
  const noiseFloorDifferenceDb =
    reference.metrics.noiseFloorDbfs !== null && candidate.metrics.noiseFloorDbfs !== null
      ? candidate.metrics.noiseFloorDbfs - reference.metrics.noiseFloorDbfs
      : null;
  const dominantFrequencyDifferenceHz =
    reference.metrics.dominantFrequencyHz !== null && candidate.metrics.dominantFrequencyHz !== null
      ? candidate.metrics.dominantFrequencyHz - reference.metrics.dominantFrequencyHz
      : null;
  const frequencyBalanceChanged = frequencyBands.some((band) => Math.abs(band.deltaDb) >= 1.5);
  const noiseFloorChanged =
    noiseFloorDifferenceDb !== null && Math.abs(noiseFloorDifferenceDb) >= 3;
  const lowQuality =
    reference.metrics.clippingCandidate ||
    candidate.metrics.clippingCandidate ||
    alignment.correlation < 0.5;
  const confidence: DifferenceConfidence = lowQuality
    ? 'low'
    : alignment.correlation >= 0.8 &&
        Math.min(reference.waveform.length, candidate.waveform.length) >= 256
      ? 'high'
      : 'medium';

  return {
    alignmentCorrelation: alignment.correlation,
    alignmentLagSamples: alignment.lag,
    candidateId: candidate.id,
    confidence,
    dominantFrequencyDifferenceHz,
    flags: {
      alignmentApplied: alignment.lag !== 0,
      candidateClipping: candidate.metrics.clippingCandidate,
      frequencyBalanceChanged,
      loudnessNormalizationApplied: Math.abs(normalizationGainDb) >= 0.1,
      noiseFloorChanged,
      referenceClipping: reference.metrics.clippingCandidate,
    },
    frequencyBands,
    normalizationGainDb,
    noiseFloorDifferenceDb,
    referenceId: reference.id,
    spectrumMeanAbsoluteDelta,
    waveformRmsDelta: waveformDifference(aligned.reference, aligned.candidate),
  };
}

export function summarizeComparisons(
  comparisons: readonly SnapshotComparison[],
): ComparisonSummary {
  const waveformDeltas = comparisons.map((comparison) => comparison.waveformRmsDelta);
  const spectrumDeltas = comparisons.map((comparison) => comparison.spectrumMeanAbsoluteDelta);
  const waveformMedian = median(waveformDeltas);
  const waveformMean = mean(waveformDeltas);
  return {
    count: comparisons.length,
    medianSpectrumMeanAbsoluteDelta: median(spectrumDeltas),
    medianWaveformRmsDelta: waveformMedian,
    varianceWaveformRmsDelta:
      comparisons.length === 0
        ? 0
        : mean(waveformDeltas.map((value) => (value - waveformMean) ** 2)),
  };
}
