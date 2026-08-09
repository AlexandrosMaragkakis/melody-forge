# Product specification

## Product promise

Build a local-first creative instrument for short monophonic melodies. A user
chooses Legacy or Modern generation constraints, generates about eight
candidates, auditions them, chooses one or two parents, evolves descendants,
revisits recent generations, favorites useful results, and exports JSON or
standard MIDI. It is a focused browser instrument, not a DAW or song generator.

The application is a static TypeScript site with no backend, account, key,
telemetry, runtime API, or remote sample dependency. Browser storage is the
only persistence. The complete app starts through npm or one Docker command.

## Shared domain contract

- Time uses non-negative integer ticks at 480 PPQ. Every event has a positive
  integer duration and starts on the configured grid.
- A melody is an ordered, contiguous monophonic event sequence. A pitched event
  stores an extended scale degree; a rest stores `null`. MIDI is calculated at
  the playback/export/presentation boundary.
- The sum of event durations equals `phraseTicks`. There are no overlaps or
  hidden events.
- Tonic and scale use stable pitch-class and catalogue IDs. Register bounds are
  inclusive integer MIDI pitches.
- Candidate identity and provenance are deterministic data, not timestamps.
  Provenance records generator/evolution version, seed, generation, parent IDs,
  settings, and named operators.
- Identical versioned settings and seed produce byte-equivalent ordered musical
  output and provenance, aside from explicitly non-reproducible UI metadata.

## Strategies

### Legacy generation

- Controls: tonic, catalogue scale, note count 4-32, tempo, seed, population
  size, and Loop for playback.
- Each candidate contains equal 480-tick pitched events and no rests.
- Every initial scale degree is an independent uniform seeded draw; first and
  last are then tonic.
- Sounding pitches use the historical C4-B4 pitch-class mapping, not a
  tonic-relative register. Candidates are labelled Legacy.

### Modern constrained-random generation

- Controls: tonic, scale, tonic-relative low/high octave register, note count,
  tempo, rhythmic grid, optional rests, maximum diatonic leap, tonic closure,
  seed, and population size.
- Defaults favor compact stepwise phrases, occasional direction changes, a
  small reusable motif, sparse rests, and tonic closure.
- Weighted choices are transparent and deterministic. Every result remains in
  scale and register, on grid, positive-duration, contiguous, monophonic, and
  exactly phrase-length. No learned model or aggregate “quality” score exists.
- Optional rests and maximum leap are Modern seed-generation preferences. They
  are not inherited hard constraints: evolution intentionally includes rest
  insertion/removal and occasional larger degree movement.

### Interactive evolution

- Exactly one or two visible candidates may be selected as parents.
- One parent yields controlled mutation; two parents use compatible-boundary or
  contour/rhythm crossover followed by mutation.
- Retention is on by default. Selected parents are copied byte-for-byte as
  elites and remain unchanged. With zero mutation, descendants reproduce the
  parent exactly (candidate provenance/identity may describe the copy).
- Mutation strength has a simple 0-100 control. Operators include nearby-degree
  moves, occasional larger moves, motif repeat/reverse/shift/invert/diatonic
  transpose, rhythm split/merge, and rest toggles. Operators preserve bounds,
  a 4–32 event count, grid, total time, and tonic boundaries by construction or
  via local bounded projection.
- Exact musical fingerprints remove duplicates. Deterministic novelty distance
  (separate normalized pitch, rhythm, and rest components) selects among valid
  attempts when diversity is needed; it is not presented as musical quality.
- The ordered population is reproducible from parents, settings, seed, and
  version. Evolved descendants are labelled Evolved, never Legacy.
- Versioned browser history retains enough immutable snapshots to revisit at
  least the previous generations. Loading history clears stale parent selection
  and stops playback.

## Workspace behavior

- A compact control panel and responsive candidate grid form one workspace.
- Generate creates a new generation-zero population. Candidate cards show an
  index/name, note summary, duration, origin, generation, parent summary, named
  operators, favorite state, parent selection, Play/Stop, and export access.
- Play is a user gesture that initializes audio. Only one melody can sound at a
  time. Starting another, Stop, changing generations, and unmounting cancel all
  prior schedules. Replay starts cleanly; Loop repeats the phrase without
  copying notes. Tempo changes restart the active schedule at the new tempo.
- Parent selection is explicit and limited to two. Evolution is disabled with
  a useful explanation until a parent exists.
- Favorites survive reload. Recent controls, current population, history,
  favorites, and loop preference survive reload under a versioned schema.
- JSON export/import uses a validated versioned envelope and never executes
  input. MIDI export writes a format-0 monophonic file with tempo, note-on/off,
  rests represented as time gaps, and exact tick timing.
- Error, import, and audio status is visible without relying on the console.

## Catalogue

Canonical declarative entries contain `id`, display name, aliases, family, and
ordered pitch-class offsets beginning at zero. The catalogue includes all seven
diatonic modes, all seven harmonic-minor modes, all seven ascending
melodic-minor modes, major/minor pentatonic, major/minor blues, whole-tone, and
both whole-half and half-whole octatonic forms. Historical natural-minor
grouping and ambiguous `super locrian` naming are aliases/metadata, not copied
interval arrays.

## Defaults

- Population: 8; tempo: 108 BPM; tonic: C; scale: Ionian.
- Modern: 8 events over 4 beats, eighth-note grid, C4-C6 tonic-relative range,
  rests off, maximum leap 4 scale degrees, tonic closure on.
- Evolution: mutation 28%, retain elites on, deterministic next-generation seed
  derived from the current generator seed and generation and recorded with the
  resulting snapshot/candidate provenance.
- Synth: one warm, short-release monophonic browser synth at a conservative
  volume; no remote assets.

## Accessibility and responsive acceptance

- Every control has a programmatic label and keyboard operation; visible focus
  is not removed. Toggle state uses native controls or correct ARIA state.
- Status changes are announced politely. Playback is not communicated by color
  alone. Reduced-motion preferences disable non-essential motion.
- The main workflow has no horizontal page scroll at a narrow mobile viewport;
  candidate actions wrap without clipping; touch targets remain usable.
- Contrast, heading order, landmarks, input errors, and disabled explanations
  are checked in the final browser pass.

## Acceptance checks

1. A fresh clone installs and runs with documented npm commands; a documented
   single Docker command builds and serves the entire static site.
2. Legacy, Modern, and Evolved candidates are separate, accurately labelled
   strategies and contain no excluded chord/polyphonic/DAW features.
3. Catalogue/transposition, deterministic RNG, all generator constraints, and
   repeated evolution invariants pass automated tests across all tonics.
4. Mutation, two-parent crossover, elitism, zero-mutation identity,
   deduplication, novelty components, and ordered-population reproducibility are
   directly tested.
5. Playback schedule creation, initialization, stop, replay, tempo change,
   single-player cancellation, looping, and cleanup are tested with a fake
   audio adapter and exercised in a real browser.
6. Persistence, schema rejection/migration behavior, JSON round trips, and exact
   MIDI event timing pass tests.
7. Browser E2E completes generate -> play -> stop -> replay -> select parent(s)
   -> evolve -> audition -> favorite -> reload -> export at desktop and mobile
   sizes with no unexpected console errors.
8. Type checking, lint, unit/integration tests, production build, and E2E all
   pass. Deterministic example seeds are documented for listening, without any
   claim that automated checks prove aesthetic quality.
9. A final sorted SHA-256 manifest exactly matches `LEGACY_SHA256.txt`.
