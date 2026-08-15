# Phase 6 Tone Compare — 2026-08-15

## 작업

- 브랜치: `develop`
- 범위: Snapshot A/B 비교 엔진과 초기 UI
- 실제 오디오 인터페이스: 미연결
- 서버 업로드: 없음

## 구현

- `packages/audio-core/src/compare.ts`
  - loudness normalization과 normalization gain 기록
  - normalized cross-correlation 기반 onset alignment
  - waveform RMS delta
  - normalized spectrum mean absolute delta
  - sub-low/low-mid/mid/high-mid/high frequency-band delta
  - noise-floor와 dominant-frequency 차이
  - clipping 후보 사실 보존
  - low/medium/high difference confidence
  - 여러 take의 median/variance summary
- `apps/web/src/App.tsx`
  - 저장된 Snapshot 2개 선택
  - 측정 사실, 가능한 해석, confidence, 대역별 delta 표시
  - “좋은 톤” 단일 점수나 단정적인 장비 조언을 표시하지 않음
- `apps/web/src/i18n.ts` / `styles.css`
  - Tone Compare 한국어/영어 UI

## 자동 검증

- compare synthetic fixture 5개: PASS
  - gain-only difference
  - low-mid spectrum change
  - delayed take alignment
  - clipping/noise-floor confidence
  - repeated-take median/variance
- App snapshot compare integration test: PASS
- audio-core tests: 10 passed
- web tests: 16 passed
- `npm run format:check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS

## 해석 경계

- Snapshot에 저장된 downsampled waveform/spectrum을 비교한다.
- frequency-band delta는 측정된 상대 차이이며 원인이나 품질 판정이 아니다.
- clipping 후보가 있거나 alignment correlation이 약하면 confidence를 낮춘다.
- 실제 연주 변동성, pickup, routing, OS/browser 장치 처리는 수동 검증 전까지 확정하지 않는다.

## 남은 검증

- 같은 riff의 bypass/on Snapshot 5회씩 비교
- gain match 전후 결과가 달라지는지 확인
- 약한/강한 피킹이 effect 차이로 과장되지 않는지 확인
- 실제 인터페이스에서 48kHz mono/stereo Snapshot 비교
- UI에서 2분 이내 기준 Snapshot 선택·비교 완료 여부 확인
- 수동 검증 결과를 Phase 5 test log와 함께 보관
