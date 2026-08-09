import { IDBFactory } from 'fake-indexeddb'
import { createNewProjectKernelV2 } from '../../domain/v2'
import type { StoredProjectGraphV2 } from '../../domain/v2/types'
import { NativeIndexedDbAuthorityV2 } from './indexedDbAuthority'
import { REGISTERED_M2_PERSISTENCE_BOUNDARY_V2 } from './m2PersistenceBoundary'

describe('native IndexedDB with the registered M2 boundary', () => {
  it('round-trips and revision-saves an exact fresh schema-2 project', async () => {
    const graph = createNewProjectKernelV2({
      projectIdFactory: () => 'project-native-indexeddb',
      metadataClock: () => 123,
    })
    const store = new NativeIndexedDbAuthorityV2({
      indexedDb: new IDBFactory(),
      boundary: REGISTERED_M2_PERSISTENCE_BOUNDARY_V2,
    })

    const active = await store.installAndActivateProject({
      graph,
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    })
    expect(active).toEqual({
      id: 'active-project',
      version: 'active-project-metadata-v2',
      projectId: graph.record.id,
      revision: 1,
    })
    await expect(store.loadActiveProject()).resolves.toEqual(graph)

    const revised: StoredProjectGraphV2 = {
      record: {
        ...graph.record,
        revision: 2,
        project: {
          ...graph.record.project,
          name: 'Renamed without changing identity',
          updatedAtEpochMs: 124,
        },
      },
      tables: graph.tables,
    }
    await expect(store.saveProject(revised, 1)).resolves.toEqual(
      revised.record,
    )
    await expect(store.loadActiveProject()).resolves.toEqual(revised)
  })
})
