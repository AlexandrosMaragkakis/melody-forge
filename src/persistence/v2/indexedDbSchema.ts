export const SCHEMA_2_DATABASE_NAME = 'melody-forge-v2'
export const SCHEMA_2_DATABASE_VERSION = 1

/**
 * This order is part of the schema-2 persistence contract. Keep it separate
 * from DOMStringList iteration, which is implementation sorted rather than
 * creation ordered.
 */
export const SCHEMA_2_STORE_NAMES = [
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
] as const

export type Schema2StoreName = (typeof SCHEMA_2_STORE_NAMES)[number]

export const SCHEMA_2_PROJECT_TABLE_STORE_NAMES = [
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
] as const

export type Schema2ProjectTableStoreName =
  (typeof SCHEMA_2_PROJECT_TABLE_STORE_NAMES)[number]

export const MIGRATION_RECEIPT_SOURCE_HASH_INDEX = 'sourceHash'

function stringListValues(list: DOMStringList): readonly string[] {
  return Array.from({ length: list.length }, (_, index) => list.item(index)!)
}

function sameStringSet(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    expected.every((value) => actual.includes(value))
  )
}

export class IndexedDbSchemaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IndexedDbSchemaError'
  }
}

/** Create version 1 from an empty database. No implicit repair is permitted. */
export function createSchema2Stores(
  database: IDBDatabase,
  oldVersion: number,
): void {
  if (oldVersion !== 0) {
    throw new IndexedDbSchemaError(
      `unsupported melody-forge-v2 upgrade from database version ${String(oldVersion)}`,
    )
  }

  for (const storeName of SCHEMA_2_STORE_NAMES) {
    const store = database.createObjectStore(storeName, { keyPath: 'id' })
    if (storeName === 'migrationReceipts') {
      store.createIndex(
        MIGRATION_RECEIPT_SOURCE_HASH_INDEX,
        MIGRATION_RECEIPT_SOURCE_HASH_INDEX,
        { unique: true },
      )
    }
  }
}

/**
 * Reject pre-existing databases that merely happen to have version 1 but do
 * not implement the frozen schema. Schema mismatch is never repaired by
 * deleting user data.
 */
export function assertExactSchema2Database(database: IDBDatabase): void {
  if (database.version !== SCHEMA_2_DATABASE_VERSION) {
    throw new IndexedDbSchemaError(
      `expected database version ${String(SCHEMA_2_DATABASE_VERSION)}; received ${String(database.version)}`,
    )
  }

  const actualStoreNames = stringListValues(database.objectStoreNames)
  if (!sameStringSet(actualStoreNames, SCHEMA_2_STORE_NAMES)) {
    throw new IndexedDbSchemaError(
      `object stores must be exactly ${SCHEMA_2_STORE_NAMES.join(', ')}; received ${actualStoreNames.join(', ')}`,
    )
  }

  const transaction = database.transaction(SCHEMA_2_STORE_NAMES, 'readonly')
  for (const storeName of SCHEMA_2_STORE_NAMES) {
    const store = transaction.objectStore(storeName)
    if (store.keyPath !== 'id' || store.autoIncrement) {
      throw new IndexedDbSchemaError(
        `${storeName} must use embedded keyPath id without autoIncrement`,
      )
    }

    const indexNames = stringListValues(store.indexNames)
    if (storeName === 'migrationReceipts') {
      if (
        indexNames.length !== 1 ||
        indexNames[0] !== MIGRATION_RECEIPT_SOURCE_HASH_INDEX
      ) {
        throw new IndexedDbSchemaError(
          'migrationReceipts must have only the sourceHash index',
        )
      }
      const index = store.index(MIGRATION_RECEIPT_SOURCE_HASH_INDEX)
      if (
        index.keyPath !== MIGRATION_RECEIPT_SOURCE_HASH_INDEX ||
        !index.unique ||
        index.multiEntry
      ) {
        throw new IndexedDbSchemaError(
          'migrationReceipts/sourceHash must be a unique, single-entry sourceHash index',
        )
      }
    } else if (indexNames.length !== 0) {
      throw new IndexedDbSchemaError(
        `${storeName} must not contain secondary indexes`,
      )
    }
  }
}
