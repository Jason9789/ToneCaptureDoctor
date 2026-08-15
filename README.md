# ToneCaptureDoctor

Local-first signal health and tone comparison tools for guitar and bass players.

[English](#english) · [한국어](#한국어)

---

## English

ToneCaptureDoctor helps musicians answer a practical question:

> Is the signal reaching my interface correctly, and what should I check next?

It measures an instrument or audio chain, lets you save reproducible snapshots, compares them
with a reference, and explains possible causes without pretending that one “correct tone” exists.
The project is local-first: the initial web app does not upload audio to a server.

### Project status

This repository is in early development. The current MVP foundation is a React/Vite web app with
automated tests and CI. The first local microphone and device-selection flow plus an initial
deterministic measurement engine are now in place; visualization and snapshots remain planned work.

The first product goal is **Signal Health**:

- input device and channel status;
- waveform, spectrum, and level views;
- peak/RMS, dBFS, noise-floor, and clipping-candidate measurements;
- reproducible local snapshots;
- clear next checks instead of unsupported gear-specific knob instructions.

The MVP will be merged to `main` only for a release, after its automated checks, documentation,
safety review, and macOS/Windows device gates pass. Day-to-day integration happens on `develop`;
feature work happens on short-lived branches and is reviewed before merging into `develop`.

### What is in scope

- guitar/bass → audio interface input diagnostics;
- local waveform and frequency analysis;
- reference snapshots and A/B comparison;
- dry/wet comparison after the basic input path is stable;
- export/import of local session data;
- accessible explanations of terms such as dBFS, RMS, FFT, and noise floor.

### What is deliberately out of scope

- an AI tone judge or a universal “good tone” score;
- an amp modeler, NAM player, or DAW replacement;
- automatic setup of every virtual audio driver or DAW routing;
- direct conversion of an unsafe amplifier output;
- cloud accounts, cloud audio storage, or server-side audio analysis in the MVP.

### Quick start

Requirements:

- Node.js 24.x and npm 11.x;
- macOS or Windows for the supported development paths;
- Chrome or Edge recommended for browser testing;
- an audio interface and instrument for later Signal Health testing.

```bash
git clone https://github.com/Jason9789/ToneCaptureDoctor.git
cd ToneCaptureDoctor

npm ci
npm run dev
```

Open the local URL shown by Vite. The Signal Health dashboard requests microphone permission only
after you explicitly choose Start. The current flow keeps the stream local, shows the selected input
and actual track settings, and allows you to stop the session.

For Windows PowerShell:

```powershell
git clone https://github.com/Jason9789/ToneCaptureDoctor.git
Set-Location ToneCaptureDoctor
npm ci
npm run dev
```

### Development commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run preview
```

If Playwright Chromium is not installed locally:

```bash
npx playwright install chromium
```

Use `npm install` only when intentionally changing dependencies. Commit the resulting
`package-lock.json`; use `npm ci` for clean clones and CI.

### Branching and releases

- `develop` is the shared integration branch for reviewed feature work.
- Use a short-lived feature or chore branch, then merge it into `develop` after checks pass.
- `main` is reserved for release commits and is not the day-to-day integration target.
- Do not mark a release ready until the automated checks, safety review, and required real-device
  gates are recorded.

### Safe audio routing

Start with the simplest supported path:

```text
Instrument → interface instrument/Hi-Z input → ToneCaptureDoctor
```

For a later dry/wet comparison:

```text
dry:  instrument/DI → interface Input 1
wet:  instrument/DI → pedal → interface Input 2
```

Never connect a tube amplifier speaker output directly to an interface input. Use a microphone,
load box, DI, or another path explicitly approved by the equipment manufacturer.

### Privacy and local-first design

- The MVP does not upload original audio to a server.
- Real-time analysis runs in the browser; local session storage uses browser storage or exported files.
- Do not commit original recordings, API keys, access tokens, private keys, cookies, or personal data.
- Do not add telemetry, login, cloud sync, or a remote analysis API without a documented design,
  privacy review, and user consent.
- Constraints requested for instrument input must be checked against the actual track settings.

### Roadmap

1. Repository shell, reproducible build, tests, and CI. (complete)
2. UI shell with empty, permission, device, and error states. (in progress)
3. Permission flow and device selection after a user click. (implemented; real-device Gate pending)
4. Deterministic measurement engine with synthetic fixtures. (initial engine implemented; long-run and real-device verification pending)
5. Waveform, spectrum, spectrogram, and snapshots.
6. Tone Compare, rule-based guidance, dry/wet comparison, and local session export.
7. Desktop and extension companions only after browser limitations are demonstrated.

See [`PLAN.md`](./PLAN.md) for acceptance criteria, manual gates, and the current issue order.
Maintainers should also read [`AI_HARNESS.md`](./AI_HARNESS.md) and [`harness/`](./harness/).

### Repository layout

```text
apps/web/          React/Vite web app
packages/          Shared audio, analysis, glossary, session, and UI packages (planned)
fixtures/          Synthetic or rights-cleared test assets (planned)
docs/              Safety, routing, ADR, and testing documentation (planned)
harness/           AI workflow state, prompts, and sanitized verification reports
PLAN.md            Product phases, acceptance criteria, and manual gates
AI_HARNESS.md      AI development and review contract
```

### Contributing

1. Read `README.md`, `AI_HARNESS.md`, and the relevant `PLAN.md` phase.
2. Work on one small issue and one phase at a time.
3. Use `develop` as the integration target; keep `main` for releases.
4. Add or update tests with code changes.
5. Report `PASS`, `FAIL`, or `BLOCKED` with the environment and commands used.
6. Keep real-device tests separate from synthetic and browser automation tests.
7. Do not broaden scope into audio upload, unsafe routing, secrets, or unapproved dependencies.
8. Do not mark a phase gate complete without explicit human verification.

Issues should include the OS, browser, interface, driver/firmware, sample rate, routing, steps,
expected result, actual result, and sanitized evidence. Do not attach private recordings or secrets.

### License

The project is being prepared as open source. The code and documentation license files are part of
the release baseline and will be published before the first public release. Until a license file is
present, do not assume that the repository grants redistribution or commercial-use rights.

### References

- [MDN: `getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet)
- [Vite documentation](https://vite.dev/)
- [React documentation](https://react.dev/)
- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [Playwright documentation](https://playwright.dev/)

---

## 한국어

ToneCaptureDoctor는 기타·베이스 연주자가 다음 질문에 답할 수 있도록 돕는 도구입니다.

> 인터페이스에 신호가 제대로 들어오고 있는가? 다음에 무엇을 확인해야 하는가?

악기 또는 오디오 체인을 측정하고, 재현 가능한 스냅샷을 저장하고, 기준 톤과 비교하고,
하나의 “정답 톤”이 있다고 가장하지 않으면서 가능한 원인과 다음 실험을 설명합니다.
초기 웹 앱은 로컬 우선으로 동작하며 오디오 원본을 서버에 업로드하지 않습니다.

### 프로젝트 상태

이 저장소는 초기 개발 단계입니다. 현재 MVP 기반은 자동 테스트와 CI를 포함한 React/Vite 웹
앱입니다. 첫 로컬 마이크 권한 요청과 장치 선택 흐름, 초기 결정론적 측정 엔진이 구현되었으며,
시각화와 스냅샷은 아직 계획된 작업입니다.

첫 제품 목표는 **Signal Health**입니다.

- 입력 장치와 채널 상태 표시;
- 파형·스펙트럼·레벨 표시;
- peak/RMS, dBFS, noise floor, clipping 후보 측정;
- 재현 가능한 로컬 스냅샷;
- 근거 없는 장비별 노브 지시 대신 다음 확인 방법 안내.

MVP는 자동 검증, 문서, 안전 검토, macOS/Windows 실제 장비 Gate를 통과한 뒤 release 시점에만
`main`에 병합합니다. 일상적인 통합 대상은 `develop`이며, 기능 개발은 짧은 작업 브랜치에서
진행한 뒤 검토 후 `develop`에 병합합니다.

### 포함 범위

- 기타/베이스 → 오디오 인터페이스 입력 진단;
- 로컬 파형·주파수 분석;
- 기준 스냅샷과 A/B 비교;
- 기본 입력 경로가 안정된 뒤 dry/wet 비교;
- 로컬 세션 export/import;
- dBFS, RMS, FFT, noise floor 같은 용어의 접근 가능한 설명.

### 의도적으로 제외하는 범위

- AI 톤 심사 또는 보편적인 “좋은 톤” 점수;
- 앰프 모델러, NAM 플레이어, DAW 대체;
- 모든 가상 오디오 드라이버와 DAW 라우팅 자동 설정;
- 위험한 앰프 출력을 안전한 신호로 자동 변환하는 기능;
- MVP의 클라우드 계정, 클라우드 오디오 저장, 서버 오디오 분석.

### 빠른 시작

필요한 환경:

- Node.js 24.x와 npm 11.x;
- 지원 개발 경로인 macOS 또는 Windows;
- 브라우저 테스트는 Chrome 또는 Edge 권장;
- 이후 Signal Health 테스트를 위한 오디오 인터페이스와 악기.

```bash
git clone https://github.com/Jason9789/ToneCaptureDoctor.git
cd ToneCaptureDoctor

npm ci
npm run dev
```

Vite가 표시한 로컬 주소를 브라우저에서 엽니다. Signal Health 대시보드는 사용자가 Start를
명시적으로 선택한 뒤에만 마이크 권한을 요청합니다. 현재 흐름은 스트림을 로컬에 유지하고,
선택한 입력과 실제 track 설정을 표시하며, 세션을 중지할 수 있습니다.

Windows PowerShell:

```powershell
git clone https://github.com/Jason9789/ToneCaptureDoctor.git
Set-Location ToneCaptureDoctor
npm ci
npm run dev
```

### 개발자 검증 명령

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run preview
```

로컬에 Playwright Chromium이 없으면 다음을 실행합니다.

```bash
npx playwright install chromium
```

의존성을 의도적으로 변경할 때만 `npm install`을 사용합니다. 생성된 `package-lock.json`을
함께 커밋하고, 새 clone과 CI에서는 `npm ci`를 사용합니다.

### 브랜치와 release

- `develop`은 검토가 끝난 기능을 통합하는 공유 브랜치입니다.
- 짧은 feature/chore 브랜치에서 작업하고 검증 후 `develop`에 병합합니다.
- `main`은 release 커밋 전용이며 일상적인 통합 대상이 아닙니다.
- 자동 검증, 안전 검토, 필요한 실제 장비 Gate가 기록되기 전에는 release 후보로 표시하지
  않습니다.

### 안전한 오디오 연결

가장 단순한 지원 경로에서 시작합니다.

```text
악기 → 인터페이스 instrument/Hi-Z input → ToneCaptureDoctor
```

이후 dry/wet 비교 경로:

```text
dry: 악기/DI → 인터페이스 Input 1
wet: 악기/DI → 페달 → 인터페이스 Input 2
```

진공관 앰프의 speaker output을 인터페이스 입력에 직접 연결하지 않습니다. 마이크, load box,
DI 또는 장비 제조사가 명시적으로 허용한 경로를 사용합니다.

### 개인정보와 로컬 우선 설계

- MVP는 원본 오디오를 서버에 업로드하지 않습니다.
- 실시간 분석은 브라우저에서 수행하며 세션은 브라우저 저장소 또는 export 파일에 저장합니다.
- 원본 녹음, API key, access token, private key, 쿠키, 개인정보를 커밋하지 않습니다.
- 문서화·개인정보 검토·사용자 동의 없이 telemetry, 로그인, 클라우드 동기화, 원격 분석 API를
  추가하지 않습니다.
- 악기 입력에 요청한 constraint가 실제 track settings에 적용됐는지 확인해야 합니다.

### 로드맵

1. 저장소 shell, 재현 가능한 빌드, 테스트, CI. (완료)
2. 빈 상태·권한·장치·오류 상태를 포함한 UI shell. (진행 중)
3. 사용자 클릭 이후 권한 요청과 장치 선택. (구현 완료, 실제 장비 Gate 대기)
4. 합성 fixture를 포함한 결정론적 측정 엔진. (초기 엔진 구현, 장시간·실제 장비 검증 대기)
5. 파형·스펙트럼·스펙트로그램·스냅샷.
6. Tone Compare, 규칙 기반 안내, dry/wet 비교, 로컬 세션 export.
7. 브라우저 한계가 확인된 뒤 데스크톱·확장 companion.

수용 조건, 수동 Gate, 현재 이슈 순서는 [`PLAN.md`](./PLAN.md)를 확인합니다. 유지보수자와
AI 작업자는 [`AI_HARNESS.md`](./AI_HARNESS.md)와 [`harness/`](./harness/)도 읽습니다.

### 저장소 구조

```text
apps/web/          React/Vite 웹 앱
packages/          공통 오디오·분석·용어·세션·UI 패키지 (예정)
fixtures/          합성 또는 권리 확인 테스트 자산 (예정)
docs/              안전·라우팅·ADR·테스트 문서 (예정)
harness/           AI 작업 상태·프롬프트·검증 보고서
PLAN.md            제품 Phase·완료 조건·수동 Gate
AI_HARNESS.md      AI 개발과 검토 계약
```

### 기여 방법

1. `README.md`, `AI_HARNESS.md`, 해당 `PLAN.md` Phase를 읽습니다.
2. 한 번에 하나의 작은 이슈와 하나의 Phase만 작업합니다.
3. `develop`을 통합 대상으로 사용하고 `main`은 release 전용으로 유지합니다.
4. 코드 변경과 함께 테스트를 추가하거나 갱신합니다.
5. 실행한 명령과 환경을 포함해 `PASS`, `FAIL`, `BLOCKED`로 보고합니다.
6. 실제 장비 테스트와 합성·브라우저 자동 테스트를 분리합니다.
7. 오디오 업로드, 위험한 라우팅, 비밀정보, 승인되지 않은 의존성으로 범위를 넓히지 않습니다.
8. 사람의 명시적인 확인 없이 Phase Gate를 완료 처리하지 않습니다.

이슈에는 OS, 브라우저, 인터페이스, 드라이버/펌웨어, 샘플레이트, 라우팅, 단계, 기대 결과,
실제 결과, 개인정보가 제거된 증거를 포함합니다. 개인 녹음과 비밀정보는 첨부하지 않습니다.

### 라이선스

이 프로젝트는 오픈소스 공개를 준비 중입니다. 코드와 문서 라이선스 파일은 첫 공개 release
기준선에 포함해 게시할 예정입니다. 라이선스 파일이 추가되기 전에는 저장소가 재배포 또는
상업적 사용 권리를 부여한다고 가정하지 마세요.

### 참고 문서

- [MDN: `getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet)
- [Vite 문서](https://vite.dev/)
- [React 문서](https://react.dev/)
- [Node.js release](https://nodejs.org/en/about/previous-releases)
- [Playwright 문서](https://playwright.dev/)
