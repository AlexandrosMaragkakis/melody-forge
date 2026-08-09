import {
  assertActiveProjectMetadataV2,
  assertStoredProjectGraphV2,
  assertStoredProjectRecordV2,
  assertV1MigrationReceiptV2,
  compareUnicodeCodePoints,
  type ActiveProjectMetadataV2,
  type StoredProjectGraphV2,
  type StoredProjectRecordV2,
  type V1MigrationReceiptV2,
} from '../../domain/v2'
import type {
  IndexedDbRowReaderV2,
  RegisteredM2PersistenceBoundaryV2,
} from './indexedDbAuthority'
import type {
  Schema2ProjectTableStoreName,
  Schema2StoreName,
} from './indexedDbSchema'

const PROJECT_OWNED_STORES = [
  'createStates',
  'modeStates',
  'historyGraphs',
  'historyNodes',
  'snapshots',
  'preferenceRecords',
  'ratings',
  'annotations',
  'undoStates',
  'migrationReceipts',
] as const satisfies readonly Schema2ProjectTableStoreName[]

function dataField(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor !== undefined && 'value' in descriptor
    ? descriptor.value
    : undefined
}

function stringField(value: unknown, key: string): string | null {
  const field = dataField(value, key)
  return typeof field === 'string' && field.length > 0 ? field : null
}

function stringArrayField(value: unknown, key: string): readonly string[] {
  const field = dataField(value, key)
  if (!Array.isArray(field)) return []
  const values: string[] = []
  for (let index = 0; index < field.length; index += 1) {
    if (!Object.hasOwn(field, index)) continue
    const entry: unknown = (field as readonly unknown[])[index]
    if (typeof entry === 'string' && entry.length > 0) values.push(entry)
  }
  return values
}

function objectArrayField(value: unknown, key: string): readonly unknown[] {
  const field = dataField(value, key)
  if (!Array.isArray(field)) return []
  const values: unknown[] = []
  for (let index = 0; index < field.length; index += 1) {
    if (Object.hasOwn(field, index)) values.push(field[index])
  }
  return values
}

function idSorted(values: readonly unknown[]): readonly unknown[] {
  return [...values].sort((left, right) => {
    const leftId = stringField(left, 'id') ?? ''
    const rightId = stringField(right, 'id') ?? ''
    return compareUnicodeCodePoints(leftId, rightId)
  })
}

function addString(target: Set<string>, value: string | null): void {
  if (value !== null) target.add(value)
}

function addStrings(target: Set<string>, values: readonly string[]): void {
  values.forEach((value) => target.add(value))
}

function sortedIds(ids: ReadonlySet<string>): readonly string[] {
  return [...ids].sort(compareUnicodeCodePoints)
}

async function loadRowsById(
  reader: IndexedDbRowReaderV2,
  storeName: Schema2StoreName,
  ids: ReadonlySet<string>,
): Promise<readonly unknown[]> {
  const values = await Promise.all(
    sortedIds(ids).map((id) => reader.get(storeName, id)),
  )
  return idSorted(values.filter((value) => value !== null))
}

async function loadProjectOwnedRows(
  reader: IndexedDbRowReaderV2,
  storeName: (typeof PROJECT_OWNED_STORES)[number],
  projectId: string,
): Promise<readonly unknown[]> {
  const rows = await reader.getAll(storeName)
  return idSorted(
    rows.filter((row) => stringField(row, 'projectId') === projectId),
  )
}

function addModeCandidateReferences(
  candidateIds: Set<string>,
  modeStates: readonly unknown[],
): void {
  modeStates.forEach((modeState) => {
    const payload = dataField(modeState, 'payload')
    addStrings(candidateIds, stringArrayField(payload, 'populationCandidateIds'))
    addStrings(candidateIds, stringArrayField(payload, 'parentCandidateIds'))
  })
}

function addSnapshotCandidateReferences(
  candidateIds: Set<string>,
  snapshots: readonly unknown[],
): void {
  snapshots.forEach((snapshot) => {
    addStrings(candidateIds, stringArrayField(snapshot, 'candidateIds'))
    addStrings(candidateIds, stringArrayField(snapshot, 'selectedCandidateIds'))
  })
}

function addMetadataTargetReferences(
  candidateIds: Set<string>,
  pairingIds: Set<string>,
  rows: readonly unknown[],
): void {
  rows.forEach((row) => {
    const targetId = stringField(row, 'targetId')
    if (targetId === null) return
    const kind = dataField(row, 'targetKind')
    if (kind === 'melody-candidate') candidateIds.add(targetId)
    if (kind === 'pairing') pairingIds.add(targetId)
  })
}

function addReceiptReferences(
  candidateIds: Set<string>,
  genomeIds: Set<string>,
  timingProfileIds: Set<string>,
  tonalTimelineIds: Set<string>,
  pairingIds: Set<string>,
  performanceIds: Set<string>,
  receipts: readonly unknown[],
): void {
  receipts.forEach((receipt) => {
    objectArrayField(receipt, 'candidateMappings').forEach((mapping) => {
      addString(candidateIds, stringField(mapping, 'sourceCandidateId'))
      addString(genomeIds, stringField(mapping, 'melodyGenomeId'))
      addString(timingProfileIds, stringField(mapping, 'timingProfileId'))
      addString(tonalTimelineIds, stringField(mapping, 'tonalTimelineId'))
      addString(pairingIds, stringField(mapping, 'pairingId'))
      addString(
        performanceIds,
        stringField(mapping, 'compatibilityPerformanceId'),
      )
    })
  })
}

function addTimingReference(
  transportIds: Set<string>,
  timingProfileIds: Set<string>,
  value: unknown,
): void {
  if (dataField(value, 'kind') === 'canonical-transport') {
    addString(transportIds, stringField(value, 'transportId'))
  }
  if (dataField(value, 'kind') === 'v1-compatibility') {
    addString(timingProfileIds, stringField(value, 'timingProfileId'))
  }
}

/**
 * Reconstructs exactly one registered M2 project closure. Project-owned rows
 * are discovered by ownership; globally reusable rows are fetched only from
 * strong references reachable from that project.
 */
export async function loadRegisteredM2ProjectGraphV2(
  reader: IndexedDbRowReaderV2,
  projectId: string,
): Promise<unknown> {
  const recordValue = await reader.get('projects', projectId)
  if (recordValue === null) return null
  assertStoredProjectRecordV2(recordValue)
  const record: StoredProjectRecordV2 = recordValue
  if (record.id !== projectId) {
    throw new TypeError('projects key must equal the embedded project ID')
  }

  const ownedEntries = await Promise.all(
    PROJECT_OWNED_STORES.map(async (storeName) => [
      storeName,
      await loadProjectOwnedRows(reader, storeName, projectId),
    ] as const),
  )
  const owned = Object.fromEntries(ownedEntries) as Record<
    (typeof PROJECT_OWNED_STORES)[number],
    readonly unknown[]
  >

  const candidateIds = new Set<string>([
    ...record.project.selectedMelodyCandidateIds,
  ])
  addString(candidateIds, record.project.focusedMelodyCandidateId)
  addModeCandidateReferences(candidateIds, owned.modeStates)
  addSnapshotCandidateReferences(candidateIds, owned.snapshots)

  const pairingIds = new Set<string>()
  addString(pairingIds, record.project.activePairingId)
  addMetadataTargetReferences(
    candidateIds,
    pairingIds,
    [...owned.ratings, ...owned.annotations],
  )

  const libraryIds = new Set(record.project.libraryItemIds)
  const libraryItems = await loadRowsById(reader, 'libraryItems', libraryIds)
  libraryItems.forEach((item) => {
    const componentId = stringField(item, 'componentId')
    if (componentId === null) return
    const kind = dataField(item, 'kind')
    if (kind === 'melody-candidate') candidateIds.add(componentId)
    if (kind === 'pairing') pairingIds.add(componentId)
  })

  const genomeIds = new Set<string>()
  const timingProfileIds = new Set<string>()
  const tonalTimelineIds = new Set<string>()
  const performanceIds = new Set<string>([record.project.activePerformanceId])
  const transportIds = new Set<string>()
  addString(transportIds, record.project.comparisonTransportId)
  addTimingReference(
    transportIds,
    timingProfileIds,
    record.project.auditionTiming,
  )
  addReceiptReferences(
    candidateIds,
    genomeIds,
    timingProfileIds,
    tonalTimelineIds,
    pairingIds,
    performanceIds,
    owned.migrationReceipts,
  )

  const pairings = await loadRowsById(reader, 'pairings', pairingIds)
  pairings.forEach((pairing) => {
    addString(candidateIds, stringField(pairing, 'melodyCandidateId'))
    addString(performanceIds, stringField(pairing, 'performanceId'))
    addTimingReference(
      transportIds,
      timingProfileIds,
      dataField(pairing, 'timing'),
    )
  })

  const melodyCandidates = await loadRowsById(
    reader,
    'melodyCandidates',
    candidateIds,
  )
  melodyCandidates.forEach((candidate) => {
    addString(genomeIds, stringField(candidate, 'melodyGenomeId'))
  })
  const melodyGenomes = await loadRowsById(reader, 'melodyGenomes', genomeIds)
  melodyGenomes.forEach((genome) => {
    addString(tonalTimelineIds, stringField(genome, 'tonalTimelineId'))
    addTimingReference(
      transportIds,
      timingProfileIds,
      dataField(genome, 'timing'),
    )
  })

  const [transports, v1TimingProfiles, tonalTimelines, performanceSettings] =
    await Promise.all([
      loadRowsById(reader, 'transports', transportIds),
      loadRowsById(reader, 'v1TimingProfiles', timingProfileIds),
      loadRowsById(reader, 'tonalTimelines', tonalTimelineIds),
      loadRowsById(reader, 'performanceSettings', performanceIds),
    ])

  return {
    record,
    tables: {
      createStates: owned.createStates,
      modeStates: owned.modeStates,
      historyGraphs: owned.historyGraphs,
      historyNodes: owned.historyNodes,
      snapshots: owned.snapshots,
      melodyCandidates,
      melodyGenomes,
      transports,
      v1TimingProfiles,
      tonalTimelines,
      customScales: [],
      beats: [],
      performanceSettings,
      pairings,
      preferenceRecords: owned.preferenceRecords,
      libraryItems,
      ratings: owned.ratings,
      annotations: owned.annotations,
      undoStates: owned.undoStates,
      migrationReceipts: owned.migrationReceipts,
    },
  }
}

export const REGISTERED_M2_PERSISTENCE_BOUNDARY_V2:
  RegisteredM2PersistenceBoundaryV2 = {
    decodeGraph(value): StoredProjectGraphV2 {
      assertStoredProjectGraphV2(value)
      return value
    },
    loadGraph: loadRegisteredM2ProjectGraphV2,
    decodeActiveMetadata(value): ActiveProjectMetadataV2 {
      assertActiveProjectMetadataV2(value)
      return value
    },
    decodeMigrationReceipt(value): V1MigrationReceiptV2 {
      assertV1MigrationReceiptV2(value)
      return value
    },
  }
