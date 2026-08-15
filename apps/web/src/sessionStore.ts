import type { AudioMetrics } from '@tone-capture-doctor/audio-core';

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const TEST_LOG_SCHEMA_VERSION = 1;

export type LocalStorageErrorCode = 'quota' | 'unavailable' | 'unknown';

export class LocalStorageError extends Error {
  readonly code: LocalStorageErrorCode;

  constructor(code: LocalStorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LocalStorageError';
    this.code = code;
  }
}

export interface SnapshotRecord {
  algorithmVersion: string;
  audioClip?: Blob;
  channelCount: number;
  createdAt: string;
  endSample: number;
  fftSize: number;
  id: string;
  inputDeviceLabel?: string;
  label: string;
  metrics: Pick<
    AudioMetrics,
    | 'clippingCandidate'
    | 'crestFactorDb'
    | 'dominantFrequencyHz'
    | 'humFrequencyHz'
    | 'noiseFloorDbfs'
    | 'peakDbfs'
    | 'rmsDbfs'
    | 'sampleCount'
    | 'sampleRate'
  >;
  notes: string;
  sampleRate: number;
  schemaVersion: number;
  sessionId: string;
  spectrum: number[];
  startSample: number;
  waveform: number[];
  window: 'hann';
}

export interface TestLogSession {
  appVersion: string;
  endedAt?: string;
  locale: string;
  sessionId: string;
  startedAt: string;
  trackSettings: Record<string, boolean | number | string | undefined>;
}

export interface TestLogEvent {
  eventId: string;
  eventType: 'metric' | 'session-ended' | 'session-started' | 'status';
  payload: Record<string, boolean | number | string | null | undefined>;
  sequence: number;
  sessionId: string;
  timestamp: string;
}

export interface TestLogExport {
  events: TestLogEvent[];
  exportedAt: string;
  schemaVersion: number;
  session: TestLogSession;
}

export interface SnapshotExportBundle {
  exportedAt: string;
  schemaVersion: number;
  snapshots: Array<
    Omit<SnapshotRecord, 'audioClip'> & {
      audioClipBase64?: string;
      audioClipType?: string;
    }
  >;
}

const DATABASE_NAME = 'tone-capture-doctor-local';
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';
const TEST_EVENT_STORE = 'test-events';
const TEST_SESSION_STORE = 'test-sessions';

const memorySnapshots = new Map<string, SnapshotRecord>();
const memorySessions = new Map<string, TestLogSession>();
const memoryEvents: TestLogEvent[] = [];
let databasePromise: Promise<IDBDatabase> | undefined;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error('IndexedDB is unavailable.'));
  }
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(TEST_SESSION_STORE)) {
        database.createObjectStore(TEST_SESSION_STORE, { keyPath: 'sessionId' });
      }
      if (!database.objectStoreNames.contains(TEST_EVENT_STORE)) {
        const events = database.createObjectStore(TEST_EVENT_STORE, { keyPath: 'eventId' });
        events.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };
  });

  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Local storage write failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Local storage write aborted.'));
  });
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeStorageError(error: unknown): LocalStorageError {
  const name =
    (typeof DOMException !== 'undefined' && error instanceof DOMException) || error instanceof Error
      ? error.name
      : undefined;
  if (name === 'QuotaExceededError') {
    return new LocalStorageError(
      'quota',
      'Local browser storage is full. Export snapshots and remove older data before trying again.',
      { cause: error },
    );
  }
  if (name === 'InvalidStateError' || name === 'NotFoundError') {
    return new LocalStorageError(
      'unavailable',
      'Local browser storage is unavailable in this context.',
      { cause: error },
    );
  }
  return new LocalStorageError('unknown', 'Local browser storage request failed.', {
    cause: error,
  });
}

export function createSessionId(): string {
  return createId('session');
}

export async function saveSnapshot(snapshot: SnapshotRecord): Promise<void> {
  if (!hasIndexedDb()) {
    memorySnapshots.set(snapshot.id, snapshot);
    return;
  }
  try {
    const database = await openDatabase();
    const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite');
    transaction.objectStore(SNAPSHOT_STORE).put(snapshot);
    await transactionComplete(transaction);
    memorySnapshots.set(snapshot.id, snapshot);
  } catch (error) {
    throw normalizeStorageError(error);
  }
}

export async function listSnapshots(): Promise<SnapshotRecord[]> {
  if (!hasIndexedDb()) {
    return [...memorySnapshots.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }
  const database = await openDatabase();
  const transaction = database.transaction(SNAPSHOT_STORE, 'readonly');
  const snapshots = await requestResult(transaction.objectStore(SNAPSHOT_STORE).getAll());
  return snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  memorySnapshots.delete(snapshotId);
  if (!hasIndexedDb()) {
    return;
  }
  try {
    const database = await openDatabase();
    const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite');
    transaction.objectStore(SNAPSHOT_STORE).delete(snapshotId);
    await transactionComplete(transaction);
  } catch (error) {
    throw normalizeStorageError(error);
  }
}

export async function saveTestLogSession(session: TestLogSession): Promise<void> {
  memorySessions.set(session.sessionId, session);
  if (!hasIndexedDb()) {
    return;
  }
  const database = await openDatabase();
  const transaction = database.transaction(TEST_SESSION_STORE, 'readwrite');
  transaction.objectStore(TEST_SESSION_STORE).put(session);
  await transactionComplete(transaction);
}

export async function appendTestLogEvents(events: TestLogEvent[]): Promise<void> {
  memoryEvents.push(...events);
  if (!hasIndexedDb() || events.length === 0) {
    return;
  }
  const database = await openDatabase();
  const transaction = database.transaction(TEST_EVENT_STORE, 'readwrite');
  const store = transaction.objectStore(TEST_EVENT_STORE);
  for (const event of events) {
    store.put(event);
  }
  await transactionComplete(transaction);
}

export async function exportTestLog(sessionId: string): Promise<TestLogExport> {
  const session = memorySessions.get(sessionId);
  let events = memoryEvents.filter((event) => event.sessionId === sessionId);

  if (hasIndexedDb()) {
    const database = await openDatabase();
    const sessionTransaction = database.transaction(TEST_SESSION_STORE, 'readonly');
    const storedSession = await requestResult(
      sessionTransaction.objectStore(TEST_SESSION_STORE).get(sessionId),
    );
    const eventTransaction = database.transaction(TEST_EVENT_STORE, 'readonly');
    const eventIndex = eventTransaction.objectStore(TEST_EVENT_STORE).index('sessionId');
    events = await requestResult(eventIndex.getAll(sessionId));
    if (storedSession) {
      return {
        events: events.sort((left, right) => left.sequence - right.sequence),
        exportedAt: new Date().toISOString(),
        schemaVersion: TEST_LOG_SCHEMA_VERSION,
        session: storedSession,
      };
    }
  }

  if (!session) {
    throw new Error('The requested test session was not found.');
  }
  return {
    events: events.sort((left, right) => left.sequence - right.sequence),
    exportedAt: new Date().toISOString(),
    schemaVersion: TEST_LOG_SCHEMA_VERSION,
    session,
  };
}

export class TestLogWriter {
  readonly session: TestLogSession;
  private pendingEvents: TestLogEvent[] = [];
  private sequence = 0;
  private flushTimer: number | undefined;
  private startPromise: Promise<void> | undefined;

  constructor(session: TestLogSession) {
    this.session = session;
  }

  async start(): Promise<void> {
    if (!this.startPromise) {
      this.append('session-started', { locale: this.session.locale });
      this.startPromise = (async () => {
        await saveTestLogSession(this.session);
        await this.flush();
      })();
    }
    await this.startPromise;
  }

  append(
    eventType: TestLogEvent['eventType'],
    payload: Record<string, boolean | number | string | null | undefined>,
  ): void {
    this.pendingEvents.push({
      eventId: createId('event'),
      eventType,
      payload,
      sequence: this.sequence,
      sessionId: this.session.sessionId,
      timestamp: new Date().toISOString(),
    });
    this.sequence += 1;
    if (this.flushTimer === undefined) {
      this.flushTimer = window.setTimeout(() => {
        this.flushTimer = undefined;
        void this.flush();
      }, 1_000);
    }
  }

  appendMetrics(metrics: AudioMetrics): void {
    this.append('metric', {
      algorithmVersion: metrics.algorithmVersion,
      channelCount: metrics.channelCount,
      clippingCandidate: metrics.clippingCandidate,
      crestFactorDb: metrics.crestFactorDb,
      dominantFrequencyHz: metrics.dominantFrequencyHz,
      humFrequencyHz: metrics.humFrequencyHz,
      noiseFloorDbfs: metrics.noiseFloorDbfs,
      peakDbfs: metrics.peakDbfs,
      rmsDbfs: metrics.rmsDbfs,
      sampleCount: metrics.sampleCount,
      sampleRate: metrics.sampleRate,
    });
  }

  async finish(status: string): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
    }
    if (this.flushTimer !== undefined) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.append('session-ended', { status });
    await this.flush();
    await saveTestLogSession({ ...this.session, endedAt: new Date().toISOString() });
  }

  private async flush(): Promise<void> {
    if (this.pendingEvents.length === 0) {
      return;
    }
    const events = this.pendingEvents;
    this.pendingEvents = [];
    await appendTestLogEvents(events);
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

export async function exportSnapshots(): Promise<string> {
  const snapshots = await listSnapshots();
  const serializedSnapshots: SnapshotExportBundle['snapshots'] = [];
  for (const snapshot of snapshots) {
    const { audioClip, ...metadata } = snapshot;
    serializedSnapshots.push({
      ...metadata,
      ...(audioClip
        ? { audioClipBase64: await blobToBase64(audioClip), audioClipType: audioClip.type }
        : {}),
    });
  }
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      snapshots: serializedSnapshots,
    } satisfies SnapshotExportBundle,
    null,
    2,
  );
}

export async function importSnapshots(serialized: string): Promise<number> {
  if (serialized.length > 10_000_000) {
    throw new Error('Snapshot import is too large.');
  }

  const parsed: unknown = JSON.parse(serialized);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { snapshots?: unknown }).snapshots)
  ) {
    throw new Error('The snapshot file is invalid.');
  }

  let importedCount = 0;
  for (const candidate of (parsed as { snapshots: unknown[] }).snapshots) {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('The snapshot file contains an invalid record.');
    }
    const entry = candidate as Partial<SnapshotExportBundle['snapshots'][number]>;
    if (
      typeof entry.id !== 'string' ||
      typeof entry.label !== 'string' ||
      typeof entry.createdAt !== 'string' ||
      typeof entry.sampleRate !== 'number' ||
      !Array.isArray(entry.waveform) ||
      !Array.isArray(entry.spectrum)
    ) {
      throw new Error('The snapshot file contains an incomplete record.');
    }

    const { audioClipBase64, audioClipType, ...metadata } = entry;
    await saveSnapshot({
      ...metadata,
      ...(audioClipBase64
        ? { audioClip: base64ToBlob(audioClipBase64, audioClipType || 'audio/webm') }
        : {}),
    } as SnapshotRecord);
    importedCount += 1;
  }
  return importedCount;
}
