import { describe, expect, it } from 'vitest';

import { analyzeAudioFrame, createAudioAnalyzer, linearToDbfs } from './index';

function sineWave(frequency: number, sampleRate: number, length: number, amplitude = 1) {
  return Float32Array.from(
    { length },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequency * index) / sampleRate),
  );
}

describe('audio metrics', () => {
  it('calculates peak, RMS, and crest factor for a sine wave', () => {
    const metrics = analyzeAudioFrame([sineWave(440, 48_000, 2_048)], {
      sampleRate: 48_000,
    });

    expect(metrics.peakLinear).toBeCloseTo(1, 2);
    expect(metrics.peakDbfs).toBeCloseTo(0, 2);
    expect(metrics.rmsLinear).toBeCloseTo(Math.SQRT1_2, 2);
    expect(metrics.rmsDbfs).toBeCloseTo(-3.01, 1);
    expect(metrics.crestFactorDb).toBeCloseTo(3.01, 1);
    expect(metrics.dominantFrequencyHz).toBeGreaterThanOrEqual(421.875);
    expect(metrics.dominantFrequencyHz).toBeLessThanOrEqual(445.3125);
    expect(metrics.clippingCandidate).toBe(false);
  });

  it('detects a hard-clipped frame and preserves channel count', () => {
    const clipped = Float32Array.from({ length: 512 }, (_, index) => (index % 32 < 8 ? 1 : 0.2));
    const metrics = analyzeAudioFrame([clipped, clipped], { sampleRate: 44_100 });

    expect(metrics.channelCount).toBe(2);
    expect(metrics.clippedSampleCount).toBe(256);
    expect(metrics.clippingCandidate).toBe(true);
  });

  it('detects a dominant 50 Hz hum candidate', () => {
    const metrics = analyzeAudioFrame([sineWave(50, 48_000, 2_048, 0.8)], {
      sampleRate: 48_000,
    });

    expect(metrics.humFrequencyHz).toBe(50);
  });

  it('keeps a rolling noise-floor estimate and cumulative sample count', () => {
    const analyzer = createAudioAnalyzer({
      noiseFloorWindowSize: 2,
      sampleRate: 48_000,
    });
    const quiet = Float32Array.from({ length: 128 }, () => 0.01);
    const loud = Float32Array.from({ length: 128 }, () => 0.25);

    const first = analyzer.pushFrame([quiet]);
    const second = analyzer.pushFrame([loud]);

    expect(first.sampleCount).toBe(128);
    expect(second.sampleCount).toBe(256);
    expect(second.noiseFloorDbfs).toBeCloseTo(linearToDbfs(0.01), 2);
  });

  it('rejects malformed input and invalid FFT sizes', () => {
    expect(() => analyzeAudioFrame([], { sampleRate: 48_000 })).toThrow();
    expect(() =>
      analyzeAudioFrame([new Float32Array(4)], { fftSize: 3, sampleRate: 48_000 }),
    ).toThrow(/power of two/i);
  });
});
