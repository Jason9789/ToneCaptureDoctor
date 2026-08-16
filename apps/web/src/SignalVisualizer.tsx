import { useEffect, useRef, useState } from 'react';

import type { AudioMetrics } from '@tone-capture-doctor/audio-core';

import type { Locale, Messages } from './i18n';

interface SignalVisualizerProps {
  analyser: AnalyserNode | null;
  labels: Messages['visualizer'];
  locale: Locale;
  metrics: AudioMetrics | null;
}

const BACKGROUND = '#10221c';
const GRID = 'rgba(155, 228, 193, 0.12)';
const PRIMARY = '#9be4c1';
const SECONDARY = '#e7b979';
const TEXT = '#f5fbf7';
const MUTED = '#a7bcb3';
const OVERLAY = 'rgba(7, 25, 19, 0.88)';
const PLOT_BOTTOM_RATIO = 0.86;
const WAVEFORM_DB_TICKS = [0, -6, -12, -24, -48];
const SPECTRUM_DB_TICKS = [0, -24, -48, -72, -96];

function resizeCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const width = Math.max(canvas.clientWidth, 320);
  const height = Math.max(canvas.clientHeight, 160);
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  const context = canvas.getContext('2d');
  context?.scale(pixelRatio, pixelRatio);
  return context;
}

function formatNumber(value: number, locale: Locale, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  });
}

function formatInteger(value: number, locale: Locale): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: 0,
  });
}

function formatDbfs(value: number | null | undefined, locale: Locale): string {
  return value === null || value === undefined ? '—' : `${formatNumber(value, locale)} dBFS`;
}

function formatFrequency(value: number | null | undefined, locale: Locale): string {
  return value === null || value === undefined ? '—' : `${formatNumber(value, locale)} Hz`;
}

function formatAxisFrequency(value: number, locale: Locale): string {
  if (value >= 1_000) {
    return `${formatNumber(value / 1_000, locale, value >= 10_000 ? 0 : 1)}k`;
  }
  return formatInteger(value, locale);
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.strokeStyle = GRID;
  context.lineWidth = 1;
  context.beginPath();
  for (const ratio of [0.25, 0.5, 0.75]) {
    const y = height * ratio;
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();
}

function drawOverlay(
  context: CanvasRenderingContext2D,
  lines: string[],
  width: number,
  align: 'left' | 'right' = 'left',
): void {
  const padding = 8;
  const lineHeight = 15;
  context.save();
  context.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  const textWidth = Math.max(...lines.map((line) => context.measureText(line).width), 0);
  const boxWidth = Math.min(width - 12, textWidth + padding * 2);
  const boxHeight = lines.length * lineHeight + padding * 2 - 2;
  const x = align === 'right' ? width - boxWidth - 8 : 8;
  const y = 8;

  context.fillStyle = OVERLAY;
  context.fillRect(x, y, boxWidth, boxHeight);
  context.strokeStyle = 'rgba(155, 228, 193, 0.3)';
  context.strokeRect(x + 0.5, y + 0.5, boxWidth - 1, boxHeight - 1);
  context.fillStyle = TEXT;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  lines.forEach((line, index) => {
    context.fillText(line, x + padding, y + padding + index * lineHeight, boxWidth - padding * 2);
  });
  context.restore();
}

function drawWaveformScale(context: CanvasRenderingContext2D, width: number, height: number): void {
  const center = height / 2;
  const amplitudeHeight = height * 0.42;
  context.save();
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  for (const tick of WAVEFORM_DB_TICKS) {
    const distance = 10 ** (tick / 20) * amplitudeHeight;
    for (const y of [center - distance, center + distance]) {
      if (y < 1 || y > height - 1) {
        continue;
      }
      context.strokeStyle = tick === 0 ? 'rgba(231, 185, 121, 0.35)' : GRID;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
      if (y === center - distance) {
        context.fillStyle = MUTED;
        context.fillText(`${tick} dBFS`, 5, Math.max(8, y));
      }
    }
  }
  context.restore();
}

function formatTimeAxis(seconds: number, locale: Locale): string {
  const milliseconds = seconds * 1_000;
  if (Math.abs(milliseconds) < 1_000) {
    return `${formatNumber(milliseconds, locale, Math.abs(milliseconds) >= 10 ? 1 : 2)} ms`;
  }
  return `${formatNumber(seconds, locale, 1)} s`;
}

function drawWaveformTimeAxis(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sampleRate: number,
  sampleCount: number,
  labels: Messages['visualizer'],
  locale: Locale,
): void {
  const axisTop = height * PLOT_BOTTOM_RATIO;
  const axisHeight = height - axisTop;
  const duration = sampleCount / Math.max(sampleRate, 1);

  context.save();
  context.fillStyle = OVERLAY;
  context.fillRect(0, axisTop, width, axisHeight);
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textBaseline = 'bottom';
  context.fillStyle = MUTED;
  for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
    const x = ratio * width;
    context.strokeStyle = GRID;
    context.beginPath();
    context.moveTo(x, axisTop);
    context.lineTo(x, height - 12);
    context.stroke();
    context.textAlign = ratio === 0 ? 'left' : ratio === 1 ? 'right' : 'center';
    context.fillText(formatTimeAxis(-duration * (1 - ratio), locale), x, height - 2);
  }
  context.textAlign = 'right';
  context.textBaseline = 'top';
  context.fillText(labels.timeScale, width - 5, axisTop + 1);
  context.restore();
}

function drawWaveform(
  context: CanvasRenderingContext2D,
  data: Uint8Array,
  metrics: AudioMetrics | null,
  labels: Messages['visualizer'],
  locale: Locale,
): number[] {
  const width = Math.max(context.canvas.clientWidth, 320);
  const height = Math.max(context.canvas.clientHeight, 160);
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);
  drawGrid(context, width, height);
  drawWaveformScale(context, width, height);
  context.strokeStyle = PRIMARY;
  context.lineWidth = 2;
  context.beginPath();
  const normalized: number[] = [];
  for (let index = 0; index < data.length; index += 1) {
    const value = (data[index] ?? 128) / 128 - 1;
    normalized.push(value);
    const x = (index / Math.max(data.length - 1, 1)) * width;
    const y = height / 2 + value * height * 0.42;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
  drawWaveformTimeAxis(
    context,
    width,
    height,
    metrics?.sampleRate ?? 48_000,
    data.length,
    labels,
    locale,
  );

  drawOverlay(
    context,
    metrics
      ? [
          `${labels.peak}: ${formatDbfs(metrics.peakDbfs, locale)}`,
          `${labels.rms}: ${formatDbfs(metrics.rmsDbfs, locale)}`,
          `${labels.sampleRate}: ${formatInteger(metrics.sampleRate, locale)} Hz · ${labels.channels}: ${metrics.channelCount}`,
        ]
      : [labels.noSignal],
    width,
  );
  return normalized;
}

function frequencyX(
  frequency: number,
  binWidth: number,
  maximumBin: number,
  width: number,
): number {
  const bin = Math.max(1, Math.min(maximumBin, frequency / Math.max(binWidth, 1e-9)));
  return (Math.log10(bin) / Math.log10(Math.max(maximumBin, 2))) * width;
}

function drawSpectrumScale(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  minDecibels: number,
  maxDecibels: number,
  locale: Locale,
): void {
  const plotHeight = height * PLOT_BOTTOM_RATIO;
  const range = Math.max(maxDecibels - minDecibels, 1);
  context.save();
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  for (const tick of SPECTRUM_DB_TICKS) {
    if (tick < minDecibels || tick > maxDecibels) {
      continue;
    }
    const y = ((maxDecibels - tick) / range) * plotHeight;
    context.strokeStyle = tick === 0 ? 'rgba(231, 185, 121, 0.35)' : GRID;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
    context.fillStyle = MUTED;
    context.fillText(`${formatNumber(tick, locale, 0)} dBFS`, 5, Math.max(8, y));
  }
  context.restore();
}

function drawFrequencyAxis(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sampleRate: number,
  fftSize: number,
  labels: Messages['visualizer'],
  locale: Locale,
): void {
  const binWidth = sampleRate / Math.max(fftSize, 1);
  const nyquist = sampleRate / 2;
  const maximumBin = Math.max(1, Math.floor(nyquist / Math.max(binWidth, 1e-9)));
  const frequencies = (
    width >= 480 ? [20, 100, 1_000, 10_000, nyquist] : [100, 1_000, 10_000, nyquist]
  ).filter(
    (frequency, index, values) =>
      frequency <= nyquist && values.indexOf(frequency) === index && frequency >= binWidth,
  );
  const axisTop = height * PLOT_BOTTOM_RATIO;
  const axisHeight = height - axisTop;

  context.save();
  context.fillStyle = OVERLAY;
  context.fillRect(0, axisTop, width, axisHeight);
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'bottom';
  context.fillStyle = MUTED;
  for (const frequency of frequencies) {
    const x = frequencyX(frequency, binWidth, maximumBin, width);
    context.strokeStyle = GRID;
    context.beginPath();
    context.moveTo(x, axisTop);
    context.lineTo(x, height - 12);
    context.stroke();
    const isFirst = frequency === frequencies[0];
    const isLast = frequency === frequencies[frequencies.length - 1];
    context.textAlign = isFirst ? 'left' : isLast ? 'right' : 'center';
    context.fillText(formatAxisFrequency(frequency, locale), x, height - 2);
  }
  context.textAlign = 'right';
  context.textBaseline = 'top';
  context.fillText(labels.frequencyScale, width - 5, axisTop + 1);
  context.restore();
}

function drawSpectrum(
  context: CanvasRenderingContext2D,
  data: Uint8Array,
  smoothed: number[],
  peakHold: number[],
  analyser: AnalyserNode,
  metrics: AudioMetrics | null,
  labels: Messages['visualizer'],
  locale: Locale,
): number[] {
  const width = Math.max(context.canvas.clientWidth, 320);
  const height = Math.max(context.canvas.clientHeight, 160);
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);
  drawGrid(context, width, height * PLOT_BOTTOM_RATIO);

  const values: number[] = [];
  context.fillStyle = SECONDARY;
  for (let index = 1; index < data.length; index += 1) {
    const value = (data[index] ?? 0) / 255;
    smoothed[index] = (smoothed[index] ?? 0) * 0.78 + value * 0.22;
    peakHold[index] = Math.max((peakHold[index] ?? 0) * 0.985, smoothed[index] ?? 0);
    // Logarithmic x mapping keeps the low-frequency instrument range readable.
    const logPosition = Math.log10(index) / Math.log10(Math.max(data.length - 1, 2));
    const barWidth = Math.max(1, width / data.length);
    const x = logPosition * width;
    const barHeight = (smoothed[index] ?? 0) * height * PLOT_BOTTOM_RATIO;
    context.fillRect(x, height * PLOT_BOTTOM_RATIO - barHeight, barWidth + 1, barHeight);
    values.push(smoothed[index] ?? 0);
  }

  context.strokeStyle = PRIMARY;
  context.lineWidth = 1;
  context.beginPath();
  for (let index = 1; index < data.length; index += 1) {
    const logPosition = Math.log10(index) / Math.log10(Math.max(data.length - 1, 2));
    const x = logPosition * width;
    const y = height * PLOT_BOTTOM_RATIO - (peakHold[index] ?? 0) * height * PLOT_BOTTOM_RATIO;
    if (index === 1) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();

  const sampleRate = metrics?.sampleRate ?? analyser.context.sampleRate;
  const fftSize = metrics?.spectrumFftSize ?? analyser.fftSize;
  const binWidth = metrics?.spectrumBinHz ?? sampleRate / Math.max(fftSize, 1);
  drawSpectrumScale(context, width, height, analyser.minDecibels, analyser.maxDecibels, locale);
  drawFrequencyAxis(context, width, height, sampleRate, fftSize, labels, locale);

  if (metrics?.dominantFrequencyHz !== null && metrics?.dominantFrequencyHz !== undefined) {
    const x = frequencyX(metrics.dominantFrequencyHz, binWidth, data.length - 1, width);
    context.save();
    context.strokeStyle = PRIMARY;
    context.setLineDash([4, 3]);
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height * PLOT_BOTTOM_RATIO);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = PRIMARY;
    context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = x > width * 0.72 ? 'right' : 'left';
    context.textBaseline = 'top';
    context.fillText(
      `${labels.dominantFrequency}: ${formatFrequency(metrics.dominantFrequencyHz, locale)}`,
      x > width * 0.72 ? x - 5 : x + 5,
      height * PLOT_BOTTOM_RATIO - 15,
    );
    context.restore();
  }

  drawOverlay(
    context,
    metrics
      ? [
          `${labels.peak}: ${formatDbfs(metrics.peakDbfs, locale)}`,
          `${labels.dominantFrequency}: ${formatFrequency(metrics.dominantFrequencyHz, locale)}`,
          `${labels.fftSize}: ${formatInteger(fftSize, locale)} · ${labels.binWidth}: ${formatNumber(binWidth, locale, 2)} Hz`,
          `${labels.nyquist}: ${formatFrequency(sampleRate / 2, locale)}`,
        ]
      : [labels.noSignal],
    width,
    'right',
  );
  return values;
}

function drawSpectrogram(
  context: CanvasRenderingContext2D,
  history: number[][],
  metrics: AudioMetrics | null,
  labels: Messages['visualizer'],
  locale: Locale,
): void {
  const width = Math.max(context.canvas.clientWidth, 320);
  const height = Math.max(context.canvas.clientHeight, 160);
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);
  const rowHeight = height / Math.max(history.length, 1);

  for (let rowIndex = 0; rowIndex < history.length; rowIndex += 1) {
    const row = history[rowIndex] ?? [];
    const y = height - (rowIndex + 1) * rowHeight;
    for (let index = 0; index < row.length; index += 1) {
      const value = row[index] ?? 0;
      const logStart = Math.log10(Math.max(index, 1)) / Math.log10(Math.max(row.length, 2));
      const logEnd = Math.log10(Math.max(index + 1, 2)) / Math.log10(Math.max(row.length, 2));
      context.fillStyle = `hsl(${145 - value * 110} 68% ${24 + value * 48}%)`;
      context.fillRect(
        logStart * width,
        y,
        Math.max(1, (logEnd - logStart) * width + 1),
        rowHeight + 1,
      );
    }
  }

  const sampleRate = metrics?.sampleRate ?? 48_000;
  const fftSize = metrics?.spectrumFftSize ?? 2_048;
  drawFrequencyAxis(context, width, height, sampleRate, fftSize, labels, locale);
  drawOverlay(
    context,
    metrics
      ? [
          `${labels.sampleRate}: ${formatInteger(sampleRate, locale)} Hz · ${labels.fftSize}: ${formatInteger(fftSize, locale)}`,
          `${labels.window}: ${metrics.spectrumWindow} · ${history.length} frames · ${(history.length / 30).toFixed(1)} s`,
          `${labels.nyquist}: ${formatFrequency(sampleRate / 2, locale)}`,
        ]
      : [labels.noSignal],
    width,
  );
}

function downsample(values: number[], count: number): number[] {
  if (values.length <= count) {
    return [...values];
  }
  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.floor((index * values.length) / count);
    return values[sourceIndex] ?? 0;
  });
}

function metricAriaLabel(
  metrics: AudioMetrics | null,
  labels: Messages['visualizer'],
  locale: Locale,
): string {
  if (!metrics) {
    return labels.noSignal;
  }
  return `${labels.peak} ${formatDbfs(metrics.peakDbfs, locale)}, ${labels.rms} ${formatDbfs(metrics.rmsDbfs, locale)}, ${labels.dominantFrequency} ${formatFrequency(metrics.dominantFrequencyHz, locale)}`;
}

export function SignalVisualizer({ analyser, labels, locale, metrics }: SignalVisualizerProps) {
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef<AudioMetrics | null>(metrics);
  const [timeWindowZoom, setTimeWindowZoom] = useState(1);

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  useEffect(() => {
    if (!analyser) {
      return undefined;
    }

    const waveformCanvas = waveformCanvasRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    const spectrogramCanvas = spectrogramCanvasRef.current;
    if (!waveformCanvas || !spectrumCanvas || !spectrogramCanvas) {
      return undefined;
    }

    const waveformContext = resizeCanvas(waveformCanvas);
    const spectrumContext = resizeCanvas(spectrumCanvas);
    const spectrogramContext = resizeCanvas(spectrogramCanvas);
    if (!waveformContext || !spectrumContext || !spectrogramContext) {
      return undefined;
    }

    const waveformData = new Uint8Array(analyser.fftSize);
    const spectrumData = new Uint8Array(analyser.frequencyBinCount);
    const smoothedSpectrum: number[] = [];
    const peakHold: number[] = [];
    const spectrogramHistory: number[][] = [];
    let frameHandle = 0;
    let active = true;

    const renderFrame = () => {
      if (!active) {
        return;
      }
      analyser.getByteTimeDomainData(waveformData);
      analyser.getByteFrequencyData(spectrumData);
      const zoomedWaveform = waveformData.subarray(
        Math.max(0, waveformData.length - Math.floor(waveformData.length / timeWindowZoom)),
      );
      const currentMetrics = metricsRef.current;
      drawWaveform(waveformContext, zoomedWaveform, currentMetrics, labels, locale);
      const spectrum = drawSpectrum(
        spectrumContext,
        spectrumData,
        smoothedSpectrum,
        peakHold,
        analyser,
        currentMetrics,
        labels,
        locale,
      );
      spectrogramHistory.push(downsample(spectrum, 128));
      if (spectrogramHistory.length > 80) {
        spectrogramHistory.shift();
      }
      drawSpectrogram(spectrogramContext, spectrogramHistory, currentMetrics, labels, locale);
      frameHandle = window.requestAnimationFrame(renderFrame);
    };

    renderFrame();
    return () => {
      active = false;
      window.cancelAnimationFrame(frameHandle);
    };
  }, [analyser, labels, locale, timeWindowZoom]);

  const ariaLabel = metricAriaLabel(metrics, labels, locale);

  return (
    <div className="visualizer-grid" aria-label={`${labels.waveform} / ${labels.spectrum}`}>
      <div className="visualizer-controls">
        <label htmlFor="time-window-zoom">{labels.timeWindow}</label>
        <select
          id="time-window-zoom"
          value={timeWindowZoom}
          onChange={(event) => setTimeWindowZoom(Number(event.target.value))}
        >
          <option value="1">1×</option>
          <option value="2">2×</option>
          <option value="4">4×</option>
        </select>
      </div>
      <div className="visualizer-card">
        <div className="visualizer-heading">
          <strong>{labels.waveform}</strong>
          <span>{labels.waveformScale}</span>
        </div>
        <canvas
          ref={waveformCanvasRef}
          aria-label={`${labels.waveform}: ${ariaLabel}`}
          role="img"
        />
        {!analyser && <p className="visualizer-empty">{labels.noSignal}</p>}
      </div>
      <div className="visualizer-card">
        <div className="visualizer-heading">
          <strong>{labels.spectrum}</strong>
          <span>{labels.frequencyScale}</span>
        </div>
        <canvas
          ref={spectrumCanvasRef}
          aria-label={`${labels.spectrum}: ${ariaLabel}`}
          role="img"
        />
        {!analyser && <p className="visualizer-empty">{labels.noSignal}</p>}
      </div>
      <div className="visualizer-card">
        <div className="visualizer-heading">
          <strong>{labels.spectrogram}</strong>
          <span>{labels.frequencyScale}</span>
        </div>
        <canvas
          ref={spectrogramCanvasRef}
          aria-label={`${labels.spectrogram}: ${ariaLabel}`}
          role="img"
        />
        {!analyser && <p className="visualizer-empty">{labels.noSignal}</p>}
      </div>
    </div>
  );
}
