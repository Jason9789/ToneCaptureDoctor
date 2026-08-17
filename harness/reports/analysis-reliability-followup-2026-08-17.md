# Analysis reliability follow-up / 분석 신뢰성 후속 작업

Date: 2026-08-17
Branch: `develop`
Scope: P1 log persistence, P2 AudioWorklet diagnostics, P3 fallback channel handling, P4 safe monitor

## Evidence reviewed

The attached session export used Scarlett Solo USB at 44.1 kHz with two reported input channels.
The session contained 8,441 metric events over approximately 401.66 audio seconds. Three snapshot
clips were valid stereo 16-bit PCM WAV files at 44.1 kHz, each with a 10-second duration and
non-zero samples. The archive manifest checksums matched all three audio assets.

The previous export showed 208 missing event sequence numbers, including one approximately 5.67-second
metric gap. It also showed `TypeError: Illegal invocation` during AudioWorklet and Dry/Wet startup,
which caused the mono AnalyserNode fallback to be used.

## Implemented changes

- Detached in-flight `TestLogWriter` batches before persistence and drained events appended during a
  write in a subsequent batch. Failed batches are restored for retry.
- Added a sequence-integrity summary to exported test logs and recomputed it when importing a
  `.tonecheck` report.
- Added AudioWorklet startup-stage diagnostics and instance-level AudioWorklet capability checks.
- Preserved the fallback path while recording the failing stage and sanitized error detail.
- Split fallback measurement into per-channel AnalyserNodes while retaining a separate display
  analyser. Up to two input channels are passed to `audio-core`, so clipping and RMS are not reduced
  to a single channel by the compatibility path.
- Added an opt-in Safe monitor path with a separate gain node, default gain 0, a low-level ramp to
  0.1, immediate reset on stop, and bilingual headphone/feedback warnings.

## Automated verification

| Check | Result |
| --- | --- |
| Workspace typecheck | PASS |
| ESLint | PASS |
| Prettier check | PASS |
| Unit tests | PASS — 2 glossary + 3 analysis-rules + 31 audio-core + 31 web = 67 tests |
| Browser smoke E2E | PASS — 5 tests |
| PWA offline E2E | PASS — 1 test |
| Production build | PASS |
| `git diff --check` | PASS |

## Human gate remains open

The real interface must still be tested with headphones before enabling Safe monitor. Confirm that
the monitor remains silent by default, that the low-level monitor can be disabled immediately, and
that no feedback or unsafe amplifier-speaker routing is introduced. Confirm AudioWorklet success or
review the new fallback stage in the exported log on the actual browser and OS.

Raw audio remains local and opt-in; no API upload or server-side audio processing was added.
