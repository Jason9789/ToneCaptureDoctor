# Privacy / 개인정보

## English

ToneCaptureDoctor is designed as a local-first browser application.

- Microphone permission is requested only after the user starts Signal Health.
- Audio frames are analyzed in the browser. The MVP has no audio upload endpoint, account, cloud sync, advertising SDK, or analytics collector.
- Browser track settings, device labels returned by the browser, timestamps, status events, and numeric analysis summaries may be kept in IndexedDB so a test can be audited later.
- Raw audio is not written to a test log. A short raw clip is stored only when the user explicitly saves a snapshot; it is included in exports only when the user chooses an audio-containing export such as `.tonecheck`.
- Device labels can contain personal or workplace information. Review and redact exported files before sharing them.
- Data remains in the browser profile until the user deletes it, clears site data, or removes the exported files.

Use **Delete all local data** in the snapshot panel to delete local snapshots, raw clips attached to them, test sessions, and test events. This action is disabled while a live session is active so the current log cannot immediately recreate data. Browser storage clearing is also supported by the browser’s site-data controls.

The app cannot guarantee recovery after a browser profile reset, private-window teardown, storage quota failure, or device failure. Export a sanitized `.tonecheck` or JSON file before clearing storage. Do not put private recordings, access tokens, or personal device metadata in public issues.

For a privacy or security report, use the repository’s [GitHub security reporting](https://github.com/Jason9789/ToneCaptureDoctor/security) if enabled, or open a minimal issue without attaching recordings or secrets.

## 한국어

ToneCaptureDoctor는 로컬 우선 브라우저 앱으로 설계되었습니다.

- Signal Health를 사용자가 시작한 뒤에만 마이크 권한을 요청합니다.
- 오디오 프레임은 브라우저 안에서 분석하며 MVP에는 오디오 업로드 API, 계정, 클라우드 동기화, 광고 SDK, 분석 수집기가 없습니다.
- 테스트를 나중에 검토할 수 있도록 브라우저 track 설정, 브라우저가 반환한 장치 라벨, 시각, 상태 이벤트, 수치 분석 요약을 IndexedDB에 저장할 수 있습니다.
- 테스트 로그에는 raw audio를 기록하지 않습니다. 짧은 raw clip은 사용자가 스냅샷 저장을 명시적으로 선택했을 때만 저장되며, `.tonecheck`처럼 오디오가 포함된 export를 사용자가 선택할 때만 export에 들어갑니다.
- 장치 라벨에는 개인 정보나 회사 정보가 들어갈 수 있습니다. export 파일을 공유하기 전에 검토하고 필요한 경우 지우세요.
- 데이터는 사용자가 삭제하거나 브라우저 사이트 데이터를 지우거나 export 파일을 직접 삭제할 때까지 브라우저 프로필에 남습니다.

스냅샷 패널의 **로컬 데이터 전체 삭제**를 사용하면 로컬 스냅샷, 첨부 raw clip, 테스트 세션, 테스트 이벤트를 삭제합니다. 현재 실행 중인 세션이 즉시 로그를 다시 만들지 않도록 live session 중에는 이 동작을 비활성화합니다. 브라우저의 사이트 데이터 삭제 기능도 사용할 수 있습니다.

브라우저 프로필 초기화, private window 종료, 저장 공간 부족, 장치 고장 뒤의 복구를 보장할 수 없습니다. 저장소를 삭제하기 전에 개인정보를 검토한 `.tonecheck` 또는 JSON 파일을 export하세요. private recording, access token, 개인 장치 metadata를 공개 issue에 올리지 마세요.

개인정보 또는 보안 문제는 저장소의 [GitHub 보안 신고](https://github.com/Jason9789/ToneCaptureDoctor/security)가 활성화되어 있으면 사용하고, 그렇지 않으면 녹음 파일이나 secret을 첨부하지 않은 최소한의 issue를 열어 주세요.
