const RECENT_AUDIO_WINDOW_MS = 10_000;
const DEFAULT_PROCESSOR_BUFFER_SIZE = 4_096;
const MAX_CHANNELS = 2;

interface PcmSnapshot {
  channels: Float32Array[];
  sampleRate: number;
}

export interface AudioClipCapture {
  getRecentClip(): Promise<Blob | null>;
  stop(): Promise<void>;
}

export interface AudioClipCaptureOptions {
  sampleRate?: number;
}

class PcmRingBuffer {
  private buffers: Float32Array[] | null = null;
  private sampleCount = 0;
  private writeIndex = 0;

  constructor(private readonly capacity: number) {}

  append(inputChannels: Float32Array[]): void {
    const frameCount = inputChannels[0]?.length ?? 0;
    if (frameCount === 0) {
      return;
    }

    const channelCount = Math.max(1, Math.min(MAX_CHANNELS, inputChannels.length));
    if (!this.buffers) {
      this.buffers = Array.from({ length: channelCount }, () => new Float32Array(this.capacity));
    }

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      for (let channelIndex = 0; channelIndex < this.buffers.length; channelIndex += 1) {
        const source = inputChannels[channelIndex] ?? inputChannels[0];
        this.buffers[channelIndex]![this.writeIndex] = source?.[frameIndex] ?? 0;
      }
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
      this.sampleCount = Math.min(this.sampleCount + 1, this.capacity);
    }
  }

  snapshot(sampleRate: number): PcmSnapshot | null {
    if (!this.buffers || this.sampleCount === 0) {
      return null;
    }

    const startIndex = this.sampleCount === this.capacity ? this.writeIndex : 0;
    const channels = this.buffers.map((buffer) => {
      const ordered = new Float32Array(this.sampleCount);
      for (let index = 0; index < this.sampleCount; index += 1) {
        ordered[index] = buffer[(startIndex + index) % this.capacity] ?? 0;
      }
      return ordered;
    });

    return { channels, sampleRate };
  }
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function clampPcmSample(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

/** Encode interleaved 16-bit PCM WAV data with an explicit duration-bearing header. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const channelCount = Math.max(1, Math.min(MAX_CHANNELS, channels.length));
  const sampleCount = channels[0]?.length ?? 0;
  const normalizedSampleRate = Math.max(1, Math.round(sampleRate));
  const bytesPerSample = 2;
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, normalizedSampleRate, true);
  view.setUint32(28, normalizedSampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = clampPcmSample(channels[channelIndex]?.[sampleIndex] ?? 0);
      const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, Math.round(pcm), true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function closeAudioGraph(
  context: AudioContext,
  source: MediaStreamAudioSourceNode,
  processor: ScriptProcessorNode,
  muteGain: GainNode,
): void {
  processor.onaudioprocess = null;
  source.disconnect();
  processor.disconnect();
  muteGain.disconnect();
  void context.close().catch(() => undefined);
}

/**
 * Keeps a short, local PCM rolling clip. Raw audio is never sent to the API.
 * The clip is encoded as WAV only when the user creates a snapshot.
 */
export function startAudioClipCapture(
  stream: MediaStream,
  options: AudioClipCaptureOptions = {},
): AudioClipCapture | null {
  if (typeof AudioContext === 'undefined') {
    return null;
  }

  const trackSettings = stream.getAudioTracks()[0]?.getSettings();
  const requestedSampleRate = options.sampleRate ?? trackSettings?.sampleRate;
  const channelHint = Math.max(
    1,
    Math.min(MAX_CHANNELS, Math.round(trackSettings?.channelCount ?? 1)),
  );

  let context: AudioContext;
  let source: MediaStreamAudioSourceNode;
  let processor: ScriptProcessorNode;
  let muteGain: GainNode;
  try {
    context = new AudioContext(
      requestedSampleRate && requestedSampleRate > 0
        ? { sampleRate: requestedSampleRate }
        : undefined,
    );
    source = context.createMediaStreamSource(stream);
    processor = context.createScriptProcessor(
      DEFAULT_PROCESSOR_BUFFER_SIZE,
      channelHint,
      channelHint,
    );
    muteGain = context.createGain();
    muteGain.gain.value = 0;
  } catch {
    return null;
  }

  const capacity = Math.max(1, Math.ceil((context.sampleRate * RECENT_AUDIO_WINDOW_MS) / 1_000));
  const ringBuffer = new PcmRingBuffer(capacity);
  processor.onaudioprocess = (event) => {
    const inputChannels = Array.from(
      { length: Math.min(MAX_CHANNELS, event.inputBuffer.numberOfChannels) },
      (_, channelIndex) => event.inputBuffer.getChannelData(channelIndex),
    );
    ringBuffer.append(inputChannels);
  };

  try {
    source.connect(processor);
    processor.connect(muteGain);
    muteGain.connect(context.destination);
    void context.resume().catch(() => undefined);
  } catch {
    closeAudioGraph(context, source, processor, muteGain);
    return null;
  }

  let stopPromise: Promise<void> | undefined;
  return {
    getRecentClip: async () => {
      const snapshot = ringBuffer.snapshot(context.sampleRate);
      return snapshot ? encodeWav(snapshot.channels, snapshot.sampleRate) : null;
    },
    stop: () => {
      if (!stopPromise) {
        stopPromise = Promise.resolve().then(() => {
          closeAudioGraph(context, source, processor, muteGain);
        });
      }
      return stopPromise;
    },
  };
}
