import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { stableId } from '../../domain/identity'
import {
  assertLibraryItemV2,
  createLibraryItemV2,
} from '../../domain/v2/library'
import type {
  ActiveProjectMetadataV2,
  LibraryItemV2,
  M2ProjectEntityArrayTablesV2,
  StoredProjectGraphV2,
  V1MigrationReceiptV2,
} from '../../domain/v2/types'
import {
  ACTIVE_PROJECT_METADATA_ID,
  NativeIndexedDbAuthorityV2,
  type IndexedDbFailurePointV2,
  type IndexedDbRowReaderV2,
  type RegisteredM2PersistenceBoundaryV2,
} from './indexedDbAuthority'
import {
  SCHEMA_2_DATABASE_NAME,
  SCHEMA_2_DATABASE_VERSION,
  SCHEMA_2_PROJECT_TABLE_STORE_NAMES,
  SCHEMA_2_STORE_NAMES,
} from './indexedDbSchema'

const PROJECT_OWNED_STORES = new Set<string>([
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
])

const ACTIVE_KEYS = ['id', 'version', 'projectId', 'revision']
const RECEIPT_KEYS = [
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
]

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  if (JSON.stringify(Object.keys(value)) !== JSON.stringify(expected)) {
    throw new TypeError(`${label} has unexpected keys`)
  }
}

function decodeTestGraph(value: unknown): StoredProjectGraphV2 {
  const graph = objectRecord(value, 'graph')
  exactKeys(graph, ['record', 'tables'], 'graph')
  const record = objectRecord(graph.record, 'record')
  exactKeys(record, ['id', 'version', 'revision', 'project'], 'record')
  if (
    typeof record.id !== 'string' ||
    record.version !== 'stored-project-record-v2' ||
    !Number.isSafeInteger(record.revision) ||
    Number(record.revision) < 1
  ) {
    throw new TypeError('invalid stored project record')
  }
  const tables = objectRecord(graph.tables, 'tables')
  exactKeys(tables, SCHEMA_2_PROJECT_TABLE_STORE_NAMES, 'tables')
  for (const tableName of SCHEMA_2_PROJECT_TABLE_STORE_NAMES) {
    if (!Array.isArray(tables[tableName])) {
      throw new TypeError(`${tableName} must be an array`)
    }
  }
  return value as StoredProjectGraphV2
}

function decodeTestActive(value: unknown): ActiveProjectMetadataV2 {
  const record = objectRecord(value, 'active metadata')
  exactKeys(record, ACTIVE_KEYS, 'active metadata')
  if (
    record.id !== ACTIVE_PROJECT_METADATA_ID ||
    record.version !== 'active-project-metadata-v2' ||
    typeof record.projectId !== 'string' ||
    !Number.isSafeInteger(record.revision) ||
    Number(record.revision) < 1
  ) {
    throw new TypeError('invalid active metadata')
  }
  return value as ActiveProjectMetadataV2
}

function decodeTestReceipt(value: unknown): V1MigrationReceiptV2 {
  const record = objectRecord(value, 'receipt')
  exactKeys(record, RECEIPT_KEYS, 'receipt')
  if (
    record.version !== 'v1-migration-receipt-v2' ||
    record.migrationVersion !== 'v1-project-migration-v2.0.0' ||
    (record.sourceKind !== 'local-storage-project-v1' &&
      record.sourceKind !== 'project-envelope-v1') ||
    (record.status !== 'pending-readback' && record.status !== 'verified')
  ) {
    throw new TypeError('invalid receipt')
  }
  return value as V1MigrationReceiptV2
}

function rowProjectId(value: unknown): string | null {
  const row = objectRecord(value, 'row')
  return typeof row.projectId === 'string' ? row.projectId : null
}

function rowId(value: unknown): string {
  const row = objectRecord(value, 'row')
  if (typeof row.id !== 'string') throw new TypeError('row id is missing')
  return row.id
}

const TEST_BOUNDARY: RegisteredM2PersistenceBoundaryV2 = {
  decodeGraph: decodeTestGraph,
  decodeActiveMetadata: decodeTestActive,
  decodeMigrationReceipt: decodeTestReceipt,
  async loadGraph(
    reader: IndexedDbRowReaderV2,
    projectId: string,
  ): Promise<unknown> {
    const recordValue = await reader.get('projects', projectId)
    if (recordValue === null) return null
    const record = objectRecord(recordValue, 'stored project')
    const project = objectRecord(record.project, 'project')
    const libraryItemIds = Array.isArray(project.libraryItemIds)
      ? new Set(project.libraryItemIds.filter((id): id is string => typeof id === 'string'))
      : new Set<string>()
    const tables: Record<string, readonly unknown[]> = {}
    for (const tableName of SCHEMA_2_PROJECT_TABLE_STORE_NAMES) {
      const rows = await reader.getAll(tableName)
      if (PROJECT_OWNED_STORES.has(tableName)) {
        tables[tableName] = rows.filter(
          (row) => rowProjectId(row) === projectId,
        )
      } else if (tableName === 'libraryItems') {
        tables[tableName] = rows.filter((row) => libraryItemIds.has(rowId(row)))
      } else {
        tables[tableName] = []
      }
    }
    return { record: recordValue, tables }
  },
}

interface TestGraphOptions {
  readonly createId?: string
  readonly createValue?: string
  readonly historyNodes?: readonly Readonly<Record<string, unknown>>[]
  readonly libraryItems?: readonly LibraryItemV2[]
  readonly ratings?: readonly Readonly<Record<string, unknown>>[]
  readonly annotations?: readonly Readonly<Record<string, unknown>>[]
  readonly migrationReceipts?: readonly V1MigrationReceiptV2[]
}

function makeGraph(
  projectId: string,
  revision: number,
  options: TestGraphOptions = {},
): StoredProjectGraphV2 {
  const createState = {
    id: options.createId ?? `create-${projectId}`,
    version: 'test-create-state-v2',
    projectId,
    value: options.createValue ?? 'initial',
  }
  const tables = {
    createStates: [createState],
    modeStates: [],
    historyGraphs: [],
    historyNodes: options.historyNodes ?? [],
    snapshots: [],
    melodyCandidates: [],
    melodyGenomes: [],
    transports: [],
    v1TimingProfiles: [],
    tonalTimelines: [],
    customScales: [],
    beats: [],
    performanceSettings: [],
    pairings: [],
    preferenceRecords: [],
    libraryItems: options.libraryItems ?? [],
    ratings: options.ratings ?? [],
    annotations: options.annotations ?? [],
    undoStates: [],
    migrationReceipts: options.migrationReceipts ?? [],
  } satisfies Record<keyof M2ProjectEntityArrayTablesV2, readonly unknown[]>
  return {
    record: {
      id: projectId,
      version: 'stored-project-record-v2',
      revision,
      project: {
        id: projectId,
        algorithmVersions: {
          foundations: { v1Migration: 'v1-project-migration-v2.0.0' },
        },
        libraryItemIds: (options.libraryItems ?? []).map(({ id }) => id),
      },
    },
    tables,
  } as unknown as StoredProjectGraphV2
}

function projectActive(
  projectId: string,
  revision: number,
): ActiveProjectMetadataV2 {
  return {
    id: 'active-project',
    version: 'active-project-metadata-v2',
    projectId,
    revision,
  }
}

function migrationReceipt(
  projectId: string,
  sourceHash: string,
): V1MigrationReceiptV2 {
  const identity = {
    version: 'v1-migration-receipt-v2' as const,
    migrationVersion: 'v1-project-migration-v2.0.0' as const,
    sourceHash,
    projectId,
  }
  return {
    id: stableId('migration-receipt', identity),
    version: identity.version,
    migrationVersion: identity.migrationVersion,
    sourceKind: 'local-storage-project-v1',
    sourceHash,
    projectId,
    stagedRevision: 1,
    status: 'pending-readback',
    candidateMappings: [],
    snapshotMappings: [],
    createdAtEpochMs: null,
    verifiedAtEpochMs: null,
  }
}

function libraryItem(
  projectId: string,
  componentId: string,
  sourceId: string,
): LibraryItemV2 {
  return createLibraryItemV2({
    kind: 'melody-candidate',
    componentId,
    origin: {
      kind: 'project-save',
      projectId,
      historyNodeId: null,
      sourceHash: null,
      sourceId,
    },
    initialization: 'save',
    metadataClock: () => 100,
  })
}

function rawOpen(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(SCHEMA_2_DATABASE_NAME)
    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    })
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('database open failed')),
      {
      once: true,
      },
    )
  })
}

async function rawGet(
  factory: IDBFactory,
  storeName: (typeof SCHEMA_2_STORE_NAMES)[number],
  id: string,
): Promise<unknown> {
  const database = await rawOpen(factory)
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(storeName, 'readonly')
        .objectStore(storeName)
        .get(id)
      request.addEventListener('success', () => resolve(request.result), {
        once: true,
      })
      request.addEventListener(
        'error',
        () => reject(request.error ?? new Error('database read failed')),
        { once: true },
      )
    })
  } finally {
    database.close()
  }
}

function authority(
  factory: IDBFactory,
  injectFailure?: (point: IndexedDbFailurePointV2) => void,
): NativeIndexedDbAuthorityV2 {
  return new NativeIndexedDbAuthorityV2({
    indexedDb: factory,
    boundary: TEST_BOUNDARY,
    ...(injectFailure === undefined
      ? {}
      : { injectFailure: ({ point }) => injectFailure(point) }),
  })
}

describe('schema-2 IndexedDB authority', () => {
  it('creates exactly the 22 embedded-key stores and unique receipt index', async () => {
    const factory = new IDBFactory()
    const store = authority(factory)
    await store.open()
    const database = await rawOpen(factory)
    try {
      expect(SCHEMA_2_STORE_NAMES).toEqual([
        'projects',
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
        'appMetadata',
      ])
      expect(database.version).toBe(SCHEMA_2_DATABASE_VERSION)
      expect(Array.from(database.objectStoreNames).sort()).toEqual(
        [...SCHEMA_2_STORE_NAMES].sort(),
      )
      const transaction = database.transaction(
        [...SCHEMA_2_STORE_NAMES],
        'readonly',
      )
      for (const storeName of SCHEMA_2_STORE_NAMES) {
        const objectStore = transaction.objectStore(storeName)
        expect(objectStore.keyPath).toBe('id')
        expect(objectStore.autoIncrement).toBe(false)
        if (storeName === 'migrationReceipts') {
          expect(Array.from(objectStore.indexNames)).toEqual(['sourceHash'])
          const index = objectStore.index('sourceHash')
          expect(index.keyPath).toBe('sourceHash')
          expect(index.unique).toBe(true)
          expect(index.multiEntry).toBe(false)
        } else {
          expect(objectStore.indexNames).toHaveLength(0)
        }
      }
    } finally {
      database.close()
      store.close()
    }
  })

  it('returns typed unavailable, blocked, and malformed-schema failures', async () => {
    await expect(
      new NativeIndexedDbAuthorityV2({
        indexedDb: null,
        boundary: TEST_BOUNDARY,
      }).open(),
    ).rejects.toMatchObject({ code: 'unavailable', operation: 'open' })

    const target = new EventTarget()
    const blockedFactory = {
      open: () => {
        queueMicrotask(() => target.dispatchEvent(new Event('blocked')))
        return target as unknown as IDBOpenDBRequest
      },
    } as unknown as IDBFactory
    await expect(authority(blockedFactory).open()).rejects.toMatchObject({
      code: 'blocked',
      operation: 'open',
    })

    const malformedFactory = new IDBFactory()
    await new Promise<void>((resolve, reject) => {
      const request = malformedFactory.open(
        SCHEMA_2_DATABASE_NAME,
        SCHEMA_2_DATABASE_VERSION,
      )
      request.addEventListener('upgradeneeded', () => {
        request.result.createObjectStore('projects', { keyPath: 'id' })
      })
      request.addEventListener('success', () => {
        request.result.close()
        resolve()
      })
      request.addEventListener('error', () =>
        reject(request.error ?? new Error('malformed database setup failed')),
      )
    })
    await expect(authority(malformedFactory).open()).rejects.toMatchObject({
      code: 'upgrade',
      operation: 'open',
    })
  })

  it('creates, switches, and opens projects without rewriting an opened graph', async () => {
    const factory = new IDBFactory()
    const store = authority(factory)
    const graphA = makeGraph('project-a', 1)
    const activeA = await store.installAndActivateProject({
      graph: graphA,
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    })
    expect(activeA).toEqual(projectActive('project-a', 1))
    expect(await store.loadActiveProject()).toEqual(graphA)

    const graphB = makeGraph('project-b', 1)
    const activeB = await store.installAndActivateProject({
      graph: graphB,
      expectedStoredRevision: null,
      expectedPriorActive: activeA,
      reason: 'confirmed-schema2-replace',
    })
    const rawBeforeOpen = await rawGet(factory, 'projects', 'project-a')
    await expect(
      store.activateProject({
        projectId: 'project-a',
        expectedTargetRevision: 1,
        expectedPriorActive: activeB,
      }),
    ).resolves.toEqual(activeA)
    expect(await rawGet(factory, 'projects', 'project-a')).toEqual(rawBeforeOpen)
    expect(await store.loadActiveProject()).toEqual(graphA)
  })

  it('uses revision CAS for active saves and leaves active metadata alone for inactive saves', async () => {
    const factory = new IDBFactory()
    const store = authority(factory)
    const activeA = await store.installAndActivateProject({
      graph: makeGraph('project-a', 1),
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    })
    const graphA2 = makeGraph('project-a', 2, { createValue: 'saved-a2' })
    await store.saveProject(graphA2, 1)
    expect(await rawGet(factory, 'appMetadata', ACTIVE_PROJECT_METADATA_ID)).toEqual(
      projectActive('project-a', 2),
    )
    await expect(store.saveProject(graphA2, 1)).rejects.toMatchObject({
      code: 'conflict',
    })

    const activeB = await store.installAndActivateProject({
      graph: makeGraph('project-b', 1),
      expectedStoredRevision: null,
      expectedPriorActive: projectActive(activeA.projectId, 2),
      reason: 'confirmed-schema2-replace',
    })
    await store.saveProject(
      makeGraph('project-a', 3, { createValue: 'inactive-a3' }),
      2,
    )
    expect(await rawGet(factory, 'appMetadata', ACTIVE_PROJECT_METADATA_ID)).toEqual(
      activeB,
    )
  })

  it('classifies invalid input and missing targets without mutating storage', async () => {
    const factory = new IDBFactory()
    const store = authority(factory)
    await expect(
      store.saveProject(makeGraph('project-a', 1), 0),
    ).rejects.toMatchObject({ code: 'decode', operation: 'save-project' })
    await expect(
      store.activateProject({
        projectId: 'missing-project',
        expectedTargetRevision: 1,
        expectedPriorActive: null,
      }),
    ).rejects.toMatchObject({
      code: 'not-found',
      operation: 'activate-project',
    })
    expect(await rawGet(factory, 'appMetadata', ACTIVE_PROJECT_METADATA_ID)).toBeUndefined()
  })

  it('deletes removed project metadata on normal save without deleting global rows', async () => {
    const factory = new IDBFactory()
    const store = authority(factory)
    const item = libraryItem('project-a', 'candidate-a', 'source-a')
    const rating = {
      id: 'rating-a',
      version: 'test-rating-v2',
      projectId: 'project-a',
      targetId: 'candidate-a',
      value: 5,
    }
    const annotation = {
      id: 'annotation-a',
      version: 'test-annotation-v2',
      projectId: 'project-a',
      targetId: 'candidate-a',
      text: 'remove me',
    }
    await store.installAndActivateProject({
      graph: makeGraph('project-a', 1, {
        libraryItems: [item],
        ratings: [rating],
        annotations: [annotation],
      }),
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    })

    await expect(store.saveProject(makeGraph('project-a', 2), 1)).resolves.toMatchObject({
      id: 'project-a',
      revision: 2,
    })
    expect(await rawGet(factory, 'ratings', rating.id)).toBeUndefined()
    expect(await rawGet(factory, 'annotations', annotation.id)).toBeUndefined()
    expect(await rawGet(factory, 'libraryItems', item.id)).toEqual(item)
    expect(await rawGet(factory, 'appMetadata', ACTIVE_PROJECT_METADATA_ID)).toEqual(
      projectActive('project-a', 2),
    )
  })

  it('removes obsolete project-owned rows on replacement but retains global Library rows', async () => {
    const factory = new IDBFactory()
    const store = authority(factory)
    const item = libraryItem('project-a', 'candidate-a', 'source-a')
    const oldNode = {
      id: 'old-node',
      version: 'test-history-node-v2',
      projectId: 'project-a',
      value: 'old',
    }
    const active = await store.installAndActivateProject({
      graph: makeGraph('project-a', 1, {
        createId: 'old-create',
        historyNodes: [oldNode],
        libraryItems: [item],
      }),
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    })
    await store.installAndActivateProject({
      graph: makeGraph('project-a', 2, { createId: 'new-create' }),
      expectedStoredRevision: 1,
      expectedPriorActive: active,
      reason: 'confirmed-schema2-replace',
    })

    expect(await rawGet(factory, 'createStates', 'old-create')).toBeUndefined()
    expect(await rawGet(factory, 'historyNodes', 'old-node')).toBeUndefined()
    expect(await rawGet(factory, 'createStates', 'new-create')).toBeDefined()
    expect(await rawGet(factory, 'libraryItems', item.id)).toEqual(item)
  })

  it('keeps target Library metadata and stable-unions origins across project writes', async () => {
    const factory = new IDBFactory()
    const store = authority(factory)
    const firstDefault = libraryItem('project-a', 'shared-candidate', 'source-a')
    const first: LibraryItemV2 = {
      ...firstDefault,
      name: 'My curated name',
      note: 'Keep this local note',
      favorite: true,
      savedAtEpochMs: 777,
    }
    assertLibraryItemV2(first)
    const activeA = await store.installAndActivateProject({
      graph: makeGraph('project-a', 1, { libraryItems: [first] }),
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    })
    const incoming = libraryItem(
      'project-b',
      'shared-candidate',
      'source-b',
    )
    const activeB = await store.installAndActivateProject({
      graph: makeGraph('project-b', 1, { libraryItems: [incoming] }),
      expectedStoredRevision: null,
      expectedPriorActive: activeA,
      reason: 'confirmed-schema2-replace',
    })

    const merged = (await rawGet(factory, 'libraryItems', first.id)) as LibraryItemV2
    expect(merged).toMatchObject({
      name: first.name,
      note: first.note,
      favorite: first.favorite,
      savedAtEpochMs: first.savedAtEpochMs,
    })
    expect(merged.originReferences).toHaveLength(2)

    await store.saveProject(
      makeGraph('project-a', 2, { libraryItems: [firstDefault] }),
      1,
    )
    expect(await rawGet(factory, 'appMetadata', ACTIVE_PROJECT_METADATA_ID)).toEqual(
      activeB,
    )
    const afterStaleInactiveSave = (await rawGet(
      factory,
      'libraryItems',
      first.id,
    )) as LibraryItemV2
    expect(afterStaleInactiveSave).toEqual(merged)
  })

  it('rolls back immutable collisions, quota failures, and strict read-back failures', async () => {
    const factory = new IDBFactory()
    let failurePoint: IndexedDbFailurePointV2 | null = null
    const store = authority(factory, (point) => {
      if (point !== failurePoint) return
      if (point === 'before-active-metadata-write') {
        throw new DOMException('test quota', 'QuotaExceededError')
      }
      throw new Error('injected read-back failure')
    })
    const originalNode = {
      id: 'immutable-node',
      version: 'test-history-node-v2',
      projectId: 'project-a',
      value: 'original',
    }
    const activeA = await store.installAndActivateProject({
      graph: makeGraph('project-a', 1, { historyNodes: [originalNode] }),
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    })

    await expect(
      store.installAndActivateProject({
        graph: makeGraph('project-a', 2, {
          historyNodes: [{ ...originalNode, value: 'collision' }],
        }),
        expectedStoredRevision: 1,
        expectedPriorActive: activeA,
        reason: 'confirmed-schema2-replace',
      }),
    ).rejects.toMatchObject({ code: 'immutable-collision' })
    expect(await rawGet(factory, 'projects', 'project-a')).toMatchObject({
      revision: 1,
    })

    failurePoint = 'before-active-metadata-write'
    await expect(
      store.installAndActivateProject({
        graph: makeGraph('project-b', 1),
        expectedStoredRevision: null,
        expectedPriorActive: activeA,
        reason: 'confirmed-schema2-replace',
      }),
    ).rejects.toMatchObject({ code: 'quota' })
    expect(await rawGet(factory, 'projects', 'project-b')).toBeUndefined()
    expect(await rawGet(factory, 'appMetadata', ACTIVE_PROJECT_METADATA_ID)).toEqual(
      activeA,
    )

    failurePoint = 'before-graph-write'
    await expect(
      store.installAndActivateProject({
        graph: makeGraph('project-b', 1),
        expectedStoredRevision: null,
        expectedPriorActive: activeA,
        reason: 'confirmed-schema2-replace',
      }),
    ).rejects.toMatchObject({ code: 'abort' })
    expect(await rawGet(factory, 'projects', 'project-b')).toBeUndefined()

    failurePoint = 'before-strict-read-back'
    await expect(
      store.saveProject(
        makeGraph('project-a', 2, {
          historyNodes: [originalNode],
          createValue: 'must-roll-back',
        }),
        1,
      ),
    ).rejects.toMatchObject({ code: 'read-back' })
    expect(await rawGet(factory, 'projects', 'project-a')).toMatchObject({
      revision: 1,
    })
    expect(await rawGet(factory, 'appMetadata', ACTIVE_PROJECT_METADATA_ID)).toEqual(
      activeA,
    )
  })

  it('stages, resumes, verifies, and looks up V1 migration by unique source hash', async () => {
    const factory = new IDBFactory()
    let failurePoint: IndexedDbFailurePointV2 | null = null
    const store = authority(factory, (point) => {
      if (point === failurePoint) {
        throw new DOMException('test quota', 'QuotaExceededError')
      }
    })
    const activeA = await store.installAndActivateProject({
      graph: makeGraph('project-a', 1),
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    })
    const sourceHash = 'a'.repeat(64)
    const receipt = migrationReceipt('project-b', sourceHash)
    const stagedGraph = makeGraph('project-b', 1, {
      migrationReceipts: [receipt],
    })

    await store.stageV1Migration(stagedGraph, receipt, null)
    expect(await store.loadMigrationReceiptBySourceHash(sourceHash)).toEqual(
      receipt,
    )
    expect(await rawGet(factory, 'appMetadata', ACTIVE_PROJECT_METADATA_ID)).toEqual(
      activeA,
    )
    await expect(
      store.stageV1Migration(stagedGraph, receipt, null),
    ).resolves.toMatchObject({ id: 'project-b', revision: 1 })

    failurePoint = 'before-active-metadata-write'
    await expect(
      store.activateStagedMigration({
        receiptId: receipt.id,
        projectId: 'project-b',
        expectedStagedRevision: 1,
        expectedPriorActive: activeA,
      }),
    ).rejects.toMatchObject({ code: 'quota' })
    expect(await store.loadMigrationReceiptBySourceHash(sourceHash)).toEqual(
      receipt,
    )
    expect(await rawGet(factory, 'appMetadata', ACTIVE_PROJECT_METADATA_ID)).toEqual(
      activeA,
    )

    failurePoint = null
    const activeB = await store.activateStagedMigration({
      receiptId: receipt.id,
      projectId: 'project-b',
      expectedStagedRevision: 1,
      expectedPriorActive: activeA,
    })
    expect(activeB).toEqual(projectActive('project-b', 1))
    expect(await store.loadMigrationReceiptBySourceHash(sourceHash)).toEqual({
      ...receipt,
      status: 'verified',
    })
    await expect(
      store.stageV1Migration(stagedGraph, receipt, null),
    ).resolves.toMatchObject({ id: 'project-b', revision: 1 })

    const collidingReceipt = migrationReceipt('project-c', sourceHash)
    await expect(
      store.stageV1Migration(
        makeGraph('project-c', 1, {
          migrationReceipts: [collidingReceipt],
        }),
        collidingReceipt,
        null,
      ),
    ).rejects.toMatchObject({ code: 'immutable-collision' })
  })
})
