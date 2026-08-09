import { createTransportSpec } from '../transport'
import { assertStoredProjectGraphV2 } from './graph'
import { createEmptyHistoryGraphV2 } from './history'
import { createEmptyUndoStateV2 } from './library'
import { DEFAULT_SOFT_PLUCK_PERFORMANCE_V2 } from './performance'
import { ALGORITHM_VERSION_REGISTRY_V2 } from './registry'
import {
  createDefaultCreateStateV2,
  createEmptyModeStatesV2,
} from './state'
import type {
  M2ProjectEntityArrayTablesV2,
  ModeStateV2,
  ProjectV2,
  StoredProjectGraphV2,
  StoredProjectRecordV2,
} from './types'
import {
  compareUnicodeCodePoints,
  deepFreezeV2,
  nonEmptyString,
  safeInteger,
} from './validation'

export interface CreateNewProjectKernelV2Options {
  /** Injected metadata UUID factory; it is read exactly once. */
  readonly projectIdFactory: () => string
  /** Injected organizational clock; it is read exactly once. */
  readonly metadataClock: () => number
}

function modeRow(
  modes: readonly ModeStateV2[],
  mode: ModeStateV2['mode'],
): ModeStateV2 {
  return modes.find((row) => row.mode === mode)!
}

function idSorted<T extends { readonly id: string }>(rows: readonly T[]): readonly T[] {
  return [...rows].sort((left, right) =>
    compareUnicodeCodePoints(left.id, right.id),
  )
}

export function createNewProjectKernelV2(
  options: CreateNewProjectKernelV2Options,
): StoredProjectGraphV2 {
  const projectId = nonEmptyString(options.projectIdFactory(), 'projectIdFactory()')
  const createdAtEpochMs = safeInteger(options.metadataClock(), 'metadataClock()', 0)
  const transport = createTransportSpec({
    meter: '4/4',
    loopEndTick: 1920,
    tempoBpm: 108,
    gridTicks: 240,
    swing: { subdivisionTicks: 240, amountPermille: 500 },
    meterSource: 'explicit',
  })
  const createState = createDefaultCreateStateV2(projectId)
  const modeStates = createEmptyModeStatesV2(projectId)
  const historyGraph = createEmptyHistoryGraphV2(projectId)
  const undoState = createEmptyUndoStateV2(projectId)

  const project: ProjectV2 = {
    id: projectId,
    version: 'project-v2',
    schemaVersion: 2,
    name: 'Untitled Melody',
    rootSeed: 'melody-forge',
    algorithmVersions: ALGORITHM_VERSION_REGISTRY_V2,
    createdAtEpochMs,
    updatedAtEpochMs: createdAtEpochMs,
    destination: 'create',
    activeEvolutionMode: 'breed',
    activeExploreMode: 'map',
    comparisonTransportId: transport.id,
    auditionTiming: {
      kind: 'canonical-transport',
      transportId: transport.id,
    },
    activePerformanceId: DEFAULT_SOFT_PLUCK_PERFORMANCE_V2.id,
    sharedBeatId: null,
    activePairingId: null,
    loopEnabled: false,
    accompanimentMuted: true,
    focusedMelodyCandidateId: null,
    selectedMelodyCandidateIds: [],
    createStateId: createState.id,
    modeStateIds: {
      breed: modeRow(modeStates, 'breed').id,
      drift: modeRow(modeStates, 'drift').id,
      islands: modeRow(modeStates, 'islands').id,
      map: modeRow(modeStates, 'map').id,
      pareto: modeRow(modeStates, 'pareto').id,
      pairLab: modeRow(modeStates, 'pair-lab').id,
    },
    historyGraphId: historyGraph.id,
    undoStateId: undoState.id,
    nextPreferenceOccurrence: 0,
    preferenceRecordIds: [],
    activePreferenceRecordIds: [],
    ratingIds: [],
    annotationIds: [],
    libraryItemIds: [],
    migrationReceiptIds: [],
  }
  const record: StoredProjectRecordV2 = {
    id: projectId,
    version: 'stored-project-record-v2',
    revision: 1,
    project,
  }
  const tables: M2ProjectEntityArrayTablesV2 = {
    createStates: [createState],
    modeStates: idSorted(modeStates),
    historyGraphs: [historyGraph],
    historyNodes: [],
    snapshots: [],
    melodyCandidates: [],
    melodyGenomes: [],
    transports: [transport],
    v1TimingProfiles: [],
    tonalTimelines: [],
    customScales: [],
    beats: [],
    performanceSettings: [DEFAULT_SOFT_PLUCK_PERFORMANCE_V2],
    pairings: [],
    preferenceRecords: [],
    libraryItems: [],
    ratings: [],
    annotations: [],
    undoStates: [undoState],
    migrationReceipts: [],
  }
  const graph: StoredProjectGraphV2 = { record, tables }
  assertStoredProjectGraphV2(graph)
  return deepFreezeV2(graph)
}
