import type {
  DryWetAnalysisResult,
  DryWetChannelMode,
  DryWetLatencySummary,
  DryWetWarningCode,
} from '@tone-capture-doctor/audio-core';

import type { Locale, Messages } from './i18n';

interface DryWetDoctorPanelProps {
  channelCount?: number;
  dryChannelIndex: number;
  droppedQuantumCount: number;
  latencySummary: DryWetLatencySummary | null;
  locale: Locale;
  messages: Messages['dryWet'];
  onDryChannelChange: (index: number) => void;
  onWetChannelChange: (index: number) => void;
  result: DryWetAnalysisResult | null;
  status: 'active' | 'starting' | 'unavailable';
  wetChannelIndex: number;
}

function formatDb(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)} dB`;
}

function formatMilliseconds(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)} ms`;
}

function modeLabel(mode: DryWetChannelMode, messages: Messages['dryWet']): string {
  switch (mode) {
    case 'mono-like':
      return messages.modeMonoLike;
    case 'no-signal':
      return messages.modeNoSignal;
    case 'stereo-distinct':
      return messages.modeStereoDistinct;
    default:
      return messages.modeIndeterminate;
  }
}

function warningLabel(warning: DryWetWarningCode, messages: Messages['dryWet']): string {
  switch (warning) {
    case 'both-no-signal':
      return messages.warningBothNoSignal;
    case 'dry-no-signal':
      return messages.warningDryNoSignal;
    case 'latency-low-confidence':
      return messages.warningLatencyLowConfidence;
    case 'mono-like-input':
      return messages.warningMonoLike;
    case 'possible-channel-swap':
      return messages.warningChannelSwap;
    case 'wet-no-signal':
      return messages.warningWetNoSignal;
  }
}

export function DryWetDoctorPanel({
  channelCount,
  dryChannelIndex,
  droppedQuantumCount,
  latencySummary,
  locale,
  messages,
  onDryChannelChange,
  onWetChannelChange,
  result,
  status,
  wetChannelIndex,
}: DryWetDoctorPanelProps) {
  const availableChannelCount = Math.max(0, Math.min(channelCount ?? 0, 8));
  const hasTwoChannels = availableChannelCount >= 2;
  const statusMessage =
    status === 'starting'
      ? messages.starting
      : status === 'active'
        ? messages.active
        : messages.unavailable;

  return (
    <article className="panel dry-wet-panel">
      <p className="eyebrow">{messages.eyebrow}</p>
      <h3>{messages.title}</h3>
      <p>{messages.description}</p>

      {!channelCount ? (
        <p className="analysis-state">{messages.startRequired}</p>
      ) : !hasTwoChannels ? (
        <p className="analysis-state">{messages.needsTwoChannels}</p>
      ) : (
        <>
          <div className="dry-wet-channel-grid">
            <label className="field-label" htmlFor="dry-wet-dry-channel">
              {messages.dryInput}
              <select
                id="dry-wet-dry-channel"
                value={dryChannelIndex}
                onChange={(event) => onDryChannelChange(Number(event.target.value))}
              >
                {Array.from({ length: availableChannelCount }, (_, index) => (
                  <option key={index} value={index} disabled={index === wetChannelIndex}>
                    {messages.input} {index + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label" htmlFor="dry-wet-wet-channel">
              {messages.wetInput}
              <select
                id="dry-wet-wet-channel"
                value={wetChannelIndex}
                onChange={(event) => onWetChannelChange(Number(event.target.value))}
              >
                {Array.from({ length: availableChannelCount }, (_, index) => (
                  <option key={index} value={index} disabled={index === dryChannelIndex}>
                    {messages.input} {index + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="analysis-state">{statusMessage}</p>
          {droppedQuantumCount > 0 && (
            <p className="analysis-state">
              {messages.droppedQuanta}: {droppedQuantumCount.toLocaleString(locale)}
            </p>
          )}
          {result && (
            <>
              <dl className="settings-list dry-wet-metrics">
                <div>
                  <dt>{messages.mode}</dt>
                  <dd>{modeLabel(result.channelMode.mode, messages)}</dd>
                </div>
                <div>
                  <dt>{messages.latency}</dt>
                  <dd>
                    {formatMilliseconds(result.latency.milliseconds)} ·{' '}
                    {result.latency.quality === 'measured'
                      ? messages.latencyMeasured
                      : result.latency.quality === 'estimated'
                        ? messages.latencyEstimated
                        : messages.unavailableMetric}
                  </dd>
                </div>
                <div>
                  <dt>{messages.correlation}</dt>
                  <dd>{result.latency.correlation?.toFixed(2) ?? '—'}</dd>
                </div>
                <div>
                  <dt>{messages.repeatability}</dt>
                  <dd>
                    {latencySummary?.medianSampleOffset ?? '—'} samples ·{' '}
                    {latencySummary?.stability === 'high'
                      ? messages.repeatabilityHigh
                      : latencySummary?.stability === 'medium'
                        ? messages.repeatabilityMedium
                        : latencySummary?.stability === 'low'
                          ? messages.repeatabilityLow
                          : messages.unavailableMetric}
                  </dd>
                </div>
                <div>
                  <dt>{messages.gainDifference}</dt>
                  <dd>{formatDb(result.gainDifferenceDb)}</dd>
                </div>
                <div>
                  <dt>{messages.peakDifference}</dt>
                  <dd>{formatDb(result.peakDifferenceDb)}</dd>
                </div>
              </dl>

              <div className="dry-wet-subsection">
                <strong>{messages.dynamics}</strong>
                <div className="dry-wet-table" role="table" aria-label={messages.dynamics}>
                  <div role="row" className="dry-wet-table-row dry-wet-table-heading">
                    <span role="columnheader">{messages.channel}</span>
                    <span role="columnheader">{messages.rms}</span>
                    <span role="columnheader">{messages.crest}</span>
                  </div>
                  <div role="row" className="dry-wet-table-row">
                    <span role="cell">{messages.dry}</span>
                    <span role="cell">{formatDb(result.dynamics.dry.rmsDbfs)}</span>
                    <span role="cell">{formatDb(result.dynamics.dry.crestFactorDb)}</span>
                  </div>
                  <div role="row" className="dry-wet-table-row">
                    <span role="cell">{messages.wet}</span>
                    <span role="cell">{formatDb(result.dynamics.wet.rmsDbfs)}</span>
                    <span role="cell">{formatDb(result.dynamics.wet.crestFactorDb)}</span>
                  </div>
                </div>
              </div>

              <div className="dry-wet-subsection">
                <strong>{messages.spectrum}</strong>
                {result.spectrumDifference.length > 0 ? (
                  <table className="band-table">
                    <thead>
                      <tr>
                        <th>{messages.band}</th>
                        <th>{messages.delta}</th>
                        <th>{messages.levelMatchedDelta}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.spectrumDifference.map((band) => (
                        <tr key={band.id}>
                          <td>
                            {band.minimumHz.toLocaleString(locale)}–
                            {band.maximumHz.toLocaleString(locale)} Hz
                          </td>
                          <td>{formatDb(band.deltaDb)}</td>
                          <td>{formatDb(band.levelMatchedDeltaDb)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="analysis-state">{messages.waitingForSpectrum}</p>
                )}
              </div>

              {result.warnings.length > 0 && (
                <ul className="warning-list" role="list">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warningLabel(warning, messages)}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
      <p className="dry-wet-safety">
        <strong>{messages.safetyTitle}</strong> {messages.safetyDescription}
      </p>
    </article>
  );
}
