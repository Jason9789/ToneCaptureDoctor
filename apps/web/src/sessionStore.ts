import type { AudioMetrics, DryWetAnalysisResult } from '@tone-capture-doctor/audio-core';

export const SNAPSHOT_SCHEMA_VERSION = 2;
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
  > &
    Partial<Pick<AudioMetrics, 'humConfidence' | 'noiseFloorConfidence'>>;
  notes: string;
  sampleRate: number;
  schemaVersion: number;
  sessionId: string;
  spectrum: number[];
  /** Missing only on legacy schema-v1 snapshots, which cannot be compared safely. */
  comparisonStatus?: 'comparable' | 'legacy-uncomparable';
  spectrumUnit?: 'power-per-bin';
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

export async function listTestLogSessions(): Promise<TestLogSession[]> {
  if (!hasIndexedDb()) {
    return [...memorySessions.values()].sort((left, right) =>
      right.startedAt.localeCompare(left.startedAt),
    );
  }
  try {
    const database = await openDatabase();
    const transaction = database.transaction(TEST_SESSION_STORE, 'readonly');
    const sessions = await requestResult(transaction.objectStore(TEST_SESSION_STORE).getAll());
    return sessions.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  } catch (error) {
    throw normalizeStorageError(error);
  }
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
const DATABASE_VERSION = 2;
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
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
    request.onupgradeneeded = (event) => {
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
      if (event.oldVersion < 2 && database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        const snapshots = request.transaction?.objectStore(SNAPSHOT_STORE);
        if (snapshots) {
          const cursorRequest = snapshots.openCursor();
          cursorRequest.onsuccess = (cursorEvent) => {
            const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue>).result;
            if (!cursor) {
              return;
            }
            const value = cursor.value as Partial<SnapshotRecord>;
            if (value.schemaVersion === 1 && !value.comparisonStatus) {
              cursor.update({ ...value, comparisonStatus: 'legacy-uncomparable' });
            }
            cursor.continue();
          };
        }
      }
    };
  });

  void databasePromise.catch(() => {
    databasePromise = undefined;
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

export async function saveSnapshotsAtomically(snapshots: SnapshotRecord[]): Promise<void> {
  await saveSnapshotsAndLogsAtomically(snapshots, []);
}

export async function saveSnapshotsAndLogsAtomically(
  snapshots: SnapshotRecord[],
  logs: TestLogExport[],
): Promise<void> {
  if (snapshots.length === 0) {
    if (logs.length === 0) {
      return;
    }
  }
  if (!hasIndexedDb()) {
    for (const snapshot of snapshots) {
      memorySnapshots.set(snapshot.id, snapshot);
    }
    for (const log of logs) {
      memorySessions.set(log.session.sessionId, log.session);
      const eventIds = new Set(log.events.map((event) => event.eventId));
      for (let index = memoryEvents.length - 1; index >= 0; index -= 1) {
        if (eventIds.has(memoryEvents[index]?.eventId ?? '')) {
          memoryEvents.splice(index, 1);
        }
      }
      memoryEvents.push(...log.events);
    }
    return;
  }
  try {
    const database = await openDatabase();
    const transaction = database.transaction(
      [SNAPSHOT_STORE, TEST_SESSION_STORE, TEST_EVENT_STORE],
      'readwrite',
    );
    const snapshotStore = transaction.objectStore(SNAPSHOT_STORE);
    for (const snapshot of snapshots) {
      snapshotStore.put(snapshot);
    }
    const sessionStore = transaction.objectStore(TEST_SESSION_STORE);
    const eventStore = transaction.objectStore(TEST_EVENT_STORE);
    for (const log of logs) {
      sessionStore.put(log.session);
      for (const event of log.events) {
        eventStore.put(event);
      }
    }
    await transactionComplete(transaction);
    for (const snapshot of snapshots) {
      memorySnapshots.set(snapshot.id, snapshot);
    }
    for (const log of logs) {
      memorySessions.set(log.session.sessionId, log.session);
      const eventIds = new Set(log.events.map((event) => event.eventId));
      for (let index = memoryEvents.length - 1; index >= 0; index -= 1) {
        if (eventIds.has(memoryEvents[index]?.eventId ?? '')) {
          memoryEvents.splice(index, 1);
        }
      }
      memoryEvents.push(...log.events);
    }
  } catch (error) {
    throw normalizeStorageError(error);
  }
}

function normalizeStoredSnapshot(value: unknown): SnapshotRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const { audioClip, ...metadata } = value;
  try {
    const parsed = parseSnapshotRecord(metadata);
    return typeof Blob !== 'undefined' && audioClip instanceof Blob
      ? { ...parsed, audioClip }
      : parsed;
  } catch {
    return null;
  }
}

export async function listSnapshots(): Promise<SnapshotRecord[]> {
  if (!hasIndexedDb()) {
    return [...memorySnapshots.values()]
      .map(normalizeStoredSnapshot)
      .filter((snapshot): snapshot is SnapshotRecord => snapshot !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
  const database = await openDatabase();
  const transaction = database.transaction(SNAPSHOT_STORE, 'readonly');
  const storedSnapshots = await requestResult(transaction.objectStore(SNAPSHOT_STORE).getAll());
  return storedSnapshots
    .map(normalizeStoredSnapshot)
    .filter((snapshot): snapshot is SnapshotRecord => snapshot !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  if (!hasIndexedDb()) {
    memorySnapshots.delete(snapshotId);
    return;
  }
  try {
    const database = await openDatabase();
    const transaction = database.transaction(SNAPSHOT_STORE, 'readwrite');
    transaction.objectStore(SNAPSHOT_STORE).delete(snapshotId);
    await transactionComplete(transaction);
    memorySnapshots.delete(snapshotId);
  } catch (error) {
    throw normalizeStorageError(error);
  }
}

export async function clearAllLocalData(): Promise<void> {
  if (!hasIndexedDb()) {
    memorySnapshots.clear();
    memorySessions.clear();
    memoryEvents.length = 0;
    return;
  }
  try {
    const database = await openDatabase();
    const transaction = database.transaction(
      [SNAPSHOT_STORE, TEST_SESSION_STORE, TEST_EVENT_STORE],
      'readwrite',
    );
    transaction.objectStore(SNAPSHOT_STORE).clear();
    transaction.objectStore(TEST_SESSION_STORE).clear();
    transaction.objectStore(TEST_EVENT_STORE).clear();
    await transactionComplete(transaction);
    memorySnapshots.clear();
    memorySessions.clear();
    memoryEvents.length = 0;
  } catch (error) {
    throw normalizeStorageError(error);
  }
}

export async function saveTestLogSession(session: TestLogSession): Promise<void> {
  if (!hasIndexedDb()) {
    memorySessions.set(session.sessionId, session);
    return;
  }
  try {
    const database = await openDatabase();
    const transaction = database.transaction(TEST_SESSION_STORE, 'readwrite');
    transaction.objectStore(TEST_SESSION_STORE).put(session);
    await transactionComplete(transaction);
    memorySessions.set(session.sessionId, session);
  } catch (error) {
    throw normalizeStorageError(error);
  }
}

export async function appendTestLogEvents(events: TestLogEvent[]): Promise<void> {
  if (!hasIndexedDb() || events.length === 0) {
    memoryEvents.push(...events);
    return;
  }
  try {
    const database = await openDatabase();
    const transaction = database.transaction(TEST_EVENT_STORE, 'readwrite');
    const store = transaction.objectStore(TEST_EVENT_STORE);
    for (const event of events) {
      store.put(event);
    }
    await transactionComplete(transaction);
    memoryEvents.push(...events);
  } catch (error) {
    throw normalizeStorageError(error);
  }
}

export async function deleteTestLogSession(sessionId: string): Promise<void> {
  if (!hasIndexedDb()) {
    memorySessions.delete(sessionId);
    for (let index = memoryEvents.length - 1; index >= 0; index -= 1) {
      if (memoryEvents[index]?.sessionId === sessionId) {
        memoryEvents.splice(index, 1);
      }
    }
    return;
  }
  try {
    const database = await openDatabase();
    const transaction = database.transaction([TEST_SESSION_STORE, TEST_EVENT_STORE], 'readwrite');
    transaction.objectStore(TEST_SESSION_STORE).delete(sessionId);
    const cursorRequest = transaction
      .objectStore(TEST_EVENT_STORE)
      .index('sessionId')
      .openCursor(sessionId);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) {
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    await transactionComplete(transaction);
    memorySessions.delete(sessionId);
    for (let index = memoryEvents.length - 1; index >= 0; index -= 1) {
      if (memoryEvents[index]?.sessionId === sessionId) {
        memoryEvents.splice(index, 1);
      }
    }
  } catch (error) {
    throw normalizeStorageError(error);
  }
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

export async function exportAllTestLogs(): Promise<TestLogExport[]> {
  const sessions = await listTestLogSessions();
  return Promise.all(sessions.map((session) => exportTestLog(session.sessionId)));
}

export class TestLogWriter {
  readonly session: TestLogSession;
  private pendingEvents: TestLogEvent[] = [];
  private sequence = 0;
  private flushTimer: number | undefined;
  private flushPromise: Promise<void> | undefined;
  private startPromise: Promise<void> | undefined;
  private readonly onError?: (error: unknown) => void;

  constructor(session: TestLogSession, options: { onError?: (error: unknown) => void } = {}) {
    this.session = session;
    this.onError = options.onError;
  }

  async start(): Promise<void> {
    if (!this.startPromise) {
      this.append('session-started', { locale: this.session.locale });
      this.startPromise = (async () => {
        await saveTestLogSession(this.session);
        await this.flush();
      })();
      void this.startPromise.catch(() => {
        this.onError?.(new Error('Could not start the local test log.'));
        this.startPromise = undefined;
      });
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
        void this.flush().catch(() => {
          // Keep failed events in the queue. The next append or finish call retries them.
        });
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
      humConfidence: metrics.humConfidence,
      humFrequencyHz: metrics.humFrequencyHz,
      noiseFloorConfidence: metrics.noiseFloorConfidence,
      noiseFloorDbfs: metrics.noiseFloorDbfs,
      audioTimeSeconds: metrics.audioTimeSeconds,
      peakDbfs: metrics.peakDbfs,
      reportEndSample: metrics.reportEndSample,
      reportStartSample: metrics.reportStartSample,
      rmsDbfs: metrics.rmsDbfs,
      sampleCount: metrics.sampleCount,
      sampleRate: metrics.sampleRate,
    });
  }

  appendDryWetResult(result: DryWetAnalysisResult): void {
    this.append('metric', {
      algorithmVersion: result.algorithmVersion,
      analysisType: 'dry-wet',
      channelMode: result.channelMode.mode,
      channelSwapCandidate: result.channelSwap.candidate,
      correlationMethod: result.correlationMethod,
      frameEndSample: result.frameEndSample,
      frameSampleCount: result.frameSampleCount,
      frameStartSample: result.frameStartSample,
      gainDifferenceDb: result.gainDifferenceDb,
      latencyConfidence: result.latency.confidence,
      latencyMilliseconds: result.latency.milliseconds,
      latencyQuality: result.latency.quality,
      latencySampleOffset: result.latency.sampleOffset,
      peakDifferenceDb: result.peakDifferenceDb,
      sampleRate: result.sampleRate,
      warningCodes: result.warnings.join(','),
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

  async flushPending(): Promise<void> {
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.flushPromise) {
      return this.flushPromise;
    }
    this.flushPromise = (async () => {
      if (this.pendingEvents.length === 0) {
        return;
      }
      const events = this.pendingEvents;
      await appendTestLogEvents(events);
      this.pendingEvents = this.pendingEvents.slice(events.length);
    })();
    try {
      await this.flushPromise;
    } catch (error) {
      this.onError?.(error);
      throw error;
    } finally {
      this.flushPromise = undefined;
    }
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

const MAX_SNAPSHOT_POINTS = 1_000_000;
const MAX_SNAPSHOT_LABEL_LENGTH = 256;
const MAX_SNAPSHOT_NOTES_LENGTH = 10_000;
const MAX_AUDIO_CLIP_BASE64_LENGTH = 20_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, name: string, maximumLength: number): string {
  if (typeof value !== 'string' || value.length > maximumLength) {
    throw new Error(`The snapshot field ${name} is invalid.`);
  }
  return value;
}

function requiredFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`The snapshot field ${name} is invalid.`);
  }
  return value;
}

function requiredSafeInteger(value: unknown, name: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`The snapshot field ${name} is invalid.`);
  }
  return value;
}

function nullableFiniteNumber(value: unknown, name: string): number | null {
  if (value === null) {
    return null;
  }
  return requiredFiniteNumber(value, name);
}

function numericArray(
  value: unknown,
  name: string,
  maximumLength: number,
  minimum?: number,
): number[] {
  if (
    !Array.isArray(value) ||
    value.length > maximumLength ||
    value.some(
      (entry) =>
        typeof entry !== 'number' ||
        !Number.isFinite(entry) ||
        (minimum !== undefined && entry < minimum),
    )
  ) {
    throw new Error(`The snapshot field ${name} is invalid.`);
  }
  return value;
}

function validIsoDate(value: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('The snapshot field createdAt is invalid.');
  }
  return value;
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

export function parseSnapshotRecord(candidate: unknown): SnapshotRecord {
  if (!isRecord(candidate)) {
    throw new Error('The snapshot file contains an invalid record.');
  }
  const schemaVersion = requiredSafeInteger(candidate.schemaVersion, 'schemaVersion', 1);
  if (schemaVersion > SNAPSHOT_SCHEMA_VERSION) {
    throw new Error('The snapshot file uses a newer unsupported schema.');
  }
  const id = requiredString(candidate.id, 'id', 128);
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new Error('The snapshot field id is invalid.');
  }
  const label = requiredString(candidate.label, 'label', MAX_SNAPSHOT_LABEL_LENGTH);
  const createdAt = validIsoDate(requiredString(candidate.createdAt, 'createdAt', 128));
  const sampleRate = requiredFiniteNumber(candidate.sampleRate, 'sampleRate');
  if (sampleRate < 1 || sampleRate > 384_000) {
    throw new Error('The snapshot field sampleRate is outside the supported range.');
  }
  const channelCount = requiredSafeInteger(candidate.channelCount, 'channelCount', 1);
  if (channelCount > 32) {
    throw new Error('The snapshot field channelCount is outside the supported range.');
  }
  const fftSize = requiredSafeInteger(candidate.fftSize, 'fftSize', 32);
  if (!isPowerOfTwo(fftSize) || fftSize > 65_536) {
    throw new Error('The snapshot field fftSize is invalid.');
  }
  const waveform = numericArray(candidate.waveform, 'waveform', MAX_SNAPSHOT_POINTS);
  const spectrum = numericArray(candidate.spectrum, 'spectrum', MAX_SNAPSHOT_POINTS, 0);
  if (schemaVersion === SNAPSHOT_SCHEMA_VERSION) {
    if (candidate.spectrumUnit !== 'power-per-bin' || spectrum.length !== fftSize / 2 + 1) {
      throw new Error('The snapshot file contains an unsupported calibrated spectrum.');
    }
  }
  const notes = requiredString(candidate.notes, 'notes', MAX_SNAPSHOT_NOTES_LENGTH);
  const startSample = requiredSafeInteger(candidate.startSample, 'startSample');
  const endSample = requiredSafeInteger(candidate.endSample, 'endSample');
  if (endSample < startSample) {
    throw new Error('The snapshot sample range is invalid.');
  }
  const algorithmVersion = requiredString(candidate.algorithmVersion, 'algorithmVersion', 64);
  const sessionId = requiredString(candidate.sessionId, 'sessionId', 128);
  const inputDeviceLabel =
    candidate.inputDeviceLabel === undefined
      ? undefined
      : requiredString(candidate.inputDeviceLabel, 'inputDeviceLabel', 512);
  if (candidate.window !== 'hann') {
    throw new Error('The snapshot field window is unsupported.');
  }

  if (!isRecord(candidate.metrics)) {
    throw new Error('The snapshot field metrics is invalid.');
  }
  const metrics = candidate.metrics;
  const clippingCandidate = metrics.clippingCandidate;
  if (typeof clippingCandidate !== 'boolean') {
    throw new Error('The snapshot field metrics.clippingCandidate is invalid.');
  }
  const metricsSampleRate = requiredFiniteNumber(metrics.sampleRate, 'metrics.sampleRate');
  if (metricsSampleRate !== sampleRate) {
    throw new Error('The snapshot sample rates do not match.');
  }
  const metricSampleCount = requiredSafeInteger(metrics.sampleCount, 'metrics.sampleCount', 1);
  const metricConfidence = (value: unknown, name: string): 'high' | 'low' | 'medium' | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (value !== 'high' && value !== 'low' && value !== 'medium') {
      throw new Error(`The snapshot field ${name} is invalid.`);
    }
    return value;
  };

  const comparisonStatus =
    schemaVersion === 1 ? 'legacy-uncomparable' : candidate.comparisonStatus || 'comparable';
  if (comparisonStatus !== 'comparable' && comparisonStatus !== 'legacy-uncomparable') {
    throw new Error('The snapshot field comparisonStatus is invalid.');
  }
  const humFrequencyHz = nullableFiniteNumber(metrics.humFrequencyHz, 'metrics.humFrequencyHz');
  if (humFrequencyHz !== null && humFrequencyHz !== 50 && humFrequencyHz !== 60) {
    throw new Error('The snapshot field metrics.humFrequencyHz is invalid.');
  }

  const audioClipBase64 = candidate.audioClipBase64;
  let audioClip: Blob | undefined;
  if (audioClipBase64 !== undefined) {
    const encoded = requiredString(
      audioClipBase64,
      'audioClipBase64',
      MAX_AUDIO_CLIP_BASE64_LENGTH,
    );
    if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      throw new Error('The snapshot audio clip encoding is invalid.');
    }
    const audioClipType =
      candidate.audioClipType === undefined
        ? 'audio/webm'
        : requiredString(candidate.audioClipType, 'audioClipType', 128);
    try {
      audioClip = base64ToBlob(encoded, audioClipType);
    } catch (error) {
      throw new Error('The snapshot audio clip could not be decoded.', { cause: error });
    }
  }

  return {
    algorithmVersion,
    ...(audioClip ? { audioClip } : {}),
    channelCount,
    comparisonStatus,
    createdAt,
    endSample,
    fftSize,
    id,
    ...(inputDeviceLabel === undefined ? {} : { inputDeviceLabel }),
    label,
    metrics: {
      clippingCandidate,
      crestFactorDb: nullableFiniteNumber(metrics.crestFactorDb, 'metrics.crestFactorDb'),
      dominantFrequencyHz: nullableFiniteNumber(
        metrics.dominantFrequencyHz,
        'metrics.dominantFrequencyHz',
      ),
      humConfidence: metricConfidence(metrics.humConfidence, 'metrics.humConfidence'),
      humFrequencyHz,
      noiseFloorConfidence: metricConfidence(
        metrics.noiseFloorConfidence,
        'metrics.noiseFloorConfidence',
      ),
      noiseFloorDbfs: nullableFiniteNumber(metrics.noiseFloorDbfs, 'metrics.noiseFloorDbfs'),
      peakDbfs: requiredFiniteNumber(metrics.peakDbfs, 'metrics.peakDbfs'),
      rmsDbfs: requiredFiniteNumber(metrics.rmsDbfs, 'metrics.rmsDbfs'),
      sampleCount: metricSampleCount,
      sampleRate: metricsSampleRate,
    },
    notes,
    sampleRate,
    schemaVersion,
    sessionId,
    spectrum,
    ...(schemaVersion === SNAPSHOT_SCHEMA_VERSION ? { spectrumUnit: 'power-per-bin' } : {}),
    startSample,
    waveform,
    window: 'hann',
  };
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error('The snapshot file is not valid JSON.', { cause: error });
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { snapshots?: unknown }).snapshots)
  ) {
    throw new Error('The snapshot file is invalid.');
  }

  const bundle = parsed as { schemaVersion?: unknown; snapshots: unknown[] };
  if (
    typeof bundle.schemaVersion !== 'number' ||
    !Number.isInteger(bundle.schemaVersion) ||
    bundle.schemaVersion < 1 ||
    bundle.schemaVersion > SNAPSHOT_SCHEMA_VERSION ||
    bundle.snapshots.length > 2_048
  ) {
    throw new Error('The snapshot bundle schema is unsupported.');
  }
  const ids = new Set<string>();
  const snapshots = bundle.snapshots.map((candidate) => {
    const snapshot = parseSnapshotRecord(candidate);
    if (ids.has(snapshot.id)) {
      throw new Error('The snapshot file contains duplicate ids.');
    }
    ids.add(snapshot.id);
    return snapshot;
  });
  await saveSnapshotsAtomically(snapshots);
  return snapshots.length;
}
