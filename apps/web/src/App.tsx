import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

import {
  compareSnapshots,
  type AudioMetrics,
  type SnapshotComparison,
} from '@tone-capture-doctor/audio-core';
import { evaluateDiagnosticRules } from '@tone-capture-doctor/analysis-rules';

import {
  AudioInputError,
  type AudioInputSession,
  listAudioInputDevices,
  requestAudioInput,
  stopAudioStream,
} from './audioInput';
import {
  startAudioAnalysis,
  startDryWetAnalysis,
  type AudioAnalysisSession,
  type DryWetAnalysisSession,
  stopAudioAnalysis,
  stopDryWetAnalysis,
} from './audioAnalysis';
import { startAudioClipCapture, type AudioClipCapture } from './audioClip';
import {
  getInitialLocale,
  MESSAGES,
  persistLocale,
  type ConnectionStatus,
  type Locale,
  type Messages,
} from './i18n';
import { SignalVisualizer } from './SignalVisualizer';
import { SnapshotAudioPlayer } from './SnapshotAudioPlayer';
import { GlossaryPanel } from './GlossaryPanel';
import { DryWetDoctorPanel } from './DryWetDoctorPanel';
import {
  createSessionId,
  deleteSnapshot,
  exportTestLog,
  exportSnapshots,
  importSnapshots,
  listSnapshots,
  saveSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
  TestLogWriter,
  LocalStorageError,
  type SnapshotRecord,
} from './sessionStore';
import type { DryWetAnalysisResult } from '@tone-capture-doctor/audio-core';

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

type AppNotice =
  | { area: 'snapshots'; key: keyof Messages['snapshots'] }
  | { area: 'compare'; key: keyof Messages['compare'] };

function confidenceLabel(
  confidence: AudioMetrics['humConfidence'],
  sampleCount: number,
  sampleRate: number,
  messages: Messages['metrics'],
): string {
  if (confidence === 'high') {
    return `${messages.confidence}: ${messages.confidenceHigh}`;
  }
  if (confidence === 'medium') {
    return `${messages.confidence}: ${messages.confidenceMedium}`;
  }
  if (confidence === 'low') {
    return `${messages.confidence}: ${messages.confidenceLow}`;
  }
  return sampleCount < sampleRate ? messages.notReady : messages.notDetected;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [session, setSession] = useState<AudioInputSession | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState<'starting' | 'active' | 'unavailable'>(
    'unavailable',
  );
  const [connectionNotice, setConnectionNotice] = useState<keyof Messages['connection'] | null>(
    null,
  );
  const [metrics, setMetrics] = useState<AudioMetrics | null>(null);
  const [analysisNode, setAnalysisNode] = useState<AnalyserNode | null>(null);
  const [dryWetDryChannelIndex, setDryWetDryChannelIndex] = useState(0);
  const [dryWetWetChannelIndex, setDryWetWetChannelIndex] = useState(1);
  const [dryWetResult, setDryWetResult] = useState<DryWetAnalysisResult | null>(null);
  const [dryWetStatus, setDryWetStatus] = useState<'starting' | 'active' | 'unavailable'>(
    'unavailable',
  );
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const [logSessionId, setLogSessionId] = useState<string | null>(null);
  const [referenceSnapshotId, setReferenceSnapshotId] = useState('');
  const [candidateSnapshotId, setCandidateSnapshotId] = useState('');
  const [comparison, setComparison] = useState<SnapshotComparison | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisRef = useRef<AudioAnalysisSession | null>(null);
  const dryWetAnalysisRef = useRef<DryWetAnalysisSession | null>(null);
  const logWriterRef = useRef<TestLogWriter | null>(null);
  const logWriterStartRef = useRef<Promise<void> | null>(null);
  const clipCaptureRef = useRef<AudioClipCapture | null>(null);
  const statusRef = useRef(status);
  const localeRef = useRef(locale);
  const pendingLogSessionIdRef = useRef<string | null>(null);
  const selectedDeviceRef = useRef('');
  const requestGenerationRef = useRef(0);
  const t = MESSAGES[locale];

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    localeRef.current = locale;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const refreshSnapshots = useCallback(async () => {
    const nextSnapshots = await listSnapshots();
    setSnapshots(nextSnapshots);
    return nextSnapshots;
  }, []);

  useEffect(() => {
    let active = true;
    void listSnapshots()
      .then((storedSnapshots) => {
        if (active) {
          setSnapshots(storedSnapshots);
        }
      })
      .catch(() => {
        if (active) {
          setNotice({ area: 'snapshots', key: 'error' });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const updateStatus = useCallback((nextStatus: ConnectionStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const replaceSession = useCallback(
    (nextSession: AudioInputSession) => {
      if (streamRef.current && streamRef.current !== nextSession.stream) {
        stopAudioStream(streamRef.current);
      }

      streamRef.current = nextSession.stream;
      const nextLogSessionId = createSessionId();
      pendingLogSessionIdRef.current = nextLogSessionId;
      setLogSessionId(nextLogSessionId);
      setSession(nextSession);
      setMetrics(null);
      setAnalysisStatus('starting');
      setConnectionNotice(null);
      setDryWetResult(null);
      setDryWetStatus((nextSession.settings.channelCount ?? 0) >= 2 ? 'starting' : 'unavailable');
      const nextDeviceId = nextSession.selectedDeviceId ?? '';
      selectedDeviceRef.current = nextDeviceId;
      setSelectedDeviceId(nextDeviceId);
      updateStatus('connected');
    },
    [updateStatus],
  );

  const connect = useCallback(
    async (deviceId?: string) => {
      const previousDeviceId = selectedDeviceRef.current;
      const requestGeneration = ++requestGenerationRef.current;
      setConnectionNotice(null);
      updateStatus('requesting');

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
        if (streamRef.current) {
          updateStatus('connected');
          setConnectionNotice('switchError');
        } else {
          if (error instanceof AudioInputError) {
            updateStatus(error.code === 'unknown' ? 'error' : error.code);
          } else {
            updateStatus('error');
          }
        }
        setSelectedDeviceId(previousDeviceId);
      }
    },
    [replaceSession, updateStatus],
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
    setConnectionNotice(null);
    setDryWetResult(null);
    setDryWetStatus('unavailable');
    selectedDeviceRef.current = '';
    setSelectedDeviceId('');
    updateStatus('stopped');
  }, [updateStatus]);

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
    const sessionId = pendingLogSessionIdRef.current ?? createSessionId();
    pendingLogSessionIdRef.current = null;
    const writer = new TestLogWriter({
      appVersion: '0.0.0',
      locale: localeRef.current,
      sessionId,
      startedAt: new Date().toISOString(),
      trackSettings: {
        autoGainControl: session.settings.autoGainControl,
        channelCount: session.settings.channelCount,
        deviceId: session.settings.deviceId,
        echoCancellation: session.settings.echoCancellation,
        noiseSuppression: session.settings.noiseSuppression,
        sampleRate: session.settings.sampleRate,
      },
    });
    logWriterRef.current = writer;
    clipCaptureRef.current = startAudioClipCapture(session.stream);
    const startPromise = writer.start().catch(() => setNotice({ area: 'snapshots', key: 'error' }));
    logWriterStartRef.current = startPromise;

    void startAudioAnalysis(
      session.stream,
      (nextMetrics) => {
        if (!cancelled) {
          setMetrics(nextMetrics);
          setAnalysisStatus('active');
          writer.appendMetrics(nextMetrics);
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
        setAnalysisNode(nextAnalysis.analyser);
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysisStatus('unavailable');
          setAnalysisNode(null);
        }
      });

    return () => {
      cancelled = true;
      setAnalysisNode(null);
      const currentAnalysis = analysisRef.current;
      analysisRef.current = null;
      if (currentAnalysis) {
        void stopAudioAnalysis(currentAnalysis);
      }
      const currentClipCapture = clipCaptureRef.current;
      clipCaptureRef.current = null;
      if (currentClipCapture) {
        void currentClipCapture.stop();
      }
      if (logWriterRef.current === writer) {
        logWriterRef.current = null;
        void writer.finish(statusRef.current).catch(() => undefined);
      }
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    const channelCount = session?.settings.channelCount ?? 0;
    if (!session || channelCount < 2) {
      return undefined;
    }

    void startDryWetAnalysis(
      session.stream,
      (result) => {
        if (!cancelled) {
          setDryWetResult(result);
          setDryWetStatus('active');
        }
      },
      {
        dryChannelIndex: dryWetDryChannelIndex,
        sampleRate: session.settings.sampleRate,
        wetChannelIndex: dryWetWetChannelIndex,
      },
    )
      .then((nextAnalysis) => {
        if (cancelled) {
          void stopDryWetAnalysis(nextAnalysis);
          return;
        }
        dryWetAnalysisRef.current = nextAnalysis;
      })
      .catch(() => {
        if (!cancelled) {
          setDryWetStatus('unavailable');
        }
      });

    return () => {
      cancelled = true;
      const currentAnalysis = dryWetAnalysisRef.current;
      dryWetAnalysisRef.current = null;
      if (currentAnalysis) {
        void stopDryWetAnalysis(currentAnalysis);
      }
    };
  }, [dryWetDryChannelIndex, dryWetWetChannelIndex, session]);

  useEffect(() => {
    if (session && logWriterRef.current) {
      logWriterRef.current.append('status', { status });
    }
  }, [session, status]);

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
      setConnectionNotice(null);
      setDryWetResult(null);
      setDryWetStatus('unavailable');
      selectedDeviceRef.current = '';
      setSelectedDeviceId('');
      updateStatus('device-unavailable');
    };

    track.addEventListener('ended', handleTrackEnded);
    return () => track.removeEventListener('ended', handleTrackEnded);
  }, [session, updateStatus]);

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
            setConnectionNotice(null);
            setDryWetResult(null);
            setDryWetStatus('unavailable');
            selectedDeviceRef.current = '';
            setSelectedDeviceId('');
            updateStatus('device-unavailable');
          }
        })
        .catch(() => updateStatus('device-unavailable'));
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [session, updateStatus]);

  const handleDeviceChange = (deviceId: string) => {
    void connect(deviceId);
  };

  const handleDryChannelChange = (index: number) => {
    if (index === dryWetWetChannelIndex) {
      setDryWetWetChannelIndex(dryWetDryChannelIndex);
    }
    setDryWetResult(null);
    setDryWetStatus('starting');
    setDryWetDryChannelIndex(index);
  };

  const handleWetChannelChange = (index: number) => {
    if (index === dryWetDryChannelIndex) {
      setDryWetDryChannelIndex(dryWetWetChannelIndex);
    }
    setDryWetResult(null);
    setDryWetStatus('starting');
    setDryWetWetChannelIndex(index);
  };

  const handleLocaleChange = (nextLocale: Locale) => {
    setLocale(nextLocale);
    persistLocale(nextLocale);
  };

  const handleSaveSnapshot = useCallback(async () => {
    if (!session || !metrics) {
      return;
    }
    if (
      !metrics.analysisWaveform ||
      !metrics.spectrumPower ||
      metrics.analysisFrameStartSample === null ||
      metrics.analysisFrameEndSample === null
    ) {
      setNotice({ area: 'snapshots', key: 'analysisNotReady' });
      return;
    }

    try {
      const audioClip = await clipCaptureRef.current?.getRecentClip();
      const snapshot: SnapshotRecord = {
        algorithmVersion: metrics.algorithmVersion,
        ...(audioClip ? { audioClip } : {}),
        channelCount: session.settings.channelCount ?? metrics.channelCount,
        createdAt: new Date().toISOString(),
        endSample: metrics.analysisFrameEndSample,
        fftSize: metrics.spectrumFftSize,
        id: `snapshot-${createSessionId()}`,
        inputDeviceLabel: session.devices.find(
          (device) => device.deviceId === session.selectedDeviceId,
        )?.label,
        label: snapshotLabel.trim() || `Signal ${snapshots.length + 1}`,
        metrics: {
          clippingCandidate: metrics.clippingCandidate,
          crestFactorDb: metrics.crestFactorDb,
          dominantFrequencyHz: metrics.dominantFrequencyHz,
          humConfidence: metrics.humConfidence,
          humFrequencyHz: metrics.humFrequencyHz,
          noiseFloorConfidence: metrics.noiseFloorConfidence,
          noiseFloorDbfs: metrics.noiseFloorDbfs,
          peakDbfs: metrics.peakDbfs,
          rmsDbfs: metrics.rmsDbfs,
          sampleCount: metrics.sampleCount,
          sampleRate: metrics.sampleRate,
        },
        notes: snapshotNotes.trim(),
        sampleRate: metrics.sampleRate,
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        sessionId: logSessionId ?? 'no-session',
        spectrum: Array.from(metrics.spectrumPower),
        spectrumUnit: 'power-per-bin',
        startSample: metrics.analysisFrameStartSample,
        waveform: Array.from(metrics.analysisWaveform),
        window: metrics.spectrumWindow,
      };
      await saveSnapshot(snapshot);
      await refreshSnapshots();
      setSnapshotLabel('');
      setSnapshotNotes('');
      setNotice({ area: 'snapshots', key: audioClip ? 'audioClipSaved' : 'saved' });
    } catch (error) {
      setNotice({
        area: 'snapshots',
        key: error instanceof LocalStorageError && error.code === 'quota' ? 'quota' : 'error',
      });
    }
  }, [
    logSessionId,
    metrics,
    refreshSnapshots,
    session,
    snapshotLabel,
    snapshotNotes,
    snapshots.length,
  ]);

  const handleDeleteSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!window.confirm(t.snapshots.deleteConfirm)) {
        return;
      }
      try {
        await deleteSnapshot(snapshotId);
        await refreshSnapshots();
        if (referenceSnapshotId === snapshotId) {
          setReferenceSnapshotId('');
          setComparison(null);
        }
        if (candidateSnapshotId === snapshotId) {
          setCandidateSnapshotId('');
          setComparison(null);
        }
      } catch (error) {
        setNotice({
          area: 'snapshots',
          key: error instanceof LocalStorageError && error.code === 'quota' ? 'quota' : 'error',
        });
      }
    },
    [candidateSnapshotId, referenceSnapshotId, refreshSnapshots, t.snapshots.deleteConfirm],
  );

  const handleExportLog = useCallback(async () => {
    if (!logSessionId) {
      setNotice({ area: 'snapshots', key: 'empty' });
      return;
    }
    try {
      await logWriterStartRef.current;
      const log = await exportTestLog(logSessionId);
      const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tone-capture-doctor-${logSessionId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice({ area: 'snapshots', key: 'error' });
    }
  }, [logSessionId]);

  const handleExportSnapshots = useCallback(async () => {
    try {
      const serialized = await exportSnapshots();
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'tone-capture-doctor-snapshots.json';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice({ area: 'snapshots', key: 'error' });
    }
  }, []);

  const handleImportSnapshots = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file) {
        return;
      }
      try {
        await importSnapshots(await file.text());
        await refreshSnapshots();
        setNotice({ area: 'snapshots', key: 'imported' });
      } catch {
        setNotice({ area: 'snapshots', key: 'invalidImport' });
      }
    },
    [refreshSnapshots],
  );

  const handleCompare = useCallback(() => {
    const reference = snapshots.find((snapshot) => snapshot.id === referenceSnapshotId);
    const candidate = snapshots.find((snapshot) => snapshot.id === candidateSnapshotId);
    if (!reference || !candidate || reference.id === candidate.id) {
      setComparison(null);
      setNotice({ area: 'compare', key: 'selectBoth' });
      return;
    }
    try {
      if (
        reference.spectrumUnit !== 'power-per-bin' ||
        candidate.spectrumUnit !== 'power-per-bin'
      ) {
        throw new Error('Legacy snapshots do not include a comparable calibrated spectrum.');
      }
      setComparison(
        compareSnapshots(
          { ...reference, spectrumUnit: reference.spectrumUnit },
          { ...candidate, spectrumUnit: candidate.spectrumUnit },
        ),
      );
      setNotice(null);
    } catch {
      setComparison(null);
      setNotice({ area: 'compare', key: 'incompatible' });
    }
  }, [candidateSnapshotId, referenceSnapshotId, snapshots]);

  const isRequesting = status === 'requesting';
  const hasSession = session !== null;
  const isError = ['permission-denied', 'device-unavailable', 'unsupported', 'error'].includes(
    status,
  );
  const statusCopy = t.status[status];
  const guidance = metrics ? evaluateDiagnosticRules(metrics, { warnings: session?.warnings }) : [];

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
          {connectionNotice && (
            <p className="error-message" role="alert">
              {t.connection[connectionNotice]}
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

        <article className="panel metrics-panel">
          <p className="eyebrow">{t.metrics.eyebrow}</p>
          <h3>{t.metrics.title}</h3>
          {!session ? (
            <p>{t.metrics.empty}</p>
          ) : metrics ? (
            <>
              <p className="analysis-state analysis-state-active" aria-live="polite">
                {t.analysis.active}
              </p>
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
                  <dd className="metric-value">
                    <span>{formatDbfs(metrics.noiseFloorDbfs)}</span>
                    <small>
                      {confidenceLabel(
                        metrics.noiseFloorConfidence,
                        metrics.sampleCount,
                        metrics.sampleRate,
                        t.metrics,
                      )}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>{t.metrics.dominantFrequency}</dt>
                  <dd>{formatFrequency(metrics.dominantFrequencyHz)}</dd>
                </div>
                <div>
                  <dt>{t.metrics.humCandidate}</dt>
                  <dd className="metric-value">
                    <span>{metrics.humFrequencyHz ? `${metrics.humFrequencyHz} Hz` : '—'}</span>
                    <small>
                      {confidenceLabel(
                        metrics.humConfidence,
                        metrics.sampleCount,
                        metrics.sampleRate,
                        t.metrics,
                      )}
                    </small>
                  </dd>
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

        <article className="panel guidance-panel">
          <p className="eyebrow">{t.guidance.eyebrow}</p>
          <h3>{t.guidance.title}</h3>
          {guidance.length === 0 ? (
            <p className="analysis-state">{t.guidance.empty}</p>
          ) : (
            <div className="guidance-list">
              {guidance.map((rule) => (
                <section className="guidance-card" key={rule.id}>
                  <div className="guidance-heading">
                    <strong>{rule.observation[locale]}</strong>
                    <span>
                      {t.guidance.confidence}:{' '}
                      {rule.confidence === 'high'
                        ? t.guidance.confidenceHigh
                        : rule.confidence === 'medium'
                          ? t.guidance.confidenceMedium
                          : t.guidance.confidenceLow}
                    </span>
                  </div>
                  <div className="guidance-columns">
                    <div>
                      <strong>{t.guidance.causes}</strong>
                      <ul>
                        {rule.possibleCauses.map((cause, index) => (
                          <li key={`${rule.id}-cause-${index}`}>{cause[locale]}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>{t.guidance.experiments}</strong>
                      <ul>
                        {rule.experiments.map((experiment, index) => (
                          <li key={`${rule.id}-experiment-${index}`}>{experiment[locale]}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="guidance-never-claim">
                    <strong>{t.guidance.neverClaim}</strong>
                    <ul>
                      {rule.neverClaim.map((claim, index) => (
                        <li key={`${rule.id}-claim-${index}`}>{claim[locale]}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="phase8-grid" aria-label={t.dryWet.title}>
        <DryWetDoctorPanel
          channelCount={session?.settings.channelCount}
          dryChannelIndex={dryWetDryChannelIndex}
          locale={locale}
          messages={t.dryWet}
          onDryChannelChange={handleDryChannelChange}
          onWetChannelChange={handleWetChannelChange}
          result={dryWetResult}
          status={dryWetStatus}
          wetChannelIndex={dryWetWetChannelIndex}
        />
      </section>

      <section className="phase5-grid" aria-label={t.snapshots.title}>
        <article className="panel visualizer-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t.visualizer.waveform}</p>
              <h3>{t.visualizer.title}</h3>
            </div>
          </div>
          <SignalVisualizer
            analyser={analysisNode}
            locale={locale}
            noSignalLabel={t.visualizer.noSignal}
            spectrumLabel={t.visualizer.spectrum}
            spectrogramLabel={t.visualizer.spectrogram}
            timeWindowLabel={t.visualizer.timeWindow}
            waveformLabel={t.visualizer.waveform}
          />
        </article>

        <article className="panel snapshots-panel">
          <p className="eyebrow">{t.snapshots.eyebrow}</p>
          <h3>{t.snapshots.title}</h3>
          <div className="snapshot-form">
            <label className="field-label" htmlFor="snapshot-label">
              {t.snapshots.label}
              <input
                id="snapshot-label"
                value={snapshotLabel}
                onChange={(event) => setSnapshotLabel(event.target.value)}
              />
            </label>
            <label className="field-label" htmlFor="snapshot-notes">
              {t.snapshots.notes}
              <textarea
                id="snapshot-notes"
                rows={3}
                value={snapshotNotes}
                onChange={(event) => setSnapshotNotes(event.target.value)}
              />
            </label>
            <div className="snapshot-actions">
              <button
                type="button"
                disabled={!session || !metrics?.analysisWaveform || !metrics.spectrumPower}
                onClick={() => void handleSaveSnapshot()}
              >
                {t.snapshots.save}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={!logSessionId}
                onClick={() => void handleExportLog()}
              >
                {t.snapshots.exportLog}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => void handleExportSnapshots()}
              >
                {t.snapshots.exportSnapshots}
              </button>
              <label className="secondary-button file-button" htmlFor="snapshot-import">
                {t.snapshots.importSnapshots}
                <input
                  id="snapshot-import"
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportSnapshots}
                />
              </label>
            </div>
          </div>
          <div className="compare-panel">
            <p className="eyebrow">{t.compare.title}</p>
            <div className="compare-selects">
              <label className="field-label" htmlFor="reference-snapshot">
                {t.compare.reference}
                <select
                  id="reference-snapshot"
                  value={referenceSnapshotId}
                  onChange={(event) => setReferenceSnapshotId(event.target.value)}
                >
                  <option value="">—</option>
                  {snapshots.map((snapshot) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {snapshot.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label" htmlFor="candidate-snapshot">
                {t.compare.candidate}
                <select
                  id="candidate-snapshot"
                  value={candidateSnapshotId}
                  onChange={(event) => setCandidateSnapshotId(event.target.value)}
                >
                  <option value="">—</option>
                  {snapshots.map((snapshot) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {snapshot.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" disabled={snapshots.length < 2} onClick={handleCompare}>
              {t.compare.run}
            </button>
            {comparison && (
              <div className="compare-result" aria-live="polite">
                <p className="analysis-state">
                  <strong>{t.compare.confidence}: </strong>
                  {comparison.confidence === 'high'
                    ? t.compare.confidenceHigh
                    : comparison.confidence === 'medium'
                      ? t.compare.confidenceMedium
                      : t.compare.confidenceLow}
                </p>
                <dl className="settings-list compare-metrics">
                  <div>
                    <dt>{t.compare.normalization}</dt>
                    <dd>{comparison.normalizationGainDb.toFixed(1)} dB</dd>
                  </div>
                  <div>
                    <dt>{t.compare.alignment}</dt>
                    <dd>
                      {comparison.alignmentLagSamples} samples ·{' '}
                      {comparison.alignmentCorrelation.toFixed(2)} correlation
                    </dd>
                  </div>
                  <div>
                    <dt>{t.compare.waveformDelta}</dt>
                    <dd>{comparison.waveformRmsDelta.toFixed(3)}</dd>
                  </div>
                  <div>
                    <dt>{t.compare.spectrumDelta}</dt>
                    <dd>{comparison.spectrumMeanAbsoluteDelta.toFixed(3)}</dd>
                  </div>
                </dl>
                <ul className="compare-facts">
                  {comparison.flags.loudnessNormalizationApplied && (
                    <li>{t.compare.loudnessNormalized}</li>
                  )}
                  {comparison.flags.alignmentApplied && (
                    <li>
                      {t.compare.alignment}: {comparison.alignmentLagSamples} samples
                    </li>
                  )}
                  {comparison.flags.frequencyBalanceChanged && (
                    <li>{t.compare.frequencyChanged}</li>
                  )}
                  {comparison.flags.noiseFloorChanged && <li>{t.compare.noiseChanged}</li>}
                  {(comparison.flags.referenceClipping || comparison.flags.candidateClipping) && (
                    <li>{t.compare.clippingCandidate}</li>
                  )}
                  {!comparison.flags.frequencyBalanceChanged &&
                    !comparison.flags.noiseFloorChanged &&
                    !comparison.flags.referenceClipping &&
                    !comparison.flags.candidateClipping && (
                      <li>{t.compare.noMaterialDifference}</li>
                    )}
                </ul>
                <div className="compare-interpretations">
                  <strong>{t.compare.lowConfidenceNotice}</strong>
                  {(comparison.flags.frequencyBalanceChanged ||
                    comparison.flags.referenceClipping ||
                    comparison.flags.candidateClipping ||
                    comparison.flags.noiseFloorChanged) && (
                    <ul className="compare-facts">
                      {(comparison.flags.referenceClipping ||
                        comparison.flags.candidateClipping) && (
                        <li>{t.compare.clippingInterpretation}</li>
                      )}
                      {comparison.flags.frequencyBalanceChanged && (
                        <li>{t.compare.frequencyInterpretation}</li>
                      )}
                      {comparison.flags.noiseFloorChanged && (
                        <li>{t.compare.noiseInterpretation}</li>
                      )}
                    </ul>
                  )}
                </div>
                <table className="band-table">
                  <thead>
                    <tr>
                      <th>{t.compare.band}</th>
                      <th>{t.compare.delta}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.frequencyBands.map((band) => (
                      <tr key={band.label}>
                        <td>
                          {band.minimumHz.toLocaleString()}–{band.maximumHz.toLocaleString()} Hz
                        </td>
                        <td>{band.deltaDb.toFixed(1)} dB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!comparison && snapshots.length < 2 && (
              <p className="analysis-state">{t.compare.empty}</p>
            )}
          </div>
          {notice && (
            <p className="snapshot-message" role="status" aria-live="polite">
              {notice.area === 'snapshots' ? t.snapshots[notice.key] : t.compare[notice.key]}
            </p>
          )}
          {snapshots.length === 0 ? (
            <p className="analysis-state">{t.snapshots.empty}</p>
          ) : (
            <ul className="snapshot-list">
              {snapshots.map((snapshot) => (
                <li className="snapshot-card" key={snapshot.id}>
                  <div className="snapshot-card-heading">
                    <strong>{snapshot.label}</strong>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => void handleDeleteSnapshot(snapshot.id)}
                    >
                      {t.snapshots.delete}
                    </button>
                  </div>
                  <span>{new Date(snapshot.createdAt).toLocaleString(locale)}</span>
                  <p>
                    {formatDbfs(snapshot.metrics.peakDbfs)} · {formatDbfs(snapshot.metrics.rmsDbfs)}{' '}
                    · {formatFrequency(snapshot.metrics.dominantFrequencyHz)}
                  </p>
                  {snapshot.audioClip ? (
                    <>
                      <small>{t.snapshots.audioClipSaved}</small>
                      <SnapshotAudioPlayer
                        audioClip={snapshot.audioClip}
                        clipEndLabel={t.snapshots.clipEnd}
                        clipStartLabel={t.snapshots.clipStart}
                        pauseLabel={t.snapshots.pauseClip}
                        playLabel={t.snapshots.playClip}
                        selectionLabel={t.snapshots.clipSelection}
                      />
                    </>
                  ) : (
                    <small>{t.snapshots.audioClipUnavailable}</small>
                  )}
                  {snapshot.notes && <p className="snapshot-notes">{snapshot.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="phase7-grid" aria-label={t.glossary.title}>
        <GlossaryPanel locale={locale} messages={t.glossary} />
      </section>
    </main>
  );
}
