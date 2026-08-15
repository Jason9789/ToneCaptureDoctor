# ToneCaptureDoctor

기타·베이스 연주자를 위한 **로컬 우선 신호 건강검진·톤 비교·캡처 검증 도구**입니다.

ToneCaptureDoctor는 “좋은 톤/나쁜 톤”을 임의로 판정하는 앱이 아닙니다. 오디오 인터페이스, 실물 페달, 멀티 이펙터, 플러그인, 앰프/캐비넷, NAM 캡처 전후의 신호를 측정하고, 사용자가 저장한 기준 톤과 비교하고, 다음에 확인할 실험을 설명합니다.

> 기타/베이스를 연결하고, 신호가 정상인지 확인하고, 톤을 저장·비교하고, 문제가 생겼을 때 다음 행동을 이해하게 하는 오픈소스 도구.

## 프로젝트 상태

현재는 설계 단계입니다. 첫 공개 버전의 범위는 다음 하나입니다.

> **Signal Health:** 기타/베이스 → 오디오 인터페이스 입력의 파형·스펙트럼·레벨·클리핑·노이즈를 확인하고 스냅샷으로 저장한다.

톤 비교, dry/wet 비교, NAM Capture Check는 Signal Health가 실제 장비에서 안정적으로 동작한 뒤에 추가합니다.

이 순서를 지키지 않고 처음부터 AI 톤 추천, 모든 DAW 루프백, 모든 이펙터 자동 인식까지 구현하려 하면 프로젝트가 실패할 가능성이 높습니다.

AI와 함께 개발할 때는 [AI_HARNESS.md](./AI_HARNESS.md)를 먼저 읽습니다. 이 문서는 다른 작업 컴퓨터에서 README와 PLAN을 로드하고, 한 번에 하나의 이슈만 구현하고, 자동 테스트와 실제 장비 테스트를 분리하고, 사람의 Gate 확인 후에만 다음 Phase로 넘어가기 위한 작업 계약입니다.

## Quick Start — GitHub에서 내려받아 실행하기

현재 저장소의 첫 실행 대상은 `web` PWA입니다. 정식 desktop installer와 Chrome extension은 해당 phase의 gate를 통과한 뒤 별도 release로 배포합니다.

### 필요한 것

- macOS 또는 Windows
- Node.js 24 LTS
- npm 11.x
- Chrome 또는 Edge 권장
- 기타/베이스와 오디오 인터페이스
- 브라우저의 오디오 입력 권한

### macOS·Linux 터미널

```bash
git clone https://github.com/<owner>/tone-capture-doctor.git
cd tone-capture-doctor

# package-lock.json 기준으로 의존성을 설치한다.
npm ci

# 개발 서버를 실행한다.
npm run dev
```

### Windows PowerShell

```powershell
git clone https://github.com/<owner>/tone-capture-doctor.git
Set-Location tone-capture-doctor

npm ci
npm run dev
```

터미널에 표시된 `http://localhost:<port>` 주소를 브라우저에서 엽니다. `Start`를 클릭한 뒤 마이크 권한을 허용하고, 오디오 인터페이스의 instrument/Hi-Z 입력 채널을 선택합니다. 브라우저에서 입력 장치가 보이지 않으면 운영체제의 마이크 권한과 인터페이스 전용 드라이버/펌웨어를 먼저 확인합니다.

### 개발자 검증 명령

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run preview
```

`npm ci`는 lockfile이 없는 상태에서 사용하지 않습니다. 의존성을 변경할 때는 `npm install` 후 `package-lock.json`을 함께 커밋하고, CI와 다른 사람의 환경에서는 `npm ci`를 사용합니다.

### 처음 실행할 때의 안전한 연결

```text
기타/베이스 → 인터페이스 instrument/Hi-Z input → ToneCaptureDoctor
```

실물 페달을 비교할 때만 다음처럼 두 입력을 사용합니다.

```text
dry: 기타/DI → Input 1
wet: 기타/DI → 페달 → Input 2
```

진공관 앰프의 speaker output은 인터페이스에 직접 연결하지 않습니다. 마이크·load box·DI 등 제조사가 허용한 경로를 사용합니다.

### 문제 해결에 필요한 정보

실행이 실패하면 다음을 함께 기록합니다.

```bash
node --version
npm --version
```

- OS와 버전
- 브라우저와 버전
- 인터페이스 모델·펌웨어·드라이버
- 샘플레이트·버퍼·선택한 채널
- 연결 경로와 기타/베이스·픽업
- 브라우저 콘솔 오류
- 개인정보를 제거한 `.tonecheck` 파일 또는 synthetic fixture

오디오 원본과 API key를 GitHub issue에 업로드하지 않습니다. 초기 웹 버전은 서버에 오디오를 업로드하지 않는 것을 목표로 합니다.

### 정식 release가 아직 없는 경우

`Signal Health` PWA가 1.0 gate를 통과하기 전에는 GitHub의 소스 실행만 지원합니다. `npm run desktop`이나 설치 프로그램이 없다고 해서 오류가 아닙니다. Tauri desktop과 Chrome extension은 README의 phase와 release tag가 별도로 생성된 뒤 안내합니다.

## 핵심 모드

| 모드 | 목적 | 1.0 포함 여부 |
|---|---|---:|
| `Signal Health` | 입력 장치, 채널, 레벨, 클리핑, 노이즈, 험 점검 | 필수 |
| `Tone Compare` | Snapshot A/B와 사용자 기준 톤 비교 | 필수 |
| `Dry/Wet Doctor` | 실물 페달·멀티 이펙터 전후 비교 | 1.0 후반 |
| `Capture Check` | NAM 등 캡처 전후 데이터 검증 | 1.0 후반 |
| `Pick Coach` | 피킹 어택·일관성·타이밍 분석 | 후속 |

## 지원하려는 연결

### 기본 입력

```text
기타/베이스 → 오디오 인터페이스 → ToneCaptureDoctor
```

### 실물 이펙터 dry/wet

```text
기타 → 인터페이스 Input 1 (dry DI)
기타/DI → 페달 → 인터페이스 Input 2 (wet return)
```

### 멀티 이펙터

- USB 오디오 장치로 연결
- 아날로그 출력은 인터페이스 line input으로 연결
- stereo 출력은 좌우 채널을 별도 분석

### 플러그인/DAW

초기에는 WAV/FLAC export 또는 오디오 인터페이스 loopback으로 지원합니다. 브라우저가 모든 DAW의 시스템 출력을 자동으로 읽는다고 약속하지 않습니다. 안정적인 DAW 연동은 후속 데스크톱 오디오 브리지 또는 VST3/AU companion plugin의 범위입니다.

### 앰프와 NAM

앰프 speaker output을 오디오 인터페이스에 직접 연결하지 않습니다. 마이크, load box, DI 또는 제조사가 허용한 안전한 출력 경로를 사용해야 합니다. `Capture Check`는 NAM만을 위한 독립 제품이 아니라 전체 분석 도구의 한 모드입니다.

## 무엇을 측정하는가

### 시간 영역

- 실시간 waveform
- peak/RMS
- attack/onset
- sustain/decay
- clipping(flat-top) 후보
- 피킹 반복 간 변동성

### 주파수 영역

- log-frequency spectrum
- spectrogram
- fundamental/harmonic 후보
- 대역별 에너지 차이
- 50/60Hz 험과 배음
- noise floor

### 비교

- Snapshot A/B
- onset 정렬
- 음량 보정 후 비교
- 사용자 기준 톤과의 상대 차이
- dry/wet gain, latency, dynamics 차이

Waveform 하나만으로 톤을 판단하지 않습니다. 파형은 시간 변화를, spectrum은 배음과 주파수 분포를, spectrogram은 그 변화가 시간에 따라 어떻게 달라지는지를 보여줍니다.

## 스냅샷 원칙

스냅샷은 화면 이미지가 아니라 재현 가능한 분석 세션입니다.

저장해야 하는 값:

- 짧은 원본 오디오 클립
- 파형·스펙트럼 분석 결과
- 입력 장치·채널·샘플레이트·채널 수
- FFT 크기·window·평균화·스무딩 설정
- peak·RMS·noise floor·clipping 상태
- dry/wet 라벨과 사용자 메모
- onset 정렬과 음량 보정 정보
- 앱 버전·분석 알고리즘 버전·세션 스키마 버전

수동 연주는 매번 달라지므로 동일 음 또는 리프를 3~5회 측정하고 중앙값과 변동폭을 보여줍니다.

## 조언의 한계

이 프로젝트는 “Bass를 3 올리세요” 같은 근거 없는 장비별 노브 지시를 하지 않습니다.

예시:

> “기준 톤보다 180~300Hz가 3dB 높습니다. 먼저 넓게 1~2dB 줄인 뒤 같은 리프를 다시 측정하세요. 원인은 EQ뿐 아니라 픽업, 캐비넷, 마이크, 방 공진일 수 있습니다.”

모든 기타·베이스·픽업·튜닝·케이블·인터페이스·앰프·캐비넷에 통하는 하나의 정상 스펙트럼은 없습니다. 앱은 다음 세 가지를 분리합니다.

1. **안전 기준:** 입력 없음, clipping, 과도한 noise, 험, 비정상 채널 불균형
2. **사용자 기준:** `My Clean Bass`, `Pedal On`, `NAM DI` 등 사용자가 저장한 레퍼런스
3. **해석 휴리스틱:** 대략적인 대역 설명과 가능한 원인

## 기술 스택

버전은 `package-lock.json`과 CI에서 고정합니다. 문서에 `latest`를 의존성 버전으로 사용하지 않습니다.

| 영역 | 선택 | 이유 |
|---|---|---|
| 런타임 | Node.js 24 LTS | 현재 Active/Maintenance LTS를 사용하고 Current 릴리스는 사용하지 않음 |
| 패키지 | npm 11 + npm workspaces | 사용자와 AI가 추가 도구 없이 시작하기 쉬움 |
| 언어 | TypeScript 5.9, `strict: true` | UI·분석 데이터 구조를 하나의 타입으로 공유 |
| UI | React 19.2 | 생태계·접근성·Chrome extension 재사용 |
| 빌드 | Vite 8.x | 빠른 개발 서버와 정적 빌드 |
| PWA | `vite-plugin-pwa` | manifest와 service worker 생성 |
| 오디오 입력 | Web Audio API `getUserMedia()` | 브라우저·PWA 공통 입력 경로 |
| 실시간 DSP | `AudioWorklet` | UI 스레드와 오디오 처리를 분리 |
| 고성능 DSP | 후속 WebAssembly | 프로파일링 결과가 필요할 때만 도입 |
| 시각화 | Canvas 2D + 접근 가능한 HTML 수치 | 차트 라이브러리 종속과 렌더링 비용 최소화 |
| 로컬 저장 | IndexedDB(`idb`) | 오디오·세션을 서버 없이 저장 |
| 세션 파일 | JSON 메타데이터 + WAV/FLAC 자산, 후속 `.tonecheck` archive | 재현성과 이식성 |
| 스타일 | CSS Modules/일반 CSS 변수 | UI 프레임워크 종속 최소화 |
| 테스트 | Vitest, Testing Library, Playwright | DSP 단위·UI·브라우저 흐름 분리 |
| 린트/포맷 | ESLint, Prettier | 자동 수정과 CI 차단 기준 통일 |
| 데스크톱 | Tauri 2.11.x 후속 도입 | 동일 웹 UI를 macOS·Windows shell로 재사용 |
| 네이티브 오디오 | Rust stable + 선택적 `cpal` bridge | 브라우저 한계가 확인된 뒤에만 추가 |
| 확장 | Chrome Manifest V3 | PWA와 공통 UI/분석 모듈 재사용 |
| CI/CD | GitHub Actions | 테스트, 정적 배포, 릴리스 artifact 자동화 |
| 정적 호스팅 | GitHub Pages(데모) 또는 Cloudflare Pages(운영) | 서버 없이 HTTPS 제공 |

현재 Node.js LTS와 Vite·React·Tauri 릴리스는 출시 시점에 다시 확인해야 합니다. 버전 번호보다 `package-lock.json`, `.nvmrc`, `rust-toolchain.toml`을 신뢰합니다.

## 저장소 구조

```text
tone-capture-doctor/
├─ apps/
│  ├─ web/                 # 정식 PWA
│  ├─ desktop/             # Phase 10 이후 Tauri
│  └─ extension/           # Phase 11 이후 Chrome MV3
├─ packages/
│  ├─ audio-core/          # 입력, frame, peak, RMS, FFT
│  ├─ analysis-rules/      # 측정값 → 가능한 원인/실험
│  ├─ glossary/            # dBFS·Hz·RMS·FFT 설명
│  ├─ session-format/      # snapshot과 .tonecheck schema
│  └─ ui/                  # 공통 UI·접근성 컴포넌트
├─ fixtures/
│  ├─ synthetic/           # sine, noise, hum, clipping, impulse
│  └─ field/               # 권리 확인된 기타/베이스 WAV
├─ docs/
│  ├─ routing/             # 장비 연결법
│  ├─ safety/              # speaker/load-box 안전
│  ├─ adr/                 # Architecture Decision Records
│  └─ testing/             # 수동 테스트 체크리스트
├─ README.md
├─ PLAN.md
├─ LICENSE
├─ CONTRIBUTING.md
├─ CODE_OF_CONDUCT.md
├─ SECURITY.md
├─ PRIVACY.md
├─ CHANGELOG.md
├─ package.json
├─ package-lock.json
├─ .nvmrc
└─ rust-toolchain.toml
```

## 로컬 우선·서버리스

기본 동작에서 오디오는 서버로 전송하지 않습니다.

- 서버는 정적 HTML/CSS/JS와 문서만 제공
- 실시간 분석은 브라우저/데스크톱에서 수행
- 세션은 IndexedDB와 사용자가 내보낸 파일에 저장
- 계정·로그인·클라우드 동기화는 MVP에 없음
- 분석 telemetry는 opt-in이며 오디오 원본을 수집하지 않음
- AI 분석 API는 초기 범위에 없음

`getUserMedia()`는 HTTPS 또는 localhost에서만 동작하며 사용자 권한이 필요합니다. Chrome extension의 MV3 service worker는 DOM을 사용할 수 없으므로 오디오 처리에는 extension page 또는 `chrome.offscreen`의 `USER_MEDIA` 문서가 필요합니다. Extension은 탭 오디오와 실제 오디오 인터페이스 입력을 같은 것으로 취급하지 않습니다.

## 운영 규칙

이 프로젝트의 모든 구현자는 다음을 지킵니다.

1. 작업 전에 `README.md`와 해당 `PLAN.md` phase를 읽는다.
2. 한 번에 하나의 작은 이슈만 작업한다.
3. 코드 변경에는 테스트와 변경 이유를 함께 추가한다.
4. DSP 결과를 바꾸면 synthetic fixture와 회귀 테스트를 갱신한다.
5. 새로운 라이브러리나 OS API는 ADR을 먼저 작성한다.
6. 사용자의 원본 오디오나 키를 커밋하지 않는다.
7. 테스트를 실행하지 못했으면 완료라고 보고하지 않는다.
8. `git reset --hard`, 무분별한 파일 삭제, 의존성 전체 업그레이드를 하지 않는다.
9. 측정 불확실성이 있는 결과를 “정답”으로 표현하지 않는다.
10. 안전하지 않은 앰프 연결을 예시로 작성하지 않는다.

## 라이선스 방향

- 소스 코드: MIT 권장
- 문서: CC BY 4.0 권장
- 합성 fixture: CC0 또는 저장소가 명시한 permissive license
- 제3자 오디오·IR·앰프 impulse·브랜드 이미지: 권리 확인 전 포함하지 않음
- MIT는 상표권을 부여하지 않으므로 `ToneCaptureDoctor` 이름과 로고는 별도로 관리
- 모든 의존성은 CI에서 라이선스 검사

라이선스 선택은 법률 자문이 아닙니다. 상용화나 회사 자산을 포함할 때는 실제 권리자와 법률 전문가의 검토가 필요합니다.

## 기여와 이슈

Issue는 다음 타입 중 하나로 등록합니다.

- `bug`: 재현 절차가 있는 결함
- `audio-fixture`: 특정 입력의 분석 오류
- `device-compatibility`: 인터페이스·OS·브라우저 조합 문제
- `feature`: PLAN에 있는 기능
- `docs`: 연결·사전·테스트 문서
- `security/privacy`: 데이터·권한·배포 문제

재현되지 않는 “톤이 이상하다”는 이슈는 먼저 장치·샘플레이트·채널·입력 파일·스냅샷을 요청합니다.

## 정식 출시 조건

정식 1.0은 기능이 많아서가 아니라 다음을 통과했을 때입니다.

- P0/P1 버그 0개
- 합성 신호와 저장/불러오기 회귀 테스트 100% 통과
- 지원 브라우저와 최소 macOS·Windows 조합에서 30분 연속 입력 테스트 통과
- 오디오가 서버로 전송되지 않음을 네트워크 테스트로 확인
- 권한 거부·장치 분리·샘플레이트 변경·무신호 상태를 사용자에게 설명
- 공개 베타에서 서로 다른 인터페이스 3종 이상과 기타/베이스 양쪽 테스트
- 안전 문서·개인정보 정책·라이선스·변경 로그·문제 해결 문서 준비
- PWA 배포 artifact와 소스 tag가 재현 가능

구체적인 phase별 gate와 수동 테스트 절차는 [`PLAN.md`](./PLAN.md)에 있습니다.

## 출처

- [MDN — getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN — AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet)
- [Vite PWA Guide](https://vite-pwa-org.netlify.app/guide/)
- [Node.js Releases](https://nodejs.org/en/about/previous-releases)
- [Vite Releases](https://vite.dev/releases)
- [React Versions](https://react.dev/versions)
- [Tauri Frontend Configuration](https://v2.tauri.app/start/frontend/)
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [Chrome User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Apple — Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Microsoft — Choose a distribution path](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path)

## 상태

설계 단계. 구현은 `PLAN.md`의 Phase 0부터 순서대로 진행합니다.
