# Codex roadmap workflow

When asked to **“Continue the roadmap”**, autonomously complete one coherent
roadmap increment without asking the requester to select it.

## Select the increment

1. Work from the current `v2` baseline and target `v2`, never `main`.
2. Read `PROJECT_STATUS.md`, `docs/V2_IMPLEMENTATION_PLAN.md`,
   `docs/V2_REQUIREMENTS.md`, `docs/V2_ARCHITECTURE.md`, applicable ADRs, and
   `docs/DEVELOPMENT_WORKFLOW.md`.
3. Select the next dependency-valid coherent increment from the active milestone.
   Do not bundle unrelated cleanup, speculative future work, or later milestones.
4. Make reasonable specification-level decisions autonomously. Stop only for a
   genuine contradiction, missing product decision, or external blocker.

## Implement and verify

- Follow the repository architecture and preserve deterministic/versioned
  behavior, V1 compatibility, stable IDs, explicit validation, resource caps,
  and non-destructive migration.
- Never modify anything in **`legacy/`**. Verify its path-and-SHA-256 manifest
  against `docs/LEGACY_SHA256.txt` before and after the change.
- Keep the diff limited to the selected increment and its direct tests and
  documentation.
- Add appropriate automated coverage, including relevant failure, retry,
  cancellation, boundary, and deterministic behavior.
- Run focused tests while developing, followed by:
  - `npm run check`
  - `npm run build:pages`
  - `npm run test:e2e`
- For perceptible UI changes, verify the changed workflow autonomously in real
  Chromium with Playwright at appropriate desktop and mobile widths. Inspect
  screenshots and browser errors when visual behavior changed.
- Review the final diff against the selected requirements, run
  `git diff --check`, and fix problems before handoff.

## Record status

- Update the relevant stable IDs and evidence in `docs/V2_REQUIREMENTS.md` and
  `docs/V2_IMPLEMENTATION_PLAN.md`. Mark work `done` only when its required
  implementation and verification are complete.
- Update `PROJECT_STATUS.md` truthfully with the completed scope, evidence,
  remaining limitations, and next dependency-valid action.
- Run `npm run status:sync` and inspect the resulting generated changes.
- Do not exaggerate completion or claim verification that was not performed.

## Handoff

Leave a clean, PR-ready result targeting `v2`. Provide a concise proposed PR
title and body containing:

- implemented stable IDs and behavior;
- exact verification results;
- status-document updates;
- material remaining risks or work.

Do not merge, deploy, or begin another roadmap increment.
