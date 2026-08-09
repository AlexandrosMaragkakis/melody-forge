import { createDefaultProjectState, type ProjectState } from '../app/state'
import { decodeProjectEnvelope, createProjectEnvelope } from './schema'

export const PROJECT_STORAGE_KEY = 'melody-forge:project:v1'

export type StorageLoadResult =
  | {
      readonly ok: true
      readonly state: ProjectState
      readonly source: 'stored' | 'empty'
    }
  | { readonly ok: false; readonly state: ProjectState; readonly error: string }

export type StorageSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }

type StorageReader = Pick<Storage, 'getItem'>
type StorageWriter = Pick<Storage, 'setItem'>

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function loadProjectState(
  storage: StorageReader = window.localStorage,
): StorageLoadResult {
  let serialized: string | null
  try {
    serialized = storage.getItem(PROJECT_STORAGE_KEY)
  } catch (error) {
    return {
      ok: false,
      state: createDefaultProjectState(),
      error: `Local storage could not be read: ${errorMessage(error)}`,
    }
  }

  if (serialized === null) {
    return { ok: true, state: createDefaultProjectState(), source: 'empty' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized) as unknown
  } catch {
    return {
      ok: false,
      state: createDefaultProjectState(),
      error: 'Saved local data was not valid JSON, so safe defaults were loaded.',
    }
  }

  const decoded = decodeProjectEnvelope(parsed)
  return decoded.ok
    ? { ok: true, state: decoded.value, source: 'stored' }
    : {
        ok: false,
        state: createDefaultProjectState(),
        error: `Saved local data was incompatible: ${decoded.error}`,
      }
}

export function saveProjectState(
  state: ProjectState,
  storage: StorageWriter = window.localStorage,
): StorageSaveResult {
  try {
    storage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify(createProjectEnvelope(state)),
    )
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: `Local storage could not save this project: ${errorMessage(error)}`,
    }
  }
}
