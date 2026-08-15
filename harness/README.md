# ToneCaptureDoctor harness

이 디렉터리는 `AI_HARNESS.md`의 작업 계약을 실행하기 위한 최소 운영 하네스다.
제품 기능의 현재 구현 상태를 대신하지 않으며, AI가 한 번에 하나의 이슈만 수행하고
자동 검증과 사람의 실제 장비 검증을 구분하도록 돕는다.

## 구성

- `state.json`: 현재 Phase, 이슈, 마지막 사람 Gate 상태를 기록한다.
- `prompts/start-task.md`: 작업 시작 전 읽는 체크리스트와 시작 보고서 형식이다.
- `prompts/review-task.md`: 구현자와 분리된 검토자 또는 서브에이전트용 읽기 전용 프롬프트다.
- `prompts/release-check.md`: Phase/Gate 또는 릴리스 후보를 검토하는 프롬프트다.
- `reports/`: 민감정보를 제거한 자동·수동 검증 보고서를 저장한다.
- `fixtures/`: 합성 또는 권리가 확인된 테스트 fixture만 둔다.

## 상태 변경 규칙

`state.json`의 `lastCompletedGate`는 자동 테스트만 통과했다고 변경하지 않는다. 다음을 모두
확인한 뒤 사람의 명시적 승인을 받아 기록한다.

1. 해당 이슈의 acceptance criteria 충족
2. 필요한 자동 테스트와 build 통과
3. 실제 장비 테스트 또는 해당 단계에서 장비가 불필요하다는 근거
4. 네트워크 업로드·권한·저장 포맷·안전 영향 검토

문서와 Git 기록의 상태가 다르면 추측으로 state를 고치지 말고 마지막 검증 커밋과 사람의
확인을 기준으로 별도 문서 변경을 만든다.

## 서브에이전트 검토 방식

구현 서브에이전트는 명확히 분리된 파일 범위가 있을 때만 사용한다. 검토 서브에이전트는
`prompts/review-task.md`를 따라 읽기 전용으로 동작하며, 구현 파일을 수정하거나 Gate를
자동 승인하지 않는다. 메인 작업은 서브에이전트의 상태와 결과를 사용자에게 공유하고, 최종
반영 전에 diff와 테스트 결과를 직접 확인한다.

검토 결과에는 다음을 포함한다.

- 서브에이전트 식별자와 역할
- 검토한 Phase/Issue와 파일 범위
- P0/P1/P2/P3 발견사항
- 재현 또는 확인에 사용한 명령
- 사람에게 남은 확인 항목

보고서에는 원본 오디오, API key, access token, 개인 식별 정보, 권리 미확인 샘플을 넣지
않는다.

## 로컬 점검

하네스만 구성한 상태에서 다음 파일을 확인한다.

```bash
test -f README.md
test -f PLAN.md
test -f AI_HARNESS.md
test -f harness/state.json
test -f harness/prompts/start-task.md
test -f harness/prompts/review-task.md
test -f harness/prompts/release-check.md
```

제품 의존성이 생성되기 전에는 `npm ci`를 실행하지 않는다. 첫 제품 이슈는 PLAN의
`P0-001`이며, 하네스 구성과 제품 구현은 서로 다른 작업 단위로 기록한다.
