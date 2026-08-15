import { describe, expect, it } from 'vitest';

import {
  analyzeDryWet,
  summarizeDryWetLatency,
  type DryWetAnalysisInput,
  type DryWetFrame,
} from './dryWet';

const SAMPLE_RATE = 48_000;
const FRAME_START_SAMPLE = 96_000;
const FRAME_LENGTH = 4_096;

function deterministicSignal(length = FRAME_LENGTH): Float32Array {
  let state = 0x1f123bb5;
  return Float32Array.from({ length }, (_, index) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const noise = (state / 0xffffffff - 0.5) * 0.5;
    const tone = 0.25 * Math.sin((2 * Math.PI * 440 * index) / SAMPLE_RATE);
    return noise + tone;
  });
}

function deterministicNoise(seed: number, length = FRAME_LENGTH): Float32Array {
  let state = seed >>> 0;
  return Float32Array.from({ length }, () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return (state / 0xffffffff - 0.5) * 0.8;
  });
}

function frame(samples: ArrayLike<number>, frameStartSample = FRAME_START_SAMPLE): DryWetFrame {
  return { frameStartSample, sampleRate: SAMPLE_RATE, samples };
}

function input(dry: ArrayLike<number>, wet: ArrayLike<number>): DryWetAnalysisInput {
  return { dry: frame(dry), wet: frame(wet) };
}

function delayed(samples: ArrayLike<number>, delaySamples: number): Float32Array {
  return Float32Array.from({ length: samples.length }, (_, index) =>
    index < delaySamples ? 0 : (samples[index - delaySamples] ?? 0),
  );
}

describe('dry/wet analysis', () => {
  it('measures zero latency and identifies a mono-like pair', () => {
    const signal = deterministicSignal();
    const result = analyzeDryWet(input(signal, signal));

    expect(result.latency.sampleOffset).toBe(0);
    expect(result.latency.milliseconds).toBe(0);
    expect(result.latency.quality).toBe('measured');
    expect(result.latency.confidence).toBe('high');
    expect(result.latency.correlation).toBeCloseTo(1, 5);
    expect(result.channelMode.mode).toBe('mono-like');
    expect(result.channelSwap.candidate).toBe(false);
    expect(result.warnings).toContain('mono-like-input');
  });

  it('finds a known wet-path latency and keeps it separate from confidence', () => {
    const signal = deterministicSignal();
    const delaySamples = 37;
    const result = analyzeDryWet(input(signal, delayed(signal, delaySamples)), {
      maxLagSamples: 128,
    });

    expect(result.latency.sampleOffset).toBe(delaySamples);
    expect(result.latency.milliseconds).toBeCloseTo((delaySamples / SAMPLE_RATE) * 1_000, 7);
    expect(result.latency.quality).toBe('measured');
    expect(result.latency.confidence).toBe('high');
    expect(result.latency.correlation).toBeGreaterThan(0.99);
    expect(result.channelMode.mode).toBe('stereo-distinct');
  });

  it('uses GCC-PHAT to find a known delay while reporting normalized confidence', () => {
    const signal = deterministicSignal();
    const delaySamples = 41;
    const result = analyzeDryWet(input(signal, delayed(signal, delaySamples)), {
      correlationMethod: 'gcc-phat',
      maxLagSamples: 128,
    });

    expect(result.correlationMethod).toBe('gcc-phat');
    expect(result.latency.sampleOffset).toBe(delaySamples);
    expect(result.latency.correlation).toBeGreaterThan(0.99);
    expect(result.latency.quality).toBe('measured');
  });

  it('labels a usable but noisy correlation as estimated instead of measured', () => {
    const signal = deterministicSignal();
    const unrelatedNoise = deterministicNoise(0x8a11ce);
    const wet = Float32Array.from(
      signal,
      (sample, index) => 0.45 * sample + 0.9 * (unrelatedNoise[index] ?? 0),
    );
    const result = analyzeDryWet(input(signal, wet));

    expect(result.latency.correlation).not.toBeNull();
    expect(Math.abs(result.latency.correlation ?? 0)).toBeGreaterThan(0.35);
    expect(Math.abs(result.latency.correlation ?? 0)).toBeLessThan(0.9);
    expect(result.latency.quality).toBe('estimated');
    expect(result.latency.confidence).toBe('medium');
  });

  it('reports gain-only change in dB without inventing latency or a swap', () => {
    const signal = deterministicSignal();
    const result = analyzeDryWet(
      input(
        signal,
        signal.map((sample) => sample * 0.5),
      ),
    );

    expect(result.gainDifferenceDb).toBeCloseTo(-6.0206, 3);
    expect(result.peakDifferenceDb).toBeCloseTo(-6.0206, 3);
    expect(result.latency.sampleOffset).toBe(0);
    expect(result.channelSwap.candidate).toBe(false);
    expect(result.channelMode.mode).toBe('mono-like');
    expect(result.warnings).toContain('mono-like-input');
    expect(result.spectrumDifference).toHaveLength(5);
    expect(result.spectrumDifference[0]?.deltaDb).toBeCloseTo(-6.0206, 2);
    expect(result.spectrumDifference[0]?.levelMatchedDeltaDb).toBeCloseTo(0, 2);
    expect(result.dynamics.wet.crestFactorDb).toBeCloseTo(
      result.dynamics.dry.crestFactorDb ?? 0,
      5,
    );
  });

  it('reports both channels as no-signal and does not emit a fake latency', () => {
    const silence = new Float32Array(FRAME_LENGTH);
    const result = analyzeDryWet(input(silence, silence));

    expect(result.noSignal.both).toBe(true);
    expect(result.dry.noSignal).toBe(true);
    expect(result.wet.noSignal).toBe(true);
    expect(result.gainDifferenceDb).toBeNull();
    expect(result.latency.sampleOffset).toBeNull();
    expect(result.latency.quality).toBe('unavailable');
    expect(result.channelMode.mode).toBe('no-signal');
    expect(result.warnings).toEqual(['both-no-signal']);
  });

  it('summarizes repeated latency candidates with median and MAD', () => {
    const signal = deterministicSignal();
    const results = [37, 38, 37, 36].map((delaySamples) =>
      analyzeDryWet(input(signal, delayed(signal, delaySamples)), { maxLagSamples: 128 }),
    );
    const summary = summarizeDryWetLatency(results);

    expect(summary.repeatCount).toBe(4);
    expect(summary.medianSampleOffset).toBe(37);
    expect(summary.madSamples).toBe(0.5);
    expect(summary.stability).toBe('high');
    expect(summary.medianMilliseconds).toBeCloseTo((37 / SAMPLE_RATE) * 1_000, 7);
  });

  it('flags a likely channel swap when wet leads dry', () => {
    const signal = deterministicSignal();
    const delaySamples = 29;
    const result = analyzeDryWet(input(delayed(signal, delaySamples), signal), {
      maxLagSamples: 128,
    });

    expect(result.latency.sampleOffset).toBe(-delaySamples);
    expect(result.latency.quality).toBe('measured');
    expect(result.channelSwap.candidate).toBe(true);
    expect(result.channelSwap.reason).toBe('wet-leads-dry');
    expect(result.channelSwap.confidence).toBe('high');
    expect(result.warnings).toContain('possible-channel-swap');
  });

  it('warns when the two inputs are effectively mono-like', () => {
    const signal = deterministicSignal();
    const result = analyzeDryWet(input(signal, signal));

    expect(result.channelMode.mode).toBe('mono-like');
    expect(result.channelMode.correlation).toBeCloseTo(1, 5);
    expect(result.channelMode.confidence).toBe('high');
    expect(result.warnings).toContain('mono-like-input');
  });

  it('validates sample coordinates, lengths, sample rates, and finite samples', () => {
    const signal = deterministicSignal();

    expect(() =>
      analyzeDryWet({ dry: frame(signal), wet: frame(signal, FRAME_START_SAMPLE + 1) }),
    ).toThrow(/frameStartSample coordinates/i);
    expect(() =>
      analyzeDryWet({
        dry: frame(signal),
        wet: { ...frame(signal), sampleRate: 44_100 },
      }),
    ).toThrow(/sample rates must match/i);
    expect(() => analyzeDryWet(input(signal, signal.slice(0, -1)))).toThrow(
      /same number of samples/i,
    );
    expect(() =>
      analyzeDryWet({
        dry: { ...frame(signal), frameEndSample: FRAME_START_SAMPLE + signal.length - 1 },
        wet: frame(signal),
      }),
    ).toThrow(/frameEndSample/i);
    expect(() =>
      analyzeDryWet(
        input(
          signal,
          Float32Array.from(signal, (_, index) => (index === 4 ? NaN : _)),
        ),
      ),
    ).toThrow(/finite values/i);
    expect(() => analyzeDryWet(input(new Float32Array(8), new Float32Array(8)))).toThrow(
      /at least 16 samples/i,
    );
  });

  it('rejects unsafe analysis options', () => {
    const signal = deterministicSignal();

    expect(() => analyzeDryWet(input(signal, signal), { maxLagSamples: -1 })).toThrow(
      /maxLagSamples/i,
    );
    expect(() => analyzeDryWet(input(signal, signal), { minimumCorrelation: 0 })).toThrow(
      /minimumCorrelation/i,
    );
    expect(() => analyzeDryWet(input(signal, signal), { noSignalThresholdDbfs: 0 })).toThrow(
      /noSignalThresholdDbfs/i,
    );
  });
});
