# Phase 9 PWA shell checkpoint

Date: 2026-08-16 (Asia/Seoul)
Branch: `develop`

Implemented the first Phase 9 loop:

- Added a minimal web manifest with standalone display metadata.
- Added a same-origin, network-first service worker with offline app-shell fallback and cache version cleanup.
- Registered the service worker only in production builds so development and test sessions do not inherit stale caches.
- Kept all audio processing local; the service worker never handles cross-origin requests or audio upload behavior.

Verification:

- Production build includes `manifest.webmanifest` and `sw.js`.
- Preview served both assets with HTTP 200 and the service-worker file passed `node --check`.
- Offline reload and service-worker update persistence remain a real-browser manual gate.
