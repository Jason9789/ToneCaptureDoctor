# ToneCaptureDoctor AI 개발 하네스 가이드

이 문서는 다른 작업 컴퓨터에서 AI 코딩 도구를 사용해 ToneCaptureDoctor를 개발할 때 필요한 문서 로딩 순서, 작업 경계, 테스트 실행, 사람 확인, 기록 방식을 정의한다.

이 파일은 실행 가능한 프로그램이 아니다. PLAN.md를 안전하게 실행하기 위한 작업 계약(runbook)이다. AI가 이 문서를 읽었다고 해서 전체 프로젝트를 자동으로 구현하거나 다음 Phase를 선행 구현해서는 안 된다.

> 핵심 원칙: AI는 한 번에 하나의 이슈만 구현하고, 합성 테스트와 실제 장비 테스트를 분리하며, 사람의 Gate 확인 없이는 다음 Phase로 진행하지 않는다.

## 1. 이 하네스가 해결하는 문제

다른 컴퓨터에서 작업을 재개할 때 다음 문제가 생기기 쉽다.

- AI가 README와 PLAN을 읽지 않고 임의의 기술 스택이나 기능을 추가한다.
- 오디오 장비 없이 그래프만 구현하고 실제 입력·권한·노이즈 문제를 놓친다.
- PLAN.md의 Phase 순서를 무시하고 데스크톱 앱, 확장프로그램, AI 추천부터 만든다.
- 테스트하지 않은 변경을 완료했다고 보고한다.
- 사용자 오디오, 인증 정보, 상용 IR·샘플을 저장소에 커밋한다.
- 이전 컴퓨터의 진행 상태와 새 컴퓨터의 Git 상태를 혼동한다.

이 하네스는 문서와 명령을 통해 위의 실패를 방지한다.

## 2. 기준 문서와 읽는 순서

AI 세션을 시작할 때 다음 순서를 지킨다.

1. 시스템·개발자·사용자 지시를 확인한다.
2. 저장소 루트의 AGENTS.md가 있으면 읽는다. 이 파일은 저장소의 로컬 작업 규칙이다.
3. README.md에서 제품 정의, 기술 기준선, 비목표, 실행 명령을 읽는다.
4. 이 AI_HARNESS.md에서 작업 프로토콜과 안전 경계를 읽는다.
5. PLAN.md에서 현재 Phase, 해당 Gate, 테스트 조건을 읽는다.
6. 관련 이슈, ADR, 테스트 문서, 실제 코드만 추가로 읽는다.

문서 간 우선순위는 다음과 같다.

    시스템/개발자/사용자 지시
      > 저장소 AGENTS.md
      > README.md의 제품·기술 기준선
      > AI_HARNESS.md의 작업 프로토콜
      > PLAN.md의 Phase·Gate
      > 이슈·ADR·구현 세부사항

두 문서의 내용이 충돌하면 AI가 임의로 선택하지 말고, 작업을 멈춘 뒤 충돌 내용을 보고한다. 버전과 브라우저·스토어 정책은 문서의 숫자보다 출시 직전의 공식 문서와 lockfile을 우선한다.

## 3. 다른 작업 컴퓨터의 초기 준비

### 3.1 GitHub 저장소가 이미 있는 경우

macOS·Linux:

    git clone https://github.com/<owner>/tone-capture-doctor.git
    cd tone-capture-doctor
    git status
    git branch --show-current

Windows PowerShell:

    git clone https://github.com/<owner>/tone-capture-doctor.git
    Set-Location tone-capture-doctor
    git status
    git branch --show-current

이후 저장소 루트에 다음 세 문서가 있는지 확인한다.

    README.md
    PLAN.md
    AI_HARNESS.md

없으면 코딩을 시작하지 말고, 문서가 어느 커밋·브랜치에서 누락됐는지 확인한다.

### 3.2 문서만 있고 GitHub 저장소가 아직 없는 경우

현재는 설계 단계일 수 있으므로, 문서만 다른 컴퓨터로 옮긴 뒤에도 하네스를 구성할 수 있다.

    mkdir tone-capture-doctor
    cd tone-capture-doctor

    # README.md, PLAN.md, AI_HARNESS.md를 이 디렉터리 루트에 복사한다.
    git init
    git add README.md PLAN.md AI_HARNESS.md
    git commit -m "docs: initialize ToneCaptureDoctor project contract"

이 단계에서는 npm ci를 실행하지 않는다. package.json과 package-lock.json이 생성되는 PLAN.md의 Phase 1 이후에만 의존성을 설치한다.

### 3.3 도구 버전 확인

    git --version
    node --version
    npm --version

권장 기준은 Node.js 24 LTS와 npm 11.x다. Node 버전을 바꾸기 전에 .nvmrc가 있으면 그 파일을 우선한다.

    # nvm을 사용하는 경우
    nvm install
    nvm use

브라우저 오디오 테스트에는 최신 Chrome 또는 Edge, 실제 기타·베이스, 오디오 인터페이스가 필요하다. Signal Health 개발 초기에는 장비가 없어도 합성 fixture 테스트는 가능하지만, Phase Gate를 통과하려면 실제 장비 테스트가 필요하다.

## 4. 권장 저장소 하네스 구조

최종 저장소는 다음처럼 구성한다. harness/는 Phase 1 이후 점진적으로 만들며, 처음부터 모든 파일을 생성할 필요는 없다.

    tone-capture-doctor/
    ├─ README.md
    ├─ PLAN.md
    ├─ AI_HARNESS.md
    ├─ AGENTS.md                         # 선택: 저장소 전용 짧은 규칙
    ├─ harness/
    │  ├─ state.json                     # 현재 Phase와 마지막 검증 상태
    │  ├─ prompts/
    │  │  ├─ start-task.md
    │  │  ├─ review-task.md
    │  │  └─ release-check.md
    │  ├─ reports/                        # 민감정보를 제거한 검증 보고서
    │  └─ fixtures/                       # 테스트용 합성 입력·메타데이터
    ├─ docs/
    │  ├─ adr/
    │  ├─ testing/
    │  └─ safety/
    └─ ...

### 4.1 harness/state.json의 역할

상태 파일은 AI가 현재 작업 위치를 추측하지 않도록 하는 작은 메타데이터다. 오디오 원본이나 비밀키를 넣지 않는다.

    {
      "schemaVersion": 1,
      "currentPhase": "P1",
      "currentIssue": null,
      "lastCompletedGate": "P0",
      "humanVerificationRequired": true,
      "lastVerification": {
        "commit": "<git-sha>",
        "result": "PASS",
        "date": "YYYY-MM-DD"
      }
    }

상태 파일이 실제 Git 기록과 다르면 Git 기록과 사람의 확인을 우선하고, 상태 파일을 조정하는 별도 문서 커밋을 만든다. AI가 성공으로 추정해 값을 바꾸지 않는다.

### 4.2 선택적 AGENTS.md

저장소 루트의 AGENTS.md를 사용하는 AI 도구라면 다음처럼 짧게 유지한다. 제품 요구사항을 복사해 중복 관리하지 말고, 상세 내용은 README·PLAN·AI_HARNESS에 둔다.

    # ToneCaptureDoctor repository rules

    - Before coding, read README.md, AI_HARNESS.md, and the relevant PLAN.md phase.
    - Work on one issue and one phase at a time.
    - Do not add network upload, secrets, unsafe amplifier routing, or unapproved dependencies.
    - Run the tests listed in the issue and report PASS/FAIL/BLOCKED with environment details.
    - Do not mark a phase complete until the human gate in PLAN.md is explicitly confirmed.

개인 컴퓨터의 전역 AGENTS.md나 회사 정책 파일을 프로젝트 저장소에 무단 복사하지 않는다. 비밀, 계정 정보, 회사 내부 경로도 커밋하지 않는다.

## 5. AI 세션 실행 프로토콜

### 5.1 작업 시작 전 preflight

AI는 코드를 수정하기 전에 다음을 수행하고 결과를 확인한다.

    git status --short
    git branch --show-current
    git log -1 --oneline
    test -f README.md
    test -f PLAN.md
    test -f AI_HARNESS.md

Phase 1 이후에는 다음도 실행한다.

    test -f package.json
    test -f package-lock.json
    npm ci

npm ci가 실패하면 의존성 설치를 강행하거나 lockfile을 임의로 삭제하지 않는다. 오류와 Node/npm 버전을 기록하고 원인을 먼저 고친다.

### 5.2 AI가 작업 시작 시 반드시 출력할 보고서

    Phase: P<번호> / Issue: <번호 또는 문서 작업명>
    읽은 기준 문서: README.md, AI_HARNESS.md, PLAN.md, <관련 문서>
    목표:
    이번 작업에 포함하는 파일:
    이번 작업에서 명시적으로 하지 않는 것:
    실행할 자동 테스트:
    실행할 수동 테스트:
    사람의 확인이 필요한 Gate:
    예상되는 차단 요인:

이 보고서가 없거나 작업 범위가 Phase 전체·제품 전체로 표현되면, AI에게 한 이슈 단위로 다시 쪼개도록 한다.

### 5.3 구현 루프

각 이슈는 다음 순서로만 진행한다.

1. PLAN.md에서 해당 Phase의 목표·구현·테스트·Gate를 읽는다.
2. 현재 코드와 테스트를 읽고 변경 전 상태를 확인한다.
3. 가장 작은 구현을 한다.
4. 순수 함수·schema·규칙 변경이면 단위/fixture 테스트를 먼저 추가한다.
5. UI·권한·오디오 수명주기 변경이면 오류 상태와 수동 테스트를 함께 추가한다.
6. lint, typecheck, unit, E2E, build 중 해당 작업에 필요한 명령을 실행한다.
7. git diff --check로 공백·충돌 표시를 확인한다.
8. 결과와 미해결 사항을 보고한다.
9. 사람이 수동 테스트를 완료하고 Gate를 승인하기 전에는 다음 Phase로 넘어가지 않는다.

### 5.4 AI에게 전달할 기본 시작 프롬프트

    ToneCaptureDoctor 저장소에서 작업한다.

    먼저 저장소 루트의 README.md, AI_HARNESS.md, PLAN.md를 읽고,
    현재 git branch/status와 PLAN의 현재 Phase를 확인하라.
    한 번에 하나의 Phase/이슈만 다루고, 다음 Phase를 선행 구현하지 마라.
    작업 시작 전에 Phase, 목표, 포함/제외 파일, 테스트, 사람 Gate를 출력하라.
    실제 오디오를 서버로 전송하거나, 비밀정보를 읽거나, 안전하지 않은 앰프 연결을
    추가하지 마라. 테스트하지 못한 것은 완료로 보고하지 마라.
    구현 후 실행한 명령, PASS/FAIL/BLOCKED 결과, 남은 위험을 보고하라.

### 5.5 검토 전용 프롬프트

    이번 변경을 구현자가 아닌 검토자로 검증하라.
    README.md, AI_HARNESS.md, 해당 PLAN phase, git diff를 읽어라.
    1) acceptance criteria 누락
    2) 테스트가 실제 동작을 증명하지 못하는 부분
    3) 오디오 권한·장치 수명주기·샘플레이트 문제
    4) 개인정보·비밀·라이선스·안전 문제
    5) 다음 Phase를 선행한 변경
    을 우선순위 P0/P1/P2/P3으로 보고하라.

## 6. PLAN.md를 실행하는 방식

PLAN.md는 쉘 스크립트처럼 한 번에 실행하는 파일이 아니다. 하네스는 PLAN을 다음 상태 머신으로 취급한다.

    문서 확인
      ↓
    현재 Phase의 Gate가 열려 있는가?
      ├─ 아니오 → 선행 작업·사람 결정을 먼저 처리
      └─ 예
           ↓
    작은 이슈 선택
           ↓
    구현 + 자동 테스트
           ↓
    사람의 실제 장비 테스트
      ├─ FAIL/BLOCKED → 이슈 수정, 다음 Phase 금지
      └─ PASS
                ↓
    Gate 기록·커밋·다음 이슈 선택

AI가 확인해야 하는 Gate 조건은 다음과 같다.

- 해당 Phase의 구현 항목을 모두 구현했는가?
- 내가 직접 할 테스트를 실제 장비로 수행했는가?
- 공개 테스트가 필요한 단계라면 낯선 사용자가 수행했는가?
- 자동 테스트와 build가 통과했는가?
- 문서·용어 사전·안전 안내가 코드와 일치하는가?
- 새 의존성·권한·네트워크·저장 포맷 변경을 기록했는가?

하나라도 답이 아니오면 Phase를 완료로 표시하지 않는다.

## 7. 테스트 책임 분리

| 테스트 종류 | AI가 실행 | 프로젝트 소유자가 실행 | 공개 테스터가 실행 |
|---|---:|---:|---:|
| TypeScript·schema·DSP 단위 테스트 | 필수 | 결과 확인 | 선택 |
| synthetic sine/noise/hum/clipping fixture | 필수 | 결과 확인 | 선택 |
| UI 오류·권한 상태·빈 상태 | 필수 | 브라우저에서 확인 | 선택 |
| 실제 인터페이스 입력 | 불가능하거나 제한적 | 필수 | Beta부터 필수 |
| 실물 페달 dry/wet 라우팅 | 불가능하거나 제한적 | 해당 Phase에서 필수 | Beta에서 권장 |
| macOS·Windows 장치 조합 | CI에서 일부만 가능 | 최소 1개씩 필수 | 공개 Beta에서 matrix 확대 |
| Chrome extension·Tauri 패키징 | 빌드·smoke test | 실제 설치·권한 확인 | Release candidate |

AI가 실제 장비를 사용할 수 없는 환경이면 BLOCKED로 기록한다. 합성 fixture가 통과했다는 이유로 수동 Gate를 통과시키지 않는다.

## 8. 권장 명령과 실행 시점

Phase 1에서 package.json이 생성된 뒤 기본 검증 명령은 다음과 같다.

    npm run lint
    npm run typecheck
    npm test
    npm run test:e2e
    npm run build
    npm run preview

모든 이슈에서 모든 명령을 무조건 실행할 필요는 없지만, 어떤 명령을 생략했는지 이유를 보고한다.

    실행:
    - npm run lint: PASS
    - npm run typecheck: PASS
    - npm test: PASS (42 tests)
    - npm run test:e2e: SKIPPED — 브라우저 권한 변경 없음
    - npm run build: PASS
    - git diff --check: PASS

현재 저장소가 아직 Phase 1 전이라 package.json이 없다면 문서·구조 검증만 수행한다.

    test -f README.md
    test -f PLAN.md
    test -f AI_HARNESS.md
    git diff --check

## 9. 수동 장비 테스트 기록

수동 테스트를 한 사람은 docs/testing/ 또는 이슈에 다음 형식으로 기록한다.

    Test ID:
    Date / tester:
    OS + version:
    Browser/app + version:
    Interface + driver/firmware:
    Sample rate / buffer:
    Instrument / pickup / tuning:
    Routing:
    Steps:
    Expected:
    Actual:
    Evidence: screenshot, sanitized export, console log
    Result: PASS / FAIL / BLOCKED

다음 데이터는 커밋하지 않는다.

- 사용자의 원본 기타·베이스 녹음
- 개인 식별 정보가 들어간 화면 캡처
- API key, access token, private key, .env 비밀
- 권리를 확인하지 않은 IR·앰프 캡처·상용 샘플
- 전체 브라우저 콘솔에 포함된 쿠키·경로·계정 정보

이슈에 오디오가 필요하면 합성 fixture, 짧은 무권리 샘플, 또는 오디오를 제거한 .tonecheck 메타데이터를 사용한다.

## 10. Git 브랜치·커밋·PR 하네스

작은 작업 단위마다 브랜치를 만든다.

    git switch -c feat/p1-audio-input-status

권장 커밋 예시는 다음과 같다.

    feat(audio): add input permission state
    test(audio): cover unavailable input device
    docs(plan): record P1 manual test result

PR에는 최소한 다음을 포함한다.

    ## 변경 목적
    ## PLAN Phase / Issue
    ## 포함하지 않은 범위
    ## 실행한 테스트와 결과
    ## 실제 장비 테스트 환경
    ## 권한·네트워크·저장 포맷 영향
    ## 남은 위험과 다음 작업

AI가 직접 push하거나 merge하는 정책은 저장소 소유자가 별도로 정한다. 기본값은 AI가 브랜치와 커밋을 만들 수 있어도, 사람이 diff와 테스트를 확인한 뒤 PR을 merge하는 것이다.

## 11. 안전·개인정보·오디오 권한 규칙

- 브라우저 입력은 사용자가 권한을 허용한 뒤에만 시작한다.
- 악기 입력에서 echoCancellation, noiseSuppression, autoGainControl을 임의로 켜지 말고 실제 track 설정을 기록한다.
- 진공관 앰프의 speaker output을 오디오 인터페이스에 직접 연결하는 예시를 만들지 않는다.
- 기본 웹 MVP는 오디오 원본을 서버로 업로드하지 않는다.
- localStorage·IndexedDB·.tonecheck에 저장하는 데이터의 범위를 문서화한다.
- 새로운 원격 API, telemetry, 로그인, 클라우드 업로드는 별도 ADR·개인정보 검토·사용자 동의 없이는 추가하지 않는다.
- Chrome extension 권한은 최소화하고, tab audio와 실제 오디오 인터페이스 입력을 같은 기능으로 설명하지 않는다.

## 12. 실패·중단·재개 규칙

### 테스트 실패

1. 실패 명령과 첫 번째 오류를 원문 그대로 기록한다.
2. 실패를 재현하는 최소 테스트를 남긴다.
3. 원인과 무관한 리팩터링을 하지 않는다.
4. 수정 후 동일 명령을 재실행한다.
5. 세 번 이상 같은 외부 환경에서 막히면 BLOCKED로 보고하고 사람의 결정을 기다린다.

### 작업 컴퓨터 변경

새 컴퓨터에서 먼저 다음을 실행한다.

    git status --short
    git log --oneline -5
    git branch -a

harness/state.json이나 문서에 적힌 Phase가 Git 기록과 다르면 마지막 통과 커밋, PR, 수동 테스트 기록을 기준으로 상태를 복원한다. 기억이나 AI의 추측으로 진행하지 않는다.

### 되돌리기

작업 중인 변경을 잃지 않도록 먼저 diff와 브랜치를 저장한다.

    git diff --stat
    git diff > /tmp/tonedoctor-current.diff

git reset --hard, 대량 삭제, lockfile 삭제는 사용자가 명시적으로 승인하지 않는 한 실행하지 않는다.

## 13. 완료 보고서 형식

AI는 작업을 마친 뒤 다음을 보고한다.

    Phase / Issue:
    변경 요약:
    변경 파일:
    실행 명령:
    자동 테스트 결과:
    수동 테스트 결과:
    사람이 확인해야 할 항목:
    미해결 위험:
    다음에 가능한 가장 작은 작업:

“완료”라는 단어는 코드가 컴파일된다는 뜻이 아니라, 해당 이슈의 acceptance criteria와 테스트가 통과했다는 뜻으로만 사용한다. 실제 장비 테스트를 못 했다면 BLOCKED 또는 자동 테스트만 PASS라고 명확히 쓴다.

## 14. 첫날 체크리스트

- [ ] 저장소를 clone하거나 세 문서를 루트에 복사했다.
- [ ] README.md, AI_HARNESS.md, PLAN.md를 읽었다.
- [ ] git status, branch, 마지막 커밋을 확인했다.
- [ ] Node.js/npm 버전을 확인하고 .nvmrc를 적용했다.
- [ ] package.json과 lockfile이 있으면 npm ci를 실행했다.
- [ ] 현재 Phase와 첫 번째 이슈를 하나로 확정했다.
- [ ] AI가 시작 보고서를 출력했다.
- [ ] 구현 전·후 테스트 명령을 정했다.
- [ ] 실제 장비 테스트를 누가 할지 정했다.
- [ ] 비밀·원본 오디오·권리 미확인 샘플이 작업 트리에 없는지 확인했다.
- [ ] 결과를 커밋·PR·수동 테스트 기록으로 남겼다.

## 15. 이 문서의 변경 규칙

하네스 규칙을 바꾸면 제품 기능 변경과 분리된 문서 커밋을 만든다. 다음 중 하나가 바뀌는 경우에는 PLAN.md의 관련 Phase와 함께 검토한다.

- 기준 Node/패키지/브라우저 버전
- 테스트 명령과 Gate 조건
- 오디오 데이터 저장·전송 정책
- AI가 자동으로 수행할 수 있는 범위
- 사람 승인 없이 진행할 수 있는 범위
- 브랜치·PR·릴리스 절차

이 문서가 너무 길어져 실제로 읽히지 않으면 규칙을 삭제하지 말고, 핵심 계약은 이 파일에 남긴 뒤 세부 체크리스트를 docs/testing/으로 분리한다.
