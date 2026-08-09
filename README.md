# Melody Forge

Melody Forge is a local-first browser instrument for generating, auditioning,
selecting, and evolving short monophonic melodies. It is intentionally focused:
one melody line, compact constraints, quick listening, human parent selection,
favorites, recent history, and JSON/MIDI export. It has no backend, account,
API key, telemetry, remote samples, or runtime network dependency.

The preserved [`legacy/notes_generator1.py`](legacy/notes_generator1.py) is the
first serious script I wrote when learning Python. Melody Forge keeps its simple
melody idea and characteristic fixed C4-B4 pitch mapping available as Legacy
mode, while leaving every file in `legacy/` byte-for-byte untouched.

## Quick start

Requirements: Node.js 22.12 or newer, npm, and a current Chromium, Firefox, or
Safari browser.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Pressing
Play is the user gesture that initializes browser audio.

For a production preview:

```bash
npm run build
npm run preview
```

## Docker

Build and run the complete static application with one shell command:

```bash
docker build -t melody-forge . && docker run --rm -p 8080:8080 melody-forge
```

Then open `http://localhost:8080`. The final image is an unprivileged nginx
static server; there is no application server or database.

## Creative loop

1. Pick Legacy or Modern, then set tonic, scale, seed, and a few constraints.
2. Generate a population (eight candidates by default).
3. Play, stop, replay, or loop candidates. Starting a new candidate always
   cancels the previous schedule.
4. Mark one or two candidates as parents.
5. Adjust mutation strength and optionally elite retention, then Evolve.
6. Move through immutable generation snapshots, favorite useful candidates,
   and export a candidate as JSON or monophonic MIDI.
7. Export or re-import the whole versioned project. Favorites, controls,
   history, and loop preference also survive reload in browser storage.

Only two active parents are permitted. With one parent, evolution mutates it;
with two, it crosses compatible event boundaries or inherits contour and rhythm
separately before mutation. Selected elites survive unchanged when retention is
enabled. Exact duplicates are rejected. At zero mutation, exact identity takes
priority; the result is explicitly underfilled if a unique requested population
is mathematically impossible.

## Musical strategies

- **Legacy** uses 4-32 equal-duration notes, no rests, independent uniform scale
  choices internally, tonic endpoints, deterministic seeded randomness, and the
  historical fixed MIDI octave C4-B4. Thus B Ionian wraps down to C#4 after B4.
- **Modern** uses a tonic-relative one-to-four-octave register, integer rhythmic
  grids, balanced durations, compact weighted transitions, contour direction,
  small motif echoes, optional sparse rests, maximum diatonic leap, and optional
  tonic closure. The rest and leap controls shape the initial Modern population;
  evolution may deliberately add rests or make larger moves. It uses transparent
  rules—no ML or opaque quality score.
- **Evolution** stores extended (including negative) scale degrees, applies nine
  pitch/motif/rhythm/rest operators, supports two crossover forms, preserves
  scale, register, timing/grid, phrase-total, event-count, monophony, and tonic
  boundary constraints, and records ancestry and named operations. Pitch,
  rhythm, and rest novelty are separate diversity components, never a claim of
  musical quality.

The owned catalogue contains 28 definitions: seven diatonic modes, seven
harmonic-minor modes, seven ascending melodic-minor modes, major/minor
pentatonic, major/minor blues, whole-tone, and both octatonic forms. Stable IDs
and contextual legacy aliases avoid the historical Super Locrian naming
collision.

## Deterministic listening starting points

Automated checks establish invariants and reproducibility, not whether a melody
is aesthetically good. These fixed inputs are useful starting points for manual
listening:

- Legacy: default C Ionian, 8 events, seed `legacy-amber`.
- Legacy fixed-octave contrast: F# Octatonic (Half–Whole), 16 events, seed
  `ordered-legacy-population`.
- Modern: default constraints, seed `glass-orbit`.
- Modern rests: enable rests, choose 10 events over 8 beats, seed
  `rest-fixture`.
- Evolved, one parent: generate Modern with `glass-orbit`, select candidate 1,
  leave mutation at 28%, retain the elite, and evolve.
- Evolved, two parents: generate Modern with `glass-orbit`, select candidates 1
  and 2, leave mutation at 28%, and evolve. The UI derives and records
  `glass-orbit::evolution-1`; repeating the same parent choice and settings
  reproduces each corresponding ordered generation.

## Verification commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run check` runs type checking, lint, unit/integration tests, and the
production build. `npm run test:e2e` additionally builds and runs the complete
creative loop in real desktop and narrow-mobile Chromium, checks accessibility,
downloads/import, reload persistence, console errors/warnings, keyboard focus,
and horizontal overflow. Playwright's one-time browser install is only needed
for E2E verification, not for normal application use.

## Architecture and documentation

The application is one static React/TypeScript/Vite site. Pure domain,
catalogue, RNG, generation, evolution, audio-plan, persistence, and export
modules do not depend on React. Tone.js is isolated behind a playback adapter
and loaded only from the first Play gesture. State uses a reducer and a bounded
versioned local schema. MIDI export is a focused, tested Standard MIDI File
format-0 encoder.

- [Product behavior and acceptance checks](docs/PRODUCT_SPEC.md)
- [Legacy archaeology and intentional differences](docs/LEGACY_BEHAVIOR.md)
- [Architecture/dependency ADR](docs/adr/0001-browser-stack-and-domain-boundaries.md)
- [Implementation checklist](docs/IMPLEMENTATION_PLAN.md)
- [Durable completion state](PROJECT_STATUS.md)

## Current intentional limits

- Monophonic melodies only; no chords, accompaniment, drums, editor, recording,
  mixing, accounts, collaboration, or deployment system.
- Pitch display currently uses sharp names; spelling is presentation-only and
  exported MIDI is unaffected.
- The built-in synth is deliberately simple and requires browser Web Audio.
- Browser storage is local to the origin. Use project JSON for a portable backup.
- The historical Sonic Pi export, drums, chord branch, and OSC experiment are
  documented but deliberately excluded.
