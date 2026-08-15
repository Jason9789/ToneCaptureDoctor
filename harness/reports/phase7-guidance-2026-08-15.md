# Phase 7 verification report — 2026-08-15

## Scope

Phase 7 adds a bilingual (English/Korean) glossary and evidence-linked, rule-based diagnostic
guidance. The implementation remains local-first and does not add audio upload, telemetry, or
unsafe routing advice.

Implemented areas:

- `packages/glossary/`: 18 required signal terms with definitions, measurement boundaries, common
  causes, reversible experiments, warnings where needed, and internal references.
- `packages/analysis-rules/`: declarative conditions and five initial rules for clipping candidates,
  no signal, power-hum candidates, high noise floor, and browser voice processing.
- `apps/web/src/GlossaryPanel.tsx`: localized search, term selection, measurement boundaries,
  experiments, warnings, and references.
- `apps/web/src/App.tsx`: guidance cards showing observation, confidence, possible causes, safe
  experiments, and never-claim boundaries.
- `apps/web/src/i18n.ts` and `apps/web/src/styles.css`: English/Korean UI copy and responsive layout.

## Safety and product constraints checked

- `dBFS` explicitly distinguishes itself from acoustic `dB SPL`.
- Guidance uses “candidate”, “possible”, or equivalent uncertainty language where appropriate.
- Every initial rule includes a reversible experiment and a `neverClaim` boundary.
- No rule recommends a universal tone score or a specific bass/treble setting.
- No rule recommends connecting an amplifier speaker output to an interface input.
- No raw audio upload or remote analysis path was introduced.

## Automated verification

Environment: Node.js 24.x runtime supplied by the workspace, npm 11.x, macOS workspace.

| Check | Result |
| --- | --- |
| `npm run format` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS — glossary, analysis-rules, audio-core, web |
| `npm test` | PASS — glossary 2, analysis-rules 3, audio-core 10, web 16 |
| `npm run build` | PASS — Vite production build |
| `npm run test:e2e` | PASS — Playwright smoke 1 |
| `git diff --check` | PASS |

The rule tests cover firing and non-firing synthetic metrics, warning context, priority ordering,
and the null-metric threshold path. Glossary tests cover the required term count, dBFS boundary,
and bilingual search.

## Remaining gates

- Human usability test with three beginners reading the guidance and explaining the next action.
- Public glossary test with at least five low-audio-knowledge participants; rewrite if fewer than
  80% understand both the term and next action.
- Actual audio-interface checks on supported macOS and Windows paths.
- No Phase 7 human/device gate is marked complete in `harness/state.json`.
