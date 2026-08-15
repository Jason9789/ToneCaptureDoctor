import { describe, expect, it } from 'vitest';

import {
  AudioInputError,
  INSTRUMENT_AUDIO_CONSTRAINTS,
  normalizeAudioInputError,
} from './audioInput';

describe('audio input constraints and errors', () => {
  it('keeps instrument input processing disabled by default', () => {
    expect(INSTRUMENT_AUDIO_CONSTRAINTS).toEqual({
      autoGainControl: false,
      channelCount: { ideal: 2 },
      echoCancellation: false,
      noiseSuppression: false,
    });
  });

  it('normalizes permission errors without exposing browser internals', () => {
    const error = normalizeAudioInputError(new DOMException('denied', 'NotAllowedError'));

    expect(error).toBeInstanceOf(AudioInputError);
    expect(error.code).toBe('permission-denied');
    expect(error.message).toMatch(/permission/i);
  });

  it('normalizes missing or unreadable devices', () => {
    expect(normalizeAudioInputError(new DOMException('missing', 'NotFoundError')).code).toBe(
      'device-unavailable',
    );
    expect(normalizeAudioInputError(new DOMException('busy', 'NotReadableError')).code).toBe(
      'device-unavailable',
    );
  });

  it('treats browser security and lifecycle errors as unsupported input', () => {
    expect(normalizeAudioInputError(new DOMException('blocked', 'SecurityError')).code).toBe(
      'unsupported',
    );
    expect(normalizeAudioInputError(new DOMException('invalid', 'InvalidStateError')).code).toBe(
      'unsupported',
    );
  });
});
