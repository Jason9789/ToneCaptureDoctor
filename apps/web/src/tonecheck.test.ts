import { describe, expect, it } from 'vitest';

import { encodeWav } from './audioClip';
import {
  clearAllLocalData,
  createSessionId,
  deleteSnapshot,
  exportTestLog,
  listSnapshots,
  saveSnapshot,
  TestLogWriter,
  type SnapshotRecord,
} from './sessionStore';
import {
  exportTonecheck,
  importTonecheck,
  migrateTonecheckSnapshot,
  type TonecheckSnapshot,
} from './tonecheck';

function createFixture(id: string, audioClip?: Blob): SnapshotRecord {
  return {
    algorithmVersion: '0.1.0',
    audioClip,
    channelCount: 2,
    createdAt: '2026-08-16T00:00:00.000Z',
    endSample: 2_048,
    fftSize: 2_048,
    id,
    label: 'tonecheck fixture',
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
    notes: 'archive fixture',
    sampleRate: 48_000,
    schemaVersion: 2,
    sessionId: 'session-fixture',
    spectrum: Array.from({ length: 1_025 }, (_, index) => (index === 20 ? 1 : 0)),
    spectrumUnit: 'power-per-bin',
    startSample: 0,
    waveform: [0, 0.5, -0.5],
    window: 'hann',
  };
}

describe('.tonecheck archive', () => {
  it('round-trips snapshot metadata, checksums, and an audio asset', async () => {
    const audioClip = encodeWav([new Float32Array(4_800).fill(0.25)], 48_000);
    const snapshot = createFixture('tonecheck-round-trip', audioClip);
    await saveSnapshot(snapshot);
    const sessionId = createSessionId();
    const writer = new TestLogWriter({
      appVersion: 'test',
      locale: 'en',
      sessionId,
      startedAt: new Date().toISOString(),
      trackSettings: { channelCount: 2, sampleRate: 48_000 },
    });
    await writer.start();
    writer.append('status', { status: 'fixture' });
    await writer.finish('stopped');

    const exported = await exportTonecheck('test');
    expect(exported.blob.type).toBe('application/zip');
    expect(exported.manifest.archiveType).toBe('tonecheck');
    expect(exported.manifest.snapshotCount).toBeGreaterThanOrEqual(1);
    expect(exported.manifest.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        'audio/tonecheck-round-trip.bin',
        'reports/analysis.json',
        'snapshots.json',
      ]),
    );

    await clearAllLocalData();
    expect((await listSnapshots()).some((candidate) => candidate.id === snapshot.id)).toBe(false);

    await importTonecheck(exported.blob);
    const imported = (await listSnapshots()).find((candidate) => candidate.id === snapshot.id);
    expect(imported).toMatchObject({
      algorithmVersion: '0.1.0',
      label: 'tonecheck fixture',
      spectrumUnit: 'power-per-bin',
    });
    expect(imported?.audioClip?.type).toBe('audio/wav');
    expect(imported?.audioClip?.size).toBe(audioClip.size);
    expect((await exportTestLog(sessionId)).events).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: 'status' })]),
    );

    await clearAllLocalData();
  });

  it('keeps legacy schema snapshots explicitly uncalibrated', () => {
    const legacy = {
      ...createFixture('tonecheck-legacy'),
      schemaVersion: 1,
      spectrumUnit: undefined,
    } as TonecheckSnapshot;
    expect(migrateTonecheckSnapshot(legacy)).not.toHaveProperty('spectrumUnit');
  });

  it('rejects an archive whose bytes were changed', async () => {
    const snapshot = createFixture('tonecheck-corrupt');
    await saveSnapshot(snapshot);
    const exported = await exportTonecheck('test');
    const bytes = new Uint8Array(await exported.blob.arrayBuffer());
    // The final 22 bytes are the end-of-central-directory record; corrupt the
    // preceding central-directory filename byte so the archive remains bounded
    // but no longer matches its manifest entry.
    bytes[bytes.length - 23] = (bytes[bytes.length - 23] ?? 0) ^ 0xff;

    await expect(importTonecheck(new Blob([bytes]))).rejects.toThrow(
      /central directory|corrupt|invalid/i,
    );
    await deleteSnapshot(snapshot.id);
  });
});
