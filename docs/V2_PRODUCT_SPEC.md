# Melody Forge V2 product specification

Status: reviewed normative M1 baseline — living implementation specification

Audience: product, design, engineering, test, and documentation

Relationship to V1: additive; `docs/PRODUCT_SPEC.md`,
`docs/LEGACY_BEHAVIOR.md`, and the V1 release evidence remain historical and
normative for preserved V1 behavior.

The key words **must**, **must not**, **should**, and **may** describe product
requirements. Lines prefixed **Design decision** settle an ambiguity left open
by the V2 goal; they are required behavior unless a later ADR deliberately
supersedes them.

**Design decision — interpretation scope:** exact numeric defaults, bounded
capacities, formula choices, tie-breaking orders, and workflow placement stated
below are deliberate V2 decisions wherever the goal did not prescribe a value.
They are not placeholders for later product decisions.

## 1. Product promise

Melody Forge V2 is a local-first laboratory for creating, auditioning,
transforming, and interactively evolving short monophonic melodies. It adds an
optional, separately evolved percussion track; tonal evolution; six distinct
evolutionary workflows; richer playback and export; MIDI import; explanatory
visualizations; a branch-preserving history; and a searchable local Library.

The product remains a compact creative instrument, not a DAW. Melody,
percussion, tonal context, performance sound, and the temporary pairing used
for audition are separate domain concerns. A preference for one concern must
not silently become a preference for another.

V2 remains one static browser application. It has no account, backend, cloud
sync, sharing, telemetry, analytics, runtime API, remote samples, or credential
requirement. Every creative workflow and export works after the application has
loaded with the network unavailable.

## 2. Scope boundary

V2 includes:

- Legacy and Modern melody generation, with all V1 deterministic behavior;
- optional deterministic percussion accompaniment;
- six evolutionary workflows: Breed, Drift, Islands, Map, Pareto, and Pair Lab;
- catalogue and evolved custom scales, modal borrowing, and bar-aligned
  within-phrase modulation;
- a tick-based shared transport, piano roll, provenance and inheritance views,
  curated melody voices, and light performance effects;
- blind A/B and continuous audition;
- branch-preserving evolutionary history and separate undo/redo;
- local Library, MIDI import, project/candidate JSON, melody and multitrack
  MIDI, and deterministic offline WAV export.

V2 must not add chords or harmony generation, polyphonic melody generation,
harmonic accompaniment, a manual drum grid, a full piano-roll note editor,
notation engraving, recording or mixing infrastructure, a general synthesizer
editor, machine learning, accounts, a backend, a plugin platform, or an
automatic universal melody-quality score.

Percussion may contain simultaneous hits on different drum lanes. This is not
polyphonic melody and cannot be used to introduce pitched accompaniment.

## 3. V1 preservation and migration contract

### 3.1 Immutable history

- Nothing under `/legacy` may change. Its complete sorted SHA-256 manifest must
  continue to match `docs/LEGACY_SHA256.txt`.
- V1 documentation is retained. V2 documentation extends it instead of
  rewriting completed history.
- `legacy-simple-v1`, `modern-constrained-v1`, the V1 evolution version, scale
  IDs and aliases, candidate fingerprints, seeds, pitches, event timing, and
  exported MIDI interpretation remain readable.
- Legacy generation remains byte-equivalent for the same normalized V1
  settings and seed. V2 transport metadata may wrap the unchanged result but
  may not alter its events or provenance.

### 3.2 Automatic migration

The versioned storage adapter must recognize the V1 localStorage envelope,
validate it, migrate it transactionally, and write V2 data only after the V2
representation has validated. The original V1 value remains available until
the V2 commit succeeds. A failed migration leaves the active data untouched and
offers an error plus project-export recovery action; it never clears storage.

Migration maps:

- the current V1 population and immutable snapshots into a single active
  history branch in their original order;
- V1 favorites into Library entries marked Favorite, retaining candidate IDs;
- generator and evolution settings into the corresponding Create and Breed
  mode state;
- the V1 loop flag, tempo, pitches, rests, scale IDs, seed, versions, and exact
  ticks without reinterpretation;
- the V1 project to no beat component and a muted accompaniment state; no beat
  is inserted into a migrated melody candidate;
- V1's fixed triangle-synth playback behavior to the internal
  `v1-triangle-compat` voice needed to preserve V1 playback; V1 persisted no
  voice setting, so migration must not invent one from stored data. Selecting a
  V2 voice is a later performance-only action.

Duplicate V1 candidate IDs whose frozen-decoder values have identical
`stableStringify` bytes become one normalized candidate and one Library
identity with multiple ordered origin references. This canonical-byte rule is
independent of whitespace and object-key order in the enclosing source JSON.
A duplicate ID with different canonical candidate bytes is an invalid
migration and must be reported, not silently renamed or overwritten. The exact
raw V1 localStorage string remains separately untouched as recovery data.

The frozen V1 converter is deterministic and contains no clock or random-ID
read. After decoding, `sourceHash` is the lowercase hexadecimal SHA-256 of
`UTF8(stableStringify({ sourceKind, decodedV1 }))`; `sourceKind` distinguishes
the read-only localStorage source from an imported V1 project/candidate source
and is exactly one of `local-storage-project-v1`, `project-envelope-v1`, or
`candidate-envelope-v1`, so formatting alone never changes migration identity.
The raw source string/bytes are retained separately for recovery and evidence
and are not the hash input: the automatic source remains untouched at its V1
key, while imported bytes use the Architecture §12.3 source-evidence metadata
row.

Only `local-storage-project-v1` and `project-envelope-v1` enter complete-project
migration and the two-phase activation receipt. For those sources, project ID is
`stableId('v1-project', { version: 'v1-project-id-v2', sourceHash })`; it is
then content-independent for the lifetime of that project. Existing candidate
and snapshot IDs are copied. Each new event ID is
`stableId('event', { version: 'v1-event-id-v2', sourceCandidateId, ordinal })`
with a zero-based ordinal. The project name is `Untitled Melody`; organization
timestamps are `null` because V1 stored none; and the project root seed is
exactly `v1-migration/${sourceHash}` while both exact V1 strategy seeds remain
in Create state. V1 rests receive no pitch gene; derived V2 rhythm genes copy timing
and rest state with accent zero and no tie; sounding MIDI is derived only
through the frozen V1 pitch renderer. The frozen decoded V1 candidate remains
the authority for compatibility audition and direct V1 export.

`candidate-envelope-v1` instead produces one immutable converted candidate
closure for preview. It derives no project ID or project root seed and creates
no project migration receipt. File selection and **Open** are in-memory
preview/audition only. **Save to Library** atomically writes or merges the
closure, creates the exact Library item/origin, and appends its reference to
the current project at an expected revision. **Seed workflow** atomically
writes or merges the same closure and applies the chosen registered mode
command to the current project. Neither action swaps `active-project`; a
collision or failed command writes nothing. The same source candidate may
therefore be saved or seeded into several projects without violating the
project-migration receipt's unique source-hash rule.

Before staging and again after read-back, complete-project migration produces an explicit
equivalence report. It compares project settings, seeds, loop state, history
order/index, snapshot/candidate IDs, provenance, degrees/rests, PPQ, grid,
tempo, every onset/duration, loop endpoint, derived MIDI, playback schedule,
V1 MIDI bytes, and every `v1-triangle-compat` factory/gate/velocity constant.
A hash alone is not proof of equivalence. Any difference aborts activation.

### 3.3 Arbitrary and partial phrase lengths

**Design decision — partial bars and V1 PPQ:** migration preserves every
schema-valid positive safe-integer V1 `ticksPerBeat` and every event tick
exactly. Every migrated V1 item in the current population, history snapshots,
favorites, and Library receives a candidate-specific compatibility timing
profile with that PPQ and implicit 4/4 display metadata when no meter exists;
its `totalTicks` is the exact loop length. This rule applies even when the
source PPQ is already 480. At the usual V1 480 PPQ, a five-quarter-note phrase
therefore displays one complete 4/4 bar and a one-quarter-note final partial
bar. A non-480 candidate uses its own denominator-beat length and is neither
relabelled nor rescaled. Compatibility audition, project/candidate JSON, and
direct V1 MIDI re-export use the source profile and remain audibly and
tick-for-tick identical.

New V2 material always uses canonical 480 PPQ. Every migrated V1 compatibility
item, including a 480-PPQ item, can enter a V2 workflow, beat pairing, direct
transformation, or mixed comparison only through adaptation preview. The
proposed child rendering maps musical positions to canonical 480 PPQ with exact
rational arithmetic, enumerates every source/result onset, end, duration, grid,
and loop endpoint, and leaves the compatibility source immutable. A 480-to-480
preview explicitly reports an exact factor of one and no rounding while still
creating a separately identified V2 derivative; a non-480 preview records each
exact or rounded endpoint and requires confirmation for any rounding. A
candidate-specific profile is active through the same single transport
authority; it is not a second concurrent clock.

The PPQ proposal accepts at most 258 source boundary entries: two endpoints for
each of the frozen V1 decoder's at most 128 events plus loop start/end. The
array must be dense, ordered, and contain positive-coverage endpoints; sparse or
oversized direct API input rejects before rational mapping or allocation.

Compatibility validity does not imply canonical-derivative feasibility. A V1
profile whose preserved tempo is outside 30–300 BPM, whose exact loop would
exceed 256 canonical BarSpans, or whose chosen canonical grid would exceed
65,536 opportunities remains auditionable and directly V1-exportable, but the
plain 480-PPQ proposal is `impossible`. The preview names each canonical bound
and offers a separate explicit target-tempo and/or phrase-length/grid adaptation
when that operation can be validly previewed. No value is silently clamped,
trimmed, or padded; without a confirmed valid adaptation no derivative or
project change is committed.

An operation that requires complete bars, such as modulation, may decline to
use a partial bar and must explain the minimum complete-bar requirement. It may
not modify the source merely to make the operation available.

## 4. Information architecture and durable state

There are exactly four primary destinations:

1. **Create** — Legacy, Modern, MIDI import, Library start, direct transforms,
   and the initial population.
2. **Evolve** — Breed, Drift, Islands, and Pair Lab.
3. **Explore** — Map and Pareto.
4. **Library** — saved candidates, components, pairings, search, reuse, and
   export.

**Design decision — workflow placement:** Map and Pareto live under Explore;
the other four algorithms live under Evolve. Together they are the six
evolutionary workflows. A shared workflow switcher and “Open in…” actions can
move between them without converting state.

Navigation must preserve the current project, focused candidate, playback and
playhead, selection sets, transport, tonal and beat settings, branch position,
and the independent state of all six workflows. Merely changing destination or
workflow must not run an algorithm, consume a seed, discard work, or change
audio. Explicit “Seed this workflow” actions copy immutable references and
record their source.

The application state distinguishes:

- durable project state, automatically persisted;
- Library state, independently persisted and reusable across projects;
- small local preferences such as collapsed panels and reduced visual density;
- transient UI state such as an open menu or hover tooltip;
- audio runtime state, reconstructed from durable transport and focused
  candidate data rather than serialized audio nodes.

Starting a new project, replacing a project through import, and removing a
Library entry are destructive actions and require confirmation. Opening a
candidate or changing destination is not destructive.

## 5. Domain model

### 5.1 Project and candidate

A project has a stable content-independent project ID, user-editable name,
schema version, root seed, algorithm-version registry, timestamps used only for
organization, nullable canonical comparison context, nullable sole audition
timing, current performance settings, Create state,
six mode states, branch graph, ratings, annotations, and references to Library
items. Timestamps never participate in creative randomness or candidate IDs.

The schema-2 project root is exact. `createdAtEpochMs` and
`updatedAtEpochMs` are non-negative safe-integer UTC epoch milliseconds or
`null`; persistence revision is outside creative project data. Fresh projects
receive one value from an injected metadata clock for both timestamps; migrated
V1 projects use `null` for both because V1 stored neither:

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

`AlgorithmVersionRegistryV2` is a closed serialized record in exactly the
declared key order, including each nested object. New and migrated schema-2
projects initially use exactly those literals. Missing, extra, reordered, or
changed keys reject; an implementation never points an existing literal at new
behavior. A later supported algorithm records a new literal and, if the closed
key shape changes, a new registry version. Migrated candidates still retain
their actual V1 generator/evolution versions in frozen source provenance; the
project registry names the dispatch implementations available to subsequent
schema-2 work.

`StoredProjectRecordV2.id` must equal `project.id`; `revision` is a positive
safe integer advanced only by a successful storage transaction.

The schema-2 melody-candidate aggregate is also frozen. Its serialized key
order is `id`, `version`, `candidateKind`, `melodyGenomeId`,
`renderedPhenotype`, `descriptorValues`, `provenance`, `lineage`,
`compatibilitySource`:

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

`melodyGenomeId` is a strong normalized reference. Project-local ratings and
annotations target the candidate from their rows and ProjectV2 ID sets; they
are deliberately not stored in this globally reusable candidate row. Descriptor values,
provenance, lineage, and the phenotype cache are inline immutable owned values,
not hidden entity tables. Genetic parent and source-history IDs inside lineage
are explicitly soft references so bounded V1 history may omit their rows.
Descriptor values are ordered by descriptor ID then formula version. Seed-path,
operation, contribution, repair, and lock-verification arrays retain their
declared causal order. Each rendered event's contribution IDs must resolve
inside the owning candidate's inline `provenance.contributions`; they are not
external table references. Inline contribution and repair IDs are
`stableId('candidate-contribution', allFieldsExceptId)` and
`stableId('candidate-repair', allFieldsExceptId)`; their codecs reject a
different embedded ID. `ReadonlyJsonValue` is finite JSON only and its object
keys are canonicalized by `stableStringify`.

The phenotype cache must be reproducible from the resolved genome, tonal and
timing records. Its `inputFingerprint` is the lowercase SHA-256 of UTF-8
`stableStringify({ renderVersion, melodyGenome, tonalTimeline, timing })`; its
event bytes, timing fingerprint, and phenotype fingerprint are recomputed on
decode. Any mismatch rejects the candidate rather than trusting stale derived
data. The frozen V1 candidate is the complete exact value emitted by the
schema-1 decoder; its nested key order is the order shown above and its root ID
must equal the migrated aggregate ID. It is retained for direct V1 export and
equivalence proof and is not regenerated from V2 fields.

Migrated candidate IDs are copied and bypass the native formula. A new native
candidate ID is exactly `stableId('melody-candidate', { version,
candidateKind, melodyGenomeId, provenance, lineage })`; cache bytes,
descriptors, ratings, and annotations are excluded so recomputation and user
metadata never rename creative content.

`comparisonTransportId` is the canonical transport used to make direct
comparisons and may be `null` when a migrated project has no confirmed
canonical derivative. `auditionTiming` is the sole timing input scheduled for
the current audition and may independently be `null`, a canonical transport
reference, or one candidate-specific V1 compatibility reference. A retained
canonical comparison transport may therefore coexist with a solo compatibility
audition. It is not a second clock: the controller schedules only
`auditionTiming`; `comparisonTransportId` is dormant comparison context until a
canonical comparison or audition selects it. A compatibility audition forbids
beat scheduling, mixed comparison, transformation, and creative use.

New V2 projects set `comparisonTransportId` to the default transport ID and
`auditionTiming` to `{ kind: 'canonical-transport', transportId:
comparisonTransportId }`.
Freshly migrated V1 projects set `comparisonTransportId` to `null` and
`auditionTiming` to `null` until a compatibility candidate is focused; focusing
one selects only that candidate's profile. Confirmed adaptation may establish a
canonical comparison transport and creates a new candidate without changing
the source profile.

Their remaining root selectors are deterministic: destination `create`, active
Evolve mode `breed`, active Explore mode `map`, compatibility performance ID,
null shared beat/pairing/focus, empty root selection, accompaniment muted, and
the exact migrated V1 loop flag. The V1 history index is retained in the history
graph and V1 selected parents in Breed state; neither is misrepresented as a
new UI focus.

Project playback ownership is limited to durable selection/configuration:
`comparisonTransportId`, `auditionTiming`, `activePerformanceId`,
`sharedBeatId`, `activePairingId`, `loopEnabled`, `accompanimentMuted`, and the
focused candidate. Playing/paused/stopped status, score tick, loop iteration,
session token, scheduled handles, audio nodes, animation frame IDs, and effect
tails are runtime controller state and are never serialized. Reload reconstructs
a stopped controller from the durable fields and never auto-starts audio.

When `activePairingId` is non-null it must resolve to exactly one pairing;
`focusedMelodyCandidateId`, `auditionTiming`, and `activePerformanceId` must be
non-null/equal to that pairing's `melodyCandidateId`, `timing`, and
`performanceId`. Its `beatId` must exactly equal `sharedBeatId`, including
`null`. A `v1-compatibility` audition must resolve to the focused migrated-V1
candidate's own profile, use the compatibility performance singleton, and have
both pairing `beatId` and project `sharedBeatId` equal to `null`. A canonical
`comparisonTransportId` may remain retained during that solo audition; it is
not scheduled. Any redundant-reference disagreement rejects the complete
project graph before save, load, import, or activation.

`nextPreferenceOccurrence` is a non-negative safe integer. It is the next
project-global Blind A/B decision ordinal and never decreases. The immutable
`preferenceRecordIds` decision log is ordered by each referenced record's
strictly increasing `occurrenceOrdinal`; an ID appears exactly once.
`activePreferenceRecordIds` is the unique Unicode-code-point-ID-sorted subset
whose invertible effects currently apply. Undo/redo changes only active
membership; it never deletes or reorders the decision log and never releases
an ordinal.

Root ID-array semantics are exact. `selectedMelodyCandidateIds`,
`activePreferenceRecordIds`, `ratingIds`, `annotationIds`, and
`migrationReceiptIds` are duplicate-free Unicode-code-point-ID-sorted sets.
`preferenceRecordIds` is duplicate-free and order-bearing by increasing
occurrence ordinal. `libraryItemIds` is duplicate-free and order-bearing by the
user's persisted Library-reference order; it is not silently ID-sorted. Every
entry is a strong reference except lineage/ancestry IDs explicitly designated
soft below.

Within a stored graph or complete project envelope, `ratingIds` and
`annotationIds` are exact sets: they equal all and only rows in their respective
tables whose `projectId` is this project ID. Each row's typed target is a strong
reference to a candidate, beat, or pairing in the same graph; no project-owned
metadata row may be hidden, duplicated through a candidate row, or left
unreachable.

A melody candidate is immutable melodic content plus versioned provenance. It
owns:

- a melody genome and its rendered monophonic events;
- a complete tonal timeline;
- locks attached to components, event IDs, or tick regions;
- versioned descriptor values and lineage;
- adaptation, borrowing, mutation, crossover, migration, and repair records.

Project-local ratings and annotations are associated through typed
project-owned target rows; they are not candidate-owned references.

A beat component and an audition pairing are separate immutable entities. A
self-contained export may bundle a referenced beat or pairing for portability,
but that bundling does not transfer ownership or merge component identity,
lineage, locks, ratings, or feedback into the melody candidate.

Renaming, annotating, rating, favoriting, changing voice, changing volume, or
pairing a candidate with a beat does not change the candidate's melody identity.
A transformation or evolutionary operation creates a new candidate.

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

### 5.2 Separate creative concerns

- **Pitch shape** stores extended scale degrees, octave/register intent,
  contour, and motif-relative relationships.
- **Rhythm** stores onsets, positive durations, rests, accents, and ties on the
  integer timeline.
- **Tonal timeline** stores tonic, canonical scale identity, optional borrowing
  rules, and complete ordered modulation segments.
- **Beat** stores drum lane, onset, optional duration, velocity, accent/fill
  role, pattern family, seed, variation, and provenance.
- **Performance** stores voice, articulation, velocity-accent rendering, light
  reverb/delay, and bus levels. It is never a melody gene.
- **Audition pairing** links one melody component and one beat component for a
  listening session or saved Pair Lab pairing. It does not merge their
  identities or lineage.

### 5.3 Canonical time

The canonical V2 timeline is non-negative safe-integer onsets and positive
safe-integer durations at 480 PPQ. Canonical tempo is 30–300 BPM inclusive. A
canonical meter has numerator 1–32, denominator 1, 2, 4, 8, or 16, and at most
32 ordered positive beat groups whose sum is the numerator. A canonical loop
has positive length, spans at most 256 derived `BarSpan` values including a
partial final bar, and exposes at most 65,536 grid opportunities as
`ceil(loopTicks / gridTicks)`. The positive safe-integer `gridTicks` must divide
one denominator beat. The V1 compatibility profiles in section 3.3 are the
only permitted alternate PPQ and are exempt from these canonical tempo, meter,
bar-count, and grid-opportunity bounds where exact V1 preservation requires;
their PPQ, source grid, event ticks, and loop endpoints remain positive safe
integers and their tempo remains positive and finite. They cannot be silently
combined with V2 material. Seconds are derived only at audio/WAV presentation
boundaries.

Ticks per denominator beat are `480 × 4 / denominator`. All supported
denominators must therefore resolve to integer ticks. Bar length is numerator
times denominator-beat ticks. `loopTicks` is explicit and may end in a partial
bar. Grid and swing are transport subdivisions, not alternate timelines.

Every directly compared candidate must resolve against one comparison
transport: PPQ, tempo, meter, grouping, grid, and loop ticks. Source content is
never overwritten when an adaptation view creates a comparison rendering.

### 5.4 Tonal timeline

Tonal segments are ordered, non-overlapping half-open tick ranges covering
exactly `[0, loopTicks)`. Each segment has one tonic, one catalogue or custom
base scale, optional donor rules, and provenance. Segment boundaries are on
full bar boundaries. A partial final bar belongs to the preceding segment.

### 5.5 Custom scales

A scale is canonically a tonic-relative 12-bit pitch-class mask with bit zero
always set. Cardinality is 4–9. Pitch classes are unique, ordered ascending for
serialization, and identified independently of display spelling.

~~~ts
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

**Design decision — degeneracy:** a valid 4–9-note scale is still degenerate
when all of its selected pitch classes fit in one circular chromatic arc of
`cardinality - 1` semitones. For mask `m` with cardinality `k`,
`custom-scale-degeneracy-v2.0.0` is true exactly when there is an arc start
`s` in `0…11` such that every selected pitch class `p` has clockwise distance
`(p - s + 12) % 12 <= k - 1`. With `k` unique classes this is exactly a
contiguous chromatic cluster, so `{0,1,2,3}` is rejected. The predicate tests
all 12 starts and is transposition invariant. Structural validation separately
requires a 12-bit integer mask, tonic-relative bit zero, cardinality 4–9, and a
sorted duplicate-free pitch-class array that exactly enumerates the set bits.
Empty and full-chromatic masks are invalid independently of cardinality.
Catalogue scales, including symmetric whole-tone and octatonic sets, are not
degenerate under this predicate.

If the mask matches a catalogue entry, the catalogue ID and aliases win and no
`CustomScale` entity may carry that mask. A non-catalogue mask uses the stable
ID `custom-pcs-` followed by the lowercase three-digit hexadecimal mask and a
label `Custom 0, …` containing its ordered semitone formula. For example, mask
`0x123`, pitch classes `{0,1,5,8}`, is the valid non-degenerate identity
`custom-pcs-123`. Parent IDs and add/remove/shift/recombine operations remain in
provenance rather than in identity.

The label is derived exactly as `Custom ${pitchClasses.join(', ')}` and is not
editable entity identity. Each origin ID is
`stableId('scale-origin', allFieldsExceptId)`; parent IDs are unique,
ID-sorted soft ancestry and origin rows are unique and origin-ID-sorted.
Different derivations of the same mask therefore do not collide. The canonical
structural fields and derived label must match byte-for-byte, while persistence
and import merge provenance by stable union of origin IDs; the same origin ID
with different bytes rejects. This registered mergeable metadata is the only
CustomScale exception to the ordinary immutable-ID/different-byte collision
rule. Export emits the complete merged origin set, and reimporting it is
idempotent.

## 6. Product defaults

Defaults apply to a new V2 project. Migrated V1 values take precedence.

| Area | Default |
| --- | --- |
| Project | Name `Untitled Melody`; root seed `melody-forge`; Create destination; Legacy strategy; one injected metadata-clock value for both timestamps; preference occurrence `0` with empty immutable/active preference lists |
| Transport | 480 PPQ; 108 BPM; 4/4 grouped 2+2; eighth-note comparison/display grid (`gridTicks = 240`); straight swing initialized with `subdivisionTicks = 240` and `amountPermille = 500`; one displayed bar unless generated content establishes a longer exact loop; loop off; master 80% |
| Modern melody | C Ionian; 8 events; 4 quarter-note beats; eighth-note source generation grid; C4–C6; rests off; max leap 4 degrees; tonic closure on; population 8; seed `paper-kite` |
| Legacy melody | Existing V1 defaults: C Ionian; 8 events; 108 BPM; population 8; seed `legacy-amber` |
| Evolution | Population 8; retain one selected elite per selected parent where slots permit; exact deduplication; novelty protection on |
| Tonality | Tonic and scale frozen; relative pitch shape available to evolve; absolute-pitch lock off; borrowing and modulation off |
| Custom scales | Conservative cardinality target 7, hard range 4–9 |
| Beat | Muted; all five semantic lanes enabled; Straight family; density 42%; synchronized view of transport swing 0%; fill frequency Every 4 bars; variation strength 25%; index 0; comparison lock on; seed derived only from `beat/default` |
| Sound | Soft Pluck; articulation 55%; velocity accents 35%; reverb enabled at 10% wet with `tailTicks = 960`; delay disabled at 0% wet while retaining eighth-note `delayTicks = 240` and feedback 20%; melody 82%; beat 68%; effects return 20%; master 80% |
| Breed | Conservative directed preset; Parent A required, Parent B optional |
| Drift | Mixed bias; 4 candidates in each Near, Medium, and Far band |
| Islands | 8 candidates per island; migration every 3 completed island generations |
| Map | 8×8 archive; horizontal smooth→angular; vertical sparse→dense; 8 candidates per batch |
| Pareto | Two objectives: maximize population novelty and approach sounding-note density 0.65; user may replace them before the first run |
| Pair Lab | 8 melodies; 8 beats; three deterministic collaborators per component; hall of fame capacity 4 |

Fresh-root selectors are exact: `activeEvolutionMode = 'breed'`,
`activeExploreMode = 'map'`, `sharedBeatId = null`, `activePairingId = null`,
`accompanimentMuted = true`, `focusedMelodyCandidateId = null`, and every root
ID array starts empty. `loopEnabled = false`. The defaults registry creates and
strongly references one Create state, all six empty mode states, one empty
history graph, one empty undo state, the canonical transport, and the Soft
Pluck performance row in the same in-memory graph before first persistence.

**Design decision — backward-compatible sound:** migrated projects retain the
V1 triangle compatibility voice until the user chooses one of the six V2
voices. New projects use Soft Pluck. The compatibility voice is labelled as
such and is not exposed as a synthesizer editor.

The compatibility performance record is one content-addressed singleton with
fields `{ version: 'v1-compat-performance-v1', voiceFactoryId:
'v1-triangle-compat' }` and ID `stableId('performance', thoseFields)`. Every
migrated beat-null pairing initially references that singleton, and the
migrated project's `activePerformanceId` initially references it. V1 never
stored a project/candidate voice. Choosing a V2 performance changes only the
active/pairing performance reference; Restore compatibility reuses the same
singleton. Neither action changes the candidate, timing profile, comparison
transport, lineage, or migration receipt.

**Design decision — exact performance units:** every non-tick numeric field in
`PerformanceSettingsV2` is stored as an integer percentage point, not a binary
fraction. Articulation, accent amount, melody/beat/effects/master volume are
`0…100`; reverb wet amount is `0…30`; delay wet amount is `0…25`; and delay
feedback is `0…75`. Reverb `tailTicks` is a safe integer from `120…3840`.
Delay `delayTicks` is exactly one of `120`, `240`, `480`, or `960`. Disabled
effects still persist every default-valued field, so identity cannot vary by
caller omission. The complete default performance entity, before adding its
ID, is:

~~~ts
{
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
}
~~~

Its identity is `stableId('performance', allFieldsAbove)`.

**Design decision — optional accompaniment:** a new project has no audible
beat. The first Unmute or Regenerate action materializes deterministic beat
variation zero; thereafter the same locked beat is shared across ordinary
comparisons unless explicitly changed.

## 7. Shared transport and timing behavior

Exactly one transport authority schedules melody, beat, effects, playhead,
looping, MIDI, and WAV. It owns play/pause, stop, position, tempo, meter,
grouping, grid, swing, loop ticks, and cancellation tokens.

There is exactly one persisted swing value: `transport.swing`, comprising a
score-tick subdivision and an amount. `500` permille is straight and `750` is
the maximum exposed amount, where the first subdivision occupies 75% of the
pair and the second occupies 25%. The transport More control and Beat control
are synchronized views of this same field: editing either updates both. Swing
is never copied into a beat genome, candidate, pattern family, or performance
preset. Melody, beat, playhead, MIDI, and WAV all use the same exact rational
score-tick-to-performed-tick mapping; incomplete final pairs remain straight so
the loop endpoint cannot move.

The comparison/display grid is likewise one canonical transport field,
`transport.gridTicks`; it drives rulers, snapping proposals, descriptor grid
opportunities, and the default swing subdivision. The default equals
`gridTicks` when a complete two-subdivision swing pair divides one denominator
beat; for a coarser grid it is half the denominator-beat ticks. A configured
swing pair must always divide one denominator beat, so it cannot move a beat,
group, or bar downbeat. A rhythm genome may retain
`sourceGridTicks` as generation/import provenance, but that metadata never
becomes a competing playhead or comparison grid. Changing the shared grid does
not rewrite canonical event ticks unless a separately confirmed quantize action
previews and creates new material.

Grid and swing subdivision are two distinct controls and fields. Creating a
new transport, resetting transport defaults, or adapting input with no explicit
swing initializes `swing.subdivisionTicks` from the grid/fallback rule above.
After that initialization, editing `gridTicks` changes only the comparison/
display grid and editing `swing.subdivisionTicks` changes only the performed
timing map; neither edit silently follows the other. The Beat-panel Swing view
edits the same `transport.swing` amount and subdivision as Transport More and
never edits `gridTicks`. Each control labels its actual field and rejects a
value that violates the canonical grid divisor or swing-pair divisor rule.

Required meters and default groupings are:

| Meter | Grouping | Bar ticks at 480 PPQ |
| --- | --- | --- |
| 4/4 | 2+2 | 1,920 |
| 3/4 | 3 | 1,440 |
| 6/8 | 3+3 | 1,440 |
| 5/4 | 3+2 | 2,400 |
| 5/8 | 2+3 | 1,200 |
| 7/8 | 2+2+3 | 1,680 |

The user may choose another valid grouping for odd meters; pattern generation,
accent display, syncopation, and beat numbers use that grouping. The UI shows
bar, denominator beat, and grouping accent rather than pretending 6/8 is 3/4.

Playback rules:

- Play starts or resumes the focused candidate at the current position; Play
  from the stopped state starts at tick zero unless the user explicitly moved
  the playhead.
- Pause cancels future schedules but retains the integer resume tick. Stop
  immediately cancels every melody, beat, effect, animation, offline-preview,
  and callback schedule and returns to tick zero.
- Starting another candidate atomically invalidates the old schedule before
  scheduling the new one. No overlap or ghost completion callback is allowed.
- Tempo changes preserve the integer musical position and reschedule melody,
  beat, effects, and visual playhead together. Meter or loop changes while
  playing require an explicit apply-and-restart confirmation when they would
  change event interpretation.
- Loop confines every event and fill to `[0, loopTicks)`. A note ending exactly
  at `loopTicks` ends before the next-loop note-on.
- Swing delays every second subdivision in each pair by at most 50% of one
  subdivision without changing canonical onsets, loop duration, bar accents,
  or serialized event ticks. The playback/MIDI/WAV render records the selected
  swing value and applies the same deterministic timing transform.
- Directly compared candidates share transport, meter, bar grid, loop, and the
  locked beat. Incompatible source material opens adaptation preview before it
  can join that comparison.

Exact rational score/performed transforms, loop wrapping, and inverse swing
checks have zero tick tolerance. Only the final floating audio-clock/playhead
conversion may clamp a value to a closed loop endpoint when its error is at
most `1e-7` tick; a larger or meaningfully out-of-loop value is rejected. The
audio fake-clock gate remains stricter than `1e-9` second, so this clamp cannot
hide audible schedule drift.

## 8. Create

Create offers four starts: Legacy, Modern, Import MIDI, and Start from Library.
Legacy and Modern retain their V1 settings and generation semantics. Meter,
bars/exact length, beat, and performance are surrounding V2 concerns and do not
alter Legacy's event generation.

Before generation, common controls are visible. Advanced seed, detailed
constraints, borrowing, modulation, custom-scale operations, and operator
weights are collapsed. After a successful generation, the settings collapse
to a one-line summary and an Edit action; the candidate population moves to the
top of the creative workspace. Editing settings does not regenerate until the
user invokes the labelled Generate action.

Create actions always state whether they replace the current Create population
or create a history branch. If the current population contains unsaved work,
replacement requires confirmation; “Generate as new branch” is the safe
default.

### 8.1 Direct transformations

Each transformation is deterministic, creates a child, records component
locks and remapping, and leaves its source unchanged:

- **Keep rhythm, regenerate pitches** freezes onsets, durations, rests,
  accents, ties, transport, and beat; it generates legal pitch shape in the
  active tonal timeline.
- **Keep pitches, regenerate rhythm** freezes sounding MIDI pitches or relative
  degrees according to the selected pitch-lock mode; it changes onsets,
  durations, rests, accents, and ties without changing loop duration.
- **Remap tonic** translates through extended scale degrees into the target
  tonic, preserving contour and octave direction and reporting register repair.
- **Remap scale** uses the deterministic cross-cardinality projection in
  section 12 and reports every changed degree.
- **Near / Medium / Far variants** generate the three Drift distance bands from
  the exact same parent and labelled sub-seeds.
- **Continuation** creates one additional loop-length phrase whose opening
  derives from the source closing motif and contour, retains the active
  transport/tonality unless adapted, and does not concatenate or arrange it
  automatically.
- **Answering phrase** creates one loop-length response with recognizable motif
  or contour reference, contrasting cadence/direction, and explicit source
  provenance. It remains independently auditionable short-form material.

## 9. Deterministic beat generator

Beat is a separate genome and track with exactly five semantic event lanes in
this canonical order: `kick`, `snare-clap`, `closed-hat`, `open-hat`, and
`auxiliary`. A snare-clap event records `snare` or `clap` as its voice; an
auxiliary event records `tom` or `percussion`. Those voice choices do not create
sixth or seventh lanes. `enabledLanes` is a persisted, non-empty,
duplicate-free subset in canonical order; every BeatEvent must name an enabled
lane. The final lane cannot be disabled—beat absence or performance mute is the
silent state. Muting is a
performance state and does not disable lanes or change the BeatGenome. Browser
synthesis or bundled local assets may render events; runtime network access is
forbidden.

Required controls are Mute/Unmute, Regenerate, Previous variation, Next
variation, Lock beat, enabled lanes, seed, variation index, density, the
synchronized transport swing view, fill frequency, variation strength, beat
volume, and A/B beat audition. Regenerate changes the beat root seed
deliberately; Previous/Next changes only the integer variation index. Values
clamp visibly during direct editing but never silently on import.

Pattern families are Sparse, Straight, Half-time, Four-on-the-floor,
Breakbeat, and Odd-meter groove. Each family has distinct lane and accent
priors. Meter-aware templates derive from the active grouping: an odd pattern
is composed across its groups and may bridge them intentionally; it is never a
truncated 4/4 template.

Variation preserves family, meter, grouping, enabled lanes, primary backbeat/
downbeat roles, and recognizable anchor hits while deterministically changing
optional kick, snare/clap, hat, auxiliary, accent, and fill events in proportion
to variation strength. `fillFrequency` is exactly one of `never`,
`every-2-bars`, `every-4-bars`, `every-8-bars`, or `final-bar-only`; it is not a
number. Periodic fills target one-based BarSpan ordinals divisible by 2, 4, or 8
respectively, including a partial target BarSpan. Final-bar-only targets the
last actual full or partial BarSpan. Every fill starts within its target span,
and every hit ends at or before the exact loop boundary.

In Create, Breed, Drift, Islands, Map, and Pareto, all candidates in the active
comparison use the same locked beat by default. Changing that shared beat is a
separate explicit action and does not regenerate melodies or consume melody
seeds. Only Pair Lab may attach distinct beats to distinct melody candidates.

Beat and melody volumes are independent. Beat JSON and MIDI events remain on a
separate track/channel. The four persisted beat lock groups are exactly
`kick`, `snare-clap`, `hats`, and `auxiliary`; `hats` atomically covers both
closed-hat and open-hat events. A complete-beat lock covers all five lanes plus
family, enabled lanes, seed, variation, density, fill frequency, variation
strength, events, and provenance. Pair Lab exposes the four group locks. Frozen
groups compare canonical event bytes and cannot be mutated, repaired, reordered,
enabled, or disabled by an applicable algorithm.

## 10. Voices, performance, and audio ownership

The curated melody voices are Soft Pluck, Bell/Mallet, Warm Lead, Bass,
Chiptune, and Soft Keys. Each is a fixed, bounded preset behind the audio
adapter. Selecting one re-auditions the same candidate and changes no candidate
ID, genome, descriptor, provenance, or random stream.

Compact performance controls are:

- articulation, 0–100%, mapping from short detached to connected gate length;
- velocity accents, 0–100%, scaling stored accent values without changing
  pitch/rhythm genes;
- light reverb, 0–30% wet;
- light delay, Off or 0–25% wet at a transport-synchronized subdivision.

Values outside these safe creative ranges are not exposed. There is no
oscillator, envelope, filter-routing, modulation-matrix, or general effects
editor.

Audio uses separate melody, percussion, effects-return, and master buses.
Every candidate switch, stop, project replacement, unmount, failed audio
initialization, and offline render disposes or invalidates its owned schedules
and nodes. Effects tails sound only after their source; Stop cuts them
immediately, while WAV export may include a configured deterministic tail.

## 11. Locks and mutation controls

The user can independently freeze:

- relative pitch shape;
- absolute sounding MIDI pitches;
- rhythm;
- contour direction sequence;
- opening and closing sounding notes;
- rest positions;
- selected event IDs or half-open timeline regions;
- tonic, scale, or the complete tonal context;
- the complete beat;
- the four beat lock groups Kick, Snare/Clap, Hats, and Auxiliary in Pair Lab.

A relative-pitch lock preserves scale-degree shape while tonic or scale may
change. An absolute-pitch lock preserves rendered MIDI notes and therefore
blocks tonal changes that cannot contain those pitches under the configured
borrowing rules. The interface must explain this before applying the lock.

Changing an unrelated component cannot mutate, repair, reorder, or reserialize
a frozen component. Exact lock bytes are compared before accepting a child.
Contradictory locks produce an actionable constraint error listing the locks in
conflict and at least one remedy; they never degrade to best effort.

Event spans and region locks are half-open. An event intersects region
`[start,end)` exactly when
`max(event.onsetTick,start) < min(event.onsetTick + event.durationTicks,end)`;
mere contact at either boundary does not intersect. A straddling event is never
split. For validation, take the union of the lock's captured event IDs and IDs
intersecting the region in the before and proposed-after states. A pitch-region
lock requires each
applicable complete PitchGene in that union to exist on both sides with
byte-identical canonical data; a rhythm-region lock does the same for the
complete RhythmGene, including onset, duration, rest, accent, and tie; `both`
applies both tests. Thus a scoped event cannot be inserted, deleted, re-IDed,
or moved through a region boundary as a way to evade its lock. The lock record
stores the range, scope, initially covered IDs, and before fingerprints for an
explainable preview.

Advanced mutation strengths are independent 0–100 controls for pitch, rhythm,
motif, tonal context, borrowing, modulation, custom scale, and beat. Directed
presets configure real operator distributions:

| Preset | Non-zero emphasis and explanation |
| --- | --- |
| Conservative | Small pitch 18, rhythm 10, motif 12, tonal 5; preserves form and disables new borrowing/modulation/custom-scale changes |
| Pitch | Pitch 65, contour 35 through pitch operators; rhythm and beat 0 |
| Rhythm | Rhythm 65, motif timing 25; pitch, tonal, and beat 0 |
| Contour | Pitch 35 with contour inversion/direction operators weighted 70; rhythm 10 |
| Motif | Motif 70, pitch 20, rhythm 20; repeat/reverse/shift/invert/transpose operators dominate |
| Tonal | Tonal 50, borrowing 35, modulation 30, custom scale 20; pitch repair 15; rhythm and beat 0 |
| Wild | Pitch 75, rhythm 65, motif 70, tonal 60, borrowing 55, modulation 50, custom scale 45, beat 50 when beat is not locked |

The numbers are percentages displayed in Advanced controls, not a scalar alias.
Editing one value changes the preset label to Custom. Locks reduce the allowed
operator set visibly but never alter the stored preset.

Three-way comparison creates Near, Medium, and Far descendants from the same
immutable parent state and sibling-labelled seed streams; it cannot generate
Near first and then derive Medium/Far from that result.

## 12. Cross-scale breeding and tonal evolution

### 12.1 Adaptation preview

Parents may differ in tonic, scale/cardinality, register, event count, rhythm,
phrase length, meter, and tonal segments. They are never crossed as raw MIDI
values and their scales are never merged into an unrestricted pitch pool.

Before incompatible parents enter a shared comparison or Breed run, preview
shows the unchanged sources and a non-destructive rendered adaptation for:

- child meter, grouping, bars or exact loop length;
- timing policy: preserve absolute ticks, fit by musical positions, repeat
  whole material then crop at a boundary, or pad with an explicit rest;
- target register and every octave repair;
- target tonal strategy;
- every snapped, trimmed, padded, repeated, remapped, or repaired event.

The default is the active comparison transport and **fit by bar/beat position
without changing event order**, with Parent A's tonal context. Any trimming,
padding, note collision, or pitch repair requires explicit confirmation. A
preview that would violate a lock cannot be confirmed.

Target tonal strategies are Parent A context, Parent B context, both rendered
into a selected context, inherit and mutate a related context, constrained
hybrid/custom scale, or preserve/recombine complete tonal segments.

### 12.2 Deterministic scale-degree mapping

An extended source degree is decomposed into root-relative octave quotient and
pitch-class offset. The target degree is the target pitch class nearest to the
source root-relative chromatic position. Ties choose, in order: the target
degree that preserves the previous melodic direction; the smaller absolute
scale-degree displacement; the lower pitch. Register projection then uses the
fewest octaves, preserving contour direction where possible. Every tie and
repair is stable and recorded.

This algorithm applies to pentatonic, heptatonic, whole-tone, octatonic,
catalogue, and custom scales and to all tonic classes. The original parents and
their events remain untouched.

### 12.3 Scale-relationship graph

Each catalogue and custom scale/tonic context is a graph node. Edge evidence is
versioned and deterministic. Distance combines normalized:

- pitch-class symmetric difference;
- nearest-set pitch-class movement;
- same-tonic mode and modal-family relationships;
- relative and parallel relationships;
- one-note alterations;
- tonic circle-of-fifths distance and chromatic tonic distance.

Tonal mutation uses `tonal-mutation-bands-v2.0.0` over the direct
`tonal-relationship-v2.0.0` distance `d` and excludes the current context.
Low draws one destination from `0 < d <= 0.25`, with weight `1 - d`; if that
band is empty, only destinations at the minimum positive direct distance are
eligible with equal weight. Medium makes exactly two successive labelled draws;
at each hop it draws from `0 < d <= 0.50` relative to the current hop with
weight `1 - d`, excludes the immediately previous node, and on hop two excludes
the original source so the operation cannot cancel itself. If a hop band is
empty, its minimum-positive-distance destinations under the same exclusions
are equally weighted; if none exist, the child is rejected. High draws once
from the complete non-self graph with weight `d`; if all eligible weights are
zero, it uses equal weights. In every weighted draw probability is exactly
`weight / sum(eligible weights)`, eligible nodes are ordered by stable context
ID before seeded cumulative selection. Low, Medium, and High are distinct
operator policies rather than disjoint partitions, so Medium may deliberately
traverse a close edge also eligible to Low. The labelled streams are `tonal-mutation/low`,
`tonal-mutation/medium/hop-1`, `tonal-mutation/medium/hop-2`, and
`tonal-mutation/high`. The explanation records each hop, eligible band,
probability, relationship, and added, removed, and retained pitch classes.
Tonic and scale are independent optional genes and may be frozen separately.

### 12.4 Modal borrowing

Borrowing retains a base scale and named donor scale. A note shared by both is a
base-scale note. Only donor-exclusive pitch classes receive borrowed status.
Each borrowed event records donor ID, original/mutated degree, active segment,
operator, and resolution target/time.

Controls are donor scale, amount 0–100%, donor-exclusive notes only, keep strong
beats in base scale, resolve within Off/one denominator beat/one bar, and
preserve tonic boundaries. Defaults are amount zero, donor-exclusive on,
strong-beat protection on, resolution within one denominator beat, and tonic
boundary preservation on.

If no legal donor-exclusive pitch is available, the action explains why. A
required resolution must occur within the configured time and before a tonal
boundary or loop end; otherwise that borrowed event is rejected or visibly
repaired, never left unresolved silently.

### 12.5 Within-phrase modulation

Modulation may add/remove a segment, move a boundary, mutate destination tonic
or scale, exchange complete parent segments, or return to the opening context.
Boundaries are full-bar aligned and tonal coverage remains exact.

**Design decision — minimum length:** adding modulation requires at least two
complete bars, leaving at least one complete bar on each side of a boundary. A
shorter or partial-only phrase shows “Modulation needs two complete bars” and
offers a non-destructive phrase-length adaptation; it does not silently do
nothing.

Where allowed by locks and selected operators, destination selection prefers
common tones and boundary notes with smaller voice-leading motion. Candidate
summaries state the movement in plain language, for example `E Dorian → E
melodic minor`, `Borrowed C natural from E natural minor in bar 3`, or `Bars
1–2: E harmonic minor; bars 3–4: E Phrygian dominant`.

### 12.6 Evolved custom scales

Scale operators add one non-tonic pitch class, remove one non-tonic pitch
class, shift one non-tonic class by one semitone, recombine parent pitch-class
sets, and deterministically repair tonic/cardinality/duplicates. Repair first
keeps shared parent classes, then classes nearest to removed/shifted material,
then stable ascending pitch class until cardinality is valid.

Validation then applies `custom-scale-degeneracy-v2.0.0`. If the result is a
contiguous chromatic cluster, repair keeps tonic and all still-legal
parent-shared classes, then considers movable non-tonic classes in descending
pitch-class order. For each, it tests replacement pitch classes in ascending
order, choosing the first unique class that preserves cardinality and breaks
degeneracy. One successful replacement ends repair. If locks leave no legal
replacement, the operator rejects the child with the conflicting scale/event
locks; it never saves the cluster. Import uses the same predicate but does not
rewrite source bytes: preview offers this deterministic repair or Cancel, and
confirmation records the old mask, new mask, and moved class. Property tests
cover all 4,096 masks, all 12 transpositions, repair idempotence, catalogue
non-regression, and locked impossible cases.

The result view includes interval formula, compact keyboard or pitch-class
diagram, parent scales, additions/removals/shifts, aliases when a catalogue
match occurs, and relationship evidence. A custom scale works everywhere a
catalogue scale works: generation, Breed, Drift, Islands, Map, Pareto, Pair Lab
melodies, borrowing, modulation, Library, persistence, JSON, MIDI, and WAV.

## 13. Six evolutionary workflows

All modes implement the same candidate invariants, transport, playback,
persistence, provenance, cancellation, Library actions, and exports. Each owns
independent durable state and labelled sub-seeds. Switching alone cannot mutate
or clear it.

### 13.1 Breed

Breed is one/two-parent genetic evolution.

- Parent A is required; Parent B is optional. With one parent, descendants use
  mutation only. With two, every non-elite child must contain genuine traceable
  contribution from each parent when locks and compatibility make that
  feasible; otherwise the run explains why and does not pretend crossover
  occurred.
- Pitch, rhythm, motif, tonal-section, and whole-phrase crossover use
  musically aligned event, motif, beat-group, or bar boundaries.
- Component mutation follows the visible preset/advanced weights and locks.
- Exact phenotype duplicates are removed. Limited elitism, novelty quota,
  bounded retries, and deterministic immigrants protect diversity.
- Zero mutation disables crossover and mutation and returns only byte-exact
  copies of the selected parent or parents. If exact phenotype deduplication
  leaves fewer unique items than the requested population, the result is
  explicitly underfilled rather than inventing variation. Retained elites
  survive byte-for-byte at every strength.
- Provenance distinguishes Parent A, Parent B, mutation, tonal/timing remap,
  and deterministic repair at event and segment granularity.

Durable state includes both parent slots, population, selected elite(s),
crossover policy, weights, locks, adaptation, generation, ratings, and branch.

### 13.2 Drift

Drift is reversible local exploration from one pinned anchor. It creates 4 Near,
4 Medium, and 4 Far candidates by default from the same anchor, not from each
other.

Versioned combined distance is `0.30 pitch + 0.25 rhythm + 0.15 tonal + 0.20
structural + 0.10 beat`. Locks never remove or reweight a distance component:
they constrain operators, not measurement. Only a component absent from both
operands is removed, as defined by `phenotype-distance-v2.0.0`, and remaining
weights are renormalized. Distance bands are Near `[0.05, 0.22]`, Medium
`(0.22, 0.50]`, and Far `(0.50, 1]`. A valid exact copy is shown only as the
pinned anchor, not mislabelled Near.

Bias choices are Pitch, Rhythm, Motif, Tonal context, and Mixed; each changes
operator probabilities and the visible component contribution to distance.
Only explicit Promote makes a descendant the next anchor. The prior trail
remains, any prior anchor can be reopened, and evolving from it creates a new
branch.

### 13.3 Islands

Islands maintains at least these three deterministic subpopulations:

- **Conservative:** small pitch change, high parent fidelity, preserved rhythm;
- **Rhythmic:** duration, rest, syncopation, accent, and motif timing change;
- **Adventurous/Tonal:** borrowing, modulation, custom scales, and larger
  structural transforms.

Each has its own labelled random stream, population of 8 by default, operator
distribution, at most two pinned elites, novelty/crowding state, and generation
counter. “Evolve island” advances only that lane; “Evolve all islands” advances
each once in stable Conservative/Rhythmic/Adventurous order without sharing
random consumption.

Every third completed generation per island, one non-pinned migrant is selected
by greatest `phenotype-distance-v2.0.0` from the destination population, then
candidate-ID byte order, and sent cyclically Conservative → Rhythmic →
Adventurous → Conservative. Arrival places the candidate in a migrant slot or
challenger queue and never overwrites a pinned elite. Source island, departure
and arrival generations, adaptation, and acceptance are visible and persisted.

Cross-island diversity uses formula `islands-global-diversity-v2.0.0` over
unpinned **membership records** `(islandId, candidateId)`, not a set collapsed by
phenotype. For every membership, measure `phenotype-distance-v2.0.0` to the
nearest membership on a different represented island, breaking an equal
nearest distance by island ID then candidate ID, and take the arithmetic mean
of all membership contributions. The same exact phenotype on two islands
therefore contributes zero separately from each membership; it is never
dropped. An island is represented only when it has an unpinned membership, and
fewer than two represented islands yields zero. The persisted state stores
formula ID, value, every contributing source/destination membership and
distance, and generation vector.

After ordinary survivor selection, if global diversity is below `0.18`, each
non-cancelled global round considers only islands with at least one replaceable
unpinned survivor. It chooses the lowest mean membership contribution, then
stable island ID, and proposes replacing that island's lowest-novelty unpinned
survivor, then candidate ID, with one deterministic labelled-stream immigrant.
The replacement commits only if the recomputed total metric strictly increases.
At most one such replacement occurs per global round. If no island has a
replaceable survivor—for example all survivors are pinned—the round preserves
all populations and persists the reason `no-replaceable-survivor`; exhausted or
non-improving bounded attempts are likewise reported rather than weakening a
pin or deduplication rule.

### 13.4 Map

Map is an interactive 8×8 MAP-Elites/quality-diversity archive. The user chooses
two distinct registered descriptors whose normalized values are defined in
`[0,1]`. For axis value `v`, bin index is
`min(7, floor(clamp(v, 0, 1) * 8))`. Bin `i` has bounds
`[i/8, (i+1)/8)`, except bin 7 includes `1`; its center is `(i + 0.5)/8`.
The x and y indices form the stable cell ID. A missing/non-finite axis value is
not binned and is reported. Every cell stores those exact bounds, one
representative which may be pinned, and up to three challengers; pinning is a
state of the representative, not a second occupant.

Unrated candidates may fill empty cells. Replacement order is lexicographic,
never a hidden scalar score:

1. higher rating rank, where Unrated is 0 and ratings 1–5 keep their integer;
2. at equal rating, greater cell direct-preference balance;
3. smaller normalized distance to cell center;
4. greater novelty from occupied neighboring cells;
5. stable candidate-ID byte order.

Cell-center distance is Euclidean distance in the two selected normalized axes
divided by the bin half-diagonal `sqrt(2) / 16`, producing `[0,1]` for a
candidate in its assigned cell. Neighboring cells are the in-bounds Moore
neighborhood—up to eight cells with `abs(dx) <= 1`, `abs(dy) <= 1`, excluding
the cell itself. Neighbor novelty is the arithmetic mean
`phenotype-distance-v2.0.0` from the challenger to each occupied neighbor's
representative; challengers and empty cells do not contribute, and no occupied
neighbor returns zero. Neighbor representatives are visited by y index, then x
index, independent of UI order.

Pinned occupants cannot be replaced. For the representative, challengers, and
incoming item being ranked in one cell, direct-preference balance for `a` is
`Σ(activeCount(a preferred over b) - activeCount(b preferred over a))` over each
other item `b` in that cell pool. Repeated choices increment counts; Both,
Neither, and undone records contribute zero. The scalar balance makes even a
cyclic set of direct edges sortable; later tiers and ID resolve equal balances.
A displaced representative enters the challenger queue if it ranks within the
top three by the same order. Changing
axes preserves the complete candidate archive, recomputes versioned descriptors,
and deterministically re-bins every candidate without loss. A selected cell or
rectangular region can seed another bounded batch.

Coverage is occupied cells divided by 64. The persisted Map diversity policy is
`phenotype` by default or user-selected `selected-descriptor-plane`. Phenotype
diversity is the arithmetic mean `phenotype-distance-v2.0.0` over every
unordered pair of occupied representatives. Selected-descriptor-plane diversity
is the arithmetic mean Euclidean distance in the two selected normalized axes,
divided by `sqrt(2)`, over the same unordered pairs. Pairs are enumerated by
cell ID; fewer than two occupied representatives returns zero. Challengers are
excluded from both policies. The displayed value stores its policy and formula/
descriptor versions; neither coverage nor diversity is called quality.

Map also persists one-run tournament tokens. A or B adds only the chosen
candidate to `preferredForBatch`; Both adds both; Neither adds both to
`excludedForBatch`. For the next committed bounded batch, parent/source
selection first honors an explicitly selected cell/region, then eligible
`preferredForBatch` candidates in ID order, then the ordinary novelty/ID order;
excluded candidates cannot be parents or newly admitted challengers, although
an existing representative is not deleted. The tokens are consumed only by a
successful batch, not Cancel or validation failure. These tokens never change
ratings, descriptor values, cells, or the direct preferred-over edge used by
equal-rating replacement.

### 13.5 Pareto

Pareto uses deterministic NSGA-II-style multi-objective evolution with hard
constraint handling, nondominated sorting, Pareto rank, and crowding distance.
The user chooses two to four versioned descriptive objectives. Each is Minimize,
Maximize, Approach target, or Stay in range.

Approach target exposes absolute normalized distance to the target. Stay in
range is likewise an objective: zero inside the inclusive range and normalized
distance to the nearest boundary outside it. It is not a feasibility rule.
Objectives are never silently weighted or scalarized.

Hard constraints are a separate ordered list. Always-on domain invariants and
locks reject a child before Pareto evaluation. User-configurable Pareto hard
constraints are inclusive minimum/maximum bounds over registered normalized
descriptors, plus maximum absolute melodic leap in semitones and maximum
borrowed-note duration. Each stores a stable constraint ID, user order, unit,
and bound. Its normalized violation is zero when satisfied; otherwise absolute
boundary distance divided by the descriptor range, by 127 for leap, or by
`loopTicks` for borrowed duration, clamped to `[0,1]`. Feasible candidates
dominate infeasible ones. Infeasible ordering is lower sum of violations, then
lexicographically lower ordered violation vector, then candidate-ID byte order.
Only feasible candidates undergo ordinary nondominated objective sorting; an
infeasible candidate stores `paretoRank = null`, `crowdingDistance = 0`, and can
never appear on the frontier.

All objectives remain active when only two are selected as chart axes. The
nondominated frontier is labelled “trade-off frontier,” never “best melodies.”
Environmental selection first appends feasible fronts by ascending rank; a
partial final front uses descending crowding distance then candidate ID. If
fewer than the requested population are feasible, it fills remaining survivor
slots from valid-but-infeasible candidates in the exact violation order above.
Domain-invalid or lock-violating proposals are never retained as infeasible.

Reproduction tournaments first prefer feasible over infeasible. Between
feasible entrants the key is lower rank, greater crowding, greater active
reproduction-preference count, then candidate ID. In an infeasible-only
tournament the key is lower violation sum, lexicographically lower violation
vector, greater active preference count only after equal violations, then ID;
preference can never promote a worse violation. One-run exclusions apply before
forming the tournament. If exclusions leave no entrant they are reported and
ignored for that tournament in ID order rather than changing feasibility or
constraints. The shared attempt budget may retain enough valid infeasible
survivors to reach capacity, but if distinct domain-valid candidates are still
unavailable the result remains visibly underfilled; it never relaxes a
constraint, duplicates an item, or fabricates rank/crowding. The compare tray
is user-owned and has no algorithmic effect until an explicit preference action.

### 13.6 Pair Lab / co-evolution

Pair Lab owns separate melody and beat populations sharing meter, tempo,
`loopTicks`, PPQ, grouping, and grid. It supports Lock beat/evolve melodies,
Lock melody/evolve beats, Evolve both, per-beat-layer freezes, partner swaps,
melody-only, beat-only, and together audition.

Each component is evaluated with three deterministically sampled collaborators:
one current strong preference-compatible partner, one diversity partner, and
one hall-of-fame partner when available. There are exactly three separate halls:
melody components, beat components, and ordered pairings, each with capacity
four and stable replacement. A melody's collaborators come from the beat
population/beat hall; a beat's come from the melody population/melody hall.

Feedback is explicit and distinct:

- **Prefer melody** updates only melody evidence;
- **Prefer beat** updates only beat evidence;
- **Prefer pairing** updates only the pair relationship evidence;
- **Reject pairing** updates only negative evidence for that combination.

No feedback is inferred across these boundaries. Melody, beat, and pairing
lineage, parentage, ratings, evidence, favorites, and exports remain separate.
The user may save a melody component, beat component, or pairing independently.

`pair-phenotype-distance-v2.0.0` compares two complete pair auditions as `.55 ×
melody phenotype distance + .30 × beat distance + .15 × absolute difference in
accent-coincidence-v2.0.0`; when both beats are absent the beat term is omitted
and weights renormalize, while one absent beat has beat distance `1`. A
component's collaborator novelty is the mean distance from each of its three
validated pair auditions to the other two; duplicate fallback pairings count
once. Fewer than two distinct valid pairings returns zero. This descriptive
value contains no preference credit.

The complete transition is `pair-lab-transition-v2.0.0`:

1. A cold start deterministically derives eight melodies and eight beats from
   the selected source(s) and distinct labelled streams. The active melody and
   beat form the first pair. All three halls start empty unless explicitly
   seeded by imported evidence. A missing hall collaborator falls back to the
   next stable opposite-population member and is marked fallback, never sampled
   randomly.
2. For component `i`, the strong collaborator is the compatible component with
   the fewest Reject-pairing observations with component `i`, then greatest
   positive explicit component-evidence count, then ID. The diversity collaborator maximizes
   `phenotype-distance-v2.0.0` from the strong collaborator, then ID. The hall
   collaborator comes from the *opposite component hall* at `(generation + i)
   mod hallSize`. If that hall is empty, stable opposite components extracted
   from the pairing hall may supply it; otherwise the stable population fallback
   applies. Duplicate collaborators are replaced by the next stable compatible
   ID where possible.
3. Evidence remains separate records: melody-component positive counts,
   beat-component positive counts, one-round tournament exclusions, and ordered
   melody–beat pair positive/negative counts. Prefer actions increment only
   their named positive count; Reject pairing increments only that pair's
   negative count. Pair evidence never appears in either component's
   reproduction key.
4. For each unlocked population, pinned components survive first. Binary
   tournaments exclude a still-active one-round exclusion, then order
   components by more positive component evidence, greater
   `pair-phenotype-distance-v2.0.0` collaborator novelty as defined above, then
   ID. Labelled crossover/mutation produces children under all
   locks. Parent and child components are merged; the same key plus distinct
   phenotype preference selects eight survivors, with bounded immigrant
   fallback for underfill. A locked population is copied byte-for-byte and
   consumes no reproduction stream.
5. `Evolve both` computes both proposed populations from the same immutable
   starting state and separate melody/beat streams, builds the next collaborator
   schedule only after both validate, and commits atomically. Completion order
   cannot affect results.
6. An explicit Prefer melody/beat admits that component to its side's hall of
   fame; Prefer pairing admits only the ordered `(melodyId, beatId)` to the
   pairing hall. The two component halls rank by more named component-positive
   evidence, more distinct successful opposite-component IDs, earlier admission
   generation, then component ID. A successful collaborator is a distinct
   opposite-component ID paired with that component in a validated, persisted
   collaborator schedule for a completed round; duplicate schedule slots and
   repeated rounds with the same opposite ID count once and do not imply pair
   preference. The pairing hall deliberately has no “distinct successful
   collaborators” key: it ranks by more explicit Prefer-pairing observations,
   fewer explicit Reject-pairing observations, earlier admission generation,
   then pairing ID. Thus component halls read component evidence only and the
   pairing hall reads pairing evidence only. At capacity four an admission is
   compared with the last-ranked entry under its hall's own key and replaces it
   only when it ranks strictly ahead; otherwise the hall is unchanged. Reject
   pairing never removes component hall entries and triggers no immediate hall
   eviction. All key inputs and admission/replacement decisions are persisted.

Exact ties use UTF-8 byte order of stable IDs. A round that cannot assemble a
compatible collaborator set or valid child after the common attempt budget
returns an actionable underfill/error and never transfers credit or silently
changes timing.

## 14. Descriptors, distance, and diversity

Every descriptor stores an ID, formula version, raw value, normalized value
where meaningful, active meter/loop dependencies, and calculation inputs.
Descriptors describe music; they imply preference only when the user explicitly
uses one as an objective or rating criterion.

Unless stated otherwise, ratios are clamped to `[0,1]`, rests are explicit
timeline spans, and sounding events exclude rests:

- **Sounding-note density:** sounding onsets divided by available active-grid
  slots, normalized to 1 at one onset per grid slot.
- **Rest density:** total rest ticks divided by loop ticks.
- **Pitch-range usage:** sounding MIDI max–min divided by configured register
  max–min; zero for fewer than two sounding notes.
- **Mean interval/angularity:** mean absolute successive sounding semitone
  interval divided by 12, capped at 1.
- **Contour change:** direction reversals among non-zero successive pitch
  intervals divided by possible reversals.
- **Repeated motif/n-gram amount:** proportion of sounding degree/rhythm tokens
  covered by repeated contiguous 2–4-token n-grams, counting covered positions
  once.
- **Rhythmic-duration diversity:** normalized Shannon entropy of sounding and
  rest duration categories on the active grid.
- **Syncopation:** duration-weighted onsets and ties crossing from weak to
  stronger meter positions, divided by the maximum for occupied positions;
  strength comes from the active odd-meter grouping.
- **Base-scale stability:** base-scale sounding ticks divided by total sounding
  ticks, with shared base/donor pitches counted as base.
- **Borrowed-note amount:** genuinely donor-exclusive sounding ticks divided by
  total sounding ticks; borrowed duration is also exposed in ticks/beats.
- **Modulation amount and distance:** non-opening-context ticks divided by loop
  ticks, plus mean relationship-graph distance between adjacent tonal segments.
- **Pitch parent distance:** aligned pitch-class/register edit distance plus
  contour difference, normalized by the longer parent/child sequence.
- **Rhythm parent distance:** onset, duration, rest, accent, and tie edit cost
  normalized by loop and event count.
- **Tonal parent distance:** segment-boundary edit distance plus weighted
  context graph distance over aligned ticks.
- **Combined parent distance:** the Drift weighted combination, with absent
  components removed and weights renormalized.
- **Population/archive novelty:** mean distance to the five nearest distinct
  phenotypes, or all available neighbors when fewer than five exist.
- **Beat density:** beat onsets divided by enabled-lane × active-grid
  opportunities, accompanied by per-lane values.
- **Beat syncopation:** the melody syncopation formula applied to percussion
  accents with lane-role weights.
- **Melody–beat accent coincidence:** weighted melody accent onsets coinciding
  with beat accent windows divided by weighted melody accent onsets.

### 14.1 Normative formula registry

The preceding names are shorthand; the following registry removes all formula
latitude. Every calculation uses validated candidates on one comparison
transport. Division by a zero denominator returns zero. Arithmetic is computed
in deterministic IEEE-754 double precision, clamped only at the stated final
step, and serialized with the raw input counts so another implementation can
recalculate it. Stable event order is onset, lane when present, then event ID.

- `descriptor-core-v2.0.0`: available grid slots are
  `ceil(loopTicks / gridTicks)`. Sounding density is sounding-onset count divided
  by that count. Rest density integrates the union of explicit rest spans and
  uncovered monophonic timeline spans once, divided by `loopTicks`. Pitch range
  and mean interval use the formulas above. Contour intervals of zero are
  removed; reversal count is divided by `max(remainingDirections - 1, 1)`.
- `motif-ngrams-v2.0.0`: each ordered event becomes
  `(rest|extendedScaleDegree, durationTicks/gridTicks as a reduced rational)`.
  For `n = 2,3,4`, mark every token position belonging to an exact n-gram that
  occurs at two or more different start indices. Repeated amount is the size of
  the union of marked positions divided by token count; overlapping matches are
  counted once. Fewer than two tokens returns zero.
- `rhythm-entropy-v2.0.0`: a duration category is `(restFlag,
  durationTicks/gridTicks)` as a reduced rational. With probabilities `p_i`, raw
  entropy is `-Σ p_i log2(p_i)` and normalized entropy is raw entropy divided by
  `log2(eventCount)`. Zero or one event/category returns zero. Because the
  number of occupied categories cannot exceed event count, the result is in
  `[0,1]` without a post-hoc cap.
- `meter-syncopation-v2.0.0`: structural strength at a tick is the maximum
  applicable value: bar start `1`, meter-group start `0.8`, denominator-beat
  start `0.6`, transport-grid start `0.3`, otherwise `0`. A tied chain is one
  span; other sounding events are separate spans. For each span, find the
  greatest strength strictly after its onset and no later than its end. Its
  contribution is `spanDuration × max(0, laterStrength - onsetStrength)`.
  Divide the sum by `totalSoundingTicks`; thus the normalized range is `[0,1]`.
  A boundary exactly at the exclusive loop end is eligible only for a tie that
  audibly reaches it. Partial bars use their real structural boundaries.
- `tonal-relationship-v2.0.0`: render both non-empty contexts to absolute
  pitch-class sets. `pcDifference = popcount(A xor B)/12`. Compute `A→B` as
  the arithmetic mean, over every class in A, of its nearest circular semitone
  distance to B divided by 6; compute `B→A` identically; `nearestMovement` is
  `(A→B + B→A)/2`. `modePenalty` is `0` for identical context,
  `0.2` for a named relative or parallel relationship, `0.35` for a same-tonic
  catalogue-family relation, `0.5` for an exact one-class addition/removal, and
  `1` otherwise; the first matching tier wins. `fifths` is minimum circle-of-
  fifths tonic steps divided by 6; `chromatic` is circular tonic semitones
  divided by 6. Relationship distance is `.35 pcDifference + .20
  nearestMovement + .15 modePenalty + .15 fifths + .15 chromatic`. The graph is
  a complete undirected graph and this symmetric direct value is its edge
  weight and the distance used by descriptors; shortest-path accumulation is
  never substituted. Mutation “one/two edge” language means one/two successive
  labelled context choices, with each choice sampled from the stated direct
  distance band. Relationship labels are evidence, not hidden bonuses.
- `pitch-parent-distance-v2.0.0`: apply Wagner–Fischer alignment to sounding
  event sequences. Insertion/deletion cost is `1`. Substitution cost is `.5 ×
  circularPitchClassDistance/6 + .3 × min(abs(MIDI difference)/48, 1) + .2 ×
  directionMismatch`, where the direction into each event is down/level/up,
  first-to-first matches, and unequal directions cost `1`. Divide terminal cost
  by the longer sequence length.
- `rhythm-parent-distance-v2.0.0`: apply Wagner–Fischer alignment to all event
  tokens. Insertion/deletion cost is `1`. Substitution cost is `.25 ×
  abs(onset difference)/loopTicks + .25 × abs(duration difference)/loopTicks +
  .20 × restMismatch + .15 × abs(accent difference) + .15 × tieMismatch`.
  Accents are normalized `[0,1]`; Boolean mismatches are zero or one. Divide by
  the longer event count.
- `tonal-parent-distance-v2.0.0`: partition the loop at every boundary from
  either tonal timeline. For each atomic span, multiply span duration by
  `tonal-relationship-v2.0.0` for the two active contexts and divide the sum by
  `loopTicks`. Boundary cost is one minus exact-tick Jaccard similarity of the
  two sets of internal boundaries, with two empty sets equal. Final distance is
  `.75 × timeWeightedContext + .25 × boundaryCost`.
- `structural-distance-v2.0.0` is the arithmetic mean of absolute differences
  in contour change, repeated amount, and rhythmic-duration diversity.
  `beat-distance-v2.0.0` applies `rhythm-parent-distance-v2.0.0` independently
  within every lane present in either beat; a lane absent on one side is an
  empty sequence, so its non-empty events incur insertion/deletion cost. The
  final distance is the weighted arithmetic mean of those per-lane distances,
  with kick `1`, snare/clap `1`, closed/open hats `0.5`, and auxiliary `0.75`;
  weights for lanes absent from both are omitted and the rest renormalized.
- `phenotype-distance-v2.0.0` and combined parent distance use `.30 pitch +
  .25 rhythm + .15 tonal + .20 structural + .10 beat`. Locks never change a
  distance formula. A component absent from both operands is omitted and the
  remaining weights are renormalized; a component present on only one side has
  component distance `1`. Thus distance is symmetric. Distinct means
  unequal exact rendered phenotype bytes. Novelty is the arithmetic mean of
  distance to the five nearest distinct phenotypes, or all neighbors if fewer;
  no neighbor returns zero. Distance ties use candidate-ID byte order.
- Parent-relative descriptors are stored separately for every actual parent ID
  and never silently average Parent A with Parent B. Drift always references
  its one immutable anchor. Any scalar Map/Pareto use with two parents stores a
  reference policy: Parent A, Parent B, nearest parent (`min`, the Map default),
  or midpoint (`(A+B)/2`); the selected policy and both source values are
  persisted. Generic population/archive novelty is pairwise and has no parent
  reference.
- `beat-descriptors-v2.0.0`: lane opportunity count is grid slots times the
  number of enabled lanes. Density counts onsets, globally and per lane. Beat
  syncopation applies `meter-syncopation-v2.0.0` with nominal event duration one
  grid subdivision and lane weights kick `1`, snare/clap `1`, hats `0.5`, and
  auxiliary `0.75`; weighted nominal ticks form its denominator.
- `accent-coincidence-v2.0.0`: a melody onset's window is inclusive
  `±max(1, floor(gridTicks/4))` ticks. Melody weight is its stored accent in
  `[0,1]`. Coincidence weight is the maximum beat event weight in the window:
  normalized beat accent multiplied by the lane weight above. Sum melody weight
  times coincidence weight and divide by total melody accent weight. Each
  melody onset contributes once; a beat may support several melody onsets.
- `tonal-axis-v2.0.0` is `.50 × borrowedNoteAmount + .30 × modulationAmount +
  .20 × modulationDistance`. This is the only combined tonally-stable-to-
  borrowed/modulating Map axis. It does not replace its three source
  descriptors.

Descriptor axis orientation is stable: smooth→angular uses angularity,
sparse→dense uses sounding density, narrow→wide uses range usage,
repetitive→varied uses one minus repeated amount, straight→syncopated uses
syncopation, tonally stable→borrowed/modulating combines one minus stability
through `tonal-axis-v2.0.0`, parent-faithful→novel uses combined parent distance,
and the two beat axes use beat density and accent coincidence.

Convergence controls are exact rendered-phenotype deduplication, bounded
elitism, a configurable but deterministic novelty quota, crowding/distance
preservation, and labelled random immigrants. After bounded attempts fail, the
algorithm follows this order: visible permitted repair, another allowed
operator, then a valid elite. It never loops indefinitely or emits an invalid
candidate.

The shared attempt budget is `operator-attempt-budget-v2.0.0`. For each output
slot, the selected primary operator receives 12 proposals. The final rejected
proposal receives at most one allowed deterministic repair. Up to seven other
enabled operators then receive 12 proposals each in stable operator-ID order.
If a distinct result is still required, up to 16 labelled-stream immigrants are
validated. The per-slot ceiling is therefore 113 validation calls and the
batch ceiling is `requestedSlots × 113`; validation counts, rejection codes,
repair, alternate operators, immigrants, and fallback are recorded. A valid
elite is the final fallback only when it does not violate the workflow's exact
deduplication rule; otherwise the result is visibly underfilled. Custom-scale
repair and collaborator selection have no hidden retries beyond this budget.

## 15. Selection, focus, and audition

Focus, parent/anchor selection, Compare-tray membership, favorite state, Library
save state, and current playback are independent. A card can have several of
these states and each must be labelled.

- Directly playing a candidate replaces the prior schedule and retains the
  current shared beat unless in Pair Lab.
- Number keys audition visible candidates in their displayed order without
  changing creative seeds. Space plays/stops the focused candidate. Arrows move
  focus among cards or chart points. `P` applies the mode-appropriate
  parent/anchor action, `F` toggles Favorite, and `E` invokes the current
  explicitly labelled primary evolution action.
- Shortcuts are ignored in text fields, numeric fields, selects, editable
  annotations, dialogs requiring text, and while modifier keys are held.
  Visible controls provide every equivalent action.

### 15.1 Blind A/B tournament

Blind A/B samples two eligible candidates with a UI-only labelled shuffle that
does not alter creative randomness. It hides name, origin, island, parents,
rating, and provenance until the decision. Every scope shares transport,
performance voice, and normalized levels. Melody scope also uses one identical
locked beat; Beat scope uses one identical melody while the beats differ; Pair
scope intentionally compares two complete melody–beat pairings and therefore
requires neither component to match. The user chooses A, B, Neither, or Both. The explicit
result feeds only the following active-mode mechanism. Provenance and actual
order are revealed after the choice and stored with the result.

Every committed decision creates immutable `PreferenceRecordV2` version
`preference-record-v2`. It stores project ID, a project-global
`occurrenceOrdinal`, mode, mode generation/revision reference, scope, the actual
typed items shown as A and B, their neutral playback order, outcome, the exact
versioned state-effect payload below, and comparison-fairness fingerprints for
transport, performance, normalized levels, and scope context. Scope context is
the identical beat phenotype for Melody, identical melody phenotype for Beat,
or normalized routing for Pair. The item reference is a melody candidate, beat
component, or ordered pairing as required by scope; decoders reject a mismatched
kind.

The normalized record root has exactly these frozen serialized keys, in this
order; the referenced unions and canonical effect validation are specified in
Architecture section 7.7:

~~~ts
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

`occurrenceOrdinal` is allocated from the persisted non-negative safe-integer
`nextPreferenceOccurrence`, then that counter increments. It is never reused or
decremented after undo, branch navigation, reload, or an identical repeated
decision. Record identity is exactly
`stableId('preference', preferenceRecordWithoutId)` over every immutable field
above, including `version`, `projectId`, and `occurrenceOrdinal`. No timestamp,
random UUID, display name, or UI order outside the stored neutral A/B mapping
participates. The project retains the immutable record in its decision log;
active-effect membership is separate. Undo removes/inverts the active effect
and marks the record inactive in that membership without deleting it or making
its ordinal reusable. A preference never changes a rating, favorite, Library
entry, lock, creative seed, candidate bytes, or objective/descriptor value.

| Mode | A or B | Both | Neither | Effect on the next run |
| --- | --- | --- | --- | --- |
| Breed | Increment only the chosen candidate's pairwise-preference count and place it in Parent A; retain the prior Parent A as Parent B when distinct and compatible. | Increment both equally and place actual A/B in Parent A/B. | Increment neither; keep parent slots and mark both ineligible for the next parent tournament only. | Preference count breaks ties after feasibility/elite status and before novelty/ID; parent placement is explicit because the tournament decision itself chose it. |
| Drift | Increment positive evidence for the chosen descendant and each operator ID in its provenance. | Increment both descendants/operator sets. | Increment negative operator evidence for both; anchor is unchanged. | The next same-anchor batch orders enabled operator buckets by positive-minus-negative evidence before stable operator ID. Only a separate Promote action can change the anchor. |
| Islands | Increment only the chosen candidate's island-preference count. | Increment both equally. | Increment neither and exclude both from one island reproduction tournament. | After pinned elites and feasibility, component preference precedes novelty in survivor and migrant tie-breaking; it never pins or moves a candidate by itself. |
| Map | Add a direct preferred-over edge from the chosen candidate to the other and prefer the chosen candidate for one batch. | Prefer both for one batch; add no directed edge. | Exclude both from parent/new-challenger admission for one batch; add no directed edge. | Section 13.4 consumes the one-batch tokens in parent/source selection; direct edges break only equal-rating replacement tiers. Axes, descriptors, bins, existing representatives, pins, and ratings do not change. |
| Pareto | Increment only the chosen candidate's reproduction-preference count. | Increment both equally. | Exclude both from parent tournaments for one run. | For feasible entrants preference follows rank/crowding; for an infeasible-only tournament it follows equal violation sum/vector. It cannot alter constraints, objective values, dominance, rank, or the displayed frontier. |
| Pair Lab | In Melody or Beat scope, apply the corresponding Prefer component action to the chosen item; in Pair scope, apply Prefer pairing to the chosen ordered pair. | Apply the same named positive action to both items/pairs. | In Pair scope, apply Reject pairing to both; in component scope, add a one-round parent-tournament exclusion without negative cross-credit. | Only the scoped evidence vector from section 13.6 is read; melody, beat, and pairing credit never cross. |

### 15.2 Continuous audition

Continuous audition traverses a user-selected population/order, visibly marks
the current item, and advances at the loop end after any configured one-loop or
two-loop count. Favorite, mode-appropriate Parent/Anchor, Skip, Previous, and
Stop remain available without exiting. Stopping cancels auto-advance. Reordering
the UI changes audition order only and never candidate generation.

## 16. History, branching, and undo

Evolutionary history is the persistent normalized branch graph defined in
section 5.1.1. Every generation, anchor promotion, archive run, Pareto run,
migration, and co-evolution round records one occurrence node with one nullable
earlier `parentNodeId`, mode/action, and a strong snapshot containing seeds,
versions, candidate order, ratings, and annotations. Genetic multi-parentage
belongs to candidate lineage, never history parentage. Child lists are derived
and appending a branch never rewrites an older node.

Opening an older node is read-only until the user changes it. Evolving from it
creates a new child branch; later nodes on other branches remain intact. The
active path is explicit. Branch rename is metadata-only.

Undo/redo covers reversible editing actions such as a control change, lock,
rating, annotation, or selection and is scoped to the current node. It is not
Earlier/Later history navigation and never erases evolutionary descendants.

Create settings, mode populations, selections, Drift trail, Island migration,
Map representatives/challengers/pins, Pareto objectives/fronts, Pair Lab
components/partnerships, tonal timelines, custom scales, beats, locks, ratings,
annotations, seeds, and algorithm versions all restore exactly after reload.

## 17. Local Library

Library stores immutable candidate/component data plus editable name, short
note, favorite, saved time, and origin references. Project and item names are
limited to 80 Unicode characters; the short note is limited to 280. It supports search and
filters by name, tonic, scale, meter, origin, workflow mode, and favorite state.
Sorting by name, saved time, tonic, scale, or origin is organizational and
cannot affect creative randomness.

Library rows are global and independently persisted, not project-owned child
rows. `ProjectV2.libraryItemIds` is the project's ordered reference list;
deleting a project never deletes a Library row. A complete project export
bundles every Library row referenced by that list and the immutable component
rows each Library item needs. Importing the same component ID with identical
canonical immutable bytes reuses the component and merges stable-ordered unique
origin references. The same ID with different immutable bytes rejects the
entire transaction. Rename, note, favorite, and saved-time changes never alter
component identity, and removing a project reference is not Library deletion.

Every melody candidate can be auditioned, opened, used as Breed Parent A/B,
used as a Drift anchor, or used to seed Islands, Map, Pareto, or Pair Lab. Beat
components can seed Pair Lab or become the shared project beat. Pairings can be
opened in Pair Lab. Incompatible combinations launch adaptation preview.

Rename and annotation never change musical identity. Remove asks for
confirmation and explains whether the item remains reachable from project
history. V1 favorites migrate with their content, favorite state, identity,
and all available provenance.

## 18. MIDI import

MIDI import is preview-and-confirm and never replaces project state on file
selection. The parser reports file format, tracks, track/channel names,
detected tempo and meter events, PPQ conversion, event timing, polyphony,
proposed quantization, proposed phrase/loop length, likely tonic/scale matches,
register adaptation, and every proposed snap, trim, pad, or conversion.

`midi-import-bounds-v2.0.0` rejects before allocation-heavy analysis when the
raw file exceeds 5 MiB (5,242,880 bytes), declares more than 64 tracks, exceeds
200,000 total decoded MIDI/meta/sysex events across all tracks, contains an
event delta greater than the Standard MIDI variable-length maximum
`0x0fffffff` ticks, or has a greatest absolute event/end tick more than 4,096
source quarter-note beats from tick zero (`absoluteTick > sourcePpq * 4096`,
compared with overflow-safe integer/rational arithmetic). Format 0 and 1 PPQ
divisions 1–32,767 are supported; SMPTE division and format 2 are rejected with
their own issue codes. The event counter includes ignored metadata and
unsupported events so they cannot bypass the cap. Hitting a cap leaves project
and preview state unchanged and reports the measured value and exact limit.

The user selects one pitched track from a multitrack file. A monophonic track
imports directly after confirmed timing conversion. For true polyphony the
user must choose one deterministic extraction strategy: Highest note, Lowest
note, Earliest-onset priority, or Reject import. Ties use original track event
order as specified below. No notes are dropped before a strategy is explicitly
selected and confirmed.

`midi-monophonic-extraction-v2.0.0` runs on source-PPQ half-open note intervals
before PPQ conversion or quantization. It forms sorted atomic boundaries from
every note start/end; note-offs are applied before note-ons at the same tick.
For each non-empty span with active notes, Highest selects `(MIDI pitch
descending, original note-on event ordinal ascending)`, Lowest selects `(MIDI
pitch ascending, original note-on event ordinal ascending)`, and Earliest-onset
selects `(onsetTick ascending, original note-on event ordinal ascending, MIDI
pitch ascending)`. The selected source owns that complete atomic span. Adjacent
spans coalesce only when they have the same source note ID; if a source loses
and later regains priority it produces separately indexed fragments rather than
bridging through another pitch. A source selected for no span is `discarded`; a
source selected for fewer ticks is `shortened`; more than one non-adjacent span
is `split`. Fragment IDs derive from file content hash, track index, source
note-on ordinal, and zero-based fragment ordinal. Velocity and channel copy from
the owning source note. Reject performs no sweep or timing adaptation and keeps
the file preview available. The confirmation preview lists every source note's
kept/discarded/shortened/split disposition and every fragment tick range.

**Design decision — quantization default:** preserve original converted ticks
when they are positive, ordered, and representable at 480 PPQ. Suggested
quantization is eighth-note for visibly quantized material and sixteenth-note
otherwise, but defaults to Off. Snapping, overlap repair, trimming, padding,
register octave shifts, or meter reinterpretation are destructive adaptations
and require checked confirmation.

Confirmed imports create versioned normal candidates usable in all workflows.
Cancel returns to the unchanged project. An unsupported division, malformed
track, empty selected track, impossible timing, or unchosen polyphony strategy
produces a track/file-specific actionable error.

## 19. Import, export, and offline rendering

Project import/export and candidate import/export are separate commands and
versioned envelopes.

The serialized schema-2 keys below are frozen compatibility names even if
internal TypeScript symbols are later refined:

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

Every `tables` property is a normalized array table, never an object map whose
key implies identity. Project table keys, in exact serialized order, are
`createStates`, `modeStates`, `historyGraphs`, `historyNodes`, `snapshots`,
`melodyCandidates`, `melodyGenomes`, `transports`, `v1TimingProfiles`,
`tonalTimelines`, `customScales`, `beats`, `performanceSettings`, `pairings`,
`preferenceRecords`, `libraryItems`, `ratings`, `annotations`, `undoStates`, and
`migrationReceipts`. Candidate tables are the applicable subset in this exact
order: `melodyCandidates`, `melodyGenomes`, `transports`, `v1TimingProfiles`,
`tonalTimelines`, `customScales`, `performanceSettings`, `ratings`, and
`annotations`. Every table array is sorted by embedded `id` ascending by Unicode
code point and contains no duplicate ID. Domain arrays retain their explicitly
declared order; arrays documented as ID sets are sorted by the same ID order.

Canonical encoding uses the object-key order declared by each versioned codec,
the envelope order `kind`, `schemaVersion`, payload, UTF-8 without BOM, and
exactly one trailing LF byte. A decoder rejects unknown keys, duplicate IDs,
key/embedded-ID mismatch at persistence boundaries, unresolved strong
references, invalid ordering, and missing referenced rows. Encode performs a
strict decode-after-encode before bytes are offered.

`rootProjectId` must equal `project.id`. Traversal begins at the project and
includes every transitively strong referenced row, including all immutable and
active preference-record IDs and every globally stored Library row named by
`libraryItemIds`; no extra unreachable row is permitted. `rootCandidateId`
must resolve to exactly one candidate. `performanceId` is either `null` or a
strong reference to the one audition preset intentionally bundled with the
candidate; it is `null` iff `performanceSettings` is empty, otherwise that
table contains exactly its one resolved row. No pairing or beat is inferred.
Candidate traversal follows the candidate's genome, timing, tonal/custom-scale,
and optional performance references, then selects the active source project's
rating/annotation rows whose typed target is the root candidate. Embedded
provenance/lineage parent IDs remain soft and
do not force unbounded ancestry into either envelope.

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

The M2 schema kernel owns the envelope/table order and the section 5.1.1
support records/payload versions required for new-project and V1 migration. A
later mode cannot persist opaque JSON: its milestone must first freeze and
register the exact payload/reference codec. Complete all-table DATA-004 closure
and every-mode reload evidence occur only after all six mode, history, Pair
Lab, and I/O schemas are implemented; until then an unregistered payload
rejects.

Required outputs are:

- complete project JSON;
- individual candidate JSON;
- melody-only Standard MIDI with tempo and meter metadata;
- multitrack MIDI with melody and General MIDI percussion on a separate
  channel/track, preserving exact tick timing;
- deterministic offline-rendered WAV for melody only or melody plus beat.

Round trips preserve root/sub-seeds, algorithm and descriptor versions,
transport, meters/groupings/partial loops, melody and beat events, tonal
timeline, custom scales, borrowing, locks, performance settings, descriptors,
lineage, history branches, ratings, annotations, and pairing evidence.

WAV options are Melody only or Melody + beat, one or more loop passes, and an
effect tail from 0–4 seconds. Rendering uses the same event plan and voice
presets as playback, calculates a deterministic exact frame count, and applies
headroom/limiting only through a documented fixed renderer. Output duration is
loop duration × passes plus selected tail, is non-silent when sounding events
exist, and does not clip.

Import handling is transactional:

1. Read with fixed limits—50 MiB project JSON; 5 MiB candidate JSON; 5 MiB for
   each Pair Lab melody-component, beat-component, or pairing JSON envelope;
   and 5 MiB MIDI—and never execute content. One MiB is exactly 1,048,576
   bytes, so the respective gates are 52,428,800 and 5,242,880 raw file bytes.
   Exceeding a limit fails before UTF-8 decoding, JSON/MIDI parsing, or
   allocation-heavy validation and states the exact applicable limit.
2. Parse the envelope and report malformed JSON separately from unsupported
   kind/version.
3. Validate identities, versions, invariants, references, bounds, and hashes.
4. Show a summary of what will replace or add, migration actions, warnings, and
   unsupported data.
5. Require confirmation before replacing the active project or adapting data.
6. Commit only a fully validated value; on failure retain the active project
   byte-for-byte.

Candidate imports add to a preview tray and require an explicit Open, Save to
Library, or Seed workflow action. A project import offers Replace current
project or Cancel; merge is not implied. Unsupported future versions say which
version is supported and preserve the source file for the user to handle
elsewhere.

## 20. Determinism, long operations, and persistence capacity

A project root seed forks stable labelled sub-seeds for generator, generation,
algorithm, island, map cell, Pareto run, candidate, operator, melody, rhythm,
tonality, beat, collaborator selection, and UI-only shuffling. The label path
and algorithm version are stored. No creative path may use `Math.random()`,
timestamps, random UUIDs, object iteration order, worker completion order, or
execution timing.

Changing a beat setting cannot change melody results. Changing a voice,
display axis, sort order, chart layout, or candidate order cannot change any
population. Identical validated project state, versions, settings, seeds,
ratings, and user action sequence reproduce identical ordered outputs,
migrations, collaborator schedules, archives, fronts, descriptors, and
provenance.

From schema 2 onward, IndexedDB through the versioned storage adapter is the
only durable authority for complete projects, candidates/components, Library,
all six workflow populations/archives/fronts/halls, branch history, undo state,
ratings, annotations, locks, migration receipts, and active-project metadata.
No capacity threshold or runtime heuristic may redirect schema-2 domain data to
localStorage. `melody-forge:project:v1` remains a read-only migration/recovery
source and is never a schema-2 write target or active authority.

The owned native IndexedDB database is named `melody-forge-v2`; its initial
database version is `1`, independent of project `schemaVersion`. It has exactly
these schema-2 object stores, all with explicit embedded keys:
`projects`, `createStates`, `modeStates`, `historyGraphs`, `historyNodes`,
`snapshots`, `melodyCandidates`, `melodyGenomes`, `transports`,
`v1TimingProfiles`, `tonalTimelines`, `customScales`, `beats`,
`performanceSettings`, `pairings`, `preferenceRecords`, `libraryItems`,
`ratings`, `annotations`, `undoStates`, `migrationReceipts`, and `appMetadata`.
`migrationReceipts` has a
unique `sourceHash` index. Active metadata uses key `active-project`, version
`active-project-metadata-v2`, project ID, and revision. Browser request types
never escape `VersionedProjectStore`. At database version 1, `appMetadata`
contains only that active row plus imported raw `v1-source-evidence-v1` rows;
the automatic localStorage source remains untouched at its V1 key.

Every table record carries its own `id` and `version`; a containing key is
never identity. Strict decoding rejects a table-key/embedded-ID mismatch,
duplicate ID, unknown field, unsupported version, identity mismatch, or
unresolved strong reference before activation. Genetic ancestry and retained
external lineage IDs are explicitly soft references because bounded V1
history may no longer contain their entities.

Identity formulas are exact: migrated candidate and snapshot IDs are copied;
new project IDs are supplied by an injected `crypto.randomUUID` metadata
factory and never enter creative randomness; migrated project and V1-derived
event IDs use section 3.2; new native candidates use section 5.1; melody
genomes use
`stableId('melody-genome', allFieldsExceptId)`; tonal segments and timelines
use `stableId('tonal-segment', allFieldsExceptId)` and
`stableId('tonal-timeline', allFieldsExceptId)`; new snapshots and beats use
`stableId('snapshot', allFieldsExceptId)` and
`stableId('beat', allFieldsExceptId)`; Create state, history graph, and undo
state are project singletons using `stableId('create-state', { version,
projectId })`, `stableId('history-graph', { version, projectId })`, and
`stableId('undo-state', { version, projectId })`; history nodes use
`stableId('history-node', allFieldsExceptId)`; mode states use
`stableId('mode-state', { version, projectId, mode })`; Library records use
`stableId('library-item', { version, kind, componentId })`; and migration
receipts use
`stableId('migration-receipt', { version, migrationVersion, sourceHash,
projectId })`. Preference records use
`stableId('preference', preferenceRecordWithoutId)` over every frozen record
field other than `id`, including `version`, `projectId`, and
`occurrenceOrdinal`. One rating and one annotation row per typed target use
`stableId('rating', { version, projectId, targetKind, targetId })` and
`stableId('annotation', { version, projectId, targetKind, targetId })`; their
editable values do not rename the row. Editable names/notes, timestamps,
receipt status and UI order are excluded from these identities.

The sole permitted V2 localStorage record is
`melody-forge:ui-preferences:v2`. Its exact versioned root is:

~~~ts
interface UiPreferencesRecordV2 {
  version: 'ui-preferences-v2'
  values: UiPreferenceValuesV2
}
~~~

Its UTF-8 JSON value is capped at 16,384 bytes
before parse, has at most 64 registered preference property paths and nesting
depth four, and may contain only finite numbers, booleans, null, or strings of at
most 256 Unicode scalar values. There is exactly one V2 preference key; adapters
may not spill into additional keys. The generic 64-path bound is a defensive
decoder limit for future version dispatch; schema `ui-preferences-v2` registers
exactly the following 15 `values` leaf paths, and root metadata does not count
toward either number. The complete fixed record and
defaults are:

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

`visualDensity` is `comfortable | compact`;
`reducedMotionOverride` is `system | reduce`; Library view is `grid | list`;
Map and Pareto views are `visual | table`; `controlsWidthPx` is an integer
`216…264`; `inspectorWidthPx` is an integer `288…336`; and every disclosure is
Boolean. Missing registered paths receive defaults. Any unknown path or invalid
present value rejects the whole record to defaults. The root permits exactly
`version`, then `values`; `values` permits only the shown keys. An unsupported
version, missing root key, extra root key, or extra `values` key rejects the
whole record. Root depth is zero, `values` is depth one, and a registered
leaf's full dot-path segment count is its nesting depth. Unicode is preserved
without normalization; unpaired UTF-16 surrogates are invalid. The UTF-8
counter exits as soon as it exceeds 16,384 bytes and runs before `JSON.parse`.
Canonical localStorage encoding uses root key order `version`, `values`, the
declared object-key order above, compact JSON, and no leading BOM or trailing
line feed; the export-envelope exactly-one-trailing-LF rule does not apply to
this localStorage string. Invalid or
unavailable preferences do not read or write IndexedDB and do not change domain
state.

Each V1 receipt has exact root fields `id`, version
`v1-migration-receipt-v2`, `migrationVersion`, `sourceKind`, `sourceHash`,
`projectId`, `stagedRevision`, `status`, ordered candidate/snapshot mappings,
`createdAtEpochMs`, and `verifiedAtEpochMs`. Status is exactly
`pending-readback | verified`; both receipt timestamps and all absent source
metadata are `null`, never omitted or filled from the wall clock. `sourceKind`
is exactly `local-storage-project-v1 | project-envelope-v1`;
candidate-envelope conversion has no receipt. `migrationVersion` is exactly
`v1-project-migration-v2.0.0` and must equal the staged project's
`algorithmVersions.foundations.v1Migration`; unsupported/substituted values
reject before staging and after read-back. Candidate mappings record source
candidate ID, melody-genome ID, timing-profile ID, tonal-timeline ID, pairing
ID, and compatibility-performance ID. They contain each unique candidate once
in first-seen order under active population stored order, then history by source
ordinal and snapshot candidate order, then favorites stored order. Repeated IDs
require identical frozen decoded bytes and do not append a row; unequal bytes
reject. Snapshot mappings record the
zero-based source history ordinal, copied source snapshot ID, and derived
history-node ID in source-ordinal order.

Automatic V1 migration uses a two-phase activation protocol. After pure
conversion, aggregate validation, and an in-memory equivalence report, one
read-write transaction stages every entity, project revision `1`, and a
`pending-readback` migration receipt without changing `active-project`. The
normal strict loader then reads the staged graph back and repeats decoding and
equivalence. A second read-write transaction conditionally changes the receipt
to `verified` and swaps active metadata only when the expected prior active
reference and staged project revision still match. A crash between transactions
leaves inactive pending data that the same source hash can revalidate and
activate idempotently. It never exposes a partially staged project.

Normal project writes validate a self-contained graph first, then atomically
check `expectedRevision` and write every referenced change at revision + 1.
When the project is active, that transaction compare-and-swaps the stored
record and `active-project` at the expected project ID/revision and advances
both to revision + 1. Saving an inactive project leaves active metadata
unchanged. Any record/metadata mismatch is stale and rolls the transaction
back. Stale revision, immutable-ID content collision, quota,
unavailable/blocked database, transaction abort, decode failure, read-back
failure, or equivalence failure leaves the last active revision and current
in-memory work unchanged. None falls back to localStorage; recovery offers
project export and Library cleanup and never silently drops old nodes.

First native creation, opening an existing inactive project, and confirmed
schema-2 Replace are explicit storage operations. Install-and-activate receives
the complete graph, expected stored target revision or null, the complete
expected prior active metadata or null, and reason `native-create` or
`confirmed-schema2-replace`. Null requires target absence and graph revision 1;
a numeric expectation requires exact equality and graph revision one greater;
native creation permits only the null/1 case. One transaction checks both CAS
expectations, validates/writes the complete graph, removes obsolete rows owned
only by the replaced target while retaining global Library rows, strict-reads
the written graph, and finally installs its exact project/revision as active.
Opening an existing inactive project instead checks its exact revision,
strict-loads it, CAS-checks prior active metadata, and swaps only active
metadata. Import cannot install before preview and explicit Replace
confirmation. A stale target/prior active value, collision, quota, decode, or
read-back failure rolls the entire operation back. Tests distinguish creation,
switch, same/different-ID replacement, and every rollback boundary.

Long Islands, Map, Pareto, co-evolution, large import, and WAV operations show
determinate completed/total progress when known, otherwise a labelled
indeterminate phase. They remain cancellable. Each result carries an operation
token and starting-state hash; cancelled or stale results are ignored even if a
worker completes later. Multi-island and dual-population rounds commit
atomically; cancellation never commits a partial round. Attempts use
`operator-attempt-budget-v2.0.0`. A worker is required if profiling
at supported devices shows the main thread cannot maintain playback and input
responsiveness.

## 21. Hard invariants and failure policy

Every accepted canonical V2 creative result must have (preserved V1
compatibility entities use section 3 instead):

- safe non-negative integer onsets and positive integer durations on one
  480-PPQ timeline;
- canonical tempo 30–300, meter numerator/group bounds 32, at most 256 derived
  BarSpans, at most 65,536 grid opportunities, and valid grid/swing divisors;
- exact loop duration, including explicit rests or a partial final bar;
- no illegal overlap in the monophonic melody;
- valid MIDI and configured register;
- base-scale membership or explicit legal borrowing provenance;
- exactly one tonal context at every tick and bar-aligned modulation;
- a tonic-containing unique, non-degenerate custom scale of cardinality 4–9;
- all enabled tonic-boundary rules;
- byte-exact preservation of every frozen component;
- legal beat lanes, timing, and melody/beat alignment;
- deterministic bounded termination.

If an operator cannot create a valid distinct child, it uses
`operator-attempt-budget-v2.0.0`, applies a visible deterministic repair only where permitted,
tries another allowed operator, then falls back to a valid elite. A repair is
part of provenance and must not cross a lock. An impossible constraint returns
an error with the exact conflicting constraints and suggested unlock/adaptation
actions. It never loops forever or emits invalid material.

## 22. User-visible state and error behavior

All destinations and modes define these states:

- **Initial/empty:** explains the minimum next action and offers an appropriate
  Create, Library, or seed action.
- **No parent/anchor:** primary evolution action is unavailable and its nearby
  help names the missing selection; no disabled unexplained control.
- **Incompatible parents:** adaptation preview replaces evolution controls
  until resolved or cancelled; source cards remain playable.
- **Loading/restoring:** shell and transport remain stable; playback starts
  only after validated data is ready.
- **Working:** progress, operation name, safe background navigation, and Cancel.
- **Cancelled:** confirms no result was committed and retains the prior state.
- **Impossible constraint:** names conflicts and offers direct links to the
  relevant locks/settings.
- **Invalid import:** identifies file/track/field/version and states that the
  project was not replaced.
- **Audio blocked/failed:** preserves selection, offers Retry from a user
  gesture, and leaves export available.
- **Storage/quota error:** retains in-memory and last committed work and offers
  project export.
- **Empty or silent export:** blocks misleading output and identifies the
  missing melody/beat or zero-duration condition.

Success, warning, and error messages identify the affected object and whether
state changed. Red is reserved for errors, Stop, and destructive actions.

### 22.1 Normative verification method and drift tolerance

All pure generative, transport, tonal, descriptor, mutation, lock, migration,
and serialization invariants require property-based tests, not only selected
examples. Each property suite derives reproducible cases from
`property/<suite-id>/v2`, runs at least 1,000 valid generated cases in CI, and
records the suite ID, numeric root-seed digest, case index, and minimized
counterexample in a replay fixture on failure. Finite spaces are exhaustive
where smaller: all 4,096 pitch-class masks, 12 transpositions, required meter
presets/groupings, every lock/operator pairing, and every schema-version
dispatch path. Example/golden tests remain in addition to these properties.

“Zero scheduling drift within tolerance” has three measurable gates:

1. Pure score/performed tick transforms and loop endpoints compare as exact
   rationals; permitted tick error is exactly zero across 1,024 loops.
2. Fake-audio scheduling converts those rationals to seconds with absolute
   timestamp error at most `1e-9` seconds, and the phase error after 1,024 loops
   may not exceed the first-loop error by more than `1e-9` seconds. Its only
   numeric endpoint clamp is the `<= 1e-7`-tick closed-loop rule in section 7,
   and the clamped result must still satisfy this seconds gate.
3. Instrumented real-browser playback must keep melody, beat, effects, and
   playhead target positions within one canonical score tick of each other over
   128 loop boundaries, including a mid-play tempo change. Main-thread callback
   arrival jitter may be up to 25 ms on the supported CI device, but its phase
   error must not grow with loop count; jitter is reported separately and may
   not be used to relax the one-tick musical-alignment gate.

## 23. Acceptance criteria

V2 product behavior is accepted only when all criteria below have automated
evidence and the applicable browser workflow evidence.

### 23.1 Preservation and domain

1. The complete V1 suite passes; `/legacy` matches its original sorted hashes;
   V1 projects, favorites, histories, seeds, arbitrary phrase lengths, JSON,
   and MIDI remain usable without changed ticks or pitches. Both 480 and
   non-480 migrated items remain compatibility profiles until an explicit new
   canonical derivative is confirmed; factor-one, rational-rounding, and
   canonical-bound-impossible previews preserve their sources.
2. A failed migration or import never clears storage or replaces the active
   project. V1-to-V2 migration is deterministic and idempotent.
3. Melody, beat, tonal context, performance, and pairing have separate types,
   identities, persistence, seeds, lineage, feedback, and exports.
4. All hard invariants and every lock hold under every applicable generator,
   transformation, workflow, migration, and repair.

### 23.2 Transport, playback, beat, and rendering

5. Tick/bar/beat/group conversion passes for 4/4, 3/4, 6/8, 5/4, 5/8,
   7/8, alternate groupings, and partial bars.
6. Tempo change, swing, looping, candidate replacement, pause/resume, stop,
   replay, and disposal keep melody, beat, playhead, MIDI, and WAV synchronized
   with no duplicate graph or ghost schedule.
7. Beat families and variations are deterministic, recognizably related,
   meter/group aware, fill-safe, independently seeded/locked, and shared across
   ordinary comparisons. Pair Lab alone can vary partners per candidate.
8. All six voices audition unchanged melodies; articulation, accents, reverb,
   and delay remain performance-only; buses and effects clean up correctly.
9. Melody-only and melody-plus-beat MIDI include exact tempo/meter/ticks and
   separate percussion; offline WAV has exact non-silent duration and no clip.

### 23.3 Visualization and tonal evolution

10. Piano-roll geometry, rests, grids, playhead, tonal segments, borrowing,
    Parent A/B, mutation, elite, remap, and repair match exact source data and
    have accessible text equivalents.
11. Cross-cardinality mapping is deterministic for pentatonic, heptatonic,
    whole-tone, octatonic, catalogue, and custom scales in all tonics, with
    stable tie-breaking and no changed source parent.
12. The relationship graph explains destinations; low tonal mutation stays
    nearer than high mutation under deterministic test fixtures; tonic and
    scale locks are independent.
13. Borrowing zero produces none; donor-exclusive classification, strong-beat
    protection, resolution windows, tonic boundaries, and provenance are exact.
14. Modulation segments cover every tick once, align to full bars, support all
    named operators, and explain phrases too short to modulate.
15. Custom scales satisfy canonical identity/cardinality/tonic invariants,
    catalogue matching, repair, naming, mutation, crossover, serialization,
    remapping, and use in every named workflow and export.

### 23.4 Algorithms and explicit preference

16. Breed proves one/two-parent behavior, genuine feasible contribution,
    component crossover, zero mutation, byte-identical elites, deduplication,
    novelty, and visible provenance.
17. Drift proves distance formulas/bands, same-anchor siblings, bias,
    promotion-only anchor changes, reversal, and branch preservation.
18. Islands proves distinct policies and RNG streams, independent/global
    evolution, scheduled migration, migrant source display, global diversity,
    and pinned-elite protection.
19. Map proves descriptor calculation, 8×8 binning, lexicographic replacement,
    pinning, challenger queues, coverage/diversity, region generation, and
    lossless deterministic re-binning plus accessible list use.
20. Pareto proves constraints, direction, target/range transforms,
    nondominated ranks, crowding, deterministic reproduction/fronts, 2–4 active
    objectives, selectable display axes, compare tray, and accessible table use
    without scalarization or “best” language.
21. Pair Lab proves separate populations, shared timing, per-layer locks,
    collaborator schedule, hall of fame, partner swapping, four distinct
    feedback meanings, separate lineage/evidence/favorites, and separate export.
22. All descriptors are formula-versioned, normalized where specified,
    deterministic, tested against active meter, and never presented as
    automatic aesthetic quality.

### 23.5 End-to-end state and I/O

23. Blind A/B hides origin until A/B/Neither/Both, uses comparison-identical
    playback, records explicit feedback, and cannot change creative randomness
    through order. Continuous audition supports visible play state, favorite,
    parent/anchor, skip, previous, and stop.
24. Keyboard shortcuts work in candidate grids and charts, are inert while
    editing form fields, and have visible equivalents.
25. Opening an old history node and evolving creates a new branch without
    erasing later work; undo/redo remains separate; every named mode state
    restores exactly after reload.
26. Library migration, rename, note, search, filters, audition, open, workflow
    seeding, adaptation, favorite, removal confirmation, and export work with
    both V1 and V2 items.
27. MIDI preview reports tracks, tempo/meter, timing, polyphony, quantization,
    length, scale guesses, register, and all adaptations; polyphony is rejected
    or explicitly extracted and no notes disappear silently.
28. Project/candidate JSON round trips preserve every named field. Malformed,
    invalid, oversized, incompatible, and future-version imports fail with
    actionable errors and unchanged active state.
29. Long operations show progress, cancel cleanly, ignore stale results, do not
    disrupt playback, and terminate within bounded attempts.

### 23.6 Product completion

30. Create, Evolve, Explore, and Library form one coherent local-first
    application; all six workflows are distinct, implemented, persisted,
    documented, tested, and browser-verified.
31. No named requirement is a placeholder, mock, disconnected demo, hidden or
    disabled “coming soon” control, TODO substitution, or “experimental” label.
32. The complete automated gate, production build, required real-browser
    workflows/viewports, console inspection, accessibility checks, screenshots,
    traceability matrix, and independent adversarial audit all pass before V2
    is marked complete.
