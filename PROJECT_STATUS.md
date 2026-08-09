# Project status

- Overall: complete
- Active milestone: M7 complete
- Last updated: 2026-08-09 (P01-P62 complete; release evidence recorded below)
- Preservation rule: never change anything under `legacy/`.
- Baseline: `docs/LEGACY_SHA256.txt`
- Immediate next action: none required; the project is ready for local use or
  continued iteration from the documented architecture and deterministic seeds.

Status vocabulary: `not started`, `in progress`, `done`, `blocked`.

| ID | Status | Evidence / remaining action |
| --- | --- | --- |
| P01 | done | No `AGENTS.md` found; `git status --short --branch` was clean at `main...origin/main`; tracked repository contained `.gitignore`, `LICENSE`, and two legacy files. |
| P02 | done | Read all 606 lines of `legacy/notes_generator1.py` and all 18 lines of `legacy/tmp.py` via numbered text output; neither was imported/executed. |
| P03 | done | `docs/LEGACY_SHA256.txt` contains the pre-change sorted two-file SHA-256 manifest. |
| P04 | done | `docs/LEGACY_BEHAVIOR.md` documents source evidence, behavior, quirks, aliases, differences, and exclusions. |
| P05 | done | `docs/PRODUCT_SPEC.md` defines concrete behavior/defaults and nine acceptance checks. |
| P06 | done | `docs/adr/0001-browser-stack-and-domain-boundaries.md` records React/Vite, Tone.js, owned catalogue/MIDI, tests, and Docker decisions. |
| P07 | done | `docs/IMPLEMENTATION_PLAN.md` and this append-only status mirror contain P01-P62. |
| P08 | done | Vite/React/TypeScript bootstrap, npm scripts, strict TS configs, ESLint, Vitest/jsdom setup, initial accessible shell/CSS, and `package-lock.json`; `npm install`, typecheck, lint, and initial build succeeded. |
| P09 | done | `src/domain/types.ts` defines integer-tick, extended-degree/rest, constraint, candidate/provenance/settings, and generation snapshot contracts. |
| P10 | done | `src/domain/invariants.ts` validates scale identity, MIDI/register, integer grid timing, contiguity/monophony, totals, and tonic boundaries; includes exact fingerprints/deep clones and focused tests. |
| P11 | done | `src/domain/scales.ts` owns 28 unique canonical definitions, six families, aliases, historical groupings/scoped resolution, lookups, and validation. |
| P12 | done | `src/domain/scales.test.ts` has 39 tests including exact catalogue patterns, every scale over 12 tonics, legacy routes/rotations, alias collision, and fixed-octave regression. |
| P13 | done | `src/domain/pitch.ts` handles safe negative modulo, extended degree/pitch/MIDI conversion, inverse lookup, Legacy mapping, and display spelling; pitch tests pass. |
| P14 | done | `src/domain/random.ts` provides versioned sfc32 seeded streams, deterministic forks, injected-choice helpers, weighted selection, and shuffle; ESLint bans `Math.random` in generation/evolution; six focused tests pass. |
| P15 | done | `src/generators/legacy.ts` implements deterministic populations, fixed C4-B4 negative-degree encoding, actual scale cardinality, equal ticks/no rests, stable IDs, invariant assertions, and full provenance. |
| P16 | done | Legacy tests cover all 4-32 lengths, bounds, injected reachability for all 28 scales, tonic endpoints, equal timing/no rests, C#/B wrap, and exact ordered reproducibility. |
| P17 | done | README documents `legacy-amber` and `ordered-legacy-population`, including a fixed-octave contrast recipe. |
| P18 | done | Combined gate after M2: 78/78 tests, typecheck, lint, build all passed; Legacy hashes matched baseline. |
| P19 | done | `src/generators/modern.ts` normalizes tonic, stable scale ID, tonic-relative 1-4 octave register, event/phrase length, tempo, grid, rests, leap, closure, population, and seed settings. |
| P20 | done | Modern algorithm uses balanced quantized rhythm, small transfers, weighted contour/leaps, direction changes, three-event motif echo, sparse optional rests, and backwards closure reachability. |
| P21 | done | Modern ordered populations have deterministic forked seeds, IDs, complete settings, named operations, and generation-zero provenance. |
| P22 | done | Modern tests sweep 28 scales x 12 tonics x 2 seeds (672 candidates) for range, grid, timing, total, leap, rest, monophony, and closure invariants. |
| P23 | done | Exact ordered reproducibility and changed-seed tests pass; README documents `glass-orbit` and `rest-fixture` listening recipes. |
| P24 | done | M3 is included in the 78-test/typecheck/lint/build gate; invariant assertion also runs in production generation. |
| P25 | done | `ControlPanel.tsx`, `App.tsx`, and authored CSS provide one responsive workspace with Legacy/Modern controls and conservative defaults. |
| P26 | done | `CandidateCard.tsx` and the responsive grid show pitch contour/notes, timing, origin, generation, selection/favorite/play states, provenance, exports, and an empty state. |
| P27 | done | Native checkbox parent selection is capped at two with live count/feedback; generate, mode/history changes, evolution, and import clear stale selection and stop audio. |
| P28 | done | `src/audio/playbackPlan.ts` converts validated ticks/degrees/rests to integer MIDI/seconds; focused tests cover tempo overrides, phrase/loop duration, rests, and Legacy wrap. |
| P29 | done | Injected `PlaybackController` and lazily imported Tone adapter provide one triangle synth, gesture initialization, scheduler ownership, and full cleanup without samples. |
| P30 | done | Twelve audio tests cover initialize, stop, replay, candidate replacement, loop restart, tempo restart, delayed initialization, stale callbacks, completion, and disposal. |
| P31 | done | Candidate Play/Stop controls, global Stop, loop state, playing card state, and polite/error status announcements are connected. |
| P32 | done | Audio/UI integration, typecheck, lint, unit tests, and production builds passed; real Chromium playback also passed without final console warnings. |
| P33 | done | `src/evolution/operators.ts` implements degree movement; motif repeat/reverse/shift/invert/transpose; rhythm split/merge; and rest toggle, now bounded to 4-32 events. |
| P34 | done | Compatible shared-boundary and contour/rhythm crossovers preserve timing/constraints and reject incompatible parents. |
| P35 | done | One/two-parent paths, exact zero-strength copy semantics, immutable ordered elite retention, and stable identity/provenance are implemented and tested. |
| P36 | done | MIDI-canonical exact fingerprints, bounded deterministic refill, maximin choice, and separate pitch/rhythm/rest novelty components prevent silent duplicate collapse. |
| P37 | done | Evolved candidates record deterministic per-slot/attempt seeds, generation, parent IDs, version, settings, and every named operation. |
| P38 | done | Evolution tests cover operators, crossovers, zero strength, elites, dedup/underfill, novelty, reproducibility, Legacy wrap, repeated generations, event bounds, and Legacy degree aliases. |
| P39 | done | `EvolutionBar.tsx` exposes mutation, next population, elite retention, loop, parent help/count, and enabled Evolve workflow. |
| P40 | done | Reducer stores immutable, branchable snapshots bounded to 24 and exposes Earlier/Later navigation; an audit regression proves elite-only zero mutation still advances snapshot generation/version. |
| P41 | done | README documents deterministic one/two-parent evolution from `glass-orbit` and the derived `glass-orbit::evolution-1` seed. |
| P42 | done | Evolution suite, full unit suite, typecheck, lint, and production build passed after integration; exact evidence is in the verification log. |
| P43 | done | `src/persistence/schema.ts` owns version-1 project/candidate envelopes, deep structural/musical validation, 24-snapshot/64-favorite bounds, and safe defaults. |
| P44 | done | Controls, active/history populations, favorites, loop, evolution settings, and mode save/restore through a small localStorage adapter. |
| P45 | done | Persistence tests cover project/candidate round trips, malformed/unknown schemas, invariant rejection, duplicate IDs, empty/corrupt storage, and read/write/quota errors. |
| P46 | done | Versioned deterministic project/candidate JSON encode/decode uses validated envelopes and a 5 MB UI import cap. |
| P47 | done | Owned Standard MIDI File format-0 encoder tests prove VLQs, PPQ/tempo/program events, pitches, rests/trailing silence, note-off ordering, and end tick. |
| P48 | done | Candidate/favorite JSON and MIDI downloads, project import/export, safe filenames, feedback, and deferred object-URL revocation are connected and browser-tested. |
| P49 | done | Persistence/export focused tests, integration tests, typecheck, lint, and production build passed; downloads/import/reload also passed in Chromium. |
| P50 | done | Root README covers scope, exact npm/Docker/test commands, Playwright browser setup, seeds, architecture/docs, limitations, no-service guarantee, and the required first-serious-script statement. |
| P51 | done | Multi-stage `Dockerfile`, unprivileged nginx SPA/cache configuration, `.dockerignore`, healthcheck, and documented one-shell-command build/run path are present. |
| P52 | done | `e2e/creative-loop.spec.ts` performs the complete required workflow, reload, project/MIDI downloads, re-import, overflow, keyboard, axe, screenshots, and console inspection. |
| P53 | done | Native semantics/labels, status regions, pressed/checked states, 44 px controls, visible focus including visually hidden inputs, contrast, reduced motion, landmarks/headings, and axe checks are present. |
| P54 | done | Production Chromium passed at 1440x1000 and 390x844 with no axe violations, horizontal overflow, console warnings/errors, or workflow breakage; screenshots are under `screenshots/`. |
| P55 | done | QA fixes included gesture-path Tone loading, exact parent locator, explicit stopped status, non-sticky evolution controls, mobile wrapping, visible hidden-input focus, and recaptured screenshots. |
| P56 | done | Final `npm run check && npm run test:e2e` passed typecheck, lint, 16 files / 148 tests, production build, and 2/2 desktop/mobile Chromium workflows after every audit fix. |
| P57 | done | Docker 29.6.2 rebuilt the exact final tree, ran it loopback-only as UID 101, reached `healthy`, served root and SPA fallback with identical HTML and `no-store`, and served the hashed JS asset with one-year immutable caching; the temporary container was stopped and auto-removed. |
| P58 | done | Independent read-only audit closed clear after fixes for snapshot metadata, descendant slots, audible Legacy identity, event/favorite bounds, playback race, imports, instance IDs, focus/touch targets, docs, and plan status. |
| P59 | done | A new isolated `/tmp` copy of the final tree installed 245 locked packages with `npm ci`, passed `npm run check` with 148/148 tests, and served `<title>Melody Forge</title>` from the documented Vite development command. |
| P60 | done | The sorted final Legacy manifest has exactly two paths, byte-compares equal to `docs/LEGACY_SHA256.txt`, and `git diff --exit-code -- legacy` is clean. |
| P61 | done | This ledger now records final commands, exact counts, Docker/fresh-copy/browser/audit evidence, screenshots, listening seeds, limitations, and continuation state. |
| P62 | done | Every definition-of-done item was reviewed, the final handoff was prepared, and goal closure is the final orchestration action. |

## Environment evidence

- Node `v24.18.1`; npm `11.16.0`; Playwright CLI `1.62.1` available through `npx`.
- Docker client/engine `29.6.2` and Docker Desktop `4.85.0` became available
  during final verification; both the documented image build and a live
  container smoke test succeeded.

## Verification log

- Initial scaffold: `npm install --no-audit --no-fund` installed 243 locked packages.
- Initial scaffold: `npm run typecheck` passed.
- Initial scaffold: `npm run lint` passed after excluding the flat config from typed source linting.
- Initial scaffold: `npm run build` passed (Vite 8.2.1; 16 modules transformed).
- RNG: `npm run test -- --run src/domain/random.test.ts` passed 6/6 tests.
- M2/M3 combined: `npm run test` passed 78/78 tests in seven files; `npm run typecheck`, `npm run lint`, and `npm run build` all passed. Production build used Vite 8.2.1 and transformed 16 modules.
- M2/M3 preservation check reproduced both SHA-256 baseline lines exactly.
- Audio boundary: 12/12 focused tests, typecheck, targeted lint, and build passed.
- Evolution core: 34/34 focused tests and repeated Legacy/Modern invariant sweeps passed before final hardening.
- Persistence/export: 11 focused tests originally passed; duplicate-ID and favorite-bound regressions were added during final review.
- UI integration: Legacy complete-loop, two-parent-limit, and Modern settings/persistence workflows are covered.
- Pre-audit integrated gate: `npm run check` passed typecheck, ESLint, 16 files / 140 tests, and Vite production build (978 modules; 266.66 kB main JS and 340.79 kB lazily loaded Tone chunk before gzip).
- Real browser: `npm run test:e2e` passed 2/2 desktop/mobile Chromium projects in 22.9 seconds, with no axe violation, unexpected console warning/error, horizontal overflow, or failed download/import/reload assertion.
- Browser artifacts were visually inspected at `screenshots/desktop-chromium-workflow.png` and `screenshots/mobile-chromium-workflow.png`; the sticky control overlap found in the first pass was removed and both were recaptured.
- Adversarial hardening: 59/59 targeted tests passed after fixing elite-only generation metadata, MIDI-canonical Legacy fingerprints/novelty, 4-32 evolution bounds, 64-favorite persistence bounds, duplicate imported candidate IDs, and hidden-input focus indication.
- Final release gate after all audit and accessibility fixes: `npm run check && npm run test:e2e` passed typecheck, lint, 16 files / 148 tests, the production build, and 2/2 desktop/mobile Chromium workflows in 21.3 seconds.
- Final production build: Vite 8.2.1 transformed 978 modules; output was 268.23 kB main JavaScript (82.95 kB gzip), 340.79 kB lazily loaded Tone chunk (79.40 kB gzip), and 12.10 kB CSS (3.42 kB gzip).
- Final browser workflow asserted generation, Play/Stop/Replay, two-parent evolution, descendant audition, favorite persistence through reload, project export/import, MIDI download, keyboard focus proxies, unique DOM IDs, axe, console cleanliness, and responsive overflow; screenshots were recaptured.
- Final Docker rebuild produced image `sha256:15642b119e372c39cac8658c3c786db070d4f4d9c439c3979c5fb44e5af655f6`; a live loopback container was healthy as UID 101, exposed 8080, returned identical root/SPA-fallback HTML, used `no-store` for HTML, and immutable caching for the hashed asset before auto-removal.
- Final fresh-copy verification: a newly isolated copy installed 245 locked packages with `npm ci --no-audit --no-fund`; `npm run check` passed typecheck, lint, 148/148 tests, and production build, and the documented dev server returned the Melody Forge page over HTTP.
- Final preservation proof: exactly two files exist under `legacy/`; the sorted SHA-256 output exactly matches `docs/LEGACY_SHA256.txt`, `git diff --exit-code -- legacy` is clean, and the hashes are `203c91aa48d2df05f33b3a0910d0c69c68bf16ef194913cb7b52acb94e0c6029` and `d0d288968392db0f7ad53fb78a8c0ca00567449c7aab01cd8bb032f42789bff2`.
- Independent final audit disposition: clear for P58 with no unresolved material product, architecture, accessibility, preservation, or documentation gap.

## Release handoff

- Browser artifacts: `screenshots/desktop-chromium-workflow.png` and
  `screenshots/mobile-chromium-workflow.png`.
- Legacy listening seeds: `legacy-amber` and `ordered-legacy-population`.
- Modern listening seeds: `glass-orbit` and `rest-fixture`.
- Evolution recipes: the README records deterministic one-parent and two-parent
  workflows derived from `glass-orbit`.
- Continuation state: there is no backend, account, service, deployment, or
  external data dependency to resume; all application state is local and the
  architecture/specification/plan documents are complete.

## Known limitations / blockers

- No known functional blocker.
- Projects and favorites use origin-scoped browser storage unless explicitly
  exported; clearing site data removes unexported work.
- Browsers require a user gesture before audio can initialize.
- Automated tests prove musical constraints and reproducibility, not subjective
  aesthetic quality; the documented seeds support repeatable manual listening.
