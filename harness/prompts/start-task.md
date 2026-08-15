# ToneCaptureDoctor 작업 시작 프롬프트

ToneCaptureDoctor 저장소에서 작업한다.

## 문서와 상태 로딩 순서

1. 시스템·개발자·사용자 지시를 확인한다.
2. 저장소 루트의 `AGENTS.md`가 있으면 읽는다.
3. `README.md`에서 제품 범위, 비목표, 기술 기준선을 읽는다.
4. `AI_HARNESS.md`에서 작업 경계, 테스트, 사람 Gate를 읽는다.
5. `PLAN.md`에서 현재 Phase와 선택한 이슈의 목표·테스트·완료 조건을 읽는다.
6. `harness/state.json`과 관련 ADR·이슈·코드를 확인한다.

문서가 충돌하거나 `harness/state.json`의 Phase/Issue/Gate가 Git 기록과 일치하지 않으면
임의로 고치지 말고 충돌 내용을 보고한 뒤 멈춘다. 한 번에 하나의 Phase와 하나의 이슈만
다룬다. 사람의 Gate 승인이 없는 상태에서는 다음 Phase로 이동하지 않는다.

## 시작 전 점검

```bash
git status --short
git branch --show-current
git log -1 --oneline
test -f README.md
test -f PLAN.md
test -f AI_HARNESS.md
```

현재 구현 단계에서 `package.json`과 `package-lock.json`이 존재할 때만 `npm ci`를 실행한다.
lockfile을 삭제하거나 설치 실패를 무시하지 않는다.

## 시작 보고서

작업을 시작하기 전에 다음을 출력한다.

```text
Phase: P<번호> / Issue: <번호 또는 문서 작업명>
읽은 기준 문서: README.md, AI_HARNESS.md, PLAN.md, <관련 문서>
목표:
이번 작업에 포함하는 파일:
이번 작업에서 명시적으로 하지 않는 것:
실행할 자동 테스트:
실행할 수동 테스트:
사람의 확인이 필요한 Gate:
예상되는 차단 요인:
```

## 보안·안전 경계

- 실제 오디오를 서버로 전송하지 않는다.
- 비밀키, 토큰, 원본 오디오, 권리 미확인 샘플을 읽거나 커밋하지 않는다.
- 진공관 앰프의 speaker output을 인터페이스에 직접 연결하는 예시를 만들지 않는다.
- 새 네트워크 API, telemetry, 로그인, 클라우드 저장은 별도 ADR과 동의 검토 없이는 추가하지 않는다.
- 악기 입력의 브라우저 권한은 사용자의 명시적 클릭 뒤에만 요청한다.
- 악기 입력에서는 `echoCancellation`, `noiseSuppression`, `autoGainControl` 요청값과 실제 track settings를 기록한다.
- 로컬 저장 데이터의 범위와 보존 위치를 문서화하고, Extension을 변경할 때는 최소 권한만 사용한다.

## 완료 보고

구현 후 `git diff --check`와 이슈에 필요한 lint, typecheck, unit, E2E, build를 실행한다.
생략한 명령은 이유를 적는다. 결과는 `PASS`, `FAIL`, `BLOCKED`로 구분하고, 실제 장비
테스트를 수행하지 못했으면 Gate를 통과했다고 보고하지 않는다.
