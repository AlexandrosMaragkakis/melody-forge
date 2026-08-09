import type { ProjectState } from '../../app/state'
import { createPlaybackPlan } from '../../audio/playbackPlan'
import { stableStringify } from '../../domain/identity'
import {
  V1_TRIANGLE_COMPATIBILITY_PROFILE,
} from '../../domain/performance/v1Compatibility'
import type { Candidate } from '../../domain/types'
import { encodeMelodyMidi } from '../../export/midi'
import type {
  PerformanceSettingsRecordV2,
  ReadonlyJsonValue,
  StoredProjectGraphV2,
} from '../../domain/v2/types'
import { deepFreezeV2 } from '../../domain/v2/validation'
import {
  migratedV1EventIdV2,
  migratedV1ProjectIdV2,
} from '../../domain/v2/identities'
import { V1_COMPATIBILITY_PERFORMANCE_V2 } from '../../domain/v2/performance'
import { ALGORITHM_VERSION_REGISTRY_V2 } from '../../domain/v2/registry'
import {
  sha256BytesToHex,
  type Sha256,
} from './sourceHash'
import {
  V1_MIGRATION_SPEC_SEAMS_V2,
  freezeV1CandidateV2,
  migratedCandidateAsMelodyV1,
  migratedCandidateCompatibilityScheduleV2,
  type ConvertedV1CandidateComponentsV2,
  type V1CandidatePreviewClosureV2,
  type V1CompleteProjectSourceKindV2,
  type V1ProjectConversionV2,
} from './v1Migration'
import {
  resolveV1HistoryParent,
  traverseUniqueV1Candidates,
} from './v1Traversal'

export type V1EquivalencePhaseV2 =
  | 'before-stage'
  | 'after-readback'
  | 'candidate-preview'

export interface V1EquivalenceFieldValueV2 {
  readonly present: boolean
  readonly value: ReadonlyJsonValue | null
}

export interface V1EquivalenceFieldV2 {
  readonly path: string
  readonly source: V1EquivalenceFieldValueV2
  readonly migrated: V1EquivalenceFieldValueV2
  readonly equivalent: boolean
}

export interface V1CandidateEquivalenceReportV2 {
  readonly candidateId: string
  readonly equivalent: boolean
  readonly fields: readonly V1EquivalenceFieldV2[]
}

export interface V1V2EquivalenceReportV2 {
  readonly version: 'v1-v2-equivalence-report-v2'
  readonly phase: V1EquivalencePhaseV2
  readonly sourceKind:
    | V1CompleteProjectSourceKindV2
    | 'candidate-envelope-v1'
  readonly sourceHash: string
  readonly projectId: string | null
  readonly equivalent: boolean
  readonly specSeams: readonly string[]
  readonly fields: readonly V1EquivalenceFieldV2[]
  readonly candidates: readonly V1CandidateEquivalenceReportV2[]
}

export class V1V2EquivalenceError extends Error {
  readonly code = 'v1-v2-equivalence-failed' as const
  readonly report: V1V2EquivalenceReportV2
  readonly mismatchPaths: readonly string[]

  constructor(report: V1V2EquivalenceReportV2) {
    const mismatchPaths = [
      ...report.fields,
      ...report.candidates.flatMap(({ fields }) => fields),
    ]
      .filter(({ equivalent }) => !equivalent)
      .map(({ path }) => path)
    super(
      `V1/V2 equivalence failed at ${mismatchPaths.length === 0 ? 'an unreported field' : mismatchPaths.join(', ')}`,
    )
    this.name = 'V1V2EquivalenceError'
    this.report = report
    this.mismatchPaths = mismatchPaths
  }
}

const MISSING_FIELD_VALUE: V1EquivalenceFieldValueV2 = Object.freeze({
  present: false,
  value: null,
})

/**
 * Independent compatibility oracle. Duplication is intentional: if the live
 * playback constants drift, migration equivalence must fail rather than bless
 * both source and migrated schedules through the same changed object.
 */
const FROZEN_V1_TRIANGLE_EQUIVALENCE_ORACLE = deepFreezeV2({
  version: 'v1-compat-performance-v1',
  voiceFactoryId: 'v1-triangle-compat',
  synth: {
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.008,
      decay: 0.12,
      sustain: 0.42,
      release: 0.16,
    },
    portamento: 0.008,
    volume: -8,
  },
  triggerVelocity: 0.72,
  gate: {
    minimumSeconds: 0.01,
    sourceDurationMultiplier: 0.9,
  },
  routing: 'direct-destination',
} as const)

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Reflect.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function asJsonValue(value: unknown): ReadonlyJsonValue {
  return value as ReadonlyJsonValue
}

function presentValue(value: unknown): V1EquivalenceFieldValueV2 {
  return { present: true, value: asJsonValue(value) }
}

function appendLeaf(
  fields: V1EquivalenceFieldV2[],
  path: string,
  source: unknown,
  migrated: unknown,
  sourcePresent = source !== undefined,
  migratedPresent = migrated !== undefined,
): void {
  const sourceValue = sourcePresent ? presentValue(source) : MISSING_FIELD_VALUE
  const migratedValue = migratedPresent
    ? presentValue(migrated)
    : MISSING_FIELD_VALUE
  fields.push({
    path,
    source: sourceValue,
    migrated: migratedValue,
    equivalent:
      sourceValue.present === migratedValue.present &&
      (!sourceValue.present ||
        stableStringify(sourceValue.value) === stableStringify(migratedValue.value)),
  })
}

/** Recursively records leaf/length/key-presence evidence, never one opaque hash. */
function appendTree(
  fields: V1EquivalenceFieldV2[],
  path: string,
  source: unknown,
  migrated: unknown,
  sourcePresent = source !== undefined,
  migratedPresent = migrated !== undefined,
): void {
  if (!sourcePresent || !migratedPresent) {
    appendLeaf(
      fields,
      path,
      source,
      migrated,
      sourcePresent,
      migratedPresent,
    )
    return
  }

  if (Array.isArray(source) && Array.isArray(migrated)) {
    appendLeaf(fields, `${path}.length`, source.length, migrated.length)
    const length = Math.max(source.length, migrated.length)
    for (let index = 0; index < length; index += 1) {
      appendTree(
        fields,
        `${path}[${String(index)}]`,
        source[index],
        migrated[index],
        Object.prototype.hasOwnProperty.call(source, index),
        Object.prototype.hasOwnProperty.call(migrated, index),
      )
    }
    return
  }

  if (isPlainObject(source) && isPlainObject(migrated)) {
    const keys = [...new Set([...Object.keys(source), ...Object.keys(migrated)])]
      .sort()
    appendLeaf(fields, `${path}.$keys`, Object.keys(source).sort(), Object.keys(migrated).sort())
    keys.forEach((key) => {
      const sourceHas = Object.prototype.hasOwnProperty.call(source, key)
      const migratedHas = Object.prototype.hasOwnProperty.call(migrated, key)
      appendTree(
        fields,
        `${path}.${key}`,
        source[key],
        migrated[key],
        sourceHas,
        migratedHas,
      )
    })
    return
  }

  appendLeaf(fields, path, source, migrated)
}

async function sha256CanonicalValue(
  sha256: Sha256,
  value: unknown,
): Promise<string> {
  return sha256BytesToHex(
    await sha256.digest(new TextEncoder().encode(stableStringify(value))),
  )
}

function captureMidiBytes(melody: Candidate['melody']): ReadonlyJsonValue {
  try {
    return {
      ok: true,
      bytes: [...encodeMelodyMidi(melody)],
    }
  } catch (error) {
    return {
      ok: false,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

function expectedCompatibilitySchedule(source: Candidate) {
  const plan = createPlaybackPlan(source.melody)
  return plan.events.flatMap((event, sourceEventIndex) =>
    event.midi === null
      ? []
      : [
          {
            sourceEventIndex,
            startSeconds: event.startSeconds,
            durationSeconds: event.durationSeconds,
            midi: event.midi,
            gateSeconds: Math.max(
              FROZEN_V1_TRIANGLE_EQUIVALENCE_ORACLE.gate.minimumSeconds,
              event.durationSeconds *
                FROZEN_V1_TRIANGLE_EQUIVALENCE_ORACLE.gate
                  .sourceDurationMultiplier,
            ),
            velocity: FROZEN_V1_TRIANGLE_EQUIVALENCE_ORACLE.triggerVelocity,
          },
        ],
  )
}

function appendPerformanceEvidence(
  fields: V1EquivalenceFieldV2[],
  path: string,
  performance: PerformanceSettingsRecordV2 | undefined,
): void {
  appendTree(
    fields,
    `${path}.factoryConstants`,
    FROZEN_V1_TRIANGLE_EQUIVALENCE_ORACLE,
    V1_TRIANGLE_COMPATIBILITY_PROFILE,
  )
  appendTree(
    fields,
    `${path}.entity`,
    {
      version: FROZEN_V1_TRIANGLE_EQUIVALENCE_ORACLE.version,
      voiceFactoryId: FROZEN_V1_TRIANGLE_EQUIVALENCE_ORACLE.voiceFactoryId,
    },
    performance === undefined
      ? undefined
      : {
          version: performance.version,
          voiceFactoryId:
            performance.version === 'v1-compat-performance-v1'
              ? performance.voiceFactoryId
              : null,
        },
    true,
    performance !== undefined,
  )
}

function translatedOperationEvidence(source: Candidate) {
  return source.provenance.operations.map((operation) => ({
    version: 'candidate-operation-v2',
    kind: 'import',
    operatorId: operation.operator,
    parameters: operation.parameters,
  }))
}

async function candidateReport(
  source: Candidate,
  converted: ConvertedV1CandidateComponentsV2,
  performance: PerformanceSettingsRecordV2 | undefined,
  sha256: Sha256,
  basePath: string,
): Promise<V1CandidateEquivalenceReportV2> {
  const fields: V1EquivalenceFieldV2[] = []
  const { candidate, melodyGenome, timingProfile, tonalTimeline, pairing } =
    converted
  const reconstructedMelody = migratedCandidateAsMelodyV1(converted)
  const sourcePlan = createPlaybackPlan(source.melody)
  const migratedPlan = createPlaybackPlan(reconstructedMelody)
  const sourceDegrees = source.melody.events.map(({ degree }) => degree)
  const pitchByEvent = new Map(
    melodyGenome.pitchShape.genes.map(({ eventId, extendedDegree }) => [
      eventId,
      extendedDegree,
    ]),
  )
  const migratedDegrees = melodyGenome.rhythm.events.map((event) =>
    event.isRest ? null : (pitchByEvent.get(event.eventId) ?? null),
  )
  const timingRef = {
    kind: 'v1-compatibility',
    timingProfileId: timingProfile.id,
  } as const

  appendTree(fields, `${basePath}.candidateId`, source.id, candidate.id)
  appendTree(
    fields,
    `${basePath}.candidateVersions`,
    {
      version: 'melody-candidate-v2',
      candidateKind: 'migrated-v1',
      rngVersion: ALGORITHM_VERSION_REGISTRY_V2.foundations.rng,
      renderVersion: ALGORITHM_VERSION_REGISTRY_V2.foundations.melodyRender,
    },
    {
      version: candidate.version,
      candidateKind: candidate.candidateKind,
      rngVersion: candidate.provenance.rngVersion,
      renderVersion: candidate.renderedPhenotype.renderVersion,
    },
  )
  appendTree(
    fields,
    `${basePath}.frozenCompatibilitySource`,
    freezeV1CandidateV2(source),
    candidate.compatibilitySource.candidate,
  )
  appendTree(
    fields,
    `${basePath}.provenance.seed`,
    source.provenance.seed,
    candidate.provenance.rootSeed,
  )
  appendTree(
    fields,
    `${basePath}.provenance.seedPath`,
    [],
    candidate.provenance.seedPath,
  )
  appendTree(
    fields,
    `${basePath}.provenance.generatorVersion`,
    source.provenance.generatorVersion,
    candidate.provenance.algorithmVersion,
  )
  appendTree(
    fields,
    `${basePath}.provenance.operations`,
    translatedOperationEvidence(source),
    candidate.provenance.operations,
  )
  appendTree(
    fields,
    `${basePath}.lineage.parentCandidateIds`,
    source.provenance.parentIds,
    candidate.lineage.geneticParentCandidateIds,
  )
  appendTree(fields, `${basePath}.events.degrees`, sourceDegrees, migratedDegrees)
  appendTree(
    fields,
    `${basePath}.events.rests`,
    source.melody.events.map(({ degree }) => degree === null),
    melodyGenome.rhythm.events.map(({ isRest }) => isRest),
  )
  appendTree(
    fields,
    `${basePath}.events.onsets`,
    source.melody.events.map(({ startTick }) => startTick),
    melodyGenome.rhythm.events.map(({ onsetTick }) => onsetTick),
  )
  appendTree(
    fields,
    `${basePath}.events.durations`,
    source.melody.events.map(({ durationTicks }) => durationTicks),
    melodyGenome.rhythm.events.map(({ durationTicks }) => durationTicks),
  )
  appendTree(
    fields,
    `${basePath}.events.eventIds`,
    source.melody.events.map((_, ordinal) =>
      migratedV1EventIdV2(source.id, ordinal),
    ),
    melodyGenome.rhythm.events.map(({ eventId }) => eventId),
  )
  appendTree(
    fields,
    `${basePath}.events.renderedEventIds`,
    source.melody.events.map((_, ordinal) =>
      migratedV1EventIdV2(source.id, ordinal),
    ),
    candidate.renderedPhenotype.events.map(({ eventId }) => eventId),
  )
  appendTree(
    fields,
    `${basePath}.events.rhythmDefaults`,
    source.melody.events.map(({ degree }) => ({
      isRest: degree === null,
      accent: 0,
      tieToNext: false,
    })),
    melodyGenome.rhythm.events.map(({ isRest, accent, tieToNext }) => ({
      isRest,
      accent,
      tieToNext,
    })),
  )
  appendTree(
    fields,
    `${basePath}.pitch.mapping`,
    source.melody.constraints.pitchMapping === 'tonic-relative'
      ? 'tonal-relative'
      : 'legacy-fixed-octave',
    melodyGenome.pitchShape.mapping,
  )
  appendTree(
    fields,
    `${basePath}.pitch.register`,
    source.melody.constraints.register,
    melodyGenome.pitchShape.register,
  )
  appendTree(
    fields,
    `${basePath}.timing.ppq`,
    source.melody.constraints.ticksPerBeat,
    timingProfile.sourceTicksPerBeat,
  )
  appendTree(
    fields,
    `${basePath}.timing.gridTicks`,
    source.melody.constraints.gridTicks,
    timingProfile.sourceGridTicks,
  )
  appendTree(
    fields,
    `${basePath}.timing.tempoBpm`,
    source.melody.constraints.tempoBpm,
    timingProfile.tempoBpm,
  )
  appendTree(
    fields,
    `${basePath}.timing.loopEndpoint`,
    source.melody.constraints.totalTicks,
    timingProfile.loopEndTick,
  )
  appendTree(
    fields,
    `${basePath}.timing.reference`,
    timingRef,
    melodyGenome.timing,
  )
  appendTree(
    fields,
    `${basePath}.tonal.fullLoop`,
    {
      startTick: 0,
      endTick: source.melody.constraints.totalTicks,
      tonicPitchClass: source.melody.constraints.tonicPitchClass,
      tonicMidi: source.melody.constraints.tonicMidi,
      scale: {
        kind: 'catalogue',
        scaleId: source.melody.constraints.scaleId,
      },
      borrowingPolicyId: null,
    },
    tonalTimeline.segments.length === 1
      ? {
          startTick: tonalTimeline.segments[0]!.startTick,
          endTick: tonalTimeline.segments[0]!.endTick,
          tonicPitchClass: tonalTimeline.segments[0]!.tonicPitchClass,
          tonicMidi: tonalTimeline.segments[0]!.tonicMidi,
          scale: tonalTimeline.segments[0]!.scale,
          borrowingPolicyId: tonalTimeline.segments[0]!.borrowingPolicyId,
        }
      : { segmentCount: tonalTimeline.segments.length },
  )
  appendTree(
    fields,
    `${basePath}.derivedMidi`,
    sourcePlan.events.map(({ midi }) => midi),
    candidate.renderedPhenotype.events.map(({ midi }) => midi),
  )
  appendTree(
    fields,
    `${basePath}.playbackPlan`,
    sourcePlan,
    migratedPlan,
  )
  appendTree(
    fields,
    `${basePath}.compatibilitySchedule`,
    expectedCompatibilitySchedule(source),
    migratedCandidateCompatibilityScheduleV2(converted),
  )
  appendTree(
    fields,
    `${basePath}.directMidi`,
    captureMidiBytes(source.melody),
    captureMidiBytes(reconstructedMelody),
  )
  appendTree(
    fields,
    `${basePath}.pairing`,
    {
      melodyCandidateId: source.id,
      beatId: null,
      timing: timingRef,
      performanceId: V1_COMPATIBILITY_PERFORMANCE_V2.id,
    },
    {
      melodyCandidateId: pairing.melodyCandidateId,
      beatId: pairing.beatId,
      timing: pairing.timing,
      performanceId: pairing.performanceId,
    },
  )
  appendTree(
    fields,
    `${basePath}.renderedVelocity`,
    source.melody.events.map(() => 88 / 127),
    candidate.renderedPhenotype.events.map(({ velocity }) => velocity),
  )
  appendPerformanceEvidence(fields, `${basePath}.performance`, performance)

  const renderVersion = candidate.renderedPhenotype.renderVersion
  const expectedInputFingerprint = await sha256CanonicalValue(sha256, {
    renderVersion,
    melodyGenome,
    tonalTimeline,
    timing: timingProfile,
  })
  const expectedTimingFingerprint = await sha256CanonicalValue(
    sha256,
    timingProfile,
  )
  const expectedPhenotypeFingerprint = await sha256CanonicalValue(sha256, {
    version: candidate.renderedPhenotype.version,
    renderVersion,
    inputFingerprint: candidate.renderedPhenotype.inputFingerprint,
    timingFingerprint: candidate.renderedPhenotype.timingFingerprint,
    events: candidate.renderedPhenotype.events,
  })
  appendTree(
    fields,
    `${basePath}.fingerprints.input`,
    expectedInputFingerprint,
    candidate.renderedPhenotype.inputFingerprint,
  )
  appendTree(
    fields,
    `${basePath}.fingerprints.timing`,
    expectedTimingFingerprint,
    candidate.renderedPhenotype.timingFingerprint,
  )
  appendTree(
    fields,
    `${basePath}.fingerprints.phenotype`,
    expectedPhenotypeFingerprint,
    candidate.renderedPhenotype.phenotypeFingerprint,
  )

  return deepFreezeV2({
    candidateId: source.id,
    equivalent: fields.every(({ equivalent }) => equivalent),
    fields,
  })
}

function missingCandidateReport(
  source: Candidate,
  basePath: string,
): V1CandidateEquivalenceReportV2 {
  const fields: V1EquivalenceFieldV2[] = []
  appendTree(
    fields,
    `${basePath}.normalizedClosure`,
    { candidateId: source.id },
    undefined,
    true,
    false,
  )
  return deepFreezeV2({ candidateId: source.id, equivalent: false, fields })
}

function componentsFromGraph(
  graph: StoredProjectGraphV2,
  candidateId: string,
): ConvertedV1CandidateComponentsV2 | null {
  const candidate = graph.tables.melodyCandidates.find(({ id }) => id === candidateId)
  if (candidate === undefined) return null
  const melodyGenome = graph.tables.melodyGenomes.find(
    ({ id }) => id === candidate.melodyGenomeId,
  )
  if (melodyGenome === undefined || melodyGenome.timing.kind !== 'v1-compatibility') {
    return null
  }
  const timingProfileId = melodyGenome.timing.timingProfileId
  const timingProfile = graph.tables.v1TimingProfiles.find(
    ({ id }) => id === timingProfileId,
  )
  const tonalTimeline = graph.tables.tonalTimelines.find(
    ({ id }) => id === melodyGenome.tonalTimelineId,
  )
  const pairing = graph.tables.pairings.find(
    ({ melodyCandidateId }) => melodyCandidateId === candidateId,
  )
  if (
    timingProfile === undefined ||
    tonalTimeline === undefined ||
    pairing === undefined
  ) {
    return null
  }
  return { candidate, melodyGenome, timingProfile, tonalTimeline, pairing }
}

function activeSourceSnapshot(source: ProjectState) {
  return source.historyIndex < 0 ? null : source.history[source.historyIndex]!
}

function graphNodeOrder(graph: StoredProjectGraphV2) {
  const historyGraph = graph.tables.historyGraphs[0]
  const nodeById = new Map(graph.tables.historyNodes.map((node) => [node.id, node]))
  return historyGraph?.nodeIds.map((id) => nodeById.get(id)) ?? []
}

function appendProjectEvidence(
  fields: V1EquivalenceFieldV2[],
  source: ProjectState,
  conversion: V1ProjectConversionV2,
): void {
  const { graph } = conversion
  const project = graph.record.project
  const createState = graph.tables.createStates.find(
    ({ id }) => id === project.createStateId,
  )
  const breed = graph.tables.modeStates.find(({ mode }) => mode === 'breed')
  const historyGraph = graph.tables.historyGraphs.find(
    ({ id }) => id === project.historyGraphId,
  )
  const nodes = graphNodeOrder(graph)
  const receipt = graph.tables.migrationReceipts.find(
    ({ sourceHash }) => sourceHash === conversion.sourceHash,
  )
  const active = activeSourceSnapshot(source)
  const libraryById = new Map(
    graph.tables.libraryItems.map((item) => [item.id, item]),
  )

  appendTree(fields, 'project.sourceKind', conversion.sourceKind, receipt?.sourceKind)
  appendTree(fields, 'project.sourceHash', conversion.sourceHash, receipt?.sourceHash)
  appendTree(
    fields,
    'project.id',
    migratedV1ProjectIdV2(conversion.sourceHash),
    project.id,
  )
  appendTree(
    fields,
    'project.rootSeed',
    `v1-migration/${conversion.sourceHash}`,
    project.rootSeed,
  )
  appendTree(
    fields,
    'project.algorithmVersions',
    ALGORITHM_VERSION_REGISTRY_V2,
    project.algorithmVersions,
  )
  appendTree(fields, 'project.recordRevision', 1, graph.record.revision)
  appendTree(fields, 'project.nameFallback', 'Untitled Melody', project.name)
  appendTree(fields, 'project.createdAtEpochMs', null, project.createdAtEpochMs)
  appendTree(fields, 'project.updatedAtEpochMs', null, project.updatedAtEpochMs)
  appendTree(
    fields,
    'project.rootSelectors',
    {
      destination: 'create',
      activeEvolutionMode: 'breed',
      activeExploreMode: 'map',
      activePerformanceId: V1_COMPATIBILITY_PERFORMANCE_V2.id,
    },
    {
      destination: project.destination,
      activeEvolutionMode: project.activeEvolutionMode,
      activeExploreMode: project.activeExploreMode,
      activePerformanceId: project.activePerformanceId,
    },
  )
  appendTree(fields, 'project.activeGenerator', source.mode, createState?.activeGenerator)
  appendTree(
    fields,
    'project.legacySettings',
    source.legacySettings,
    createState?.legacySettings,
  )
  appendTree(
    fields,
    'project.modernSettings',
    source.modernSettings,
    createState?.modernSettings,
  )
  appendTree(
    fields,
    'project.strategySeeds',
    {
      legacy: source.legacySettings.seed,
      modern: source.modernSettings.seed,
    },
    createState === undefined
      ? undefined
      : {
          legacy: createState.legacySettings.seed,
          modern: createState.modernSettings.seed,
        },
    true,
    createState !== undefined,
  )
  appendTree(
    fields,
    'project.evolutionSettings',
    source.evolutionSettings,
    breed?.payload.version === 'breed-mode-state-v2.0.0'
      ? {
          populationSize: breed.payload.populationSize,
          mutationStrength: breed.payload.mutationStrength,
          retainElites: breed.payload.retainElites,
        }
      : undefined,
    true,
    breed?.payload.version === 'breed-mode-state-v2.0.0',
  )
  appendTree(fields, 'project.loopEnabled', source.loop, project.loopEnabled)
  appendTree(
    fields,
    'project.rootPlaybackFallbacks',
    {
      comparisonTransportId: null,
      auditionTiming: null,
      sharedBeatId: null,
      activePairingId: null,
      accompanimentMuted: true,
      focusedMelodyCandidateId: null,
      selectedMelodyCandidateIds: [],
    },
    {
      comparisonTransportId: project.comparisonTransportId,
      auditionTiming: project.auditionTiming,
      sharedBeatId: project.sharedBeatId,
      activePairingId: project.activePairingId,
      accompanimentMuted: project.accompanimentMuted,
      focusedMelodyCandidateId: project.focusedMelodyCandidateId,
      selectedMelodyCandidateIds: project.selectedMelodyCandidateIds,
    },
  )
  appendTree(
    fields,
    'project.history.sourceLength',
    source.history.length,
    historyGraph?.v1LinearSource?.sourceHistoryLength,
  )
  appendTree(
    fields,
    'project.history.activeIndex',
    source.historyIndex,
    historyGraph?.v1LinearSource?.sourceHistoryIndex,
  )
  appendTree(
    fields,
    'project.history.snapshotIdOrder',
    source.history.map(({ id }) => id),
    nodes.map((node) => node?.snapshotId ?? null),
  )
  appendTree(
    fields,
    'project.history.activeNodeId',
    source.historyIndex < 0 ? null : (nodes[source.historyIndex]?.id ?? null),
    historyGraph?.activeNodeId,
  )
  appendTree(
    fields,
    'project.activePopulation.candidateIdOrder',
    active?.candidates.map(({ id }) => id) ?? [],
    breed?.payload.version === 'breed-mode-state-v2.0.0'
      ? breed.payload.populationCandidateIds
      : undefined,
    true,
    breed?.payload.version === 'breed-mode-state-v2.0.0',
  )
  appendTree(
    fields,
    'project.activePopulation.selectedParentIdOrder',
    active?.selectedParentIds ?? [],
    breed?.payload.version === 'breed-mode-state-v2.0.0'
      ? breed.payload.parentCandidateIds
      : undefined,
    true,
    breed?.payload.version === 'breed-mode-state-v2.0.0',
  )
  appendTree(
    fields,
    'project.favorites.candidateIdOrder',
    source.favorites.map(({ id }) => id),
    project.libraryItemIds.map((id) => libraryById.get(id)?.componentId ?? null),
  )
  source.favorites.forEach((favorite, ordinal) => {
    const itemId = project.libraryItemIds[ordinal]
    const item = itemId === undefined ? undefined : libraryById.get(itemId)
    appendTree(
      fields,
      `project.favorites[${String(ordinal)}].libraryDefaults`,
      {
        componentId: favorite.id,
        name: 'Untitled Melody',
        note: '',
        favorite: true,
        savedAtEpochMs: null,
        originReferences: [
          {
            kind: 'v1-favorite',
            projectId: project.id,
            historyNodeId: null,
            sourceHash: conversion.sourceHash,
            sourceId: favorite.id,
          },
        ],
      },
      item === undefined
        ? undefined
        : {
            componentId: item.componentId,
            name: item.name,
            note: item.note,
            favorite: item.favorite,
            savedAtEpochMs: item.savedAtEpochMs,
            originReferences: item.originReferences,
          },
      true,
      item !== undefined,
    )
  })
  appendTree(
    fields,
    'project.receipt.candidateIdOrder',
    traverseUniqueV1Candidates(source).map(({ candidate }) => candidate.id),
    receipt?.candidateMappings.map(({ sourceCandidateId }) => sourceCandidateId),
  )
  appendTree(
    fields,
    'project.receipt.migrationVersion',
    ALGORITHM_VERSION_REGISTRY_V2.foundations.v1Migration,
    receipt?.migrationVersion,
  )
  appendTree(
    fields,
    'project.receipt.snapshotMappings',
    source.history.map((snapshot, sourceHistoryOrdinal) => ({
      sourceHistoryOrdinal,
      sourceSnapshotId: snapshot.id,
      historyNodeId: nodes[sourceHistoryOrdinal]?.id ?? null,
    })),
    receipt?.snapshotMappings,
  )
  appendTree(
    fields,
    'project.receipt.timestamps',
    { createdAtEpochMs: null, verifiedAtEpochMs: null },
    receipt === undefined
      ? undefined
      : {
          createdAtEpochMs: receipt.createdAtEpochMs,
          verifiedAtEpochMs: receipt.verifiedAtEpochMs,
        },
    true,
    receipt !== undefined,
  )

  source.history.forEach((snapshot, ordinal) => {
    const row = graph.tables.snapshots.find(({ id }) => id === snapshot.id)
    const node = nodes[ordinal]
    const parentResolution = resolveV1HistoryParent(source.history, ordinal)
    appendTree(
      fields,
      `project.history[${String(ordinal)}].snapshot`,
      {
        id: snapshot.id,
        generationOrdinal: snapshot.generation,
        seed: snapshot.seed,
        sourceGeneratorVersion: snapshot.generatorVersion,
        candidateIds: snapshot.candidates.map(({ id }) => id),
        selectedCandidateIds: snapshot.selectedParentIds,
        sourceEvolutionSettings: snapshot.evolutionSettings,
      },
      row === undefined
        ? undefined
        : {
            id: row.id,
            generationOrdinal: row.generationOrdinal,
            seed: row.seed,
            sourceGeneratorVersion: row.payload.sourceGeneratorVersion,
            candidateIds: row.candidateIds,
            selectedCandidateIds: row.selectedCandidateIds,
            sourceEvolutionSettings: row.payload.sourceEvolutionSettings,
          },
      true,
      row !== undefined,
    )
    appendTree(
      fields,
      `project.history[${String(ordinal)}].nodeSource`,
      {
        sourceHistoryOrdinal: ordinal,
        sourceSnapshotId: snapshot.id,
        sourcePreviousGenerationId: snapshot.previousGenerationId,
        parentResolution: parentResolution.resolution,
        parentNodeId:
          parentResolution.parentHistoryOrdinal === null
            ? null
            : (nodes[parentResolution.parentHistoryOrdinal]?.id ?? null),
      },
      node?.v1LinearSource === null || node?.v1LinearSource === undefined
        ? undefined
        : {
            sourceHistoryOrdinal: node.v1LinearSource.sourceHistoryOrdinal,
            sourceSnapshotId: node.v1LinearSource.sourceSnapshotId,
            sourcePreviousGenerationId:
              node.v1LinearSource.sourcePreviousGenerationId,
            parentResolution: node.v1LinearSource.parentResolution,
            parentNodeId: node.parentNodeId,
          },
      true,
      node?.v1LinearSource !== null && node?.v1LinearSource !== undefined,
    )
  })
}

export async function createV1ProjectEquivalenceReportV2(
  source: ProjectState,
  conversion: V1ProjectConversionV2,
  sha256: Sha256,
  phase: Exclude<V1EquivalencePhaseV2, 'candidate-preview'>,
): Promise<V1V2EquivalenceReportV2> {
  const fields: V1EquivalenceFieldV2[] = []
  appendProjectEvidence(fields, source, conversion)
  const performance = conversion.graph.tables.performanceSettings.find(
    ({ version }) => version === 'v1-compat-performance-v1',
  )
  appendPerformanceEvidence(fields, 'project.performance', performance)
  const candidates: V1CandidateEquivalenceReportV2[] = []
  for (const [ordinal, { candidate: sourceCandidate }] of
    traverseUniqueV1Candidates(source).entries()) {
    const converted = componentsFromGraph(conversion.graph, sourceCandidate.id)
    candidates.push(
      converted === null
        ? missingCandidateReport(
            sourceCandidate,
            `candidates[${String(ordinal)}:${sourceCandidate.id}]`,
          )
        : await candidateReport(
            sourceCandidate,
            converted,
            performance,
            sha256,
            `candidates[${String(ordinal)}:${sourceCandidate.id}]`,
          ),
    )
  }
  const report: V1V2EquivalenceReportV2 = {
    version: 'v1-v2-equivalence-report-v2',
    phase,
    sourceKind: conversion.sourceKind,
    sourceHash: conversion.sourceHash,
    projectId: conversion.projectId,
    equivalent:
      fields.every(({ equivalent }) => equivalent) &&
      candidates.every(({ equivalent }) => equivalent),
    specSeams: [...V1_MIGRATION_SPEC_SEAMS_V2],
    fields,
    candidates,
  }
  return deepFreezeV2(report)
}

export async function createV1CandidatePreviewEquivalenceReportV2(
  source: Candidate,
  closure: V1CandidatePreviewClosureV2,
  sha256: Sha256,
): Promise<V1V2EquivalenceReportV2> {
  const fields: V1EquivalenceFieldV2[] = []
  appendTree(fields, 'preview.sourceKind', 'candidate-envelope-v1', closure.sourceKind)
  appendTree(fields, 'preview.candidateId', source.id, closure.rootCandidateId)
  appendTree(fields, 'preview.projectId', null, null)
  appendTree(fields, 'preview.projectReceipt', null, null)
  const candidate = await candidateReport(
    source,
    closure,
    closure.performance,
    sha256,
    `candidates[0:${source.id}]`,
  )
  const report: V1V2EquivalenceReportV2 = {
    version: 'v1-v2-equivalence-report-v2',
    phase: 'candidate-preview',
    sourceKind: closure.sourceKind,
    sourceHash: closure.sourceHash,
    projectId: null,
    equivalent:
      fields.every(({ equivalent }) => equivalent) && candidate.equivalent,
    specSeams: [...V1_MIGRATION_SPEC_SEAMS_V2],
    fields,
    candidates: [candidate],
  }
  return deepFreezeV2(report)
}

/** Throws with every mismatched path; callers decide whether staging may run. */
export function assertV1V2EquivalentV2(
  report: V1V2EquivalenceReportV2,
): void {
  if (!report.equivalent) {
    throw new V1V2EquivalenceError(report)
  }
}

/**
 * Rewraps a strict read-back graph without changing source identity, allowing
 * the same complete report to run before staging and after IndexedDB decode.
 */
export function withReadBackGraphV2(
  conversion: V1ProjectConversionV2,
  graph: StoredProjectGraphV2,
): V1ProjectConversionV2 {
  return {
    sourceKind: conversion.sourceKind,
    sourceHash: conversion.sourceHash,
    projectId: conversion.projectId,
    graph,
  }
}
