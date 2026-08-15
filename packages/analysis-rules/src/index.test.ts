import { describe, expect, it } from 'vitest';

import { DIAGNOSTIC_RULES, evaluateDiagnosticRules, type DiagnosticMetrics } from './index';

const baseline: DiagnosticMetrics = {
  clippingCandidate: false,
  crestFactorDb: 8,
  dominantFrequencyHz: 440,
  humFrequencyHz: null,
  noiseFloorDbfs: -60,
  peakDbfs: -12,
  rmsDbfs: -20,
};

describe('diagnostic rules', () => {
  it('fires every rule on a matching synthetic fixture', () => {
    const fixtures: Array<{ id: string; metrics: DiagnosticMetrics; warnings?: string[] }> = [
      { id: 'clipping-candidate', metrics: { ...baseline, clippingCandidate: true } },
      { id: 'no-signal', metrics: { ...baseline, peakDbfs: -72 } },
      { id: 'power-hum-candidate', metrics: { ...baseline, humFrequencyHz: 60 } },
      { id: 'high-noise-floor', metrics: { ...baseline, noiseFloorDbfs: -42 } },
      { id: 'browser-processing', metrics: baseline, warnings: ['gain-control-enabled'] },
    ];

    for (const fixture of fixtures) {
      expect(evaluateDiagnosticRules(fixture.metrics, { warnings: fixture.warnings })).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: fixture.id, matched: true })]),
      );
    }
  });

  it('does not fire warnings for a clean, useful fixture', () => {
    expect(evaluateDiagnosticRules(baseline)).toHaveLength(0);
  });

  it('keeps every rule actionable and avoids prescriptive tone claims', () => {
    for (const rule of DIAGNOSTIC_RULES) {
      expect(rule.experiments.length).toBeGreaterThan(0);
      expect(rule.neverClaim.length).toBeGreaterThan(0);
      const text = rule.possibleCauses.map((cause) => cause.en).join(' ');
      expect(text).not.toMatch(/turn up the bass|set the bass/i);
    }
  });
});
