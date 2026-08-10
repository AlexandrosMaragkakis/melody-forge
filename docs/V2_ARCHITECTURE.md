# Melody Forge V2 architecture

Status: reviewed normative M1 baseline — living implementation specification

Extends: ADR 0001 and the shipped V1 application

Compatibility baseline: project schema 1, candidate schema 1, RNG sfc32-v1,
the shipped 480-PPQ defaults (while schema 1 accepts other positive
ticksPerBeat values), and the hashes in LEGACY_SHA256.txt

## 1. Purpose

V2 is an in-place expansion of the working V1 application. It is not a new
application beside V1 and it is not a rewrite. Existing React, reducer, domain,
generator, evolution, audio, persistence, JSON, and MIDI code remains the
starting point. New modules may replace a V1 implementation only after a
compatibility adapter and regression fixtures prove that the replacement
preserves V1 behavior and data.

The architecture keeps these concerns distinct:

- melody pitch and rhythm;
- tonal context and scale relationships;
- beat generation and beat evolution;
- transport, meter, bars, swing, and scheduling;
- instrument and effect performance settings;
- audition pairings between melodies and beats;
- evolutionary strategies and their mode-specific state;
- descriptors and distances;
- persistence, migration, import, and export;
- application coordination and presentation.

Melody Forge remains a local-first monophonic melody laboratory. Percussion is
a separate optional track. Nothing in this design introduces harmony,
polyphonic melody generation, a DAW, a backend, accounts, telemetry, a plugin
platform, or an automatic universal melody-quality score.

## 2. Non-negotiable compatibility rules

1. Every file under legacy/ is immutable. The complete sorted path-and-hash
   manifest must continue to match LEGACY_SHA256.txt.
2. The current V1 decoders, generator versions, scale IDs, aliases, candidate
   IDs, snapshot IDs, event ticks, stored scale degrees, and pitch-mapping rules
   remain interpretable.
3. Migration never regenerates a V1 melody. It copies its timing and derives
   sounding MIDI through the existing V1 renderer. Migrated playback and MIDI
   pitches must match the source exactly.
4. V1 phrases retain totalTicks exactly. A five-beat phrase remains five beats;
   it is represented as a full bar plus a partial bar rather than padded,
   trimmed, stretched, or silently forced into a four-bar phrase.
5. The localStorage key melody-forge:project:v1 is read but never silently
   removed or overwritten by migration.
6. Existing V1 JSON remains importable. Invalid or unsupported input never
   replaces the active project.
7. The existing melody-only MIDI path remains available for V1-compatible
   export. V2 adds new exporters rather than changing the meaning of the old
   encoder without a versioned route.
8. Existing Legacy and Modern generation, deterministic population ordering,
   one/two-parent evolution, elite identity, favorites, playback, Earlier/Later
   history import, project import/export, and reload restoration remain covered
   by regression tests.
9. Existing V1 documentation remains as historical evidence. V2 documentation
   adds to it rather than rewriting that history.
10. A schema-valid V1 ticksPerBeat value is preserved even when it is not 480.
    Such a candidate keeps its original ticks behind a candidate-specific
    compatibility timing profile until the user explicitly creates a canonical
    480-PPQ V2 adaptation.
11. V1 had no persisted voice selection: every audition used the shipped fixed
    triangle synth. Migration therefore selects the internal frozen
    v1-triangle-compat factory, not a user-facing V2 default voice.

The string melody-v2 in exactMusicalFingerprint is an existing V1 fingerprint
format marker, not the V2 product schema. It must not be renamed casually.

## 3. Dependency direction and module layout

The dependency graph is one-way:

~~~text
domain primitives
  ├── transport and meter
  ├── scales, tonal timelines, and relationships
  ├── melody, beat, performance, locks, and provenance
  └── validation, repair, identity, and seeded randomness
          ↓
generators, transformations, descriptors, and evolution strategies
          ↓
application commands, project state, history, and job orchestration
       ↙             ↓                 ↘
persistence      import/export       playback/render plans
       ↘             ↓                 ↙
              React presentation
       ↙                               ↘
real-time audio adapter          workers and browser adapters
~~~

Pure musical modules must not import React, Tone.js, Web Audio, IndexedDB,
localStorage, File, Worker, Canvas, SVG, or browser clocks. Browser adapters may
depend on pure modules, never the reverse.

V1 files stay in their current locations. V2 grows beside them with focused
modules:

~~~text
src/
  domain/
    transport/       tick arithmetic, meter, bars, swing, loop map
    melody/          pitch/rhythm genomes and deterministic rendering
    tonality/        scale refs, timelines, borrowing, modulation, relations
    beat/            lanes, beat genomes, pattern families, variations
    performance/     voices, articulation, effects, bus levels
    locks/           lock model, conflict detection, preservation checks
    provenance/      contribution and adaptation records
    descriptors/     versioned formulas, normalization, distances
    validation/      aggregate invariants and bounded repair
  generators/        existing Legacy/Modern plus V2 generator adapters
  transformations/   remap, variants, continuation, answering phrase
  evolution/
    strategies/      breed, drift, islands, map, pareto, pair-lab
    common/          deduplication, novelty, deterministic reproduction
  transport/         application transport authority and clock adapter
  audio/             real-time plans, voices, buses, offline render adapter
  import/            MIDI parsing, analysis, preview, confirmed adaptation
  export/            V1 export plus V2 JSON, MIDI, and WAV adapters
  persistence/       version dispatch, migration, IndexedDB, V1-read, UI-pref adapters
  history/           immutable branch graph and separate edit undo/redo
  workers/           serializable job protocol and worker entry points
  app/               project reducer, commands, selectors, job coordination
  components/        shell, workspaces, timelines, charts, tables, inspector
~~~

Barrel files expose public interfaces only. Strategy internals and browser
adapters are not re-exported into the domain layer.

## 4. Versioning policy

Schema versions, algorithm versions, render versions, descriptor versions, RNG
versions, and UI versions are separate concepts.

- schemaVersion identifies serialized envelope shape.
- generatorVersion and strategyVersion identify creative algorithms.
- renderVersion identifies genome-to-event rendering rules.
- descriptorSetVersion identifies formulas and normalization.
- rngVersion identifies the pseudorandom algorithm.
- provenanceVersion identifies contribution/adaptation record shape.
- UI changes do not alter any creative version.

An implementation must dispatch on recorded versions. It must not make an old
version constant point at new behavior. New candidates use V2 version labels;
migrated candidates retain all recorded V1 labels.

Stable IDs are calculated only from the canonical fields named by each entity's
versioned identity formula using stableStringify/stableId or a documented
successor. A formula may deliberately identify domain content across record
versions, as custom-pcs does below; that exclusion must be explicit. Timestamps,
object insertion order, locale, worker completion order, and UI sort order never
enter an ID or creative result. Existing IDs are copied during migration, not
recomputed.

Normalized entity tables never rely on a containing map key as implicit
identity. Transport, tonal timeline, custom scale, performance, and pairing
records each carry both `id` and `version`; references use the `id`, and strict
decoders validate that the table key equals the embedded ID. Value objects such
as MeterSpec and SwingSpec are intentionally not normalized entities and do not
receive artificial IDs.

Identity formulas are registry entries, not caller conventions. Migrated
candidate/snapshot IDs are copied. New metadata project IDs come from an
injected `crypto.randomUUID` factory and never enter creative randomness.
Migrated project/event formulas are in section 12.3. New native candidates use
section 5.8; melody genomes use `stableId('melody-genome', allFieldsExceptId)`;
tonal segments/timelines use `stableId('tonal-segment', allFieldsExceptId)` and
`stableId('tonal-timeline', allFieldsExceptId)`; new snapshots/beats use
`stableId('snapshot', allFieldsExceptId)` and
`stableId('beat', allFieldsExceptId)`. Mutable project singletons use
`stableId('create-state', { version, projectId })`,
`stableId('history-graph', { version, projectId })`, and
`stableId('undo-state', { version, projectId })`. History nodes use
`stableId('history-node', allFieldsExceptId)`; mode states use
`stableId('mode-state', { version, projectId, mode })`; Library items use
`stableId('library-item', { version, kind, componentId })`; preference records
use `stableId('preference', preferenceRecordWithoutId)`; migration receipts use
`stableId('migration-receipt', { version, migrationVersion, sourceHash,
projectId })`. Transport, timing-profile, custom-scale, performance, and pairing
formulas are fixed in their domain sections. Rating/annotation rows are typed-
target singletons using `stableId('rating', { version, projectId, targetKind,
targetId })` and `stableId('annotation', { version, projectId, targetKind,
targetId })`. Editable names/notes, timestamps,
receipt status, caches, descriptor recomputation, rating/
annotation references, and UI order are excluded unless a formula above
explicitly includes them.

## 5. Canonical domain representation

The TypeScript below describes boundaries and required information. Exact names
may be refined during implementation, but fields may not be collapsed across
the stated concerns.

### 5.1 Primitive time and identity

Tick remains a non-negative safe integer. DurationTick is a positive safe
integer. Canonical V2 transports and all new V2 creative operations use 480
PPQ unless a future schema explicitly versions another canonical PPQ. This does
not license migration to rescale V1 source data: schema 1 accepts any positive
safe-integer ticksPerBeat, so non-480 V1 candidates retain their original PPQ
and ticks in the compatibility representation below. MIDI files with another
division are converted only through a previewed, confirmed deterministic
rational rescaler.

Every entity has a stable ID and a data version. Project entity tables are
normalized internally, while candidate/project exports bundle referenced data
so an export remains self-contained.

The schema-2 aggregate root and persistence wrapper have frozen serialized
keys. Internal TypeScript aliases may become more specific, but codecs may not
rename, omit, or add these keys without a new schema:

~~~ts
interface AlgorithmVersionRegistryV2 {
  version: 'algorithm-version-registry-v2'
  generators: {
    legacy: 'legacy-simple-v1'
    modern: 'modern-constrained-v1'
    v1Evolution: 'interactive-evolution-v1'
  }
  foundations: {
    rng: 'sfc32-v1'
    seedTree: 'labelled-seed-tree-v2'
    transport: 'transport-v2'
    v1CompatibilityTiming: 'v1-compat-timing-v1'
    v1TimingAdaptation: 'v1-timing-adaptation-proposal-v1'
    v1Migration: 'v1-project-migration-v2.0.0'
    melodyRender: 'melody-render-v2.0.0'
    candidateProvenance: 'candidate-provenance-v2'
    preferenceEffect: 'preference-effect-v2'
    beatGenerator: 'beat-generator-v2.0.0'
  }
  strategies: {
    breed: 'breed-strategy-v2.0.0'
    drift: 'drift-strategy-v2.0.0'
    islands: 'islands-strategy-v2.0.0'
    map: 'map-elites-strategy-v2.0.0'
    pareto: 'nsga2-pareto-strategy-v2.0.0'
    pairLab: 'pair-lab-strategy-v2.0.0'
  }
  formulas: {
    customScaleDegeneracy: 'custom-scale-degeneracy-v2.0.0'
    tonalRelationship: 'tonal-relationship-v2.0.0'
    tonalMutationBands: 'tonal-mutation-bands-v2.0.0'
    descriptorCore: 'descriptor-core-v2.0.0'
    motifNgrams: 'motif-ngrams-v2.0.0'
    rhythmEntropy: 'rhythm-entropy-v2.0.0'
    meterSyncopation: 'meter-syncopation-v2.0.0'
    pitchParentDistance: 'pitch-parent-distance-v2.0.0'
    rhythmParentDistance: 'rhythm-parent-distance-v2.0.0'
    tonalParentDistance: 'tonal-parent-distance-v2.0.0'
    structuralDistance: 'structural-distance-v2.0.0'
    beatDistance: 'beat-distance-v2.0.0'
    phenotypeDistance: 'phenotype-distance-v2.0.0'
    beatDescriptors: 'beat-descriptors-v2.0.0'
    accentCoincidence: 'accent-coincidence-v2.0.0'
    tonalAxis: 'tonal-axis-v2.0.0'
    islandsGlobalDiversity: 'islands-global-diversity-v2.0.0'
    pairPhenotypeDistance: 'pair-phenotype-distance-v2.0.0'
    pairLabTransition: 'pair-lab-transition-v2.0.0'
    operatorAttemptBudget: 'operator-attempt-budget-v2.0.0'
  }
  midiImport: {
    bounds: 'midi-import-bounds-v2.0.0'
    monophonicExtraction: 'midi-monophonic-extraction-v2.0.0'
  }
}

interface ProjectV2 {
  id: string
  version: 'project-v2'
  schemaVersion: 2
  name: string
  rootSeed: string
  algorithmVersions: AlgorithmVersionRegistryV2
  createdAtEpochMs: number | null
  updatedAtEpochMs: number | null
  destination: 'create' | 'evolve' | 'explore' | 'library'
  activeEvolutionMode: 'breed' | 'drift' | 'islands' | 'pair-lab'
  activeExploreMode: 'map' | 'pareto'
  comparisonTransportId: string | null
  auditionTiming: CandidateTimingRef | null
  activePerformanceId: string
  sharedBeatId: string | null
  activePairingId: string | null
  loopEnabled: boolean
  accompanimentMuted: boolean
  focusedMelodyCandidateId: string | null
  selectedMelodyCandidateIds: readonly string[]
  createStateId: string
  modeStateIds: {
    breed: string
    drift: string
    islands: string
    map: string
    pareto: string
    pairLab: string
  }
  historyGraphId: string
  undoStateId: string
  nextPreferenceOccurrence: number
  preferenceRecordIds: readonly string[]
  activePreferenceRecordIds: readonly string[]
  ratingIds: readonly string[]
  annotationIds: readonly string[]
  libraryItemIds: readonly string[]
  migrationReceiptIds: readonly string[]
}

interface StoredProjectRecordV2 {
  id: string
  version: 'stored-project-record-v2'
  revision: number
  project: ProjectV2
}
~~~

The algorithm registry is a closed record in exactly the declared serialized
key order, including nested keys. New and migrated schema-2 roots initially use
those exact values. Strict decode rejects missing, extra, reordered, or changed
entries. Existing literals are immutable dispatch contracts; adding behavior
requires a new literal and changing the closed shape requires a new registry
version. Frozen migrated-candidate provenance remains the authority for the V1
algorithm that created that source candidate.

Timestamps are `null` or non-negative safe-integer epoch milliseconds and are
organizational only. Fresh-project construction reads one injected metadata
clock value for both fields; V1 migration uses `null` for both. Revision is a positive safe integer owned by persistence,
not creative state, and the stored-record ID must equal `project.id`.
`selectedMelodyCandidateIds`,
`activePreferenceRecordIds`, `ratingIds`, `annotationIds`, and
`migrationReceiptIds` are duplicate-free ID-sorted sets.
`preferenceRecordIds` is the immutable, duplicate-free decision log ordered by
increasing occurrence ordinal. `libraryItemIds` is a duplicate-free
order-bearing global-Library reference list. `nextPreferenceOccurrence` is a
non-negative safe integer greater than every retained preference ordinal and
never decreases or reuses a value.

Within a stored graph or complete project envelope, `ratingIds` and
`annotationIds` are exact sets: they equal all and only rows in their respective
tables whose `projectId` is this project ID. Each row's typed target is a strong
reference to a candidate, beat, or pairing in the same graph; no project-owned
metadata row may be hidden, duplicated through a candidate row, or left
unreachable.

All root IDs are strong except ancestry/lineage references explicitly marked
soft. A non-null `activePairingId` resolves to a pairing whose melody, timing,
performance, and beat exactly equal `focusedMelodyCandidateId`,
`auditionTiming`, `activePerformanceId`, and `sharedBeatId`. Compatibility
timing additionally requires the focused migrated candidate's own profile, the
compatibility performance singleton, and null pairing/project beat IDs. A
retained `comparisonTransportId` may coexist but is dormant during that solo
audition. Any redundant-reference mismatch rejects the aggregate graph.

### 5.1.1 Schema-2 support records and registered state payloads

The normalized support rows needed by project bootstrap and V1 migration have
closed serialized wrappers. A tagged payload is not an arbitrary JSON escape
hatch: its literal version must have a registered exact-key semantic codec.
Schema-2 foundation registers only the payload versions shown here. Each later
mode milestone must freeze and register its own complete payload codec before
that mode can write state; unknown payload versions and keys reject.

~~~ts
type ComponentLockKindV2 =
  | 'relative-pitch-shape'
  | 'rhythm'
  | 'contour'
  | 'opening-event'
  | 'closing-event'
  | 'rest-positions'
  | 'tonal-context'
  | 'tonic'
  | 'scale'

type EventLockScopeV2 = 'pitch' | 'rhythm' | 'both'

interface ComponentLockV2 {
  id: string
  version: 'component-lock-v2'
  kind: ComponentLockKindV2
  capturedEventIds: readonly string[]
  sourceFingerprint: string
}

interface AbsolutePitchRequirementV2 {
  eventId: string
  midi: number
}

interface AbsolutePitchLockV2 {
  id: string
  version: 'absolute-pitch-lock-v2'
  requirements: readonly AbsolutePitchRequirementV2[]
  sourceFingerprint: string
}

interface EventLockV2 {
  id: string
  version: 'event-lock-v2'
  eventId: string
  scope: EventLockScopeV2
  sourceFingerprint: string
}

interface RegionLockV2 {
  id: string
  version: 'region-lock-v2'
  startTick: Tick
  endTick: Tick
  scope: EventLockScopeV2
  capturedEventIds: readonly string[]
  sourceFingerprint: string
}

interface LockSetV2 {
  version: 'lock-set-v2'
  componentLocks: readonly ComponentLockV2[]
  absolutePitchLock: AbsolutePitchLockV2 | null
  eventLocks: readonly EventLockV2[]
  regionLocks: readonly RegionLockV2[]
}

interface LegacyCreateSettingsV2 {
  tonicPitchClass: number
  scaleId: string
  noteCount: number
  tempoBpm: number
  populationSize: number
  seed: string
}

interface ModernCreateSettingsV2 {
  tonicPitchClass: number
  scaleId: string
  registerLowOctave: number
  registerHighOctave: number
  noteCount: number
  phraseBeats: number
  tempoBpm: number
  gridTicks: 120 | 240 | 480
  allowRests: boolean
  maxLeap: number
  tonicClosure: boolean
  populationSize: number
  seed: string
}

interface CreateStateV2 {
  id: string
  version: 'create-state-v2'
  projectId: string
  activeGenerator: 'legacy' | 'modern'
  legacySettings: LegacyCreateSettingsV2
  modernSettings: ModernCreateSettingsV2
}

type EvolutionModeV2 =
  | 'breed'
  | 'drift'
  | 'islands'
  | 'map'
  | 'pareto'
  | 'pair-lab'

interface EmptyModePayloadV2 {
  version: 'empty-mode-state-v2'
  initialized: false
}

interface BreedModePayloadV2 {
  version: 'breed-mode-state-v2.0.0'
  initialized: true
  populationCandidateIds: readonly string[]
  parentCandidateIds: readonly string[]
  populationSize: number
  mutationStrength: number
  retainElites: boolean
  crossoverPolicy: 'conservative-directed'
  exactDeduplication: boolean
  noveltyProtection: boolean
  seed: string
  generationOrdinal: number
}

type RegisteredModePayloadV2 =
  | EmptyModePayloadV2
  | BreedModePayloadV2

interface ModeStateV2 {
  id: string
  version: 'mode-state-v2'
  projectId: string
  mode: EvolutionModeV2
  payload: RegisteredModePayloadV2
}

interface V1EvolutionSettingsV2 {
  populationSize: number
  mutationStrength: number
  retainElites: boolean
}

interface MigratedV1SnapshotPayloadV2 {
  version: 'migrated-v1-snapshot-payload-v2'
  sourceSeed: string
  sourceGeneratorVersion: string
  sourceEvolutionSettings: V1EvolutionSettingsV2 | null
}

type RegisteredSnapshotPayloadV2 = MigratedV1SnapshotPayloadV2

type HistoryModeV2 =
  | 'create'
  | 'breed'
  | 'drift'
  | 'islands'
  | 'map'
  | 'pareto'
  | 'pair-lab'
  | 'import'
  | 'transform'

interface SnapshotV2 {
  id: string
  version: 'snapshot-v2'
  projectId: string
  sourceKind: 'native-v2' | 'migrated-v1'
  mode: HistoryModeV2
  generationOrdinal: number
  seed: string
  algorithmVersions: AlgorithmVersionRegistryV2
  candidateIds: readonly string[]
  selectedCandidateIds: readonly string[]
  ratingIds: readonly string[]
  annotationIds: readonly string[]
  payload: RegisteredSnapshotPayloadV2
}

interface HistoryActionSummaryV2 {
  version: 'history-action-summary-v2'
  kind:
    | 'generate'
    | 'evolve'
    | 'promote-anchor'
    | 'migrate-v1'
    | 'import'
    | 'transform'
}

interface V1LinearHistoryGraphSourceV2 {
  version: 'v1-linear-history-graph-source-v2'
  sourceHistoryLength: number
  sourceHistoryIndex: number
}

interface V1LinearHistoryNodeSourceV2 {
  version: 'v1-linear-history-node-source-v2'
  sourceHistoryOrdinal: number
  sourceSnapshotId: string
  sourcePreviousGenerationId: string | null
  parentResolution:
    | 'root'
    | 'source-previous-generation-id'
    | 'stored-order-fallback'
}

interface HistoryGraphV2 {
  id: string
  version: 'history-graph-v2'
  projectId: string
  nextNodeOccurrence: number
  nodeIds: readonly string[]
  rootNodeIds: readonly string[]
  activeNodeId: string | null
  v1LinearSource: V1LinearHistoryGraphSourceV2 | null
}

interface HistoryNodeV2 {
  id: string
  version: 'history-node-v2'
  projectId: string
  historyGraphId: string
  occurrenceOrdinal: number
  parentNodeId: string | null
  snapshotId: string
  mode: HistoryModeV2
  action: HistoryActionSummaryV2
  v1LinearSource: V1LinearHistoryNodeSourceV2 | null
}

interface LibraryOriginReferenceV2 {
  kind: 'project-save' | 'v1-favorite' | 'json-import'
  projectId: string | null
  historyNodeId: string | null
  sourceHash: string | null
  sourceId: string
}

interface LibraryItemV2 {
  id: string
  version: 'library-item-v2'
  kind: 'melody-candidate' | 'beat' | 'pairing'
  componentId: string
  name: string
  note: string
  favorite: boolean
  savedAtEpochMs: number | null
  originReferences: readonly LibraryOriginReferenceV2[]
}

type UserMetadataTargetKindV2 =
  | 'melody-candidate'
  | 'beat'
  | 'pairing'

interface RatingV2 {
  id: string
  version: 'rating-v2'
  projectId: string
  targetKind: UserMetadataTargetKindV2
  targetId: string
  value: 1 | 2 | 3 | 4 | 5
}

interface AnnotationV2 {
  id: string
  version: 'annotation-v2'
  projectId: string
  targetKind: UserMetadataTargetKindV2
  targetId: string
  text: string
}

interface UndoPatchV2 {
  targetKind:
    | 'project'
    | 'create-state'
    | 'mode-state'
    | 'rating'
    | 'annotation'
    | 'active-preference-membership'
  targetId: string
  fieldPath: readonly string[]
  before: ReadonlyJsonValue
  after: ReadonlyJsonValue
}

interface UndoEntryV2 {
  occurrenceOrdinal: number
  historyNodeId: string | null
  commandId: string
  forwardPatches: readonly UndoPatchV2[]
  inversePatches: readonly UndoPatchV2[]
}

interface UndoStateV2 {
  id: string
  version: 'undo-state-v2'
  projectId: string
  nextOccurrence: number
  undoEntries: readonly UndoEntryV2[]
  redoEntries: readonly UndoEntryV2[]
}
~~~

Lock-set serialized keys follow declaration order. Every lock ID is exactly
`stableId('lock', allFieldsExceptId)`, every fingerprint is lowercase SHA-256
of UTF-8 `stableStringify` of the complete captured scoped value, and all lock
IDs across one set are unique. Lock arrays are sorted by embedded ID in Unicode
code-point order. Component kinds are unique. Their captured event IDs are
unique and event-ID-sorted: relative-pitch, rhythm, contour, and rest locks
capture their complete applicable event set; opening/closing capture exactly
one sounding event; tonal-context, tonic, and scale capture none. Absolute
requirements are nonempty, event-ID-sorted, unique, and use integer MIDI
`0..127`. Event IDs resolve in the owning genome. A region has safe-integer
`0 <= startTick < endTick <= loopEndTick`; its captured IDs are the unique
event-ID-sorted initial half-open intersection set. Scoped fingerprints are
recomputed from the resolved genome/timeline and reject on mismatch.

V1 had no persisted lock feature, so every migrated genome carries exactly
`{version:'lock-set-v2', componentLocks:[], absolutePitchLock:null,
eventLocks:[], regionLocks:[]}`. The M2 codec validates the complete wrapper and
this exact migration default; M5 supplies lock creation, conflict, operator,
and preservation behavior without changing the serialized shape.

Serialized keys follow declaration order. Every support row carries its
embedded ID/version and validates project ownership. Create, mode,
history-graph, and undo IDs use the project-singleton formulas; mode identity
also includes mode. A native snapshot uses stableId('snapshot',
allFieldsExceptId); a migrated snapshot copies the V1 ID. Equal copied IDs
require equal frozen bytes. Candidate arrays retain domain order and are
duplicate-free; selected/parent arrays are order-bearing subsets with at most
two parents. Rating/annotation arrays are ID-sorted sets.

History is normalized and append-only. HistoryGraphV2.id is
stableId('history-graph', { version, projectId }); HistoryNodeV2.id is
stableId('history-node', allFieldsExceptId). nodeIds is occurrence ordered and
nodeIds[i].occurrenceOrdinal equals i; nextNodeOccurrence equals nodeIds.length
and never decreases. Roots are the relative-order subset with null parent.
Every non-root parent belongs to the same project/graph and has a lower
ordinal. The graph is acyclic; every node is reachable once; active is null
exactly for an empty graph. Children are derived from parent links and never
serialized.

For V1 stored history ordinal i, migration copies/deduplicates the snapshot,
creates occurrence i, and preserves original ID/link evidence. The first item
is a root. Thereafter a previousGenerationId match selects the greatest
matching earlier source ordinal; no match falls back to i-1. Mode is Breed for
interactive-evolution-v1 or non-null evolution settings and Create otherwise.
Repeated equal snapshot IDs retain separate nodes; conflicting bytes reject.
The graph records source length/index, and receipt snapshot mappings include
sourceHistoryOrdinal before sourceSnapshotId. Empty history records length
zero/index -1, empty arrays, occurrence zero, and null active.

A Library `componentId` is a strong kind-correct reference. Origin project and
history IDs are soft evidence because a global Library row survives project or
history deletion. Name is at most 80 Unicode scalar values and note at most
280. A migrated V1 favorite is exactly name `Untitled Melody`, empty note,
favorite true, and null saved time. Explicit native/import Save defaults to the
same name/empty note, favorite false, and an injected non-negative safe-integer
metadata-clock value; a Favorite action defaults favorite true. Tests inject
that clock, and migration never reads it. Origin records keep all keys:
project-save requires project ID and null source hash; V1-favorite and
JSON-import require project ID plus source hash; history is nullable and all
other inapplicable fields are null. Origins are duplicate-free and sorted by
stableStringify bytes. Library identity is stableId('library-item', { version,
kind, componentId }); editable metadata and merged origins do not rename it.
Defaults initialize only an absent item. If Save, import, or migration reaches
an existing item ID, the existing target name, note, favorite, and saved time
win byte-for-byte and only the stable-union origin set is merged. No default or
source metadata silently overwrites them. Only an explicit user edit may change
name/note; only an explicit Favorite/Unfavorite action may change favorite;
neither merge path changes savedAtEpochMs. Collision/merge tests cover absent,
same-ID repeated, different-source, and explicit-edit cases.

A rating/annotation target is strong and kind-correct. Ratings are exactly 1-5;
annotation text is at most 280 Unicode scalar values. Their singleton IDs are
exactly `stableId('rating', {version, projectId, targetKind, targetId})` and
`stableId('annotation', {version, projectId, targetKind, targetId})`; editable
value/text is excluded. In a stored project or complete project envelope,
`projectId` is a strong reference equal to the owning root project. Undo keeps
at most 128 entries across both stacks,
oldest to newest with stack top last. Ordinals are unique, below monotonic
nextOccurrence, and never reused. Forward/inverse patches are nonempty exact
inverses in reverse order; field paths and command IDs are registered
reversible operations. Undo may toggle active preference membership but never
delete a preference record or rewind its ordinal. History navigation never
creates an undo entry.

The M2 payload registration set is empty-mode-state-v2,
breed-mode-state-v2.0.0, and migrated-v1-snapshot-payload-v2. Empty is legal
for any unmaterialized mode; Breed payload is legal only on the Breed row.
Later mode and native-snapshot payloads reject until their milestone freezes an
exact interface, registers strict semantic/reference validation, and updates
the full-graph codec evidence.

The M2 melody registration is equally narrow: it accepts only
`candidateKind:'migrated-v1'`, the exact empty LockSetV2 above, catalogue scale
references, null borrowing policies, `RenderedMelodyEvent.borrowing:null`, and
empty custom-scale and beat tables. Native candidates, borrowed-pitch records,
custom-scale provenance, beat provenance, and richer mode/snapshot payloads
reject until their owning milestone registers the exact semantic codec. This
restriction lets migration prove strict schema-2 bytes without treating future
records such as BorrowedPitchUse or BeatProvenance as opaque JSON.

### 5.2 Transport, meter, bars, and partial bars

~~~ts
interface MeterSpec {
  numerator: number
  denominator: 1 | 2 | 4 | 8 | 16
  beatGroups: readonly number[]
}

interface SwingSpec {
  subdivisionTicks: Tick
  amountPermille: number
}

interface TransportSpecV2 {
  id: string
  version: 'transport-v2'
  ppq: 480
  tempoBpm: number
  meter: MeterSpec
  gridTicks: Tick
  loopStartTick: 0
  loopEndTick: Tick
  swing: SwingSpec
  meterSource: 'explicit' | 'midi' | 'v1-implicit'
}

interface V1CompatibilityTimingProfile {
  id: string
  version: 'v1-compat-timing-v1'
  sourceCandidateId: string
  sourceTicksPerBeat: Tick
  sourceGridTicks: Tick
  tempoBpm: number
  displayMeter: MeterSpec
  gridTicks: Tick
  loopStartTick: 0
  loopEndTick: Tick
  swing: SwingSpec & { amountPermille: 500 }
}

type CandidateTimingRef =
  | { kind: 'canonical-transport'; transportId: string }
  | { kind: 'v1-compatibility'; timingProfileId: string }

interface BarSpan {
  index: number
  startTick: Tick
  endTick: Tick
  isPartial: boolean
}
~~~

`ProjectV2.comparisonTransportId` is nullable canonical comparison context;
`ProjectV2.auditionTiming` is independently nullable and is the only timing
reference handed to the scheduler. Both may coexist when canonical comparison
context is retained while a migrated source receives an isolated compatibility
audition. This is one controller selecting one plan, never two clocks.

A new V2 project creates the default canonical transport, stores its ID in
`comparisonTransportId`, and stores `{ kind: 'canonical-transport',
transportId: comparisonTransportId }` in `auditionTiming`. A migrated V1
project initially stores both as `null`; focusing a migrated candidate selects
only its compatibility timing. Confirmed adaptation creates a derivative and
may establish canonical comparison/audition timing without relabelling the
source.

Transport identity uses the existing owned helper without an intermediate
string: `stableId('transport', transportWithoutId)`, where
`transportWithoutId` contains every TransportSpecV2 field shown above except
`id`, including `version`, ordered beatGroups, grid, loop, and swing. A V1
compatibility timing profile analogously uses
`stableId('v1-timing', profileWithoutId)` over every shown field except `id`,
including `sourceCandidateId`. `stableId` performs canonical stableStringify,
so callers must pass the plain complete record and must not omit default-valued
fields.

The notated meter-unit length is ppq times four divided by denominator and must
be an integer. beatGroups must contain positive integers whose sum equals the
numerator. Default groupings are stored, not inferred during playback:

- 4/4: [2, 2]
- 3/4: [3]
- 6/8: [3, 3]
- 5/4: [3, 2]
- 5/8: [2, 3]
- 7/8: [2, 2, 3]

Users may choose another meaningful grouping and it becomes project data.
barLengthTicks is derived from meter. barSpans partitions the exact half-open
interval [loopStartTick, loopEndTick). Its last item may be shorter than a full
bar. No code rounds loopEndTick to a bar.

Canonical validation is exact and bounded: `ppq` is 480; tempo is finite and in
`[30,300]`; meter numerator is an integer in `[1,32]`; denominator is the shown
union; beatGroups has 1–32 items; loopEndTick is a positive safe integer and
`ceil(loopEndTick / barLengthTicks) <= 256`; gridTicks is a positive safe
integer dividing the meter-unit ticks; and
`ceil(loopEndTick / gridTicks) <= 65_536`. These bounds precede any BarSpan or
grid-opportunity allocation. Parameterized meter helpers reject a PPQ that is
not a positive safe integer. A V1CompatibilityTimingProfile instead applies the
frozen schema-1 preservation boundary: positive safe source PPQ/grid/ticks and
positive finite tempo, without canonical tempo, meter-shape, BarSpan-count, or
grid-opportunity limits where those would reject valid V1 data.

Transport `gridTicks` is the one shared project/audition display grid used for
rulers, default snapping, meter-position labels, beat alignment, and comparison
overlays. It is transport data. It is deliberately distinct from a melody
RhythmGenome's `sourceGridTicks` (and a BeatGenomeV2's corresponding field), which
records the discretization an algorithm used and may differ without creating
another playback clock or display authority.

V1 migration assigns the display default 4/4, copies tempoBpm, ticksPerBeat,
gridTicks, totalTicks, and every event tick exactly, and derives full plus
partial bar spans. Every migrated V1 candidate, including a usual 480-PPQ
candidate, receives a candidate-specific V1CompatibilityTimingProfile whose ID
includes the preserved source candidate identity and timing values. This keeps
V1 compatibility identity distinct from canonical V2 creative material even
when their numeric PPQ happens to match. The profile is valid only for
compatibility audition, display, and V1 export; it is never silently installed
as the shared transport for V2 comparison, beat pairing, transformation, or
evolution.

The migration mapping is exact:

~~~ts
const profileWithoutId = {
  version: 'v1-compat-timing-v1',
  sourceCandidateId: candidate.id,
  sourceTicksPerBeat: constraints.ticksPerBeat,
  sourceGridTicks: constraints.gridTicks,
  tempoBpm: constraints.tempoBpm,
  displayMeter: { numerator: 4, denominator: 4, beatGroups: [2, 2] },
  gridTicks: constraints.gridTicks,
  loopStartTick: 0,
  loopEndTick: constraints.totalTicks,
  swing: { subdivisionTicks: constraints.gridTicks, amountPermille: 500 },
}
~~~

The compatibility validator accepts every positive safe-integer source PPQ/grid
already accepted by the frozen V1 decoder; canonical TransportSpec divisibility
rules are not retroactively imposed on it.

To use a compatibility profile in a V2 comparison or creative operation, the
application previews an AdaptationDecision that rationally maps all event and
loop endpoints to canonical 480 PPQ, lists every rounded or repaired endpoint,
and creates a new V2 derivative with adaptation provenance and a new identity.
Confirmation never edits, replaces, or re-identifies the migrated source. A
rejected or failed adaptation leaves both project state and source bytes
unchanged.

The source-boundary array is dense and capped at 258 entries: two endpoints for
each of the frozen V1 decoder's at most 128 events plus loop start/end. Sparse,
unordered, invalid, or oversized direct adapter input rejects before rational
mapping or allocation.

This derivative boundary applies to every compatibility profile, including one
whose `sourceTicksPerBeat` is 480. For that case the rescale factor is exactly
`480/480 = 1`, every timing endpoint and grid proposal is listed as unchanged,
and the decision records no rounding; confirmation still creates a canonical-
timing reference and new candidate identity rather than relabelling the source.

The proposal validates the complete target TransportSpec. A preserved V1 tempo
outside `[30,300]`, a target loop over 256 BarSpans, or a target grid over 65,536
opportunities makes the direct proposal `impossible`, without invalidating the
compatibility profile. A higher-level command may request a separate explicit
target-tempo, phrase-length, or grid AdaptationDecision and rebuild the proposal;
it may not clamp/trim/pad inside the PPQ adapter. Until a fully canonical target
validates, compatibility audition/display/V1 export remain available and no
derivative command can commit.

Swing is a transport performance mapping, not a destructive rewrite of melody
or beat onsets. A pure TickTimingMap maps score ticks to performed ticks using
integer/rational arithmetic and preserves each subdivision pair's total. Audio,
playhead, MIDI, and WAV rendering use the same map. Visual grid geometry remains
in score ticks and the playhead uses the inverse timing map. An
`amountPermille` value of 500 is straight; user-visible V2 values are bounded
through 750 inclusive. Two swing subdivisions must divide one denominator-beat
unit, which anchors every beat/group/bar boundary. The default subdivision is
the shared `gridTicks` when such a pair divides the unit, otherwise half the
unit; this lets a coarse beat grid retain an ordinary offbeat swing pair.

Transport construction, Reset, and adaptation without an explicit SwingSpec
run that initializer once. Thereafter `gridTicks` and
`swing.subdivisionTicks` are independent persisted fields with distinct
commands: editing one never rewrites the other. Transport More and Beat are two
views of the same complete `transport.swing` field; the Beat command never edits
`gridTicks`. Exact rational forward/inverse transforms and loop wrapping admit
zero tick error. At only the floating audio-clock/playhead adapter boundary, a
computed value within `1e-7` tick of a closed loop endpoint may clamp to that
endpoint; larger or meaningfully out-of-loop values reject. Audio fake-clock
agreement remains stricter than `1e-9` second.

### 5.3 Melody pitch shape and rhythm

~~~ts
interface PitchGene {
  eventId: string
  extendedDegree: number
}

interface PitchShapeGenome {
  version: 'pitch-shape-v2'
  mapping: 'tonal-relative' | 'legacy-fixed-octave' | 'absolute-import'
  genes: readonly PitchGene[]
  register: { minMidi: number; maxMidi: number }
}

interface RhythmGene {
  eventId: string
  onsetTick: Tick
  durationTicks: Tick
  isRest: boolean
  accent: number
  tieToNext: boolean
}

interface RhythmGenome {
  version: 'rhythm-v2'
  events: readonly RhythmGene[]
  sourceGridTicks: Tick
}

interface MelodyGenomeV2 {
  version: 'melody-genome-v2'
  id: string
  pitchShape: PitchShapeGenome
  rhythm: RhythmGenome
  tonalTimelineId: string
  timing: CandidateTimingRef
  locks: LockSetV2
}

interface RenderedMelodyEvent {
  eventId: string
  onsetTick: Tick
  durationTicks: Tick
  midi: number | null
  velocity: number
  tonalSegmentId: string
  borrowing: BorrowedPitchUse | null
  contributionIds: readonly string[]
}
~~~

Pitch shape and rhythm share stable event IDs but are independently replaceable
and lockable. Rest position belongs to rhythm. A rest has no PitchGene. Ties
affect articulation/rendering but never create hidden overlap.

MelodyGenomeV2 is the versioned creative aggregate. Its tonal and timing
fields are references rather than embedded copies, so those concerns retain
their own validators and identities. A V1 event has no event ID; migration
derives one deterministically from the preserved source candidate ID and event
ordinal without changing the candidate ID.

The renderer consumes pitch shape, rhythm, tonal timeline, the resolved
CandidateTimingRef, and locks and returns concrete monophonic events plus a
render report. The cached
phenotype includes renderVersion and an input fingerprint; validation rejects
a stale cache. Creative algorithms operate on genomes, while playback and
export operate on validated rendered events.

Legacy candidates retain legacy-fixed-octave mapping. Migration computes and
stores the expected MIDI for every sounding event using the existing
melodyDegreeToMidi path and tests it against V1 playback/MIDI fixtures.

### 5.4 Tonal timeline and custom scales

~~~ts
type ScaleRef =
  | { kind: 'catalogue'; scaleId: string }
  | { kind: 'custom'; customScaleId: string }

interface TonalSegment {
  id: string
  startTick: Tick
  endTick: Tick
  tonicPitchClass: number
  tonicMidi: number
  scale: ScaleRef
  borrowingPolicyId: string | null
}

interface TonalTimelineV2 {
  id: string
  version: 'tonal-timeline-v2'
  segments: readonly TonalSegment[]
}

interface ScaleOriginV2 {
  id: string
  version: 'scale-origin-v2'
  kind: 'create' | 'add' | 'remove' | 'shift' | 'recombine' | 'repair' | 'import'
  parentScaleIds: readonly string[]
  operatorId: string
  seedPath: readonly string[]
  parameters: ReadonlyJsonObject
}

interface ScaleProvenanceV2 {
  version: 'scale-provenance-v2'
  origins: readonly ScaleOriginV2[]
}

interface CustomScaleV2 {
  id: string
  version: 'custom-scale-v2'
  tonicRelativePitchClassMask: number
  pitchClasses: readonly number[]
  cardinality: number
  label: string
  provenance: ScaleProvenanceV2
}
~~~

Tonal timeline identity is `stableId('tonal-timeline', timelineWithoutId)` over
every shown timeline field except `id`, including version and ordered segments.

Segments are ordered, non-overlapping, and cover every tick from zero through
loopEndTick exactly once. Segment boundaries after tick zero must be bar
boundaries. A partial final bar cannot contain an internal modulation boundary.

A custom scale is a canonical tonic-relative 12-bit set. The strict validator
requires an integer mask in `[1,0xfff]`, bit zero, cardinality 4–9, and a
duplicate-free ascending `pitchClasses` array exactly equal to the mask's set
bits; `cardinality` must equal its length and popcount. It also runs
`custom-scale-degeneracy-v2.0.0`: for cardinality `k`, reject exactly when some
arc start `s` in `0…11` contains every selected `p` at clockwise distance
`(p-s+12)%12 <= k-1`. Validation then rejects a mask equal to any catalogue
entry with `catalogue-mask-requires-catalogue-ref`; catalogue matching resolves
to `ScaleRef.kind = 'catalogue'`, so CustomScaleV2 deliberately has no nullable
`matchedCatalogueScaleId` state.

Every remaining non-catalogue ID is exactly `custom-pcs-` followed by
`tonicRelativePitchClassMask.toString(16).padStart(3, '0')` in lowercase. For
example mask `0x123` enumerates `{0,1,5,8}`, is non-degenerate, and has valid ID
`custom-pcs-123`. The three hexadecimal digits encode the 12-bit mask.
`version`, label, display spelling, and provenance are deliberately excluded
from custom-scale identity; changing a data version does not rename the
pitch-class set. The label is derived exactly as
`Custom ${pitchClasses.join(', ')}` and is not editable entity identity. Each
origin ID is `stableId('scale-origin', allFieldsExceptId)`; parent IDs are
unique, ID-sorted soft ancestry, and origins are unique and origin-ID-sorted.
For the same custom-scale ID, structural fields and derived label must match
byte-for-byte, while persistence/import merges provenance by stable union of
origin IDs. The same origin ID with different bytes rejects. This registered
mergeable metadata is the sole CustomScale exception to the ordinary
immutable-ID/different-byte collision rule; export includes the complete
merged origin set and reimport is idempotent.

Borrowing is base scale plus an explicit donor relationship; it is never an
anonymous merged scale. BorrowedPitchUse records donor scale, donor-exclusive
pitch class, source operator, strong-beat rule, resolution target, and
resolution tick. A pitch shared by base and donor is not marked borrowed.

The tonal relationship graph is a pure, versioned service over catalogue and
custom scales. Edge explanations and component distances cover pitch-class
overlap, pitch-class-set distance, modal/parallel/relative relationships,
one-note alterations, tonic distance, and circle-of-fifths distance.

`tonal-mutation-bands-v2.0.0` consumes the symmetric direct relationship
distance and a stable-ID-sorted node list. Low selects one `0 < d <= .25` edge
with weight `1-d`, falling back to equal weight over minimum-positive-distance
nodes. Medium performs exactly two independently labelled hops; each uses
`0 < d <= .50` and weight `1-d`, excludes the immediately prior node, and hop
two also excludes the source. An empty band uses equal weight over the eligible
minimum-positive-distance nodes; no eligible fallback rejects the proposal.
High selects once across every non-self node with weight `d`, using equal weight
only when the sum is zero. Each probability is `weight/sum`, selection uses
seeded cumulative intervals in stable ID order, and provenance stores eligible
nodes, normalized probabilities, and every hop.

### 5.5 Beat genome

~~~ts
type BeatLane =
  | 'kick'
  | 'snare-clap'
  | 'closed-hat'
  | 'open-hat'
  | 'auxiliary'

type BeatVoice =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'closed-hat'
  | 'open-hat'
  | 'tom'
  | 'percussion'

type FillFrequency =
  | 'never'
  | 'every-2-bars'
  | 'every-4-bars'
  | 'every-8-bars'
  | 'final-bar-only'

type BeatLockGroup = 'kick' | 'snare-clap' | 'hats' | 'auxiliary'

interface BeatLockSet {
  wholeBeat: boolean
  groups: readonly BeatLockGroup[]
}

interface BeatEvent {
  id: string
  lane: BeatLane
  voice: BeatVoice
  onsetTick: Tick
  durationTicks: DurationTick
  velocity: number
  accent: boolean
  source: 'base' | 'variation' | 'fill' | 'repair'
}

interface BeatGenomeV2 {
  version: 'beat-v2'
  id: string
  transportId: string
  sourceGridTicks: Tick
  enabledLanes: readonly BeatLane[]
  family:
    | 'sparse'
    | 'straight'
    | 'half-time'
    | 'four-on-the-floor'
    | 'breakbeat'
    | 'odd-meter'
  seed: string
  variationIndex: number
  density: number
  fillFrequency: FillFrequency
  variationStrength: number
  events: readonly BeatEvent[]
  provenance: BeatProvenance
}
~~~

Beat is never embedded in MelodyGenome. Beat generation consumes the same meter,
groups, loop boundary, swing, and PPQ as the audition transport. Ordinary
candidate comparisons reference one shared locked beat by default. Only Pair
Lab may intentionally compare different melody/beat pairings.

`enabledLanes` is a non-empty unique subset serialized in the canonical BeatLane
order above, and every event lane must be enabled. Voice mapping is strict:
kick→kick, snare-clap→snare or clap, closed-hat→closed-hat,
open-hat→open-hat, and auxiliary→tom or percussion. Raw voices never become
extra lane identities. The final enabled lane cannot be disabled; absence or
performance mute, rather than an empty lane set, represents no audible beat.

Fill scheduling uses derived one-based BarSpan ordinals: every-N targets
ordinals divisible by N and final-bar-only targets the last full or partial
span. BeatLockSet is separately persisted strategy/project state. Its group
order is the union order above; `hats` freezes both hat lanes and `auxiliary`
freezes both auxiliary voices. A whole-beat lock fingerprints every BeatGenomeV2
field, while a group lock fingerprints the canonical event sequence and enabled
state for its covered lanes. Repairs may not cross either fingerprint.

Beat variations use a beat-only seed stream. Changing beat controls cannot
alter melody IDs, genomes, candidates, archives, or strategy state. Final-bar
fills are generated against the actual final BarSpan and cannot exceed
loopEndTick.

### 5.6 Performance and audition pairing

~~~ts
interface PerformanceSettingsV2 {
  id: string
  version: 'performance-v2'
  voice:
    | 'soft-pluck'
    | 'bell-mallet'
    | 'warm-lead'
    | 'bass'
    | 'chiptune'
    | 'soft-keys'
  articulation: number
  accentAmount: number
  reverb: { enabled: boolean; amount: number; tailTicks: Tick }
  delay: { enabled: boolean; amount: number; delayTicks: Tick; feedback: number }
  melodyVolume: number
  beatVolume: number
  effectsVolume: number
  masterVolume: number
}

interface V1CompatibilityPerformanceSettings {
  id: string
  version: 'v1-compat-performance-v1'
  voiceFactoryId: 'v1-triangle-compat'
}

type PerformanceSettings =
  | PerformanceSettingsV2
  | V1CompatibilityPerformanceSettings

interface AuditionPairing {
  id: string
  version: 'audition-pairing-v2'
  melodyCandidateId: string
  beatId: string | null
  timing: CandidateTimingRef
  performanceId: string
}
~~~

Every number in `PerformanceSettingsV2` other than tick fields is an integer
percentage point. The fixed new-project registry entry is:

~~~ts
const DEFAULT_SOFT_PLUCK_PERFORMANCE_V2 = {
  version: 'performance-v2',
  voice: 'soft-pluck',
  articulation: 55,
  accentAmount: 35,
  reverb: { enabled: true, amount: 10, tailTicks: 960 },
  delay: { enabled: false, amount: 0, delayTicks: 240, feedback: 20 },
  melodyVolume: 82,
  beatVolume: 68,
  effectsVolume: 20,
  masterVolume: 80,
} as const
~~~

Strict bounds are: articulation, accent, melody/beat/effects/master volume
`0…100`; reverb amount `0…30`; delay amount `0…25`; delay feedback `0…75`;
integer `tailTicks` `120…3840`; and `delayTicks` exactly one of `120`, `240`,
`480`, or `960`. Disabled effect objects retain and validate every field. The
default ID is `stableId('performance', DEFAULT_SOFT_PLUCK_PERFORMANCE_V2)`.

Performance identity is `stableId('performance', settingsWithoutId)` over every
field of the applicable union member except `id`. Pairing identity is
`stableId('pairing', pairingWithoutId)` over every shown pairing field except
`id`. Thus the compatibility performance singleton is deterministically named
from `{ version: 'v1-compat-performance-v1', voiceFactoryId:
'v1-triangle-compat' }`, without a timestamp or migration-run identifier.

CandidateTimingRef is the only polymorphic timing-reference boundary. Canonical
V2 melodies, beats, and pairings use `canonical-transport`; migrated V1
melodies and their beat-null compatibility pairings use `v1-compatibility`. A
strict validator rejects a beat or mixed-candidate comparison attached to the
latter.

Performance settings are not creative genes. Changing voice, articulation,
effects, or volume auditions the same melody and beat without regeneration.
Pairing identity is separate from component identity, parentage, favorites, and
feedback.

`v1-triangle-compat` is an internal, non-user-selectable voice factory. It is
the single frozen implementation used by both the retained V1 playback route
and migrated V1 audition: Tone Synth triangle oscillator; attack 0.008, decay
0.12, sustain 0.42, release 0.16; portamento 0.008; synth volume -8 dB;
trigger velocity 0.72; and a gate of `max(0.01 seconds, 0.9 × source event
duration)`, through the original direct destination topology. These constants
are a compatibility algorithm, not editable PerformanceSettings knobs.

Because V1 persisted no performance choice, migration creates/reuses a frozen
V1CompatibilityPerformanceSettings entity selecting this factory and associates
it with every migrated V1 audition. It must not substitute soft-pluck or any
other V2 default. The compatibility record exposes no articulation, effects,
send, or volume fields: all frozen constants and direct routing belong to its
factory. Selecting a V2 voice later creates a normal PerformanceSettingsV2
reference without modifying the migrated candidate. Audible-equivalence tests
send the same golden V1 melody
through the source and migrated routes and require identical MIDI frequencies,
start/duration seconds (using the preserved ticksPerBeat), gate seconds,
velocity, factory parameters, loop length, and scheduled-event order. The
retained listening fixture confirms perceptual equivalence, while browser tests
assert that the factory is not exposed as an editable preset.

The compatibility entity is a content-derived singleton with ID
`stableId('performance', { version: 'v1-compat-performance-v1',
voiceFactoryId: 'v1-triangle-compat' })`. A migrated project and its beat-null
compatibility pairings initially reference it. Switching to a curated preset
or restoring compatibility changes only performance/pairing/root references;
it never rewrites candidate, compatibility-source, genome, timing, or factory
bytes.

### 5.7 Locks and frozen material

LockSetV2 represents:

- relative pitch shape;
- absolute sounding MIDI pitches;
- rhythm;
- contour;
- opening/closing events;
- rest positions;
- selected events or tick regions;
- tonal context, tonic, and scale independently;
- complete beat and the four BeatLockGroups independently.

Relative and absolute pitch locks have different validation. Relative lock
hashes extended-degree shape and allows compatible tonal rendering. Absolute
lock stores event-to-MIDI requirements and rejects tonal operations that cannot
preserve them. Contradictory locks are reported before a job starts.

Every operator receives an immutable LockMask. Validation compares canonical
before/after fingerprints for each frozen component. Repair is not permitted to
change a frozen component.

RegionLockV2 stores `startTick`, exclusive `endTick`, scope
`'pitch' | 'rhythm' | 'both'`, initial intersecting event IDs, and scoped
fingerprints. Intersection is exactly
`max(eventStart,startTick) < min(eventEnd,endTick)`. The preservation validator
takes the union of captured IDs and IDs intersecting in before and after states.
For each such ID
it requires the complete scoped value object on both sides and identical
canonical bytes: full PitchGene for pitch, full RhythmGene including onset,
duration, rest, accent, and tie for rhythm, or both. Boundary contact alone does
not intersect; a straddling event is covered whole and is never split. Missing,
new, reidentified, or boundary-crossing scoped genes therefore fail rather than
escaping a region through geometry.

### 5.8 Candidate and provenance aggregates

The serialized aggregate key order is frozen as `id`, `version`,
`candidateKind`, `melodyGenomeId`, `renderedPhenotype`, `descriptorValues`,
`provenance`, `lineage`, `compatibilitySource`:

~~~ts
interface RenderedMelodyPhenotypeV2 {
  version: 'rendered-melody-phenotype-v2'
  renderVersion: string
  inputFingerprint: string
  timingFingerprint: string
  events: readonly RenderedMelodyEvent[]
  phenotypeFingerprint: string
}

interface CandidateDescriptorValueV2 {
  descriptorId: string
  formulaVersion: string
  rawValue: number | null
  normalizedValue: number | null
  dependencyFingerprint: string
}

interface CandidateOperationProvenanceV2 {
  version: 'candidate-operation-v2'
  kind:
    | 'generate'
    | 'import'
    | 'crossover'
    | 'mutation'
    | 'transform'
    | 'adapt'
    | 'borrow'
    | 'modulate'
  operatorId: string
  parameters: ReadonlyJsonObject
}

interface CandidateContributionV2 {
  id: string
  version: 'candidate-contribution-v2'
  eventId: string
  component: 'pitch' | 'rhythm' | 'tonal'
  source:
    | 'generator'
    | 'import'
    | 'migrated-v1'
    | 'parent-a'
    | 'parent-b'
    | 'mutation'
    | 'remap'
    | 'repair'
    | 'elite'
  sourceCandidateId: string | null
  sourceEventId: string | null
}

interface CandidateRepairV2 {
  id: string
  version: 'candidate-repair-v2'
  reasonCode: string
  changes: readonly {
    fieldPath: string
    before: ReadonlyJsonValue
    after: ReadonlyJsonValue
  }[]
}

interface LockVerificationFingerprintV2 {
  lockId: string
  scopeFingerprint: string
  resultFingerprint: string
  preserved: true
}

interface CandidateProvenanceV2 {
  version: 'candidate-provenance-v2'
  rootSeed: string
  seedPath: readonly string[]
  rngVersion: string
  algorithmVersion: string
  renderVersion: string
  descriptorSetVersion: string
  operations: readonly CandidateOperationProvenanceV2[]
  contributions: readonly CandidateContributionV2[]
  repairs: readonly CandidateRepairV2[]
  lockVerificationFingerprints: readonly LockVerificationFingerprintV2[]
}

interface CandidateLineageV2 {
  version: 'candidate-lineage-v2'
  geneticParentCandidateIds: readonly string[]
  componentParentCandidateIds: {
    pitch: readonly string[]
    rhythm: readonly string[]
    tonal: readonly string[]
  }
  sourceHistoryNodeIds: readonly string[]
}

interface FrozenV1CandidateV1 {
  id: string
  melody: {
    events: readonly {
      startTick: number
      durationTicks: number
      degree: number | null
    }[]
    constraints: {
      scaleId: string
      tonicPitchClass: number
      tonicMidi: number
      register: { minMidi: number; maxMidi: number }
      pitchMapping: 'tonic-relative' | 'legacy-fixed-octave'
      ticksPerBeat: number
      gridTicks: number
      totalTicks: number
      tempoBpm: number
      tonicBoundary: { start: boolean; end: boolean }
    }
  }
  provenance: {
    strategy: 'legacy' | 'modern' | 'evolution'
    generatorVersion: string
    seed: string
    settings: ReadonlyJsonObject
    generation: number
    parentIds: readonly string[]
    operations: readonly {
      operator: string
      parameters: ReadonlyJsonObject
    }[]
  }
}

interface V1CompatibilitySourceV2 {
  version: 'frozen-v1-candidate-v1'
  candidate: FrozenV1CandidateV1
}

interface NativeMelodyCandidateV2 {
  id: string
  version: 'melody-candidate-v2'
  candidateKind: 'native-v2'
  melodyGenomeId: string
  renderedPhenotype: RenderedMelodyPhenotypeV2
  descriptorValues: readonly CandidateDescriptorValueV2[]
  provenance: CandidateProvenanceV2
  lineage: CandidateLineageV2
  compatibilitySource: null
}

interface MigratedV1MelodyCandidateV2
  extends Omit<NativeMelodyCandidateV2, 'candidateKind' | 'compatibilitySource'> {
  candidateKind: 'migrated-v1'
  compatibilitySource: V1CompatibilitySourceV2
}

type MelodyCandidateV2 =
  | NativeMelodyCandidateV2
  | MigratedV1MelodyCandidateV2
~~~

`FrozenV1CandidateV1` is the exact schema-1 decoder value frozen in Product
section 5.1: root `id`, complete melody events/constraints, and complete V1
provenance. Its ID equals the migrated aggregate ID. It is the authority for
direct V1 export and compatibility equivalence; no encoder reconstructs it
from V2 fields.

The candidate strongly owns one `melodyGenomeId`. Project-local ratings and
annotations target it from their normalized rows and ProjectV2 ID sets; their
IDs are deliberately absent from this globally reusable candidate row. The genome in turn strongly references its
timing and tonal timeline, and the timeline strongly references custom scales
where used. Descriptor values, provenance, lineage, and phenotype cache are
inline immutable values, not omitted tables. Beat and performance remain
separate. Genetic-parent/source-history IDs inside lineage are soft; they do
not require an unbounded ancestry export. Rendered-event contribution IDs must
resolve within the same candidate's inline provenance and never imply an
unlisted entity table. Contribution/repair IDs are respectively
`stableId('candidate-contribution', allFieldsExceptId)` and
`stableId('candidate-repair', allFieldsExceptId)`. `ReadonlyJsonValue` permits
finite JSON only; stable serialization canonicalizes its object keys.

The cache input fingerprint is lowercase SHA-256 of UTF-8
`stableStringify({ renderVersion, melodyGenome, tonalTimeline, timing })`.
Decode resolves those rows, rerenders, and rejects any input, timing, event, or
phenotype fingerprint mismatch. Migrated candidate IDs are copied. Native IDs
are `stableId('melody-candidate', { version, candidateKind, melodyGenomeId,
provenance, lineage })`; derived cache/descriptors and project-local metadata do
not participate.

Provenance records:

- root seed, complete labelled seed path, RNG and algorithm versions;
- genetic parent IDs separately from history parents;
- per-component and per-event Parent A/Parent B contributions;
- mutation operator and parameters;
- remapping/adaptation source and destination;
- borrowing and modulation operations;
- deterministic repair reason and exact changes;
- frozen-component verification fingerprints.

Raw provenance is technical data for inspectors and exports, not ordinary card
content.

## 6. Deterministic seed tree

V2 retains sfc32-v1 and SeededRandom for V1 reproduction. A small SeedTree
wrapper creates stable, labelled forks. Labels are constants, never translated
UI strings.

~~~text
root
  generator/<generator-version>
  generation/<generation-id-or-ordinal>
  algorithm/<strategy-version>
  island/<island-id>
  map-cell/<descriptor-cell-id>
  pareto-run/<run-id>
  candidate/<stable-slot>
  operator/<operator-id>
  melody
  rhythm
  tonality
  beat
  collaborator-selection/<schedule-slot>
  ui-only-shuffling/<view-id>
  attempt/<bounded-attempt-index>
~~~

Paths are composed from stable entity IDs or fixed zero-padded ordinals. A new
random consumer must receive its own label rather than consuming values from a
shared sequential stream. Consequently:

- beat changes do not change melody;
- descriptor recalculation does not change evolution;
- UI sorting/shuffling does not change populations;
- one island's retries do not change another island;
- worker partitioning/completion order does not change result order;
- collaborator schedules reproduce independently from pair display order.

All loops have explicit attempt bounds. Output arrays are sorted by stable slot
or domain key before identity/provenance calculation.

## 7. Evolution strategy boundary

All six workflows implement a small common orchestration contract while owning
distinct state and algorithms.

~~~ts
interface EvolutionStrategy<State, Command, Job, Result> {
  readonly id: EvolutionMode
  readonly version: string
  initialize(input: StrategyInitialization): State
  prepare(state: State, command: Command, context: StrategyContext): Job
  run(job: Job, control: DeterministicJobControl): Result
  apply(state: State, result: Result): State
  validate(state: State): readonly DomainIssue[]
}
~~~

initialize, prepare, run, apply, and validate are pure with respect to React,
audio, storage, and browser APIs. DeterministicJobControl exposes cancellation
checks and progress reporting but no clock or randomness. The Job contains all
seed paths and versions needed to reproduce it.

Mode states persist simultaneously. Changing Evolve modes only changes an
active-mode pointer; it does not initialize, mutate, or discard another mode.

### 7.1 BreedState

- Parent A and optional Parent B references.
- Population, selected elites, operator weights, component strengths, locks.
- Crossover configuration for pitch, rhythm, motif, tonal sections, and phrase.
- Deduplication/diversity state and adaptation preview decision.
- Three-way Near/Medium/Far comparison derived from the same parent snapshot.

One-parent operation is mutation-derived. Two-parent operation must record
genuine contribution from both where constraints make it possible. Zero
mutation returns an exact parent copy, and retained elites are byte-identical.

### 7.2 DriftState

- Pinned anchor ID.
- Immutable trail graph of anchor promotions and branches.
- Near/Medium/Far bands with documented distance components.
- Bias selection for pitch, rhythm, motif, tonal, or mixed change.
- Focus and explicit promotion state.

Generating descendants never promotes one. Promotion is a separate command and
preserves the earlier trail.

### 7.3 IslandsState

- At least Conservative, Rhythmic, and Adventurous/Tonal island records.
- Per-island RNG root, population, elites, operator distribution, generation,
  diversity state, pins, and migration inbox/outbox.
- Global deterministic migration ordinal and schedule.
- Migrant provenance and source island.
- A persisted `islands-global-diversity-v2.0.0` result containing the value,
  contributing source/nearest-cross-island `(islandId,candidateId)` memberships
  and distances,
  generation vector, threshold state, bounded immigrant attempts, and last
  accepted or rejected immigrant action.

Individual evolution touches one island stream. Evolve-all produces fixed slot
jobs and applies results in island-ID order. Migration never overwrites pinned
elites.

Global diversity is computed over unpinned membership tuples
`(islandId,candidateId)`, including separate memberships with byte-identical
phenotypes. For each membership, compute `phenotype-distance-v2.0.0` to its
nearest membership on a different represented island and take the arithmetic
mean; equal nearest distances use island ID then candidate ID. Exact cross-
island duplicates contribute zero once per source membership instead of being
collapsed. An island is represented only if it has an unpinned membership;
fewer than two represented islands yields zero. Scheduled migrants are ordered
by greatest distance from the destination population after pinned exclusion,
then candidate ID.

After ordinary survivor selection for one atomic global round, a value below
`0.18` identifies the least-diverse island only among islands with an unpinned
replaceable survivor, by lowest mean membership contribution then stable island
ID. The strategy proposes one immigrant from the dedicated labelled stream and
may replace that island's lowest-novelty unpinned survivor, then stable candidate
ID, only if recomputing the formula produces a strictly greater value. When no
island is replaceable it persists `no-replaceable-survivor` and leaves every
population unchanged. Other bounded failure is also persisted and reported. At
most one improving immigrant replacement can commit in a global round;
cancellation or validation failure commits neither island populations nor
diversity/immigrant state.

### 7.4 MapState

- Complete candidate archive independent from current axes.
- Two selected descriptor-axis IDs and version.
- Binned cells containing one representative with an optional pinned state and
  a challenger queue capped at three; a pin is not a second occupant.
- User ratings, selected cells/regions, coverage, and persisted diversity policy
  (`phenotype` default or `selected-descriptor-plane`) plus measurement version.

Changing axes recomputes descriptors if their version changed and deterministically
re-bins every archived candidate without loss. Replacement order is explicit
rating rank (Unrated zero), equal-rating cell direct-preference balance, centre
distance, neighbour novelty, then stable ID. For the representative,
challengers, and incoming item in the ranked pool, an item's balance sums
`count(item>other)-count(other>item)` over every other pool item. Both, Neither,
and undone records add zero; the numeric balance makes cycles total-orderable.
No hidden aesthetic score exists.

Both axis values are finite normalized `[0,1]`. `bin(v) = min(7,
floor(clamp(v,0,1)*8))`; bin `i` is `[i/8,(i+1)/8)` except bin 7 includes one,
and its center is `(i+.5)/8`. Cell ID is the ordered `(xBin,yBin)`. Center
distance is Euclidean normalized by `sqrt(2)/16`. Neighbors are the in-bounds
eight-cell Moore neighborhood excluding self, enumerated y then x; neighbor
novelty is mean phenotype distance from the challenger to occupied neighbor
representatives, with no occupied neighbor returning zero. Challengers never
act as neighbors.

Coverage is occupied representative count divided by 64. Map diversity always
uses unordered pairs of occupied representatives in cell-ID order. The default
phenotype policy averages `phenotype-distance-v2.0.0`; selected-descriptor-plane
averages normalized two-axis Euclidean distance divided by `sqrt(2)`. Fewer
than two representatives returns zero. The state stores the policy and every
formula/axis version so re-bin/reload cannot change its meaning.

### 7.5 ParetoState

- Two to four versioned objective definitions.
- Direction/target/range transformation and hard constraints.
- Complete population, objective values, violations, fronts, ranks, and
  crowding distance.
- Display-axis choice, compare tray, and deterministic reproduction ordinal.

NSGA-II nondominated sorting and crowding are pure and tested independently.
Every objective remains active when the display shows only two axes. Objectives
are never silently scalarized.

Domain invariants and locks reject before Pareto constraint evaluation. Only
feasible candidates receive nondominated rank/crowding. An infeasible candidate
stores null rank and zero crowding and is ordered by violation sum, ordered
violation vector, then ID. Environmental selection appends feasible fronts by
rank, truncating a front by descending crowding then ID, and only then fills
remaining slots with valid infeasible candidates in violation order.

Reproduction tournament comparison is feasibility first. Feasible entrants use
rank ascending, crowding descending, active preference descending, then ID.
When every entrant is infeasible the comparator uses violation sum, vector,
then preference only for equal violations, then ID. Exclusions are filtered
first; an exclusion set that empties a tournament is recorded and ignored for
that tournament in stable ID order. Attempt exhaustion may retain valid
infeasible survivors but never domain-invalid output; lack of enough distinct
valid candidates produces a persisted underfilled result without relaxed
constraints, duplicates, or invented rank/crowding.

### 7.6 PairLabState

- Separate melody and beat populations.
- Active pairings, component locks, BeatLockGroup locks, collaborator schedule, and hall
  of fame.
- Melody feedback, beat feedback, and pairing feedback as separate evidence.
- Independent melody, beat, and pairing lineage.

The commands lock-beat/evolve-melodies, lock-melody/evolve-beats, and evolve-both
have distinct reproduction paths. Prefer-pairing does not automatically credit
both components. Collaborator sampling is seeded and evaluates components
across multiple partners.

There are three capacity-four halls with independent comparators. Melody and
beat component entries compare component-positive evidence descending, count of
distinct opposite-component IDs in validated persisted completed-round
schedules descending, admission generation ascending, then component ID. A
repeated partner or duplicate fallback slot counts once. Ordered pairing entries
compare Prefer-pairing count descending, Reject-pairing count ascending,
admission generation ascending, then pairing ID; pairing entries have no
distinct-successful-collaborator field. On admission, only a value strictly
ahead of the current last entry under that hall's comparator replaces it.
Component comparators read no pair evidence and the pairing comparator reads no
component evidence.

### 7.7 Preference records

~~~ts
type PreferenceItemRefV2 =
  | { kind: 'melody'; candidateId: string }
  | { kind: 'beat'; beatId: string }
  | {
      kind: 'pairing'
      pairingId: string
      melodyCandidateId: string
      beatId: string
    }

type PreferenceFairnessV2 =
  | {
      scope: 'melody'
      transportFingerprint: string
      performanceFingerprint: string
      normalizedLevelsFingerprint: string
      sharedBeatPhenotypeFingerprint: string
    }
  | {
      scope: 'beat'
      transportFingerprint: string
      performanceFingerprint: string
      normalizedLevelsFingerprint: string
      sharedMelodyPhenotypeFingerprint: string
    }
  | {
      scope: 'pair'
      transportFingerprint: string
      performanceFingerprint: string
      normalizedLevelsFingerprint: string
      normalizedRoutingFingerprint: string
    }

type PreferenceStateOperationV2 =
  | {
      kind: 'increment-evidence'
      evidenceKind:
        | 'breed-pairwise'
        | 'drift-descendant-positive'
        | 'drift-operator-positive'
        | 'drift-operator-negative'
        | 'islands-candidate-positive'
        | 'pareto-reproduction-positive'
        | 'pair-melody-positive'
        | 'pair-beat-positive'
        | 'pair-relationship-positive'
      targetId: string
      delta: 1
    }
  | { kind: 'set-parent-slots'; parentAId: string; parentBId: string | null }
  | {
      kind: 'exclude-once'
      targetIds: readonly string[]
      expiryKind:
        | 'breed-parent-tournament'
        | 'island-reproduction-tournament'
        | 'map-batch'
        | 'pareto-run'
        | 'pair-component-parent-tournament'
    }
  | { kind: 'preferred-over'; winnerId: string; loserId: string }
  | { kind: 'prefer-for-batch'; targetIds: readonly string[] }
  | { kind: 'reject-pairing'; pairingId: string; delta: 1 }

interface PreferenceEffectV2 {
  version: 'preference-effect-v2'
  operations: readonly PreferenceStateOperationV2[]
}

interface PreferenceGenerationRefV2 {
  modeStateRevision: number
  generationOrdinals: readonly number[]
}

interface PreferenceRecordV2 {
  id: string
  version: 'preference-record-v2'
  projectId: string
  occurrenceOrdinal: number
  mode: 'breed' | 'drift' | 'islands' | 'map' | 'pareto' | 'pair-lab'
  generationRef: PreferenceGenerationRefV2
  scope: 'melody' | 'beat' | 'pair'
  shownAsA: PreferenceItemRefV2
  shownAsB: PreferenceItemRefV2
  playbackOrder: readonly ['A', 'B'] | readonly ['B', 'A']
  outcome: 'a' | 'b' | 'both' | 'neither'
  fairness: PreferenceFairnessV2
  effect: PreferenceEffectV2
}
~~~

Scope validators require melody/beat/pairing item kinds and the matching
fairness union. Effect construction is a versioned pure adapter for the exact
Product section 15.1 table. Revisions/ordinals are non-negative safe integers;
generationOrdinals uses stable strategy order (the three-island vector uses
Conservative, Rhythmic, Adventurous). Operation arrays use kind order
increment-evidence, set-parent-slots, exclude-once, preferred-over,
prefer-for-batch, reject-pairing. Within a repeated kind they use evidence kind
then target ID; every targetIds array is non-empty, unique, and ID-byte-sorted.
Decoding rejects an operation list that is not the canonical effect of the
record's mode, scope, items, and outcome. `occurrenceOrdinal` is allocated from
the project's persisted non-negative-safe `nextPreferenceOccurrence`, which is
then incremented and never decremented or reused across undo, branch navigation,
or reload. Identity is `stableId('preference', recordWithoutId)` over every
shown field except ID, including the ordinal. The immutable decision log retains
records after undo; a separate active-record-ID set controls application of
their invertible effects.

## 8. Descriptors, distance, and diversity

A DescriptorRegistry owns every formula:

~~~ts
interface DescriptorDefinition {
  id: string
  version: string
  label: string
  domain: 'melody' | 'tonal' | 'beat' | 'pairing' | 'parent-distance'
  range: { minimum: number; maximum: number } | null
  compute(input: DescriptorInput): DescriptorValue
  explain(input: DescriptorInput, value: DescriptorValue): DescriptorExplanation
}
~~~

The registry covers all descriptors required by the V2 product goal, including
density/rests, pitch range/angularity/contour, motif repetition, rhythmic
diversity and meter-aware syncopation, tonal stability/borrowing/modulation,
component parent distances, archive novelty, beat density/syncopation, and
melody-beat accent coincidence.

Descriptor formulas use only canonical ticks, active meter grouping, validated
events, and explicit parent context. Values are finite. Normalization is
versioned and documented; an unavailable parent-relative descriptor is an
explicit missing value, never zero. Descriptor values describe music and only
become objectives when the user explicitly selects them.

Locks are never formula inputs and never remove or renormalize a distance
component. They constrain which proposals may be generated or accepted. Only a
component absent from both operands is omitted under the registered phenotype
formula; a one-sided component contributes distance one. Drift, novelty, Map,
Pareto, Islands, and Pair Lab therefore measure the same two phenotypes
identically regardless of their LockSets.

Exact phenotype deduplication precedes novelty. Diversity mechanisms use
limited elitism, novelty quotas, crowding/distance preservation, bounded
attempts, and deterministic immigrants. None is labelled musical quality.

## 9. Unified transport authority

There is exactly one application TransportController. React components, cards,
beat lanes, and audio adapters do not create independent timers or schedules.

TransportController owns:

- active pairing/session ID and state machine: stopped, starting, playing,
  paused;
- the one resolved non-null `ProjectV2.auditionTiming` for the current session:
  a canonical TransportSpec/TickTimingMap or one isolated
  V1CompatibilityTimingProfile;
- current score tick and loop iteration;
- live tempo, loop, volumes, voice, and beat mute;
- melody, beat, effects, and visual schedule handles;
- one monotonically increasing session token.

Start first stops and disposes the previous session. A session builds one
tick-based PerformancePlan containing melody, beat, automation, loop boundary,
and effect tail metadata. Seconds are derived only at the audio-adapter boundary.

On live tempo change, the clock captures the current score tick and audio time,
cancels future scheduled nodes, then reschedules from that tick with the new
tempo under the same session token. Melody, beat, effects, and playhead all use
the new mapping. No melody or beat data is regenerated.

Stop increments the session token, cancels every future source/callback/RAF,
silences all buses immediately, resets the playhead, and disposes session-owned
nodes. Completion callbacks and worker results carrying an old token are
ignored. Starting another candidate follows the same stop-first path, preventing
overlap and ghost schedules.

Directly compared candidates must reference the same comparison transport. An
incompatible source is not scheduled until an AdaptationDecision has been
previewed and accepted.

`comparisonTransportId` is validated project context, not another controller
input. It may be retained while `auditionTiming` selects a solo compatibility
profile, but only the latter schedules. A null `auditionTiming` disables Play
with an actionable focus/adaptation message.

The compatibility profile is not a second controller. For solo V1 audition the
same controller builds a read-only compatibility PerformancePlan using
`sourceTicksPerBeat`, straight swing at 500 permille, exact source ticks/loop, and
v1-triangle-compat. It cannot add a beat, enter a comparison session, or become
creative input. Stop/replacement/session-token rules are identical on canonical
and compatibility plans.

Only project IDs/configuration are durable: comparison/audition timing,
performance, shared beat/pairing, loop/mute, and focused candidate. Controller
status, score tick, loop iteration, session token, handles, audio nodes, RAF
IDs, and effect tails are runtime-only. Reload always reconstructs a stopped
controller and never auto-starts or restores a second clock.

## 10. Audio and offline rendering

The existing PlaybackEngine boundary evolves into:

- a pure PerformancePlan builder;
- a real-time Web Audio/Tone adapter;
- a deterministic offline-render adapter;
- a voice factory for the six curated voices;
- separate melody, percussion, effects-return, and master buses.

Voice factories expose presets, not synthesizer internals. Every created node
has a documented owner and disposal point. Reverb/delay sends are bounded, and
feedback cannot create an infinite tail.

The voice registry additionally exposes `v1-triangle-compat` only to the frozen
compatibility plan builder. User-facing voice selectors and V2 mutation state
cannot name or edit it. The retained V1 route and migrated V1 route resolve to
the same factory function so a compatibility fix cannot drift between two
copies.

Offline WAV rendering consumes the same PerformancePlan and TickTimingMap as
real-time playback. It uses a fixed recorded sample rate and deterministic voice
parameters; it does not read wall-clock time or live AudioContext state. Export
duration is loop duration plus the user-selected bounded effect tail. The
renderer verifies non-silence for a sounding plan, finite samples, channel
length, and peak level. A deterministic gain stage prevents clipping; it does
not normalize silence into sound. Melody-only rendering omits beat at the plan
boundary, not by muting a scheduled live graph.

## 11. MIDI import and export

### 11.1 Import

MIDI parsing sits behind MidiFileReader and returns a library-neutral parsed
model. It has byte-size, track-count, event-count, delta, and duration bounds.
Parsing never mutates project state.

`midi-import-bounds-v2.0.0` is enforced incrementally: raw bytes at most
5,242,880; format 0 or 1; PPQ division 1–32,767; declared track count at most
64; total decoded channel/meta/sysex events at most 200,000; each variable-
length delta at most `0x0fffffff`; and greatest absolute event/end tick at most
`sourcePpq * 4096`, compared without overflow. The event count includes events
that later analysis ignores. Format 2, SMPTE division, overflow, and every bound
have distinct issue codes. The byte cap is checked before parse; declared track
cap before allocating track arrays; event/delta/duration caps during streaming
decode before preview or domain conversion. Failure returns no partial parsed
model and cannot dispatch a project command.

The preview pipeline is:

1. Parse header/tracks, tempo, meter, note events, and PPQ.
2. Produce track summaries and detect overlapping sounding notes.
3. Propose a track, deterministic monophonic extraction if requested,
   quantization, loop length, tonic/scale matches, and register adaptation.
4. Show every snap, trim, pad, rescale, extraction, or timing change.
5. Require confirmation of an AdaptationDecision.
6. Convert through a pure importer, validate, and only then offer an atomic
   project command.

Polyphonic tracks are rejected unless the user explicitly chooses highest,
lowest, or earliest-onset extraction. `midi-monophonic-extraction-v2.0.0`
sweeps source-PPQ half-open note intervals at every ordered start/end boundary,
applying note-off before note-on. Highest orders active notes by MIDI descending
then source note-on ordinal; lowest by MIDI ascending then ordinal; earliest by
onset ascending, ordinal, then MIDI. Each atomic span belongs to its winner;
adjacent spans coalesce only for the same source note ID, while loss/regain
creates stable zero-based fragments. Fragment identity derives from source hash,
track index, source note-on ordinal, and fragment ordinal. Extraction precedes
PPQ conversion/quantization. The preview/provenance classifies every source as
kept, discarded, shortened, or split and lists output spans; Reject runs no
extraction and dispatches no command.

PPQ conversion uses rational arithmetic with deterministic tie-breaking and
preserves ordered endpoints. Quantization is never applied implicitly. Imported
raw MIDI metadata and a content hash are retained in provenance, but domain IDs
do not depend on a parser library's names.

### 11.2 Export

- V1 melody-only format-0 export remains available for V1 candidates and writes
  the preserved source ticksPerBeat as its MIDI division, including non-480
  schema-valid sources.
- V2 melody-only MIDI writes tempo and time-signature metadata.
- V2 melody-plus-beat MIDI uses format 1 with a metadata/conductor track, a
  melody track/channel, and a distinct percussion track on MIDI channel 10.
- All tracks end at the exact shared loop tick, including trailing silence.
- Swing uses the shared TickTimingMap when rendered-swing export is selected.
- Event ordering at equal ticks is deterministic: note-off before note-on, then
  stable lane/event order.
- Pair Lab exposes three distinct JSON export routes: melody component, beat
  component, and complete audition pairing. None is implemented by exporting a
  project and asking the importer to guess the intended payload.

Export adapters receive validated domain data and return bytes. Downloads and
object URLs remain UI/browser concerns.

## 12. Persistence and safe V1 migration

### 12.1 Adapter

Project, library, archive, and branch-history data use an asynchronous
VersionedProjectStore interface:

~~~ts
interface VersionedProjectStore {
  open(): Promise<void>
  loadActiveProject(): Promise<StoredProjectGraphV2 | null>
  loadProject(id: string): Promise<StoredProjectGraphV2 | null>
  saveProject(
    graph: PersistableProjectGraphV2,
    expectedRevision: number,
  ): Promise<StoredProjectRecordV2>
  installAndActivateProject(
    input: InstallAndActivateProjectInputV2,
  ): Promise<ActiveProjectMetadataV2>
  activateProject(
    input: ActivateProjectInputV2,
  ): Promise<ActiveProjectMetadataV2>
  stageV1Migration(
    graph: PersistableProjectGraphV2,
    pendingReceipt: V1MigrationReceiptV2,
    sourceEvidence: V1SourceEvidenceRecordV2 | null,
  ): Promise<StoredProjectRecordV2>
  activateStagedMigration(input: {
    receiptId: string
    projectId: string
    expectedStagedRevision: number
    expectedPriorActive: ActiveProjectMetadataV2 | null
  }): Promise<ActiveProjectMetadataV2>
  listLibrary(query: LibraryQuery): Promise<readonly LibrarySummary[]>
  transact(command: PersistenceCommand): Promise<TransactionResult>
  estimateCapacity(): Promise<CapacityResult>
}

interface ActiveProjectMetadataV2 {
  id: 'active-project'
  version: 'active-project-metadata-v2'
  projectId: string
  revision: number
}

interface InstallAndActivateProjectInputV2 {
  graph: PersistableProjectGraphV2
  expectedStoredRevision: number | null
  expectedPriorActive: ActiveProjectMetadataV2 | null
  reason: 'native-create' | 'confirmed-schema2-replace'
}

interface ActivateProjectInputV2 {
  projectId: string
  expectedTargetRevision: number
  expectedPriorActive: ActiveProjectMetadataV2 | null
}

interface StoredProjectGraphV2 {
  record: StoredProjectRecordV2
  tables: ProjectEntityArrayTablesV2
}

type PersistableProjectGraphV2 = StoredProjectGraphV2

interface V1SourceEvidenceRecordV2 {
  id: string
  version: 'v1-source-evidence-v1'
  sourceKind: 'project-envelope-v1' | 'candidate-envelope-v1'
  sourceHash: string
  rawSha256: string
  encoding: 'base64'
  rawBase64: string
}
~~~

IndexedDB through VersionedProjectStore is the sole schema-2 durable authority,
not a capacity-triggered optimization. Complete projects, candidates/components,
Library, workflow populations/archives/fronts/halls, branch history, undo state,
ratings, annotations, locks, migration receipts, and active-project metadata
always use IndexedDB. There is no schema-2 domain fallback to localStorage.
Domain/application code depends only on the adapter interface. Writes use one
transaction and optimistic revision checking so a stale worker or tab cannot
overwrite a newer project silently.

The native database is exactly `melody-forge-v2`, database version `1`
(independent from project schema version). Its stores, in creation and declared
domain order, are `projects`, `createStates`, `modeStates`, `historyGraphs`,
`historyNodes`, `snapshots`, `melodyCandidates`, `melodyGenomes`, `transports`,
`v1TimingProfiles`, `tonalTimelines`, `customScales`, `beats`,
`performanceSettings`, `pairings`, `preferenceRecords`, `libraryItems`,
`ratings`, `annotations`, `undoStates`, `migrationReceipts`, and `appMetadata`.
Every store uses explicit embedded keyPath `id`. `migrationReceipts` alone adds
a unique `sourceHash` index. Browser `IDB*` requests/events never escape this
adapter.
At database version 1, `appMetadata` accepts only
`active-project-metadata-v2` and imported `v1-source-evidence-v1` rows; the V1
localStorage recovery string remains at its original key instead of being
copied there.

The V1 key `melody-forge:project:v1` is read-only migration/recovery input. The
only V2 localStorage key is `melody-forge:ui-preferences:v2`. Its root is
exactly `{ version: 'ui-preferences-v2', values: UiPreferenceValuesV2 }`.
Schema V2 registers exactly these 15 `values` leaves/defaults; root metadata is
excluded from the leaf count:

~~~ts
{
  version: 'ui-preferences-v2',
  values: {
    visualDensity: 'comfortable',
    reducedMotionOverride: 'system',
    views: { library: 'grid', map: 'visual', pareto: 'visual' },
    panelSizes: { controlsWidthPx: 244, inspectorWidthPx: 312 },
    disclosures: {
      transportMore: false,
      sound: false,
      beatAdvanced: false,
      createAdvanced: false,
      mutationAdvanced: false,
      tonalAdvanced: false,
      history: false,
      technical: false,
    },
  },
}
~~~

Density is `comfortable | compact`, reduced motion `system | reduce`, Library
view `grid | list`, Map/Pareto view `visual | table`, controls width an integer
`216…264`, inspector width an integer `288…336`, and disclosures Boolean.
The generic defensive gate
remains 64 registered paths, nesting depth four, 16,384 UTF-8 bytes before
parse, finite scalar values, and strings of at most 256 Unicode scalar values.
Root permits only `version`, `values`; `values` permits only registered keys.
Missing known leaves default, while an unknown key, unsupported version, or
invalid present value resets the whole record without touching IndexedDB.
Encoding is compact JSON in declared root/values key order with no BOM and no
trailing LF. The registry permits no musical/domain state or entity IDs;
adapters cannot create more V2 preference keys. IndexedDB failure stays
explicit and never promotes either localStorage record to domain authority.

Strict codecs reject unknown fields, unsupported versions, duplicate IDs,
key/embedded-ID mismatch, immutable-ID/different-byte collision, invalid array
order, and unresolved strong references before a graph is written or activated.
Quota, blocked/unavailable database, transaction abort, stale revision, decode,
and read-back failure leave the last active revision intact and produce an
actionable error/export recommendation. There is no fallback write.

### 12.2 Serialized envelopes

ProjectEnvelopeV2 and CandidateEnvelopeV2 use schemaVersion 2 while retaining
the existing envelope kinds. Decoding first checks kind/version, then dispatches
to a frozen version-specific decoder. A V1 decoder is not loosened to accept V2
shapes. Export validation performs a decode-after-encode round trip before
offering bytes.

~~~ts
interface ProjectEnvelopeV2 {
  kind: 'melody-forge-project'
  schemaVersion: 2
  project: ProjectExportBundleV2
}

interface ProjectExportBundleV2 {
  rootProjectId: string
  project: ProjectV2
  tables: ProjectEntityArrayTablesV2
}

interface ProjectEntityArrayTablesV2 {
  createStates: readonly CreateStateV2[]
  modeStates: readonly ModeStateV2[]
  historyGraphs: readonly HistoryGraphV2[]
  historyNodes: readonly HistoryNodeV2[]
  snapshots: readonly SnapshotV2[]
  melodyCandidates: readonly MelodyCandidateV2[]
  melodyGenomes: readonly MelodyGenomeV2[]
  transports: readonly TransportSpecV2[]
  v1TimingProfiles: readonly V1CompatibilityTimingProfile[]
  tonalTimelines: readonly TonalTimelineV2[]
  customScales: readonly CustomScaleV2[]
  beats: readonly BeatGenomeV2[]
  performanceSettings: readonly PerformanceSettings[]
  pairings: readonly AuditionPairing[]
  preferenceRecords: readonly PreferenceRecordV2[]
  libraryItems: readonly LibraryItemV2[]
  ratings: readonly RatingV2[]
  annotations: readonly AnnotationV2[]
  undoStates: readonly UndoStateV2[]
  migrationReceipts: readonly V1MigrationReceiptV2[]
}

interface CandidateEnvelopeV2 {
  kind: 'melody-forge-candidate'
  schemaVersion: 2
  candidate: CandidateExportBundleV2
}

interface CandidateExportBundleV2 {
  rootCandidateId: string
  performanceId: string | null
  tables: CandidateEntityArrayTablesV2
}

interface CandidateEntityArrayTablesV2 {
  melodyCandidates: readonly MelodyCandidateV2[]
  melodyGenomes: readonly MelodyGenomeV2[]
  transports: readonly TransportSpecV2[]
  v1TimingProfiles: readonly V1CompatibilityTimingProfile[]
  tonalTimelines: readonly TonalTimelineV2[]
  customScales: readonly CustomScaleV2[]
  performanceSettings: readonly PerformanceSettings[]
  ratings: readonly RatingV2[]
  annotations: readonly AnnotationV2[]
}
~~~

Serialized schema-2 names above are frozen even when internal TS names refine.
Every entity table is an ID-sorted array of records carrying embedded `id` and
`version`, never an object map. Project table keys in exact order are
`createStates`, `modeStates`, `historyGraphs`, `historyNodes`, `snapshots`,
`melodyCandidates`, `melodyGenomes`, `transports`, `v1TimingProfiles`,
`tonalTimelines`, `customScales`, `beats`, `performanceSettings`, `pairings`,
`preferenceRecords`, `libraryItems`, `ratings`, `annotations`, `undoStates`,
`migrationReceipts`. Candidate table keys in exact order are
`melodyCandidates`, `melodyGenomes`, `transports`, `v1TimingProfiles`,
`tonalTimelines`, `customScales`, `performanceSettings`, `ratings`,
`annotations`. Project traversal includes every transitive strong reference,
including both preference ID collections and ordered Library references;
candidate traversal includes genome/timing/tonal/custom-scale and its nullable
bundled performance reference, then selects the active source project's
rating/annotation rows whose typed target is the root candidate. That reference is null exactly
when `performanceSettings` is empty; otherwise the table contains its one
resolved row. Unreachable extra rows reject.

Candidate metadata has one explicit envelope-boundary rule. A candidate
envelope contains only `targetKind:'melody-candidate'` rating/annotation rows
whose `targetId` is `rootCandidateId`; every embedded row ID recomputes from its
complete singleton identity fields and no extra row is allowed. Because that envelope has
no ProjectV2 row, each metadata row's `projectId` is retained source-project
evidence and is soft only inside this standalone envelope. Open-preview keeps
those source rows in memory and mutates nothing. Save to Library or Seed into a
target project deterministically rehomes each row by substituting the target
project ID and recomputing the singleton ID above, then adds only those new IDs
to the target ProjectV2 rating/annotation sets in one
expected-revision transaction. The globally reusable candidate row is never
rewritten with project-local metadata IDs. If the target singleton already
exists, its local value/text wins and the preview reports that non-destructive
merge; if it does not exist, the imported value/text is used. Source rows and
source IDs are never persisted into the target.

The M2 schema kernel implements the closed envelopes/table order plus the
section 5.1.1 support records and payload versions needed for new-project/V1
migration. It does not claim full semantic codecs for mode payloads whose
domain milestone has not frozen them. Each such milestone registers its exact
payload and reference validator; the complete DATA-004 all-table closure runs
only after all six modes, history, Pair Lab, and I/O schemas exist. A current
build always rejects an unregistered payload rather than preserving opaque
state it cannot validate.

Canonical encoding uses each codec's declared key order, declared domain-array
order, ID order for set arrays, UTF-8 without BOM, and exactly one trailing LF.
Strict decode rejects unknown keys, duplicate IDs, table-key/embedded-ID or root
ID mismatch, invalid ordering, immutable-ID/different-byte collision, and every
unresolved strong reference. Encode must strict-decode its own bytes before
offering them.

Pair Lab component and relationship JSON reserves three separate root
discriminators and key orders: `kind`, `schemaVersion`, `component` for
`melody-forge-melody-component`; the same order for
`melody-forge-beat-component`; and `kind`, `schemaVersion`, `pairing` for
`melody-forge-pairing`. Every schema version is `2`. These headers are not a
generic JSON payload codec and are deliberately unavailable in the M2 schema
kernel. After Pair Lab state, lock, evidence, lineage, and hall records are
frozen, PAIR-016/017/018 must define the complete exact-key bundle/table
interfaces and register all three strict codecs before any route can encode or
decode them. Unknown or not-yet-registered bundles reject.

The eventual melody bundle contains the melody candidate and its referenced melody
genome, tonal timeline, custom-scale, transport/timing-profile, lock,
descriptor, component-evidence, component-lineage, and provenance records. The
beat bundle contains the beat genome and its `transportId`-referenced transport, BeatLockGroup locks,
descriptors, component evidence/lineage, and provenance. The pairing bundle
contains the AuditionPairing, one complete melody bundle, the referenced beat
bundle or an explicit null beat, the referenced PerformanceSettings, and only
the ordered pair's pairing evidence and pairing lineage. It does not merge or
infer component credit.

Each registered decoder is strict to its exact kind and schema version, enforces bounds,
validates every embedded ID/version/reference and shared timing relationship,
and returns data without mutating a project. Each encoder receives an already
assembled immutable bundle rather than a store or React state, emits canonical
UTF-8 JSON bytes, and must pass the corresponding decode-after-encode check.
The browser/import adapter rejects each melody-component, beat-component, and
pairing envelope independently when raw file size is greater than exactly
5,242,880 bytes (5 MiB), before UTF-8 decoding or JSON parsing. A pairing gets
no multiplier for its embedded component bundles. Encoders refuse to offer an
oversized result under the same per-envelope bound after canonical encoding.
Importing any of these envelopes creates or previews only its named Library or
Pair Lab item; it never replaces a project or imports a different envelope kind
implicitly. Incompatible timing enters the same explicit non-destructive
AdaptationDecision path as every other import. File creation, download names,
and object-URL lifetime remain outside the registered Pair Lab codec at the
browser adapter.

Project V2 persists:

- root seed and algorithm/version registry;
- canonical transports, V1 compatibility timing profiles, nullable comparison
  context, and nullable sole audition timing;
- melody, tonal timeline, custom scale, beat, performance, and pairing entities;
- all six mode states and current destination/mode;
- branch history and separate edit undo state;
- library/favorites, ratings, annotations, locks, descriptors, and provenance;
- active selections and safe playback preferences, never live audio nodes.

Library rows are global, independently persisted entities.
`ProjectV2.libraryItemIds` is only an ordered reference list; deleting a project
never deletes a Library row. Complete project export bundles all referenced
Library rows and their strong component closure. On import, the same ID and
identical immutable canonical bytes merges only ordered origin references; the
same ID with different immutable bytes rejects the import. Removing a project
reference is not Library deletion, and project replacement cannot garbage-
collect global rows implicitly.

### 12.3 Idempotent V1 project migration and candidate conversion

The pure converter accepts `sourceKind` exactly `local-storage-project-v1`,
`project-envelope-v1`, or `candidate-envelope-v1`. After frozen V1 decoding,
`sourceHash` is lowercase
`sha256(UTF8(stableStringify({ sourceKind, decodedV1 })))`; whitespace and
source JSON key order therefore cannot change identity. Raw input is never the
hash input. The localStorage string remains untouched at its V1 key. Imported
raw bytes are retained separately in `appMetadata` as a
`v1-source-evidence-v1` row keyed by
`stableId('v1-source-evidence', { sourceHash, rawSha256 })`; it records source
kind, source hash, lowercase SHA-256 of the raw bytes, encoding, and the exact
raw bytes as RFC 4648 standard base64 with required padding and no whitespace.
Source evidence is recovery metadata, not a project-
export strong reference.

An injected async `Sha256` adapter uses Web Crypto `subtle.digest` in the
browser and built-in Web Crypto in tests; no hashing dependency is needed. It
receives only the exact UTF-8 bytes above. The pure mapper accepts the resulting
validated 64-character lowercase hexadecimal digest and never accesses browser
crypto itself.

Only local-storage and project-envelope sources enter the complete-project
mapper, revision-1 staging, migration receipt, and active-project swap. Their
migrated root is deterministic: project ID
`stableId('v1-project', { version: 'v1-project-id-v2', sourceHash })`, root seed
`v1-migration/${sourceHash}`, name `Untitled Melody`, and null organization
timestamps. The exact Legacy and Modern V1 seeds remain in Create state.
V1 has no Blind A/B decision record, so `nextPreferenceOccurrence` is `0` and
both preference ID arrays are empty.
Root destination/modes are `create`/`breed`/`map`; comparison/audition timing,
shared beat, pairing, and focus are null; root selection is empty;
accompaniment is muted; performance is the compatibility singleton; and the V1
loop flag is copied. Active V1 history index and selected parents live in the
history graph/Breed state rather than being invented as root focus.
Candidate and snapshot IDs are copied. Event ID is
`stableId('event', { version: 'v1-event-id-v2', sourceCandidateId, ordinal })`
using the zero-based source event ordinal. Genome, tonal segment/timeline,
history node, mode state, Library item, compatibility performance/pairing, and
receipt identities use their documented complete-record/formula contracts;
none reads a clock or random UUID.

The receipt root is exact:

~~~ts
interface V1MigrationReceiptV2 {
  id: string
  version: 'v1-migration-receipt-v2'
  migrationVersion: 'v1-project-migration-v2.0.0'
  sourceKind:
    | 'local-storage-project-v1'
    | 'project-envelope-v1'
  sourceHash: string
  projectId: string
  stagedRevision: number
  status: 'pending-readback' | 'verified'
  candidateMappings: readonly {
    sourceCandidateId: string
    melodyGenomeId: string
    timingProfileId: string
    tonalTimelineId: string
    pairingId: string
    compatibilityPerformanceId: string
  }[]
  snapshotMappings: readonly {
    sourceHistoryOrdinal: number
    sourceSnapshotId: string
    historyNodeId: string
  }[]
  createdAtEpochMs: number | null
  verifiedAtEpochMs: number | null
}
~~~

Candidate mappings contain each unique source candidate exactly once in
first-seen order under this fixed traversal: active population in stored order,
then history snapshots by source history ordinal and each snapshot's candidate
order, then favorites in stored order. A repeated candidate ID must have equal
frozen decoded bytes and does not append another mapping; unequal bytes reject.
Snapshot mappings are source-history-ordinal ascending. Both receipt timestamps
and all absent source metadata are `null`, not omitted or synthesized from wall
time. `migrationVersion` must equal the staged project's
`algorithmVersions.foundations.v1Migration`; any substituted or unsupported
literal rejects before staging and after read-back. Receipt ID is
`stableId('migration-receipt', { version, migrationVersion, sourceHash,
projectId })`; status, revision, mappings, and timestamps do not rename it.

The automatic migration sequence is:

1. Read melody-forge:project:v1 without changing it.
2. Parse with the exact V1 decoder and bounds.
3. Compute a stable source hash and check migration metadata for an already
   verified result.
4. Convert in memory:
   - copy controls, seeds, settings, loop preference, order, and active index;
   - copy candidate and snapshot IDs and all V1 provenance;
   - copy every onset and duration tick, ticksPerBeat, gridTicks, and totalTicks;
   - calculate and record every sounding MIDI through the V1 pitch mapping;
   - create one full-coverage tonal segment per melody;
   - create a candidate-specific V1CompatibilityTimingProfile, at any source
     PPQ including 480, with unchanged PPQ/ticks, 4/4 display meter, source
     grid, straight swing at 500 permille, and exact partial-bar interpretation;
   - migrate linear snapshots into a branch chain without inventing lost
     branches;
   - migrate favorites/library items without deduplication loss;
   - create no beat and attach the frozen internal v1-triangle-compat
     performance entity because V1 had no persisted performance setting.
5. Validate every migrated entity and compare project controls/seeds/loop,
   history order/index, IDs/provenance/degrees/rests, raw tick/PPQ/grid/tempo,
   every onset/duration/loop endpoint, derived MIDI, playback schedule, exact V1
   MIDI bytes, and v1-triangle-compat parameters/gate/velocity. A hash alone is
   not equivalence evidence.
6. Transaction 1 atomically stages every normalized entity, project revision
   `1`, a `pending-readback` receipt, and imported source-evidence row where
   applicable. It does not change `appMetadata/active-project`.
7. Outside that write transaction, use the normal strict loader to read the
   staged graph and repeat decoding, aggregate validation, and the complete
   equivalence report.
8. Transaction 2 conditionally changes only the receipt to `verified` and
   swaps `active-project` when its expected prior value and the staged project
   revision still match. Otherwise it aborts without changing either.

The V1 localStorage value remains intact as a recovery source. If any step
fails, the application keeps the active state unchanged, reports the exact
failure, and offers export/retry. Re-running migration with the same source hash
produces the same entities and IDs.

A crash between transactions leaves an inactive pending stage. A retry for the
same unique source hash loads, revalidates, and either activates that exact
stage or rejects an immutable collision; it never exposes partial data. Normal
save first validates a self-contained graph, then one transaction checks
`expectedRevision` and writes all changed strong rows at revision + 1. When
the project is active, the same transaction compare-and-swaps both its stored
record and `active-project` at the expected project ID/revision and advances
both to revision + 1; saving an inactive project leaves active metadata
unchanged. A record/metadata mismatch is a stale-revision failure and rolls
back the transaction. Stale revision, quota, blocked/unavailable DB,
abort, collision, decode, read-back, or equivalence failure preserves both the
active metadata and caller's current in-memory graph; no failure falls back to
localStorage.

Native creation, ordinary switching, and confirmed schema-2 replacement use
the explicit activation methods rather than an opaque `transact` command.
`installAndActivateProject` requires target absence when
`expectedStoredRevision` is null and graph revision `1`; otherwise it requires
the exact existing target revision and graph revision one greater. Native
creation requires the null/1 case. Replacement requires the explicit confirmed
reason and permits either case. In one read-write transaction it compare-and-
swaps the complete prior active metadata value, checks the target expectation,
strict-validates/writes the complete graph, removes obsolete target-project-
owned rows not reachable from the replacement (never global Library rows),
reads the written graph through the normal decoder while the transaction
remains open, and writes `active-project` with the installed project
ID/revision. Any collision/read-back/CAS/quota failure aborts every write and
preserves the prior active graph. `activateProject` writes no project row: in
one transaction it checks the exact target revision, strict-loads that complete
inactive graph, compare-and-swaps the complete prior active value, and only
then changes active metadata. Schema-2 project import cannot call either method
until preview and explicit Replace confirmation. Tests cover first creation,
active-to-inactive switching, absent/present targets, same/different-ID
replacement, stale prior-active/target expectations, strict read-back failure,
and full rollback.

Within a frozen source, duplicate candidate IDs with identical
`stableStringify(FrozenV1CandidateV1)` bytes deduplicate to one normalized row
and merge ordered Library origin references. The same ID with different bytes
is a hard collision. Rests create no pitch gene; rhythm copies exact timing/rest
with accent `0` and `tieToNext: false`; sounding MIDI comes only from the frozen
V1 renderer.

Imported V1 project JSON uses the complete-project mapper only after preview
and explicit Replace confirmation. A V1 candidate envelope uses the shared
pure candidate converter but stops at an immutable candidate closure: it
derives no project ID/root seed and creates no `V1MigrationReceiptV2`.
Selection and **Open** retain that closure only in the in-memory preview tray
and may audition its compatibility profile. **Save to Library** atomically
writes or merges the closure, creates/merges its Library item and JSON-import
origin, and appends the item reference to the current project using optimistic
revision control. **Seed workflow** atomically writes or merges the closure and
dispatches the selected registered mode's seed command against the current
project. Neither command swaps active-project metadata; collision, stale
revision, or invalid/unregistered mode payload writes nothing. Raw imported
bytes may be retained as source evidence on a committing action. The same
candidate source may therefore be committed to several projects while the
migration-receipt `sourceHash` index remains unique to complete-project
migrations.

A migration receipt records each source candidate's timing-profile ID and
performance ID. It never records a canonicalized substitute as equivalent to a
V1 compatibility source. A later confirmed 480-PPQ adaptation is a normal,
independently persisted V2 transformation with source/destination timing
fingerprints, endpoint decisions, repair details, and a new candidate ID; it is
not another migration pass and does not alter the receipt.

## 13. Branch history and undo/redo

Evolutionary history uses the exact normalized `HistoryGraphV2`,
`HistoryNodeV2`, and `SnapshotV2` records in section 5.1.1, not an embedded
node map or an array that truncates future entries. Nodes are immutable
occurrences with one earlier parent; child lists are derived from parent links
and never serialized. This keeps old nodes byte-stable when a new branch is
appended and preserves repeated equal V1 snapshot occurrences.

Evolving from an older node allocates the graph's next occurrence, appends a
new node ID, and leaves every existing occurrence reachable. Genetic parent
IDs remain candidate provenance and are not confused with `parentNodeId`.

V1 history migrates in stored order, using valid previousGenerationId links
where available and order as a deterministic fallback. Branches previously
discarded by V1 cannot be recovered and are not fabricated.

Undo/redo is a separate bounded command journal for reversible project edits
such as settings, annotations, selections, and locks. Moving through branch
history never pushes an undo entry, and undo never changes the active history
node unless the original command explicitly did so.

## 14. Workers, progress, and cancellation

Long Islands, Map, Pareto, and Pair Lab work uses serializable WorkerJob
messages. Breed/Drift may share the same path when profiling justifies it.

Every job contains:

- request ID and project revision;
- strategy and algorithm versions;
- complete immutable input state;
- root seed and labelled seed paths;
- fixed candidate slots, attempt bounds, and result sort key.

Workers emit progress as completed deterministic work units, not elapsed-time
estimates. Cancellation uses an AbortController in the application and a
cancel message plus cooperative checkpoints in the worker. A cancelled worker
may finish a pure inner operation, but its result is ignored.

The reducer accepts a result only when request ID, project revision, active job
token, mode, and algorithm version still match. Results are ordered by their
specified stable keys, never message arrival order. Worker and synchronous test
implementations execute the same pure strategy function and must return
byte-equivalent results.

Playback remains on its own controller and is never stopped merely because an
evolution job runs. UI progress/cancellation state is not creative input.

## 15. Hard invariants and deterministic repair

Validation occurs at generator/operator output, strategy result, application
command, persistence decode, import confirmation, playback planning, and
export. Core invariants are:

- every tick/count/MIDI value is a safe integer in its valid range;
- every canonical transport satisfies PPQ, tempo, meter/group, 256-BarSpan,
  65,536-grid-opportunity, grid-divisor, and swing-pair bounds from section 5.2;
- positive duration and exact loop/phrase duration;
- ordered, contiguous, non-overlapping monophonic melody rhythm;
- legal register and MIDI values;
- active-scale membership or explicit valid borrowing;
- exactly one tonal segment at every tick;
- modulation boundaries on bar boundaries;
- canonical valid custom scales with tonic and cardinality 4–9;
- tonic-boundary and borrowing-resolution rules;
- exact preservation of every frozen component;
- valid beat lanes/events within the shared loop;
- one selected timing reference shared by every component in an audition
  pairing;
- deterministic bounded termination.

Frozen V1 compatibility entities validate against their separate preservation
contract rather than these canonical shape/cap limits and cannot pass a
canonical creative-command validator without a confirmed derivative.

Validation returns structured issue codes, entity/event IDs, messages, and
suggested actions. The UI maps codes to accessible text; algorithms do not
return presentation strings.

Operators follow this fixed policy:

1. Try the selected operator for 12 labelled proposals.
2. Apply at most one allowed, recorded deterministic repair to the final
   rejected proposal.
3. Try at most seven other enabled operators in stable operator-ID order, with
   12 labelled proposals per operator. Seeded draws occur inside a proposal;
   they never reorder operators.
4. If a distinct result is still required, validate at most 16 immigrants from
   the dedicated labelled stream.
5. Return a valid elite with an explicit fallback record when deduplication
   permits it; otherwise return a visible underfilled result.

This is `operator-attempt-budget-v2.0.0`: at most 113 validations per output
slot and `requestedSlots × 113` per batch. Every validation/rejection/repair/
operator/immigrant/fallback count is retained in provenance. No strategy adds
an unrecorded retry layer.

Repair has a separate version and emits before/after values plus reason. It may
project an unlocked pitch to a legal degree, close a tiny unlocked timing gap,
clip a beat event to the loop, or restore a custom-scale invariant. It may not
silently stretch a parent, alter an absolute lock, erase borrowing provenance,
move a modulation off a bar boundary, or change migrated V1 timing/pitch.

Impossible or contradictory constraints fail before creative work with an
actionable error. There are no unbounded retry loops.

## 16. Application state and UI boundary

Project state owns domain entities, persistent destination/mode state, active
comparison/audition timing references, mode states, branch graph, selections,
and ordered global-Library references. Playback sessions, AudioNodes, File objects, DOM state, worker
instances, and object URLs are runtime services and are not serialized.

Bootstrap order is deterministic and compatibility-safe:

1. Decode the one versioned presentation-preference record independently,
   falling back to its fixed defaults without touching domain storage.
2. Open `melody-forge-v2`; if unavailable, report the storage failure and keep
   V1 recovery input untouched rather than creating a localStorage V2 fallback.
3. Resolve `appMetadata/active-project` and strict-load its exact revision. A
   valid active V2 graph wins; bootstrap never remigrates V1 over it.
4. With no active graph, read the untouched V1 key. If present, compute the
   canonical source hash and resume a matching pending/verified stage or run the
   pure two-phase migration. If absent, create a fresh default V2 project using
   the defaults registry and injected metadata UUID factory.
5. Build application selectors and one stopped TransportController from the
   loaded root. Never restore playing status, schedule audio, or create a
   compatibility controller beside the canonical controller.

The retained V1 generator/render/export modules and V2 adapters may coexist in
the bundle. Version dispatch selects them from decoded data; bootstrap does not
rewrite old constants or reinterpret compatibility rows.

Application commands are the only mutation boundary. A command:

1. validates references and locks;
2. prepares a pure domain operation or worker job;
3. validates the result;
4. appends branch history where appropriate;
5. commits one new project revision;
6. schedules persistence separately from audio.

Create, Evolve, Explore, and Library are views over the same ProjectV2. Shell
navigation never creates or resets domain data. Candidate miniatures, focused
piano roll, inheritance views, charts, accessible tables, and inspector read
from shared selectors so visual semantics cannot diverge.

Charts are presentation adapters over descriptor data. Map and Pareto always
have semantic, sortable table/list alternatives. Piano-roll geometry derives
directly from onset/duration ticks and tonal bar maps; it does not maintain a
second timing model.

## 17. Dependency and ADR policy

ADR 0001 remains accepted:

- React, TypeScript, and Vite stay;
- Tone.js stays behind the audio adapter;
- authored CSS/native semantics remain the default;
- scale IDs and musical domain identity remain owned;
- Vitest/Testing Library/Playwright remain the verification stack;
- the application remains a static single-site deployment.

Initial V2 decisions:

- Own transport arithmetic, tonal relationships, descriptors, evolutionary
  algorithms, validation, repair, and stable identities. General music/evolution
  libraries must not define domain behavior.
- Keep the owned V1 MIDI encoder untouched behind a compatibility adapter.
- Put any MIDI parser behind MidiFileReader; parser-specific track/note objects
  never enter the domain.
- Implement M2 IndexedDB with the browser's native API through
  VersionedProjectStore; ADR 0003 records the exact store/transaction boundary
  and permits `fake-indexeddb` only as a development test adapter. Any measured
  need for a runtime persistence dependency requires an ADR amendment that
  preserves the same codec/adapter contracts and keeps library types inside the
  adapter.
- Use Web Audio/Tone only behind real-time/offline audio interfaces.
- Implement charts with accessible React/SVG/Canvas presenters over owned data;
  no chart library may become the descriptor owner.

Before adding a dependency, record a concise ADR with maintenance evidence,
bundle impact, offline/runtime-network behavior, accessibility implications,
determinism risks, adapter boundary, alternatives, and removal strategy.
Required decision records during implementation are:

- ADR 0002: V2 transport/domain versioning and V1 timing migration;
- ADR 0003: IndexedDB adapter and migration transaction design (accepted);
- ADR 0004: MIDI parser choice versus owned parser;
- ADR 0005: real-time/offline audio and WAV encoding;
- ADR 0006: visualization approach for piano roll, Map, and Pareto;
- ADR 0007: worker threshold/protocol after profiling.

No dependency is added merely to satisfy an abstraction in this document.

## 18. Verification architecture and evidence

### 18.1 Golden V1 compatibility fixtures

Before changing V1 boundaries, capture:

- real schema-1 project JSON with Legacy and Modern populations;
- favorites and the maximum/current history shape;
- candidate JSON and current melody-only MIDI;
- arbitrary phrase lengths, including five beats and trailing rests;
- schema-valid non-480 ticksPerBeat plus source grid/tick values;
- Legacy fixed-octave wrap cases and all stable scale IDs/aliases;
- deterministic seed recipes legacy-amber, ordered-legacy-population,
  glass-orbit, and rest-fixture;
- exact candidate IDs, snapshot IDs, timing arrays, sounding MIDI arrays,
  provenance, existing musical fingerprints, and v1-triangle-compat scheduling
  and factory parameters.

Tests decode, migrate, reload, export, and audition these fixtures without
changing timing, PPQ, pitches, loop duration, or compatibility voice. Separate
tests confirm separately that 480 and non-480 compatibility adaptations are
previewed, create new canonical candidates, and leave their sources and
migration receipts byte-identical. The 480 case records factor one/no rounding;
the rational case records every endpoint decision. The complete V1 test suite
remains part of every release gate.

### 18.2 Pure unit and property tests

- tick/meter/bar/subdivision conversion for common, compound, odd, and partial
  meters;
- rational PPQ conversion, swing map/inverse, tempo changes, and loop bounds;
- genome rendering, every lock, tonal coverage, borrowing, modulation, custom
  scales, cross-scale mapping, and repair;
- beat families, meter grouping, variations, locking, and fill boundaries;
- every descriptor formula, normalization, missing context, and version;
- each strategy's distinct state transition and algorithm, deterministic
  results, deduplication/diversity, and cancellation;
- NSGA-II rank/crowding/constraints and Map replacement/re-binning;
- Pair Lab collaborator schedule, separated credit/lineage, and strict
  melody-component/beat-component/pairing envelope codec round trips;
- JSON, IndexedDB migration, quota/transaction failure, MIDI, and WAV bytes.

Property generators use deterministic test seeds and bounded cases. A failed
property prints the complete seed path and serialized minimal input.

### 18.3 Audio and worker contract tests

Fake clocks/adapters assert one session, replacement, pause/resume, live tempo,
loop, swing, immediate stop, bus/effect disposal, no stale callback, and
playhead agreement. Offline fixtures assert duration, non-silence, bounded peak,
and deterministic sample/byte output within a documented platform strategy.

The same jobs run synchronously and through workers; ordered serialized results
must match. Tests cover cancel-before-start, mid-job cancel, stale revision,
late result, progress monotonicity, and uninterrupted playback.

### 18.4 Browser and accessibility evidence

Playwright covers every required destination and workflow at all specified
viewports, reload, imports/exports, branch forks, keyboard shortcuts, reduced
motion, 200% zoom, invalid/empty/impossible/cancelled states, and console
cleanliness. Tests assert shared transport/playhead state rather than relying
only on screenshots.

Retained screenshots are named by milestone, destination/mode, viewport, and
state. Manual evidence records listening seeds, browser version, viewport,
observed synchronization, accessibility inspection, console findings, and any
fix. Every traceability row links implementation, automated tests, and browser
evidence.

## 19. Incremental implementation order

1. Freeze V1 fixtures, decoders, hash manifest, IDs, timing, pitch, JSON, and
   MIDI expectations.
2. Add V2 types and adapters without changing the V1 UI path.
3. Implement transport/meter/partial-bar arithmetic and prove V1 migration.
4. Add async persistence and idempotent migration behind the current reducer.
5. Introduce the compact shell, shared transport, piano roll, and selectors.
6. Add beat/performance/audio/export entities without coupling them to melody.
7. Introduce genomes, locks, tonal graph, borrowing, modulation, and custom
   scales behind versioned renderers.
8. Add each strategy independently through EvolutionStrategy and persist its
   state before exposing the next.
9. Add import, branch history, workers, Library reuse, and full export.
10. Run migration, deterministic, browser, accessibility, performance, and
    adversarial audits before declaring any requirement complete.

At every step the V1 application remains runnable. A feature flag may protect an
in-progress internal route during a milestone, but no final requirement is
marked done while its controls, persistence, tests, documentation, or browser
evidence are absent.

### 19.1 M2 post-coordinator checkpoint implementation state

The scoped branch is `feature/v2-bootstrap-coordinator`, created from clean,
fetched `v2` at `19c9c356ddb3e1f27fb7e61344133c56fa35376e`. The checkpoint
commit is the commit containing this section (the final handoff records its
resolved SHA, since a commit cannot embed its own hash). Stable V1 remains
unchanged and `legacy/` remains hash-locked.

The following already-started M2 slices are integrated:

- `src/domain/v2/` implements the exact registered M2 project/entity subset,
  IDs, defaults, validators, graph closure, migrated candidate evidence,
  normalized history, Library rules, and fresh-project kernel;
- `src/persistence/v2/v1Migration.ts` and `v1Equivalence.ts` implement pure V1
  conversion and the explicit before-stage/after-read-back comparison report;
- `src/persistence/v2/indexedDbSchema.ts`, `indexedDbErrors.ts`, and
  `indexedDbAuthority.ts` implement the native 22-store authority, revision CAS,
  strict registered loading, two-phase migration activation, crash retry,
  obsolete project-owned-row cleanup, and global Library preservation;
- `src/persistence/uiPreferencesV2.ts` implements the independent bounded
  presentation-only preference record;
- `src/persistence/v2/bootstrapCoordinator.ts` implements the headless,
  dependency-injected application bootstrap order: independent presentation
  preferences, active-V2 precedence, exact fresh-kernel installation, V1
  decode/hash/convert/before-stage equivalence, idempotent pending/verified
  stage resume, strict read-back/after-read-back equivalence, and CAS activation;
- `src/domain/performance/v1Compatibility.ts`,
  `src/audio/tonePlaybackEngine.ts`, and the V1 App storage guard preserve the
  frozen V1 audition route and corrupt/unsupported recovery bytes.

This remains a partial M2 boundary. The coordinator is deliberately not invoked
by `App`; valid V1 state still follows the schema-1 reducer/storage route, and
candidate Save/Seed, V2 recovery presentation, real-browser IndexedDB evidence,
later-mode/native-snapshot codecs, nonempty undo command/path codecs, and the
M11 complete envelope closure are deferred. Reserved future stores do not imply
registered support, and no opaque placeholder payload may be persisted.

The headless coordinator boundary is complete and its 11 focused tests cover
unavailable IndexedDB, active/fresh/migrated origins, crash retry,
pending/verified resume, stale CAS, before-stage and after-read-back mismatch,
invalid V1 sources, and source-byte non-overwrite. App/recovery presentation,
real-browser IndexedDB evidence, and candidate Save/Seed remain separately
deferred; no M3 surface should start from this checkpoint.

## 20. Architectural completion criteria

Architecture implementation is complete only when:

- all creative state has a versioned domain representation and validator;
- melody, tonal context, beat, performance, and pairings remain independently
  replaceable and persistable;
- one controller and canonical transport/display grid drives V2 playback, beat,
  playhead, MIDI, and WAV, while frozen V1 profiles remain isolated audition and
  export compatibility inputs;
- all six strategies have distinct pure algorithms and persisted state;
- every seed path and descriptor formula is versioned and documented;
- V1 local and exported data migrates without changed ticks, ticksPerBeat, MIDI,
  IDs, provenance, or fixed-synth audition behavior and the V1 recovery value
  remains available;
- branch creation cannot erase a later branch;
- cancelled/stale work cannot mutate state;
- repair is bounded, visible, deterministic, and lock-safe;
- every dependency is behind the documented adapter and has an ADR;
- automated and browser evidence is linked from V2_REQUIREMENTS.md;
- legacy/ still matches its complete baseline manifest.
