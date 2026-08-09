import type {
  Candidate,
  EvolutionOperationProvenance,
  EvolutionSettings,
  Melody,
} from '../domain/types'

export const EVOLUTION_GENERATOR_VERSION = 'interactive-evolution-v1' as const
export const DEFAULT_MAX_ATTEMPTS_PER_SLOT = 6
export const MAX_EVOLUTION_POPULATION_SIZE = 16
export const MIN_EVOLUTION_EVENT_COUNT = 4
export const MAX_EVOLUTION_EVENT_COUNT = 32

export const DEFAULT_EVOLUTION_SETTINGS: EvolutionSettings = {
  populationSize: 8,
  mutationStrength: 0.3,
  retainElites: true,
}

export const MUTATION_OPERATOR_NAMES = [
  'degree-move',
  'motif-repeat',
  'motif-reverse',
  'motif-shift',
  'motif-invert',
  'motif-transpose',
  'rhythm-split',
  'rhythm-merge',
  'rest-toggle',
] as const

export type MutationOperatorName = (typeof MUTATION_OPERATOR_NAMES)[number]
export type CrossoverKind = 'auto' | 'compatible-boundary' | 'contour-rhythm'

export interface EvolutionRequest extends EvolutionSettings {
  readonly parents: readonly Candidate[]
  readonly seed: string
  /** Target generation. Omit to use one more than the newest selected parent. */
  readonly generation?: number
  /** Bounded deterministic search budget for each open population slot. */
  readonly maxAttemptsPerSlot?: number
}

export interface NormalizedEvolutionRequest extends EvolutionSettings {
  readonly parents: readonly Candidate[]
  readonly seed: string
  readonly generation: number
  readonly maxAttemptsPerSlot: number
}

export interface DescendantOptions {
  readonly seed: string
  readonly mutationStrength: number
  readonly generation?: number
  readonly populationSize?: number
  readonly retainElites?: boolean
  readonly offspringIndex?: number
  readonly attemptIndex?: number
  readonly crossover?: CrossoverKind
  readonly populationSeed?: string
  readonly maxAttemptsPerSlot?: number
  /** Useful for focused operator proofs; normal population evolution omits it. */
  readonly mutationOperators?: readonly MutationOperatorName[]
}

export interface EvolutionOperatorResult {
  readonly melody: Melody
  readonly changed: boolean
  readonly operation: EvolutionOperationProvenance
}

export interface NoveltyComponents {
  /** Mean normalized extended-degree difference during jointly sounding time. */
  readonly pitch: number
  /** Jaccard distance between internal event-boundary sets. */
  readonly rhythm: number
  /** Fraction of grid samples whose rest/sounding state differs. */
  readonly rests: number
  /** Equal-weight mean of the three explicit components; this is not a quality score. */
  readonly mean: number
}

export interface CandidateNoveltyReport {
  readonly candidateId: string
  readonly nearestCandidateId: string | null
  readonly components: NoveltyComponents | null
}

export type DiversityNoticeCode =
  | 'underfilled-after-deduplication'
  | 'duplicate-selected-parent'

export interface DiversityNotice {
  readonly code: DiversityNoticeCode
  readonly message: string
}

export interface EvolutionDiversityReport {
  readonly requestedPopulationSize: number
  readonly producedPopulationSize: number
  readonly uniqueFingerprintCount: number
  readonly attemptedDescendants: number
  readonly rejectedExactDuplicates: number
  readonly discardedLowerNoveltyCandidates: number
  readonly maxAttemptsPerSlot: number
  readonly underfilled: boolean
  readonly notices: readonly DiversityNotice[]
  readonly novelty: readonly CandidateNoveltyReport[]
}

export interface EvolutionResult {
  readonly candidates: readonly Candidate[]
  readonly diversity: EvolutionDiversityReport
}
