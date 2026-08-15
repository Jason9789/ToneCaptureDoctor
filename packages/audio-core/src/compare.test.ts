import { describe, expect, it } from 'vitest';

import {
  compareSnapshots,
  summarizeComparisons,
  type ComparisonInput,
  type SnapshotComparison,
} from './compare';

function createInput(overrides: Partial<ComparisonInput> = {}): ComparisonInput {
  const waveform = Array.from({ length: 512 }, (_, index) => {
    const fundamental = Math.sin((2 * Math.PI * index) / 32);
    const harmonic = Math.sin((2 * Math.PI * index) / 11) * 0.15;
    return fundamental + harmonic;
  });
  return {
    fftSize: 2_048,
    id: 'snapshot-a',
    label: 'A',
    metrics: {
      clippingCandidate: false,
      dominantFrequencyHz: 440,
      noiseFloorDbfs: -60,
      rmsDbfs: -12,
    },
    sampleRate: 48_000,
    spectrum: Array.from({ length: 1_025 }, (_, index) => (index === 20 ? 1 : 0.02)),
    spectrumUnit: 'power-per-bin',
    waveform,
    ...overrides,
  };
}

describe('snapshot comparison', () => {
  it('removes a gain-only difference through loudness normalization', () => {
    const reference = createInput();
    const candidate = createInput({
      id: 'snapshot-b',
      label: 'B',
      metrics: { ...reference.metrics, rmsDbfs: reference.metrics.rmsDbfs + 6 },
      waveform: reference.waveform.map((sample) => sample * 2),
    });

    const comparison = compareSnapshots(reference, candidate);

    expect(comparison.normalizationGainDb).toBeCloseTo(-6.02, 1);
    expect(comparison.waveformRmsDelta).toBeLessThan(0.01);
    expect(comparison.spectrumMeanAbsoluteDelta).toBeLessThan(0.01);
    expect(comparison.flags.loudnessNormalizationApplied).toBe(true);
  });

  it('reports a power-spectrum band boost using summed power and 10 log10', () => {
    const reference = createInput();
    const binHz = reference.sampleRate / reference.fftSize;
    const lowMidStart = Math.ceil(120 / binHz);
    const lowMidEnd = Math.ceil(500 / binHz);
    const candidateSpectrum = reference.spectrum.map((power, index) =>
      index >= lowMidStart && index < lowMidEnd ? power * 4 : power,
    );
    const comparison = compareSnapshots(
      reference,
      createInput({ id: 'snapshot-b', spectrum: candidateSpectrum }),
    );

    const lowMid = comparison.frequencyBands.find((band) => band.label === 'low-mid');
    const referenceTotalPower = reference.spectrum.reduce((sum, power) => sum + power, 0);
    const candidateTotalPower = candidateSpectrum.reduce((sum, power) => sum + power, 0);
    const expectedDeltaDb = 10 * Math.log10((4 * referenceTotalPower) / candidateTotalPower);
    expect(comparison.flags.frequencyBalanceChanged).toBe(true);
    expect(lowMid?.deltaDb).toBeCloseTo(expectedDeltaDb, 8);
  });

  it('aligns a delayed take before calculating waveform difference', () => {
    const reference = createInput();
    const delay = 8;
    const delayedWaveform = [...Array(delay).fill(0), ...reference.waveform.slice(0, -delay)];
    const comparison = compareSnapshots(
      reference,
      createInput({ id: 'snapshot-b', waveform: delayedWaveform }),
      { maxLagSamples: 32 },
    );

    expect(comparison.alignmentLagSamples).toBe(delay);
    expect(comparison.waveformRmsDelta).toBeLessThan(0.01);
    expect(comparison.flags.alignmentApplied).toBe(true);
  });

  it('rejects incompatible snapshot analysis settings', () => {
    const reference = createInput();

    expect(() =>
      compareSnapshots(reference, createInput({ id: 'b', sampleRate: 44_100 })),
    ).toThrowError('Snapshot sample rates must match for comparison.');
    expect(() =>
      compareSnapshots(
        reference,
        createInput({
          fftSize: 4_096,
          id: 'b',
          spectrum: Array.from({ length: 2_049 }, () => 1),
        }),
      ),
    ).toThrowError('Snapshot FFT sizes must match for comparison.');
    expect(() =>
      compareSnapshots(reference, createInput({ id: 'b', spectrum: [1, 2, 3] })),
    ).toThrowError('candidate spectrum must contain 1025 one-sided power bins.');
  });

  it('rejects spectra with the wrong unit or invalid power values', () => {
    const reference = createInput();
    const wrongUnit = { ...createInput(), spectrumUnit: 'magnitude' } as unknown as ComparisonInput;

    expect(() => compareSnapshots(wrongUnit, createInput({ id: 'b' }))).toThrowError(
      'reference spectrumUnit must be power-per-bin.',
    );
    expect(() =>
      compareSnapshots(
        reference,
        createInput({
          id: 'b',
          spectrum: reference.spectrum.map((value, index) => (index === 4 ? -value : value)),
        }),
      ),
    ).toThrowError('candidate spectrum power values must be finite and non-negative.');
    expect(() =>
      compareSnapshots(
        reference,
        createInput({
          id: 'b',
          spectrum: reference.spectrum.map((value, index) => (index === 4 ? Number.NaN : value)),
        }),
      ),
    ).toThrowError('candidate spectrum power values must be finite and non-negative.');
  });

  it('lowers confidence and preserves clipping facts', () => {
    const comparison = compareSnapshots(
      createInput(),
      createInput({
        id: 'snapshot-b',
        metrics: {
          clippingCandidate: true,
          dominantFrequencyHz: 440,
          noiseFloorDbfs: -54,
          rmsDbfs: -12,
        },
      }),
    );

    expect(comparison.confidence).toBe('low');
    expect(comparison.flags.candidateClipping).toBe(true);
    expect(comparison.flags.noiseFloorChanged).toBe(true);
    expect(comparison.noiseFloorDifferenceDb).toBe(6);
  });

  it('summarizes repeated takes with median and variance', () => {
    const base = compareSnapshots(createInput(), createInput({ id: 'b' }));
    const comparisons: SnapshotComparison[] = [1, 2, 6].map((waveformRmsDelta, index) => ({
      ...base,
      candidateId: `candidate-${index}`,
      spectrumMeanAbsoluteDelta: waveformRmsDelta / 10,
      waveformRmsDelta,
    }));
    const summary = summarizeComparisons(comparisons);

    expect(summary.count).toBe(3);
    expect(summary.medianWaveformRmsDelta).toBe(2);
    expect(summary.medianSpectrumMeanAbsoluteDelta).toBe(0.2);
    expect(summary.varianceWaveformRmsDelta).toBeCloseTo(14 / 3, 12);
  });
});
