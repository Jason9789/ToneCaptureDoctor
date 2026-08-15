# ToneCaptureDoctor 개발 계획

이 문서는 README를 읽은 AI 또는 개발자가 **추가 설명 없이 작업을 시작할 수 있도록** 작성한 실행 계획이다. 기능 목록이 아니라, 범위·순서·검증·출시 판정을 포함한 프로젝트 운영 계약이다.

> 현재 날짜 기준: 2026-08-14
>
> 이 문서의 정책·버전·스토어 요구사항은 출시 직전에 공식 문서로 다시 확인한다.

## 0. 이 문서를 읽는 순서

1. `README.md`의 제품 정의와 비목표를 읽는다.
2. `AI_HARNESS.md`의 문서 로딩 순서, 작업 경계, 테스트·Gate 규칙을 읽는다.
3. 이 `PLAN.md`의 현재 phase와 gate를 읽는다.
4. 작업할 이슈의 `입력`, `출력`, `테스트`, `완료 조건`만 구현한다.
5. 범위를 넓히고 싶으면 코드부터 작성하지 말고 ADR 또는 이슈를 추가한다.
6. 모든 테스트를 실행하고 결과를 남긴 뒤에만 완료라고 보고한다.

`PLAN.md`는 한 번에 자동 실행하는 스크립트가 아니다. `AI_HARNESS.md`의 상태 머신에 따라 한 번에 하나의 이슈를 수행하고, 사람의 실제 장비 테스트와 Gate 승인이 끝난 뒤에만 다음 Phase로 이동한다.

## 1. 가장 냉정한 결론

### 반드시 지킬 결정

- 첫 제품은 `Signal Health`다. 기타/베이스 입력이 정상적으로 들어오는지 확인하는 것이 1순위다.
- `Tone Compare`는 Signal Health가 안정된 뒤 추가한다.
- `Dry/Wet Doctor`는 두 채널과 실제 라우팅을 검증한 뒤 추가한다.
- `Capture Check`는 마지막에 NAM과 연결한다.
- 처음부터 AI 톤 추천, 모든 DAW 캡처, 모든 장비 자동 인식, 장비별 노브 자동 설정을 만들지 않는다.
- 기본 분석은 브라우저에서 로컬 실행한다. 오디오 업로드 서버는 만들지 않는다.
- 데스크톱 앱은 웹 MVP가 실패한 지점을 해결할 때만 만든다.
- Chrome 확장프로그램은 메인 제품이 아니라 PWA를 여는 보조 UI다.

### 실패하기 쉬운 잘못된 방향

| 잘못된 접근 | 왜 실패하는가 | 대응 |
|---|---|---|
| 파형을 크게 보여주면 제품이 된다고 생각 | 범용 분석기가 이미 많고 사용자는 무엇을 해야 할지 모름 | “측정 → 가능한 원인 → 다음 실험”을 핵심으로 둠 |
| 주파수 대역마다 고정 정상값을 지정 | 픽업, 튜닝, 연주, 앰프, 캐비넷, 방이 모두 다름 | 안전 한계와 사용자 레퍼런스를 분리 |
| 브라우저가 모든 DAW 출력을 읽는다고 가정 | OS·브라우저·가상 장치별 루프백이 다름 | export/loopback을 먼저 지원하고 native bridge는 후속 |
| 매번 최신 의존성 설치 | AI가 재현되지 않는 코드를 만들고 유지보수가 어려워짐 | Node/패키지/lockfile 고정 |
| 실제 장비 없이 합성 신호만 테스트 | 그래프는 맞아도 장치·권한·노이즈에서 깨짐 | 장비 matrix와 공개 베타를 gate로 지정 |
| 한 번에 macOS·Windows·Chrome extension을 구현 | 권한·패키징·오디오 수명주기가 서로 다름 | PWA → desktop → extension 순서 |
| AI에게 “알아서 전체 기능 구현” 지시 | 범위가 폭발하고 검증이 불가능해짐 | 한 이슈·한 phase·한 acceptance criteria |

## 2. 제품 범위

### 포함 범위

1. 오디오 인터페이스 입력 선택과 권한 상태
2. 실시간 waveform/spectrum/spectrogram
3. peak, RMS, dBFS, noise floor, clipping 후보
4. 50/60Hz 험과 기본 대역 분석
5. 재현 가능한 Snapshot A/B
6. 음량 보정·onset 정렬 후 기준 톤 비교
7. 용어 사전과 측정 근거를 포함한 규칙 기반 조언
8. 실물 페달·멀티 이펙터 dry/wet 비교
9. NAM 캡처 전후의 데이터 검증
10. 로컬 파일 export/import와 서버리스 PWA

### 명시적 비목표

- 앰프 모델이나 이펙터 모델을 학습하지 않음
- NAM 모델 플레이어가 아님
- DAW가 아님
- “좋은 톤”을 객관적 점수로 판정하지 않음
- 스피커 출력을 안전하게 변환하지 않음
- 모든 가상 오디오 드라이버를 자동 설정하지 않음
- 제조사 비공개 장비 프로토콜을 추측해 지원하지 않음
- 기본적으로 계정, 클라우드 저장, 서버 AI 분석을 제공하지 않음

## 3. 기술 기준선

### 버전 정책

출시일이 아닌 현재 기준 권장 기준선이다. 실제 저장소를 초기화하는 날에 공식 릴리스 페이지를 확인하고 lockfile로 고정한다.

| 항목 | 기준 |
|---|---|
| Node.js | 24.x LTS. Current 26.x는 CI 실험용으로만 사용 |
| npm | Node 24에 포함된 npm 11.x |
| React | 19.x |
| TypeScript | 5.9.x 이상, strict |
| Vite | 8.x 지원 릴리스 |
| PWA | `vite-plugin-pwa` 호환 안정 릴리스 |
| 테스트 | Vitest + Testing Library + Playwright |
| Desktop | Tauri 2.11.x 계열을 Phase 8에서 재확인 |
| Rust | `rust-toolchain.toml`로 stable 고정 |
| Extension | Chrome Manifest V3 |
| 패키지 관리 | npm workspaces, `npm ci`만 CI에서 사용 |

버전을 무조건 최신으로 올리지 않는다. 보안 패치 이외의 업그레이드는 별도 이슈와 회귀 테스트가 있어야 한다.

### 아키텍처 원칙

```text
React UI
  ↓ throttled metrics only
Audio session controller
  ↓
AudioWorkletProcessor ── raw frames / metrics
  ↓
Analysis engine ── peak, RMS, FFT, noise, snapshots
  ↓
IndexedDB / local export
```

- React state에 매 오디오 frame을 넣지 않는다.
- `AudioWorklet`은 raw frame을 받고, UI에는 30~60Hz로 요약 metric만 보낸다.
- `AnalyserNode`는 화면 표시용으로만 사용하고, 저장·판정의 권위 있는 값은 analysis engine에서 계산한다.
- 초기에는 샘플레이트를 장치가 반환한 값 그대로 보존한다. 불필요한 resampling을 하지 않는다.
- MVP 채널은 최대 2개다. 3개 이상의 다채널 분석은 후속이다.
- `echoCancellation`, `noiseSuppression`, `autoGainControl`은 악기 입력에서 기본적으로 false를 요청하고 실제 track settings를 확인한다.
- SharedArrayBuffer/WASM은 프로파일링 근거 없이 도입하지 않는다.
- 모든 분석 결과에는 `algorithmVersion`과 `schemaVersion`을 기록한다.

### 초기 DSP 설정

| 항목 | 기본값 | 변경 조건 |
|---|---:|---|
| 기본 샘플레이트 | 장치 native, 안내는 44.1/48kHz | 96kHz는 성능 테스트 후 |
| FFT | 2048, Hann window | 저역 해상도 요구 시 4096 옵션 |
| FFT hop / 평균 | 1024 samples / 최근 4 periodogram | 실제 장비 CPU profile 후 조정 |
| UI update | 30~60Hz | CPU profile 후 조정 |
| peak meter | sample peak | true peak는 후속 명시 기능 |
| loudness | RMS/short window 우선 | LUFS는 phrase/file 분석에서 추가 |
| 채널 | mono/stereo | 2채널 dry/wet이 MVP 상한 |
| frequency bands | log/1/3-octave 보조 | raw bin을 사용자 판정에 직접 사용하지 않음 |

분석 알고리즘 `0.2.0`의 단위, 시간 좌표, hum/noise 추정, 스냅샷 호환성 계약은
[`docs/analysis-engine.md`](docs/analysis-engine.md)에 기록한다.

## 4. 저장소 초기 구조

```text
tone-capture-doctor/
├─ apps/
│  ├─ web/
│  ├─ desktop/             # Phase 8에서 생성
│  └─ extension/           # Phase 9에서 생성
├─ packages/
│  ├─ audio-core/
│  ├─ analysis-rules/
│  ├─ glossary/
│  ├─ session-format/
│  └─ ui/
├─ fixtures/
│  ├─ synthetic/
│  └─ field/
├─ docs/
│  ├─ adr/
│  ├─ routing/
│  ├─ safety/
│  └─ testing/
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

## 5. 작업 규칙 — AI와 협업하는 방법

이 프로젝트는 AI가 구현을 도와도 사람의 검증 없이 자동으로 merge하지 않는다.

### 모든 작업 시작 시 AI가 출력할 것

```text
Phase: Px / Issue: #xxx
목표:
이번 작업에 포함되는 파일:
이번 작업에서 하지 않는 것:
실행할 테스트:
완료 조건:
차단될 가능성이 있는 사항:
```

### AI에게 금지하는 행동

- PLAN의 다음 phase까지 선행 구현
- 테스트가 실패한 상태에서 “완료” 보고
- 새 라이브러리를 이유 없이 추가
- `latest`를 package.json에 사용
- 실제 오디오를 서버로 전송하는 코드 추가
- 사용자가 이해하지 못하는 단일 점수나 AI 판정 추가
- 안전하지 않은 speaker output 연결 예시 추가
- 기존 세션 포맷을 호환성 계획 없이 변경
- 비밀키·개인 오디오·상용 IR을 저장소에 커밋

### 이슈 완료(Definition of Done)

- 구현이 acceptance criteria를 만족한다.
- 단위/통합 테스트가 추가되거나 기존 fixture가 통과한다.
- 수동 테스트 결과와 환경을 이슈에 남겼다.
- 사용자에게 보이는 문구와 glossary가 업데이트됐다.
- README/CHANGELOG/ADR 중 필요한 문서가 갱신됐다.
- 네트워크·권한·안전 영향이 검토됐다.
- `npm run lint`, `npm run typecheck`, `npm test`, 필요한 Playwright 테스트가 통과했다.

## 6. 테스트 전략

### 테스트 피라미드

1. **단위 테스트:** 순수 DSP, schema, rules
2. **fixture 회귀:** 알려진 sine/noise/hum/clipping 입력
3. **컴포넌트 테스트:** 버튼·권한 상태·빈 상태·오류 상태
4. **브라우저 E2E:** 가짜 media device와 파일 입력
5. **수동 장비 테스트:** 실제 인터페이스·페달·OS·브라우저
6. **공개 베타:** 낯선 사용자의 연결 성공률과 이해도

합성 신호 테스트만으로 출시하지 않는다. 실제 장비 테스트만으로도 출시하지 않는다. 둘 다 필요하다.

### 수동 테스트 기록 형식

```text
Test ID:
Date / tester:
OS + version:
Browser/app + version:
Interface + driver/firmware:
Instrument / pickup / tuning:
Routing:
Steps:
Expected:
Actual:
Evidence: screenshot, exported session, console log
Result: PASS / FAIL / BLOCKED
```

### 결함 등급

- `P0`: 안전, 데이터 유출, 세션 손상, 설치 불가
- `P1`: 핵심 기능 사용 불가, 오디오 오판정, 지속적인 crash/dropout
- `P2`: 우회 방법이 있는 기능 결함
- `P3`: 시각적 문제, 문구, 개선 아이디어

P0/P1이 있으면 다음 phase로 가지 않는다.

## 7. Phase 0 — 제품·안전·권리 기준선

### 목표

코드를 쓰기 전에 프로젝트가 무엇을 하지 않을지 고정한다.

### 산출물

- `docs/adr/0001-product-scope.md`
- `docs/adr/0002-local-first.md`
- `docs/safety/amp-output.md`
- `docs/routing/interface-pedal.md`
- 지원 장비 matrix 초안
- 라이선스와 fixture 권리 표
- 이슈 템플릿

### 결정해야 할 내용

- 이름 `ToneCaptureDoctor`의 상표·도메인·GitHub organization 확인
- 코드 MIT, 문서 CC BY 4.0 등 라이선스 승인
- 실제 장비에서 수집할 오디오의 권리와 공개 여부
- 최소 지원 브라우저와 OS
- 지원하지 않을 장비 유형
- “정상 범위”를 절대값이 아닌 안전/레퍼런스/휴리스틱으로 분리

### 내가 직접 할 테스트

1. 오디오 인터페이스 1개와 기타 또는 베이스를 준비한다.
2. 기타를 인터페이스 instrument input에 연결한다.
3. speaker output을 인터페이스에 연결하지 않는지 확인한다.
4. 실제 연결 그림을 보고 혼자서 안전/위험 경로를 구분한다.
5. README의 제품 설명을 30초 읽고 “무엇을 하는지” 한 문장으로 말한다.

### 공개 테스트

아직 공개하지 않는다. 경험 있는 연주자 또는 오디오 엔지니어 1~2명에게 안전 문구와 범위만 검토받는다.

### Gate

- 제품의 첫 모드가 Signal Health로 고정됨
- speaker/load-box 안전 문서가 있음
- 지원하지 않는 기능 목록이 있음
- fixture 권리와 라이선스 계획이 있음

## 8. Phase 1 — 저장소·빌드·CI 부트스트랩

### 목표

깨끗한 컴퓨터에서 누구나 동일한 명령으로 실행할 수 있게 한다.

### 구현

1. npm workspace 생성
2. Node 24 `.nvmrc` 생성
3. React + TypeScript + Vite web app 생성
4. strict TypeScript 설정
5. ESLint/Prettier/Vitest/Playwright 추가
6. GitHub Actions에서 install, lint, typecheck, test, build 실행
7. `package-lock.json` 커밋
8. `CONTRIBUTING.md`와 개발 명령 작성

### 필수 명령

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

### 내가 직접 할 테스트

- macOS에서 `npm ci` 후 dev 서버 실행
- Windows에서 같은 명령 실행
- Node 24가 아니면 명확한 오류가 나는지 확인
- 새 clone에서 lockfile만으로 설치되는지 확인
- 브라우저에서 placeholder 화면이 뜨는지 확인
- `npm run build` 결과물을 정적 서버에서 열기

### 공개 테스트

공개하지 않는다. CI가 3회 연속 통과한 뒤에만 다음 phase로 간다.

### Gate

- 새 clone에서 10분 안에 개발 화면 실행
- CI green
- 비밀키 없이 build
- macOS/Windows에서 동일한 UI 로드

## 9. Phase 2 — UI shell과 오류 상태

### 목표

오디오가 없어도 제품의 핵심 흐름과 오류 상태를 검증한다.

### 화면

- `Signal Health` dashboard
- 장치 선택 카드
- Signal status 카드
- waveform panel placeholder
- spectrum panel placeholder
- snapshot list
- glossary drawer
- guidance panel

### 반드시 구현할 상태

- 권한 대기
- 권한 거부
- 장치 없음
- 장치 연결됨
- 입력 없음
- clipping 경고
- 브라우저 미지원
- 세션 저장 실패
- offline 상태

### 내가 직접 할 테스트

- 키보드만으로 모든 버튼 사용
- 권한 거부 상태에서 앱이 멈추지 않는지 확인
- 장치를 뽑았다 다시 꽂았을 때 상태가 갱신되는지 확인
- 좁은 화면에서 카드가 겹치지 않는지 확인
- 모든 경고가 색상만으로 전달되지 않는지 확인
- glossary를 열고 닫아도 오디오 상태가 바뀌지 않는지 확인

### 공개 테스트

디자인 리뷰만 2~3명에게 받는다. 실제 오디오 사용자는 아직 받지 않는다.

### Gate

- 핵심 상태가 새로고침 없이 표현됨
- 키보드 접근 가능
- 오류 문구가 해결 행동을 포함함
- UI가 오디오 구현과 독립적으로 테스트됨

## 10. Phase 3 — 오디오 권한과 장치 선택

### 목표

실제 입력을 안전하게 열고, 장치를 선택하고, 중지할 수 있게 한다.

### 구현

1. HTTPS/localhost 조건 확인
2. 사용자 gesture 이후 `getUserMedia({audio})` 요청
3. 권한 승인 후 `enumerateDevices()`
4. device label과 channel 정보를 표시
5. 악기 입력용 constraints 요청
6. start/stop과 장치 변경
7. 장치 제거·권한 거부·NotReadableError 처리
8. 샘플레이트·채널 수 표시

브라우저가 요청한 모든 constraint를 실제로 보장한다고 가정하지 않는다. `MediaStreamTrack.getSettings()`를 표시하고, 적용되지 않은 설정은 알림으로 남긴다.

### 내가 직접 할 테스트

각 환경에서 최소 10회 반복한다.

| 환경 | 장치 |
|---|---|
| macOS Chrome | USB interface |
| macOS Safari | USB interface |
| Windows Chrome | USB interface |
| Windows Edge | USB interface |
| macOS/Windows | built-in microphone, 권한 거부 |

절차:

1. 앱을 처음 연다.
2. Start를 누른다.
3. 권한을 허용한다.
4. 장치 목록에서 인터페이스를 선택한다.
5. 악기를 연주한다.
6. Stop을 누른다.
7. 장치를 분리하고 다시 연결한다.
8. 브라우저 사이트 권한을 거부한 뒤 다시 시도한다.

### 공개 테스트

오디오 인터페이스가 다른 3명에게 private alpha를 배포한다. 질문은 “연결할 수 있었나?” 하나로 시작한다. 사용법을 설명하지 않고 관찰한다.

### Gate

- 지원 브라우저에서 start/stop 성공률 90% 이상
- 권한 거부가 명확함
- 장치 분리 후 page reload 없이 복구하거나 이유를 표시
- 실제 샘플레이트와 채널이 UI와 일치
- 자동 gain/echo cancellation 등 악기 입력에 위험한 처리가 켜져 있지 않음을 확인

## 11. Phase 4 — 결정론적 측정 엔진

### 목표

그래프보다 먼저 신뢰할 수 있는 숫자와 회귀 테스트를 만든다.

### 구현 순서

1. AudioWorklet에서 frame 수집
2. frame timestamp와 sample count 유지
3. sample peak 계산
4. RMS 계산
5. crest factor 계산
6. noise floor window 계산
7. clipping 후보 계산
8. Hann window FFT
9. spectrum band aggregation
10. 50/60Hz 후보 탐지
11. UI로 30~60Hz metrics 전송

### 합성 fixture

- silence
- 440Hz sine
- 82.4Hz low E 기타
- 41.2Hz low E 베이스
- white/pink noise
- 50Hz/60Hz hum + harmonics
- hard clipped sine
- impulse
- amplitude step
- known EQ shelf/notch

### 내가 직접 할 테스트

- 음량이 2배가 되면 RMS가 예상대로 증가하는지 확인
- silence에서 noise가 0으로 오판되지 않는지 확인
- 440Hz가 인접 FFT bin에만 나타나는지 확인
- clipped fixture에서 clipping 경고가 뜨는지 확인
- hum fixture에서 50/60Hz가 구분되는지 확인
- 30분 동안 metrics가 멈추지 않고 UI가 프레임을 잃지 않는지 확인
- 개발자 도구 네트워크에서 오디오 upload가 없는지 확인

### 공개 테스트

공개하지 않는다. synthetic fixture의 expected 범위와 unit test가 먼저다.

### Gate

- 모든 fixture unit test 통과
- 측정값의 단위와 reference가 문서화됨
- UI가 worklet frame마다 재렌더링되지 않음
- 48kHz stereo 30분 실행에서 지속적인 drop-out 없음
- 분석 알고리즘 버전이 결과에 기록됨

## 12. Phase 5 — waveform·spectrum·spectrogram·Snapshot

### 목표

현재 신호를 보고 나중에 동일 조건으로 비교할 수 있게 한다.

### 구현

- Canvas renderer
- log frequency axis
- peak hold와 averaging
- time window 확대/축소
- 선택 구간 재생
- Snapshot 생성/이름/메모
- snapshot list와 삭제 확인
- raw audio clip 저장
- metrics와 analysis settings 저장
- IndexedDB quota 오류 처리

### Snapshot schema 최소 필드

```ts
type Snapshot = {
  id: string;
  schemaVersion: number;
  algorithmVersion: string;
  createdAt: string;
  label: string;
  audioAssetId?: string;
  sampleRate: number;
  channelCount: number;
  inputDeviceLabel?: string;
  startSample: number;
  endSample: number;
  peakDbfs: number;
  rmsDbfs: number;
  noiseFloorDbfs?: number;
  fftSize: number;
  window: "hann";
  notes?: string;
};
```

### 내가 직접 할 테스트

- 같은 입력을 2개 snapshot으로 저장하고 새로고침 후 불러오기
- snapshot 이름과 메모가 유지되는지 확인
- 100개 snapshot을 만들고 UI가 멈추지 않는지 확인
- 저장 공간 부족 상태를 시뮬레이션
- 브라우저 탭을 닫았다 다시 열어도 저장된 snapshot을 확인
- raw clip과 표시된 파형의 구간이 일치하는지 확인
- snapshot 삭제 시 한 번 더 확인하고 복구 불가 안내

### 공개 테스트

5명의 초대 테스터에게 “저장한 톤을 다시 찾고 비교할 수 있는가”만 관찰한다.

### Gate

- snapshot export/import round-trip 통과
- snapshot 100개에서 1초 이내 목록 표시 목표
- 음량·분석 설정을 바꾸어도 원본 metadata가 훼손되지 않음
- browser reload와 offline에서 핵심 snapshot이 보임

## 13. Phase 6 — Tone Compare

### 목표

더 큰 소리가 더 좋은 소리로 보이는 오류를 막고, 사용자의 기준과 상대 차이를 표시한다.

### 구현

1. 기준 snapshot 선택
2. onset alignment
3. loudness normalization
4. waveform overlay
5. averaged spectrum overlay
6. band delta table
7. difference confidence
8. 여러 take의 median/variance
9. “측정 사실”과 “가능한 해석” 분리

### synthetic 비교 테스트

- 같은 신호 + gain 변화: 음량 차이로만 보고해야 함
- 같은 신호 + 200Hz boost: low-mid 차이로 보고해야 함
- 같은 신호 + delay: 정렬 전후를 구분해야 함
- 같은 신호 + clipped output: clipping과 tone difference를 분리해야 함
- 다른 noise floor: 신호 차이와 노이즈 차이를 구분해야 함

### 내가 직접 할 테스트

- 같은 리프를 pedal bypass/on으로 각각 5회 연주
- gain match 전후로 차트가 바뀌는지 확인
- 소리 크기를 모르게 하고 A/B 청취
- Snapshot A/B를 잘못된 라벨로 저장해도 분석이 라벨을 사실로 믿지 않는지 확인
- 약한 피킹과 강한 피킹을 effect 차이로 오판하지 않는지 확인

### 공개 테스트

10명 이내 private beta. 서로 다른 기타·베이스·픽업·페달을 사용한다.

### Gate

- synthetic fixture expected delta 통과
- loudness match가 적용됐다는 사실을 UI에 명시
- 수동 연주 변동성이 effect 차이로 과장되지 않음
- 모든 조언에 근거 metric과 confidence가 있음
- 사용자가 2분 안에 기준 snapshot과 비교를 완료

## 14. Phase 7 — Glossary와 규칙 기반 조언

### 목표

초보자가 숫자를 오해하지 않고 다음 행동을 이해하게 한다.

### 용어 최소 목록

`Hz`, `dB`, `dBFS`, `Peak`, `RMS`, `LUFS`, `FFT`, `window`, `spectrum`, `spectrogram`, `harmonic`, `noise floor`, `clipping`, `crest factor`, `dynamic range`, `latency`, `Hi-Z`, `impedance`.

### Glossary schema

```ts
type GlossaryEntry = {
  id: string;
  term: string;
  shortDefinition: string;
  measuredByThisApp: string;
  notMeasuredByThisApp: string;
  commonCauses: string[];
  safeExperiments: string[];
  warnings?: string[];
  references: string[];
};
```

### Rule schema

```ts
type DiagnosticRule = {
  id: string;
  priority: number;
  condition: Condition;
  observation: string;
  possibleCauses: string[];
  experiments: string[];
  confidence: "low" | "medium" | "high";
  neverClaim: string[];
};
```

### 내가 직접 할 테스트

- 모든 rule이 최소 하나의 synthetic fixture에서 발동
- 발동하지 않아야 하는 fixture에서는 발동하지 않음
- `dBFS` 설명에 dB SPL을 혼동하지 않는 문장이 있음
- “Bass를 올려라”처럼 단정하는 문장이 없음
- 모든 조언에 사용자가 할 수 있는 reversible experiment가 있음
- 조언을 읽고 초보자 3명이 다음 행동을 설명할 수 있음

### 공개 테스트

음향 지식이 적은 5명에게 glossary만 제공하고, 용어를 별도로 설명하지 않는다. 80% 미만이 뜻과 다음 행동을 이해하면 문구를 다시 쓴다.

### Gate

- glossary와 rules에 출처 또는 내부 근거가 있음
- 위험한 연결을 조장하는 rule 0개
- low-confidence 결과를 확정 문장으로 표시하지 않음
- 조언이 tone score 하나로 축약되지 않음

## 15. Phase 8 — Dry/Wet Doctor

### 목표

실물 페달과 멀티 이펙터의 전후 변화를 실제 두 채널에서 분석한다.

### 구현

- Input 1/2 선택
- dry/wet label
- 두 채널 동시 frame timestamp
- cross-correlation 기반 latency 후보
- gain difference
- spectrum/dynamics difference
- channel swap 경고
- mono/stereo 경고
- 안전한 line/instrument routing 문서

### 내가 직접 할 테스트

최소 구성:

```text
기타 → interface Input 1
기타/DI → pedal → interface Input 2
```

1. pedal bypass로 dry/wet가 같은지 확인
2. gain만 바꾸고 주파수 변화로 오판하지 않는지 확인
3. pedal on/off를 같은 리프로 5회 측정
4. cable을 뽑았을 때 무신호 경고 확인
5. 두 채널을 바꿨을 때 channel swap 경고 확인
6. 의도적으로 latency를 추가하고 지연 후보 확인
7. 스피커 출력 연결 안내가 안전 경고를 표시하는지 확인

### 공개 테스트

최소 10명, 서로 다른 인터페이스 3종, 실물 페달 3종, 멀티 이펙터 1종 이상으로 closed beta를 운영한다. 각 테스터는 raw session과 체크리스트를 선택적으로 제공한다.

### Gate

- 실제 dry/wet 비교가 3개 이상의 인터페이스에서 동작
- channel swap과 no-signal을 설명
- latency 수치를 “측정값”과 “추정값”으로 구분
- speaker output 위험을 명확히 차단
- 두 채널이 지원되지 않는 장치에서 명확한 대체 경로 제공

## 16. Phase 9 — `.tonecheck`와 서버리스 PWA

### 목표

세션을 다른 컴퓨터에서 재현하고, 오디오를 업로드하지 않는 배포를 완성한다.

### 파일 포맷

초기에는 JSON + WAV export를 허용한다. 이후 `.tonecheck`는 다음 archive 구조를 사용한다.

```text
session.tonecheck (zip)
├─ manifest.json
├─ snapshots.json
├─ audio/
│  ├─ snapshot-001.wav
│  └─ snapshot-002.wav
└─ reports/
   └─ analysis.json
```

`manifest.json`에는 `schemaVersion`, `appVersion`, `algorithmVersion`, 생성일, 장치 metadata, 파일 checksum을 기록한다.

### PWA 구현

- web manifest
- service worker cache
- offline shell
- install 안내
- 업데이트 알림
- IndexedDB migration
- 저장 공간 오류
- HTTPS 배포

### 내가 직접 할 테스트

- 온라인에서 앱을 한 번 연 뒤 네트워크를 차단
- 새로고침 후 앱 shell과 기존 session이 보이는지 확인
- service worker 업데이트 후 기존 session이 사라지지 않는지 확인
- 다른 컴퓨터에서 `.tonecheck`를 import
- DevTools Network에서 audio POST가 없는지 확인
- 브라우저 저장소 삭제 시 사용자에게 결과를 설명

### 공개 테스트

공개 beta에서 서로 다른 브라우저로 import/export를 테스트한다. 데이터 손실이 발견되면 release candidate를 중지한다.

### Gate

- offline shell 동작
- `.tonecheck` round-trip 통과
- schema migration 테스트 존재
- 오디오 업로드 0건을 확인
- 개인정보 정책과 데이터 삭제 방법 공개

## 17. Phase 10 — Tauri 데스크톱 앱

### 도입 조건

다음 중 하나가 실제 이슈로 재현될 때만 만든다.

- 브라우저에서 특정 OS의 two-channel 입력이 지속적으로 끊김
- DAW/loopback이 PWA에서 현실적으로 불가능
- 브라우저의 permission/device lifecycle로 장시간 세션이 불안정
- 사용자가 파일 접근·자동 업데이트·저지연을 명확히 요구

단순히 “프로그램도 있으면 좋아서” Tauri를 추가하지 않는다.

### 구현

- 기존 `apps/web` build를 Tauri static frontend로 연결
- Rust command는 최소화
- 권한 allowlist/ACL 최소화
- native audio bridge는 별도 package
- 브라우저와 native 결과를 동일 fixture로 비교
- macOS microphone permission 처리
- Windows 장치 오류 처리

### 내가 직접 할 테스트

- macOS Apple Silicon에서 dev/build 실행
- Windows x64에서 dev/build 실행
- 장치 권한 거부·장치 분리·sleep/wake
- 30분 연속 입력과 session 저장
- PWA와 desktop의 동일 fixture 결과 비교
- Tauri가 외부 URL이나 원격 코드를 실행하지 않는지 확인

### 공개 테스트

PWA beta 사용자의 일부에게만 desktop alpha를 제공한다. PWA 기능과 desktop 기능을 동시에 바꾸지 않는다.

### Gate

- desktop이 PWA보다 나빠지지 않는 핵심 흐름 존재
- native bridge가 필요한 이유와 성능 수치가 ADR에 있음
- macOS Developer ID/notarization 테스트 artifact
- Windows signed/MSIX 또는 명시된 unsigned alpha 경고

## 18. Phase 11 — Chrome Manifest V3 확장

### 역할

확장프로그램은 분석 엔진의 주 제품이 아니다.

- PWA 열기
- side panel에서 현재 session 연결
- glossary와 장비 문서 링크
- 사용자가 클릭했을 때만 session 메모 저장
- 필요한 경우 offscreen `USER_MEDIA` 문서에서 오디오 처리 실험

### 금지

- browsing history 수집
- 현재 탭의 콘텐츠를 몰래 업로드
- 원격 JavaScript 실행
- 탭 오디오와 physical interface를 같은 기능으로 광고
- 필요하지 않은 host permission 요구

### 내가 직접 할 테스트

- Chrome fresh profile에 unpacked extension 설치
- 권한 목록이 최소인지 확인
- service worker 종료 후 다시 열어도 상태 복구
- offscreen document 생성·종료
- microphone permission 거부·허용
- 탭 이동·브라우저 재시작 후 extension 오류 없음
- Chrome Web Store privacy disclosure와 실제 동작 일치

### 공개 테스트

Chrome Web Store unlisted 또는 초대 테스터로 먼저 검토한다. extension이 실제 PWA보다 더 많은 권한을 요구하면 공개하지 않는다.

### Gate

- MV3 정책 통과
- 최소 권한
- 개인정보 정책과 store listing 일치
- remote code 0건
- extension이 없어도 PWA 핵심 기능이 동작

## 19. Phase 12 — 공개 beta 운영

### 대상

- 기타 연주자 5명
- 베이스 연주자 5명
- 오디오 인터페이스 3종 이상
- macOS와 Windows 모두
- 실물 페달·멀티 이펙터·파일 분석 사용자 포함

### 테스트 방식

사용자에게 설명 영상을 먼저 주지 않는다. 다음 작업만 준다.

1. 인터페이스를 연결한다.
2. 신호가 정상인지 확인한다.
3. Snapshot A를 저장한다.
4. 이펙터를 켜고 Snapshot B를 저장한다.
5. 무엇이 달라졌는지 말한다.
6. 앱의 다음 실험을 따라 한다.

관찰할 지표:

- 첫 신호까지 걸린 시간
- 권한/장치 선택에서 막힌 비율
- Snapshot A/B 완료율
- 잘못된 연결으로 인한 위험 행동 0건
- 조언을 이해한 비율
- crash/dropout/session loss

### beta 중단 조건

- 안전 관련 오해가 한 번이라도 발생
- 세션 데이터 손실
- 오디오가 의도치 않게 서버로 전송
- 핵심 장치에서 지속적인 drop-out
- 잘못된 조언을 확정 문장으로 표시

## 20. Phase 13 — 정식 1.0 기준

다음 조건을 모두 만족해야 한다.

### 품질

- P0/P1 이슈 0개
- 핵심 unit/fixture/e2e 테스트 green
- 지원 matrix에서 30분 연속 실행 성공
- 장치 분리·권한 거부·무신호·clipping 상태의 UX 확인
- snapshot과 `.tonecheck` round-trip 성공

### 사용자

- 공개 beta 10명 이상
- 기타와 베이스 양쪽에서 성공적인 첫 사용 기록
- 서로 다른 인터페이스 3종 이상
- 첫 실행에서 2분 안에 Signal Health 완료율 80% 이상
- 조언의 confidence와 한계가 이해됨

### 운영

- GitHub Actions CI와 release artifact 재현
- CHANGELOG와 migration guide
- 개인정보 정책, 안전 문서, 라이선스 문서
- 버그 신고 양식과 security 연락처
- 지원 브라우저·OS·장치 목록
- 알려진 제한사항 공개

### 배포

- HTTPS PWA URL
- GitHub Release tag
- 정적 build checksum
- macOS notarized artifact는 지원하기로 한 경우에만 제공
- Windows 서명/MSIX 정책이 실제 배포 방식과 일치
- Chrome extension은 별도 버전과 권한 변경 기록

## 21. 릴리스 순서

```text
0.0.1 internal scaffold
0.1.0-alpha Signal Health self-test
0.2.0-alpha Snapshot
0.3.0-beta Tone Compare
0.4.0-beta Dry/Wet Doctor
0.5.0-beta PWA offline/session
0.9.0-rc public release candidate
1.0.0 stable PWA
1.1.x Tauri desktop (조건 충족 시)
1.2.x Chrome extension (조건 충족 시)
```

각 버전은 기능 이름이 아니라 통과한 gate를 기준으로 태그한다. 계획에 적힌 기능이 있더라도 테스트가 없으면 release에 포함하지 않는다.

## 22. 우선순위

### P0 — 지금 당장

- 제품 범위와 안전 경계
- 저장소 부트스트랩
- Signal Health
- deterministic DSP fixture
- 권한·장치 오류
- 로컬 저장과 개인정보

### P1 — 핵심 가치

- Snapshot A/B
- loudness match
- reference 비교
- glossary
- 규칙 기반 조언
- 실제 dry/wet 테스트

### P2 — 확장

- PWA offline 완성
- Tauri desktop
- 장비 프로필
- Capture Check

### P3 — 나중에

- Chrome extension 고급 기능
- VST3/AU companion
- Pick Coach
- WASM 최적화
- opt-in 커뮤니티 데이터
- AI 요약

## 23. 지금 추가로 검토할 목록

출시 전에 다음을 스스로 결정하지 못하면 코딩을 시작해도 다시 갈아엎게 된다.

### 제품

- 첫 사용자는 홈레코딩 입문자인가, NAM 캡처 제작자인가?
- 1.0에서 반드시 해결할 단 하나의 문제는 무엇인가?
- 사용자가 실제로 연결할 인터페이스 모델 3종은 무엇인가?
- “톤이 부족하다”를 volume, distortion, sustain, EQ 중 어떻게 구분할 것인가?

### 기술

- 브라우저가 지원해야 할 최소 OS/브라우저 조합
- 44.1/48/96kHz 중 1.0에서 보장할 범위
- 최대 채널 수와 장시간 메모리 예산
- 정확한 latency가 필요한가, 상대적 비교만 필요한가?
- `.tonecheck`가 WAV를 포함할 때 저장 용량·개인정보 위험은 무엇인가?

### 데이터와 법무

- 테스트 기타/베이스 녹음의 권리
- 상용 IR·앰프 샘플·브랜드 로고 사용 여부
- 코드 MIT, 문서 CC BY 등 최종 라이선스
- 프로젝트명 상표 충돌과 도메인
- Chrome Store·Apple·Microsoft 계정과 비용

### 운영

- 오디오 문제가 발생했을 때 사용자가 제공할 재현 자료
- 공개 issue에 업로드되는 세션의 개인정보 제거 방법
- AI가 만든 코드를 사람이 검수할 최소 절차
- 유지보수자가 한 명일 때 보안·릴리스 책임을 감당할 수 있는가?
- 6개월 동안 기능을 추가하지 않고 호환성·문서·버그만 고칠 의지가 있는가?

## 24. 개발 시작용 첫 이슈

첫 작업은 오디오 분석이 아니다.

> `P0-001: npm workspace, React/Vite shell, CI, README/PLAN 계약을 만든다.`

완료 조건:

- 새 clone에서 Node 24로 `npm ci` 성공
- `npm run dev`로 placeholder dashboard 표시
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` 통과
- GitHub Actions green
- 실제 오디오를 요청하거나 업로드하지 않음
- 다음 이슈가 Phase 2 또는 Phase 3로 명확히 연결됨

첫 오디오 이슈는 그 다음이다.

> `P0-002: 사용자의 클릭 후 오디오 권한을 요청하고 선택한 장치를 표시한다.`

## 출처

- [MDN — getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN — AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet)
- [Vite PWA Guide](https://vite-pwa-org.netlify.app/guide/)
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [Vite releases](https://vite.dev/releases)
- [React versions](https://react.dev/versions)
- [Tauri frontend configuration](https://v2.tauri.app/start/frontend/)
- [Tauri releases](https://tauri.app/release/)
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
- [Chrome user data policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Apple Developer ID](https://developer.apple.com/support/developer-id/)
- [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Microsoft distribution paths](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path)
- [Microsoft code signing](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
