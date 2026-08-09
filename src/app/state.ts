import { stableId } from '../domain/identity'
import { cloneCandidate, cloneGenerationSnapshot } from '../domain/invariants'
import type {
  Candidate,
  EvolutionSettings,
  GenerationSnapshot,
} from '../domain/types'
import type { LegacyGeneratorSettings } from '../generators/legacy'
import { DEFAULT_MODERN_SETTINGS, type ModernSettings } from '../generators/modern'
import type { GeneratorMode } from './types'

export const MAX_HISTORY_LENGTH = 24
export const MAX_FAVORITES = 64

export interface GenerationSnapshotMetadata {
  readonly generation?: number
  readonly generatorVersion?: string
}

export interface ProjectState {
  readonly mode: GeneratorMode
  readonly legacySettings: LegacyGeneratorSettings
  readonly modernSettings: ModernSettings
  readonly evolutionSettings: EvolutionSettings
  readonly history: readonly GenerationSnapshot[]
  readonly historyIndex: number
  readonly favorites: readonly Candidate[]
  readonly loop: boolean
}

export const DEFAULT_LEGACY_SETTINGS: LegacyGeneratorSettings = {
  tonicPitchClass: 0,
  scaleId: 'diatonic-ionian',
  noteCount: 8,
  tempoBpm: 108,
  populationSize: 8,
  seed: 'legacy-amber',
}

export const DEFAULT_EVOLUTION_SETTINGS: EvolutionSettings = {
  populationSize: 8,
  mutationStrength: 0.28,
  retainElites: true,
}

export function createDefaultProjectState(): ProjectState {
  return {
    mode: 'legacy',
    legacySettings: { ...DEFAULT_LEGACY_SETTINGS },
    modernSettings: { ...DEFAULT_MODERN_SETTINGS },
    evolutionSettings: { ...DEFAULT_EVOLUTION_SETTINGS },
    history: [],
    historyIndex: -1,
    favorites: [],
    loop: false,
  }
}

export function createGenerationSnapshot(
  candidates: readonly Candidate[],
  seed: string,
  selectedParentIds: readonly string[] = [],
  evolutionSettings: EvolutionSettings | null = null,
  previousGenerationId: string | null = null,
  metadata: GenerationSnapshotMetadata = {},
): GenerationSnapshot {
  if (candidates.length === 0) {
    throw new RangeError('A generation snapshot needs at least one candidate')
  }

  // Elites remain byte-for-byte unchanged, including their earlier provenance,
  // so an evolved snapshot may intentionally mix candidate generation numbers.
  const newestCandidateGeneration = Math.max(
    ...candidates.map((candidate) => candidate.provenance.generation),
  )
  const generation = metadata.generation ?? newestCandidateGeneration
  if (
    !Number.isSafeInteger(generation) ||
    generation < newestCandidateGeneration
  ) {
    throw new RangeError(
      'Snapshot generation must be an integer no earlier than any candidate birth generation',
    )
  }
  const generationOwner =
    candidates.find(
      (candidate) =>
        candidate.provenance.generation === newestCandidateGeneration,
    ) ?? candidates[0]!
  const generatorVersion =
    metadata.generatorVersion?.trim() || generationOwner.provenance.generatorVersion
  const snapshotData = {
    generation,
    seed,
    generatorVersion,
    candidates: candidates.map(cloneCandidate),
    selectedParentIds: [...selectedParentIds],
    evolutionSettings:
      evolutionSettings === null ? null : { ...evolutionSettings },
    previousGenerationId,
  }

  return {
    id: stableId('generation', snapshotData),
    ...snapshotData,
  }
}

export function activeSnapshot(state: ProjectState): GenerationSnapshot | null {
  if (state.historyIndex < 0 || state.historyIndex >= state.history.length) {
    return null
  }
  return state.history[state.historyIndex] ?? null
}

export type ProjectAction =
  | { readonly type: 'set-mode'; readonly mode: GeneratorMode }
  | {
      readonly type: 'set-legacy-settings'
      readonly settings: LegacyGeneratorSettings
    }
  | { readonly type: 'set-modern-settings'; readonly settings: ModernSettings }
  | {
      readonly type: 'set-evolution-settings'
      readonly settings: EvolutionSettings
    }
  | { readonly type: 'set-loop'; readonly loop: boolean }
  | { readonly type: 'start-population'; readonly snapshot: GenerationSnapshot }
  | { readonly type: 'append-generation'; readonly snapshot: GenerationSnapshot }
  | { readonly type: 'view-history'; readonly index: number }
  | { readonly type: 'toggle-favorite'; readonly candidate: Candidate }
  | { readonly type: 'replace-project'; readonly state: ProjectState }

export function projectReducer(
  state: ProjectState,
  action: ProjectAction,
): ProjectState {
  switch (action.type) {
    case 'set-mode':
      return { ...state, mode: action.mode }
    case 'set-legacy-settings':
      return { ...state, legacySettings: { ...action.settings } }
    case 'set-modern-settings':
      return { ...state, modernSettings: { ...action.settings } }
    case 'set-evolution-settings':
      return { ...state, evolutionSettings: { ...action.settings } }
    case 'set-loop':
      return { ...state, loop: action.loop }
    case 'start-population':
      return {
        ...state,
        history: [cloneGenerationSnapshot(action.snapshot)],
        historyIndex: 0,
      }
    case 'append-generation': {
      const branch = state.history.slice(0, state.historyIndex + 1)
      const history = [...branch, cloneGenerationSnapshot(action.snapshot)].slice(
        -MAX_HISTORY_LENGTH,
      )
      return { ...state, history, historyIndex: history.length - 1 }
    }
    case 'view-history': {
      if (!Number.isSafeInteger(action.index)) {
        return state
      }
      const historyIndex = Math.min(
        state.history.length - 1,
        Math.max(0, action.index),
      )
      return { ...state, historyIndex }
    }
    case 'toggle-favorite': {
      const exists = state.favorites.some(({ id }) => id === action.candidate.id)
      return {
        ...state,
        favorites: exists
          ? state.favorites.filter(({ id }) => id !== action.candidate.id)
          : [...state.favorites, cloneCandidate(action.candidate)].slice(
              -MAX_FAVORITES,
            ),
      }
    }
    case 'replace-project':
      return cloneProjectState(action.state)
  }
}

export function cloneProjectState(state: ProjectState): ProjectState {
  const history = state.history
    .slice(-MAX_HISTORY_LENGTH)
    .map(cloneGenerationSnapshot)
  return {
    mode: state.mode,
    legacySettings: { ...state.legacySettings },
    modernSettings: { ...state.modernSettings },
    evolutionSettings: { ...state.evolutionSettings },
    history,
    historyIndex:
      history.length === 0
        ? -1
        : Math.min(history.length - 1, Math.max(0, state.historyIndex)),
    favorites: state.favorites.slice(-MAX_FAVORITES).map(cloneCandidate),
    loop: state.loop,
  }
}
