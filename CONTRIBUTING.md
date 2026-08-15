# Contributing to ToneCaptureDoctor

ToneCaptureDoctor는 한 번에 하나의 작은 Phase/이슈를 구현하고, 합성·브라우저 자동 테스트와
실제 장비 검증을 분리한다. 시작하기 전에 `README.md`, `AI_HARNESS.md`, 해당 `PLAN.md` Phase,
그리고 `harness/`의 작업 프롬프트를 읽는다.

## 개발 환경

- Node.js 24.x (`.nvmrc`)
- npm 11.x
- Chrome 또는 Edge (브라우저 smoke test와 수동 장비 테스트)

```bash
npm ci
npm run dev
```

## 검증

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

브라우저가 설치되지 않은 환경에서는 Playwright Chromium을 설치한 뒤 E2E를 실행한다.
실제 오디오 입력·권한·장치 조합은 자동 테스트의 대체물이 아니며, `PLAN.md`의 수동 테스트
기록 형식으로 별도 기록한다.

## 안전·개인정보

- 초기 웹 버전은 오디오 원본을 서버로 업로드하지 않는다.
- 사용자의 원본 오디오, 비밀키, 토큰, 권리 미확인 fixture를 커밋하지 않는다.
- 진공관 앰프의 speaker output을 오디오 인터페이스에 직접 연결하지 않는다.
- 새 의존성, 권한, 네트워크 API, 저장 포맷은 관련 ADR과 테스트 없이 추가하지 않는다.
