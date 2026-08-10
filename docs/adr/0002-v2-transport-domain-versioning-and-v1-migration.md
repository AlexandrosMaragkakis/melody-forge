# ADR 0002: V2 transport, domain versioning, and V1 migration

- Status: accepted
- Date: 2026-08-09
- Extends: ADR 0001

## Context

V1 already has deterministic integer-tick melodies, shipped defaults of 480
ticks per quarter note, stable candidate and generation IDs, versioned JSON
envelopes, Legacy-specific pitch rendering, and one fixed triangle-synth
audition path. Its schema accepts other positive safe-integer ticksPerBeat
values and it persists no voice selection. It does not have an explicit meter,
bar map, partial-bar model, beat entity, tonal timeline, or one transport shared
by melody, percussion, playhead, MIDI, and offline rendering.

V2 must add those concepts without regenerating or reinterpreting saved V1
material. In particular, arbitrary V1 phrase lengths such as five beats must
retain their exact event timing and sounding pitches. Migration must be safe,
deterministic, idempotent, and recoverable.

## Decision

### Canonical musical time

Retain integer score ticks at 480 PPQ as canonical V2 musical time. Event
onsets, durations, loop boundaries, tonal segments, beat events, locks, history,
MIDI, and WAV plans use ticks. Floating-point seconds exist only at real-time or
offline audio adapter boundaries.

Canonical V2 TransportSpec validation is bounded before derived allocation:
tempo 30–300 BPM inclusive; meter numerator 1–32; denominator 1, 2, 4, 8, or
16; 1–32 ordered positive groups summing to the numerator; at most 256 derived
full/partial BarSpans; and at most 65,536 grid opportunities as
`ceil(loopEndTick/gridTicks)`. Canonical `gridTicks` is a positive safe-integer
divisor of one denominator beat. Parameterized timing helpers require a positive
safe-integer PPQ.

Do not reinterpret that choice as permission to rescale migration input. Every
migrated V1 candidate receives a candidate-specific, versioned compatibility
timing profile containing its exact ticksPerBeat, source grid, event/loop ticks,
tempo, straight swing encoded as 500 permille, and an implicit 4/4 display
interpretation, including when the source is already 480 PPQ. It can be
auditioned and exported through the frozen V1 path.
Canonical V2 comparison, beat pairing, transformation, or evolution requires a
previewed adaptation that creates a new 480-PPQ derivative while leaving the
source candidate unchanged.

Compatibility validation preserves positive-safe PPQ/grid/ticks/loop and any
positive finite V1 tempo even when canonical tempo, meter-shape, 256-BarSpan, or
65,536-opportunity bounds would reject them. This exemption never makes the
profile canonical. A source already at 480 still needs a factor-one derivative
decision. A preserved tempo outside 30–300, overlong loop, or excessive target
grid makes the direct derivative proposal impossible until a separate explicit
tempo/phrase/grid adaptation is previewed and confirmed; source audition and V1
export remain available.

Introduce a versioned TransportSpec containing:

- PPQ and tempo;
- MeterSpec with numerator, denominator, and explicit beat grouping;
- one canonical shared `gridTicks` value for display/comparison;
- exact loop start and loop end ticks;
- swing subdivision and amount;
- meter provenance: explicit, MIDI-imported, or V1-implicit.

Meter groupings are stored domain data. Defaults include 4/4 as [2, 2], 3/4 as
[3], 6/8 as [3, 3], 5/4 as [3, 2], 5/8 as [2, 3], and 7/8 as [2, 2, 3].
Groups must be positive and sum to the meter numerator.

A pure bar-map function partitions the exact half-open loop interval. The final
bar may be partial; loop length is never rounded, padded, trimmed, or stretched
to a complete measure.

### Shared transport and separated concerns

TransportSpec is separate from melody pitch/rhythm genomes, tonal timelines,
beat genomes, performance settings, and audition pairings. `ProjectV2` stores
nullable `comparisonTransportId` as dormant canonical comparison context and
independently nullable `auditionTiming` as the sole scheduler input. Both may
coexist when a canonical comparison is retained while one migrated source is
auditioned through its compatibility profile. This is one controller selecting
one timing plan, not a second clock.

New projects set the comparison ID to the default transport and audition timing
to its canonical reference. Migrated projects start with both null; focusing a
migrated candidate selects only that candidate's profile. A non-null active
pairing must exactly agree with root focused melody, audition timing,
performance, and shared beat references. Compatibility requires null pairing
beat and null shared beat, the source profile, and the compatibility performance
singleton; any mismatch rejects the project graph.

The transport display grid is shared by timeline rulers, default snapping,
beat alignment, and comparison overlays. It is not the melody or beat
generation grid: each genome may record the discretization used by its creative
algorithm without creating another clock or display authority.

- Melody and beat store score ticks against compatible transport profiles.
- Tonal timelines cover the complete loop and modulation boundaries align to
  derived bar boundaries.
- Performance settings select voices, effects, and levels without becoming
  melody or beat genes.
- Directly compared candidates use one comparison transport. Incompatible material
  requires an explicit adaptation preview and decision.

There is one application transport controller. It owns tempo, loop state,
schedule lifetime, visual playhead, and cancellation for melody, beat, effects,
MIDI timing, and WAV rendering.

### Swing

Swing is a versioned score-tick-to-performed-tick map using deterministic
integer/rational arithmetic. It does not rewrite canonical event ticks.
Subdivision pairs preserve their total length.

Two swing subdivisions must divide one denominator-beat unit. Construction,
Reset, and adaptation without explicit swing initialize the subdivision from
the shared display grid when that pair divides the unit, otherwise from half the
unit. Grid and swing subdivision remain separate persisted controls after that
one initializer; Beat and Transport More are synchronized views of the same
transport SwingSpec and Beat never owns swing or edits grid.

Real-time audio, playhead inversion, MIDI rendered-swing export, and offline WAV
use the same timing map. The bar and piano-roll grids remain in score ticks.
Exact rational mapping, inversion, and wrapping have zero tick tolerance. Only
the floating audio-clock/playhead conversion may clamp closed-loop endpoint
error at or below `1e-7` tick; larger/out-of-loop values reject, and fake-clock
agreement remains stricter than `1e-9` second.

### Versioned V2 entities

Add versioned V2 representations alongside V1:

- melody genome, with separate pitch-shape and rhythm genomes;
- complete tonal timeline and canonical custom-scale references;
- beat genome and beat-event lanes;
- performance settings and audition pairing;
- locks, rendered phenotype, and detailed provenance.

Schema version, generator/strategy version, render version, descriptor version,
provenance version, and RNG version remain independent. Existing V1 decoders,
version constants, scale IDs, pitch mapping, exact-musical-fingerprint marker,
and algorithms are frozen compatibility paths. V2 decoding dispatches by
envelope version rather than loosening the V1 decoder.

Existing candidate and snapshot IDs are copied during migration, not
recomputed. New V2-only event IDs are derived deterministically from the source
candidate ID and event ordinal.

Every normalized transport, tonal timeline, custom scale, performance, and
pairing record carries an embedded ID and version. A non-catalogue custom-scale
ID is exactly `custom-pcs-` plus its lowercase three-digit hexadecimal 12-bit
mask; its record version, label, and provenance are not part of that ID.
Transport identity is `stableId('transport', allFieldsExceptId)`; compatibility
timing identity is `stableId('v1-timing', allFieldsExceptId)`, including the
source candidate ID. Both pass complete plain records to the existing helper so
canonical serialization and default-valued fields cannot diverge by caller.

The schema-2 `ProjectV2` and `StoredProjectRecordV2` roots are frozen as listed
in Product section 5.1, including nullable comparison/audition timing,
`nextPreferenceOccurrence`, immutable ordered `preferenceRecordIds`, separate
ID-sorted `activePreferenceRecordIds`, and ordered `libraryItemIds`.
Selection/rating/annotation/migration-receipt ID arrays are unique ID-sorted;
the preference log is occurrence-ordered and Library references retain user
order. Preference records are normalized entities with exact identity
`stableId('preference', preferenceRecordWithoutId)`; undo only changes active
membership and never deletes a decision or reuses an ordinal.

`algorithmVersions` is the closed, ordered
`algorithm-version-registry-v2` record in Product/Architecture section 5.1;
its shipped V1, V2 foundation, six strategy, formula, and MIDI-import literals
cannot be rebound. Schema-2 support tables use the exact embedded/versioned
Create, registered mode payload, snapshot, append-only history occurrence,
Library origin, rating, annotation, and bounded undo records in section 5.1.1.
Unknown mode/snapshot payload versions reject; later milestones must freeze and
register their payload before full-graph codecs can accept them.

`MelodyCandidateV2` is a frozen native/migrated union. Both own a strong genome
reference and inline versioned phenotype cache/descriptors/provenance/lineage;
project-owned rating/annotation rows strongly target candidates through
ProjectV2's exact metadata ID sets and never add candidate-local references.
Only the migrated branch owns the exact frozen schema-1 decoded candidate as
`compatibilitySource`. Parent/history
lineage IDs are soft. Migrated candidate/snapshot IDs are copied; native
candidate, genome, tonal, history, mode, Library, preference, and receipt
identities use the exact formulas in Architecture sections 4–5 and 12.3.

Schema-2 JSON uses frozen `ProjectEnvelopeV2`/`CandidateEnvelopeV2` roots and
declared normalized ID-sorted array tables, including `preferenceRecords` in a
project bundle. Codecs reject unknown keys, duplicates, key/embedded-ID or root
ID mismatch, invalid order, immutable collisions, and unresolved strong
references. Encoding uses fixed key/domain-array order, UTF-8 without BOM, and
exactly one trailing LF, then strict decode-after-encode.

### Frozen V1 audition voice

New V2 projects use the content-derived Soft Pluck performance record:
articulation 55%, accent amount 35%, reverb enabled at 10% with integer
`tailTicks = 960`, delay disabled at 0% while retaining `delayTicks = 240` and
feedback 20%, and melody/beat/effects/master levels 82/68/20/80%. Percentage
fields are integers; general articulation/accent/level bounds are 0–100,
reverb wet 0–30, delay wet 0–25, feedback 0–75, reverb tail 120–3840 ticks,
and delay ticks one of 120/240/480/960. Disabled effect fields remain persisted
and validated. Its ID is `stableId('performance', allFieldsExceptId)`.

Add the internal, non-user-selectable factory ID `v1-triangle-compat`. Both the
retained V1 playback path and migrated V1 playback resolve to the same frozen
factory and its original oscillator, envelope, portamento, volume, velocity,
gate, and routing constants. Migration attaches a compatibility performance
entity because V1 had no setting to copy; it does not choose a user-facing V2
default voice. Golden tests require source/migrated scheduling and factory
parameters to match, with retained listening evidence for audible equivalence.

The compatibility entity is the singleton identified from exactly `{ version:
'v1-compat-performance-v1', voiceFactoryId: 'v1-triangle-compat' }`. Switching
to Soft Pluck or restoring compatibility changes references only; neither path
rewrites the migrated candidate, timing, or frozen factory.

### Deterministic V1 migration

Schema-2 durable domain authority is native IndexedDB database
`melody-forge-v2`, database version 1. Embedded-key `id` stores are exactly
`projects`, `createStates`, `modeStates`, `historyGraphs`, `historyNodes`,
`snapshots`, `melodyCandidates`, `melodyGenomes`, `transports`,
`v1TimingProfiles`, `tonalTimelines`, `customScales`, `beats`,
`performanceSettings`, `pairings`, `preferenceRecords`, `libraryItems`,
`ratings`, `annotations`, `undoStates`, `migrationReceipts`, and `appMetadata`;
receipts have a unique `sourceHash` index. `VersionedProjectStore` is async and
keeps browser request types inside the adapter. Normal save validates a whole
graph and atomically checks/increments the project revision with every changed
strong row. Saving the active project compare-and-swaps and increments the
active metadata revision in that same transaction; saving an inactive project
leaves active metadata untouched. No failure falls back to localStorage.

First native creation and confirmed schema-2 replacement use one explicit
install-and-activate CAS over expected target revision/absence and the complete
expected prior active metadata; the transaction writes and strict-reads the
whole graph before changing active metadata. Opening an existing inactive
project strict-loads its expected revision and swaps only active metadata.
Replace requires explicit preview confirmation. Any stale expectation,
collision, read-back, quota, or decode failure rolls back graph and metadata
together; global Library rows are never replacement garbage collection.

Library rows are global and independently persisted. Project deletion removes
only ordered references, never Library rows. Full project export bundles their
strong closure. Same ID plus identical immutable bytes merges origin references;
same ID plus different immutable bytes rejects. When an item already exists,
its editable name/note/favorite/saved time wins and only origins stable-union;
defaults initialize absent items and only explicit edit/Favorite commands alter
existing metadata.

The sole V2 localStorage record is
`melody-forge:ui-preferences:v2`, with root version exactly
`ui-preferences-v2` and its `values` object. `values` has only these fixed 15 leaves:
`visualDensity='comfortable'`, `reducedMotionOverride='system'`;
`views={library:'grid',map:'visual',pareto:'visual'}`;
`panelSizes={controlsWidthPx:244,inspectorWidthPx:312}`; and Boolean-false
disclosures `transportMore`, `sound`, `beatAdvanced`, `createAdvanced`,
`mutationAdvanced`, `tonalAdvanced`, `history`, `technical`. Density is
comfortable/compact, reduced motion system/reduce, Library grid/list,
Map/Pareto visual/table, controls width integer 216–264, and inspector width
integer 288–336. The generic 64-path gate is only a defensive future bound.
Unknown root/value keys or invalid values reset the whole record. Encoding is
compact declared-order JSON with no BOM or trailing LF.

Automatic complete-project migration:

Its `sourceKind` is exactly `local-storage-project-v1` or
`project-envelope-v1`. The shared pure converter also accepts
`candidate-envelope-v1`, but that source never enters the receipt/activation
protocol.

1. Reads melody-forge:project:v1 without modifying it.
2. Decodes with the frozen schema-1 decoder.
3. Sets `sourceHash` to lowercase
   `sha256(UTF8(stableStringify({ sourceKind, decodedV1 })))` and checks for an
   already verified migration; raw source text/bytes remain separately retained
   for recovery/evidence.
4. Copies settings, seeds, order, active history position, favorites,
   provenance, candidate IDs, and snapshot IDs.
5. Copies every event onset, duration, rest, scale degree, ticksPerBeat,
   gridTicks, and totalTicks exactly.
6. Derives every sounding MIDI pitch through the existing V1 renderer and
   records it in the validated V2 phenotype; no pitch is remapped.
7. Creates a single full-coverage tonal segment from the V1 tonic/scale.
8. Creates a candidate-specific compatibility timing profile, at any source PPQ
   including 480, with implicit 4/4 metadata and exact original totalTicks. A
   non-multiple becomes a partial final bar; this is a display grid addition,
   not a musical conversion.
9. Converts stored linear history to occurrence-ordered normalized nodes. A
   valid previous-generation ID selects the greatest matching earlier source
   ordinal; otherwise the previous stored item is the deterministic parent.
   Repeated identical snapshot IDs share the snapshot row but keep distinct
   occurrence-derived nodes; conflicting bytes reject.
10. Attaches the frozen v1-triangle-compat performance entity and no beat.
11. Validates V2 invariants and compares source/migrated raw ticks, PPQ, timing,
    MIDI, loop, schedule, and compatibility-voice fingerprints.
12. Uses two transactions: first stage the complete graph at revision 1 plus a
    `pending-readback` receipt without changing active metadata; then load it
    through the normal strict reader and repeat equivalence; finally a second
    transaction conditionally marks the receipt `verified` and swaps active
    metadata only if prior-active and staged-revision expectations still match.

The migrated project ID is
`stableId('v1-project', { version: 'v1-project-id-v2', sourceHash })`, root seed
is exactly `v1-migration/${sourceHash}`, name fallback is `Untitled Melody`, and
absent timestamps are null. Both exact V1 strategy seeds remain in Create state.
The migrated root selects Create/Breed/Map, compatibility performance, muted
accompaniment, the copied loop flag, and null comparison/audition/beat/pairing/
focus with empty root selection; history index and selected parents remain in
history/Breed state.
Event IDs use `stableId('event', { version: 'v1-event-id-v2',
sourceCandidateId, ordinal })`. Duplicate candidate IDs deduplicate only when
their frozen decoded `stableStringify` bytes match; otherwise migration rejects.
Rests have no pitch gene, rhythm accent is zero, ties are false, and MIDI comes
only from the frozen V1 renderer.

The original localStorage value is retained as recovery data. A failed decode,
validation, write, read-back, or equivalence check leaves the active project
unchanged and reports an actionable error. Repeating migration for the same
source hash produces the same migrated identities and content.

The receipt root is version `v1-migration-receipt-v2` and contains exactly ID,
migration version fixed to `v1-project-migration-v2.0.0` and equal to the
staged project registry, source kind/hash, project ID, staged revision,
`pending-readback | verified` status, ordered candidate mappings (source,
genome, timing profile, tonal timeline, pairing, compatibility performance),
ordered source-history-ordinal/snapshot-to-history-node mappings, and nullable created/verified epoch
milliseconds. Both receipt timestamps and all absent metadata remain null;
status and timestamps do
not enter receipt identity. A crash between transactions leaves inactive staged
data that the same source hash can strictly revalidate and activate
idempotently.

Candidate mappings contain each unique source candidate once in first-seen
order: active population stored order, then history source ordinal/snapshot
candidate order, then favorites stored order. Equal repeated IDs deduplicate;
unequal frozen bytes reject. Snapshot mappings are source-ordinal ascending.

V1 project JSON uses that same complete-project mapping only after explicit
Replace confirmation. A V1 candidate JSON selection instead produces a
non-durable preview closure. Open previews/auditions; Save to Library or Seed
atomically merges the closure into the current project at an expected revision
without deriving a project ID, creating a migration receipt, or swapping active
metadata.

## Alternatives considered

### Rewrite V1 into the new model in place

Rejected. Changing the schema-1 decoder or V1 algorithms would make regression
failures difficult to distinguish from migration and could silently reinterpret
saved material.

### Use floating-point seconds as the shared timeline

Rejected. Seconds make tempo changes, meter grids, MIDI, deterministic identity,
partial bars, and cross-system synchronization dependent on rounding and audio
clock behavior.

### Silently normalize all V1 events to 480 PPQ

Rejected. Although shipped V1 generators use 480 PPQ, schema 1 accepts other
positive ticksPerBeat values. Rescaling during migration would change their raw
ticks/identity and can add rounding. Compatibility profiles preserve the source;
an explicit derivative-producing adaptation supplies canonical V2 timing when
requested.

### Pad or trim migrated phrases to full 4/4 bars

Rejected. It changes event timing, loop duration, audible output, and exports.
Exact partial bars satisfy the V2 transport model without data loss.

### Store transport fields inside melody and beat

Rejected. Duplicated authorities can drift and make shared comparisons,
tempo changes, playheads, MIDI, and WAV disagree.

### Apply swing by mutating stored event onsets

Rejected. It destroys the unswung score, couples performance to creative genes,
and makes changing swing non-reversible.

### Replace the V1 localStorage record after migration

Rejected. Retaining the source is inexpensive relative to the safety and
recovery value, and avoids silent data loss.

## Checkpoint implementation state

At the 2026-08-10 post-coordinator checkpoint, the canonical transport
and candidate-specific V1 compatibility profiles are implemented as pure domain
foundations. The already-started M2 integration also includes strict migrated
candidate/genome/timeline/pairing records, pure project/candidate conversion,
source-scoped hashes and copied IDs, normalized V1 history/Library mapping,
explicit equivalence reports, the frozen `v1-triangle-compat` performance route,
and a two-phase IndexedDB authority capable of staging and activating a verified
graph. The headless coordinator now invokes this complete ordering, including
both equivalence gates, pending/verified retry, stale CAS, and raw-source
preservation.

This is not an end-to-end UI migration claim. The coordinator is intentionally
not invoked by `App`; the V2 transport is not connected to
controller/UI/MIDI/export; candidate Save/Seed and recovery UI are absent; and
real-browser migration evidence is deferred. These limitations remain M2 work,
and no M3 work begins from this checkpoint.

The checkpoint commit is the commit containing this note and targets `v2`; the
merge handoff resolves its exact SHA. Stable V1 and `legacy/` were not changed
or deployed.

## Consequences

- V1 and V2 adapters coexist until compatibility support is intentionally
  versioned out; this adds code and fixture maintenance.
- Migrated V1 projects gain an implicit 4/4 display interpretation, but exact
  ticks, ticksPerBeat, loop duration, pitches, IDs, and fixed-synth audible
  output remain unchanged.
- Odd meters and partial bars become first-class and testable across every
  playback, visualization, and export path.
- Beat, melody, tonal context, performance, and pairings can evolve or change
  independently while staying synchronized through one transport.
- Swing can be changed or disabled without regenerating creative material.
- V2 persistence requires additional storage for the verified project,
  migration receipt, and retained V1 recovery value.
- Cross-meter or cross-length breeding/import requires explicit adaptation
  data rather than hidden conversion.
- A V1 source remains a first-class compatibility item but cannot enter
  canonical V2 comparison or creative operations until the user creates a
  separately identified 480-PPQ adaptation; a 480 source may adapt with
  unchanged ticks, while a non-480 source retains its rational-conversion
  preview and original profile.
- Golden V1 fixtures must assert event ticks, MIDI pitches, IDs, provenance,
  JSON acceptance, history/favorite survival, and arbitrary-length phrases.
- Transport tests must cover common, compound, odd, and partial meters; swing
  mapping/inversion; live tempo changes; loop boundaries; and agreement among
  audio, playhead, MIDI, and WAV.
