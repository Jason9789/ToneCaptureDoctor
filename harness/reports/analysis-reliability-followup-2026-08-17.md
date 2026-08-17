# Analysis reliability follow-up / 분석 신뢰성 후속 작업

Date: 2026-08-17
Branch: `develop`
Scope: P1 log persistence, P2 AudioWorklet diagnostics, P3 fallback channel handling, P4 safe monitor,
and new-interface session analysis

## Evidence reviewed

The attached session export used Scarlett Solo USB at 44.1 kHz with two reported input channels.
The session contained 8,441 metric events over approximately 401.66 audio seconds. Three snapshot
clips were valid stereo 16-bit PCM WAV files at 44.1 kHz, each with a 10-second duration and
non-zero samples. The archive manifest checksums matched all three audio assets.

The previous export showed 208 missing event sequence numbers, including one approximately 5.67-second
metric gap. It also showed `TypeError: Illegal invocation` during AudioWorklet and Dry/Wet startup,
which caused the mono AnalyserNode fallback to be used.

The new export contains 16 embedded test logs. The latest session (`session-62b6a5db-eb14-4984-b694-87466d8368b0`)
used Scarlett Solo USB at 44.1 kHz with two channels and the AudioWorklet engine. It contains 2,022
contiguous events, including 1,700 ordinary metric events and 318 Dry/Wet events; no sequence numbers
are missing or duplicated. The three long prior sessions still show the old mono fallback and
`Illegal invocation`, but the latest session does not.

All four new snapshot clips are valid stereo 16-bit PCM WAV files at 44.1 kHz and exactly 10 seconds
long. Their archive byte lengths and SHA-256 checksums match the manifest, and their JSON base64
payloads are byte-for-byte identical to the `.tonecheck` audio assets. The raw clips show a strong
channel imbalance: channel 0 is near silence while channel 1 carries the signal and reaches 0 dBFS.
This is consistent with the guitar entering one side of the interface, but it also indicates input
clipping during portions of the captured takes.

The latest session's input is present, not silent: regular metric peaks reach 0 dBFS and RMS reaches
approximately -7.8 dBFS. However, 232 regular metric frames report a clipping candidate, and the
last several seconds fall back to approximately -65 dBFS peak / -75 dBFS RMS. The snapshot metric is
an instantaneous analysis frame while the attached WAV is a rolling 10-second clip, so their levels
are not expected to match over the entire clip. Dry/Wet produced 237 `indeterminate` and 81
`no-signal` frames; this means the configured dry/wet pair was not validated and is not, by itself,
proof that the system output path is broken.

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
- Changed the displayed/stored waveform to use the most energetic input channel. Aggregate peak,
  RMS, clipping, and spectrum calculations still include every channel, while a silent channel 0
  can no longer hide a guitar signal arriving on channel 1.
- Added monitor diagnostics to status events: AudioContext state, destination channel limits,
  monitor gain, and the current route (`system-default`). The UI now states that output routing is
  controlled by the operating system's default output device.

## Automated verification

| Check | Result |
| --- | --- |
| Workspace typecheck | PASS |
| ESLint | PASS |
| Prettier check | PASS |
| Unit tests | PASS — 2 glossary + 3 analysis-rules + 32 audio-core + 31 web = 68 tests |
| Browser smoke E2E | PASS — 5 tests |
| PWA offline E2E | PASS — 1 test |
| Production build | PASS |
| `git diff --check` | PASS |

## Human gate remains open

The real interface must still be tested with headphones before enabling Safe monitor. Confirm that
the monitor remains silent by default, that the low-level monitor can be disabled immediately, and
that no feedback or unsafe amplifier-speaker routing is introduced. Confirm that the operating
system's selected output device is the one being monitored; the app cannot prove physical speaker
audibility from a browser log. Confirm AudioWorklet success or review the new fallback stage in the
exported log on the actual browser and OS. Also verify that the waveform follows the active input
channel and that the interface gain is reduced until the clipping indicator clears.

Raw audio remains local and opt-in; no API upload or server-side audio processing was added.
