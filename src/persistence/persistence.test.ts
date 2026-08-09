import {
  createDefaultProjectState,
  createGenerationSnapshot,
  projectReducer,
} from '../app/state'
import { encodeCandidateJson, decodeCandidateJson, decodeProjectJson, encodeProjectJson } from '../export/json'
import { generateLegacyPopulation } from '../generators/legacy'
import { DEFAULT_LEGACY_SETTINGS } from '../app/state'
import {
  PROJECT_SCHEMA_VERSION,
  createProjectEnvelope,
  decodeProjectEnvelope,
} from './schema'
import {
  PROJECT_STORAGE_KEY,
  loadProjectState,
  saveProjectState,
} from './storage'

function populatedProject() {
  const candidates = generateLegacyPopulation({
    ...DEFAULT_LEGACY_SETTINGS,
    populationSize: 3,
    seed: 'persistence-round-trip',
  })
  const snapshot = createGenerationSnapshot(candidates, 'persistence-round-trip')
  let state = projectReducer(createDefaultProjectState(), {
    type: 'start-population',
    snapshot,
  })
  state = projectReducer(state, { type: 'toggle-favorite', candidate: candidates[1]! })
  state = projectReducer(state, { type: 'set-loop', loop: true })
  return { state, candidate: candidates[1]! }
}

describe('versioned project and candidate JSON', () => {
  it('round-trips a complete project deterministically', () => {
    const { state } = populatedProject()
    const json = encodeProjectJson(state)
    const decoded = decodeProjectJson(json)

    expect(decoded).toEqual({ ok: true, value: state })
    expect(encodeProjectJson(decoded.ok ? decoded.value : state)).toBe(json)
    expect(JSON.parse(json)).toMatchObject({
      kind: 'melody-forge-project',
      schemaVersion: PROJECT_SCHEMA_VERSION,
    })
  })

  it('round-trips a candidate and rejects malformed or unknown envelopes', () => {
    const { candidate } = populatedProject()
    expect(decodeCandidateJson(encodeCandidateJson(candidate))).toEqual({
      ok: true,
      value: candidate,
    })
    expect(decodeCandidateJson('{nope')).toEqual({
      ok: false,
      error: 'The selected file is not valid JSON.',
    })
    expect(
      decodeProjectEnvelope({
        kind: 'melody-forge-project',
        schemaVersion: 999,
        project: {},
      }),
    ).toEqual({
      ok: false,
      error: 'Unsupported project schema version: 999',
    })
  })

  it('rejects a project whose imported melody violates hard constraints', () => {
    const { state } = populatedProject()
    const envelope = createProjectEnvelope(state)
    const firstSnapshot = envelope.project.history[0]!
    const firstCandidate = firstSnapshot.candidates[0]!
    const corrupted = {
      ...envelope,
      project: {
        ...envelope.project,
        history: [
          {
            ...firstSnapshot,
            candidates: [
              {
                ...firstCandidate,
                melody: {
                  ...firstCandidate.melody,
                  events: firstCandidate.melody.events.map((event, index) =>
                    index === 1 ? { ...event, startTick: 1 } : event,
                  ),
                },
              },
              ...firstSnapshot.candidates.slice(1),
            ],
          },
          ...envelope.project.history.slice(1),
        ],
      },
    }

    const decoded = decodeProjectEnvelope(corrupted)
    expect(decoded.ok).toBe(false)
    if (!decoded.ok) {
      expect(decoded.error).toContain('NON_CONTIGUOUS')
    }
  })

  it('rejects duplicate candidate IDs inside an imported snapshot', () => {
    const { state } = populatedProject()
    const envelope = createProjectEnvelope(state)
    const firstSnapshot = envelope.project.history[0]!
    const duplicate = {
      ...envelope,
      project: {
        ...envelope.project,
        history: [
          {
            ...firstSnapshot,
            candidates: [
              firstSnapshot.candidates[0]!,
              { ...firstSnapshot.candidates[1]!, id: firstSnapshot.candidates[0]!.id },
            ],
          },
        ],
      },
    }

    const decoded = decodeProjectEnvelope(duplicate)
    expect(decoded.ok).toBe(false)
    if (!decoded.ok) {
      expect(decoded.error).toContain('unique IDs')
    }
  })
})

describe('local persistence adapter', () => {
  it('returns safe defaults for empty storage', () => {
    const result = loadProjectState({ getItem: () => null })
    expect(result.ok).toBe(true)
    expect(result.state).toEqual(createDefaultProjectState())
    if (result.ok) {
      expect(result.source).toBe('empty')
    }
  })

  it('saves and restores the versioned envelope', () => {
    const { state } = populatedProject()
    let storedKey = ''
    let storedValue = ''
    expect(
      saveProjectState(state, {
        setItem: (key, value) => {
          storedKey = key
          storedValue = value
        },
      }),
    ).toEqual({ ok: true })
    expect(storedKey).toBe(PROJECT_STORAGE_KEY)
    expect(loadProjectState({ getItem: () => storedValue })).toEqual({
      ok: true,
      state,
      source: 'stored',
    })
  })

  it('survives corrupt storage and read/write errors', () => {
    const corrupt = loadProjectState({ getItem: () => '{bad' })
    expect(corrupt.ok).toBe(false)
    expect(corrupt.state).toEqual(createDefaultProjectState())

    const readError = loadProjectState({
      getItem: () => {
        throw new DOMException('Denied', 'SecurityError')
      },
    })
    expect(readError.ok).toBe(false)
    expect(readError.state).toEqual(createDefaultProjectState())

    const writeError = saveProjectState(createDefaultProjectState(), {
      setItem: () => {
        throw new DOMException('Full', 'QuotaExceededError')
      },
    })
    expect(writeError).toMatchObject({ ok: false })
    if (!writeError.ok) {
      expect(writeError.error).toContain('Full')
    }
  })
})
