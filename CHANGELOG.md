# Changelog / 변경 기록

## Unreleased / 미출시

- Added bilingual local `.tonecheck` ZIP export/import with checksums, size/path validation, legacy snapshot migration, and atomic import persistence.
- Added a production PWA shell that precaches hashed assets discovered from the built HTML and avoids caching non-static same-origin responses.
- Added GCC-PHAT lag candidate selection, repeated latency median/MAD stability, level-matched spectrum residuals, and dropped AudioWorklet quantum reporting for Dry/Wet Doctor.
- Added local data deletion and bilingual privacy/security documentation.
- `.tonecheck` audio assets are intentionally stored without ZIP compression in this MVP; raw audio remains opt-in and local.

- 한글/영어 `.tonecheck` ZIP export/import, checksum·용량·경로 검증, legacy snapshot migration, atomic import 저장을 추가했습니다.
- 빌드 HTML에서 hashed asset을 찾아 precache하고 비정적 same-origin 응답을 cache하지 않는 production PWA shell을 추가했습니다.
- Dry/Wet Doctor에 GCC-PHAT 지연 후보, 반복 지연 median/MAD 안정성, 레벨 보정 스펙트럼 잔차, AudioWorklet 누락 퀀타 보고를 추가했습니다.
- 로컬 데이터 전체 삭제와 한글/영어 개인정보·보안 문서를 추가했습니다.
- MVP의 `.tonecheck` 오디오 asset은 의도적으로 ZIP 압축 없이 저장하며 raw audio는 opt-in 로컬 데이터입니다.
