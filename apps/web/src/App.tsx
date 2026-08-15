import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AudioInputError,
  type AudioInputSession,
  listAudioInputDevices,
  requestAudioInput,
  stopAudioStream,
} from './audioInput';

type ConnectionStatus =
  | 'idle'
  | 'requesting'
  | 'connected'
  | 'stopped'
  | 'permission-denied'
  | 'device-unavailable'
  | 'unsupported'
  | 'error';

const STATUS_COPY: Record<ConnectionStatus, { label: string; message: string }> = {
  idle: {
    label: 'Ready to connect',
    message: 'Choose Start to request local audio permission.',
  },
  requesting: {
    label: 'Requesting permission',
    message: 'Allow microphone access in the browser prompt to continue.',
  },
  connected: {
    label: 'Connected',
    message: 'Audio input is open locally. No audio is uploaded.',
  },
  stopped: {
    label: 'Stopped',
    message: 'The audio input is closed. Start again when you are ready.',
  },
  'permission-denied': {
    label: 'Permission denied',
    message: 'Allow microphone permission in the browser site settings, then try again.',
  },
  'device-unavailable': {
    label: 'Input unavailable',
    message: 'Check the interface connection and selected input, then try again.',
  },
  unsupported: {
    label: 'Browser unsupported',
    message: 'Use a recent Chrome, Edge, or Safari on HTTPS or localhost.',
  },
  error: {
    label: 'Input error',
    message: 'The audio input could not be opened. Check browser and device settings.',
  },
};

function formatSetting(value: boolean | number | undefined, suffix = ''): string {
  if (value === undefined) {
    return 'Not reported';
  }
  if (typeof value === 'boolean') {
    return value ? 'On' : 'Off';
  }
  return `${value.toLocaleString()}${suffix}`;
}

export function App() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [session, setSession] = useState<AudioInputSession | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const selectedDeviceRef = useRef('');
  const requestGenerationRef = useRef(0);
  const statusCopy = STATUS_COPY[status];

  const replaceSession = useCallback((nextSession: AudioInputSession) => {
    if (streamRef.current && streamRef.current !== nextSession.stream) {
      stopAudioStream(streamRef.current);
    }

    streamRef.current = nextSession.stream;
    setSession(nextSession);
    const nextDeviceId = nextSession.selectedDeviceId ?? '';
    selectedDeviceRef.current = nextDeviceId;
    setSelectedDeviceId(nextDeviceId);
    setStatus('connected');
  }, []);

  const connect = useCallback(
    async (deviceId?: string) => {
      const previousDeviceId = selectedDeviceRef.current;
      const requestGeneration = ++requestGenerationRef.current;
      setStatus('requesting');

      try {
        const nextSession = await requestAudioInput(deviceId);
        if (requestGeneration !== requestGenerationRef.current) {
          stopAudioStream(nextSession.stream);
          return;
        }
        replaceSession(nextSession);
      } catch (error) {
        if (requestGeneration !== requestGenerationRef.current) {
          return;
        }
        if (error instanceof AudioInputError) {
          setStatus(error.code === 'unknown' ? 'error' : error.code);
        } else {
          setStatus('error');
        }
        setSelectedDeviceId(previousDeviceId);
      }
    },
    [replaceSession],
  );

  const stop = useCallback(() => {
    requestGenerationRef.current += 1;
    if (streamRef.current) {
      stopAudioStream(streamRef.current);
      streamRef.current = null;
    }

    setSession(null);
    selectedDeviceRef.current = '';
    setSelectedDeviceId('');
    setStatus('stopped');
  }, []);

  useEffect(() => {
    return () => {
      requestGenerationRef.current += 1;
      if (streamRef.current) {
        stopAudioStream(streamRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const track = session?.stream.getAudioTracks()[0];
    if (!track) {
      return undefined;
    }

    const handleTrackEnded = () => {
      streamRef.current = null;
      setSession(null);
      selectedDeviceRef.current = '';
      setSelectedDeviceId('');
      setStatus('device-unavailable');
    };

    track.addEventListener('ended', handleTrackEnded);
    return () => track.removeEventListener('ended', handleTrackEnded);
  }, [session]);

  useEffect(() => {
    if (!session || typeof navigator === 'undefined' || !navigator.mediaDevices?.addEventListener) {
      return undefined;
    }

    const handleDeviceChange = () => {
      void listAudioInputDevices()
        .then((devices) => {
          setSession((current) => (current ? { ...current, devices } : current));
          if (
            selectedDeviceRef.current &&
            !devices.some((device) => device.deviceId === selectedDeviceRef.current)
          ) {
            if (streamRef.current) {
              stopAudioStream(streamRef.current);
              streamRef.current = null;
            }
            setSession(null);
            selectedDeviceRef.current = '';
            setSelectedDeviceId('');
            setStatus('device-unavailable');
          }
        })
        .catch(() => setStatus('device-unavailable'));
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [session]);

  const handleDeviceChange = (deviceId: string) => {
    void connect(deviceId);
  };

  const isRequesting = status === 'requesting';
  const hasSession = session !== null;
  const isError = ['permission-denied', 'device-unavailable', 'unsupported', 'error'].includes(
    status,
  );

  return (
    <main className="app-shell" data-testid="dashboard">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local-first audio diagnostics</p>
          <h1>ToneCaptureDoctor</h1>
        </div>
        <span className="status-pill" role="status" aria-live="polite">
          {statusCopy.label}
        </span>
      </header>

      <section className="hero" aria-labelledby="signal-health-title">
        <div>
          <p className="eyebrow">First mode</p>
          <h2 id="signal-health-title">Signal Health</h2>
          <p className="hero-copy">
            Check whether an instrument signal is reaching your interface before comparing tones.
            The first release keeps analysis local and explains the next useful experiment.
          </p>
        </div>
        <div className="connection-card" aria-label="Audio input status">
          <span className={`connection-dot connection-dot-${status}`} aria-hidden="true" />
          <div>
            <strong>{statusCopy.label}</strong>
            <p aria-live="polite">{statusCopy.message}</p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid" aria-label="Signal health dashboard">
        <article className="panel panel-primary">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Input overview</p>
              <h3>Ready when you are</h3>
            </div>
            <span className="panel-index">01</span>
          </div>
          <p>
            Connect a guitar or bass to an instrument/Hi-Z input. Permission is requested only after
            you choose to start, and the stream stays in this browser session.
          </p>
          <button
            type="button"
            disabled={isRequesting}
            onClick={() => (hasSession ? stop() : void connect())}
          >
            {isRequesting
              ? 'Requesting permission…'
              : hasSession
                ? 'Stop Signal Health'
                : 'Start Signal Health'}
          </button>
        </article>

        <article className="panel">
          <p className="eyebrow">Input device</p>
          {session?.devices.length ? (
            <label className="field-label" htmlFor="audio-input-device">
              Choose an audio input
              <select
                id="audio-input-device"
                value={selectedDeviceId}
                disabled={isRequesting}
                onChange={(event) => handleDeviceChange(event.target.value)}
              >
                {session.devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p data-testid="device-empty">
              {hasSession
                ? 'No labelled audio inputs were returned. Check the browser device permission.'
                : 'Start Signal Health to request permission and list available inputs.'}
            </p>
          )}
          {isError && (
            <p className="error-message" role="alert">
              {statusCopy.message}
            </p>
          )}
        </article>

        <article className="panel safety-panel">
          <p className="eyebrow">Track settings</p>
          {session ? (
            <>
              <h3>What the browser applied</h3>
              <dl className="settings-list">
                <div>
                  <dt>Sample rate</dt>
                  <dd>{formatSetting(session.settings.sampleRate, ' Hz')}</dd>
                </div>
                <div>
                  <dt>Channels</dt>
                  <dd>{formatSetting(session.settings.channelCount)}</dd>
                </div>
                <div>
                  <dt>Auto gain</dt>
                  <dd>{formatSetting(session.settings.autoGainControl)}</dd>
                </div>
                <div>
                  <dt>Echo cancellation</dt>
                  <dd>{formatSetting(session.settings.echoCancellation)}</dd>
                </div>
                <div>
                  <dt>Noise suppression</dt>
                  <dd>{formatSetting(session.settings.noiseSuppression)}</dd>
                </div>
              </dl>
              {session.warnings.length > 0 && (
                <ul className="warning-list">
                  {session.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <h3>Instrument input only</h3>
              <p>
                Never connect a tube amplifier speaker output directly to an interface input. Use a
                microphone, load box, DI, or another manufacturer-approved path.
              </p>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
