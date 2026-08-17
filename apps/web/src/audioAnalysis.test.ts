import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AudioAnalysisError,
  describeAudioAnalysisError,
  setAudioMonitorEnabled,
  startAudioAnalysis,
  stopAudioAnalysis,
} from './audioAnalysis';

class FakeAudioNode {
  readonly connect = vi.fn((node: FakeAudioNode) => node);
  readonly disconnect = vi.fn();
}

class FakeAnalyserNode extends FakeAudioNode {
  fftSize = 2_048;
  smoothingTimeConstant = 0;

  readonly getFloatTimeDomainData = vi.fn((target: Float32Array) => {
    target.fill(0);
    target[0] = 0.25;
  });
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = {
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    value: 1,
  };
}

class FakeChannelSplitterNode extends FakeAudioNode {
  constructor(readonly numberOfOutputs: number) {
    super();
  }
}

let workletApi: { addModule: ReturnType<typeof vi.fn> };
let failMediaSource = false;

class FakeAudioContext {
  readonly destination = new FakeAudioNode();
  readonly currentTime = 0;
  readonly sampleRate = 48_000;
  readonly state = 'running';
  readonly audioWorklet = workletApi;
  readonly close = vi.fn(async () => undefined);
  readonly resume = vi.fn(async () => undefined);
  readonly createAnalyser = vi.fn(() => new FakeAnalyserNode());
  readonly createChannelSplitter = vi.fn(
    (channelCount: number) => new FakeChannelSplitterNode(channelCount),
  );
  readonly createGain = vi.fn(() => new FakeGainNode());
  readonly createMediaStreamSource = vi.fn(() => {
    if (failMediaSource) {
      throw new Error('media source creation blocked');
    }
    return new FakeAudioNode();
  });
}

function createStream(channelCount?: number): MediaStream {
  const track = channelCount ? { getSettings: () => ({ channelCount }) } : undefined;
  return {
    getAudioTracks: () => (track ? [track] : []),
    getTracks: () => (track ? [track] : []),
  } as unknown as MediaStream;
}

describe('audio analysis startup', () => {
  beforeEach(() => {
    workletApi = { addModule: vi.fn() };
    failMediaSource = false;
    Object.defineProperty(FakeAudioContext.prototype, 'audioWorklet', {
      configurable: true,
      value: workletApi,
    });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('AudioWorkletNode', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('falls back to AnalyserNode when AudioWorklet is unavailable', async () => {
    const onMetrics = vi.fn();

    const session = await startAudioAnalysis(createStream(), onMetrics);

    expect(session.engine).toBe('analyser-fallback');
    expect(session.fallback?.code).toBe('worklet-unsupported');
    expect(onMetrics).toHaveBeenCalledTimes(1);
    expect(onMetrics.mock.calls[0]?.[0]).toMatchObject({
      channelCount: 1,
      sampleRate: 48_000,
    });

    await stopAudioAnalysis(session);
    expect(session.context.close).toHaveBeenCalledTimes(1);
  });

  it('keeps fallback metrics channel-aware', async () => {
    const onMetrics = vi.fn();

    const session = await startAudioAnalysis(createStream(2), onMetrics);

    expect(session.engine).toBe('analyser-fallback');
    expect(session.channelAnalysers).toHaveLength(2);
    expect(onMetrics.mock.calls[0]?.[0]).toMatchObject({
      channelCount: 2,
      sampleRate: 48_000,
    });

    await stopAudioAnalysis(session);
    expect(session.channelSplitter?.disconnect).toHaveBeenCalledTimes(1);
    session.channelAnalysers?.forEach((analyser) => {
      expect(analyser.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the safe monitor muted until explicitly enabled', async () => {
    const session = await startAudioAnalysis(createStream(), vi.fn());

    expect(session.monitorGain.gain.value).toBe(0);
    setAudioMonitorEnabled(session, true);
    expect(session.monitorGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.1, 0.02);
    setAudioMonitorEnabled(session, false);
    expect(session.monitorGain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 0.02);

    await stopAudioAnalysis(session);
  });

  it('falls back and preserves the AudioWorklet startup cause', async () => {
    workletApi.addModule.mockRejectedValue(new Error('worklet module rejected'));
    class FakeAudioWorkletNode extends FakeAudioNode {
      readonly port = { onmessage: null };
    }
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);

    const session = await startAudioAnalysis(createStream(), vi.fn());

    expect(session.engine).toBe('analyser-fallback');
    expect(session.fallback?.code).toBe('worklet-start-failed');
    expect(session.fallback?.stage).toBe('audio-worklet-module');
    expect(session.fallback?.detail).toContain('worklet module rejected');
    expect(session.fallback?.detail).toContain('audio-worklet-module');
    expect(workletApi.addModule).toHaveBeenCalledTimes(1);

    await stopAudioAnalysis(session);
  });

  it('reports both worklet and fallback failures', async () => {
    workletApi.addModule.mockRejectedValue(new Error('worklet module rejected'));
    failMediaSource = true;
    class FakeAudioWorkletNode extends FakeAudioNode {
      readonly port = { onmessage: null };
    }
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);

    let failure: unknown;
    try {
      await startAudioAnalysis(createStream(), vi.fn());
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(AudioAnalysisError);
    expect((failure as AudioAnalysisError).code).toBe('fallback-start-failed');
    expect(describeAudioAnalysisError(failure)).toContain('worklet module rejected');
    expect(describeAudioAnalysisError(failure)).toContain('media source creation blocked');
  });
});
