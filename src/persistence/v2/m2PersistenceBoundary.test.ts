import { createNewProjectKernelV2 } from '../../domain/v2'
import {
  REGISTERED_M2_PERSISTENCE_BOUNDARY_V2,
  loadRegisteredM2ProjectGraphV2,
} from './m2PersistenceBoundary'
import {
  SCHEMA_2_PROJECT_TABLE_STORE_NAMES,
  SCHEMA_2_STORE_NAMES,
  type Schema2StoreName,
} from './indexedDbSchema'
import type { IndexedDbRowReaderV2 } from './indexedDbAuthority'

class MemoryRowReader implements IndexedDbRowReaderV2 {
  readonly stores = new Map<Schema2StoreName, Map<string, unknown>>(
    SCHEMA_2_STORE_NAMES.map((name) => [name, new Map()]),
  )

  put<T extends Readonly<{ id: string }>>(
    storeName: Schema2StoreName,
    value: T,
  ): void {
    this.stores.get(storeName)!.set(value.id, value)
  }

  delete(storeName: Schema2StoreName, id: string): void {
    this.stores.get(storeName)!.delete(id)
  }

  get(storeName: Schema2StoreName, id: string): Promise<unknown> {
    return Promise.resolve(this.stores.get(storeName)!.get(id) ?? null)
  }

  getAll(storeName: Schema2StoreName): Promise<readonly unknown[]> {
    return Promise.resolve([...this.stores.get(storeName)!.values()])
  }
}

function readerForGraph(
  graph: ReturnType<typeof createNewProjectKernelV2>,
): MemoryRowReader {
  const reader = new MemoryRowReader()
  reader.put('projects', graph.record)
  SCHEMA_2_PROJECT_TABLE_STORE_NAMES.forEach((storeName) => {
    graph.tables[storeName].forEach((row) => reader.put(storeName, row))
  })
  return reader
}

describe('registered M2 persistence boundary', () => {
  it('reconstructs and validates exactly one fresh project closure', async () => {
    const graph = createNewProjectKernelV2({
      projectIdFactory: () => 'project-boundary-a',
      metadataClock: () => 123,
    })
    const reader = readerForGraph(graph)

    const loaded = await loadRegisteredM2ProjectGraphV2(
      reader,
      graph.record.id,
    )
    expect(REGISTERED_M2_PERSISTENCE_BOUNDARY_V2.decodeGraph(loaded)).toEqual(
      graph,
    )
  })

  it('does not mix project-owned rows or global closures from other projects', async () => {
    const first = createNewProjectKernelV2({
      projectIdFactory: () => 'project-boundary-first',
      metadataClock: () => 1,
    })
    const second = createNewProjectKernelV2({
      projectIdFactory: () => 'project-boundary-second',
      metadataClock: () => 2,
    })
    const reader = readerForGraph(first)
    reader.put('projects', second.record)
    SCHEMA_2_PROJECT_TABLE_STORE_NAMES.forEach((storeName) => {
      second.tables[storeName].forEach((row) => reader.put(storeName, row))
    })

    const loaded = await loadRegisteredM2ProjectGraphV2(
      reader,
      first.record.id,
    )
    expect(REGISTERED_M2_PERSISTENCE_BOUNDARY_V2.decodeGraph(loaded)).toEqual(
      first,
    )
  })

  it('surfaces a missing global strong row to the graph codec', async () => {
    const graph = createNewProjectKernelV2({
      projectIdFactory: () => 'project-boundary-missing',
      metadataClock: () => 3,
    })
    const reader = readerForGraph(graph)
    reader.delete('transports', graph.tables.transports[0]!.id)

    const loaded = await loadRegisteredM2ProjectGraphV2(
      reader,
      graph.record.id,
    )
    expect(() =>
      REGISTERED_M2_PERSISTENCE_BOUNDARY_V2.decodeGraph(loaded),
    ).toThrow(/comparisonTransportId|transport/u)
  })

  it('includes project-owned reserved rows so strict decoding rejects them', async () => {
    const graph = createNewProjectKernelV2({
      projectIdFactory: () => 'project-boundary-reserved',
      metadataClock: () => 4,
    })
    const reader = readerForGraph(graph)
    reader.put('preferenceRecords', {
      id: 'future-preference-row',
      projectId: graph.record.id,
    })

    const loaded = await loadRegisteredM2ProjectGraphV2(
      reader,
      graph.record.id,
    )
    expect(() =>
      REGISTERED_M2_PERSISTENCE_BOUNDARY_V2.decodeGraph(loaded),
    ).toThrow(/reserved|registered M2/u)
  })

  it('returns null only when the stored project record is absent', async () => {
    const reader = new MemoryRowReader()
    await expect(
      loadRegisteredM2ProjectGraphV2(reader, 'missing-project'),
    ).resolves.toBeNull()
  })
})
