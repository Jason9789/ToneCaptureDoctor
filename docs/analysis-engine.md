# Analysis engine contract

This document describes the authoritative measurement path introduced by audio algorithm
`0.2.0`. The visualizer is intentionally outside this contract: Web Audio `AnalyserNode` byte
values are suitable for drawing, but they are not persisted or used for diagnosis/comparison.

## Data path and timing

1. `AudioWorkletProcessor` receives each browser render quantum and sends every channel to
   `audio-core`.
2. If `AudioWorklet` is unavailable or cannot initialize, Signal Health uses an `AnalyserNode`
   compatibility path. It polls float time-domain frames at approximately 30 Hz and feeds them
   into the same deterministic `audio-core` analyzer. The session log records the selected engine
   and the sanitized fallback reason. Dry/Wet Doctor remains AudioWorklet-only because it requires
   synchronized two-channel frames.
3. The engine keeps cumulative sample coordinates and preallocated per-channel ring buffers.
4. Peak, RMS, and clipping are calculated for every quantum. FFT work runs every 1,024 samples,
   using the latest 2,048 samples.
5. `AudioMetricsAccumulator` combines all quanta in each 30 Hz UI reporting interval. It keeps the
   maximum peak, sample-weighted RMS, clipping count, and any clipping candidate seen in the
   interval.
6. The UI receives summary metrics. A snapshot may be saved only after the engine has produced an
   authoritative waveform and spectrum.

`sampleCount`, `reportStartSample`, `reportEndSample`, `analysisFrameStartSample`,
`analysisFrameEndSample`, and `audioTimeSeconds` preserve the two different time windows. Report
coordinates cover the UI aggregation interval; analysis coordinates cover the exact FFT waveform.

## Metric definitions

| Output | Definition and unit |
| --- | --- |
| Sample peak | Maximum absolute floating-point sample over all channels. `peakDbfs = 20 log10(peak)` |
| RMS | Square root of mean squared samples over all channels. `rmsDbfs = 20 log10(rms)` |
| Crest factor | `20 log10(peak / rms)` when RMS is non-zero |
| Clipping candidate | At least three same-polarity samples at or above 0.98, with adjacent difference at most 0.001. This is a candidate, not proof of converter clipping. |
| Spectrum | One-sided Hann-windowed power per bin, corrected for window power and one-sided energy. `spectrumUnit` is `power-per-bin`. |
| Dominant frequency | Largest non-DC spectrum bin refined by a bounded three-bin log-parabolic interpolation. |
| Frequency bands | Sum of linear spectrum power in fixed bands; dB values use `10 log10(power)`. |
| Noise floor | 20th percentile of eligible Welch total-power observations in a rolling three-second window. Eligibility uses spectral flatness or a very-low-level fallback. It becomes available after at least one second. |
| Hum candidate | 50/60 Hz fundamental plus first two harmonics measured with one-second Hann-windowed Goertzel filters, local ±3 Hz contrast, and repeated half-window observations. |

Stereo channels are analyzed independently and their powers are averaged. They are never summed in
the time domain, avoiding cancellation for opposite-polarity stereo input.

## Spectrum and snapshot compatibility

Snapshot schema 2 records `fftSize`, `sampleRate`, `window`, and `spectrumUnit`. Tone Compare accepts
only equal sample rates, equal FFT sizes, a complete `N/2 + 1` one-sided spectrum, finite
non-negative power values, and `power-per-bin` units. Schema-1 snapshots remain readable/exportable
but are not compared because their old byte-display spectrum has no safe physical-unit conversion.

Tone Compare normalizes each spectrum by total power, sums power per frequency band, and reports
band ratios using `10 log10`. Waveforms are RMS-normalized and lag-aligned separately.

## Research basis and implementation boundary

- The [Web Audio API specification](https://www.w3.org/TR/webaudio-1.1/) defines byte-frequency
  data as clipped dB values mapped to 0–255 and describes render quanta. The primary path therefore
  uses AudioWorklet samples; the fallback uses `AnalyserNode.getFloatTimeDomainData()` only when
  the primary path cannot run and is labelled as a compatibility measurement.
- F. J. Harris, [“On the Use of Windows for Harmonic Analysis with the Discrete Fourier
  Transform”](https://doi.org/10.1109/PROC.1978.10837), supports the explicit Hann window and
  window-energy calibration.
- P. Welch, [“The Use of Fast Fourier Transform for the Estimation of Power Spectra”](https://doi.org/10.1109/TAU.1967.1161901),
  motivates averaging successive modified periodograms. This implementation keeps four rolling
  periodograms; it is a low-latency Welch-style estimator, not a full offline PSD implementation.
- E. Jacobsen and P. Kootsookos, [“Fast, Accurate Frequency Estimators”](https://doi.org/10.1109/MSP.2007.361611),
  motivates three-bin peak refinement. The current log-parabolic formula is a simpler bounded
  approximation and is validated against synthetic tones.
- M. Brandt and J. Bitzer, [“Automatic Detection of Hum in Audio Signals”](https://doi.org/10.17743/jaes.2014.0034),
  motivates harmonic structure and temporal persistence. The MVP detector is deliberately limited
  to known 50/60 Hz mains families and must not be interpreted as source identification.
- R. Martin, [“Noise Power Spectral Density Estimation Based on Optimal Smoothing and Minimum
  Statistics”](https://doi.org/10.1109/89.928915), motivates tracking low power statistics over
  time. The MVP uses a simpler rolling percentile with a flatness gate; it does not claim to
  implement Martin's complete estimator.

## Verified and still pending

Automated fixtures cover calibrated sine power, +6.02 dB amplitude scaling, configured clipping,
opposite-polarity stereo, persistent 50/60 Hz harmonic hum, 41.2/82.4 Hz false-positive rejection,
broadband noise, tonal noise-floor rejection, interval aggregation, and malformed comparison data.

Actual audio-interface behavior, browser scheduling under long sessions, analog noise, clock drift,
fallback scheduling under long sessions, and macOS/Windows device variation remain human/device
gates. Exported test logs include sample-time coordinates, confidence values, analysis engine, and
fallback diagnostics so those runs can be analyzed later without uploading raw audio.
