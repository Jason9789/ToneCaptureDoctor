import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

function createStream(deviceId: string, overrides: MediaTrackSettings = {}) {
  const track = {
    addEventListener: vi.fn(),
    getSettings: vi.fn(() => ({
      autoGainControl: false,
      channelCount: 2,
      deviceId,
      echoCancellation: false,
      noiseSuppression: false,
      sampleRate: 48_000,
      ...overrides,
    })),
    removeEventListener: vi.fn(),
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;

  return { stream, track };
}

function createMediaDevices() {
  const getUserMedia = vi.fn();
  const enumerateDevices = vi.fn().mockResolvedValue([
    {
      deviceId: 'interface-1',
      groupId: 'group-1',
      kind: 'audioinput',
      label: 'USB Interface',
    },
    {
      deviceId: 'built-in',
      groupId: 'group-2',
      kind: 'audioinput',
      label: 'Built-in Microphone',
    },
  ]);

  return {
    addEventListener: vi.fn(),
    enumerateDevices,
    getUserMedia,
    removeEventListener: vi.fn(),
  };
}

describe('Signal Health input flow', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: createMediaDevices(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('requests local input only after Start and shows actual track settings', async () => {
    const mediaDevices = navigator.mediaDevices as unknown as ReturnType<typeof createMediaDevices>;
    const { stream } = createStream('interface-1');
    mediaDevices.getUserMedia.mockResolvedValue(stream);

    render(<App />);

    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start Signal Health' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Connected');
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        autoGainControl: false,
        channelCount: { ideal: 2 },
        echoCancellation: false,
        noiseSuppression: false,
      }),
    });
    expect(screen.getByRole('combobox', { name: 'Choose an audio input' })).toHaveValue(
      'interface-1',
    );
    expect(screen.getByText('48,000 Hz')).toBeInTheDocument();
    expect(screen.getAllByText('Off')).toHaveLength(3);
  });

  it('explains a permission denial and keeps retry available', async () => {
    const mediaDevices = navigator.mediaDevices as unknown as ReturnType<typeof createMediaDevices>;
    mediaDevices.getUserMedia.mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError'),
    );

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Signal Health' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/permission/i);
    expect(screen.getByRole('button', { name: 'Start Signal Health' })).toBeEnabled();
  });

  it('stops the stream and closes the input', async () => {
    const mediaDevices = navigator.mediaDevices as unknown as ReturnType<typeof createMediaDevices>;
    const { stream, track } = createStream('interface-1');
    mediaDevices.getUserMedia.mockResolvedValue(stream);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Signal Health' }));
    await screen.findByRole('button', { name: 'Stop Signal Health' });

    fireEvent.click(screen.getByRole('button', { name: 'Stop Signal Health' }));

    await waitFor(() => expect(track.stop).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent('Stopped');
    expect(screen.getByRole('button', { name: 'Start Signal Health' })).toBeEnabled();
  });

  it('opens a newly selected input before stopping the previous stream', async () => {
    const mediaDevices = navigator.mediaDevices as unknown as ReturnType<typeof createMediaDevices>;
    const first = createStream('interface-1');
    const second = createStream('built-in');
    mediaDevices.getUserMedia
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Signal Health' }));
    await screen.findByRole('combobox', { name: 'Choose an audio input' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Choose an audio input' }), {
      target: { value: 'built-in' },
    });

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Choose an audio input' })).toHaveValue(
        'built-in',
      ),
    );
    expect(first.track.stop).toHaveBeenCalledTimes(1);
    expect(mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
      audio: expect.objectContaining({ deviceId: { exact: 'built-in' } }),
    });
  });

  it('stops a late stream when the component unmounts during a pending request', async () => {
    const mediaDevices = navigator.mediaDevices as unknown as ReturnType<typeof createMediaDevices>;
    let resolveUserMedia!: (stream: MediaStream) => void;
    mediaDevices.getUserMedia.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        resolveUserMedia = resolve;
      }),
    );

    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Signal Health' }));
    view.unmount();

    const { stream, track } = createStream('interface-1');
    resolveUserMedia(stream);

    await waitFor(() => expect(track.stop).toHaveBeenCalledTimes(1));
  });
});
