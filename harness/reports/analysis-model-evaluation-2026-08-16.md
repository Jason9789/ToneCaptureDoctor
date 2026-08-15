# Analysis model evaluation / 분석 모델 평가

## English

There is no learned ML model in the MVP. The “model” is a versioned deterministic DSP and rule pipeline:

1. `audio-core` computes calibrated time/frequency measurements.
2. `analysis-rules` maps measured observations to possible causes and reversible experiments.
3. Dry/Wet Doctor uses normalized correlation and optional GCC-PHAT lag selection; it does not infer a universal good tone.

The current automated evidence is:

- 31 `audio-core` tests, including calibrated spectrum, clipping, hum/noise fixtures, dry/wet direction, GCC-PHAT delay, gain-only residual cancellation, invalid coordinates, and repeated latency median/MAD.
- 21 web tests, including archive round-trip/checksum rejection, strict snapshot validation, storage error-safe paths, and UI regression coverage.
- 3 Playwright smoke/integration tests, including 320px layout/language behavior, fake input permission flow, and IndexedDB v1 → v2 migration.

This is an engineering reliability result, not a claim of clinical, broadcast, or psychoacoustic validity. Actual interfaces, pedals, amp/load boxes, browser scheduling, clock drift, noise, and user routing remain manual gates. A future learned model would require a licensed dataset, held-out evaluation, calibration, uncertainty reporting, and a separate privacy review before it could be added.

## 한국어

MVP에는 학습된 ML 모델이 없습니다. “모델”은 버전이 기록되는 결정론적 DSP와 규칙 pipeline입니다. `audio-core`가 보정된 시간·주파수 지표를 계산하고, `analysis-rules`가 관찰값을 가능한 원인과 되돌릴 수 있는 실험으로 연결합니다. Dry/Wet Doctor는 normalized correlation과 선택적 GCC-PHAT 지연 후보를 사용할 뿐 보편적인 좋은 톤을 판정하지 않습니다.

자동 검증은 `audio-core` 31개, web 21개, Playwright 통합 3개가 통과했습니다. 이는 공학적 신뢰성 검증이지 임상·방송·정신음향적 타당성의 주장이나 실제 장비 검증의 대체가 아닙니다. 실제 인터페이스·페달·앰프/load box·브라우저 스케줄링·클록 드리프트·노이즈·라우팅은 수동 Gate로 남습니다.
