import { SCALE_CATALOGUE } from '../scales'
import {
  assertValidTransportSpec,
  assertValidV1CompatibilityTimingProfile,
} from '../transport'
import type { TransportSpec } from '../transport/types'
import type { V1CompatibilityTimingProfile } from '../transport/compatibility'
import {
  auditionPairingIdV2,
  tonalSegmentIdV2,
  tonalTimelineIdV2,
  v1MigrationReceiptIdV2,
} from './identities'
import { assertCandidateTimingRefV2 } from './melody'
import { V1_COMPATIBILITY_PERFORMANCE_V2 } from './performance'
import type {
  ActiveProjectMetadataV2,
  AuditionPairingV2,
  TonalSegmentV2,
  TonalTimelineV2,
  V1MigrationReceiptV2,
} from './types'
import {
  compareUnicodeCodePoints,
  denseArray,
  enumValue,
  exactPlainObject,
  failSchemaV2,
  literalValue,
  lowercaseSha256,
  nonEmptyString,
  nullValue,
  nullableEpochMilliseconds,
  nullableNonEmptyString,
  safeInteger,
  stringValue,
} from './validation'

const CATALOGUE_SCALE_IDS = new Set(
  SCALE_CATALOGUE.map(({ id }) => id as string),
)

function assertCatalogueScaleRef(
  value: unknown,
  path: string,
): TonalSegmentV2['scale'] {
  const record = exactPlainObject(value, ['kind', 'scaleId'], path)
  literalValue(record.kind, 'catalogue', `${path}.kind`)
  const scaleId = nonEmptyString(record.scaleId, `${path}.scaleId`)
  if (!CATALOGUE_SCALE_IDS.has(scaleId)) {
    failSchemaV2(
      'invalid-value',
      `${path}.scaleId`,
      'M2 migrated timelines require a canonical catalogue scale ID',
    )
  }
  return { kind: 'catalogue', scaleId }
}

function assertTonalSegment(
  value: unknown,
  path: string,
): TonalSegmentV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'startTick',
      'endTick',
      'tonicPitchClass',
      'tonicMidi',
      'scale',
      'borrowingPolicyId',
    ],
    path,
  )
  const startTick = safeInteger(record.startTick, `${path}.startTick`, 0)
  const endTick = safeInteger(record.endTick, `${path}.endTick`, 1)
  if (endTick <= startTick) {
    failSchemaV2(
      'invalid-value',
      `${path}.endTick`,
      'must be greater than startTick',
    )
  }
  nullValue(record.borrowingPolicyId, `${path}.borrowingPolicyId`)
  const withoutId = {
    startTick,
    endTick,
    tonicPitchClass: safeInteger(
      record.tonicPitchClass,
      `${path}.tonicPitchClass`,
      0,
      11,
    ),
    tonicMidi: safeInteger(record.tonicMidi, `${path}.tonicMidi`, 0, 127),
    scale: assertCatalogueScaleRef(record.scale, `${path}.scale`),
    borrowingPolicyId: null,
  } as const
  const id = nonEmptyString(record.id, `${path}.id`)
  const expectedId = tonalSegmentIdV2(withoutId)
  if (id !== expectedId) {
    failSchemaV2('invalid-identity', `${path}.id`, `must equal ${expectedId}`)
  }
  return { id, ...withoutId }
}

export function assertTonalTimelineV2(
  value: unknown,
): asserts value is TonalTimelineV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'segments'],
    'tonalTimeline',
  )
  const segments = denseArray(record.segments, 'tonalTimeline.segments').map(
    (segment, index) =>
      assertTonalSegment(segment, `tonalTimeline.segments[${String(index)}]`),
  )
  if (segments.length !== 1 || segments[0]!.startTick !== 0) {
    failSchemaV2(
      'unregistered-version',
      'tonalTimeline.segments',
      'M2 accepts one full-coverage migrated catalogue segment starting at zero',
    )
  }
  const withoutId = {
    version: literalValue(
      record.version,
      'tonal-timeline-v2',
      'tonalTimeline.version',
    ),
    segments,
  } as const
  const id = nonEmptyString(record.id, 'tonalTimeline.id')
  const expectedId = tonalTimelineIdV2(withoutId)
  if (id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'tonalTimeline.id',
      `must equal ${expectedId}`,
    )
  }
}

export function assertAuditionPairingV2(
  value: unknown,
): asserts value is AuditionPairingV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'melodyCandidateId', 'beatId', 'timing', 'performanceId'],
    'pairing',
  )
  assertCandidateTimingRefV2(record.timing, 'pairing.timing')
  if (record.timing.kind !== 'v1-compatibility') {
    failSchemaV2(
      'unregistered-version',
      'pairing.timing.kind',
      'M2 registers compatibility pairings only',
    )
  }
  nullValue(record.beatId, 'pairing.beatId')
  literalValue(
    record.performanceId,
    V1_COMPATIBILITY_PERFORMANCE_V2.id,
    'pairing.performanceId',
  )
  const withoutId: Omit<AuditionPairingV2, 'id'> = {
    version: literalValue(
      record.version,
      'audition-pairing-v2',
      'pairing.version',
    ),
    melodyCandidateId: nonEmptyString(
      record.melodyCandidateId,
      'pairing.melodyCandidateId',
    ),
    beatId: null,
    timing: record.timing,
    performanceId: V1_COMPATIBILITY_PERFORMANCE_V2.id,
  }
  const expectedId = auditionPairingIdV2(withoutId)
  if (record.id !== expectedId) {
    failSchemaV2('invalid-identity', 'pairing.id', `must equal ${expectedId}`)
  }
}

export function assertActiveProjectMetadataV2(
  value: unknown,
): asserts value is ActiveProjectMetadataV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'projectId', 'revision'],
    'activeProjectMetadata',
  )
  literalValue(record.id, 'active-project', 'activeProjectMetadata.id')
  literalValue(
    record.version,
    'active-project-metadata-v2',
    'activeProjectMetadata.version',
  )
  nonEmptyString(record.projectId, 'activeProjectMetadata.projectId')
  safeInteger(record.revision, 'activeProjectMetadata.revision', 1)
}

export function assertV1MigrationReceiptV2(
  value: unknown,
): asserts value is V1MigrationReceiptV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'migrationVersion',
      'sourceKind',
      'sourceHash',
      'projectId',
      'stagedRevision',
      'status',
      'candidateMappings',
      'snapshotMappings',
      'createdAtEpochMs',
      'verifiedAtEpochMs',
    ],
    'migrationReceipt',
  )
  const version = literalValue(
    record.version,
    'v1-migration-receipt-v2',
    'migrationReceipt.version',
  )
  const migrationVersion = literalValue(
    record.migrationVersion,
    'v1-project-migration-v2.0.0',
    'migrationReceipt.migrationVersion',
  )
  enumValue(
    record.sourceKind,
    ['local-storage-project-v1', 'project-envelope-v1'] as const,
    'migrationReceipt.sourceKind',
  )
  const sourceHash = lowercaseSha256(
    record.sourceHash,
    'migrationReceipt.sourceHash',
  )
  const projectId = nonEmptyString(record.projectId, 'migrationReceipt.projectId')
  safeInteger(record.stagedRevision, 'migrationReceipt.stagedRevision', 1)
  enumValue(
    record.status,
    ['pending-readback', 'verified'] as const,
    'migrationReceipt.status',
  )
  const candidateMappings = denseArray(
    record.candidateMappings,
    'migrationReceipt.candidateMappings',
  ).map((mapping, index) => {
    const path = `migrationReceipt.candidateMappings[${String(index)}]`
    const entry = exactPlainObject(
      mapping,
      [
        'sourceCandidateId',
        'melodyGenomeId',
        'timingProfileId',
        'tonalTimelineId',
        'pairingId',
        'compatibilityPerformanceId',
      ],
      path,
    )
    return {
      sourceCandidateId: nonEmptyString(
        entry.sourceCandidateId,
        `${path}.sourceCandidateId`,
      ),
      melodyGenomeId: nonEmptyString(entry.melodyGenomeId, `${path}.melodyGenomeId`),
      timingProfileId: nonEmptyString(
        entry.timingProfileId,
        `${path}.timingProfileId`,
      ),
      tonalTimelineId: nonEmptyString(
        entry.tonalTimelineId,
        `${path}.tonalTimelineId`,
      ),
      pairingId: nonEmptyString(entry.pairingId, `${path}.pairingId`),
      compatibilityPerformanceId: literalValue(
        entry.compatibilityPerformanceId,
        V1_COMPATIBILITY_PERFORMANCE_V2.id,
        `${path}.compatibilityPerformanceId`,
      ),
    }
  })
  if (
    new Set(candidateMappings.map(({ sourceCandidateId }) => sourceCandidateId))
      .size !== candidateMappings.length
  ) {
    failSchemaV2(
      'duplicate-value',
      'migrationReceipt.candidateMappings',
      'each source candidate must be mapped exactly once',
    )
  }
  const snapshotMappings = denseArray(
    record.snapshotMappings,
    'migrationReceipt.snapshotMappings',
  ).map((mapping, index) => {
    const path = `migrationReceipt.snapshotMappings[${String(index)}]`
    const entry = exactPlainObject(
      mapping,
      ['sourceHistoryOrdinal', 'sourceSnapshotId', 'historyNodeId'],
      path,
    )
    const sourceHistoryOrdinal = safeInteger(
      entry.sourceHistoryOrdinal,
      `${path}.sourceHistoryOrdinal`,
      0,
    )
    if (sourceHistoryOrdinal !== index) {
      failSchemaV2(
        'invalid-order',
        `${path}.sourceHistoryOrdinal`,
        'snapshot mappings must be source-ordinal sorted and contiguous',
      )
    }
    return {
      sourceHistoryOrdinal,
      sourceSnapshotId: stringValue(
        entry.sourceSnapshotId,
        `${path}.sourceSnapshotId`,
      ),
      historyNodeId: nonEmptyString(entry.historyNodeId, `${path}.historyNodeId`),
    }
  })
  nullableEpochMilliseconds(record.createdAtEpochMs, 'migrationReceipt.createdAtEpochMs')
  nullableEpochMilliseconds(record.verifiedAtEpochMs, 'migrationReceipt.verifiedAtEpochMs')
  if (record.createdAtEpochMs !== null || record.verifiedAtEpochMs !== null) {
    failSchemaV2(
      'invalid-value',
      'migrationReceipt',
      'M2 migration receipts preserve both absent source timestamps as null',
    )
  }
  const expectedId = v1MigrationReceiptIdV2({
    version,
    migrationVersion,
    sourceHash,
    projectId,
  })
  if (record.id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'migrationReceipt.id',
      `must equal ${expectedId}`,
    )
  }
  void snapshotMappings
}

export function assertExactTransportRowV2(value: unknown): asserts value is TransportSpec {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'ppq',
      'tempoBpm',
      'meter',
      'gridTicks',
      'loopStartTick',
      'loopEndTick',
      'swing',
      'meterSource',
    ],
    'transport',
  )
  exactPlainObject(record.meter, ['numerator', 'denominator', 'beatGroups'], 'transport.meter')
  exactPlainObject(record.swing, ['subdivisionTicks', 'amountPermille'], 'transport.swing')
  assertValidTransportSpec(value)
}

export function assertExactV1TimingProfileRowV2(
  value: unknown,
): asserts value is V1CompatibilityTimingProfile {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'sourceCandidateId',
      'sourceTicksPerBeat',
      'sourceGridTicks',
      'tempoBpm',
      'displayMeter',
      'gridTicks',
      'loopStartTick',
      'loopEndTick',
      'swing',
    ],
    'v1TimingProfile',
  )
  exactPlainObject(
    record.displayMeter,
    ['numerator', 'denominator', 'beatGroups'],
    'v1TimingProfile.displayMeter',
  )
  exactPlainObject(
    record.swing,
    ['subdivisionTicks', 'amountPermille'],
    'v1TimingProfile.swing',
  )
  assertValidV1CompatibilityTimingProfile(value)
}

export function assertRowsStrictlyIdSortedV2(
  rows: readonly { readonly id: string }[],
  path: string,
): void {
  rows.forEach((row, index) => {
    if (index === 0) return
    const comparison = compareUnicodeCodePoints(rows[index - 1]!.id, row.id)
    if (comparison >= 0) {
      failSchemaV2(
        comparison === 0 ? 'duplicate-value' : 'invalid-order',
        `${path}[${String(index)}].id`,
        'entity rows must be duplicate-free and ID-sorted',
      )
    }
  })
}

export function nullableEvidenceIdV2(value: unknown, path: string): string | null {
  return nullableNonEmptyString(value, path)
}
