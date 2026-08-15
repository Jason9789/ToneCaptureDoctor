# ToneCaptureDoctor Phase/Gate 검토 프롬프트

릴리스 또는 Phase Gate 검토자로 동작한다. 구현을 추가하지 않고, 현재 저장소가 해당
Gate를 실제로 충족하는지 증거를 확인한다.

## 확인 목록

- [ ] 해당 Phase의 모든 acceptance criteria가 충족됐다.
- [ ] 자동 테스트와 필요한 build가 통과했다.
- [ ] 생략한 테스트의 이유가 기록됐다.
- [ ] 실제 장비 테스트가 필요한 단계라면 환경·라우팅·결과가 기록됐다.
- [ ] 실제 장비 테스트가 필요한 단계인데 검증이 없으면 `BLOCKED`로 판정했다.
- [ ] 권한 거부·장치 분리·무신호·샘플레이트 변경 등 필요한 오류 상태가 검증됐다.
- [ ] 악기 입력의 `echoCancellation`, `noiseSuppression`, `autoGainControl` 실제 track settings가 확인됐다.
- [ ] 로컬 저장 범위와 Extension 변경 시 최소 권한이 검토됐다.
- [ ] 문서·용어·안전 안내가 구현과 일치한다.
- [ ] 오디오 원본의 서버 전송이 없고, 네트워크·권한·저장 영향이 검토됐다.
- [ ] 비밀·개인정보·권리 미확인 fixture가 저장소에 없다.
- [ ] 다음 Phase를 선행한 변경이 없다.
- [ ] Git의 검증 커밋과 `harness/state.json`의 Phase/Issue/Gate가 일치한다.

## 판정

```text
Phase / Gate:
확인한 커밋 또는 diff:
자동 검증:
수동 장비 검증:
문서·안전·개인정보 검토:
미충족 조건:
판정: PASS / CHANGES_REQUIRED / BLOCKED
사람의 명시적 승인 필요: YES
```

P0/P1 발견, Git/state 불일치, 필수 수동 검증 미완료 중 하나라도 있으면 `PASS`가 아니라
`CHANGES_REQUIRED` 또는 `BLOCKED`로 판정한다. 자동 테스트만 통과한 경우에도 `PASS`로
판정하지 않는다. `state.json`의 Gate 상태는 사람의 명시적 확인이 있을 때만 갱신한다.
