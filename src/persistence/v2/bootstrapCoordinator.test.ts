/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { IDBFactory } from 'fake-indexeddb'
import { vi } from 'vitest'

import { createNewProjectKernelV2 } from '../../domain/v2/defaults'
import type {
  PersistableProjectGraphV2,
  V1MigrationReceiptV2,
} from '../../domain/v2/types'
import { decodeProjectEnvelope } from '../schema'
import { PROJECT_STORAGE_KEY } from '../storage'
import {
  DEFAULT_UI_PREFERENCES_V2,
  UI_PREFERENCES_STORAGE_KEY_V2,
} from '../uiPreferencesV2'
import {
  runV2BootstrapCoordinator,
  type V2BootstrapCoordinatorOptionsV2,
  type V2BootstrapProjectStoreV2,
} from './bootstrapCoordinator'
import { NativeIndexedDbAuthorityV2 } from './indexedDbAuthority'
import { indexedDbPersistenceError } from './indexedDbErrors'
import { SCHEMA_2_DATABASE_NAME } from './indexedDbSchema'
import { REGISTERED_M2_PERSISTENCE_BOUNDARY_V2 } from './m2PersistenceBoundary'
import {
  WebCryptoSha256,
  computeV1SourceHash,
  type Sha256,
} from './sourceHash'

const FIXTURES = join(process.cwd(), 'src/test/fixtures/v1')
const V1_SOURCE = readFileSync(
  join(FIXTURES, 'local-storage-project-v1.json'),
  'utf8',
)

interface TrackingStorage {
  readonly records: Map<string, string>
  readonly reads: string[]
  readonly reader: { getItem(key: string): string | null }
}

function trackingStorage(
  initial: Readonly<Record<string, string>> = {},
): TrackingStorage {
  const records = new Map(Object.entries(initial))
  const reads: string[] = []
  return {
    records,
    reads,
    reader: {
      getItem(key: string): string | null {
        reads.push(key)
        return records.get(key) ?? null
      },
    },
  }
}

function nativeStore(
  factory: IDBFactory,
): NativeIndexedDbAuthorityV2 {
  return new NativeIndexedDbAuthorityV2({
    indexedDb: factory,
    boundary: REGISTERED_M2_PERSISTENCE_BOUNDARY_V2,
  })
}

function coordinatorOptions(
  storage: TrackingStorage,
  store: V2BootstrapProjectStoreV2,
  overrides: Partial<V2BootstrapCoordinatorOptionsV2> = {},
): V2BootstrapCoordinatorOptionsV2 {
  return {
    storage: storage.reader,
    store,
    sha256: new WebCryptoSha256(),
    projectIdFactory: vi.fn(() => 'project-fresh-bootstrap'),
    metadataClock: vi.fn(() => 1_234),
    ...overrides,
  }
}

function delegateStore(
  store: NativeIndexedDbAuthorityV2,
  overrides: Partial<V2BootstrapProjectStoreV2> = {},
): V2BootstrapProjectStoreV2 {
  return {
    open: () => store.open(),
    loadActiveProject: () => store.loadActiveProject(),
    loadProject: (projectId) => store.loadProject(projectId),
    loadMigrationReceiptBySourceHash: (sourceHash) =>
      store.loadMigrationReceiptBySourceHash(sourceHash),
    installAndActivateProject: (input) =>
      store.installAndActivateProject(input),
    activateProject: (input) => store.activateProject(input),
    stageV1Migration: (graph, receipt, sourceEvidence) =>
      store.stageV1Migration(graph, receipt, sourceEvidence),
    activateStagedMigration: (input) =>
      store.activateStagedMigration(input),
    ...overrides,
  }
}

function decodedV1Source() {
  const decoded = decodeProjectEnvelope(JSON.parse(V1_SOURCE) as unknown)
  if (!decoded.ok) throw new Error(decoded.error)
  return decoded.value
}

async function v1SourceHash(): Promise<string> {
  return computeV1SourceHash(
    new WebCryptoSha256(),
    'local-storage-project-v1',
    decodedV1Source(),
  )
}

function mismatchSha256(
  failingPhase: 'before-stage' | 'after-readback',
): Sha256 {
  const base = new WebCryptoSha256()
  const occurrences = new Map<string, number>()
  const mismatchOccurrence = failingPhase === 'before-stage' ? 1 : 2
  return {
    async digest(bytes: Uint8Array): Promise<Uint8Array> {
      const canonicalText = new TextDecoder().decode(bytes)
      const digest = await base.digest(bytes)
      if (
        canonicalText.includes('"decodedV1"') &&
        canonicalText.includes('"sourceKind":"local-storage-project-v1"')
      ) {
        return digest
      }
      const key = Array.from(bytes).join(',')
      const occurrence = occurrences.get(key) ?? 0
      occurrences.set(key, occurrence + 1)
      if (occurrence !== mismatchOccurrence) return digest
      const mismatched = new Uint8Array(digest)
      mismatched[0] = mismatched[0]! ^ 0xff
      return mismatched
    },
  }
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
      { once: true },
    )
  })
}

async function rawDelete(
  factory: IDBFactory,
  storeName: string,
  id: string,
): Promise<void> {
  const database = await rawOpen(factory)
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      transaction.objectStore(storeName).delete(id)
      transaction.addEventListener('complete', () => resolve(), { once: true })
      transaction.addEventListener(
        'abort',
        () => reject(transaction.error ?? new Error('delete aborted')),
        { once: true },
      )
    })
  } finally {
    database.close()
  }
}

describe('M2 bootstrap coordinator', () => {
  it('continues domain bootstrap with defaults when preference storage throws', async () => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    const projectIdFactory = vi.fn(() => 'must-not-be-created')
    const throwingReader = {
      getItem(key: string): string | null {
        storage.reads.push(key)
        if (key === UI_PREFERENCES_STORAGE_KEY_V2) {
          throw new Error('preference storage denied')
        }
        return storage.records.get(key) ?? null
      },
    }

    const result = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, store, {
        storage: throwingReader,
        projectIdFactory,
      }),
    )

    expect(result).toMatchObject({
      ok: true,
      origin: 'migrated-v1',
      preferences: DEFAULT_UI_PREFERENCES_V2,
      preferenceWarning:
        'UI preferences could not be read: preference storage denied',
    })
    expect(storage.reads).toEqual([
      UI_PREFERENCES_STORAGE_KEY_V2,
      PROJECT_STORAGE_KEY,
    ])
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
    expect(projectIdFactory).not.toHaveBeenCalled()
  })

  it('reports a blocked IndexedDB open without reading V1 or creating fallback state', async () => {
    const target = new EventTarget()
    const blockedFactory = {
      open: () => {
        queueMicrotask(() => target.dispatchEvent(new Event('blocked')))
        return target as unknown as IDBOpenDBRequest
      },
    } as unknown as IDBFactory
    const store = nativeStore(blockedFactory)
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    const projectIdFactory = vi.fn(() => 'must-not-be-created')

    const result = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, store, { projectIdFactory }),
    )

    expect(result).toMatchObject({ ok: false, phase: 'open-indexeddb' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.cause).toMatchObject({
      code: 'blocked',
      operation: 'open',
    })
    expect(storage.reads).toEqual([UI_PREFERENCES_STORAGE_KEY_V2])
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
    expect(projectIdFactory).not.toHaveBeenCalled()
  })

  it('loads preference defaults independently before reporting unavailable IndexedDB', async () => {
    const storage = trackingStorage({
      [UI_PREFERENCES_STORAGE_KEY_V2]: '{"version":"unsupported"}',
      [PROJECT_STORAGE_KEY]: V1_SOURCE,
    })
    const store = new NativeIndexedDbAuthorityV2({
      indexedDb: null,
      boundary: REGISTERED_M2_PERSISTENCE_BOUNDARY_V2,
    })

    const result = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, store),
    )

    expect(result).toMatchObject({
      ok: false,
      phase: 'open-indexeddb',
      preferences: DEFAULT_UI_PREFERENCES_V2,
    })
    expect(result.preferenceWarning).toContain('exactly version and values')
    expect(storage.reads).toEqual([UI_PREFERENCES_STORAGE_KEY_V2])
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
  })

  it('lets a strict active V2 graph win without reading or deriving V1 data', async () => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const activeGraph = createNewProjectKernelV2({
      projectIdFactory: () => 'project-already-active',
      metadataClock: () => 91,
    })
    await store.installAndActivateProject({
      graph: activeGraph,
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    })
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    const digest = vi.fn(() =>
      Promise.reject<Uint8Array>(new Error('hashing must not run')),
    )
    const projectIdFactory = vi.fn(() => {
      throw new Error('UUID factory must not run')
    })
    const metadataClock = vi.fn(() => {
      throw new Error('clock must not run')
    })

    const result = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, store, {
        sha256: { digest },
        projectIdFactory,
        metadataClock,
      }),
    )

    expect(result).toMatchObject({
      ok: true,
      origin: 'active-v2',
      graph: activeGraph,
      equivalence: null,
    })
    expect(storage.reads).toEqual([UI_PREFERENCES_STORAGE_KEY_V2])
    expect(digest).not.toHaveBeenCalled()
    expect(projectIdFactory).not.toHaveBeenCalled()
    expect(metadataClock).not.toHaveBeenCalled()
  })

  it('installs and strict-loads the exact fresh revision-one kernel', async () => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const storage = trackingStorage()
    const projectIdFactory = vi.fn(() => 'project-fresh-bootstrap')
    const metadataClock = vi.fn(() => 1_234)

    const result = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, store, {
        projectIdFactory,
        metadataClock,
      }),
    )

    expect(result).toMatchObject({
      ok: true,
      origin: 'fresh-v2',
      equivalence: null,
      graph: {
        record: {
          id: 'project-fresh-bootstrap',
          revision: 1,
          project: {
            name: 'Untitled Melody',
            rootSeed: 'melody-forge',
            createdAtEpochMs: 1_234,
            updatedAtEpochMs: 1_234,
          },
        },
      },
    })
    expect(projectIdFactory).toHaveBeenCalledOnce()
    expect(metadataClock).toHaveBeenCalledOnce()
    await expect(store.loadActiveProject()).resolves.toEqual(
      result.ok ? result.graph : null,
    )
    expect(storage.reads).toEqual([
      UI_PREFERENCES_STORAGE_KEY_V2,
      PROJECT_STORAGE_KEY,
    ])
  })

  it('migrates V1 through both equivalence gates and then short-circuits on reload', async () => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    const projectIdFactory = vi.fn(() => {
      throw new Error('UUID factory must not run for V1')
    })
    const metadataClock = vi.fn(() => {
      throw new Error('clock must not run for V1')
    })
    const options = coordinatorOptions(storage, store, {
      projectIdFactory,
      metadataClock,
    })

    const first = await runV2BootstrapCoordinator(options)

    expect(first).toMatchObject({
      ok: true,
      origin: 'migrated-v1',
      equivalence: {
        beforeStage: { phase: 'before-stage', equivalent: true },
        afterReadback: { phase: 'after-readback', equivalent: true },
      },
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.graph.tables.migrationReceipts).toHaveLength(1)
    expect(first.graph.tables.migrationReceipts[0]?.status).toBe('verified')
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
    expect(projectIdFactory).not.toHaveBeenCalled()
    expect(metadataClock).not.toHaveBeenCalled()

    const readCount = storage.reads.length
    const second = await runV2BootstrapCoordinator(options)
    expect(second).toMatchObject({ ok: true, origin: 'active-v2' })
    expect(storage.reads.slice(readCount)).toEqual([
      UI_PREFERENCES_STORAGE_KEY_V2,
    ])
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
  })

  it('reuses an inactive pending stage after interruption outside transaction one', async () => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    let interrupt = true
    const interruptedStore = delegateStore(store, {
      loadProject: async (projectId) => {
        if (interrupt) {
          interrupt = false
          throw new Error('simulated process interruption after staging')
        }
        return store.loadProject(projectId)
      },
    })

    const interrupted = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, interruptedStore),
    )
    const sourceHash = await v1SourceHash()
    expect(interrupted).toMatchObject({
      ok: false,
      phase: 'load-v1-stage',
    })
    await expect(store.loadActiveProject()).resolves.toBeNull()
    await expect(
      store.loadMigrationReceiptBySourceHash(sourceHash),
    ).resolves.toMatchObject({ status: 'pending-readback' })

    const retried = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, store),
    )
    expect(retried).toMatchObject({ ok: true, origin: 'resumed-v1' })
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
  })

  it('strict-loads and reactivates a matching verified but inactive stage', async () => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    const first = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, store),
    )
    expect(first.ok).toBe(true)
    if (!first.ok) return

    await rawDelete(factory, 'appMetadata', 'active-project')
    await expect(store.loadActiveProject()).resolves.toBeNull()

    const resumed = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, store),
    )
    expect(resumed).toMatchObject({
      ok: true,
      origin: 'resumed-v1',
      graph: { record: { id: first.graph.record.id, revision: 1 } },
    })
    expect(
      resumed.ok
        ? resumed.graph.tables.migrationReceipts[0]?.status
        : null,
    ).toBe('verified')
  })

  it.each([
    ['before-stage', 'verify-before-stage', null],
    ['after-readback', 'verify-after-readback', 'pending-readback'],
  ] as const)(
    'fails closed on a %s equivalence mismatch',
    async (failingPhase, expectedPhase, expectedReceiptStatus) => {
      const factory = new IDBFactory()
      const store = nativeStore(factory)
      const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })

      const result = await runV2BootstrapCoordinator(
        coordinatorOptions(storage, store, {
          sha256: mismatchSha256(failingPhase),
        }),
      )

      expect(result).toMatchObject({ ok: false, phase: expectedPhase })
      await expect(store.loadActiveProject()).resolves.toBeNull()
      const receipt = await store.loadMigrationReceiptBySourceHash(
        await v1SourceHash(),
      )
      expect(receipt?.status ?? null).toBe(expectedReceiptStatus)
      expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
    },
  )

  it('preserves a concurrently installed active project on stale migration CAS', async () => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    const racer = createNewProjectKernelV2({
      projectIdFactory: () => 'project-race-winner',
      metadataClock: () => 777,
    })
    let raced = false
    const racingStore = delegateStore(store, {
      stageV1Migration: async (
        graph: PersistableProjectGraphV2,
        receipt: V1MigrationReceiptV2,
        sourceEvidence: null,
      ) => {
        const staged = await store.stageV1Migration(
          graph,
          receipt,
          sourceEvidence,
        )
        if (!raced) {
          raced = true
          await store.installAndActivateProject({
            graph: racer,
            expectedStoredRevision: null,
            expectedPriorActive: null,
            reason: 'native-create',
          })
        }
        return staged
      },
    })

    const result = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, racingStore),
    )

    expect(result).toMatchObject({
      ok: false,
      phase: 'activate-v1-migration',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.cause).toMatchObject({
      code: 'conflict',
      operation: 'activate-staged-migration',
    })
    await expect(store.loadActiveProject()).resolves.toEqual(racer)
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
  })

  it('reports a staged project-revision conflict without falling back', async () => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    const projectIdFactory = vi.fn(() => 'must-not-be-created')
    const conflictingStore = delegateStore(store, {
      activateStagedMigration: () =>
        Promise.reject(
          indexedDbPersistenceError(
            'conflict',
            'activate-staged-migration',
            'staged project revision is stale or missing',
          ),
        ),
    })

    const result = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, conflictingStore, { projectIdFactory }),
    )

    expect(result).toMatchObject({
      ok: false,
      phase: 'activate-v1-migration',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.cause).toMatchObject({
      code: 'conflict',
      operation: 'activate-staged-migration',
    })
    await expect(store.loadActiveProject()).resolves.toBeNull()
    await expect(
      store.loadMigrationReceiptBySourceHash(await v1SourceHash()),
    ).resolves.toMatchObject({ status: 'pending-readback' })
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
    expect(projectIdFactory).not.toHaveBeenCalled()
  })

  it('reports an immutable stage collision without falling back', async () => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    const projectIdFactory = vi.fn(() => 'must-not-be-created')
    const collidingStore = delegateStore(store, {
      stageV1Migration: () =>
        Promise.reject(
          indexedDbPersistenceError(
            'immutable-collision',
            'stage-v1-migration',
            'unequal immutable content occupies the migration identity',
          ),
        ),
    })

    const result = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, collidingStore, { projectIdFactory }),
    )

    expect(result).toMatchObject({
      ok: false,
      phase: 'stage-v1-migration',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.cause).toMatchObject({
      code: 'immutable-collision',
      operation: 'stage-v1-migration',
    })
    await expect(store.loadActiveProject()).resolves.toBeNull()
    await expect(
      store.loadMigrationReceiptBySourceHash(await v1SourceHash()),
    ).resolves.toBeNull()
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
    expect(projectIdFactory).not.toHaveBeenCalled()
  })

  it('rolls back an injected activation abort and resumes without fallback', async () => {
    const factory = new IDBFactory()
    let abortActivation = true
    const store = new NativeIndexedDbAuthorityV2({
      indexedDb: factory,
      boundary: REGISTERED_M2_PERSISTENCE_BOUNDARY_V2,
      injectFailure: ({ operation, point }) => {
        if (
          abortActivation &&
          operation === 'activate-staged-migration' &&
          point === 'before-active-metadata-write'
        ) {
          throw new DOMException('injected transaction abort', 'AbortError')
        }
      },
    })
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: V1_SOURCE })
    const projectIdFactory = vi.fn(() => 'must-not-be-created')
    const options = coordinatorOptions(storage, store, { projectIdFactory })

    const aborted = await runV2BootstrapCoordinator(options)

    expect(aborted).toMatchObject({
      ok: false,
      phase: 'activate-v1-migration',
    })
    expect(aborted.ok).toBe(false)
    if (aborted.ok) return
    expect(aborted.error.cause).toMatchObject({
      code: 'abort',
      operation: 'activate-staged-migration',
    })
    await expect(store.loadActiveProject()).resolves.toBeNull()
    await expect(
      store.loadMigrationReceiptBySourceHash(await v1SourceHash()),
    ).resolves.toMatchObject({ status: 'pending-readback' })
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
    expect(projectIdFactory).not.toHaveBeenCalled()

    abortActivation = false
    const retried = await runV2BootstrapCoordinator(options)
    expect(retried).toMatchObject({ ok: true, origin: 'resumed-v1' })
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(V1_SOURCE)
    expect(projectIdFactory).not.toHaveBeenCalled()
  })

  it.each([
    ['malformed JSON', '{not-json'],
    [
      'unsupported schema',
      JSON.stringify({
        kind: 'melody-forge-project',
        schemaVersion: 2,
        project: {},
      }),
    ],
  ])('preserves %s V1 recovery bytes without creating defaults', async (_name, raw) => {
    const factory = new IDBFactory()
    const store = nativeStore(factory)
    const storage = trackingStorage({ [PROJECT_STORAGE_KEY]: raw })
    const projectIdFactory = vi.fn(() => 'must-not-be-created')
    const metadataClock = vi.fn(() => 0)

    const result = await runV2BootstrapCoordinator(
      coordinatorOptions(storage, store, {
        projectIdFactory,
        metadataClock,
      }),
    )

    expect(result).toMatchObject({ ok: false, phase: 'decode-v1-source' })
    await expect(store.loadActiveProject()).resolves.toBeNull()
    expect(projectIdFactory).not.toHaveBeenCalled()
    expect(metadataClock).not.toHaveBeenCalled()
    expect(storage.records.get(PROJECT_STORAGE_KEY)).toBe(raw)
  })
})
