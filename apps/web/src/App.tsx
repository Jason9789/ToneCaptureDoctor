import { useCallback, useEffect, useRef, useState } from 'react';

import type { AudioMetrics } from '@tone-capture-doctor/audio-core';

import {
  AudioInputError,
  type AudioInputSession,
  listAudioInputDevices,
  requestAudioInput,
  stopAudioStream,
} from './audioInput';
import { startAudioAnalysis, type AudioAnalysisSession, stopAudioAnalysis } from './audioAnalysis';
import {
  getInitialLocale,
  MESSAGES,
  persistLocale,
  type ConnectionStatus,
  type Locale,
} from './i18n';

function formatSetting(
  value: boolean | number | undefined,
  notReported: string,
  onText: string,
  offText: string,
  suffix = '',
): string {
  if (value === undefined) {
    return notReported;
  }
  if (typeof value === 'boolean') {
    return value ? onText : offText;
  }
  return `${value.toLocaleString()}${suffix}`;
}

function formatDbfs(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)} dBFS`;
}

function formatFrequency(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} Hz`;
}

function deviceLabel(label: string, index: number, locale: Locale): string {
  if (label) {
    return label;
  }
  return locale === 'ko' ? `오디오 입력 ${index + 1}` : `Audio input ${index + 1}`;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [session, setSession] = useState<AudioInputSession | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState<'starting' | 'active' | 'unavailable'>(
    'unavailable',
  );
  const [metrics, setMetrics] = useState<AudioMetrics | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisRef = useRef<AudioAnalysisSession | null>(null);
  const selectedDeviceRef = useRef('');
  const requestGenerationRef = useRef(0);
  const t = MESSAGES[locale];

  const replaceSession = useCallback((nextSession: AudioInputSession) => {
    if (streamRef.current && streamRef.current !== nextSession.stream) {
      stopAudioStream(streamRef.current);
    }

    streamRef.current = nextSession.stream;
    setSession(nextSession);
    setMetrics(null);
    setAnalysisStatus('starting');
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
    setMetrics(null);
    setAnalysisStatus('unavailable');
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
    if (!session) {
      return undefined;
    }

    let cancelled = false;

    void startAudioAnalysis(
      session.stream,
      (nextMetrics) => {
        if (!cancelled) {
          setMetrics(nextMetrics);
          setAnalysisStatus('active');
        }
      },
      { sampleRate: session.settings.sampleRate },
    )
      .then((nextAnalysis) => {
        if (cancelled) {
          void stopAudioAnalysis(nextAnalysis);
          return;
        }
        analysisRef.current = nextAnalysis;
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysisStatus('unavailable');
        }
      });

    return () => {
      cancelled = true;
      const currentAnalysis = analysisRef.current;
      analysisRef.current = null;
      if (currentAnalysis) {
        void stopAudioAnalysis(currentAnalysis);
      }
    };
  }, [session]);

  useEffect(() => {
    const track = session?.stream.getAudioTracks()[0];
    if (!track) {
      return undefined;
    }

    const handleTrackEnded = () => {
      streamRef.current = null;
      setSession(null);
      setMetrics(null);
      setAnalysisStatus('unavailable');
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
            setMetrics(null);
            setAnalysisStatus('unavailable');
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

  const handleLocaleChange = (nextLocale: Locale) => {
    setLocale(nextLocale);
    persistLocale(nextLocale);
  };

  const isRequesting = status === 'requesting';
  const hasSession = session !== null;
  const isError = ['permission-denied', 'device-unavailable', 'unsupported', 'error'].includes(
    status,
  );
  const statusCopy = t.status[status];

  return (
    <main className="app-shell" data-testid="dashboard" lang={locale}>
      <header className="app-header">
        <div>
          <p className="eyebrow">{t.app.localFirst}</p>
          <h1>{t.app.name}</h1>
        </div>
        <div className="header-actions">
          <label className="language-field" htmlFor="language-select">
            <span>{t.app.language}</span>
            <select
              id="language-select"
              aria-label={t.app.language}
              value={locale}
              onChange={(event) => handleLocaleChange(event.target.value as Locale)}
            >
              <option value="en">{t.app.languageEnglish}</option>
              <option value="ko">{t.app.languageKorean}</option>
            </select>
          </label>
          <span className="status-pill" role="status" aria-live="polite">
            {statusCopy.label}
          </span>
        </div>
      </header>

      <section className="hero" aria-labelledby="signal-health-title">
        <div>
          <p className="eyebrow">{t.hero.eyebrow}</p>
          <h2 id="signal-health-title">{t.hero.title}</h2>
          <p className="hero-copy">{t.hero.copy}</p>
        </div>
        <div className="connection-card" aria-label={t.connection.audioStatus}>
          <span className={`connection-dot connection-dot-${status}`} aria-hidden="true" />
          <div>
            <strong>{statusCopy.label}</strong>
            <p aria-live="polite">{statusCopy.message}</p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid" aria-label={t.hero.title}>
        <article className="panel panel-primary">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t.input.eyebrow}</p>
              <h3>{t.input.ready}</h3>
            </div>
            <span className="panel-index">01</span>
          </div>
          <p>{t.input.description}</p>
          <button
            type="button"
            disabled={isRequesting}
            onClick={() => (hasSession ? stop() : void connect())}
          >
            {isRequesting ? t.input.requesting : hasSession ? t.input.stop : t.input.start}
          </button>
        </article>

        <article className="panel">
          <p className="eyebrow">{t.connection.audioStatus}</p>
          {session?.devices.length ? (
            <label className="field-label" htmlFor="audio-input-device">
              {t.input.chooseDevice}
              <select
                id="audio-input-device"
                aria-label={t.input.chooseDevice}
                value={selectedDeviceId}
                disabled={isRequesting}
                onChange={(event) => handleDeviceChange(event.target.value)}
              >
                {session.devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {deviceLabel(device.label, index, locale)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p data-testid="device-empty">
              {hasSession ? t.connection.noLabelledInputs : t.connection.startToList}
            </p>
          )}
          {isError && (
            <p className="error-message" role="alert">
              {statusCopy.message}
            </p>
          )}
        </article>

        <article className="panel safety-panel">
          <p className="eyebrow">{t.settings.eyebrow}</p>
          {session ? (
            <>
              <h3>{t.settings.title}</h3>
              <dl className="settings-list">
                <div>
                  <dt>{t.settings.sampleRate}</dt>
                  <dd>
                    {formatSetting(
                      session.settings.sampleRate,
                      t.settings.notReported,
                      t.settings.on,
                      t.settings.off,
                      ' Hz',
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.settings.channels}</dt>
                  <dd>
                    {formatSetting(
                      session.settings.channelCount,
                      t.settings.notReported,
                      t.settings.on,
                      t.settings.off,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.settings.autoGain}</dt>
                  <dd>
                    {formatSetting(
                      session.settings.autoGainControl,
                      t.settings.notReported,
                      t.settings.on,
                      t.settings.off,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.settings.echoCancellation}</dt>
                  <dd>
                    {formatSetting(
                      session.settings.echoCancellation,
                      t.settings.notReported,
                      t.settings.on,
                      t.settings.off,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.settings.noiseSuppression}</dt>
                  <dd>
                    {formatSetting(
                      session.settings.noiseSuppression,
                      t.settings.notReported,
                      t.settings.on,
                      t.settings.off,
                    )}
                  </dd>
                </div>
              </dl>
              {session.warnings.length > 0 && (
                <ul className="warning-list">
                  {session.warnings.map((warning) => (
                    <li key={warning}>{t.warnings[warning]}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <h3>{t.routing.title}</h3>
              <p>{t.routing.description}</p>
            </>
          )}
        </article>

        <article className="panel metrics-panel" aria-live="polite">
          <p className="eyebrow">{t.metrics.eyebrow}</p>
          <h3>{t.metrics.title}</h3>
          {!session ? (
            <p>{t.metrics.empty}</p>
          ) : metrics ? (
            <>
              <p className="analysis-state analysis-state-active">{t.analysis.active}</p>
              <dl className="settings-list metrics-list">
                <div>
                  <dt>{t.metrics.peak}</dt>
                  <dd>{formatDbfs(metrics.peakDbfs)}</dd>
                </div>
                <div>
                  <dt>{t.metrics.rms}</dt>
                  <dd>{formatDbfs(metrics.rmsDbfs)}</dd>
                </div>
                <div>
                  <dt>{t.metrics.noiseFloor}</dt>
                  <dd>{formatDbfs(metrics.noiseFloorDbfs)}</dd>
                </div>
                <div>
                  <dt>{t.metrics.dominantFrequency}</dt>
                  <dd>{formatFrequency(metrics.dominantFrequencyHz)}</dd>
                </div>
                <div>
                  <dt>{t.metrics.humCandidate}</dt>
                  <dd>{metrics.humFrequencyHz ? `${metrics.humFrequencyHz} Hz` : '—'}</dd>
                </div>
                <div>
                  <dt>{t.metrics.clippingCandidate}</dt>
                  <dd>
                    {metrics.clippingCandidate ? t.metrics.checkInputLevel : t.metrics.notDetected}
                  </dd>
                </div>
              </dl>
              {metrics.clippingCandidate && (
                <p className="error-message" role="alert">
                  {t.metrics.clippingNotice}
                </p>
              )}
            </>
          ) : (
            <p className="analysis-state">
              {analysisStatus === 'starting' ? t.analysis.starting : t.analysis.unavailable}
            </p>
          )}
        </article>
      </section>
    </main>
  );
}
