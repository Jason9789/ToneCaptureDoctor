import { describe, expect, it } from 'vitest';

import { encodeWav } from './audioClip';

describe('audio clip encoding', () => {
  it('writes a duration-bearing PCM WAV header for mono audio', async () => {
    const sampleRate = 48_000;
    const samples = new Float32Array(sampleRate / 10).fill(0.25);
    const blob = encodeWav([samples], sampleRate);
    const bytes = new DataView(await blob.arrayBuffer());

    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + samples.length * 2);
    expect(new TextDecoder().decode(new Uint8Array(bytes.buffer, 0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(new Uint8Array(bytes.buffer, 8, 4))).toBe('WAVE');
    expect(bytes.getUint16(22, true)).toBe(1);
    expect(bytes.getUint32(24, true)).toBe(sampleRate);
    expect(bytes.getUint32(40, true)).toBe(samples.length * 2);
    expect(bytes.getInt16(44, true)).toBe(Math.round(0.25 * 0x7fff));
  });

  it('interleaves stereo samples and preserves the expected duration', async () => {
    const sampleRate = 44_100;
    const left = new Float32Array([1, -1, 0]);
    const right = new Float32Array([0, 0.5, -0.5]);
    const blob = encodeWav([left, right], sampleRate);
    const bytes = new DataView(await blob.arrayBuffer());

    expect(blob.size).toBe(44 + left.length * 2 * 2);
    expect(bytes.getUint16(22, true)).toBe(2);
    expect(bytes.getUint16(32, true)).toBe(4);
    expect(bytes.getInt16(44, true)).toBe(0x7fff);
    expect(bytes.getInt16(46, true)).toBe(0);
    expect(bytes.getInt16(48, true)).toBe(-0x8000);
    expect(bytes.getInt16(50, true)).toBe(Math.round(0.5 * 0x7fff));
  });
});
