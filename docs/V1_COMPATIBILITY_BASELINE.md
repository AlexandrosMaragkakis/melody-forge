# V1 compatibility baseline for Melody Forge V2

This is the pre-V2 archaeology and verification record. It supplements the
historical V1 documents; it does not replace them.

## Repository state

- Baseline date: 2026-08-09 (Europe/Athens).
- Commit: `81209c5bd5d2009706f50d4ae8362d2b433c3c06` (`main`, equal to
  `origin/main`).
- Initial tracked/untracked status: clean.
- Repository or ancestor `AGENTS.md`: none.
- Runtime: Node 24.18.1, npm 11.16.0, Playwright 1.62.1.
- Framework boundary: React 19 + TypeScript + Vite; pure musical modules;
  Tone.js isolated behind a playback adapter; no backend.

The sorted `legacy/` manifest contains exactly two files:

```text
203c91aa48d2df05f33b3a0910d0c69c68bf16ef194913cb7b52acb94e0c6029  legacy/notes_generator1.py
d0d288968392db0f7ad53fb78a8c0ca00567449c7aab01cd8bb032f42789bff2  legacy/tmp.py
```

The SHA-256 of that complete sorted manifest text is
`7bdad234c78996793242be26c5f4b416bc87773ff658ec948fd817da562420c1`.
It matched before and after all baseline checks. V2 must continue to compare
the entire path set and contents, not only these remembered hashes.

## Automated and browser baseline

| Command | Result |
| --- | --- |
| `npm test` | 16/16 files and 148/148 tests passed. |
| `npm run typecheck` | Passed with no diagnostics. |
| `npm run lint` | Passed with no warnings or errors. |
| `npm run build` | Passed; Vite transformed 978 modules. |
| `npm run test:e2e` | Passed 2/2 Chromium projects: 1440×1000 desktop and 390×844 mobile. |
| `npx playwright test e2e/v1-compatibility-baseline.spec.ts` | Passed 2/2 desktop/mobile projects after the golden fixtures were captured. |

The browser workflow exercised generation, play/stop/replay, two-parent
evolution, descendant audition, favorite/reload, project export/import, MIDI
download, keyboard focus, axe, console inspection, and horizontal overflow.
No asserted console warning/error, axe violation, or overflow remained. Node
printed only the environment-level notice that `NO_COLOR` was ignored because
`FORCE_COLOR` was set.

The additional V1 compatibility workflow explicitly exercised Modern
five-beat generation, playback/stop, two-parent evolution, Earlier/Later
history, favorite, schema-v1 golden project import, exact localStorage schema,
2,400-tick duration and stable IDs, then reload restoration. It reported no
browser console warning/error.

Fresh full-page V1 captures are retained at:

- `screenshots/v1-baseline-desktop-1440x1000.png`, SHA-256
  `ff3ea282ea4f0e0a05aeb6d9e1cb3f26f6c96b921a248541de134d487de36a2b`.
- `screenshots/v1-baseline-mobile-390x844.png`, SHA-256
  `5c96bc61874430d2aae5ff07cc1be00905f2067254aa36e6827019db5ef472d6`.
- `screenshots/v1-baseline-modern-five-beat-desktop-chromium.png`, SHA-256
  `853bf7014439aa125b36670eee26b3a2c176642d3305a53299bf3c900e7efab6`.
- `screenshots/v1-baseline-modern-five-beat-mobile-chromium.png`, SHA-256
  `b957454cb563b46028675c291bf2b14f1902316d53f0a3e7ffb0a70f191cc8ed`.

These four pre-change files and the original tracked
`desktop-chromium-workflow.png` / `mobile-chromium-workflow.png` release
captures are static golden evidence. Their hashes are
asserted by `src/persistence/v1Fixtures.test.ts`; ongoing Playwright runs write
the current compatibility screenshot only to that run's test-output directory
and cannot overwrite the baseline captures.

The run refreshed ignored `dist/`, `playwright-report/`, `test-results/`, and
TypeScript build-info files only. It made no tracked source/configuration
change.

## Versioned domain inventory

| Concern | V1 contract |
| --- | --- |
| Musical time | Positive integer ticks; generators emit 480 PPQ, but schema/invariants accept any positive safe-integer `ticksPerBeat`. Events are contiguous, ordered, monophonic, and sum exactly to `totalTicks`. A null extended scale degree is an explicit timed rest. |
| Pitch | Extended scale degrees plus stable catalogue `scaleId`, tonic pitch class/MIDI, inclusive register, and `tonic-relative` or `legacy-fixed-octave` mapping. MIDI is derived only at boundaries. |
| Candidate | Stable content-derived ID, melody, and provenance containing strategy/version/seed/settings/generation/parent IDs/named operations. |
| Generator versions | `legacy-simple-v1` and `modern-constrained-v1`. |
| Evolution version | `interactive-evolution-v1`. |
| RNG | Versioned `sfc32-v1`; seeded/forked helpers, with generation/evolution lint rules banning `Math.random()`. |
| Exact phenotype identity | Compatibility-sensitive `melody-v2` fingerprint marker in `src/domain/invariants.ts`; despite its name it predates the product V2 goal. |
| Scale catalogue | 28 stable canonical definitions and scoped aliases. The two historical Super Locrian meanings must remain distinguishable. |
| History | Up to 24 immutable snapshots, stored as a bounded linear array plus index. Evolving from an older index truncates the later array; this is not genuine branch preservation. |
| Favorites | Up to 64 bare candidate copies; no saved name, note, rating, or tags. |
| UI mode | `legacy` or `modern`; evolved candidates are a provenance strategy, not an application destination. |

Legacy generation produces 4–32 equal 480-tick pitched events, independent
uniform internal degrees, tonic endpoints, and historical fixed C4–B4 pitch
classes. Modern generation supports 2–16 integer beats, 120/240/480-tick grids,
4–32 events, sparse rests, tonic-relative registers, leap shaping, motifs, and
optional tonic closure. Existing generator functions and their ordered IDs must
not be reinterpreted by V2.

## Playback and I/O inventory

- A `PlaybackController` owns one active engine session and uses an operation
  token to ignore stale initialization/completion. Starting another candidate,
  Stop, tempo restart, and disposal cancel the active session.
- A pure playback plan converts ticks to seconds at the scheduling boundary.
  Tone.js is loaded lazily from the user gesture and currently creates one
  triangle synth/transport session.
- Candidate/project JSON envelope kinds are `melody-forge-candidate` and
  `melody-forge-project`; both use numeric `schemaVersion: 1`.
- The localStorage key is `melody-forge:project:v1`. The project contains mode,
  Legacy/Modern/evolution settings, history/index, favorites, and loop.
- Import decoders reject malformed, unsupported, or invariant-breaking data.
  A compatibility hazard is that a failed local load returns defaults and the
  current App mount effect can subsequently save those defaults over the same
  key. V2 migration must never follow that path.
- V1 MIDI is Standard MIDI File format 0 with one track, the candidate PPQ as
  division, tick-zero tempo and Acoustic Grand Piano program events, channel-1
  note events at velocity 88, exact rests/trailing duration, and end-of-track
  at `totalTicks`. It has no meter metadata or percussion track.
- Project and candidate export are separate. V1 has no MIDI import or WAV
  rendering.

## Arbitrary and partial phrase timing

V1 has no meter/bar model. `totalTicks` is authoritative and is not restricted
to 4/4 bars. A five-beat phrase is 2,400 ticks at 480 PPQ and must remain exactly
2,400 ticks after migration. It may be displayed as one full 4/4 bar plus a
one-beat partial bar, or under another explicit compatible meter, but it must
never be stretched, trimmed, padded, or regenerated silently.

The V1 decoder's broader contract is material: a valid candidate can use 96
PPQ and represent the same five beats as 480 total ticks. Migration therefore
preserves PPQ per candidate rather than assuming the generator default or one
project-wide PPQ. A mixed-profile project remains valid; any later conversion
to canonical V2 480 PPQ is a previewed child adaptation, never migration.

Static compatibility data under `src/test/fixtures/v1/` captures:

- a five-beat Modern population and two-parent evolved generation;
- a five-note/five-beat Legacy candidate with exact historical pitches;
- favorites with and without history;
- the exact `melody-forge:project:v1` localStorage value;
- official schema-v1 project and candidate JSON exports;
- a valid 96-PPQ candidate and one mixed 96/480-PPQ favorites project;
- exact V1 MIDI bytes and a fixture SHA-256 manifest.

`src/persistence/v1Fixtures.test.ts` validates the complete manifest and exact
payload file set. The raw manifest SHA-256 is
`ce35a6d94fbd17aa4c9b0b37d0ce980ab048bc1bc9c7556b3262cd2aebc8f78a`,
which is hard-coded independently of the manifest contents. Coverage includes stored
degrees, sounding Legacy MIDI pitches, history/favorite IDs, JSON re-encoding,
non-480 and mixed-profile exact tick arrays, localStorage key behavior, MIDI
hash, and the full `/legacy` path/hash set.

## Required migration posture

1. Decode and validate V1 without mutation.
2. Build a candidate-specific compatibility timing profile plus V2
   tonal/default metadata around the existing melody; never rewrite its PPQ,
   events, IDs, seeds, versions, or stored pitch mapping.
3. Derive a deterministic display meter and permit a final partial bar for
   arbitrary totals. Record that the meter was inferred.
4. Persist V2 to the new versioned repository and read it back successfully
   before marking migration complete.
5. Retain the V1 key as a recovery source; never silently clear it.
6. Keep explicit V1 decoders and golden tests for imported schema-v1 project
   and candidate JSON indefinitely.
7. Preserve V1 documentation and screenshots as historical evidence while V2
   adds new documents and artifacts.
