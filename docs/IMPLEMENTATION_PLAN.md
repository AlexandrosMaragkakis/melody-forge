# Implementation plan

Status for every item is mirrored, without deletion, in `PROJECT_STATUS.md`.

## M1 - Archaeology and decisions

- [x] P01 Inspect repository instructions, tracked files, history, and clean git status.
- [x] P02 Read every legacy source completely as text without importing or executing it.
- [x] P03 Record a sorted SHA-256 preservation manifest for every file under `legacy/`.
- [x] P04 Document actual simple-melody semantics, retained quirks, bugs, aliases, and excluded branches.
- [x] P05 Define concrete product behavior, defaults, exclusions, and acceptance checks.
- [x] P06 Record frontend, audio, theory-catalogue, test, export, and Docker decisions in an ADR.
- [x] P07 Create the complete implementation checklist and durable status ledger.

## M2 - Domain, catalogue, RNG, and Legacy

- [x] P08 Scaffold the Vite React TypeScript application, scripts, lint, test, and ignore configuration.
- [x] P09 Define integer-tick melody, event, candidate, settings, provenance, and invariant types.
- [x] P10 Implement invariant validation/fingerprints and tests for positivity, contiguity, monophony, grids, totals, endpoints, scale, and register.
- [x] P11 Add the canonical declarative scale catalogue, aliases/families, lookup validation, and focused extensibility test.
- [x] P12 Test every scale construction and transposition over all 12 tonic pitch classes.
- [x] P13 Implement extended-degree/pitch-class/MIDI conversion and presentation spelling boundaries.
- [x] P14 Implement versioned seeded RNG with fork/weighted/shuffle helpers and prohibit direct generator/evolution `Math.random` calls.
- [x] P15 Implement Legacy generation/populations with fixed C4-B4 mapping and full provenance.
- [x] P16 Test Legacy length, injected degree reachability, tonic endpoints, equal duration, no rests, fixed-octave wrap, and reproducibility.
- [x] P17 Add deterministic Legacy manual-listening seed fixtures.
- [x] P18 Run and record the M2 unit, typecheck, lint, and production-build checks.

## M3 - Modern generator

- [x] P19 Implement Modern settings normalization and tonic-relative multi-octave register-degree bounds.
- [x] P20 Implement transparent weighted step/leap, contour, motif reuse, quantized rhythm, optional rest, and closure generation.
- [x] P21 Generate deterministic Modern populations with stable candidate IDs and complete provenance.
- [x] P22 Property-test many tonics/scales/registers/seeds for membership, range, tick/grid, event, monophony, total duration, and closure invariants.
- [x] P23 Test Modern population/version/settings/seed reproducibility and add manual-listening fixtures.
- [x] P24 Run and record the M3 unit, typecheck, lint, and production-build checks.

## M4 - Browser workspace and playback

- [x] P25 Build the responsive single-workspace shell and compact shared/strategy generation controls.
- [x] P26 Build candidate cards/grid with concise pitch/rhythm summary, strategy, generation, provenance, and empty/error states.
- [x] P27 Implement selection of at most two parents with clear keyboard-accessible state and stale-selection cleanup.
- [x] P28 Implement a pure tick-to-playback scheduling plan and test tempo, rests, loop duration, and note ordering.
- [x] P29 Implement the injected audio controller and Tone.js synth adapter with gesture initialization and single-active-player semantics.
- [x] P30 Test play, stop, replay, candidate switch, looping, tempo restart, disposal, and ghost-schedule prevention.
- [x] P31 Connect playback state to cards/global controls with visible and announced status.
- [x] P32 Run and record the M4 unit/UI integration, typecheck, lint, and production-build checks.

## M5 - Interactive evolution

- [x] P33 Implement constraint-preserving nearby/large degree, motif, rhythm split/merge, and rest mutation operators.
- [x] P34 Implement compatible-boundary crossover and contour-from-one/rhythm-from-another crossover.
- [x] P35 Implement zero-strength identity, immutable selected-parent elitism, one-parent mutation, and two-parent crossover-plus-mutation.
- [x] P36 Implement exact musical fingerprint deduplication, bounded refill attempts, and explainable pitch/rhythm/rest novelty components.
- [x] P37 Create deterministic ordered evolved populations with IDs, generation, seed, parent IDs, versions, and operator provenance.
- [x] P38 Test every operator, crossover resemblance, elites, zero mutation, deduplication, reproducibility, and repeated-generation hard invariants.
- [x] P39 Connect mutation strength, population size, elite retention, Evolve enablement, parent validation, and provenance UI.
- [x] P40 Implement immutable generation snapshots and navigation for at least preceding generations.
- [x] P41 Add deterministic one-parent and two-parent evolved listening fixtures.
- [x] P42 Run and record the M5 unit/UI integration, typecheck, lint, and production-build checks.

## M6 - Persistence and export

- [x] P43 Define a versioned persisted-state schema with validation, safe fallback, bounded history, and storage adapter.
- [x] P44 Persist and restore controls, current population, history, favorites, loop preference, and schema version.
- [x] P45 Test persistence round trips, malformed/unknown schemas, reload identity, favorite survival, and quota/error handling.
- [x] P46 Implement validated versioned JSON project/candidate export and import with deterministic round-trip tests.
- [x] P47 Implement standards-based monophonic format-0 MIDI encoding and exact delta/tempo/note/rest/end timing tests.
- [x] P48 Connect favorite, JSON import/export, MIDI download, feedback, filename, and object-URL cleanup UI.
- [x] P49 Run and record the M6 unit/UI integration, typecheck, lint, and production-build checks.

## M7 - Delivery, accessibility, browser QA, and final review

- [x] P50 Write the root README with product scope, the required personal legacy note, exact install/run/test commands, seeds, architecture links, limitations, and no-service guarantee.
- [x] P51 Add production Dockerfile, nginx SPA configuration, `.dockerignore`, and a one-command documented container run path.
- [x] P52 Add Playwright configuration/fixtures and an essential creative-loop E2E test including reload and downloads.
- [x] P53 Add targeted accessibility/keyboard semantics checks and polish focus, status, contrast, reduced motion, touch sizing, and heading/landmark structure.
- [x] P54 Run real Chromium QA for the full creative loop at desktop and narrow mobile viewports, inspect console, and capture screenshots.
- [x] P55 Correct clipping, overflow, hierarchy, accessibility, stale state, and playback defects found by browser QA; rerun affected checks.
- [x] P56 Run the complete unit/integration suite, coverage-relevant invariant sweeps, typecheck, lint, production build, and browser E2E.
- [x] P57 Attempt the Docker build/run/smoke check; if Docker is unavailable, record exact environment evidence and validate configuration by alternate safe checks.
- [x] P58 Conduct an adversarial requirements/code review and resolve all material findings.
- [x] P59 Verify fresh-install instructions from a clean temporary copy without modifying or deleting the working repository.
- [x] P60 Recompute the sorted `legacy/` SHA-256 manifest and prove it exactly matches the baseline including path set.
- [x] P61 Finalize `PROJECT_STATUS.md` with files, exact verification evidence, screenshots, seeds, limitations, and continuation state.
- [x] P62 Confirm every definition-of-done item, mark the active goal complete, and deliver the final handoff.
