# Dry/Wet interface routing

This document describes the safe, local-only routing expected by Dry/Wet Doctor. The app measures two input channels in the browser; it does not send audio to a server.

## Safe baseline

```text
Instrument → interface Input 1 (dry)
Instrument/DI → pedal or processor → interface Input 2 (wet)
```

Use instrument/Hi-Z or line inputs according to the interface and pedal manufacturer’s instructions. Keep the monitoring path muted or use headphones while checking levels.

Never connect a tube-amplifier speaker output directly to an interface input. Use a microphone, a suitable DI/load box, or another manufacturer-approved attenuated path. A damaged interface or unsafe amplifier connection is outside the scope of this app.

Interface levels are not interchangeable: review the manufacturer’s [instrument/line/mic/speaker
level guidance](https://support.focusrite.com/hc/de/articles/115004171025-What-are-the-differences-between-mic-line-and-instrument-level)
and the specific input documentation. In particular, [Focusrite’s XLR guidance](https://support.focusrite.com/hc/en-gb/articles/207546295-What-can-I-connect-to-the-XLR-Input-on-my-Interface)
warns against treating line/instrument outputs or phantom power as microphone-input equivalents.
[Universal Audio’s line-level guidance](https://help.uaudio.com/hc/en-us/articles/206020656-Springing-Forward-With-UA-Hardware)
also recommends line-output to line-input routing and avoiding a line output into a mic preamp.

Before any powered-amp experiment, confirm the exact amplifier, load box/attenuator, impedance,
power rating, cooling, and termination procedure in the manufacturer manual. Do not use this app’s
measurements as a substitute for a connected speaker/load, and keep phantom power off unless the
manufacturer explicitly requires a compatible microphone path.

## 한국어

Dry/Wet Doctor는 브라우저 안에서 인터페이스의 두 입력 채널을 측정합니다. 오디오를 서버로 전송하지 않습니다.

```text
악기 → 인터페이스 Input 1 (dry)
악기/DI → 페달 또는 프로세서 → 인터페이스 Input 2 (wet)
```

인터페이스와 페달 제조사가 안내한 instrument/Hi-Z 또는 line 입력을 사용하세요. 레벨을 확인할 때는 모니터 경로를 음소거하거나 헤드폰을 사용하세요.

진공관 앰프의 speaker output을 인터페이스 입력에 직접 연결하지 마세요. 마이크, 적합한 DI/load box 또는 제조사가 승인한 감쇠 경로를 사용해야 합니다. 장비 손상이나 위험한 앰프 연결은 이 앱의 범위가 아닙니다.

인터페이스의 instrument/line/mic/speaker 레벨은 서로 바꿔 사용할 수 없습니다. 제조사의
[레벨 안내](https://support.focusrite.com/hc/de/articles/115004171025-What-are-the-differences-between-mic-line-and-instrument-level)와
정확한 입력 설명서를 확인하세요. [Focusrite XLR 안내](https://support.focusrite.com/hc/en-gb/articles/207546295-What-can-I-connect-to-the-XLR-Input-on-my-Interface)는
line/instrument output이나 phantom power를 microphone input과 같은 것으로 취급하지 말라고
경고합니다. [Universal Audio line-level 안내](https://help.uaudio.com/hc/en-us/articles/206020656-Springing-Forward-With-UA-Hardware)도
line output은 line input으로 보내고 line output을 mic preamp에 연결하지 않도록 안내합니다.

전원이 필요한 앰프 실험 전에는 정확한 앰프, load box/attenuator, impedance, 정격 출력,
냉각, termination 절차를 제조사 설명서로 확인하세요. 이 앱의 측정값은 연결된 speaker/load를
대체하지 않으며, 제조사가 호환 microphone 경로를 명시하지 않았다면 phantom power를 끄세요.

`gcc-phat` 지연 후보는 timing 보조값입니다. 화면의 confidence는 normalized time-domain
correlation으로 다시 계산하며, 반복 프레임의 median과 MAD를 함께 봅니다. `레벨 보정 잔차`는
각 대역 차이에서 RMS gain 차이를 뺀 뒤 남는 근거일 뿐, 페달이나 앰프가 원인이라고 증명하지
않습니다.

## Evidence interpretation

- A latency value marked `measured` has a strong normalized cross-correlation candidate within the configured search window.
- A value marked `estimated` is directional evidence and should be repeated with the same playing passage and matched level.
- `mono-like` means the selected channels are highly correlated at zero lag; verify that the two inputs are not receiving the same source unintentionally.
- A channel-swap message is a candidate warning, not a definitive wiring diagnosis.
- A no-signal message refers to the app’s dBFS threshold, not acoustic silence or dB SPL.
- A `gcc-phat` lag candidate is a timing aid; the displayed confidence is recomputed with normalized
  time-domain correlation. Repeated frames are summarized with a median and MAD, so a single stable
  looking frame is not enough to establish a hardware diagnosis.
- “Level-matched residual” subtracts the RMS gain difference from each band delta. It is evidence
  that remains after loudness matching, not proof that a pedal or amplifier caused the difference.
