import { describe, expect, it } from 'vitest';

import { analyzeDryWet } from '@tone-capture-doctor/audio-core';

import {
  createSessionId,
  clearAllLocalData,
  deleteSnapshot,
  exportSnapshots,
  exportTestLog,
  appendTestLogEvents,
  importSnapshots,
  listSnapshots,
  saveSnapshot,
  TestLogWriter,
  type SnapshotRecord,
} from './sessionStore';

describe('local test session storage', () => {
  it('writes structured metric events without raw signal arrays', async () => {
    const sessionId = createSessionId();
    const writer = new TestLogWriter({
      appVersion: 'test',
      locale: 'en',
      sessionId,
      startedAt: new Date().toISOString(),
      trackSettings: { channelCount: 2, sampleRate: 48_000 },
    });

    await writer.start();
    writer.appendMetrics({
      algorithmVersion: '0.1.0',
      analysisFrameEndSample: 128,
      analysisFrameStartSample: 0,
      analysisWaveform: new Float32Array(128),
      audioTimeSeconds: 128 / 48_000,
      channelCount: 2,
      clippedSampleCount: 0,
      clippingCandidate: false,
      crestFactorDb: 3,
      dominantFrequencyHz: 440,
      frameSampleCount: 128,
      frequencyBands: [],
      humConfidence: null,
      humFrequencyHz: null,
      noiseFloorConfidence: 'medium',
      noiseFloorDbfs: -60,
      peakDbfs: -6,
      peakLinear: 0.5,
      reportEndSample: 128,
      reportStartSample: 0,
      rmsDbfs: -12,
      rmsLinear: 0.25,
      sampleCount: 128,
      sampleRate: 48_000,
      spectrumBinHz: 48_000 / 2_048,
      spectrumFftSize: 2_048,
      spectrumPower: new Float64Array(1_025),
      spectrumWindow: 'hann',
    });
    await writer.finish('stopped');

    const exported = await exportTestLog(sessionId);
    expect(exported.schemaVersion).toBe(1);
    expect(exported.events.map((event) => event.eventType)).toEqual([
      'session-started',
      'metric',
      'session-ended',
    ]);
    expect(exported.events[1]?.payload).toMatchObject({
      dominantFrequencyHz: 440,
      sampleCount: 128,
    });
    expect(exported.events[1]?.payload).not.toHaveProperty('waveform');
    expect(exported.events[1]?.payload).not.toHaveProperty('rawAudio');
    expect(exported.integrity).toMatchObject({
      eventCount: 3,
      isContiguous: true,
      missingSequenceCount: 0,
    });
  });

  it('preserves events appended while an IndexedDB flush is in flight', async () => {
    await clearAllLocalData();
    const sessionId = createSessionId();
    let persistCallCount = 0;
    let releasePersist: () => void = () => undefined;
    let resolvePersistStarted: () => void = () => undefined;
    const persistStarted = new Promise<void>((resolve) => {
      resolvePersistStarted = resolve;
    });
    const writer = new TestLogWriter(
      {
        appVersion: 'test',
        locale: 'en',
        sessionId,
        startedAt: new Date().toISOString(),
        trackSettings: { channelCount: 1, sampleRate: 48_000 },
      },
      {
        persistEvents: async (events) => {
          persistCallCount += 1;
          if (persistCallCount === 2) {
            resolvePersistStarted();
            await new Promise<void>((resolve) => {
              releasePersist = resolve;
            });
          }
          await appendTestLogEvents(events);
        },
      },
    );

    await writer.start();
    writer.append('status', { status: 'before-flush' });
    const flushPromise = writer.flushPending();
    await persistStarted;
    writer.append('status', { status: 'during-flush' });
    releasePersist();
    await flushPromise;
    await writer.finish('stopped');

    const exported = await exportTestLog(sessionId);
    expect(exported.events.map((event) => event.sequence)).toEqual([0, 1, 2, 3]);
    expect(exported.integrity).toMatchObject({
      eventCount: 4,
      isContiguous: true,
      missingSequenceCount: 0,
    });
    await clearAllLocalData();
  });

  it('round-trips snapshot metadata through a local JSON export', async () => {
    const snapshot: SnapshotRecord = {
      algorithmVersion: '0.1.0',
      channelCount: 2,
      createdAt: new Date().toISOString(),
      endSample: 2_048,
      fftSize: 2_048,
      id: `snapshot-${createSessionId()}`,
      label: 'round trip',
      metrics: {
        clippingCandidate: false,
        crestFactorDb: 3,
        dominantFrequencyHz: 440,
        humConfidence: 'medium',
        humFrequencyHz: null,
        noiseFloorConfidence: 'high',
        noiseFloorDbfs: -60,
        peakDbfs: -6,
        rmsDbfs: -12,
        sampleCount: 2_048,
        sampleRate: 48_000,
      },
      notes: 'fixture',
      sampleRate: 48_000,
      schemaVersion: 2,
      sessionId: createSessionId(),
      spectrum: Array.from({ length: 1_025 }, (_, index) => (index === 20 ? 1 : 0)),
      spectrumUnit: 'power-per-bin',
      startSample: 0,
      waveform: [0, 0.5, -0.5],
      window: 'hann',
    };

    await saveSnapshot(snapshot);
    const serialized = await exportSnapshots();
    await deleteSnapshot(snapshot.id);
    expect((await listSnapshots()).some((candidate) => candidate.id === snapshot.id)).toBe(false);

    await importSnapshots(serialized);
    expect((await listSnapshots()).find((candidate) => candidate.id === snapshot.id)).toMatchObject(
      {
        label: 'round trip',
        notes: 'fixture',
        sampleRate: 48_000,
      },
    );
    expect(
      (await listSnapshots()).find((candidate) => candidate.id === snapshot.id)?.metrics,
    ).toMatchObject({
      humConfidence: 'medium',
      noiseFloorConfidence: 'high',
    });
  });

  it('stores dry/wet summaries without raw audio arrays', async () => {
    const sessionId = createSessionId();
    const writer = new TestLogWriter({
      appVersion: 'test',
      locale: 'en',
      sessionId,
      startedAt: new Date().toISOString(),
      trackSettings: { channelCount: 2, sampleRate: 48_000 },
    });
    await writer.start();
    const signal = new Float32Array(32).fill(0.1);
    writer.appendDryWetResult(
      analyzeDryWet(
        {
          dry: { frameStartSample: 0, sampleRate: 48_000, samples: signal },
          wet: { frameStartSample: 0, sampleRate: 48_000, samples: signal },
        },
        { correlationMethod: 'gcc-phat' },
      ),
    );
    await writer.finish('stopped');

    const exported = await exportTestLog(sessionId);
    const dryWetEvent = exported.events.find(
      (event) => event.eventType === 'metric' && event.payload.analysisType === 'dry-wet',
    );
    expect(dryWetEvent?.payload).toMatchObject({
      algorithmVersion: '0.2.0',
      correlationMethod: 'gcc-phat',
    });
    expect(dryWetEvent?.payload).not.toHaveProperty('samples');
    expect(dryWetEvent?.payload).not.toHaveProperty('rawAudio');
  });

  it('lists 100 local snapshots without a slow storage scan', async () => {
    const startedAt = performance.now();
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        saveSnapshot({
          algorithmVersion: '0.1.0',
          channelCount: 1,
          createdAt: new Date(Date.now() + index).toISOString(),
          endSample: index + 1,
          fftSize: 2_048,
          id: `performance-${createSessionId()}`,
          label: `Performance ${index}`,
          metrics: {
            clippingCandidate: false,
            crestFactorDb: null,
            dominantFrequencyHz: null,
            humFrequencyHz: null,
            noiseFloorDbfs: -60,
            peakDbfs: -12,
            rmsDbfs: -18,
            sampleCount: index + 1,
            sampleRate: 48_000,
          },
          notes: '',
          sampleRate: 48_000,
          schemaVersion: 2,
          sessionId: createSessionId(),
          spectrum: Array.from({ length: 1_025 }, () => 0),
          spectrumUnit: 'power-per-bin',
          startSample: index,
          waveform: [],
          window: 'hann',
        }),
      ),
    );
    const snapshots = await listSnapshots();
    expect(snapshots.filter((snapshot) => snapshot.label.startsWith('Performance')).length).toBe(
      100,
    );
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });

  it('rejects a current snapshot with an ambiguous or malformed spectrum', async () => {
    const invalid = JSON.stringify({
      schemaVersion: 2,
      snapshots: [
        {
          algorithmVersion: '0.1.0',
          channelCount: 1,
          createdAt: new Date().toISOString(),
          endSample: 2_048,
          fftSize: 2_048,
          id: 'invalid-spectrum',
          label: 'invalid',
          metrics: {
            clippingCandidate: false,
            crestFactorDb: null,
            dominantFrequencyHz: null,
            humConfidence: null,
            humFrequencyHz: null,
            noiseFloorConfidence: null,
            noiseFloorDbfs: -60,
            peakDbfs: -12,
            rmsDbfs: -18,
            sampleCount: 2_048,
            sampleRate: 48_000,
          },
          notes: '',
          sampleRate: 48_000,
          schemaVersion: 2,
          sessionId: 'invalid-session',
          spectrum: [0.1, 0.2],
          spectrumUnit: 'magnitude',
          startSample: 0,
          waveform: [0, 0.1],
          window: 'hann',
        },
      ],
    });

    await expect(importSnapshots(invalid)).rejects.toThrow(/calibrated spectrum/i);
  });

  it('deletes all local memory data as an explicit privacy operation', async () => {
    await clearAllLocalData();
    expect(await listSnapshots()).toEqual([]);
  });
});
