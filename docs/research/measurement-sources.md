# Measurement and equipment research / 측정·장비 조사

This is an implementation boundary, not a claim that the product is compliant with every cited standard.

## Applied to the MVP

- Knapp and Carter’s [generalized cross-correlation paper](https://doi.org/10.1109/TASSP.1976.1162830) motivates GCC-PHAT for a robust delay candidate. Dry/Wet Doctor uses GCC-PHAT to select a lag and recomputes normalized time-domain correlation at that lag for confidence. Repeated results are summarized with median and median absolute deviation (MAD).
- The [Web Audio 1.1 specification](https://www.w3.org/TR/webaudio-1.1/) describes render quanta and channel data. The worklet now reports dropped/mismatched quanta instead of silently treating them as valid continuity.
- The [Media Capture and Streams specification](https://www.w3.org/TR/mediacapture-streams/) makes clear that requested constraints are not guarantees. The app records the actual `MediaStreamTrack.getSettings()` values and keeps browser-reported mismatches visible.
- [Welch’s periodogram method](https://doi.org/10.1109/TAU.1967.1161901), Hann-window calibration, and persistent harmonic checks remain the basis of the Signal Health engine. The engine reports calibrated power-per-bin data, not a universal tone score.

## Deliberately not claimed

- [ITU-R BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I) and [AES17](https://www.aes.org/publications/standards/preview.cfm?ID=21) are useful references for loudness and electroacoustic measurement reporting, but the MVP is not a broadcast loudness meter or a full AES17 compliance instrument. Sample rate, FFT, window, calibration unit, and termination assumptions must be shown before making a standards claim.
- Farina’s [exponential swept-sine method](https://angelofarina.it/Public/Papers/134-AES00.PDF) can separate linear impulse response and harmonic distortion, but it is appropriate here only for a controlled line/DI fixture. The app does not emit an uncontrolled sweep through an amplifier or speaker.

## Amp, pedal, and interface safety evidence

- [Focusrite’s level guidance](https://support.focusrite.com/hc/de/articles/115004171025-What-are-the-differences-between-mic-line-and-instrument-level) distinguishes instrument, line, mic, and speaker levels. [Focusrite’s XLR input guidance](https://support.focusrite.com/hc/en-gb/articles/207546295-What-can-I-connect-to-the-XLR-Input-on-my-Interface) warns that line/instrument outputs and phantom power must not be treated as interchangeable with a microphone input.
- [Universal Audio’s line-level guidance](https://help.uaudio.com/hc/en-us/articles/206020656-Springing-Forward-With-UA-Hardware) reinforces line-output to line-input routing and avoiding a line output into a mic preamp. [UA OX operation notes](https://help.uaudio.com/hc/en-us/articles/360000071343-Critical-OX-Amp-Top-Box-Operation-Notes) are an example of why amplifier/load safety is model-specific.
- [BOSS OS-2 documentation](https://www.boss.info/us/products/os-2/) is treated as a product-specific reference, not as permission to infer settings for every overdrive/distortion pedal. The app can document a pedal’s signal path or terminology when a source is authoritative, but it will not generate automatic knob positions or claim that a setting is “correct.”

## Safe application rule

The service may use manufacturer material to improve terminology, input-level warnings, and reversible experiments. It must not turn a manual into an automatic hardware control path, suggest connecting speaker outputs to interface inputs, redistribute proprietary IR/model files, or present one pedal/amp’s reference range as a universal target. Future controlled sweeps or harmonic-distortion fixtures require an explicit line/DI safety profile and a human-reviewed test procedure.

## 한국어 요약

GCC-PHAT은 지연 후보 탐색에 적용했고, 최종 confidence는 normalized correlation으로 다시 계산합니다. 브라우저 render quantum 누락과 실제 track 설정 불일치는 숨기지 않고 로그·UI에 표시합니다. ITU-R/AES17 전체 준수나 Farina sweep 기반 앰프 측정은 아직 주장하지 않습니다. Focusrite·Universal Audio·BOSS 자료는 용어·입력 레벨·안전 경고와 되돌릴 수 있는 실험을 개선하는 근거로만 사용하며, 자동 노브 설정·speaker output 연결·비공개 모델 파일 처리는 범위에서 제외합니다.
