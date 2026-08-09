import type { ProjectState } from '../../app/state'
import { ticksToSeconds } from '../../audio/playbackPlan'
import { stableStringify } from '../../domain/identity'
import { melodyDegreeToMidi } from '../../domain/pitch'
import { findScaleById, getScale } from '../../domain/scales'
import {
  createV1TriangleCompatibilitySchedule,
} from '../../domain/performance/v1Compatibility'
import type {
  Candidate,
  JsonValue,
  Melody,
} from '../../domain/types'
import {
  createV1CompatibilityTimingProfileForCandidate,
  type V1CompatibilityTimingProfile,
} from '../../domain/transport/compatibility'
import {
  auditionPairingIdV2,
  createStateIdV2,
  historyGraphIdV2,
  historyNodeIdV2,
  melodyGenomeIdV2,
  migratedV1EventIdV2,
  migratedV1ProjectIdV2,
  migratedV1RootSeedV2,
  modeStateIdV2,
  tonalSegmentIdV2,
  tonalTimelineIdV2,
  undoStateIdV2,
  v1MigrationReceiptIdV2,
  candidateContributionIdV2,
} from '../../domain/v2/identities'
import {
  createLibraryItemV2,
  mergeLibraryOriginsV2,
} from '../../domain/v2/library'
import { EMPTY_LOCK_SET_V2 } from '../../domain/v2/locks'
import { V1_COMPATIBILITY_PERFORMANCE_V2 } from '../../domain/v2/performance'
import { ALGORITHM_VERSION_REGISTRY_V2 } from '../../domain/v2/registry'
import { EMPTY_MODE_PAYLOAD_V2, EVOLUTION_MODES_V2 } from '../../domain/v2/state'
import type {
  AuditionPairingV2,
  CandidateContributionV2,
  CandidateLineageV2,
  CandidateOperationProvenanceV2,
  CandidateProvenanceV2,
  CreateStateV2,
  FrozenV1CandidateV1,
  HistoryGraphV2,
  HistoryModeV2,
  HistoryNodeV2,
  LibraryItemV2,
  LibraryOriginReferenceV2,
  MelodyGenomeV2,
  MigratedV1MelodyCandidateV2,
  ModeStateV2,
  ProjectV2,
  ReadonlyJsonObject,
  ReadonlyJsonValue,
  SnapshotV2,
  StoredProjectGraphV2,
  TonalSegmentV2,
  TonalTimelineV2,
  V1MigrationCandidateMappingV2,
  V1MigrationReceiptV2,
  V1MigrationSnapshotMappingV2,
} from '../../domain/v2/types'
import {
  compareUnicodeCodePoints,
  deepFreezeV2,
} from '../../domain/v2/validation'
import {
  assertLowercaseSha256,
  computeV1SourceHash,
  sha256BytesToHex,
  type Sha256,
  type V1SourceKind,
} from './sourceHash'
import {
  resolveV1HistoryParent,
  traverseUniqueV1Candidates,
  traverseUniqueV1Snapshots,
} from './v1Traversal'

export type V1CompleteProjectSourceKindV2 = Exclude<
  V1SourceKind,
  'candidate-envelope-v1'
>

export interface V1ProjectConversionInputV2 {
  readonly sourceKind: V1CompleteProjectSourceKindV2
  readonly sourceHash: string
  readonly decodedV1: ProjectState
  readonly sha256: Sha256
}

export interface V1CandidatePreviewInputV2 {
  readonly sourceKind: 'candidate-envelope-v1'
  readonly sourceHash: string
  readonly decodedV1: Candidate
  readonly sha256: Sha256
}

export type V1SourceConversionInputV2 =
  | V1ProjectConversionInputV2
  | V1CandidatePreviewInputV2

export interface ConvertedV1CandidateComponentsV2 {
  readonly candidate: MigratedV1MelodyCandidateV2
  readonly melodyGenome: MelodyGenomeV2
  readonly timingProfile: V1CompatibilityTimingProfile
  readonly tonalTimeline: TonalTimelineV2
  readonly pairing: AuditionPairingV2
}

export interface V1CandidatePreviewClosureV2
  extends ConvertedV1CandidateComponentsV2 {
  readonly sourceKind: 'candidate-envelope-v1'
  readonly sourceHash: string
  readonly rootCandidateId: string
  readonly performanceId: string
  readonly performance: typeof V1_COMPATIBILITY_PERFORMANCE_V2
}

export interface V1ProjectConversionV2 {
  readonly sourceKind: V1CompleteProjectSourceKindV2
  readonly sourceHash: string
  readonly projectId: string
  readonly graph: StoredProjectGraphV2
}

export type V1SourceConversionV2 =
  | V1ProjectConversionV2
  | V1CandidatePreviewClosureV2

/**
 * These are deliberately report metadata, not persisted algorithm literals.
 * The product contract freezes the cache input hash, but does not yet freeze a
 * timing-fingerprint input, phenotype-fingerprint input, translated V1
 * operation kind, or migrated rendered-event velocity. Keeping the choices
 * here visible prevents a later codec from mistaking them for silent facts:
 *
 * - V1 operations retain order/operator/parameters and use V2 `import` kind.
 * - the exact V1 candidate seed is the translated provenance root; V1 had no
 *   labelled SeedTree path, so `seedPath` is empty.
 * - timing hashes the complete compatibility profile; phenotype hashes every
 *   rendered-phenotype field other than its own fingerprint.
 * - rendered velocity is normalized from frozen direct-V1-MIDI velocity as
 *   `88 / 127`. MIDI byte 88 and synth velocity 0.72 remain separate evidence.
 * - missing V1 Breed policy fields use conservative-directed, exact dedupe,
 *   and novelty protection; an absent active snapshot uses the active Create
 *   seed and generation zero.
 */
export const V1_MIGRATION_SPEC_SEAMS_V2 = Object.freeze([
  'Translated V1 operations use kind import while retaining exact source operator order and parameters.',
  'Translated provenance uses the exact V1 candidate seed as rootSeed and an empty seedPath because V1 stored no labelled path.',
  'Timing fingerprint hashes the complete compatibility profile; phenotype fingerprint hashes all phenotype fields except itself.',
  'Rendered-event velocity is normalized direct-V1-MIDI velocity 88/127; MIDI byte 88 and v1-triangle-compat trigger velocity 0.72 remain separate.',
  'V1 Breed policy gaps use conservative-directed crossover with exact deduplication and novelty protection enabled.',
] as const)

export class V1MigrationSourceHashMismatchError extends Error {
  readonly code = 'v1-source-hash-mismatch' as const
  readonly expectedSourceHash: string
  readonly receivedSourceHash: string

  constructor(expectedSourceHash: string, receivedSourceHash: string) {
    super(
      `V1 source hash mismatch: expected ${expectedSourceHash}, received ${receivedSourceHash}`,
    )
    this.name = 'V1MigrationSourceHashMismatchError'
    this.expectedSourceHash = expectedSourceHash
    this.receivedSourceHash = receivedSourceHash
  }
}

export class V1MigrationDerivedCollisionError extends Error {
  readonly code = 'v1-derived-id-collision' as const
  readonly table: string
  readonly entityId: string

  constructor(table: string, entityId: string) {
    super(
      `V1 migration derived table ${table} contains ID ${entityId} with different canonical bytes`,
    )
    this.name = 'V1MigrationDerivedCollisionError'
    this.table = table
    this.entityId = entityId
  }
}

function cloneJsonValue(value: JsonValue): ReadonlyJsonValue {
  if (Array.isArray(value)) {
    return (value as readonly JsonValue[]).map((entry) =>
      cloneJsonValue(entry),
    )
  }
  if (value !== null && typeof value === 'object') {
    return cloneJsonObject(
      value as Readonly<Record<string, JsonValue>>,
    )
  }
  return value
}

function cloneJsonObject(
  value: Readonly<Record<string, JsonValue>>,
): ReadonlyJsonObject {
  return Object.fromEntries(
    Object.keys(value).map((key) => [key, cloneJsonValue(value[key]!)]),
  )
}

/** Rebuilds the decoder value in the exact declared compatibility key order. */
export function freezeV1CandidateV2(
  source: Candidate,
): FrozenV1CandidateV1 {
  return deepFreezeV2({
    id: source.id,
    melody: {
      events: source.melody.events.map((event) => ({
        startTick: event.startTick,
        durationTicks: event.durationTicks,
        degree: event.degree,
      })),
      constraints: {
        scaleId: source.melody.constraints.scaleId,
        tonicPitchClass: source.melody.constraints.tonicPitchClass,
        tonicMidi: source.melody.constraints.tonicMidi,
        register: {
          minMidi: source.melody.constraints.register.minMidi,
          maxMidi: source.melody.constraints.register.maxMidi,
        },
        pitchMapping: source.melody.constraints.pitchMapping,
        ticksPerBeat: source.melody.constraints.ticksPerBeat,
        gridTicks: source.melody.constraints.gridTicks,
        totalTicks: source.melody.constraints.totalTicks,
        tempoBpm: source.melody.constraints.tempoBpm,
        tonicBoundary: {
          start: source.melody.constraints.tonicBoundary.start,
          end: source.melody.constraints.tonicBoundary.end,
        },
      },
    },
    provenance: {
      strategy: source.provenance.strategy,
      generatorVersion: source.provenance.generatorVersion,
      seed: source.provenance.seed,
      settings: cloneJsonObject(source.provenance.settings),
      generation: source.provenance.generation,
      parentIds: [...source.provenance.parentIds],
      operations: source.provenance.operations.map((operation) => ({
        operator: operation.operator,
        parameters: cloneJsonObject(operation.parameters),
      })),
    },
  } satisfies FrozenV1CandidateV1)
}

async function sha256CanonicalValue(
  sha256: Sha256,
  value: unknown,
): Promise<string> {
  return sha256BytesToHex(
    await sha256.digest(new TextEncoder().encode(stableStringify(value))),
  )
}

async function assertSourceHashMatches(
  sha256: Sha256,
  sourceKind: V1SourceKind,
  decodedV1: unknown,
  sourceHash: string,
): Promise<void> {
  assertLowercaseSha256(sourceHash)
  const expected = await computeV1SourceHash(sha256, sourceKind, decodedV1)
  if (sourceHash !== expected) {
    throw new V1MigrationSourceHashMismatchError(expected, sourceHash)
  }
}

function canonicalTableRows<T extends { readonly id: string }>(
  table: string,
  values: readonly T[],
): readonly T[] {
  const byId = new Map<string, { readonly value: T; readonly bytes: string }>()
  values.forEach((value) => {
    const bytes = stableStringify(value)
    const existing = byId.get(value.id)
    if (existing === undefined) {
      byId.set(value.id, { value, bytes })
      return
    }
    if (existing.bytes !== bytes) {
      throw new V1MigrationDerivedCollisionError(table, value.id)
    }
  })
  return [...byId.values()].map(({ value }) => value).sort((left, right) =>
    compareUnicodeCodePoints(left.id, right.id),
  )
}

function candidateTimingRef(
  profile: V1CompatibilityTimingProfile,
): MelodyGenomeV2['timing'] {
  return { kind: 'v1-compatibility', timingProfileId: profile.id }
}

function migratedContributions(
  source: Candidate,
  eventIds: readonly string[],
): {
  readonly all: readonly CandidateContributionV2[]
  readonly byEvent: ReadonlyMap<string, readonly string[]>
} {
  const all: CandidateContributionV2[] = []
  const byEvent = new Map<string, readonly string[]>()

  source.melody.events.forEach((event, ordinal) => {
    const eventId = eventIds[ordinal]!
    const components: CandidateContributionV2['component'][] = [
      ...(event.degree === null ? [] : (['pitch'] as const)),
      'rhythm',
      'tonal',
    ]
    const ids: string[] = []
    components.forEach((component) => {
      const withoutId = {
        version: 'candidate-contribution-v2',
        eventId,
        component,
        source: 'migrated-v1',
        sourceCandidateId: source.id,
        sourceEventId: null,
      } as const
      const contribution: CandidateContributionV2 = {
        id: candidateContributionIdV2(withoutId),
        ...withoutId,
      }
      all.push(contribution)
      ids.push(contribution.id)
    })
    byEvent.set(eventId, ids)
  })

  return { all, byEvent }
}

function translatedOperations(
  source: Candidate,
): readonly CandidateOperationProvenanceV2[] {
  return source.provenance.operations.map((operation) => ({
    version: 'candidate-operation-v2',
    kind: 'import',
    operatorId: operation.operator,
    parameters: cloneJsonObject(operation.parameters),
  }))
}

function translatedLineage(source: Candidate): CandidateLineageV2 {
  return {
    version: 'candidate-lineage-v2',
    geneticParentCandidateIds: [...source.provenance.parentIds],
    componentParentCandidateIds: {
      pitch: [],
      rhythm: [],
      tonal: [],
    },
    sourceHistoryNodeIds: [],
  }
}

async function convertCandidateComponents(
  source: Candidate,
  sha256: Sha256,
): Promise<ConvertedV1CandidateComponentsV2> {
  const timingProfile = createV1CompatibilityTimingProfileForCandidate(source)
  const timing = candidateTimingRef(timingProfile)
  const eventIds = source.melody.events.map((_, ordinal) =>
    migratedV1EventIdV2(source.id, ordinal),
  )
  const constraints = source.melody.constraints
  const segmentWithoutId = {
    startTick: 0,
    endTick: constraints.totalTicks,
    tonicPitchClass: constraints.tonicPitchClass,
    tonicMidi: constraints.tonicMidi,
    scale: { kind: 'catalogue', scaleId: constraints.scaleId },
    borrowingPolicyId: null,
  } as const
  const tonalSegment: TonalSegmentV2 = {
    id: tonalSegmentIdV2(segmentWithoutId),
    ...segmentWithoutId,
  }
  const tonalTimelineWithoutId = {
    version: 'tonal-timeline-v2',
    segments: [tonalSegment],
  } as const
  const tonalTimeline: TonalTimelineV2 = {
    id: tonalTimelineIdV2(tonalTimelineWithoutId),
    ...tonalTimelineWithoutId,
  }
  const genomeWithoutId: Omit<MelodyGenomeV2, 'id'> = {
    version: 'melody-genome-v2',
    pitchShape: {
      version: 'pitch-shape-v2',
      mapping:
        constraints.pitchMapping === 'tonic-relative'
          ? 'tonal-relative'
          : 'legacy-fixed-octave',
      genes: source.melody.events.flatMap((event, ordinal) =>
        event.degree === null
          ? []
          : [{ eventId: eventIds[ordinal]!, extendedDegree: event.degree }],
      ),
      register: {
        minMidi: constraints.register.minMidi,
        maxMidi: constraints.register.maxMidi,
      },
    },
    rhythm: {
      version: 'rhythm-v2',
      events: source.melody.events.map((event, ordinal) => ({
        eventId: eventIds[ordinal]!,
        onsetTick: event.startTick,
        durationTicks: event.durationTicks,
        isRest: event.degree === null,
        accent: 0,
        tieToNext: false,
      })),
      sourceGridTicks: constraints.gridTicks,
    },
    tonalTimelineId: tonalTimeline.id,
    timing,
    locks: {
      version: EMPTY_LOCK_SET_V2.version,
      componentLocks: [],
      absolutePitchLock: null,
      eventLocks: [],
      regionLocks: [],
    },
  }
  const melodyGenome: MelodyGenomeV2 = {
    version: genomeWithoutId.version,
    id: melodyGenomeIdV2(genomeWithoutId),
    pitchShape: genomeWithoutId.pitchShape,
    rhythm: genomeWithoutId.rhythm,
    tonalTimelineId: genomeWithoutId.tonalTimelineId,
    timing: genomeWithoutId.timing,
    locks: genomeWithoutId.locks,
  }
  const scale = getScale(constraints.scaleId)
  const { all: contributions, byEvent: contributionIdsByEvent } =
    migratedContributions(source, eventIds)
  const renderedEvents = source.melody.events.map((event, ordinal) => ({
    eventId: eventIds[ordinal]!,
    onsetTick: event.startTick,
    durationTicks: event.durationTicks,
    midi:
      event.degree === null
        ? null
        : melodyDegreeToMidi(event.degree, constraints, scale),
    velocity: 88 / 127,
    tonalSegmentId: tonalSegment.id,
    borrowing: null,
    contributionIds: contributionIdsByEvent.get(eventIds[ordinal]!) ?? [],
  }))
  const renderVersion = ALGORITHM_VERSION_REGISTRY_V2.foundations.melodyRender
  const inputFingerprint = await sha256CanonicalValue(sha256, {
    renderVersion,
    melodyGenome,
    tonalTimeline,
    timing: timingProfile,
  })
  const timingFingerprint = await sha256CanonicalValue(sha256, timingProfile)
  const phenotypeWithoutFingerprint = {
    version: 'rendered-melody-phenotype-v2',
    renderVersion,
    inputFingerprint,
    timingFingerprint,
    events: renderedEvents,
  } as const
  const phenotypeFingerprint = await sha256CanonicalValue(
    sha256,
    phenotypeWithoutFingerprint,
  )
  const provenance: CandidateProvenanceV2 = {
    version: 'candidate-provenance-v2',
    rootSeed: source.provenance.seed,
    seedPath: [],
    rngVersion: ALGORITHM_VERSION_REGISTRY_V2.foundations.rng,
    algorithmVersion: source.provenance.generatorVersion,
    renderVersion,
    descriptorSetVersion:
      ALGORITHM_VERSION_REGISTRY_V2.formulas.descriptorCore,
    operations: translatedOperations(source),
    contributions,
    repairs: [],
    lockVerificationFingerprints: [],
  }
  const candidate: MigratedV1MelodyCandidateV2 = {
    id: source.id,
    version: 'melody-candidate-v2',
    candidateKind: 'migrated-v1',
    melodyGenomeId: melodyGenome.id,
    renderedPhenotype: {
      ...phenotypeWithoutFingerprint,
      phenotypeFingerprint,
    },
    descriptorValues: [],
    provenance,
    lineage: translatedLineage(source),
    compatibilitySource: {
      version: 'frozen-v1-candidate-v1',
      candidate: freezeV1CandidateV2(source),
    },
  }
  const pairingWithoutId = {
    version: 'audition-pairing-v2',
    melodyCandidateId: source.id,
    beatId: null,
    timing,
    performanceId: V1_COMPATIBILITY_PERFORMANCE_V2.id,
  } as const
  const pairing: AuditionPairingV2 = {
    id: auditionPairingIdV2(pairingWithoutId),
    ...pairingWithoutId,
  }

  return deepFreezeV2({
    candidate,
    melodyGenome,
    timingProfile,
    tonalTimeline,
    pairing,
  })
}

function snapshotMode(source: ProjectState['history'][number]): HistoryModeV2 {
  if (
    source.generatorVersion ===
      ALGORITHM_VERSION_REGISTRY_V2.generators.v1Evolution ||
    source.evolutionSettings !== null ||
    source.candidates.some(({ provenance }) => provenance.strategy === 'evolution')
  ) {
    return 'breed'
  }
  return 'create'
}

function createHistory(
  source: ProjectState,
  projectId: string,
): {
  readonly graph: HistoryGraphV2
  readonly nodes: readonly HistoryNodeV2[]
  readonly snapshots: readonly SnapshotV2[]
  readonly snapshotMappings: readonly V1MigrationSnapshotMappingV2[]
} {
  const graphId = historyGraphIdV2(projectId)
  const snapshots = traverseUniqueV1Snapshots(source).map(
    ({ snapshot }): SnapshotV2 => ({
      id: snapshot.id,
      version: 'snapshot-v2',
      projectId,
      sourceKind: 'migrated-v1',
      mode: snapshotMode(snapshot),
      generationOrdinal: snapshot.generation,
      seed: snapshot.seed,
      algorithmVersions: ALGORITHM_VERSION_REGISTRY_V2,
      candidateIds: snapshot.candidates.map(({ id }) => id),
      selectedCandidateIds: [...snapshot.selectedParentIds],
      ratingIds: [],
      annotationIds: [],
      payload: {
        version: 'migrated-v1-snapshot-payload-v2',
        sourceSeed: snapshot.seed,
        sourceGeneratorVersion: snapshot.generatorVersion,
        sourceEvolutionSettings:
          snapshot.evolutionSettings === null
            ? null
            : { ...snapshot.evolutionSettings },
      },
    }),
  )
  const nodes: HistoryNodeV2[] = []
  const snapshotMappings: V1MigrationSnapshotMappingV2[] = []

  source.history.forEach((snapshot, sourceHistoryOrdinal) => {
    const parent = resolveV1HistoryParent(source.history, sourceHistoryOrdinal)
    const nodeWithoutId: Omit<HistoryNodeV2, 'id'> = {
      version: 'history-node-v2',
      projectId,
      historyGraphId: graphId,
      occurrenceOrdinal: sourceHistoryOrdinal,
      parentNodeId:
        parent.parentHistoryOrdinal === null
          ? null
          : nodes[parent.parentHistoryOrdinal]!.id,
      snapshotId: snapshot.id,
      mode: snapshotMode(snapshot),
      action: {
        version: 'history-action-summary-v2',
        kind: 'migrate-v1',
      },
      v1LinearSource: {
        version: 'v1-linear-history-node-source-v2',
        sourceHistoryOrdinal,
        sourceSnapshotId: snapshot.id,
        sourcePreviousGenerationId: snapshot.previousGenerationId,
        parentResolution: parent.resolution,
      },
    }
    const node: HistoryNodeV2 = {
      id: historyNodeIdV2(nodeWithoutId),
      ...nodeWithoutId,
    }
    nodes.push(node)
    snapshotMappings.push({
      sourceHistoryOrdinal,
      sourceSnapshotId: snapshot.id,
      historyNodeId: node.id,
    })
  })

  const graph: HistoryGraphV2 = {
    id: graphId,
    version: 'history-graph-v2',
    projectId,
    nextNodeOccurrence: nodes.length,
    nodeIds: nodes.map(({ id }) => id),
    rootNodeIds: nodes
      .filter(({ parentNodeId }) => parentNodeId === null)
      .map(({ id }) => id),
    activeNodeId:
      source.historyIndex < 0 ? null : nodes[source.historyIndex]!.id,
    v1LinearSource: {
      version: 'v1-linear-history-graph-source-v2',
      sourceHistoryLength: source.history.length,
      sourceHistoryIndex: source.historyIndex,
    },
  }

  return { graph, nodes, snapshots, snapshotMappings }
}

function createState(source: ProjectState, projectId: string): CreateStateV2 {
  return {
    id: createStateIdV2(projectId),
    version: 'create-state-v2',
    projectId,
    activeGenerator: source.mode,
    legacySettings: { ...source.legacySettings },
    modernSettings: { ...source.modernSettings },
  }
}

function createModes(
  source: ProjectState,
  projectId: string,
): readonly ModeStateV2[] {
  const activeSnapshot =
    source.historyIndex < 0 ? null : source.history[source.historyIndex]!
  const fallbackSeed =
    source.mode === 'legacy'
      ? source.legacySettings.seed
      : source.modernSettings.seed

  return EVOLUTION_MODES_V2.map((mode): ModeStateV2 => {
    if (mode !== 'breed') {
      return {
        id: modeStateIdV2(projectId, mode),
        version: 'mode-state-v2',
        projectId,
        mode,
        payload: { ...EMPTY_MODE_PAYLOAD_V2 },
      }
    }
    return {
      id: modeStateIdV2(projectId, mode),
      version: 'mode-state-v2',
      projectId,
      mode,
      payload: {
        version: 'breed-mode-state-v2.0.0',
        initialized: true,
        populationCandidateIds:
          activeSnapshot?.candidates.map(({ id }) => id) ?? [],
        parentCandidateIds: [...(activeSnapshot?.selectedParentIds ?? [])],
        populationSize: source.evolutionSettings.populationSize,
        mutationStrength: source.evolutionSettings.mutationStrength,
        retainElites: source.evolutionSettings.retainElites,
        crossoverPolicy: 'conservative-directed',
        exactDeduplication: true,
        noveltyProtection: true,
        seed: activeSnapshot?.seed ?? fallbackSeed,
        generationOrdinal: activeSnapshot?.generation ?? 0,
      },
    }
  })
}

function createLibrary(
  source: ProjectState,
  projectId: string,
  sourceHash: string,
): {
  readonly items: readonly LibraryItemV2[]
  readonly orderedItemIds: readonly string[]
} {
  const itemsById = new Map<string, LibraryItemV2>()
  const orderedItemIds: string[] = []

  source.favorites.forEach((candidate) => {
    const origin: LibraryOriginReferenceV2 = {
      kind: 'v1-favorite',
      projectId,
      historyNodeId: null,
      sourceHash,
      sourceId: candidate.id,
    }
    const incoming = createLibraryItemV2({
      kind: 'melody-candidate',
      componentId: candidate.id,
      origin,
      initialization: 'migrated-v1-favorite',
    })
    const existing = itemsById.get(incoming.id)
    if (existing === undefined) {
      itemsById.set(incoming.id, incoming)
      orderedItemIds.push(incoming.id)
      return
    }
    itemsById.set(incoming.id, mergeLibraryOriginsV2(existing, incoming))
  })

  return { items: [...itemsById.values()], orderedItemIds }
}

function createUndoState(projectId: string) {
  return {
    id: undoStateIdV2(projectId),
    version: 'undo-state-v2' as const,
    projectId,
    nextOccurrence: 0,
    undoEntries: [],
    redoEntries: [],
  }
}

async function convertProject(
  input: V1ProjectConversionInputV2,
): Promise<V1ProjectConversionV2> {
  await assertSourceHashMatches(
    input.sha256,
    input.sourceKind,
    input.decodedV1,
    input.sourceHash,
  )
  const projectId = migratedV1ProjectIdV2(input.sourceHash)
  const traversedCandidates = traverseUniqueV1Candidates(input.decodedV1)
  const convertedCandidates = await Promise.all(
    traversedCandidates.map(({ candidate }) =>
      convertCandidateComponents(candidate, input.sha256),
    ),
  )
  const history = createHistory(input.decodedV1, projectId)
  const createStateValue = createState(input.decodedV1, projectId)
  const modeStates = createModes(input.decodedV1, projectId)
  const library = createLibrary(input.decodedV1, projectId, input.sourceHash)
  const undoState = createUndoState(projectId)
  const candidateMappings: readonly V1MigrationCandidateMappingV2[] =
    convertedCandidates.map((converted) => ({
      sourceCandidateId: converted.candidate.id,
      melodyGenomeId: converted.melodyGenome.id,
      timingProfileId: converted.timingProfile.id,
      tonalTimelineId: converted.tonalTimeline.id,
      pairingId: converted.pairing.id,
      compatibilityPerformanceId: V1_COMPATIBILITY_PERFORMANCE_V2.id,
    }))
  const receiptIdentity = {
    version: 'v1-migration-receipt-v2',
    migrationVersion:
      ALGORITHM_VERSION_REGISTRY_V2.foundations.v1Migration,
    sourceHash: input.sourceHash,
    projectId,
  } as const
  const receipt: V1MigrationReceiptV2 = {
    id: v1MigrationReceiptIdV2(receiptIdentity),
    version: receiptIdentity.version,
    migrationVersion: receiptIdentity.migrationVersion,
    sourceKind: input.sourceKind,
    sourceHash: receiptIdentity.sourceHash,
    projectId: receiptIdentity.projectId,
    stagedRevision: 1,
    status: 'pending-readback',
    candidateMappings,
    snapshotMappings: history.snapshotMappings,
    createdAtEpochMs: null,
    verifiedAtEpochMs: null,
  }
  const modeStateIds = Object.fromEntries(
    modeStates.map(({ mode, id }) => [
      mode === 'pair-lab' ? 'pairLab' : mode,
      id,
    ]),
  ) as ProjectV2['modeStateIds']
  const project: ProjectV2 = {
    id: projectId,
    version: 'project-v2',
    schemaVersion: 2,
    name: 'Untitled Melody',
    rootSeed: migratedV1RootSeedV2(input.sourceHash),
    algorithmVersions: ALGORITHM_VERSION_REGISTRY_V2,
    createdAtEpochMs: null,
    updatedAtEpochMs: null,
    destination: 'create',
    activeEvolutionMode: 'breed',
    activeExploreMode: 'map',
    comparisonTransportId: null,
    auditionTiming: null,
    activePerformanceId: V1_COMPATIBILITY_PERFORMANCE_V2.id,
    sharedBeatId: null,
    activePairingId: null,
    loopEnabled: input.decodedV1.loop,
    accompanimentMuted: true,
    focusedMelodyCandidateId: null,
    selectedMelodyCandidateIds: [],
    createStateId: createStateValue.id,
    modeStateIds,
    historyGraphId: history.graph.id,
    undoStateId: undoState.id,
    nextPreferenceOccurrence: 0,
    preferenceRecordIds: [],
    activePreferenceRecordIds: [],
    ratingIds: [],
    annotationIds: [],
    libraryItemIds: library.orderedItemIds,
    migrationReceiptIds: [receipt.id],
  }
  const graph: StoredProjectGraphV2 = {
    record: {
      id: projectId,
      version: 'stored-project-record-v2',
      revision: 1,
      project,
    },
    tables: {
      createStates: canonicalTableRows('createStates', [createStateValue]),
      modeStates: canonicalTableRows('modeStates', modeStates),
      historyGraphs: canonicalTableRows('historyGraphs', [history.graph]),
      historyNodes: canonicalTableRows('historyNodes', history.nodes),
      snapshots: canonicalTableRows('snapshots', history.snapshots),
      melodyCandidates: canonicalTableRows(
        'melodyCandidates',
        convertedCandidates.map(({ candidate }) => candidate),
      ),
      melodyGenomes: canonicalTableRows(
        'melodyGenomes',
        convertedCandidates.map(({ melodyGenome }) => melodyGenome),
      ),
      transports: [],
      v1TimingProfiles: canonicalTableRows(
        'v1TimingProfiles',
        convertedCandidates.map(({ timingProfile }) => timingProfile),
      ),
      tonalTimelines: canonicalTableRows(
        'tonalTimelines',
        convertedCandidates.map(({ tonalTimeline }) => tonalTimeline),
      ),
      customScales: [],
      beats: [],
      performanceSettings: canonicalTableRows('performanceSettings', [
        V1_COMPATIBILITY_PERFORMANCE_V2,
      ]),
      pairings: canonicalTableRows(
        'pairings',
        convertedCandidates.map(({ pairing }) => pairing),
      ),
      preferenceRecords: [],
      libraryItems: canonicalTableRows('libraryItems', library.items),
      ratings: [],
      annotations: [],
      undoStates: canonicalTableRows('undoStates', [undoState]),
      migrationReceipts: canonicalTableRows('migrationReceipts', [receipt]),
    },
  }

  return deepFreezeV2({
    sourceKind: input.sourceKind,
    sourceHash: input.sourceHash,
    projectId,
    graph,
  })
}

async function convertCandidatePreview(
  input: V1CandidatePreviewInputV2,
): Promise<V1CandidatePreviewClosureV2> {
  await assertSourceHashMatches(
    input.sha256,
    input.sourceKind,
    input.decodedV1,
    input.sourceHash,
  )
  const converted = await convertCandidateComponents(
    input.decodedV1,
    input.sha256,
  )
  return deepFreezeV2({
    sourceKind: input.sourceKind,
    sourceHash: input.sourceHash,
    rootCandidateId: input.decodedV1.id,
    performanceId: V1_COMPATIBILITY_PERFORMANCE_V2.id,
    performance: V1_COMPATIBILITY_PERFORMANCE_V2,
    ...converted,
  })
}

/**
 * One scope-discriminated deterministic conversion entry point. Hashing is an
 * injected pure dependency; the mapper reads no clock, random source, UUID,
 * browser storage, or global crypto object.
 */
export function convertV1SourceV2(
  input: V1ProjectConversionInputV2,
): Promise<V1ProjectConversionV2>
export function convertV1SourceV2(
  input: V1CandidatePreviewInputV2,
): Promise<V1CandidatePreviewClosureV2>
export async function convertV1SourceV2(
  input: V1SourceConversionInputV2,
): Promise<V1SourceConversionV2> {
  return input.sourceKind === 'candidate-envelope-v1'
    ? convertCandidatePreview(input)
    : convertProject(input)
}

export async function convertV1ProjectV2(
  input: V1ProjectConversionInputV2,
): Promise<V1ProjectConversionV2> {
  return convertProject(input)
}

export async function convertV1CandidatePreviewV2(
  input: V1CandidatePreviewInputV2,
): Promise<V1CandidatePreviewClosureV2> {
  return convertCandidatePreview(input)
}

/** Reconstructs MIDI-export input from normalized V2 rows, not frozen source. */
export function migratedCandidateAsMelodyV1(
  converted: ConvertedV1CandidateComponentsV2,
): Melody {
  const { melodyGenome, timingProfile, tonalTimeline, candidate } = converted
  const segment = tonalTimeline.segments[0]
  if (segment === undefined || segment.scale.kind !== 'catalogue') {
    throw new TypeError('Migrated V1 candidates require one catalogue tonal segment')
  }
  const scale = findScaleById(segment.scale.scaleId)
  if (scale === undefined) {
    throw new TypeError('Migrated V1 candidate references an unknown catalogue scale')
  }
  const pitchByEvent = new Map(
    melodyGenome.pitchShape.genes.map((gene) => [gene.eventId, gene.extendedDegree]),
  )
  return {
    events: melodyGenome.rhythm.events.map((event) => {
      const degree = pitchByEvent.get(event.eventId)
      if (!event.isRest && degree === undefined) {
        throw new TypeError(
          `Non-rest migrated event ${event.eventId} has no pitch gene`,
        )
      }
      return {
        startTick: event.onsetTick,
        durationTicks: event.durationTicks,
        degree: event.isRest ? null : degree!,
      }
    }),
    constraints: {
      scaleId: scale.id,
      tonicPitchClass: segment.tonicPitchClass,
      tonicMidi: segment.tonicMidi,
      register: { ...melodyGenome.pitchShape.register },
      pitchMapping:
        melodyGenome.pitchShape.mapping === 'legacy-fixed-octave'
          ? 'legacy-fixed-octave'
          : 'tonic-relative',
      ticksPerBeat: timingProfile.sourceTicksPerBeat,
      gridTicks: timingProfile.sourceGridTicks,
      totalTicks: timingProfile.loopEndTick,
      tempoBpm: timingProfile.tempoBpm,
      tonicBoundary: {
        start:
          candidate.compatibilitySource.candidate.melody.constraints.tonicBoundary
            .start,
        end: candidate.compatibilitySource.candidate.melody.constraints.tonicBoundary
          .end,
      },
    },
  }
}

/** Compatibility synth schedule derived only from normalized phenotype/timing. */
export function migratedCandidateCompatibilityScheduleV2(
  converted: ConvertedV1CandidateComponentsV2,
) {
  const { tempoBpm, sourceTicksPerBeat } = converted.timingProfile
  return createV1TriangleCompatibilitySchedule(
    converted.candidate.renderedPhenotype.events.map((event) => ({
      startSeconds: ticksToSeconds(
        event.onsetTick,
        tempoBpm,
        sourceTicksPerBeat,
      ),
      durationSeconds: ticksToSeconds(
        event.durationTicks,
        tempoBpm,
        sourceTicksPerBeat,
      ),
      midi: event.midi,
    })),
  )
}
