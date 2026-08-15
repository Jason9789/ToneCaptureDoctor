import { describe, expect, it } from 'vitest';

import { GLOSSARY_ENTRIES, filterGlossaryEntries, getGlossaryEntry } from './index';

describe('glossary', () => {
  it('contains the Phase 7 minimum terms with evidence boundaries', () => {
    const expectedIds = [
      'hz',
      'db',
      'dbfs',
      'peak',
      'rms',
      'lufs',
      'fft',
      'window',
      'spectrum',
      'spectrogram',
      'harmonic',
      'noise-floor',
      'clipping',
      'crest-factor',
      'dynamic-range',
      'latency',
      'hi-z',
      'impedance',
    ];

    expect(GLOSSARY_ENTRIES.map((entry) => entry.id)).toEqual(expectedIds);
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.references.length).toBeGreaterThan(0);
      expect(entry.safeExperiments.length).toBeGreaterThan(0);
      expect(entry.measuredByThisApp.en).not.toHaveLength(0);
      expect(entry.notMeasuredByThisApp.en).not.toHaveLength(0);
    }
    expect(getGlossaryEntry('dbfs')?.notMeasuredByThisApp.en).toMatch(/dB SPL/);
  });

  it('filters by localized term and definition', () => {
    expect(filterGlossaryEntries('노이즈', 'ko').map((entry) => entry.id)).toContain('noise-floor');
    expect(filterGlossaryEntries('impedance', 'en').map((entry) => entry.id)).toContain(
      'impedance',
    );
  });
});
