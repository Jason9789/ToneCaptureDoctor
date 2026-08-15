# Phase 8 Dry/Wet Doctor verification

Date: 2026-08-16 (Asia/Seoul)
Branch: `develop`

## Scope

- Data binding: confidence fields are visible in metrics and retained in snapshot metadata.
- State consistency: rejected device switches keep the existing stream connected and restore the selected device.
- Screen structure: Dry/Wet Doctor is a separate two-channel section with responsive channel selectors.
- Accessibility/regression: document language follows the selected locale, focus-visible styles exist, dynamic metric panels avoid broad live announcements, and compact-width E2E coverage was added.
- Phase 8A: frame coordinate validation, RMS/peak/gain difference, no-signal assessment, normalized cross-correlation latency candidate, measured/estimated distinction, and channel-swap candidate warning.
- Phase 8B: dynamics (RMS/peak/crest) and calibrated frequency-band differences.
- Phase 8C: bilingual UI, local test-log compatibility, and safe dry/wet routing guidance.

## Automated verification

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — PASS (52 tests)
- `npm run build` — PASS
- `npm run test:e2e` — PASS (2 tests)
- `node --check apps/web/public/sw.js` — PASS
- `git diff --check` — PASS

Browser checks covered 320px, 390px, and 1440px viewports. `document.documentElement.scrollWidth` did not exceed the viewport width. The production preview served both `manifest.webmanifest` and `sw.js` with HTTP 200; the in-app browser did not expose `navigator.serviceWorker`, so registration itself remains a browser/environment check.

## Human gate

BLOCKED until an audio interface is available. The following must still be performed with a real two-channel interface:

1. Confirm dry/wet input routing and safe level range.
2. Repeat bypass, gain-only, pedal on/off, unplugged input, swapped channels, and intentional latency checks.
3. Export the local test log after each run and review it for dropped/invalid frames.
4. Verify offline reload and existing snapshot visibility in a browser with service-worker support.

No human/device gate is marked complete by this report.
