import { assertCandidateTimingRefV2 } from './melody'
import { assertAlgorithmVersionRegistryV2 } from './registry'
import type { ProjectV2, StoredProjectRecordV2 } from './types'
import {
  booleanValue,
  boundedUnicodeString,
  enumValue,
  exactPlainObject,
  failSchemaV2,
  literalValue,
  nonEmptyString,
  nullableEpochMilliseconds,
  nullableNonEmptyString,
  safeInteger,
  sortedUniqueStringArray,
  uniqueStringArray,
} from './validation'

export function assertProjectV2(value: unknown): asserts value is ProjectV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'schemaVersion',
      'name',
      'rootSeed',
      'algorithmVersions',
      'createdAtEpochMs',
      'updatedAtEpochMs',
      'destination',
      'activeEvolutionMode',
      'activeExploreMode',
      'comparisonTransportId',
      'auditionTiming',
      'activePerformanceId',
      'sharedBeatId',
      'activePairingId',
      'loopEnabled',
      'accompanimentMuted',
      'focusedMelodyCandidateId',
      'selectedMelodyCandidateIds',
      'createStateId',
      'modeStateIds',
      'historyGraphId',
      'undoStateId',
      'nextPreferenceOccurrence',
      'preferenceRecordIds',
      'activePreferenceRecordIds',
      'ratingIds',
      'annotationIds',
      'libraryItemIds',
      'migrationReceiptIds',
    ],
    'project',
  )
  nonEmptyString(record.id, 'project.id')
  literalValue(record.version, 'project-v2', 'project.version')
  literalValue(record.schemaVersion, 2, 'project.schemaVersion')
  boundedUnicodeString(record.name, 80, 'project.name')
  nonEmptyString(record.rootSeed, 'project.rootSeed')
  assertAlgorithmVersionRegistryV2(record.algorithmVersions)
  nullableEpochMilliseconds(record.createdAtEpochMs, 'project.createdAtEpochMs')
  nullableEpochMilliseconds(record.updatedAtEpochMs, 'project.updatedAtEpochMs')
  enumValue(
    record.destination,
    ['create', 'evolve', 'explore', 'library'] as const,
    'project.destination',
  )
  enumValue(
    record.activeEvolutionMode,
    ['breed', 'drift', 'islands', 'pair-lab'] as const,
    'project.activeEvolutionMode',
  )
  enumValue(
    record.activeExploreMode,
    ['map', 'pareto'] as const,
    'project.activeExploreMode',
  )
  const comparisonTransportId = nullableNonEmptyString(
    record.comparisonTransportId,
    'project.comparisonTransportId',
  )
  if (record.auditionTiming !== null) {
    const auditionTiming = record.auditionTiming
    assertCandidateTimingRefV2(auditionTiming, 'project.auditionTiming')
    if (
      auditionTiming.kind === 'canonical-transport' &&
      auditionTiming.transportId !== comparisonTransportId
    ) {
      failSchemaV2(
        'unresolved-reference',
        'project.auditionTiming.transportId',
        'canonical audition timing must equal comparisonTransportId',
      )
    }
  }
  nonEmptyString(record.activePerformanceId, 'project.activePerformanceId')
  nullableNonEmptyString(record.sharedBeatId, 'project.sharedBeatId')
  nullableNonEmptyString(record.activePairingId, 'project.activePairingId')
  booleanValue(record.loopEnabled, 'project.loopEnabled')
  booleanValue(record.accompanimentMuted, 'project.accompanimentMuted')
  nullableNonEmptyString(
    record.focusedMelodyCandidateId,
    'project.focusedMelodyCandidateId',
  )
  sortedUniqueStringArray(
    record.selectedMelodyCandidateIds,
    'project.selectedMelodyCandidateIds',
  )
  nonEmptyString(record.createStateId, 'project.createStateId')
  const modeStateIds = exactPlainObject(
    record.modeStateIds,
    ['breed', 'drift', 'islands', 'map', 'pareto', 'pairLab'],
    'project.modeStateIds',
  )
  ;['breed', 'drift', 'islands', 'map', 'pareto', 'pairLab'].forEach((mode) => {
    nonEmptyString(modeStateIds[mode], `project.modeStateIds.${mode}`)
  })
  nonEmptyString(record.historyGraphId, 'project.historyGraphId')
  nonEmptyString(record.undoStateId, 'project.undoStateId')
  safeInteger(
    record.nextPreferenceOccurrence,
    'project.nextPreferenceOccurrence',
    0,
  )
  const preferenceRecordIds = uniqueStringArray(
    record.preferenceRecordIds,
    'project.preferenceRecordIds',
  )
  const activePreferenceRecordIds = sortedUniqueStringArray(
    record.activePreferenceRecordIds,
    'project.activePreferenceRecordIds',
  )
  const preferenceSet = new Set(preferenceRecordIds)
  activePreferenceRecordIds.forEach((id, index) => {
    if (!preferenceSet.has(id)) {
      failSchemaV2(
        'unresolved-reference',
        `project.activePreferenceRecordIds[${String(index)}]`,
        'must be a preferenceRecordIds member',
      )
    }
  })
  sortedUniqueStringArray(record.ratingIds, 'project.ratingIds')
  sortedUniqueStringArray(record.annotationIds, 'project.annotationIds')
  uniqueStringArray(record.libraryItemIds, 'project.libraryItemIds')
  sortedUniqueStringArray(record.migrationReceiptIds, 'project.migrationReceiptIds')
}

export function assertStoredProjectRecordV2(
  value: unknown,
): asserts value is StoredProjectRecordV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'revision', 'project'],
    'storedProjectRecord',
  )
  const id = nonEmptyString(record.id, 'storedProjectRecord.id')
  literalValue(
    record.version,
    'stored-project-record-v2',
    'storedProjectRecord.version',
  )
  safeInteger(record.revision, 'storedProjectRecord.revision', 1)
  assertProjectV2(record.project)
  if (record.project.id !== id) {
    failSchemaV2(
      'invalid-identity',
      'storedProjectRecord.id',
      'must equal project.id',
    )
  }
}
