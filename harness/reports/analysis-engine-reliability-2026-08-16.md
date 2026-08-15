# Analysis Engine Reliability verification report — 2026-08-16

## Scope

This pass hardens the Phase 4 analysis engine without marking any human/device gate complete.

- Defines an authoritative `power-per-bin` spectrum contract and snapshot schema 2.
- Replaces per-quantum spectral work with per-channel ring buffers, a 2,048-point Hann FFT at a
  1,024-sample hop, and four-periodogram Welch-style averaging.
- Adds three-bin dominant-frequency refinement, fixed-band power aggregation, a rolling
  multi-second noise-floor estimator with confidence, and persistent harmonic 50/60 Hz checks.
- Preserves peak, RMS, clipped-sample count, and clipping candidates across each 30 Hz UI reporting
  interval.
- Separates the display-only `AnalyserNode` from snapshot and comparison authority.
- Adds sample-based report/analysis coordinates and confidence values to exported structured logs.
- Rejects malformed, ambiguous, incompatible, or future-version snapshot spectra before compare or
  import.

## Correctness fixtures

The audio-core suite covers:

- calibrated sine peak, RMS, crest factor, and one-sided Hann power;
- a +6.0206 dB RMS increase when amplitude doubles;
- configurable threshold and flat-plateau clipping;
- opposite-polarity stereo without frequency-domain cancellation;
- persistent 50 Hz and 60 Hz fundamentals with harmonics;
- 41.2 Hz bass and 82.4 Hz guitar false-positive rejection;
- deterministic broadband-noise floor and tonal-signal rejection;
- report-interval transient retention and sample-coordinate reset;
- spectrum unit, length, finite/non-negative power, sample-rate, and FFT compatibility;
- lag alignment, band-power ratios, and comparison summary variance.

## Automated verification

Environment: workspace Node.js 24.x runtime, npm 11.x, macOS.

| Check | Result |
| --- | --- |
| `npm run format` / `npm run format:check` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS — glossary, analysis-rules, audio-core, web |
| `npm test` | PASS — 42 tests (2 glossary, 3 rules, 20 audio-core, 17 web) |
| `npm run build` | PASS — Vite production build |
| `npm run test:e2e` | PASS — Playwright smoke 1 |
| `git diff --check` | PASS |

## Local performance probe

A compiled Node probe processed ten seconds of 48 kHz stereo input in 1,147.93 ms on this
development machine (8.7x faster than real time). The equivalent pre-change probe was about 2.18
seconds, so the local CPU time decreased by roughly 47%. This is a directional engineering probe,
not a browser AudioWorklet deadline guarantee.

## Research and boundaries

The adopted methods and exact implementation boundaries are recorded in
[`docs/analysis-engine.md`](../../docs/analysis-engine.md). The implementation uses standards and
published methods as engineering foundations, but explicitly labels simplified low-latency
estimators rather than claiming complete reproduction of offline research algorithms.

## Remaining gates

- Real audio-interface measurements on supported macOS and Windows paths.
- Long-duration browser profiling for callback deadline misses/drop-outs.
- Analog silence, instrument 41.2/82.4 Hz, 50/60 Hz hum, clipping, channel polarity, and unplug/replug
  scenarios using exported structured logs.
- Human review of displayed confidence and guidance.

`harness/state.json` remains unchanged: no actual-device or human gate is complete.
