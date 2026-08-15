import { describe, expect, it } from 'vitest';

import {
  createSessionId,
  deleteSnapshot,
  exportSnapshots,
  exportTestLog,
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
      channelCount: 2,
      clippedSampleCount: 0,
      clippingCandidate: false,
      crestFactorDb: 3,
      dominantFrequencyHz: 440,
      frameSampleCount: 128,
      humFrequencyHz: null,
      noiseFloorDbfs: -60,
      peakDbfs: -6,
      peakLinear: 0.5,
      rmsDbfs: -12,
      rmsLinear: 0.25,
      sampleCount: 128,
      sampleRate: 48_000,
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
        humFrequencyHz: null,
        noiseFloorDbfs: -60,
        peakDbfs: -6,
        rmsDbfs: -12,
        sampleCount: 2_048,
        sampleRate: 48_000,
      },
      notes: 'fixture',
      sampleRate: 48_000,
      schemaVersion: 1,
      sessionId: createSessionId(),
      spectrum: [0.2, 0.4],
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
          schemaVersion: 1,
          sessionId: createSessionId(),
          spectrum: [],
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
});
