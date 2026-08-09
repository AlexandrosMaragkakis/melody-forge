import { generateLegacyPopulation } from '../generators/legacy'
import {
  DEFAULT_LEGACY_SETTINGS,
  MAX_FAVORITES,
  MAX_HISTORY_LENGTH,
  activeSnapshot,
  createDefaultProjectState,
  createGenerationSnapshot,
  projectReducer,
} from './state'

describe('project state', () => {
  it('starts, navigates, branches, and bounds generation history', () => {
    const candidates = generateLegacyPopulation({
      ...DEFAULT_LEGACY_SETTINGS,
      populationSize: 2,
    })
    const first = createGenerationSnapshot(candidates, 'first')
    let state = projectReducer(createDefaultProjectState(), {
      type: 'start-population',
      snapshot: first,
    })

    for (let index = 1; index <= MAX_HISTORY_LENGTH + 3; index += 1) {
      const snapshot = {
        ...createGenerationSnapshot(candidates, `seed-${String(index)}`),
        generation: index,
        candidates: candidates.map((candidate) => ({
          ...candidate,
          provenance: { ...candidate.provenance, generation: index },
        })),
      }
      state = projectReducer(state, { type: 'append-generation', snapshot })
    }

    expect(state.history).toHaveLength(MAX_HISTORY_LENGTH)
    expect(activeSnapshot(state)?.generation).toBe(MAX_HISTORY_LENGTH + 3)

    state = projectReducer(state, { type: 'view-history', index: 2 })
    expect(activeSnapshot(state)?.generation).toBe(6)
    state = projectReducer(state, {
      type: 'append-generation',
      snapshot: {
        ...first,
        id: 'generation-branch',
        generation: 99,
        candidates: candidates.map((candidate) => ({
          ...candidate,
          provenance: { ...candidate.provenance, generation: 99 },
        })),
      },
    })
    expect(state.history).toHaveLength(4)
    expect(activeSnapshot(state)?.generation).toBe(99)
  })

  it('toggles immutable favorite copies', () => {
    const candidate = generateLegacyPopulation({
      ...DEFAULT_LEGACY_SETTINGS,
      populationSize: 2,
    })[0]!
    const initial = createDefaultProjectState()
    const favorite = projectReducer(initial, { type: 'toggle-favorite', candidate })

    expect(favorite.favorites).toEqual([candidate])
    expect(favorite.favorites[0]).not.toBe(candidate)
    expect(
      projectReducer(favorite, { type: 'toggle-favorite', candidate }).favorites,
    ).toEqual([])
  })

  it('bounds favorites while keeping the most recently saved candidates', () => {
    const candidate = generateLegacyPopulation({
      ...DEFAULT_LEGACY_SETTINGS,
      populationSize: 2,
    })[0]!
    let state = createDefaultProjectState()

    for (let index = 0; index <= MAX_FAVORITES; index += 1) {
      state = projectReducer(state, {
        type: 'toggle-favorite',
        candidate: { ...candidate, id: `favorite-${String(index)}` },
      })
    }

    expect(state.favorites).toHaveLength(MAX_FAVORITES)
    expect(state.favorites[0]?.id).toBe('favorite-1')
    expect(state.favorites.at(-1)?.id).toBe(`favorite-${String(MAX_FAVORITES)}`)
  })

  it('records an evolved snapshot generation even when zero mutation returns only an old elite', () => {
    const candidate = generateLegacyPopulation({
      ...DEFAULT_LEGACY_SETTINGS,
      populationSize: 2,
    })[0]!
    const initial = createGenerationSnapshot([candidate], 'initial')
    const evolved = createGenerationSnapshot(
      [candidate],
      'zero-mutation',
      [candidate.id],
      { populationSize: 8, mutationStrength: 0, retainElites: true },
      initial.id,
      { generation: 1, generatorVersion: 'interactive-evolution-v1' },
    )

    expect(evolved.generation).toBe(1)
    expect(evolved.generatorVersion).toBe('interactive-evolution-v1')
    expect(evolved.candidates[0]?.provenance.generation).toBe(0)
    expect(evolved.previousGenerationId).toBe(initial.id)
  })
})
