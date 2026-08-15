import {
  exportAllTestLogs,
  listSnapshots,
  parseSnapshotRecord,
  saveSnapshotsAndLogsAtomically,
  type TestLogExport,
  type TestLogEvent,
  type SnapshotRecord,
} from './sessionStore';

export const TONECHECK_SCHEMA_VERSION = 1;
export const MAX_TONECHECK_BYTES = 50_000_000;

export interface TonecheckSnapshot extends Omit<SnapshotRecord, 'audioClip'> {
  audioClipType?: string;
  audioPath?: string;
}

export interface TonecheckFileEntry {
  byteLength: number;
  checksum: string;
  checksumAlgorithm: 'crc32' | 'sha-256';
  path: string;
}

export interface TonecheckManifest {
  algorithmVersions: string[];
  appVersion: string;
  archiveType: 'tonecheck';
  createdAt: string;
  files: TonecheckFileEntry[];
  schemaVersion: number;
  snapshotCount: number;
}

export interface TonecheckExport {
  blob: Blob;
  manifest: TonecheckManifest;
}

interface ZipEntry {
  data: Uint8Array;
  path: string;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function readU16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function writeU16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = (CRC32_TABLE[(value ^ byte) & 0xff] ?? 0) ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function crc32Hex(bytes: Uint8Array): string {
  return crc32(bytes).toString(16).padStart(8, '0');
}

async function checksum(
  bytes: Uint8Array,
): Promise<Pick<TonecheckFileEntry, 'checksum' | 'checksumAlgorithm'>> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytesToArrayBuffer(bytes));
    return {
      checksum: Array.from(new Uint8Array(digest), (value) =>
        value.toString(16).padStart(2, '0'),
      ).join(''),
      checksumAlgorithm: 'sha-256',
    };
  }
  return { checksum: crc32Hex(bytes), checksumAlgorithm: 'crc32' };
}

async function checksumForAlgorithm(
  bytes: Uint8Array,
  algorithm: TonecheckFileEntry['checksumAlgorithm'],
): Promise<string> {
  if (algorithm === 'crc32') {
    return crc32Hex(bytes);
  }
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('The .tonecheck archive requires Web Crypto for SHA-256 validation.');
  }
  const digest = await crypto.subtle.digest('SHA-256', bytesToArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = textEncoder.encode(entry.path);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const localView = new DataView(local.buffer);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, 0);
    writeU16(localView, 12, 0);
    writeU32(localView, 14, crc32(entry.data));
    writeU32(localView, 18, entry.data.length);
    writeU32(localView, 22, entry.data.length);
    writeU16(localView, 26, name.length);
    writeU16(localView, 28, 0);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, 0);
    writeU16(centralView, 14, 0);
    writeU32(centralView, 16, crc32(entry.data));
    writeU32(centralView, 20, entry.data.length);
    writeU32(centralView, 24, entry.data.length);
    writeU16(centralView, 28, name.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const localData = concatBytes(localParts);
  const centralData = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, entries.length);
  writeU16(endView, 10, entries.length);
  writeU32(endView, 12, centralData.length);
  writeU32(endView, 16, localData.length);
  writeU16(endView, 20, 0);
  return concatBytes([localData, centralData, end]);
}

function isSafePath(path: string): boolean {
  return path.length > 0 && !path.startsWith('/') && !path.includes('..') && !path.includes('\\');
}

function parseZip(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length > MAX_TONECHECK_BYTES) {
    throw new Error('The .tonecheck archive is too large.');
  }
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (readU32(bytes, offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) {
    throw new Error('The .tonecheck archive has no valid central directory.');
  }
  const entryCount = readU16(bytes, endOffset + 10);
  const centralSize = readU32(bytes, endOffset + 12);
  const centralOffset = readU32(bytes, endOffset + 16);
  const centralEnd = centralOffset + centralSize;
  if (
    entryCount > 2_048 ||
    centralOffset > endOffset ||
    centralEnd > endOffset ||
    centralEnd > bytes.length
  ) {
    throw new Error('The .tonecheck archive directory is invalid.');
  }

  const files = new Map<string, Uint8Array>();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > centralEnd || readU32(bytes, offset) !== 0x02014b50) {
      throw new Error('The .tonecheck archive contains an invalid file entry.');
    }
    const compression = readU16(bytes, offset + 10);
    const entryCrc = readU32(bytes, offset + 16);
    const compressedSize = readU32(bytes, offset + 20);
    const uncompressedSize = readU32(bytes, offset + 24);
    const nameLength = readU16(bytes, offset + 28);
    const extraLength = readU16(bytes, offset + 30);
    const commentLength = readU16(bytes, offset + 32);
    const localOffset = readU32(bytes, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > centralEnd) {
      throw new Error('The .tonecheck archive file name is out of bounds.');
    }
    const path = textDecoder.decode(bytes.slice(nameStart, nameEnd));
    if (!isSafePath(path) || compression !== 0 || files.has(path)) {
      throw new Error('The .tonecheck archive contains an unsupported or unsafe file.');
    }
    if (
      localOffset >= centralOffset ||
      localOffset + 30 > bytes.length ||
      readU32(bytes, localOffset) !== 0x04034b50
    ) {
      throw new Error('The .tonecheck archive local entry is invalid.');
    }
    const localNameLength = readU16(bytes, localOffset + 26);
    const localExtraLength = readU16(bytes, localOffset + 28);
    const localName = textDecoder.decode(
      bytes.slice(localOffset + 30, localOffset + 30 + localNameLength),
    );
    if (localName !== path) {
      throw new Error('The .tonecheck archive has invalid local and central file names.');
    }
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (
      dataStart < localOffset + 30 ||
      dataEnd > centralOffset ||
      dataEnd > bytes.length ||
      compressedSize !== uncompressedSize ||
      crc32(bytes.slice(dataStart, dataEnd)) !== entryCrc
    ) {
      throw new Error('The .tonecheck archive contains a corrupt file.');
    }
    files.set(path, bytes.slice(dataStart, dataEnd));
    offset = nameEnd + extraLength + commentLength;
  }
  return files;
}

function jsonBytes(value: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(value));
}

function parseJson<T>(bytes: Uint8Array, label: string): T {
  try {
    return JSON.parse(textDecoder.decode(bytes)) as T;
  } catch (error) {
    throw new Error(`The .tonecheck ${label} file is invalid.`, { cause: error });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is boolean | number | string | null | undefined {
  return (
    value === null || value === undefined || ['boolean', 'number', 'string'].includes(typeof value)
  );
}

function parseReportLogs(report: unknown): TestLogExport[] {
  if (!isRecord(report) || report.schemaVersion !== TONECHECK_SCHEMA_VERSION) {
    throw new Error('The .tonecheck analysis report is unsupported.');
  }
  if (report.testLogs === undefined) {
    return [];
  }
  if (!Array.isArray(report.testLogs) || report.testLogs.length > 2_048) {
    throw new Error('The .tonecheck analysis report contains invalid logs.');
  }
  return report.testLogs.map((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.session) || !Array.isArray(candidate.events)) {
      throw new Error('The .tonecheck analysis report contains an invalid log.');
    }
    const session = candidate.session;
    if (
      typeof session.appVersion !== 'string' ||
      typeof session.locale !== 'string' ||
      typeof session.sessionId !== 'string' ||
      typeof session.startedAt !== 'string' ||
      !Number.isFinite(Date.parse(session.startedAt)) ||
      !isRecord(session.trackSettings)
    ) {
      throw new Error('The .tonecheck analysis report contains an invalid session.');
    }
    const trackSettings = Object.fromEntries(
      Object.entries(session.trackSettings).map(([key, value]) => {
        if (value === null || !isPrimitive(value)) {
          throw new Error('The .tonecheck analysis report contains invalid track settings.');
        }
        return [key, value];
      }),
    );
    if (candidate.events.length > 100_000) {
      throw new Error('The .tonecheck analysis report contains too many events.');
    }
    const events = candidate.events.map((event) => {
      if (!isRecord(event) || !isRecord(event.payload)) {
        throw new Error('The .tonecheck analysis report contains an invalid event.');
      }
      if (
        typeof event.eventId !== 'string' ||
        (event.eventType !== 'metric' &&
          event.eventType !== 'session-ended' &&
          event.eventType !== 'session-started' &&
          event.eventType !== 'status') ||
        !Number.isSafeInteger(event.sequence) ||
        typeof event.sessionId !== 'string' ||
        event.sessionId !== session.sessionId ||
        typeof event.timestamp !== 'string' ||
        !Number.isFinite(Date.parse(event.timestamp))
      ) {
        throw new Error('The .tonecheck analysis report contains an invalid event.');
      }
      const eventType = event.eventType as TestLogEvent['eventType'];
      const sequence = event.sequence as number;
      const payload = Object.fromEntries(
        Object.entries(event.payload).map(([key, value]) => {
          if (!isPrimitive(value)) {
            throw new Error('The .tonecheck analysis report contains an invalid payload.');
          }
          return [key, value];
        }),
      );
      return {
        eventId: event.eventId,
        eventType,
        payload,
        sequence,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
      };
    });
    return {
      events,
      exportedAt:
        typeof candidate.exportedAt === 'string' &&
        Number.isFinite(Date.parse(candidate.exportedAt))
          ? candidate.exportedAt
          : new Date().toISOString(),
      schemaVersion: TONECHECK_SCHEMA_VERSION,
      session: {
        appVersion: session.appVersion,
        ...(typeof session.endedAt === 'string' ? { endedAt: session.endedAt } : {}),
        locale: session.locale,
        sessionId: session.sessionId,
        startedAt: session.startedAt,
        trackSettings,
      },
    };
  });
}

export function migrateTonecheckSnapshot(snapshot: TonecheckSnapshot): SnapshotRecord {
  if (snapshot.schemaVersion === 1) {
    const legacySnapshot = { ...snapshot } as Partial<SnapshotRecord>;
    delete legacySnapshot.spectrumUnit;
    return legacySnapshot as SnapshotRecord;
  }
  if (snapshot.spectrumUnit !== 'power-per-bin') {
    throw new Error('The .tonecheck snapshot has no calibrated spectrum unit.');
  }
  return snapshot;
}

export async function exportTonecheck(appVersion = '0.0.0'): Promise<TonecheckExport> {
  const snapshots = await listSnapshots();
  const testLogs = await exportAllTestLogs();
  const archiveEntries: ZipEntry[] = [];
  const serializedSnapshots: TonecheckSnapshot[] = [];
  const algorithmVersions = new Set<string>();

  for (const snapshot of snapshots) {
    algorithmVersions.add(snapshot.algorithmVersion);
    const serialized: TonecheckSnapshot = { ...snapshot };
    delete (serialized as Partial<SnapshotRecord>).audioClip;
    if (snapshot.audioClip) {
      serialized.audioPath = `audio/${encodeURIComponent(snapshot.id)}.bin`;
      serialized.audioClipType = snapshot.audioClip.type;
      archiveEntries.push({
        data: new Uint8Array(await snapshot.audioClip.arrayBuffer()),
        path: serialized.audioPath,
      });
    }
    serializedSnapshots.push(serialized);
  }

  const snapshotsData = jsonBytes({
    schemaVersion: TONECHECK_SCHEMA_VERSION,
    snapshots: serializedSnapshots,
  });
  const reportData = jsonBytes({
    generatedAt: new Date().toISOString(),
    schemaVersion: TONECHECK_SCHEMA_VERSION,
    snapshots: snapshots.map((snapshot) => ({
      algorithmVersion: snapshot.algorithmVersion,
      id: snapshot.id,
      metrics: snapshot.metrics,
      sampleRate: snapshot.sampleRate,
    })),
    testLogs,
  });
  archiveEntries.push({ data: snapshotsData, path: 'snapshots.json' });
  archiveEntries.push({ data: reportData, path: 'reports/analysis.json' });

  const fileEntries: TonecheckFileEntry[] = [];
  for (const entry of archiveEntries) {
    const fileChecksum = await checksum(entry.data);
    fileEntries.push({
      byteLength: entry.data.length,
      checksum: fileChecksum.checksum,
      checksumAlgorithm: fileChecksum.checksumAlgorithm,
      path: entry.path,
    });
  }
  const manifest: TonecheckManifest = {
    algorithmVersions: [...algorithmVersions].sort(),
    appVersion,
    archiveType: 'tonecheck',
    createdAt: new Date().toISOString(),
    files: fileEntries.sort((left, right) => left.path.localeCompare(right.path)),
    schemaVersion: TONECHECK_SCHEMA_VERSION,
    snapshotCount: snapshots.length,
  };
  archiveEntries.push({ data: jsonBytes(manifest), path: 'manifest.json' });
  return {
    blob: new Blob([bytesToArrayBuffer(createZip(archiveEntries))], { type: 'application/zip' }),
    manifest,
  };
}

export async function importTonecheck(archive: Blob): Promise<number> {
  if (archive.size > MAX_TONECHECK_BYTES) {
    throw new Error('The .tonecheck archive is too large.');
  }
  const files = parseZip(new Uint8Array(await archive.arrayBuffer()));
  const manifest = parseJson<TonecheckManifest>(
    files.get('manifest.json') ?? new Uint8Array(),
    'manifest',
  );
  if (
    manifest.archiveType !== 'tonecheck' ||
    manifest.schemaVersion !== TONECHECK_SCHEMA_VERSION ||
    typeof manifest.appVersion !== 'string' ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    !Array.isArray(manifest.algorithmVersions) ||
    manifest.algorithmVersions.some((version) => typeof version !== 'string') ||
    !Array.isArray(manifest.files) ||
    manifest.files.length > 2_048 ||
    !Number.isInteger(manifest.snapshotCount) ||
    manifest.snapshotCount < 0 ||
    manifest.snapshotCount > 2_048
  ) {
    throw new Error('The .tonecheck manifest is unsupported.');
  }
  const declaredPaths = new Set<string>();
  for (const file of manifest.files) {
    if (
      !file ||
      typeof file !== 'object' ||
      !isSafePath(file.path) ||
      file.path === 'manifest.json' ||
      declaredPaths.has(file.path) ||
      !Number.isSafeInteger(file.byteLength) ||
      file.byteLength < 0 ||
      file.byteLength > MAX_TONECHECK_BYTES ||
      (file.checksumAlgorithm !== 'crc32' && file.checksumAlgorithm !== 'sha-256') ||
      !/^[a-f0-9]+$/.test(file.checksum)
    ) {
      throw new Error('The .tonecheck manifest contains an invalid file entry.');
    }
    declaredPaths.add(file.path);
    const data = files.get(file.path);
    if (!data || data.length !== file.byteLength) {
      throw new Error('The .tonecheck manifest does not match its files.');
    }
    const actual = await checksumForAlgorithm(data, file.checksumAlgorithm);
    if (actual !== file.checksum) {
      throw new Error('The .tonecheck checksum validation failed.');
    }
  }
  for (const path of files.keys()) {
    if (path !== 'manifest.json' && !declaredPaths.has(path)) {
      throw new Error('The .tonecheck archive contains an undeclared file.');
    }
  }
  if (!declaredPaths.has('snapshots.json') || !declaredPaths.has('reports/analysis.json')) {
    throw new Error('The .tonecheck archive is missing its required report files.');
  }

  const bundle = parseJson<{ schemaVersion: number; snapshots: Array<Partial<TonecheckSnapshot>> }>(
    files.get('snapshots.json') ?? new Uint8Array(),
    'snapshots',
  );
  if (bundle.schemaVersion !== TONECHECK_SCHEMA_VERSION || !Array.isArray(bundle.snapshots)) {
    throw new Error('The .tonecheck snapshot bundle is unsupported.');
  }
  if (bundle.snapshots.length !== manifest.snapshotCount) {
    throw new Error('The .tonecheck snapshot count does not match its manifest.');
  }
  const report = parseJson<unknown>(
    files.get('reports/analysis.json') ?? new Uint8Array(),
    'analysis',
  );
  const importedLogs = parseReportLogs(report);

  const migrated: SnapshotRecord[] = [];
  const ids = new Set<string>();
  for (const candidate of bundle.snapshots) {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('The .tonecheck snapshot metadata is invalid.');
    }
    const candidateRecord = candidate as Record<string, unknown>;
    const id = candidateRecord.id;
    if (typeof id !== 'string' || ids.has(id)) {
      throw new Error('The .tonecheck archive contains duplicate snapshot ids.');
    }
    ids.add(id);
    const { audioPath, audioClipType, ...metadata } = candidateRecord;
    const parsedMetadata = parseSnapshotRecord(metadata);
    let audioClip: Blob | undefined;
    if (audioPath) {
      if (
        typeof audioPath !== 'string' ||
        audioPath !== `audio/${encodeURIComponent(id)}.bin` ||
        !isSafePath(audioPath)
      ) {
        throw new Error('The .tonecheck audio path is invalid.');
      }
      const audioData = files.get(audioPath);
      if (!audioData) {
        throw new Error('The .tonecheck audio asset is missing.');
      }
      audioClip = new Blob([bytesToArrayBuffer(audioData)], {
        type:
          typeof audioClipType === 'string' && audioClipType.length <= 128
            ? audioClipType
            : 'application/octet-stream',
      });
    }
    const migratedMetadata = migrateTonecheckSnapshot(
      parsedMetadata as unknown as TonecheckSnapshot,
    );
    migrated.push(audioClip ? { ...migratedMetadata, audioClip } : migratedMetadata);
  }
  await saveSnapshotsAndLogsAtomically(migrated, importedLogs);
  return migrated.length;
}
