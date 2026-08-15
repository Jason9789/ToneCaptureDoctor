const RECENT_AUDIO_WINDOW_MS = 10_000;

interface RecordedChunk {
  blob: Blob;
  recordedAt: number;
}

export interface AudioClipCapture {
  getRecentClip(): Promise<Blob | null>;
  stop(): Promise<void>;
}

function chooseMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType),
  );
}

/**
 * Keeps only a short, local rolling clip. Raw audio is never sent to the API.
 * The clip is only copied into a user-created snapshot when they choose Save.
 */
export function startAudioClipCapture(stream: MediaStream): AudioClipCapture | null {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  let recorder: MediaRecorder;
  try {
    const mimeType = chooseMimeType();
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    return null;
  }

  const chunks: RecordedChunk[] = [];
  let stopPromise: Promise<void> | undefined;

  const prune = (now: number) => {
    const cutoff = now - RECENT_AUDIO_WINDOW_MS;
    while (chunks.length > 0 && chunks[0].recordedAt < cutoff) {
      chunks.shift();
    }
  };

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size === 0) {
      return;
    }
    const now = Date.now();
    chunks.push({ blob: event.data, recordedAt: now });
    prune(now);
  });

  try {
    recorder.start(1_000);
  } catch {
    return null;
  }

  return {
    getRecentClip: async () => {
      prune(Date.now());
      if (chunks.length === 0) {
        return null;
      }
      return new Blob(
        chunks.map(({ blob }) => blob),
        { type: chunks[0]?.blob.type || recorder.mimeType || 'audio/webm' },
      );
    },
    stop: () => {
      if (stopPromise) {
        return stopPromise;
      }
      stopPromise = new Promise((resolve) => {
        if (recorder.state === 'inactive') {
          resolve();
          return;
        }
        recorder.addEventListener('stop', () => resolve(), { once: true });
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
      return stopPromise;
    },
  };
}
