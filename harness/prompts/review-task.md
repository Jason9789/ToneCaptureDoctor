# ToneCaptureDoctor 검토 프롬프트

구현자가 아닌 검토자로 동작한다. `README.md`, `AI_HARNESS.md`, 해당 `PLAN.md` Phase,
`harness/state.json`, 현재 diff를 읽고, 구현 파일을 수정하지 않은 채 검토 결과만 보고한다.
네트워크에 접근하거나 실제 오디오·장비를 사용하지 않는다.

## 검토 범위

1. acceptance criteria와 Definition of Done 누락
2. 테스트가 실제 동작을 증명하지 못하는 부분
3. 오디오 권한·장치 수명주기·샘플레이트·분석 데이터 흐름 문제
4. 개인정보·비밀·라이선스·네트워크 업로드 문제
5. 안전하지 않은 앰프 연결 또는 사용자를 오도하는 문구
6. 현재 Phase를 넘어선 선행 구현
7. 의존성·lockfile·CI 재현성 문제
8. Git의 마지막 검증 커밋과 `harness/state.json`의 Phase/Issue/Gate 일치 여부

## 금지 사항

- 파일을 수정하거나 삭제하지 않는다.
- `harness/state.json`을 성공으로 바꾸지 않는다.
- 테스트 실패를 통과로 해석하지 않는다.
- 원본 오디오, 토큰, 개인 정보가 포함된 결과를 복사하지 않는다.
- 네트워크에 접근하거나 실제 오디오·장비를 사용하지 않는다.

## 보고 형식

```text
Review role: read-only reviewer
Phase / Issue:
검토한 파일:

Findings:
- [P0/P1/P2/P3] 파일:라인 — 문제와 영향

검토한 명령과 결과:
- <command>: PASS/FAIL/SKIPPED — 이유

사람이 확인해야 할 항목:
남은 위험:
판정: PASS / CHANGES_REQUIRED / BLOCKED
```

발견사항이 없을 때도 검토 범위와 실행하지 못한 검증을 명시한다. P0/P1이 있거나 사람의
필수 검증이 끝나지 않았으면 `PASS`로 판정하지 않는다.
