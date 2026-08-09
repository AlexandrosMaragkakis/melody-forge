# ADR 0001: Browser stack and domain boundaries

- Status: accepted
- Date: 2026-08-09

## Context

The product must be a static, local-first TypeScript application with reliable
in-browser synthesis, deterministic pure musical logic, versioned local
persistence, MIDI/JSON export, and strong browser tests. The initial repository
contains no application stack. A large UI framework, backend, music-theory data
owner, or general state framework would add surface area without serving the
focused workflow.

## Decision

- Use React with TypeScript and Vite. React provides small, mainstream UI
  composition; Vite provides a direct development/build pipeline for a static
  site. Application state is a typed reducer and explicit services rather than
  a state-management dependency.
- Use plain authored CSS with design tokens, grid/flex layout, native controls,
  and minimal motion. No component or styling framework is required.
- Use Tone.js behind a narrow audio adapter. It supplies a maintained browser
  audio/synthesis and scheduling layer with no samples or runtime network. A
  pure playback-plan builder and injected adapter make cancellation, replay,
  looping, tempo, and cleanup deterministic to test. Audio starts only from an
  explicit user gesture.
- Own the scale catalogue and stable IDs as declarative TypeScript data. No
  music-theory library is used: pitch-class transposition, extended-degree to
  MIDI conversion, and sharp/flat display spelling are small, auditable domain
  operations. This avoids an external library's names becoming domain identity.
  If later spelling needs justify a library, it must sit behind a presentation
  adapter and cannot replace catalogue IDs.
- Implement a small standards-based format-0 MIDI encoder locally. The required
  subset (header, one track, variable-length deltas, tempo, note on/off,
  end-of-track) is limited and testable; a broad MIDI dependency is unnecessary.
- Use Vitest, Testing Library, and jsdom for pure/unit/UI integration tests. Use
  Playwright Chromium for essential real-browser workflow and responsive tests.
  ESLint with TypeScript and React hooks covers static linting.
- Use a multi-stage Dockerfile: Node builds immutable static assets, then
  unprivileged nginx serves them with SPA fallback and no backend. Docker Compose
  is unnecessary for one container.

Locked package versions live in `package-lock.json`; this ADR records ownership
and boundaries rather than duplicating a dependency inventory.

## Boundaries

```text
catalogue + domain invariants + seeded RNG
                  |
       legacy / modern generators
                  |
       evolution + provenance/history
                  |
           application reducer
          /        |          \
     React UI   persistence   export
        |                       |
   audio controller       JSON / MIDI bytes
        |
   Tone.js adapter
```

Domain, catalogue, RNG, generators, evolution, schedule planning, persistence,
and exporters remain framework-independent modules. React coordinates them but
does not define their data. Tone.js and browser APIs cannot be imported by pure
musical modules.

## Consequences

- Generator/evolution tests run quickly without a browser, audio clock, or
  React. Seeds and versions are explicit.
- Tone.js lifecycle details are contained and can be replaced without changing
  candidate data.
- Catalogue additions are one declarative record plus validation tests.
- The repository remains one application and one lockfile, with no plugin
  system, monorepo, database, server, or speculative dependency injection.
- MIDI and theory utilities require careful focused tests because the project
  owns them.
