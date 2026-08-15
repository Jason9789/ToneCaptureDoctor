import { describe, expect, it } from 'vitest';

import { compareSnapshots, summarizeComparisons, type ComparisonInput } from './compare';

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
    spectrum: Array.from({ length: 128 }, (_, index) => (index === 20 ? 1 : 0.02)),
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

  it('reports a low-mid spectral change without calling it better or worse', () => {
    const reference = createInput();
    const candidateSpectrum = [...reference.spectrum];
    candidateSpectrum[1] = 0.7;
    const comparison = compareSnapshots(
      reference,
      createInput({ id: 'snapshot-b', spectrum: candidateSpectrum }),
    );

    const lowMid = comparison.frequencyBands.find((band) => band.label === 'low-mid');
    expect(comparison.flags.frequencyBalanceChanged).toBe(true);
    expect(lowMid?.deltaDb).toBeGreaterThan(1.5);
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

    expect(Math.abs(comparison.alignmentLagSamples)).toBeGreaterThan(0);
    expect(comparison.waveformRmsDelta).toBeLessThan(0.25);
    expect(comparison.flags.alignmentApplied).toBe(true);
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
    const comparisons = [
      compareSnapshots(createInput(), createInput({ id: 'b' })),
      compareSnapshots(
        createInput(),
        createInput({ id: 'c', waveform: createInput().waveform.map((sample) => sample * 0.9) }),
      ),
    ];
    const summary = summarizeComparisons(comparisons);

    expect(summary.count).toBe(2);
    expect(summary.medianWaveformRmsDelta).toBeGreaterThanOrEqual(0);
    expect(summary.varianceWaveformRmsDelta).toBeGreaterThanOrEqual(0);
  });
});
