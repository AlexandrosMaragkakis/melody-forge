import { stableId } from '../identity'
import type {
  AnnotationV2,
  AuditionPairingV2,
  CandidateContributionV2,
  CandidateLineageV2,
  CandidateProvenanceV2,
  CandidateRepairV2,
  HistoryNodeV2,
  LibraryItemV2,
  MelodyGenomeV2,
  ModeStateV2,
  NativeMelodyCandidateV2,
  PerformanceSettingsV2,
  RatingV2,
  SnapshotV2,
  TonalSegmentV2,
  TonalTimelineV2,
  V1MigrationReceiptV2,
  V1CompatibilityPerformanceSettingsV2,
} from './types'
import { lowercaseSha256, nonEmptyString, safeInteger } from './validation'

export function createStateIdV2(projectId: string): string {
  nonEmptyString(projectId, 'projectId')
  return stableId('create-state', { version: 'create-state-v2', projectId })
}

export function modeStateIdV2(
  projectId: string,
  mode: ModeStateV2['mode'],
): string {
  nonEmptyString(projectId, 'projectId')
  return stableId('mode-state', { version: 'mode-state-v2', projectId, mode })
}

export function historyGraphIdV2(projectId: string): string {
  nonEmptyString(projectId, 'projectId')
  return stableId('history-graph', { version: 'history-graph-v2', projectId })
}

export function undoStateIdV2(projectId: string): string {
  nonEmptyString(projectId, 'projectId')
  return stableId('undo-state', { version: 'undo-state-v2', projectId })
}

export function historyNodeIdV2(node: Omit<HistoryNodeV2, 'id'>): string {
  return stableId('history-node', node)
}

export function nativeSnapshotIdV2(snapshot: Omit<SnapshotV2, 'id'>): string {
  return stableId('snapshot', snapshot)
}

export function melodyGenomeIdV2(genome: Omit<MelodyGenomeV2, 'id'>): string {
  return stableId('melody-genome', genome)
}

export function candidateContributionIdV2(
  contribution: Omit<CandidateContributionV2, 'id'>,
): string {
  return stableId('candidate-contribution', contribution)
}

export function candidateRepairIdV2(
  repair: Omit<CandidateRepairV2, 'id'>,
): string {
  return stableId('candidate-repair', repair)
}

export function nativeMelodyCandidateIdV2(value: {
  readonly version: NativeMelodyCandidateV2['version']
  readonly candidateKind: NativeMelodyCandidateV2['candidateKind']
  readonly melodyGenomeId: string
  readonly provenance: CandidateProvenanceV2
  readonly lineage: CandidateLineageV2
}): string {
  return stableId('melody-candidate', value)
}

export function performanceSettingsIdV2(
  settings:
    | Omit<PerformanceSettingsV2, 'id'>
    | Omit<V1CompatibilityPerformanceSettingsV2, 'id'>,
): string {
  return stableId('performance', settings)
}

export function libraryItemIdV2(
  value: Pick<LibraryItemV2, 'version' | 'kind' | 'componentId'>,
): string {
  return stableId('library-item', value)
}

export function ratingIdV2(
  value: Pick<RatingV2, 'version' | 'projectId' | 'targetKind' | 'targetId'>,
): string {
  return stableId('rating', value)
}

export function annotationIdV2(
  value: Pick<
    AnnotationV2,
    'version' | 'projectId' | 'targetKind' | 'targetId'
  >,
): string {
  return stableId('annotation', value)
}

export function tonalSegmentIdV2(
  segment: Omit<TonalSegmentV2, 'id'>,
): string {
  return stableId('tonal-segment', segment)
}

export function tonalTimelineIdV2(
  timeline: Omit<TonalTimelineV2, 'id'>,
): string {
  return stableId('tonal-timeline', timeline)
}

export function auditionPairingIdV2(
  pairing: Omit<AuditionPairingV2, 'id'>,
): string {
  return stableId('pairing', pairing)
}

export function v1MigrationReceiptIdV2(
  value: Pick<
    V1MigrationReceiptV2,
    'version' | 'migrationVersion' | 'sourceHash' | 'projectId'
  >,
): string {
  return stableId('migration-receipt', value)
}

export function migratedV1ProjectIdV2(sourceHash: string): string {
  lowercaseSha256(sourceHash, 'sourceHash')
  return stableId('v1-project', {
    version: 'v1-project-id-v2',
    sourceHash,
  })
}

export function migratedV1RootSeedV2(sourceHash: string): string {
  lowercaseSha256(sourceHash, 'sourceHash')
  return `v1-migration/${sourceHash}`
}

export function migratedV1EventIdV2(
  sourceCandidateId: string,
  ordinal: number,
): string {
  nonEmptyString(sourceCandidateId, 'sourceCandidateId')
  safeInteger(ordinal, 'ordinal', 0)
  return stableId('event', {
    version: 'v1-event-id-v2',
    sourceCandidateId,
    ordinal,
  })
}
