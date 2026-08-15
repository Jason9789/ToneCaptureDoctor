import { useEffect, useRef, useState } from 'react';

import type { Locale } from './i18n';

interface SignalVisualizerProps {
  analyser: AnalyserNode | null;
  locale: Locale;
  noSignalLabel: string;
  spectrumLabel: string;
  spectrogramLabel: string;
  timeWindowLabel: string;
  waveformLabel: string;
}

const BACKGROUND = '#10221c';
const GRID = 'rgba(155, 228, 193, 0.12)';
const PRIMARY = '#9be4c1';
const SECONDARY = '#e7b979';

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

function drawWaveform(context: CanvasRenderingContext2D, data: Uint8Array): number[] {
  const width = Math.max(context.canvas.clientWidth, 320);
  const height = Math.max(context.canvas.clientHeight, 160);
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);
  drawGrid(context, width, height);
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
  return normalized;
}

function drawSpectrum(
  context: CanvasRenderingContext2D,
  data: Uint8Array,
  smoothed: number[],
  peakHold: number[],
): number[] {
  const width = Math.max(context.canvas.clientWidth, 320);
  const height = Math.max(context.canvas.clientHeight, 160);
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);
  drawGrid(context, width, height);

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
    const barHeight = (smoothed[index] ?? 0) * height * 0.86;
    context.fillRect(x, height - barHeight, barWidth + 1, barHeight);
    values.push(smoothed[index] ?? 0);
  }

  context.strokeStyle = PRIMARY;
  context.lineWidth = 1;
  context.beginPath();
  for (let index = 1; index < data.length; index += 1) {
    const logPosition = Math.log10(index) / Math.log10(Math.max(data.length - 1, 2));
    const x = logPosition * width;
    const y = height - (peakHold[index] ?? 0) * height * 0.86;
    if (index === 1) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
  return values;
}

function drawSpectrogram(context: CanvasRenderingContext2D, history: number[][]): void {
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

export function SignalVisualizer({
  analyser,
  locale,
  noSignalLabel,
  spectrumLabel,
  spectrogramLabel,
  timeWindowLabel,
  waveformLabel,
}: SignalVisualizerProps) {
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [timeWindowZoom, setTimeWindowZoom] = useState(1);

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
      drawWaveform(waveformContext, zoomedWaveform);
      const spectrum = drawSpectrum(spectrumContext, spectrumData, smoothedSpectrum, peakHold);
      spectrogramHistory.push(downsample(spectrum, 128));
      if (spectrogramHistory.length > 80) {
        spectrogramHistory.shift();
      }
      drawSpectrogram(spectrogramContext, spectrogramHistory);
      frameHandle = window.requestAnimationFrame(renderFrame);
    };

    renderFrame();
    return () => {
      active = false;
      window.cancelAnimationFrame(frameHandle);
    };
  }, [analyser, locale, timeWindowZoom]);

  return (
    <div className="visualizer-grid" aria-label={`${waveformLabel} / ${spectrumLabel}`}>
      <div className="visualizer-controls">
        <label htmlFor="time-window-zoom">{timeWindowLabel}</label>
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
          <strong>{waveformLabel}</strong>
          <span>0 dBFS</span>
        </div>
        <canvas ref={waveformCanvasRef} aria-label={waveformLabel} role="img" />
        {!analyser && <p className="visualizer-empty">{noSignalLabel}</p>}
      </div>
      <div className="visualizer-card">
        <div className="visualizer-heading">
          <strong>{spectrumLabel}</strong>
          <span>log Hz</span>
        </div>
        <canvas ref={spectrumCanvasRef} aria-label={spectrumLabel} role="img" />
        {!analyser && <p className="visualizer-empty">{noSignalLabel}</p>}
      </div>
      <div className="visualizer-card">
        <div className="visualizer-heading">
          <strong>{spectrogramLabel}</strong>
          <span>time × Hz</span>
        </div>
        <canvas ref={spectrogramCanvasRef} aria-label={spectrogramLabel} role="img" />
        {!analyser && <p className="visualizer-empty">{noSignalLabel}</p>}
      </div>
    </div>
  );
}
