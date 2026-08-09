import type { TransportSpec } from '../transport/types'
import type { V1CompatibilityTimingProfile } from '../transport/compatibility'
import { stableStringify } from '../identity'
import { assertHistoryGraphClosureV2, assertHistoryGraphV2, assertHistoryNodeV2, assertSnapshotV2 } from './history'
import { assertCreateStateV2, assertModeStateV2 } from './state'
import {
  assertAnnotationV2,
  assertLibraryItemV2,
  assertRatingV2,
  assertUndoStateV2,
} from './library'
import {
  assertMelodyGenomeV2,
  assertMigratedV1MelodyCandidateV2,
  assertMigratedV1MelodyClosureV2,
} from './melody'
import {
  assertAuditionPairingV2,
  assertExactTransportRowV2,
  assertExactV1TimingProfileRowV2,
  assertRowsStrictlyIdSortedV2,
  assertTonalTimelineV2,
  assertV1MigrationReceiptV2,
} from './migration'
import { assertPerformanceSettingsRecordV2, V1_COMPATIBILITY_PERFORMANCE_V2 } from './performance'
import { assertStoredProjectRecordV2 } from './project'
import type {
  AnnotationV2,
  M2ProjectEntityArrayTablesV2,
  RatingV2,
  StoredProjectGraphV2,
} from './types'
import {
  deepFreezeV2,
  denseArray,
  exactPlainObject,
  failSchemaV2,
} from './validation'

export const M2_PROJECT_TABLE_NAMES_V2 = deepFreezeV2([
  'createStates',
  'modeStates',
  'historyGraphs',
  'historyNodes',
  'snapshots',
  'melodyCandidates',
  'melodyGenomes',
  'transports',
  'v1TimingProfiles',
  'tonalTimelines',
  'customScales',
  'beats',
  'performanceSettings',
  'pairings',
  'preferenceRecords',
  'libraryItems',
  'ratings',
  'annotations',
  'undoStates',
  'migrationReceipts',
] as const satisfies readonly (keyof M2ProjectEntityArrayTablesV2)[])

type RowAssertion<T> = (value: unknown) => asserts value is T

function validatedRows<T extends { readonly id: string }>(
  value: unknown,
  path: string,
  assertion: RowAssertion<T>,
): readonly T[] {
  const rows = denseArray(value, path).map((entry) => {
    assertion(entry)
    return entry
  })
  assertRowsStrictlyIdSortedV2(rows, path)
  return rows
}

function assertEmptyReservedTable(value: unknown, path: string): void {
  if (denseArray(value, path).length !== 0) {
    failSchemaV2(
      'unregistered-version',
      path,
      'this schema-2 table is reserved but has no registered M2 row codec',
    )
  }
}

export function assertM2ProjectEntityArrayTablesV2(
  value: unknown,
): asserts value is M2ProjectEntityArrayTablesV2 {
  const tables = exactPlainObject(value, M2_PROJECT_TABLE_NAMES_V2, 'tables')
  validatedRows(tables.createStates, 'tables.createStates', assertCreateStateV2)
  validatedRows(tables.modeStates, 'tables.modeStates', assertModeStateV2)
  validatedRows(tables.historyGraphs, 'tables.historyGraphs', assertHistoryGraphV2)
  validatedRows(tables.historyNodes, 'tables.historyNodes', assertHistoryNodeV2)
  validatedRows(tables.snapshots, 'tables.snapshots', assertSnapshotV2)
  validatedRows(
    tables.melodyCandidates,
    'tables.melodyCandidates',
    assertMigratedV1MelodyCandidateV2,
  )
  validatedRows(tables.melodyGenomes, 'tables.melodyGenomes', assertMelodyGenomeV2)
  validatedRows<TransportSpec>(
    tables.transports,
    'tables.transports',
    assertExactTransportRowV2,
  )
  validatedRows<V1CompatibilityTimingProfile>(
    tables.v1TimingProfiles,
    'tables.v1TimingProfiles',
    assertExactV1TimingProfileRowV2,
  )
  validatedRows(tables.tonalTimelines, 'tables.tonalTimelines', assertTonalTimelineV2)
  assertEmptyReservedTable(tables.customScales, 'tables.customScales')
  assertEmptyReservedTable(tables.beats, 'tables.beats')
  validatedRows(
    tables.performanceSettings,
    'tables.performanceSettings',
    assertPerformanceSettingsRecordV2,
  )
  validatedRows(tables.pairings, 'tables.pairings', assertAuditionPairingV2)
  assertEmptyReservedTable(tables.preferenceRecords, 'tables.preferenceRecords')
  validatedRows(tables.libraryItems, 'tables.libraryItems', assertLibraryItemV2)
  validatedRows(tables.ratings, 'tables.ratings', assertRatingV2)
  validatedRows(tables.annotations, 'tables.annotations', assertAnnotationV2)
  validatedRows(tables.undoStates, 'tables.undoStates', assertUndoStateV2)
  validatedRows(
    tables.migrationReceipts,
    'tables.migrationReceipts',
    assertV1MigrationReceiptV2,
  )
}

function rowMap<T extends { readonly id: string }>(
  rows: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(rows.map((row) => [row.id, row] as const))
}

function expectRow<T>(
  rows: ReadonlyMap<string, T>,
  id: string,
  path: string,
): T {
  const row = rows.get(id)
  if (row === undefined) {
    return failSchemaV2(
      'unresolved-reference',
      path,
      `does not resolve embedded ID ${id}`,
    )
  }
  return row
}

function assertExactIdSet(
  rootIds: readonly string[],
  rows: readonly { readonly id: string }[],
  path: string,
): void {
  const rootSet = new Set(rootIds)
  if (
    rootSet.size !== rows.length ||
    rows.some(({ id }) => !rootSet.has(id))
  ) {
    failSchemaV2(
      'unresolved-reference',
      path,
      'must equal all and only normalized table row IDs',
    )
  }
}

function assertExactReachableRows(
  reachableIds: ReadonlySet<string>,
  rows: readonly { readonly id: string }[],
  path: string,
): void {
  if (
    reachableIds.size !== rows.length ||
    rows.some(({ id }) => !reachableIds.has(id))
  ) {
    failSchemaV2(
      'unresolved-reference',
      path,
      'must contain every and only reachable content-addressed row',
    )
  }
}

export function assertStoredProjectGraphV2(
  value: unknown,
): asserts value is StoredProjectGraphV2 {
  const graph = exactPlainObject(value, ['record', 'tables'], 'storedProjectGraph')
  assertStoredProjectRecordV2(graph.record)
  assertM2ProjectEntityArrayTablesV2(graph.tables)
  const { record, tables } = graph
  const project = record.project

  const createStates = rowMap(tables.createStates)
  const modeStates = rowMap(tables.modeStates)
  const historyGraphs = rowMap(tables.historyGraphs)
  const historyNodes = rowMap(tables.historyNodes)
  const snapshots = rowMap(tables.snapshots)
  const candidates = rowMap(tables.melodyCandidates)
  const genomes = rowMap(tables.melodyGenomes)
  const transports = rowMap(tables.transports)
  const timingProfiles = rowMap(tables.v1TimingProfiles)
  const tonalTimelines = rowMap(tables.tonalTimelines)
  const performances = rowMap(tables.performanceSettings)
  const pairings = rowMap(tables.pairings)

  if (
    tables.createStates.length !== 1 ||
    expectRow(createStates, project.createStateId, 'project.createStateId').projectId !==
      project.id
  ) {
    failSchemaV2(
      'unresolved-reference',
      'project.createStateId',
      'must be the sole project-owned Create state',
    )
  }
  const requiredModes = [
    ['breed', project.modeStateIds.breed],
    ['drift', project.modeStateIds.drift],
    ['islands', project.modeStateIds.islands],
    ['map', project.modeStateIds.map],
    ['pareto', project.modeStateIds.pareto],
    ['pair-lab', project.modeStateIds.pairLab],
  ] as const
  if (tables.modeStates.length !== requiredModes.length) {
    failSchemaV2(
      'unresolved-reference',
      'project.modeStateIds',
      'must resolve exactly six mode states',
    )
  }
  requiredModes.forEach(([mode, id]) => {
    const row = expectRow(modeStates, id, `project.modeStateIds.${mode}`)
    if (row.projectId !== project.id || row.mode !== mode) {
      failSchemaV2(
        'unresolved-reference',
        `project.modeStateIds.${mode}`,
        'must resolve the matching project-owned mode row',
      )
    }
  })

  const historyGraph = expectRow(
    historyGraphs,
    project.historyGraphId,
    'project.historyGraphId',
  )
  if (tables.historyGraphs.length !== 1 || historyGraph.projectId !== project.id) {
    failSchemaV2(
      'unresolved-reference',
      'project.historyGraphId',
      'must be the sole project-owned history graph',
    )
  }
  const ownedHistoryNodes = historyGraph.nodeIds.map((id) =>
    expectRow(historyNodes, id, 'historyGraph.nodeIds'),
  )
  if (ownedHistoryNodes.length !== tables.historyNodes.length) {
    failSchemaV2(
      'unresolved-reference',
      'tables.historyNodes',
      'may not contain unreachable nodes',
    )
  }
  assertHistoryGraphClosureV2(
    historyGraph,
    ownedHistoryNodes,
    new Set(tables.snapshots.map(({ id }) => id)),
  )

  const undoState = expectRow(
    rowMap(tables.undoStates),
    project.undoStateId,
    'project.undoStateId',
  )
  if (tables.undoStates.length !== 1 || undoState.projectId !== project.id) {
    failSchemaV2(
      'unresolved-reference',
      'project.undoStateId',
      'must be the sole project-owned Undo state',
    )
  }

  expectRow(
    performances,
    project.activePerformanceId,
    'project.activePerformanceId',
  )

  if (project.comparisonTransportId !== null) {
    expectRow(transports, project.comparisonTransportId, 'project.comparisonTransportId')
  }

  const reachableGenomeIds = new Set<string>()
  const reachableTimingProfileIds = new Set<string>()
  const reachableTimelineIds = new Set<string>()
  tables.melodyCandidates.forEach((candidate) => {
    reachableGenomeIds.add(candidate.melodyGenomeId)
    const genome = expectRow(
      genomes,
      candidate.melodyGenomeId,
      'melodyCandidate.melodyGenomeId',
    )
    assertMigratedV1MelodyClosureV2(candidate, genome)
    reachableTimelineIds.add(genome.tonalTimelineId)
    const timeline = expectRow(
      tonalTimelines,
      genome.tonalTimelineId,
      'melodyGenome.tonalTimelineId',
    )
    if (genome.timing.kind !== 'v1-compatibility') {
      failSchemaV2(
        'unregistered-version',
        'melodyGenome.timing.kind',
        'M2 candidates require compatibility timing',
      )
    }
    const profile = expectRow(
      timingProfiles,
      genome.timing.timingProfileId,
      'melodyGenome.timing.timingProfileId',
    )
    if (profile.sourceCandidateId !== candidate.id) {
      failSchemaV2(
        'unresolved-reference',
        'melodyGenome.timing.timingProfileId',
        'must resolve the candidate-specific V1 profile',
      )
    }
    reachableTimingProfileIds.add(profile.id)
    const constraints = candidate.compatibilitySource.candidate.melody.constraints
    const segment = timeline.segments[0]!
    if (
      segment.endTick !== constraints.totalTicks ||
      segment.tonicPitchClass !== constraints.tonicPitchClass ||
      segment.tonicMidi !== constraints.tonicMidi ||
      segment.scale.kind !== 'catalogue' ||
      segment.scale.scaleId !== constraints.scaleId ||
      profile.sourceTicksPerBeat !== constraints.ticksPerBeat ||
      profile.sourceGridTicks !== constraints.gridTicks ||
      profile.gridTicks !== constraints.gridTicks ||
      profile.tempoBpm !== constraints.tempoBpm ||
      profile.loopEndTick !== constraints.totalTicks
    ) {
      failSchemaV2(
        'invalid-value',
        'melodyCandidate',
        'timeline and timing profile must preserve frozen V1 tonal/timing fields',
      )
    }
    const expectedMapping =
      constraints.pitchMapping === 'tonic-relative'
        ? 'tonal-relative'
        : 'legacy-fixed-octave'
    if (genome.pitchShape.mapping !== expectedMapping) {
      failSchemaV2(
        'invalid-value',
        'melodyGenome.pitchShape.mapping',
        'must preserve the frozen V1 mapping interpretation',
      )
    }
    candidate.renderedPhenotype.events.forEach((event) => {
      if (event.tonalSegmentId !== segment.id) {
        failSchemaV2(
          'unresolved-reference',
          'renderedPhenotype.events.tonalSegmentId',
          'must resolve inside the candidate tonal timeline',
        )
      }
    })
  })
  assertExactReachableRows(
    reachableGenomeIds,
    tables.melodyGenomes,
    'tables.melodyGenomes',
  )
  assertExactReachableRows(
    reachableTimelineIds,
    tables.tonalTimelines,
    'tables.tonalTimelines',
  )

  tables.snapshots.forEach((snapshot) => {
    if (snapshot.projectId !== project.id) {
      failSchemaV2(
        'unresolved-reference',
        'snapshot.projectId',
        'must equal the owning project',
      )
    }
    snapshot.candidateIds.forEach((id) => {
      expectRow(candidates, id, 'snapshot.candidateIds')
    })
  })
  assertExactReachableRows(
    new Set(ownedHistoryNodes.map(({ snapshotId }) => snapshotId)),
    tables.snapshots,
    'tables.snapshots',
  )

  tables.pairings.forEach((pairing) => {
    expectRow(candidates, pairing.melodyCandidateId, 'pairing.melodyCandidateId')
    expectRow(performances, pairing.performanceId, 'pairing.performanceId')
    if (pairing.timing.kind !== 'v1-compatibility') {
      failSchemaV2('unregistered-version', 'pairing.timing', 'must be compatibility timing')
    }
    expectRow(
      timingProfiles,
      pairing.timing.timingProfileId,
      'pairing.timing.timingProfileId',
    )
    reachableTimingProfileIds.add(pairing.timing.timingProfileId)
  })
  if (project.auditionTiming?.kind === 'v1-compatibility') {
    expectRow(
      timingProfiles,
      project.auditionTiming.timingProfileId,
      'project.auditionTiming.timingProfileId',
    )
    reachableTimingProfileIds.add(project.auditionTiming.timingProfileId)
  }
  assertExactReachableRows(
    reachableTimingProfileIds,
    tables.v1TimingProfiles,
    'tables.v1TimingProfiles',
  )

  const candidateTargetIds = new Set(candidates.keys())
  const pairingTargetIds = new Set(pairings.keys())
  function assertMetadataTarget(
    row: RatingV2 | AnnotationV2,
    path: string,
  ): void {
    if (row.projectId !== project.id) {
      failSchemaV2('unresolved-reference', `${path}.projectId`, 'must equal project.id')
    }
    const resolves =
      (row.targetKind === 'melody-candidate' && candidateTargetIds.has(row.targetId)) ||
      (row.targetKind === 'pairing' && pairingTargetIds.has(row.targetId))
    if (!resolves) {
      failSchemaV2(
        'unresolved-reference',
        `${path}.targetId`,
        'must resolve a kind-correct strong target in this M2 graph',
      )
    }
  }
  tables.ratings.forEach((row, index) =>
    assertMetadataTarget(row, `tables.ratings[${String(index)}]`),
  )
  tables.annotations.forEach((row, index) =>
    assertMetadataTarget(row, `tables.annotations[${String(index)}]`),
  )
  assertExactIdSet(project.ratingIds, tables.ratings, 'project.ratingIds')
  assertExactIdSet(project.annotationIds, tables.annotations, 'project.annotationIds')
  assertExactIdSet(project.libraryItemIds, tables.libraryItems, 'project.libraryItemIds')
  assertExactIdSet(
    project.migrationReceiptIds,
    tables.migrationReceipts,
    'project.migrationReceiptIds',
  )

  tables.libraryItems.forEach((item) => {
    const targets: ReadonlyMap<string, unknown> =
      item.kind === 'melody-candidate'
        ? candidates
        : item.kind === 'pairing'
          ? pairings
          : new Map()
    expectRow(targets, item.componentId, 'libraryItem.componentId')
  })

  tables.migrationReceipts.forEach((receipt) => {
    if (
      receipt.projectId !== project.id ||
      receipt.migrationVersion !== project.algorithmVersions.foundations.v1Migration
    ) {
      failSchemaV2(
        'unresolved-reference',
        'migrationReceipt.projectId',
        'must belong to the project and its frozen migration algorithm',
      )
    }
    receipt.candidateMappings.forEach((mapping) => {
      const candidate = expectRow(
        candidates,
        mapping.sourceCandidateId,
        'candidateMappings.sourceCandidateId',
      )
      const genome = expectRow(
        genomes,
        mapping.melodyGenomeId,
        'candidateMappings.melodyGenomeId',
      )
      const profile = expectRow(
        timingProfiles,
        mapping.timingProfileId,
        'candidateMappings.timingProfileId',
      )
      expectRow(
        tonalTimelines,
        mapping.tonalTimelineId,
        'candidateMappings.tonalTimelineId',
      )
      const pairing = expectRow(
        pairings,
        mapping.pairingId,
        'candidateMappings.pairingId',
      )
      const mappedPerformance = expectRow(
        performances,
        mapping.compatibilityPerformanceId,
        'candidateMappings.compatibilityPerformanceId',
      )
      if (
        candidate.melodyGenomeId !== mapping.melodyGenomeId ||
        genome.tonalTimelineId !== mapping.tonalTimelineId ||
        genome.timing.kind !== 'v1-compatibility' ||
        genome.timing.timingProfileId !== mapping.timingProfileId ||
        profile.sourceCandidateId !== candidate.id ||
        pairing.melodyCandidateId !== candidate.id ||
        pairing.beatId !== null ||
        stableStringify(pairing.timing) !== stableStringify(genome.timing) ||
        pairing.performanceId !== mapping.compatibilityPerformanceId ||
        mappedPerformance.id !== V1_COMPATIBILITY_PERFORMANCE_V2.id
      ) {
        failSchemaV2(
          'unresolved-reference',
          'migrationReceipt.candidateMappings',
          'mapping must name the candidate actual genome/timing/timeline/pairing/performance closure',
        )
      }
    })
    receipt.snapshotMappings.forEach((mapping) => {
      expectRow(snapshots, mapping.sourceSnapshotId, 'snapshotMappings.sourceSnapshotId')
      const node = expectRow(
        historyNodes,
        mapping.historyNodeId,
        'snapshotMappings.historyNodeId',
      )
      if (
        node.occurrenceOrdinal !== mapping.sourceHistoryOrdinal ||
        node.snapshotId !== mapping.sourceSnapshotId ||
        node.v1LinearSource?.sourceHistoryOrdinal !== mapping.sourceHistoryOrdinal ||
        node.v1LinearSource.sourceSnapshotId !== mapping.sourceSnapshotId
      ) {
        failSchemaV2(
          'unresolved-reference',
          'migrationReceipt.snapshotMappings',
          'mapping must match node occurrence and retained V1 source evidence',
        )
      }
    })
  })

  const rootedCandidateIds = new Set<string>([
    ...project.selectedMelodyCandidateIds,
    ...(project.focusedMelodyCandidateId === null
      ? []
      : [project.focusedMelodyCandidateId]),
    ...tables.snapshots.flatMap(({ candidateIds }) => candidateIds),
    ...tables.pairings.map(({ melodyCandidateId }) => melodyCandidateId),
    ...tables.libraryItems
      .filter(({ kind }) => kind === 'melody-candidate')
      .map(({ componentId }) => componentId),
    ...tables.ratings
      .filter(({ targetKind }) => targetKind === 'melody-candidate')
      .map(({ targetId }) => targetId),
    ...tables.annotations
      .filter(({ targetKind }) => targetKind === 'melody-candidate')
      .map(({ targetId }) => targetId),
    ...tables.migrationReceipts.flatMap(({ candidateMappings }) =>
      candidateMappings.map(({ sourceCandidateId }) => sourceCandidateId),
    ),
  ])
  tables.modeStates.forEach((state) => {
    if (state.payload.version === 'breed-mode-state-v2.0.0') {
      state.payload.populationCandidateIds.forEach((id) => rootedCandidateIds.add(id))
      state.payload.parentCandidateIds.forEach((id) => rootedCandidateIds.add(id))
    }
  })
  assertExactReachableRows(
    rootedCandidateIds,
    tables.melodyCandidates,
    'tables.melodyCandidates',
  )

  const reachablePairingIds = new Set<string>([
    ...(project.activePairingId === null ? [] : [project.activePairingId]),
    ...tables.libraryItems
      .filter(({ kind }) => kind === 'pairing')
      .map(({ componentId }) => componentId),
    ...tables.ratings
      .filter(({ targetKind }) => targetKind === 'pairing')
      .map(({ targetId }) => targetId),
    ...tables.annotations
      .filter(({ targetKind }) => targetKind === 'pairing')
      .map(({ targetId }) => targetId),
    ...tables.migrationReceipts.flatMap(({ candidateMappings }) =>
      candidateMappings.map(({ pairingId }) => pairingId),
    ),
  ])
  assertExactReachableRows(reachablePairingIds, tables.pairings, 'tables.pairings')

  const reachablePerformanceIds = new Set<string>([
    project.activePerformanceId,
    ...tables.pairings.map(({ performanceId }) => performanceId),
  ])
  assertExactReachableRows(
    reachablePerformanceIds,
    tables.performanceSettings,
    'tables.performanceSettings',
  )

  const reachableTransportIds = new Set<string>()
  if (project.comparisonTransportId !== null) {
    reachableTransportIds.add(project.comparisonTransportId)
  }
  if (project.auditionTiming?.kind === 'canonical-transport') {
    reachableTransportIds.add(project.auditionTiming.transportId)
  }
  assertExactReachableRows(reachableTransportIds, tables.transports, 'tables.transports')

  if (
    project.preferenceRecordIds.length !== 0 ||
    project.activePreferenceRecordIds.length !== 0 ||
    project.nextPreferenceOccurrence !== 0
  ) {
    failSchemaV2(
      'unregistered-version',
      'project.preferenceRecordIds',
      'M2 registers no preference rows; fresh and migrated roots require empty occurrence state',
    )
  }

  project.selectedMelodyCandidateIds.forEach((id) =>
    expectRow(candidates, id, 'project.selectedMelodyCandidateIds'),
  )
  if (project.focusedMelodyCandidateId !== null) {
    expectRow(candidates, project.focusedMelodyCandidateId, 'project.focusedMelodyCandidateId')
  }
  if (project.sharedBeatId !== null) {
    failSchemaV2(
      'unregistered-version',
      'project.sharedBeatId',
      'M2 registers no beat rows',
    )
  }
  if (project.activePairingId !== null) {
    const pairing = expectRow(pairings, project.activePairingId, 'project.activePairingId')
    if (
      project.focusedMelodyCandidateId !== pairing.melodyCandidateId ||
      project.activePerformanceId !== pairing.performanceId ||
      project.sharedBeatId !== pairing.beatId ||
      stableStringify(project.auditionTiming) !== stableStringify(pairing.timing)
    ) {
      failSchemaV2(
        'unresolved-reference',
        'project.activePairingId',
        'active pairing must exactly match redundant root selection fields',
      )
    }
    if (
      project.activePerformanceId !== V1_COMPATIBILITY_PERFORMANCE_V2.id ||
      project.auditionTiming?.kind !== 'v1-compatibility'
    ) {
      failSchemaV2(
        'unregistered-version',
        'project.activePairingId',
        'M2 active pairings are beat-null compatibility auditions',
      )
    }
  }
}
