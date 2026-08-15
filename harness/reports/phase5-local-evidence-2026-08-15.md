# Phase 5 local evidence workflow — 2026-08-15

## 작업

- 브랜치: `develop`
- 범위: waveform/spectrum/spectrogram 시각화, 로컬 Snapshot, 테스트 로그 저장·export/import
- 실제 오디오 인터페이스: 미연결
- 서버 업로드: 없음

## 구현

- `apps/web/src/SignalVisualizer.tsx`
  - Canvas waveform, spectrum, spectrogram
  - 로그 주파수 축, spectrum averaging, peak hold
  - waveform zoom control
- `apps/web/src/audioAnalysis.ts`
  - AudioWorklet 분석과 별도의 `AnalyserNode` 연결
  - mute gain을 거쳐 destination에 연결해 speaker feedback 방지
- `apps/web/src/audioAnalyzer.worklet.ts`
  - UI와 structured log 전달을 초당 약 30회로 제한
  - 분석 엔진은 모든 입력 frame을 계속 누적 처리
- `apps/web/src/sessionStore.ts`
  - IndexedDB 기반 로컬 snapshot/test session/event 저장
  - IndexedDB가 없는 테스트 환경의 메모리 fallback
  - schemaVersion, algorithmVersion, track settings, metric/status timestamp 기록
  - test log JSON export
  - snapshot JSON metadata와 짧은 raw clip export/import
- `apps/web/src/audioClip.ts`
  - `MediaRecorder`가 지원될 때만 최근 10초 rolling clip 유지
  - 사용자가 Snapshot 저장을 선택한 경우에만 Snapshot에 clip 포함
- `apps/web/src/App.tsx`
  - snapshot label/notes/save/delete
  - test log export와 snapshot export/import
  - clip이 지원되지 않는 브라우저의 명시적 안내

## 저장·개인정보 경계

- 원본 audio는 React state, 서버, 자동 로그 이벤트에 저장하지 않는다.
- 구조화 로그에는 metric/status, track settings, timestamp, algorithm/schema version만 기록한다.
- raw clip은 사용자가 Snapshot 저장을 명시한 경우에만 브라우저 로컬 저장소에 보관한다.
- 네트워크 API 호출과 telemetry를 추가하지 않았다.
- JSON export는 사용자가 버튼을 누를 때만 브라우저 download를 시작한다.

## 자동 검증

- `npm run format:check`: PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS — audio-core + web
- `npm test`: PASS — audio-core 5 tests, web 14 tests
- `npm run build`: PASS
- `npm run test:e2e`: PASS — 1 deterministic browser smoke test
- `git diff --check`: PASS

웹 자동화는 headless Chromium의 실제 `getUserMedia()` 대신 결정론적 MediaStream stub을 사용한다.
따라서 아래 수동 Gate를 PASS로 대체하지 않는다.

## 남은 수동 검증

- macOS Chrome/Safari와 Windows Chrome/Edge에서 실제 오디오 인터페이스 연결
- 실제 입력의 waveform/spectrum/spectrogram, peak/RMS/clipping/hum 표시 확인
- 48kHz stereo 30분 지속 처리와 AudioWorklet drop-out/CPU 확인
- Snapshot 저장 후 reload, JSON export/import, 삭제 확인
- MediaRecorder raw clip과 표시된 최근 신호 구간의 일치 확인
- 저장 공간 부족/IndexedDB quota 오류와 offline reload 확인
- DevTools Network에서 오디오 업로드 0건 확인
- 오인페이 미연결 상태에서는 이 보고서와 `harness/state.json`의 manual gate를 완료 처리하지 않음
