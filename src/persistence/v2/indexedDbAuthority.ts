import { stableId, stableStringify } from '../../domain/identity'
import {
  assertLibraryItemV2,
  mergeLibraryOriginsV2,
} from '../../domain/v2/library'
import type {
  ActiveProjectMetadataV2,
  LibraryItemV2,
  PersistableProjectGraphV2,
  StoredProjectGraphV2,
  StoredProjectRecordV2,
  V1MigrationReceiptV2,
} from '../../domain/v2/types'
import {
  exactPlainObject,
  literalValue,
  lowercaseSha256,
  nonEmptyString,
} from '../../domain/v2/validation'
import type { V1SourceEvidenceRecordV2 } from './sourceEvidence'
import {
  indexedDbPersistenceError,
  normalizeIndexedDbError,
  type IndexedDbPersistenceError,
  type IndexedDbPersistenceOperation,
} from './indexedDbErrors'
import {
  assertExactSchema2Database,
  createSchema2Stores,
  MIGRATION_RECEIPT_SOURCE_HASH_INDEX,
  SCHEMA_2_DATABASE_NAME,
  SCHEMA_2_DATABASE_VERSION,
  SCHEMA_2_PROJECT_TABLE_STORE_NAMES,
  SCHEMA_2_STORE_NAMES,
  type Schema2ProjectTableStoreName,
  type Schema2StoreName,
} from './indexedDbSchema'

export const ACTIVE_PROJECT_METADATA_ID = 'active-project'

export interface IndexedDbRowReaderV2 {
  get(storeName: Schema2StoreName, id: string): Promise<unknown>
  getAll(storeName: Schema2StoreName): Promise<readonly unknown[]>
}

/**
 * Domain codecs own reachability and exact-version decoding. The native
 * adapter deliberately cannot infer a graph by returning every row in a
 * database containing multiple projects.
 */
export interface RegisteredM2PersistenceBoundaryV2 {
  decodeGraph(value: unknown): StoredProjectGraphV2
  loadGraph(
    reader: IndexedDbRowReaderV2,
    projectId: string,
  ): Promise<unknown>
  decodeActiveMetadata(value: unknown): ActiveProjectMetadataV2
  decodeMigrationReceipt(value: unknown): V1MigrationReceiptV2
}

export interface InstallAndActivateProjectInputV2 {
  readonly graph: PersistableProjectGraphV2
  readonly expectedStoredRevision: number | null
  readonly expectedPriorActive: ActiveProjectMetadataV2 | null
  readonly reason: 'native-create' | 'confirmed-schema2-replace'
}

export interface ActivateProjectInputV2 {
  readonly projectId: string
  readonly expectedTargetRevision: number
  readonly expectedPriorActive: ActiveProjectMetadataV2 | null
}

export interface ActivateStagedMigrationInputV2 {
  readonly receiptId: string
  readonly projectId: string
  readonly expectedStagedRevision: number
  readonly expectedPriorActive: ActiveProjectMetadataV2 | null
}

export type IndexedDbFailurePointV2 =
  | 'before-graph-write'
  | 'before-strict-read-back'
  | 'before-receipt-write'
  | 'before-source-evidence-write'
  | 'before-active-metadata-write'

export interface IndexedDbFailureContextV2 {
  readonly operation: IndexedDbPersistenceOperation
  readonly point: IndexedDbFailurePointV2
  readonly projectId: string
}

export interface IndexedDbAuthorityOptionsV2 {
  readonly indexedDb?: IDBFactory | null
  readonly boundary: RegisteredM2PersistenceBoundaryV2
  /** Synchronous and test-only; throwing exercises transaction rollback. */
  readonly injectFailure?: (context: IndexedDbFailureContextV2) => void
}

type RowOwnership = 'project-owned' | 'global'
type RowWritePolicy = 'mutable' | 'immutable'

interface GraphRow {
  readonly storeName: Schema2ProjectTableStoreName
  readonly value: Readonly<{ id: string }>
  readonly ownership: RowOwnership
  readonly writePolicy: RowWritePolicy
}

interface TablePolicy {
  readonly ownership: RowOwnership
  readonly writePolicy: RowWritePolicy
}

const TABLE_POLICIES = {
  createStates: { ownership: 'project-owned', writePolicy: 'mutable' },
  modeStates: { ownership: 'project-owned', writePolicy: 'mutable' },
  historyGraphs: { ownership: 'project-owned', writePolicy: 'mutable' },
  historyNodes: { ownership: 'project-owned', writePolicy: 'immutable' },
  snapshots: { ownership: 'project-owned', writePolicy: 'immutable' },
  melodyCandidates: { ownership: 'global', writePolicy: 'immutable' },
  melodyGenomes: { ownership: 'global', writePolicy: 'immutable' },
  transports: { ownership: 'global', writePolicy: 'immutable' },
  v1TimingProfiles: { ownership: 'global', writePolicy: 'immutable' },
  tonalTimelines: { ownership: 'global', writePolicy: 'immutable' },
  customScales: { ownership: 'global', writePolicy: 'immutable' },
  beats: { ownership: 'global', writePolicy: 'immutable' },
  performanceSettings: { ownership: 'global', writePolicy: 'immutable' },
  pairings: { ownership: 'global', writePolicy: 'immutable' },
  preferenceRecords: { ownership: 'project-owned', writePolicy: 'immutable' },
  libraryItems: { ownership: 'global', writePolicy: 'mutable' },
  ratings: { ownership: 'project-owned', writePolicy: 'mutable' },
  annotations: { ownership: 'project-owned', writePolicy: 'mutable' },
  undoStates: { ownership: 'project-owned', writePolicy: 'mutable' },
  migrationReceipts: {
    ownership: 'project-owned',
    writePolicy: 'immutable',
  },
} as const satisfies Record<Schema2ProjectTableStoreName, TablePolicy>

interface TransactionCompletion {
  readonly completed: boolean
  readonly error: unknown
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    })
    request.addEventListener(
      'error',
      () => reject(request.error ?? new DOMException('Request failed', 'UnknownError')),
      { once: true },
    )
  })
}

function transactionCompletion(
  transaction: IDBTransaction,
): Promise<TransactionCompletion> {
  return new Promise<TransactionCompletion>((resolve) => {
    let error: unknown = null
    transaction.addEventListener(
      'error',
      () => {
        error = transaction.error
      },
      { once: true },
    )
    transaction.addEventListener(
      'abort',
      () => resolve({ completed: false, error: transaction.error ?? error }),
      { once: true },
    )
    transaction.addEventListener(
      'complete',
      () => resolve({ completed: true, error: null }),
      { once: true },
    )
  })
}

class TransactionRowReader implements IndexedDbRowReaderV2 {
  readonly #transaction: IDBTransaction

  constructor(transaction: IDBTransaction) {
    this.#transaction = transaction
  }

  async get(
    storeName: Schema2StoreName,
    id: string,
  ): Promise<unknown> {
    const result = await requestResult<unknown>(
      this.#transaction.objectStore(storeName).get(id),
    )
    return result === undefined ? null : result
  }

  async getAll(storeName: Schema2StoreName): Promise<readonly unknown[]> {
    return requestResult(this.#transaction.objectStore(storeName).getAll())
  }
}

function assertPositiveRevision(value: number, path: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${path} must be a positive safe integer`)
  }
}

function decodePositiveRevisionInput(
  value: number,
  path: string,
  operation: IndexedDbPersistenceOperation,
): void {
  try {
    assertPositiveRevision(value, path)
  } catch (error) {
    throw normalizeIndexedDbError(
      error,
      operation,
      'decode',
      `${path} is invalid`,
    )
  }
}

function decodeNonEmptyStringInput(
  value: unknown,
  path: string,
  operation: IndexedDbPersistenceOperation,
): string {
  try {
    return nonEmptyString(value, path)
  } catch (error) {
    throw normalizeIndexedDbError(
      error,
      operation,
      'decode',
      `${path} is invalid`,
    )
  }
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right)
}

function graphRows(graph: StoredProjectGraphV2): readonly GraphRow[] {
  const rows: GraphRow[] = []
  for (const storeName of SCHEMA_2_PROJECT_TABLE_STORE_NAMES) {
    const policy = TABLE_POLICIES[storeName]
    const table = graph.tables[storeName] as readonly Readonly<{
      id: string
      projectId?: string
    }>[]
    for (const value of table) {
      if (typeof value.id !== 'string' || value.id.length === 0) {
        throw new TypeError(`${storeName} contains a row without an embedded id`)
      }
      if (
        policy.ownership === 'project-owned' &&
        value.projectId !== graph.record.id
      ) {
        throw new TypeError(
          `${storeName}/${value.id} must be owned by project ${graph.record.id}`,
        )
      }
      rows.push({ storeName, value, ...policy })
    }
  }
  return rows
}

function expectedActiveMetadata(
  projectId: string,
  revision: number,
): ActiveProjectMetadataV2 {
  return {
    id: ACTIVE_PROJECT_METADATA_ID,
    version: 'active-project-metadata-v2',
    projectId,
    revision,
  }
}

function assertCanonicalBase64(value: unknown): string {
  const text = nonEmptyString(value, 'sourceEvidence.rawBase64')
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      text,
    )
  ) {
    throw new TypeError('sourceEvidence.rawBase64 must be canonical RFC 4648 base64')
  }
  return text
}

function decodeSourceEvidence(
  value: unknown,
): V1SourceEvidenceRecordV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'sourceKind',
      'sourceHash',
      'rawSha256',
      'encoding',
      'rawBase64',
    ],
    'sourceEvidence',
  )
  literalValue(
    record.version,
    'v1-source-evidence-v1',
    'sourceEvidence.version',
  )
  if (
    record.sourceKind !== 'project-envelope-v1' &&
    record.sourceKind !== 'candidate-envelope-v1'
  ) {
    throw new TypeError(
      'sourceEvidence.sourceKind must identify an imported V1 envelope',
    )
  }
  const sourceHash = lowercaseSha256(
    record.sourceHash,
    'sourceEvidence.sourceHash',
  )
  const rawSha256 = lowercaseSha256(
    record.rawSha256,
    'sourceEvidence.rawSha256',
  )
  literalValue(record.encoding, 'base64', 'sourceEvidence.encoding')
  assertCanonicalBase64(record.rawBase64)
  const expectedId = stableId('v1-source-evidence', { sourceHash, rawSha256 })
  if (record.id !== expectedId) {
    throw new TypeError(`sourceEvidence.id must equal ${expectedId}`)
  }
  return value as V1SourceEvidenceRecordV2
}

function abortQuietly(transaction: IDBTransaction): void {
  try {
    transaction.abort()
  } catch {
    // The request that failed may already have initiated the same abort.
  }
}

export class NativeIndexedDbAuthorityV2 {
  readonly #factory: IDBFactory | null
  readonly #boundary: RegisteredM2PersistenceBoundaryV2
  readonly #injectFailure:
    | ((context: IndexedDbFailureContextV2) => void)
    | undefined
  #database: IDBDatabase | null = null
  #opening: Promise<void> | null = null

  constructor(options: IndexedDbAuthorityOptionsV2) {
    this.#factory =
      options.indexedDb === undefined
        ? typeof indexedDB === 'undefined'
          ? null
          : indexedDB
        : options.indexedDb
    this.#boundary = options.boundary
    this.#injectFailure = options.injectFailure
  }

  async open(): Promise<void> {
    if (this.#database !== null) return
    if (this.#opening !== null) return this.#opening
    if (this.#factory === null) {
      throw indexedDbPersistenceError(
        'unavailable',
        'open',
        'IndexedDB is unavailable in this environment',
      )
    }

    this.#opening = this.#openDatabase()
    try {
      await this.#opening
    } finally {
      this.#opening = null
    }
  }

  close(): void {
    this.#database?.close()
    this.#database = null
  }

  async loadActiveProject(): Promise<StoredProjectGraphV2 | null> {
    return this.#withTransaction(
      'load-active-project',
      'readonly',
      async (transaction, reader) => {
        const active = this.#readActiveMetadata(
          await reader.get('appMetadata', ACTIVE_PROJECT_METADATA_ID),
          'load-active-project',
        )
        if (active === null) return null
        const graph = await this.#loadGraph(
          reader,
          active.projectId,
          'load-active-project',
          'decode',
        )
        if (graph === null) {
          throw indexedDbPersistenceError(
            'decode',
            'load-active-project',
            `active project ${active.projectId} is missing`,
          )
        }
        if (graph.record.revision !== active.revision) {
          throw indexedDbPersistenceError(
            'conflict',
            'load-active-project',
            'active metadata revision does not match its stored project',
          )
        }
        void transaction
        return graph
      },
    )
  }

  async loadProject(projectId: string): Promise<StoredProjectGraphV2 | null> {
    decodeNonEmptyStringInput(projectId, 'projectId', 'load-project')
    return this.#withTransaction(
      'load-project',
      'readonly',
      async (_transaction, reader) =>
        this.#loadGraph(reader, projectId, 'load-project', 'decode'),
    )
  }

  async loadMigrationReceiptBySourceHash(
    sourceHash: string,
  ): Promise<V1MigrationReceiptV2 | null> {
    const operation = 'load-migration-receipt' as const
    try {
      lowercaseSha256(sourceHash, 'sourceHash')
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        operation,
        'decode',
        'sourceHash is invalid',
      )
    }
    return this.#withTransaction(
      operation,
      'readonly',
      async (transaction) => {
        const value = await requestResult<unknown>(
          transaction
            .objectStore('migrationReceipts')
            .index(MIGRATION_RECEIPT_SOURCE_HASH_INDEX)
            .get(sourceHash),
        )
        return value === undefined
          ? null
          : this.#decodeReceipt(value, operation, 'decode')
      },
    )
  }

  async saveProject(
    graphInput: PersistableProjectGraphV2,
    expectedRevision: number,
  ): Promise<StoredProjectRecordV2> {
    const operation = 'save-project' as const
    decodePositiveRevisionInput(expectedRevision, 'expectedRevision', operation)
    const graph = this.#decodeGraph(graphInput, operation, 'decode')
    if (graph.record.revision !== expectedRevision + 1) {
      throw indexedDbPersistenceError(
        'conflict',
        operation,
        'saved graph revision must be expectedRevision + 1',
      )
    }

    return this.#withTransaction(
      operation,
      'readwrite',
      async (transaction, reader) => {
        const current = await this.#loadGraph(
          reader,
          graph.record.id,
          operation,
          'decode',
        )
        if (current === null) {
          throw indexedDbPersistenceError(
            'not-found',
            operation,
            `project ${graph.record.id} does not exist`,
          )
        }
        if (current.record.revision !== expectedRevision) {
          throw indexedDbPersistenceError(
            'conflict',
            operation,
            'stored project revision is stale',
          )
        }

        const active = this.#readActiveMetadata(
          await reader.get('appMetadata', ACTIVE_PROJECT_METADATA_ID),
          operation,
        )
        const savingActive = active?.projectId === graph.record.id
        if (savingActive && active.revision !== expectedRevision) {
          throw indexedDbPersistenceError(
            'conflict',
            operation,
            'active project metadata revision is stale',
          )
        }

        const effectiveGraph = await this.#mergeLibraryRows(
          transaction,
          graph,
          operation,
        )
        await this.#deleteObsoleteProjectRows(
          transaction,
          current,
          effectiveGraph,
        )
        this.#failure(operation, 'before-graph-write', graph.record.id)
        await this.#writeGraph(transaction, effectiveGraph, operation)
        await this.#strictReadBack(
          transaction,
          reader,
          effectiveGraph,
          operation,
        )

        if (savingActive) {
          const nextActive = expectedActiveMetadata(
            graph.record.id,
            graph.record.revision,
          )
          this.#decodeActiveMetadata(nextActive, operation)
          this.#failure(
            operation,
            'before-active-metadata-write',
            graph.record.id,
          )
          await requestResult(
            transaction.objectStore('appMetadata').put(nextActive),
          )
        }
        return graph.record
      },
    )
  }

  async installAndActivateProject(
    input: InstallAndActivateProjectInputV2,
  ): Promise<ActiveProjectMetadataV2> {
    const operation = 'install-and-activate-project' as const
    const graph = this.#decodeGraph(input.graph, operation, 'decode')
    const expectedPriorActive = this.#decodeOptionalActiveMetadata(
      input.expectedPriorActive,
      operation,
    )
    if (
      input.reason !== 'native-create' &&
      input.reason !== 'confirmed-schema2-replace'
    ) {
      throw indexedDbPersistenceError(
        'decode',
        operation,
        'install reason is not registered',
      )
    }

    if (input.expectedStoredRevision === null) {
      if (graph.record.revision !== 1) {
        throw indexedDbPersistenceError(
          'conflict',
          operation,
          'an absent target requires graph revision 1',
        )
      }
    } else {
      decodePositiveRevisionInput(
        input.expectedStoredRevision,
        'expectedStoredRevision',
        operation,
      )
      if (graph.record.revision !== input.expectedStoredRevision + 1) {
        throw indexedDbPersistenceError(
          'conflict',
          operation,
          'a present target requires graph revision one greater than expected',
        )
      }
    }
    if (
      input.reason === 'native-create' &&
      input.expectedStoredRevision !== null
    ) {
      throw indexedDbPersistenceError(
        'conflict',
        operation,
        'native creation permits only an absent revision-1 target',
      )
    }

    return this.#withTransaction(
      operation,
      'readwrite',
      async (transaction, reader) => {
        await this.#comparePriorActive(
          reader,
          expectedPriorActive,
          operation,
        )

        let current: StoredProjectGraphV2 | null = null
        if (input.expectedStoredRevision === null) {
          const existingRecord = await reader.get('projects', graph.record.id)
          if (existingRecord !== null) {
            throw indexedDbPersistenceError(
              'conflict',
              operation,
              'target project already exists',
            )
          }
        } else {
          current = await this.#loadGraph(
            reader,
            graph.record.id,
            operation,
            'decode',
          )
          if (
            current === null ||
            current.record.revision !== input.expectedStoredRevision
          ) {
            throw indexedDbPersistenceError(
              'conflict',
              operation,
              'target project revision is stale',
            )
          }
        }

        const effectiveGraph = await this.#mergeLibraryRows(
          transaction,
          graph,
          operation,
        )
        if (current !== null) {
          await this.#deleteObsoleteProjectRows(
            transaction,
            current,
            effectiveGraph,
          )
        }
        this.#failure(operation, 'before-graph-write', graph.record.id)
        await this.#writeGraph(transaction, effectiveGraph, operation)
        await this.#strictReadBack(
          transaction,
          reader,
          effectiveGraph,
          operation,
        )

        const active = expectedActiveMetadata(
          graph.record.id,
          graph.record.revision,
        )
        this.#decodeActiveMetadata(active, operation)
        this.#failure(
          operation,
          'before-active-metadata-write',
          graph.record.id,
        )
        await requestResult(transaction.objectStore('appMetadata').put(active))
        return active
      },
    )
  }

  async activateProject(
    input: ActivateProjectInputV2,
  ): Promise<ActiveProjectMetadataV2> {
    const operation = 'activate-project' as const
    decodeNonEmptyStringInput(input.projectId, 'projectId', operation)
    decodePositiveRevisionInput(
      input.expectedTargetRevision,
      'expectedTargetRevision',
      operation,
    )
    const expectedPriorActive = this.#decodeOptionalActiveMetadata(
      input.expectedPriorActive,
      operation,
    )

    return this.#withTransaction(
      operation,
      'readwrite',
      async (transaction, reader) => {
        const graph = await this.#loadGraph(
          reader,
          input.projectId,
          operation,
          'decode',
        )
        if (graph === null) {
          throw indexedDbPersistenceError(
            'not-found',
            operation,
            `project ${input.projectId} does not exist`,
          )
        }
        if (graph.record.revision !== input.expectedTargetRevision) {
          throw indexedDbPersistenceError(
            'conflict',
            operation,
            'target project revision is stale',
          )
        }
        await this.#comparePriorActive(
          reader,
          expectedPriorActive,
          operation,
        )
        const active = expectedActiveMetadata(
          input.projectId,
          input.expectedTargetRevision,
        )
        this.#decodeActiveMetadata(active, operation)
        this.#failure(
          operation,
          'before-active-metadata-write',
          input.projectId,
        )
        await requestResult(transaction.objectStore('appMetadata').put(active))
        return active
      },
    )
  }

  async stageV1Migration(
    graphInput: PersistableProjectGraphV2,
    pendingReceiptInput: V1MigrationReceiptV2,
    sourceEvidenceInput: V1SourceEvidenceRecordV2 | null,
  ): Promise<StoredProjectRecordV2> {
    const operation = 'stage-v1-migration' as const
    const graph = this.#decodeGraph(graphInput, operation, 'decode')
    const pendingReceipt = this.#decodeReceipt(
      pendingReceiptInput,
      operation,
      'decode',
    )
    const sourceEvidence =
      sourceEvidenceInput === null
        ? null
        : this.#decodeSourceEvidence(sourceEvidenceInput, operation)
    this.#assertStageInputs(graph, pendingReceipt, sourceEvidence, operation)

    return this.#withTransaction(
      operation,
      'readwrite',
      async (transaction, reader) => {
        const receiptIndex = transaction
          .objectStore('migrationReceipts')
          .index(MIGRATION_RECEIPT_SOURCE_HASH_INDEX)
        const existingReceiptValue = await requestResult<unknown>(
          receiptIndex.get(pendingReceipt.sourceHash),
        )
        const existingReceipt =
          existingReceiptValue === undefined
            ? null
            : this.#decodeReceipt(
                existingReceiptValue,
                operation,
                'decode',
              )
        const current = await this.#loadGraph(
          reader,
          graph.record.id,
          operation,
          'decode',
        )

        const effectiveGraph = await this.#mergeLibraryRows(
          transaction,
          graph,
          operation,
        )
        if (existingReceipt !== null || current !== null) {
          const expectedReceipt =
            existingReceipt?.status === 'verified'
              ? ({
                  ...pendingReceipt,
                  status: 'verified',
                } as const satisfies V1MigrationReceiptV2)
              : pendingReceipt
          const expectedGraph =
            expectedReceipt === pendingReceipt
              ? effectiveGraph
              : this.#decodeGraph(
                  {
                    record: effectiveGraph.record,
                    tables: {
                      ...effectiveGraph.tables,
                      migrationReceipts:
                        effectiveGraph.tables.migrationReceipts.map((receipt) =>
                          receipt.id === expectedReceipt.id
                            ? expectedReceipt
                            : receipt,
                        ),
                    },
                  },
                  operation,
                  'decode',
                )
          if (
            existingReceipt === null ||
            current === null ||
            !sameCanonicalValue(existingReceipt, expectedReceipt) ||
            !sameCanonicalValue(current, expectedGraph)
          ) {
            throw indexedDbPersistenceError(
              'immutable-collision',
              operation,
              'an unequal pending migration already occupies this source or project identity',
            )
          }
          await this.#assertMatchingSourceEvidence(
            reader,
            sourceEvidence,
            operation,
          )
          return current.record
        }

        this.#failure(operation, 'before-graph-write', graph.record.id)
        await this.#writeGraph(transaction, effectiveGraph, operation)
        if (sourceEvidence !== null) {
          this.#failure(
            operation,
            'before-source-evidence-write',
            graph.record.id,
          )
          await this.#writeImmutableRow(
            transaction,
            'appMetadata',
            sourceEvidence,
            operation,
          )
        }
        await this.#strictReadBack(
          transaction,
          reader,
          effectiveGraph,
          operation,
        )
        return graph.record
      },
    )
  }

  async activateStagedMigration(
    input: ActivateStagedMigrationInputV2,
  ): Promise<ActiveProjectMetadataV2> {
    const operation = 'activate-staged-migration' as const
    decodeNonEmptyStringInput(input.receiptId, 'receiptId', operation)
    decodeNonEmptyStringInput(input.projectId, 'projectId', operation)
    decodePositiveRevisionInput(
      input.expectedStagedRevision,
      'expectedStagedRevision',
      operation,
    )
    const expectedPriorActive = this.#decodeOptionalActiveMetadata(
      input.expectedPriorActive,
      operation,
    )

    return this.#withTransaction(
      operation,
      'readwrite',
      async (transaction, reader) => {
        const receiptValue = await reader.get(
          'migrationReceipts',
          input.receiptId,
        )
        if (receiptValue === null) {
          throw indexedDbPersistenceError(
            'not-found',
            operation,
            `migration receipt ${input.receiptId} does not exist`,
          )
        }
        const receipt = this.#decodeReceipt(
          receiptValue,
          operation,
          'decode',
        )
        if (
          receipt.status !== 'pending-readback' ||
          receipt.projectId !== input.projectId ||
          receipt.stagedRevision !== input.expectedStagedRevision
        ) {
          throw indexedDbPersistenceError(
            'conflict',
            operation,
            'migration receipt does not match the pending staged expectation',
          )
        }

        const graph = await this.#loadGraph(
          reader,
          input.projectId,
          operation,
          'read-back',
        )
        if (
          graph === null ||
          graph.record.revision !== input.expectedStagedRevision
        ) {
          throw indexedDbPersistenceError(
            'conflict',
            operation,
            'staged project revision is stale or missing',
          )
        }
        if (
          graph.record.project.algorithmVersions.foundations.v1Migration !==
          receipt.migrationVersion
        ) {
          throw indexedDbPersistenceError(
            'read-back',
            operation,
            'receipt migration version differs from the staged project registry',
          )
        }
        await this.#comparePriorActive(
          reader,
          expectedPriorActive,
          operation,
        )

        const verifiedReceipt = {
          ...receipt,
          status: 'verified',
        } as const satisfies V1MigrationReceiptV2
        this.#decodeReceipt(verifiedReceipt, operation, 'read-back')
        this.#failure(
          operation,
          'before-receipt-write',
          input.projectId,
        )
        await requestResult(
          transaction
            .objectStore('migrationReceipts')
            .put(verifiedReceipt),
        )
        const storedVerifiedReceipt = this.#decodeReceipt(
          await reader.get('migrationReceipts', receipt.id),
          operation,
          'read-back',
        )
        if (!sameCanonicalValue(storedVerifiedReceipt, verifiedReceipt)) {
          throw indexedDbPersistenceError(
            'read-back',
            operation,
            'verified receipt read-back differs from the written record',
          )
        }

        const active = expectedActiveMetadata(
          input.projectId,
          input.expectedStagedRevision,
        )
        this.#decodeActiveMetadata(active, operation)
        this.#failure(
          operation,
          'before-active-metadata-write',
          input.projectId,
        )
        await requestResult(transaction.objectStore('appMetadata').put(active))
        return active
      },
    )
  }

  async #openDatabase(): Promise<void> {
    const factory = this.#factory!
    let request: IDBOpenDBRequest
    try {
      request = factory.open(
        SCHEMA_2_DATABASE_NAME,
        SCHEMA_2_DATABASE_VERSION,
      )
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        'open',
        'unavailable',
        'could not request the schema-2 database',
      )
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false
      let upgradeFailure: unknown = null
      const fail = (error: IndexedDbPersistenceError): void => {
        if (settled) return
        settled = true
        reject(error)
      }

      request.addEventListener('blocked', () => {
        fail(
          indexedDbPersistenceError(
            'blocked',
            'open',
            'opening melody-forge-v2 is blocked by another connection',
          ),
        )
      })
      request.addEventListener('upgradeneeded', (event) => {
        try {
          createSchema2Stores(request.result, event.oldVersion)
        } catch (error) {
          upgradeFailure = error
          request.transaction?.abort()
        }
      })
      request.addEventListener('error', () => {
        fail(
          normalizeIndexedDbError(
            upgradeFailure ?? request.error,
            'open',
            upgradeFailure === null ? 'unavailable' : 'upgrade',
            'could not open the schema-2 database',
          ),
        )
      })
      request.addEventListener('success', () => {
        const database = request.result
        if (settled) {
          database.close()
          return
        }
        try {
          assertExactSchema2Database(database)
          database.addEventListener('versionchange', () => {
            database.close()
            if (this.#database === database) this.#database = null
          })
          this.#database = database
          settled = true
          resolve()
        } catch (error) {
          database.close()
          fail(
            normalizeIndexedDbError(
              error,
              'open',
              'upgrade',
              'schema-2 database layout is invalid',
            ),
          )
        }
      })
    })
  }

  async #withTransaction<T>(
    operation: IndexedDbPersistenceOperation,
    mode: IDBTransactionMode,
    work: (
      transaction: IDBTransaction,
      reader: IndexedDbRowReaderV2,
    ) => Promise<T>,
  ): Promise<T> {
    await this.open()
    const database = this.#database
    if (database === null) {
      throw indexedDbPersistenceError(
        'unavailable',
        operation,
        'IndexedDB connection closed before the operation began',
      )
    }

    let transaction: IDBTransaction
    try {
      transaction = database.transaction([...SCHEMA_2_STORE_NAMES], mode)
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        operation,
        'unavailable',
        'could not begin the schema-2 transaction',
      )
    }
    const completion = transactionCompletion(transaction)
    const reader = new TransactionRowReader(transaction)
    let result: T | undefined
    let workError: unknown = null
    try {
      result = await work(transaction, reader)
    } catch (error) {
      workError = error
      abortQuietly(transaction)
    }

    const finished = await completion
    if (workError !== null) {
      throw normalizeIndexedDbError(
        workError,
        operation,
        'abort',
        'schema-2 transaction failed',
      )
    }
    if (!finished.completed) {
      throw normalizeIndexedDbError(
        finished.error,
        operation,
        'abort',
        'schema-2 transaction aborted',
      )
    }
    return result!
  }

  #decodeGraph(
    value: unknown,
    operation: IndexedDbPersistenceOperation,
    fallback: 'decode' | 'read-back',
  ): StoredProjectGraphV2 {
    try {
      const graph = this.#boundary.decodeGraph(value)
      assertPositiveRevision(graph.record.revision, 'graph.record.revision')
      graphRows(graph)
      return graph
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        operation,
        fallback,
        'project graph failed its registered schema boundary',
      )
    }
  }

  async #loadGraph(
    reader: IndexedDbRowReaderV2,
    projectId: string,
    operation: IndexedDbPersistenceOperation,
    fallback: 'decode' | 'read-back',
  ): Promise<StoredProjectGraphV2 | null> {
    try {
      const value = await this.#boundary.loadGraph(reader, projectId)
      return value === null
        ? null
        : this.#decodeGraph(value, operation, fallback)
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        operation,
        fallback,
        `project ${projectId} could not be strictly loaded`,
      )
    }
  }

  #decodeActiveMetadata(
    value: unknown,
    operation: IndexedDbPersistenceOperation,
  ): ActiveProjectMetadataV2 {
    try {
      return this.#boundary.decodeActiveMetadata(value)
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        operation,
        'decode',
        'active-project metadata failed its registered codec',
      )
    }
  }

  #decodeOptionalActiveMetadata(
    value: ActiveProjectMetadataV2 | null,
    operation: IndexedDbPersistenceOperation,
  ): ActiveProjectMetadataV2 | null {
    return value === null ? null : this.#decodeActiveMetadata(value, operation)
  }

  #readActiveMetadata(
    value: unknown,
    operation: IndexedDbPersistenceOperation,
  ): ActiveProjectMetadataV2 | null {
    return value === null ? null : this.#decodeActiveMetadata(value, operation)
  }

  #decodeReceipt(
    value: unknown,
    operation: IndexedDbPersistenceOperation,
    fallback: 'decode' | 'read-back',
  ): V1MigrationReceiptV2 {
    try {
      return this.#boundary.decodeMigrationReceipt(value)
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        operation,
        fallback,
        'migration receipt failed its registered codec',
      )
    }
  }

  #decodeSourceEvidence(
    value: unknown,
    operation: IndexedDbPersistenceOperation,
  ): V1SourceEvidenceRecordV2 {
    try {
      return decodeSourceEvidence(value)
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        operation,
        'decode',
        'source evidence failed its registered codec',
      )
    }
  }

  async #comparePriorActive(
    reader: IndexedDbRowReaderV2,
    expected: ActiveProjectMetadataV2 | null,
    operation: IndexedDbPersistenceOperation,
  ): Promise<void> {
    const actual = this.#readActiveMetadata(
      await reader.get('appMetadata', ACTIVE_PROJECT_METADATA_ID),
      operation,
    )
    if (!sameCanonicalValue(actual, expected)) {
      throw indexedDbPersistenceError(
        'conflict',
        operation,
        'prior active-project metadata is stale',
      )
    }
  }

  async #writeGraph(
    transaction: IDBTransaction,
    graph: StoredProjectGraphV2,
    operation: IndexedDbPersistenceOperation,
  ): Promise<void> {
    await requestResult(
      transaction.objectStore('projects').put(graph.record),
    )
    for (const row of graphRows(graph)) {
      if (row.writePolicy === 'immutable') {
        await this.#writeImmutableRow(
          transaction,
          row.storeName,
          row.value,
          operation,
        )
      } else {
        await requestResult(
          transaction.objectStore(row.storeName).put(row.value),
        )
      }
    }
  }

  /**
   * Generic project writes are merge paths, never explicit Library metadata
   * edits. Existing editable metadata therefore wins and only the canonical
   * origin union is added. This is evaluated inside the write transaction so
   * an inactive stale project cannot overwrite a newer global Library edit.
   */
  async #mergeLibraryRows(
    transaction: IDBTransaction,
    graph: StoredProjectGraphV2,
    operation: IndexedDbPersistenceOperation,
  ): Promise<StoredProjectGraphV2> {
    const store = transaction.objectStore('libraryItems')
    const libraryItems: LibraryItemV2[] = []
    try {
      for (const incoming of graph.tables.libraryItems) {
        const existingValue = await requestResult<unknown>(
          store.get(incoming.id),
        )
        if (existingValue === undefined) {
          libraryItems.push(incoming)
          continue
        }
        assertLibraryItemV2(existingValue)
        libraryItems.push(mergeLibraryOriginsV2(existingValue, incoming))
      }
      return this.#decodeGraph(
        {
          record: graph.record,
          tables: { ...graph.tables, libraryItems },
        },
        operation,
        'decode',
      )
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        operation,
        'decode',
        'global Library rows could not be merged safely',
      )
    }
  }

  async #writeImmutableRow(
    transaction: IDBTransaction,
    storeName: Schema2StoreName,
    value: Readonly<{ id: string }>,
    operation: IndexedDbPersistenceOperation,
  ): Promise<void> {
    const store = transaction.objectStore(storeName)
    const existing = await requestResult<unknown>(store.get(value.id))
    if (existing === undefined) {
      await requestResult(store.add(value))
      return
    }
    if (!sameCanonicalValue(existing, value)) {
      throw indexedDbPersistenceError(
        'immutable-collision',
        operation,
        `${storeName}/${value.id} collides with unequal immutable content`,
      )
    }
  }

  async #strictReadBack(
    _transaction: IDBTransaction,
    reader: IndexedDbRowReaderV2,
    graph: StoredProjectGraphV2,
    operation: IndexedDbPersistenceOperation,
  ): Promise<void> {
    try {
      this.#failure(
        operation,
        'before-strict-read-back',
        graph.record.id,
      )
    } catch (error) {
      throw normalizeIndexedDbError(
        error,
        operation,
        'read-back',
        'strict graph read-back was interrupted',
      )
    }
    const stored = await this.#loadGraph(
      reader,
      graph.record.id,
      operation,
      'read-back',
    )
    if (stored === null || !sameCanonicalValue(stored, graph)) {
      throw indexedDbPersistenceError(
        'read-back',
        operation,
        'strict graph read-back differs from the graph just written',
      )
    }
  }

  async #deleteObsoleteProjectRows(
    transaction: IDBTransaction,
    current: StoredProjectGraphV2,
    replacement: StoredProjectGraphV2,
  ): Promise<void> {
    const retained = new Set(
      graphRows(replacement).map((row) => `${row.storeName}\u0000${row.value.id}`),
    )
    for (const row of graphRows(current)) {
      if (
        row.ownership === 'project-owned' &&
        !retained.has(`${row.storeName}\u0000${row.value.id}`)
      ) {
        await requestResult(
          transaction.objectStore(row.storeName).delete(row.value.id),
        )
      }
    }
  }

  #assertStageInputs(
    graph: StoredProjectGraphV2,
    receipt: V1MigrationReceiptV2,
    sourceEvidence: V1SourceEvidenceRecordV2 | null,
    operation: IndexedDbPersistenceOperation,
  ): void {
    if (
      graph.record.revision !== 1 ||
      receipt.status !== 'pending-readback' ||
      receipt.projectId !== graph.record.id ||
      receipt.stagedRevision !== 1 ||
      receipt.migrationVersion !==
        graph.record.project.algorithmVersions.foundations.v1Migration
    ) {
      throw indexedDbPersistenceError(
        'decode',
        operation,
        'pending receipt must exactly identify the revision-1 staged project and migration registry',
      )
    }
    const tableReceipt = graph.tables.migrationReceipts.find(
      ({ id }) => id === receipt.id,
    )
    if (
      tableReceipt === undefined ||
      !sameCanonicalValue(tableReceipt, receipt)
    ) {
      throw indexedDbPersistenceError(
        'decode',
        operation,
        'the pending receipt must be present byte-equivalently in the staged graph',
      )
    }
    if (receipt.sourceKind === 'local-storage-project-v1') {
      if (sourceEvidence !== null) {
        throw indexedDbPersistenceError(
          'decode',
          operation,
          'localStorage migration does not copy source evidence into IndexedDB',
        )
      }
    } else if (
      sourceEvidence === null ||
      sourceEvidence.sourceKind !== receipt.sourceKind ||
      sourceEvidence.sourceHash !== receipt.sourceHash
    ) {
      throw indexedDbPersistenceError(
        'decode',
        operation,
        'imported project migration requires matching raw source evidence',
      )
    }
  }

  async #assertMatchingSourceEvidence(
    reader: IndexedDbRowReaderV2,
    expected: V1SourceEvidenceRecordV2 | null,
    operation: IndexedDbPersistenceOperation,
  ): Promise<void> {
    if (expected === null) return
    const actual = await reader.get('appMetadata', expected.id)
    if (
      actual === null ||
      !sameCanonicalValue(this.#decodeSourceEvidence(actual, operation), expected)
    ) {
      throw indexedDbPersistenceError(
        'immutable-collision',
        operation,
        'staged migration source evidence is missing or unequal',
      )
    }
  }

  #failure(
    operation: IndexedDbPersistenceOperation,
    point: IndexedDbFailurePointV2,
    projectId: string,
  ): void {
    this.#injectFailure?.({ operation, point, projectId })
  }
}
