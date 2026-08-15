import { analyzeAudioFrame, type FrequencyBandPower } from './index';

export const DRY_WET_ALGORITHM_VERSION = '0.1.0';
export const DEFAULT_DRY_WET_NO_SIGNAL_THRESHOLD_DBFS = -60;
export const DEFAULT_DRY_WET_MAX_LAG_MS = 100;
export const DEFAULT_DRY_WET_MINIMUM_CORRELATION = 0.35;
export const DEFAULT_DRY_WET_STRONG_CORRELATION = 0.9;

export type DryWetConfidence = 'high' | 'low' | 'medium' | 'unavailable';
export type DryWetChannelMode = 'indeterminate' | 'mono-like' | 'no-signal' | 'stereo-distinct';
export type DryWetWarningCode =
  | 'both-no-signal'
  | 'dry-no-signal'
  | 'latency-low-confidence'
  | 'mono-like-input'
  | 'possible-channel-swap'
  | 'wet-no-signal';

export interface DryWetFrame {
  frameEndSample?: number;
  frameStartSample: number;
  sampleRate: number;
  samples: ArrayLike<number>;
}

export interface DryWetAnalysisInput {
  dry: DryWetFrame;
  wet: DryWetFrame;
}

export interface DryWetAnalysisOptions {
  maxLagSamples?: number;
  minimumCorrelation?: number;
  noSignalThresholdDbfs?: number;
  strongCorrelation?: number;
}

export interface DryWetSignalMetrics {
  noSignal: boolean;
  peakDbfs: number;
  peakLinear: number;
  rmsDbfs: number;
  rmsLinear: number;
}

export interface DryWetDynamicsMetrics {
  crestFactorDb: number | null;
  peakDbfs: number;
  rmsDbfs: number;
}

export interface DryWetSpectrumDifference {
  deltaDb: number | null;
  id: FrequencyBandPower['id'];
  maximumHz: number;
  minimumHz: number;
  dryLevelDbfs: number;
  wetLevelDbfs: number;
}

export interface DryWetLatencyCandidate {
  confidence: DryWetConfidence;
  correlation: number | null;
  milliseconds: number | null;
  quality: 'estimated' | 'measured' | 'unavailable';
  sampleOffset: number | null;
}

export interface DryWetChannelSwapAssessment {
  candidate: boolean;
  confidence: DryWetConfidence;
  correlation: number | null;
  reason: 'wet-leads-dry' | 'not-indicated' | 'insufficient-signal';
}

export interface DryWetChannelModeAssessment {
  confidence: DryWetConfidence;
  correlation: number | null;
  mode: DryWetChannelMode;
}

export interface DryWetNoSignalAssessment {
  both: boolean;
  dry: boolean;
  thresholdDbfs: number;
  wet: boolean;
}

export interface DryWetAnalysisResult {
  algorithmVersion: string;
  channelMode: DryWetChannelModeAssessment;
  channelSwap: DryWetChannelSwapAssessment;
  dry: DryWetSignalMetrics;
  frameEndSample: number;
  frameSampleCount: number;
  frameStartSample: number;
  gainDifferenceDb: number | null;
  dynamics: {
    dry: DryWetDynamicsMetrics;
    wet: DryWetDynamicsMetrics;
  };
  latency: DryWetLatencyCandidate;
  noSignal: DryWetNoSignalAssessment;
  peakDifferenceDb: number | null;
  sampleRate: number;
  spectrumDifference: DryWetSpectrumDifference[];
  warnings: DryWetWarningCode[];
  wet: DryWetSignalMetrics;
}

interface CorrelationResult {
  correlation: number;
  lagSamples: number;
}

interface NormalizedOptions {
  maxLagSamples: number;
  minimumCorrelation: number;
  noSignalThresholdDbfs: number;
  strongCorrelation: number;
}

const EPSILON = 1e-12;
const MINIMUM_FRAME_SAMPLES = 16;
const MINIMUM_CORRELATION_OVERLAP = 16;
const MONO_LIKE_CORRELATION = 0.995;

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function validateFrame(frame: DryWetFrame, role: 'dry' | 'wet'): number {
  if (frame === null || typeof frame !== 'object') {
    throw new RangeError(`${role} frame is required.`);
  }
  const samples = frame.samples as ArrayLike<number> | null | undefined;
  if (samples === null || samples === undefined || typeof samples.length !== 'number') {
    throw new RangeError(`${role}.samples must be an array-like value.`);
  }
  assertFiniteNumber(frame.sampleRate, `${role}.sampleRate`);
  if (frame.sampleRate <= 0) {
    throw new RangeError(`${role}.sampleRate must be greater than zero.`);
  }
  if (!Number.isSafeInteger(frame.frameStartSample) || frame.frameStartSample < 0) {
    throw new RangeError(`${role}.frameStartSample must be a non-negative safe integer.`);
  }
  if (!Number.isSafeInteger(samples.length) || samples.length < MINIMUM_FRAME_SAMPLES) {
    throw new RangeError(`${role}.samples must contain at least ${MINIMUM_FRAME_SAMPLES} samples.`);
  }
  const expectedFrameEndSample = frame.frameStartSample + samples.length;
  if (
    frame.frameEndSample !== undefined &&
    (!Number.isSafeInteger(frame.frameEndSample) || frame.frameEndSample !== expectedFrameEndSample)
  ) {
    throw new RangeError(`${role}.frameEndSample must match frameStartSample plus sample length.`);
  }
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? Number.NaN;
    if (!Number.isFinite(sample)) {
      throw new RangeError(`${role}.samples must contain only finite values.`);
    }
  }
  return samples.length;
}

function normalizeOptions(
  sampleRate: number,
  frameSampleCount: number,
  options: DryWetAnalysisOptions,
): NormalizedOptions {
  const maxLagSamples =
    options.maxLagSamples ?? Math.round((sampleRate * DEFAULT_DRY_WET_MAX_LAG_MS) / 1_000);
  const minimumCorrelation = options.minimumCorrelation ?? DEFAULT_DRY_WET_MINIMUM_CORRELATION;
  const noSignalThresholdDbfs =
    options.noSignalThresholdDbfs ?? DEFAULT_DRY_WET_NO_SIGNAL_THRESHOLD_DBFS;
  const strongCorrelation = options.strongCorrelation ?? DEFAULT_DRY_WET_STRONG_CORRELATION;

  if (!Number.isSafeInteger(maxLagSamples) || maxLagSamples < 0) {
    throw new RangeError('maxLagSamples must be a non-negative integer.');
  }
  if (!Number.isFinite(minimumCorrelation) || minimumCorrelation <= 0 || minimumCorrelation > 1) {
    throw new RangeError('minimumCorrelation must be greater than 0 and at most 1.');
  }
  if (!Number.isFinite(strongCorrelation) || strongCorrelation <= 0 || strongCorrelation > 1) {
    throw new RangeError('strongCorrelation must be greater than 0 and at most 1.');
  }
  if (strongCorrelation < minimumCorrelation) {
    throw new RangeError('strongCorrelation must be at least minimumCorrelation.');
  }
  if (!Number.isFinite(noSignalThresholdDbfs) || noSignalThresholdDbfs >= 0) {
    throw new RangeError('noSignalThresholdDbfs must be a finite negative number.');
  }

  return {
    maxLagSamples: Math.min(
      maxLagSamples,
      Math.max(0, frameSampleCount - MINIMUM_CORRELATION_OVERLAP),
    ),
    minimumCorrelation,
    noSignalThresholdDbfs,
    strongCorrelation,
  };
}

function linearToDbfs(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -Infinity;
}

function calculateSignalMetrics(
  samples: ArrayLike<number>,
  noSignalThresholdDbfs: number,
): DryWetSignalMetrics {
  let peakLinear = 0;
  let sumSquares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    const magnitude = Math.abs(sample);
    peakLinear = Math.max(peakLinear, magnitude);
    sumSquares += sample * sample;
  }
  const rmsLinear = Math.sqrt(sumSquares / samples.length);
  const peakDbfs = linearToDbfs(peakLinear);
  const rmsDbfs = linearToDbfs(rmsLinear);
  if (!Number.isFinite(rmsLinear) || !Number.isFinite(peakLinear)) {
    throw new RangeError('Audio samples produce a non-finite level measurement.');
  }

  return {
    noSignal: rmsDbfs < noSignalThresholdDbfs,
    peakDbfs,
    peakLinear,
    rmsDbfs,
    rmsLinear,
  };
}

function getSpectrumFftSize(sampleCount: number): number | null {
  if (sampleCount < 32) {
    return null;
  }
  let fftSize = 32;
  while (fftSize * 2 <= Math.min(sampleCount, 2_048)) {
    fftSize *= 2;
  }
  return fftSize;
}

function calculateSpectrumDifference(
  drySamples: ArrayLike<number>,
  wetSamples: ArrayLike<number>,
  sampleRate: number,
): {
  difference: DryWetSpectrumDifference[];
  dryDynamics: DryWetDynamicsMetrics;
  wetDynamics: DryWetDynamicsMetrics;
} {
  const dryRms = calculateSignalMetrics(drySamples, DEFAULT_DRY_WET_NO_SIGNAL_THRESHOLD_DBFS);
  const wetRms = calculateSignalMetrics(wetSamples, DEFAULT_DRY_WET_NO_SIGNAL_THRESHOLD_DBFS);
  const dryDynamics: DryWetDynamicsMetrics = {
    crestFactorDb: dryRms.rmsLinear > 0 ? linearToDbfs(dryRms.peakLinear / dryRms.rmsLinear) : null,
    peakDbfs: dryRms.peakDbfs,
    rmsDbfs: dryRms.rmsDbfs,
  };
  const wetDynamics: DryWetDynamicsMetrics = {
    crestFactorDb: wetRms.rmsLinear > 0 ? linearToDbfs(wetRms.peakLinear / wetRms.rmsLinear) : null,
    peakDbfs: wetRms.peakDbfs,
    rmsDbfs: wetRms.rmsDbfs,
  };
  const fftSize = getSpectrumFftSize(drySamples.length);
  if (!fftSize) {
    return { difference: [], dryDynamics, wetDynamics };
  }

  const dryAnalysis = analyzeAudioFrame([Float32Array.from(drySamples)], {
    fftSize,
    sampleRate,
  });
  const wetAnalysis = analyzeAudioFrame([Float32Array.from(wetSamples)], {
    fftSize,
    sampleRate,
  });
  const difference = dryAnalysis.frequencyBands.map((dryBand) => {
    const wetBand = wetAnalysis.frequencyBands.find((candidate) => candidate.id === dryBand.id);
    const dryLevelDbfs = dryBand.levelDbfs;
    const wetLevelDbfs = wetBand?.levelDbfs ?? -Infinity;
    return {
      deltaDb:
        Number.isFinite(dryLevelDbfs) && Number.isFinite(wetLevelDbfs)
          ? wetLevelDbfs - dryLevelDbfs
          : null,
      dryLevelDbfs,
      id: dryBand.id,
      maximumHz: dryBand.maximumHz,
      minimumHz: dryBand.minimumHz,
      wetLevelDbfs,
    } satisfies DryWetSpectrumDifference;
  });
  return { difference, dryDynamics, wetDynamics };
}

function normalizedCorrelation(
  dry: ArrayLike<number>,
  wet: ArrayLike<number>,
  lagSamples: number,
): number {
  const dryStart = Math.max(0, -lagSamples);
  const dryEnd = Math.min(dry.length, wet.length - lagSamples);
  const overlap = dryEnd - dryStart;
  if (overlap < MINIMUM_CORRELATION_OVERLAP) {
    return 0;
  }

  let dryMean = 0;
  let wetMean = 0;
  for (let index = dryStart; index < dryEnd; index += 1) {
    dryMean += dry[index] ?? 0;
    wetMean += wet[index + lagSamples] ?? 0;
  }
  dryMean /= overlap;
  wetMean /= overlap;

  let numerator = 0;
  let dryEnergy = 0;
  let wetEnergy = 0;
  for (let index = dryStart; index < dryEnd; index += 1) {
    const dryValue = (dry[index] ?? 0) - dryMean;
    const wetValue = (wet[index + lagSamples] ?? 0) - wetMean;
    numerator += dryValue * wetValue;
    dryEnergy += dryValue * dryValue;
    wetEnergy += wetValue * wetValue;
  }
  if (dryEnergy <= EPSILON || wetEnergy <= EPSILON) {
    return 0;
  }
  return numerator / Math.sqrt(dryEnergy * wetEnergy);
}

function findBestCorrelation(
  dry: ArrayLike<number>,
  wet: ArrayLike<number>,
  maxLagSamples: number,
): CorrelationResult {
  let best: CorrelationResult = { correlation: 0, lagSamples: 0 };
  let bestMagnitude = -1;
  for (let lagSamples = -maxLagSamples; lagSamples <= maxLagSamples; lagSamples += 1) {
    const correlation = normalizedCorrelation(dry, wet, lagSamples);
    const magnitude = Math.abs(correlation);
    if (
      magnitude > bestMagnitude + EPSILON ||
      (Math.abs(magnitude - bestMagnitude) <= EPSILON &&
        Math.abs(lagSamples) < Math.abs(best.lagSamples))
    ) {
      best = { correlation, lagSamples };
      bestMagnitude = magnitude;
    }
  }
  return bestMagnitude >= 0 ? best : { correlation: 0, lagSamples: 0 };
}

function confidenceForCorrelation(
  absoluteCorrelation: number,
  options: NormalizedOptions,
): DryWetConfidence {
  if (absoluteCorrelation < options.minimumCorrelation) {
    return 'unavailable';
  }
  if (absoluteCorrelation >= options.strongCorrelation) {
    return 'high';
  }
  return 'medium';
}

export function analyzeDryWet(
  input: DryWetAnalysisInput,
  options: DryWetAnalysisOptions = {},
): DryWetAnalysisResult {
  const drySampleCount = validateFrame(input.dry, 'dry');
  const wetSampleCount = validateFrame(input.wet, 'wet');
  if (input.dry.sampleRate !== input.wet.sampleRate) {
    throw new RangeError('Dry and wet sample rates must match.');
  }
  if (input.dry.frameStartSample !== input.wet.frameStartSample) {
    throw new RangeError('Dry and wet frameStartSample coordinates must match.');
  }
  if (drySampleCount !== wetSampleCount) {
    throw new RangeError('Dry and wet frames must contain the same number of samples.');
  }

  const normalizedOptions = normalizeOptions(input.dry.sampleRate, drySampleCount, options);
  const dry = calculateSignalMetrics(input.dry.samples, normalizedOptions.noSignalThresholdDbfs);
  const wet = calculateSignalMetrics(input.wet.samples, normalizedOptions.noSignalThresholdDbfs);
  const noSignal: DryWetNoSignalAssessment = {
    both: dry.noSignal && wet.noSignal,
    dry: dry.noSignal,
    thresholdDbfs: normalizedOptions.noSignalThresholdDbfs,
    wet: wet.noSignal,
  };
  const bothHaveSignal = !dry.noSignal && !wet.noSignal;
  const gainDifferenceDb = bothHaveSignal ? wet.rmsDbfs - dry.rmsDbfs : null;
  const peakDifferenceDb = bothHaveSignal ? wet.peakDbfs - dry.peakDbfs : null;
  const spectrum = calculateSpectrumDifference(
    input.dry.samples,
    input.wet.samples,
    input.dry.sampleRate,
  );

  const correlation = bothHaveSignal
    ? findBestCorrelation(input.dry.samples, input.wet.samples, normalizedOptions.maxLagSamples)
    : null;
  const correlationMagnitude = correlation === null ? 0 : Math.abs(correlation.correlation);
  const latencyConfidence = confidenceForCorrelation(correlationMagnitude, normalizedOptions);
  const latencyQuality: DryWetLatencyCandidate['quality'] =
    latencyConfidence === 'high'
      ? 'measured'
      : latencyConfidence === 'medium'
        ? 'estimated'
        : 'unavailable';
  const latency: DryWetLatencyCandidate = {
    confidence: latencyConfidence,
    correlation: correlation?.correlation ?? null,
    milliseconds:
      correlation === null || latencyConfidence === 'unavailable'
        ? null
        : (correlation.lagSamples / input.dry.sampleRate) * 1_000,
    quality: latencyQuality,
    sampleOffset:
      correlation === null || latencyConfidence === 'unavailable' ? null : correlation.lagSamples,
  };

  const channelSwapCandidate =
    correlation !== null &&
    correlation.lagSamples < 0 &&
    correlationMagnitude >= normalizedOptions.strongCorrelation;
  const channelSwap: DryWetChannelSwapAssessment = {
    candidate: channelSwapCandidate,
    confidence: channelSwapCandidate
      ? latencyConfidence
      : correlation === null
        ? 'unavailable'
        : 'low',
    correlation: correlation?.correlation ?? null,
    reason: channelSwapCandidate
      ? 'wet-leads-dry'
      : correlation === null
        ? 'insufficient-signal'
        : 'not-indicated',
  };

  const monoLike =
    correlation !== null &&
    correlation.lagSamples === 0 &&
    correlationMagnitude >= MONO_LIKE_CORRELATION;
  const channelMode: DryWetChannelModeAssessment = {
    confidence: noSignal.both
      ? 'high'
      : !bothHaveSignal
        ? 'unavailable'
        : monoLike
          ? 'high'
          : latencyConfidence,
    correlation: correlation?.correlation ?? null,
    mode: noSignal.both
      ? 'no-signal'
      : !bothHaveSignal
        ? 'indeterminate'
        : monoLike
          ? 'mono-like'
          : 'stereo-distinct',
  };

  const warnings: DryWetWarningCode[] = [];
  if (noSignal.both) {
    warnings.push('both-no-signal');
  } else {
    if (noSignal.dry) {
      warnings.push('dry-no-signal');
    }
    if (noSignal.wet) {
      warnings.push('wet-no-signal');
    }
  }
  if (monoLike) {
    warnings.push('mono-like-input');
  }
  if (channelSwapCandidate) {
    warnings.push('possible-channel-swap');
  }
  if (bothHaveSignal && latencyConfidence === 'unavailable') {
    warnings.push('latency-low-confidence');
  }

  return {
    algorithmVersion: DRY_WET_ALGORITHM_VERSION,
    channelMode,
    channelSwap,
    dry,
    frameEndSample: input.dry.frameStartSample + drySampleCount,
    frameSampleCount: drySampleCount,
    frameStartSample: input.dry.frameStartSample,
    gainDifferenceDb,
    dynamics: {
      dry: spectrum.dryDynamics,
      wet: spectrum.wetDynamics,
    },
    latency,
    noSignal,
    peakDifferenceDb,
    sampleRate: input.dry.sampleRate,
    spectrumDifference: spectrum.difference,
    warnings,
    wet,
  };
}
