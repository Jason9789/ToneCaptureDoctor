export const INSTRUMENT_AUDIO_CONSTRAINTS = {
  autoGainControl: false,
  channelCount: { ideal: 2 },
  echoCancellation: false,
  noiseSuppression: false,
} as const satisfies MediaTrackConstraints;

export type AudioInputErrorCode =
  'unsupported' | 'permission-denied' | 'device-unavailable' | 'unknown';

export class AudioInputError extends Error {
  readonly code: AudioInputErrorCode;

  constructor(code: AudioInputErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AudioInputError';
    this.code = code;
  }
}

export interface AudioInputDevice {
  deviceId: string;
  groupId: string;
  kind: MediaDeviceKind;
  label: string;
}

export interface AudioTrackSettingsSnapshot {
  autoGainControl?: boolean;
  channelCount?: number;
  deviceId?: string;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  sampleRate?: number;
}

export interface AudioInputSession {
  devices: AudioInputDevice[];
  selectedDeviceId?: string;
  settings: AudioTrackSettingsSnapshot;
  stream: MediaStream;
  warnings: string[];
}

function hasAudioInputSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof navigator.mediaDevices.enumerateDevices === 'function'
  );
}

function errorName(error: unknown): string | undefined {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name;
  }
  return error instanceof Error ? error.name : undefined;
}

export function normalizeAudioInputError(error: unknown): AudioInputError {
  if (error instanceof AudioInputError) {
    return error;
  }

  switch (errorName(error)) {
    case 'NotAllowedError':
      return new AudioInputError(
        'permission-denied',
        'Microphone permission was denied. Allow access in the browser and try again.',
        { cause: error },
      );
    case 'SecurityError':
    case 'InvalidStateError':
    case 'TypeError':
      return new AudioInputError(
        'unsupported',
        'The browser blocked local audio input. Use HTTPS or localhost and check site permissions.',
        { cause: error },
      );
    case 'AbortError':
    case 'NotFoundError':
    case 'NotReadableError':
    case 'OverconstrainedError':
      return new AudioInputError(
        'device-unavailable',
        'The selected audio input is unavailable. Check the connection and try again.',
        { cause: error },
      );
    default:
      return new AudioInputError(
        'unknown',
        'The audio input could not be opened. Check the browser and device settings.',
        { cause: error },
      );
  }
}

export function stopAudioStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  if (!hasAudioInputSupport()) {
    throw new AudioInputError(
      'unsupported',
      'This browser does not support local audio input. Use a recent Chrome, Edge, or Safari.',
    );
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  let inputIndex = 0;

  return devices
    .filter((device) => device.kind === 'audioinput')
    .map((device) => {
      inputIndex += 1;
      return {
        deviceId: device.deviceId,
        groupId: device.groupId,
        kind: device.kind,
        label: device.label || `Audio input ${inputIndex}`,
      };
    });
}

function snapshotTrackSettings(track: MediaStreamTrack): AudioTrackSettingsSnapshot {
  const settings = track.getSettings();

  return {
    autoGainControl: settings.autoGainControl,
    channelCount: settings.channelCount,
    deviceId: settings.deviceId,
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    sampleRate: settings.sampleRate,
  };
}

function getConstraintWarnings(settings: AudioTrackSettingsSnapshot): string[] {
  const warnings: string[] = [];

  if (settings.autoGainControl === undefined) {
    warnings.push('The browser did not report whether automatic gain control is disabled.');
  }
  if (settings.echoCancellation === undefined) {
    warnings.push('The browser did not report whether echo cancellation is disabled.');
  }
  if (settings.noiseSuppression === undefined) {
    warnings.push('The browser did not report whether noise suppression is disabled.');
  }
  if (settings.channelCount !== undefined && settings.channelCount > 2) {
    warnings.push('The browser reported more than two input channels.');
  }

  if (settings.autoGainControl === true) {
    warnings.push('Automatic gain control is enabled by the browser.');
  }
  if (settings.echoCancellation === true) {
    warnings.push('Echo cancellation is enabled by the browser.');
  }
  if (settings.noiseSuppression === true) {
    warnings.push('Noise suppression is enabled by the browser.');
  }

  return warnings;
}

export async function requestAudioInput(deviceId?: string): Promise<AudioInputSession> {
  if (!hasAudioInputSupport()) {
    throw new AudioInputError(
      'unsupported',
      'This browser does not support local audio input. Use a recent Chrome, Edge, or Safari.',
    );
  }

  const audioConstraints: MediaTrackConstraints = {
    ...INSTRUMENT_AUDIO_CONSTRAINTS,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
  } catch (error) {
    throw normalizeAudioInputError(error);
  }

  const track = stream.getAudioTracks()[0];
  if (!track) {
    stopAudioStream(stream);
    throw new AudioInputError(
      'device-unavailable',
      'The browser opened a stream without an audio track. Check the selected input.',
    );
  }

  try {
    const settings = snapshotTrackSettings(track);
    const devices = await listAudioInputDevices();

    return {
      devices,
      selectedDeviceId: settings.deviceId || deviceId,
      settings,
      stream,
      warnings: getConstraintWarnings(settings),
    };
  } catch (error) {
    stopAudioStream(stream);
    throw normalizeAudioInputError(error);
  }
}
