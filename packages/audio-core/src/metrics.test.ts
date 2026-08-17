import { describe, expect, it } from 'vitest';

import {
  analyzeAudioFrame,
  createAudioAnalyzer,
  createAudioMetricsAccumulator,
  linearToDbfs,
  type AudioAnalyzer,
} from './index';

function sineWave(frequency: number, sampleRate: number, length: number, amplitude = 1) {
  return Float32Array.from(
    { length },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequency * index) / sampleRate),
  );
}

function pushGeneratedSignal(
  analyzer: AudioAnalyzer,
  sampleRate: number,
  seconds: number,
  sampleAt: (index: number) => number,
) {
  const frameSize = 128;
  const totalSamples = Math.ceil(sampleRate * seconds);
  let metrics = analyzer.pushFrame([Float32Array.from({ length: frameSize }, () => 0)]);
  for (let offset = 0; offset < totalSamples; offset += frameSize) {
    const frame = Float32Array.from({ length: frameSize }, (_, index) => sampleAt(offset + index));
    metrics = analyzer.pushFrame([frame]);
  }
  return metrics;
}

function deterministicNoise(amplitude: number) {
  let state = 0x12345678;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return amplitude * (state / 0xffffffff - 0.5) * 2;
  };
}

describe('audio metrics', () => {
  it('calculates calibrated peak, RMS, crest factor, and Hann spectrum for a sine wave', () => {
    const metrics = analyzeAudioFrame([sineWave(440, 48_000, 2_048)], {
      sampleRate: 48_000,
    });

    expect(metrics.peakLinear).toBeCloseTo(1, 2);
    expect(metrics.peakDbfs).toBeCloseTo(0, 2);
    expect(metrics.rmsLinear).toBeCloseTo(Math.SQRT1_2, 2);
    expect(metrics.rmsDbfs).toBeCloseTo(-3.01, 1);
    expect(metrics.crestFactorDb).toBeCloseTo(3.01, 1);
    expect(metrics.dominantFrequencyHz).toBeCloseTo(440, 0);
    expect(metrics.spectrumPower).toHaveLength(1_025);
    expect(
      metrics.spectrumPower?.reduce((sum, power, index) => sum + (index === 0 ? 0 : power), 0),
    ).toBeCloseTo(0.5, 2);
    expect(metrics.spectrumWindow).toBe('hann');
    expect(metrics.clippingCandidate).toBe(false);
  });

  it('reports the expected six-decibel RMS increase when amplitude doubles', () => {
    const quiet = analyzeAudioFrame([sineWave(440, 48_000, 2_048, 0.25)], {
      sampleRate: 48_000,
    });
    const loud = analyzeAudioFrame([sineWave(440, 48_000, 2_048, 0.5)], {
      sampleRate: 48_000,
    });

    expect(loud.rmsDbfs - quiet.rmsDbfs).toBeCloseTo(6.0206, 3);
  });

  it('detects a flat clipped plateau at the configured threshold', () => {
    const clipped = Float32Array.from({ length: 512 }, (_, index) => (index % 32 < 8 ? 0.98 : 0.2));
    const metrics = analyzeAudioFrame([clipped, clipped], {
      clippingThreshold: 0.98,
      sampleRate: 44_100,
    });

    expect(metrics.channelCount).toBe(2);
    expect(metrics.clippedSampleCount).toBe(256);
    expect(metrics.clippingCandidate).toBe(true);
  });

  it('preserves opposite-polarity stereo energy during frequency analysis', () => {
    const left = sineWave(440, 48_000, 2_048, 0.5);
    const right = Float32Array.from(left, (sample) => -sample);
    const metrics = analyzeAudioFrame([left, right], { sampleRate: 48_000 });

    expect(metrics.rmsDbfs).toBeCloseTo(linearToDbfs(0.5 * Math.SQRT1_2), 1);
    expect(metrics.dominantFrequencyHz).toBeCloseTo(440, 0);
  });

  it('uses the most energetic channel for the displayed waveform', () => {
    const quiet = new Float32Array(2_048).fill(0.001);
    const active = sineWave(440, 48_000, 2_048, 0.5);
    const metrics = analyzeAudioFrame([quiet, active], { sampleRate: 48_000 });

    expect(metrics.analysisWaveform).toEqual(active);
  });

  it.each([
    { expected: 50 as const, frequencies: [50, 100, 150] },
    { expected: 60 as const, frequencies: [60, 120, 180] },
  ])('detects a persistent $expected Hz harmonic hum pattern', ({ expected, frequencies }) => {
    const sampleRate = 48_000;
    const analyzer = createAudioAnalyzer({ sampleRate });
    const metrics = pushGeneratedSignal(analyzer, sampleRate, 2.6, (index) =>
      frequencies.reduce(
        (sum, frequency, harmonicIndex) =>
          sum +
          (0.05 / (harmonicIndex + 1)) * Math.sin((2 * Math.PI * frequency * index) / sampleRate),
        0,
      ),
    );

    expect(metrics.humFrequencyHz).toBe(expected);
    expect(metrics.humConfidence).not.toBeNull();
  });

  it.each([41.2, 82.4])(
    'does not classify a sustained %s Hz instrument tone as hum',
    (frequency) => {
      const sampleRate = 48_000;
      const analyzer = createAudioAnalyzer({ sampleRate });
      const metrics = pushGeneratedSignal(
        analyzer,
        sampleRate,
        2.6,
        (index) => 0.4 * Math.sin((2 * Math.PI * frequency * index) / sampleRate),
      );

      expect(metrics.humFrequencyHz).toBeNull();
    },
  );

  it('estimates a stable broadband noise floor only after enough qualified history', () => {
    const sampleRate = 48_000;
    const amplitude = 0.02;
    const nextNoise = deterministicNoise(amplitude);
    const analyzer = createAudioAnalyzer({ sampleRate });
    const metrics = pushGeneratedSignal(analyzer, sampleRate, 3.4, () => nextNoise());
    const expectedRms = amplitude / Math.sqrt(3);

    expect(metrics.noiseFloorConfidence).toBe('high');
    expect(metrics.noiseFloorDbfs).toBeCloseTo(linearToDbfs(expectedRms), 0);
  });

  it('does not call a steady instrument tone a broadband noise floor', () => {
    const sampleRate = 48_000;
    const analyzer = createAudioAnalyzer({ sampleRate });
    const metrics = pushGeneratedSignal(
      analyzer,
      sampleRate,
      3.4,
      (index) => 0.25 * Math.sin((2 * Math.PI * 440 * index) / sampleRate),
    );

    expect(metrics.noiseFloorDbfs).toBeNull();
    expect(metrics.noiseFloorConfidence).toBeNull();
  });

  it('aggregates peak, RMS, and clipping across the complete UI report interval', () => {
    const analyzer = createAudioAnalyzer({ fftSize: 32, sampleRate: 48_000 });
    const accumulator = createAudioMetricsAccumulator();
    const quiet = analyzer.pushFrame([Float32Array.from({ length: 128 }, () => 0.1)]);
    const clipped = analyzer.pushFrame([Float32Array.from({ length: 128 }, () => 0.98)]);

    accumulator.push(quiet);
    accumulator.push(clipped);
    const report = accumulator.flush();

    expect(report?.reportStartSample).toBe(0);
    expect(report?.reportEndSample).toBe(256);
    expect(report?.frameSampleCount).toBe(256);
    expect(report?.peakLinear).toBeCloseTo(0.98, 4);
    expect(report?.rmsLinear).toBeCloseTo(Math.sqrt((0.1 ** 2 + 0.98 ** 2) / 2), 4);
    expect(report?.clippingCandidate).toBe(true);
    expect(accumulator.flush()).toBeNull();
  });

  it('keeps authoritative frame sample coordinates and resets cumulative state', () => {
    const analyzer = createAudioAnalyzer({ fftSize: 32, fftHopSize: 16, sampleRate: 48_000 });
    const frame = sineWave(440, 48_000, 64, 0.2);

    const beforeReset = analyzer.pushFrame([frame]);
    expect(beforeReset.analysisWaveform).toHaveLength(32);
    expect(beforeReset.analysisFrameEndSample).toBe(64);
    expect(beforeReset.analysisFrameStartSample).toBe(32);
    analyzer.reset();
    const afterReset = analyzer.pushFrame([frame]);
    expect(afterReset.sampleCount).toBe(64);
  });

  it('rejects malformed input and invalid analysis options', () => {
    expect(() => analyzeAudioFrame([], { sampleRate: 48_000 })).toThrow();
    expect(() =>
      analyzeAudioFrame([new Float32Array(32)], { fftSize: 48, sampleRate: 48_000 }),
    ).toThrow(/power of two/i);
    expect(() =>
      createAudioAnalyzer({ fftHopSize: 4_096, fftSize: 2_048, sampleRate: 48_000 }),
    ).toThrow(/no greater than fftSize/i);
  });
});
