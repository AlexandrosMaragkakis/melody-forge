import { stableId, stableStringify } from '../domain/identity'
import {
  assertValidMelody,
  cloneCandidate,
  cloneMelody,
  exactMusicalFingerprint,
} from '../domain/invariants'
import {
  RNG_VERSION,
  SeededRandom,
  forkSeed,
  randomBoolean,
  randomInt,
  randomItem,
  type RandomSource,
} from '../domain/random'
import { getScale } from '../domain/scales'
import type {
  Candidate,
  CandidateProvenance,
  EvolutionOperationProvenance,
  EvolutionSettings,
  GenerationSnapshot,
  JsonValue,
  Melody,
} from '../domain/types'
import { analyzePopulationNovelty, melodyNovelty } from './novelty'
import {
  applyMutationOperator,
  assertCompatibleParents,
  compatibleBoundaryCrossover,
  compatibleCrossoverBoundaries,
  contourRhythmCrossover,
} from './operators'
import {
  DEFAULT_MAX_ATTEMPTS_PER_SLOT,
  EVOLUTION_GENERATOR_VERSION,
  MAX_EVOLUTION_POPULATION_SIZE,
  MUTATION_OPERATOR_NAMES,
  type CrossoverKind,
  type DescendantOptions,
  type DiversityNotice,
  type EvolutionRequest,
  type EvolutionResult,
  type MutationOperatorName,
  type NormalizedEvolutionRequest,
} from './types'

const MAX_ATTEMPTS_PER_SLOT = 32

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

export function normalizeMutationStrength(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}

function nextParentGeneration(parents: readonly Candidate[]): number {
  return Math.max(...parents.map(({ provenance }) => provenance.generation)) + 1
}

function normalizeGeneration(
  requestedGeneration: number | undefined,
  parents: readonly Candidate[],
): number {
  const inferred = nextParentGeneration(parents)
  if (requestedGeneration === undefined) {
    return inferred
  }
  if (!Number.isSafeInteger(requestedGeneration) || requestedGeneration < inferred) {
    throw new RangeError(
      `generation must be an integer at least ${String(inferred)}; received ${String(requestedGeneration)}`,
    )
  }
  return requestedGeneration
}

function validateParents(parents: readonly Candidate[]): void {
  assertCompatibleParents(parents)
  for (const parent of parents) {
    assertValidMelody(parent.melody, getScale(parent.melody.constraints.scaleId))
  }
}

export function normalizeEvolutionRequest(
  request: EvolutionRequest,
): NormalizedEvolutionRequest {
  validateParents(request.parents)
  const populationSize = clampInteger(
    request.populationSize,
    1,
    MAX_EVOLUTION_POPULATION_SIZE,
  )
  if (request.retainElites && populationSize <= request.parents.length) {
    throw new RangeError(
      'Population size must leave at least one descendant slot after retaining selected parents',
    )
  }
  const seed = request.seed.trim()
  if (seed.length === 0) {
    throw new RangeError('Evolution seed must contain at least one non-whitespace character')
  }

  return {
    parents: request.parents.map(cloneCandidate),
    populationSize,
    mutationStrength: normalizeMutationStrength(request.mutationStrength),
    retainElites: request.retainElites,
    seed,
    generation: normalizeGeneration(request.generation, request.parents),
    maxAttemptsPerSlot: clampInteger(
      request.maxAttemptsPerSlot ?? DEFAULT_MAX_ATTEMPTS_PER_SLOT,
      1,
      MAX_ATTEMPTS_PER_SLOT,
    ),
  }
}

function mutationOperators(
  strength: number,
  random: RandomSource,
): readonly MutationOperatorName[] {
  if (strength === 0) {
    return []
  }
  const maximumCount = Math.max(1, Math.ceil(strength * 4))
  const count = randomInt(random, 1, maximumCount)
  return Array.from({ length: count }, () =>
    randomItem(random, MUTATION_OPERATOR_NAMES),
  )
}

function inheritOperation(parent: Candidate): EvolutionOperationProvenance {
  return {
    operator: 'inherit-parent',
    parameters: { parentId: parent.id },
  }
}

function zeroMutationOperation(parent: Candidate): EvolutionOperationProvenance {
  return {
    operator: 'zero-mutation-copy',
    parameters: {
      parentId: parent.id,
      mutationStrength: 0,
      crossoverSuppressed: true,
    },
  }
}

function chooseCrossover(
  parents: readonly Candidate[],
  kind: CrossoverKind,
  random: RandomSource,
): { readonly melody: Melody; readonly operation: EvolutionOperationProvenance } {
  const first = parents[0]!
  const second = parents[1]!
  const boundaries = compatibleCrossoverBoundaries(first, second)
  const useBoundary =
    kind === 'compatible-boundary' ||
    (kind === 'auto' && boundaries.length > 0 && randomBoolean(random))

  if (useBoundary && boundaries.length > 0) {
    const crossover = compatibleBoundaryCrossover(first, second, random)
    return { melody: crossover.melody, operation: crossover.operation }
  }

  const swapRoles = randomBoolean(random)
  const pitchParent = swapRoles ? second : first
  const rhythmParent = swapRoles ? first : second
  const crossover = contourRhythmCrossover(pitchParent, rhythmParent)
  return { melody: crossover.melody, operation: crossover.operation }
}

function provenanceSettings(
  options: Required<
    Pick<
      DescendantOptions,
      | 'mutationStrength'
      | 'populationSize'
      | 'retainElites'
      | 'offspringIndex'
      | 'attemptIndex'
      | 'crossover'
      | 'maxAttemptsPerSlot'
    >
  >,
  populationSeed: string,
): Readonly<Record<string, JsonValue>> {
  return {
    mutationStrength: options.mutationStrength,
    populationSize: options.populationSize,
    retainElites: options.retainElites,
    offspringIndex: options.offspringIndex,
    attemptIndex: options.attemptIndex,
    crossover: options.crossover,
    populationSeed,
    maxAttemptsPerSlot: options.maxAttemptsPerSlot,
    rngVersion: RNG_VERSION,
  }
}

/**
 * Creates one evolved child. At zero mutation the selected source parent is
 * copied exactly and crossover is suppressed, making identity explicit.
 */
export function createDescendant(
  parents: readonly Candidate[],
  requestedOptions: DescendantOptions,
  injectedRandom?: RandomSource,
): Candidate {
  validateParents(parents)
  const seed = requestedOptions.seed.trim()
  if (seed.length === 0) {
    throw new RangeError('Descendant seed must contain at least one non-whitespace character')
  }
  const strength = normalizeMutationStrength(requestedOptions.mutationStrength)
  const generation = normalizeGeneration(requestedOptions.generation, parents)
  const offspringIndex = clampInteger(requestedOptions.offspringIndex ?? 0, 0, 1_000_000)
  const attemptIndex = clampInteger(requestedOptions.attemptIndex ?? 0, 0, 1_000_000)
  const populationSize = clampInteger(
    requestedOptions.populationSize ?? 1,
    1,
    MAX_EVOLUTION_POPULATION_SIZE,
  )
  const retainElites = requestedOptions.retainElites ?? false
  const crossover = requestedOptions.crossover ?? 'auto'
  const populationSeed = (requestedOptions.populationSeed ?? seed).trim()
  const maxAttemptsPerSlot = clampInteger(
    requestedOptions.maxAttemptsPerSlot ?? DEFAULT_MAX_ATTEMPTS_PER_SLOT,
    1,
    MAX_ATTEMPTS_PER_SLOT,
  )
  const random = injectedRandom ?? new SeededRandom(seed)
  const operations: EvolutionOperationProvenance[] = []
  let melody: Melody

  if (strength === 0) {
    const identityParent = parents[(offspringIndex + attemptIndex) % parents.length]!
    melody = cloneMelody(identityParent.melody)
    operations.push(zeroMutationOperation(identityParent))
  } else if (parents.length === 1) {
    melody = cloneMelody(parents[0]!.melody)
    operations.push(inheritOperation(parents[0]!))
  } else {
    const crossed = chooseCrossover(parents, crossover, random)
    melody = crossed.melody
    operations.push(crossed.operation)
  }

  const selectedOperators =
    requestedOptions.mutationOperators ?? mutationOperators(strength, random)
  let mutationChanged = false
  for (const operator of selectedOperators) {
    const mutation = applyMutationOperator(melody, operator, strength, random)
    melody = mutation.melody
    operations.push(mutation.operation)
    mutationChanged ||= mutation.changed
  }

  // Positive strength always gets an actual mutation when any legal move
  // exists. Trying a fixed fallback order keeps the behavior deterministic.
  if (strength > 0 && !mutationChanged) {
    const fallbackOperators: readonly MutationOperatorName[] = [
      'degree-move',
      'rest-toggle',
      'rhythm-split',
      'rhythm-merge',
      'motif-transpose',
      'motif-reverse',
      'motif-shift',
      'motif-invert',
      'motif-repeat',
    ]
    for (const operator of fallbackOperators) {
      const mutation = applyMutationOperator(melody, operator, strength, random)
      melody = mutation.melody
      operations.push(mutation.operation)
      if (mutation.changed) {
        break
      }
    }
  }

  const scale = getScale(melody.constraints.scaleId)
  assertValidMelody(melody, scale)
  const normalizedOptions = {
    mutationStrength: strength,
    populationSize,
    retainElites,
    offspringIndex,
    attemptIndex,
    crossover,
    maxAttemptsPerSlot,
  } as const
  const provenance: CandidateProvenance = {
    strategy: 'evolution',
    generatorVersion: EVOLUTION_GENERATOR_VERSION,
    seed,
    settings: provenanceSettings(normalizedOptions, populationSeed),
    generation,
    parentIds: parents.map(({ id }) => id),
    operations,
  }

  return {
    id: stableId('evolved', { melody, provenance }),
    melody,
    provenance,
  }
}

interface Proposal {
  readonly candidate: Candidate
  readonly fingerprint: string
  readonly noveltyMean: number
}

function proposalNoveltyMean(
  candidate: Candidate,
  accepted: readonly Candidate[],
): number {
  if (accepted.length === 0) {
    return 0
  }
  return Math.min(
    ...accepted.map(
      (other) => melodyNovelty(candidate.melody, other.melody).mean,
    ),
  )
}

function bestProposal(proposals: readonly Proposal[]): Proposal {
  return proposals.reduce((best, proposal) =>
    proposal.noveltyMean > best.noveltyMean ? proposal : best,
  )
}

function generationSeed(request: NormalizedEvolutionRequest): string {
  return stableStringify({
    generatorVersion: EVOLUTION_GENERATOR_VERSION,
    rngVersion: RNG_VERSION,
    seed: request.seed,
    generation: request.generation,
    parentIds: request.parents.map(({ id }) => id),
    populationSize: request.populationSize,
    mutationStrength: request.mutationStrength,
    retainElites: request.retainElites,
    maxAttemptsPerSlot: request.maxAttemptsPerSlot,
  })
}

export function evolvePopulation(request: EvolutionRequest): EvolutionResult {
  const normalized = normalizeEvolutionRequest(request)
  const candidates: Candidate[] = []
  const fingerprints = new Set<string>()
  const notices: DiversityNotice[] = []
  let rejectedExactDuplicates = 0
  let attemptedDescendants = 0
  let discardedLowerNoveltyCandidates = 0

  if (normalized.retainElites) {
    for (const parent of normalized.parents) {
      const fingerprint = exactMusicalFingerprint(parent.melody)
      if (fingerprints.has(fingerprint)) {
        notices.push({
          code: 'duplicate-selected-parent',
          message: `Selected parent ${parent.id} was musically identical to an earlier elite and was not duplicated.`,
        })
        rejectedExactDuplicates += 1
        continue
      }
      candidates.push(cloneCandidate(parent))
      fingerprints.add(fingerprint)
    }
  }

  const rootSeed = generationSeed(normalized)
  while (candidates.length < normalized.populationSize) {
    const offspringIndex = candidates.length
    const proposals: Proposal[] = []
    const proposalFingerprints = new Set<string>()

    for (
      let attemptIndex = 0;
      attemptIndex < normalized.maxAttemptsPerSlot;
      attemptIndex += 1
    ) {
      attemptedDescendants += 1
      const childSeed = forkSeed(
        rootSeed,
        `offspring-${String(offspringIndex)}-attempt-${String(attemptIndex)}`,
      )
      const candidate = createDescendant(normalized.parents, {
        seed: childSeed,
        generation: normalized.generation,
        mutationStrength: normalized.mutationStrength,
        populationSize: normalized.populationSize,
        retainElites: normalized.retainElites,
        offspringIndex,
        attemptIndex,
        crossover: 'auto',
        populationSeed: normalized.seed,
        maxAttemptsPerSlot: normalized.maxAttemptsPerSlot,
      })
      const fingerprint = exactMusicalFingerprint(candidate.melody)

      if (fingerprints.has(fingerprint) || proposalFingerprints.has(fingerprint)) {
        rejectedExactDuplicates += 1
        continue
      }
      proposalFingerprints.add(fingerprint)
      proposals.push({
        candidate,
        fingerprint,
        noveltyMean: proposalNoveltyMean(candidate, candidates),
      })
    }

    if (proposals.length === 0) {
      break
    }

    const selected = bestProposal(proposals)
    candidates.push(selected.candidate)
    fingerprints.add(selected.fingerprint)
    discardedLowerNoveltyCandidates += proposals.length - 1
  }

  const underfilled = candidates.length < normalized.populationSize
  if (underfilled) {
    notices.push({
      code: 'underfilled-after-deduplication',
      message:
        `Produced ${String(candidates.length)} of ${String(normalized.populationSize)} requested unique candidates ` +
        `after ${String(attemptedDescendants)} deterministic attempts; exact deduplication prevented silent copies.`,
    })
  }

  return {
    candidates,
    diversity: {
      requestedPopulationSize: normalized.populationSize,
      producedPopulationSize: candidates.length,
      uniqueFingerprintCount: fingerprints.size,
      attemptedDescendants,
      rejectedExactDuplicates,
      discardedLowerNoveltyCandidates,
      maxAttemptsPerSlot: normalized.maxAttemptsPerSlot,
      underfilled,
      notices,
      novelty: analyzePopulationNovelty(candidates),
    },
  }
}

export interface EvolveSnapshotSettings extends EvolutionSettings {
  readonly seed: string
  readonly maxAttemptsPerSlot?: number
}

/** Uses snapshot generation rather than elite birth generation when advancing history. */
export function evolveFromSnapshot(
  snapshot: GenerationSnapshot,
  selectedParentIds: readonly string[],
  settings: EvolveSnapshotSettings,
): EvolutionResult {
  const selected = selectedParentIds.map((id) => {
    const candidate = snapshot.candidates.find((item) => item.id === id)
    if (candidate === undefined) {
      throw new RangeError(`Selected parent ${id} is not in generation ${String(snapshot.generation)}`)
    }
    return candidate
  })

  return evolvePopulation({
    parents: selected,
    seed: settings.seed,
    generation: snapshot.generation + 1,
    populationSize: settings.populationSize,
    mutationStrength: settings.mutationStrength,
    retainElites: settings.retainElites,
    ...(settings.maxAttemptsPerSlot === undefined
      ? {}
      : { maxAttemptsPerSlot: settings.maxAttemptsPerSlot }),
  })
}
