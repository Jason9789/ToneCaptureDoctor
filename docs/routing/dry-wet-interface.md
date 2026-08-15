# Dry/Wet interface routing

This document describes the safe, local-only routing expected by Dry/Wet Doctor. The app measures two input channels in the browser; it does not send audio to a server.

## Safe baseline

```text
Instrument → interface Input 1 (dry)
Instrument/DI → pedal or processor → interface Input 2 (wet)
```

Use instrument/Hi-Z or line inputs according to the interface and pedal manufacturer’s instructions. Keep the monitoring path muted or use headphones while checking levels.

Never connect a tube-amplifier speaker output directly to an interface input. Use a microphone, a suitable DI/load box, or another manufacturer-approved attenuated path. A damaged interface or unsafe amplifier connection is outside the scope of this app.

## 한국어

Dry/Wet Doctor는 브라우저 안에서 인터페이스의 두 입력 채널을 측정합니다. 오디오를 서버로 전송하지 않습니다.

```text
악기 → 인터페이스 Input 1 (dry)
악기/DI → 페달 또는 프로세서 → 인터페이스 Input 2 (wet)
```

인터페이스와 페달 제조사가 안내한 instrument/Hi-Z 또는 line 입력을 사용하세요. 레벨을 확인할 때는 모니터 경로를 음소거하거나 헤드폰을 사용하세요.

진공관 앰프의 speaker output을 인터페이스 입력에 직접 연결하지 마세요. 마이크, 적합한 DI/load box 또는 제조사가 승인한 감쇠 경로를 사용해야 합니다. 장비 손상이나 위험한 앰프 연결은 이 앱의 범위가 아닙니다.

## Evidence interpretation

- A latency value marked `measured` has a strong normalized cross-correlation candidate within the configured search window.
- A value marked `estimated` is directional evidence and should be repeated with the same playing passage and matched level.
- `mono-like` means the selected channels are highly correlated at zero lag; verify that the two inputs are not receiving the same source unintentionally.
- A channel-swap message is a candidate warning, not a definitive wiring diagnosis.
- A no-signal message refers to the app’s dBFS threshold, not acoustic silence or dB SPL.
