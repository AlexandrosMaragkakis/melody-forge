import { stableStringify } from './identity'
import { RNG_VERSION, SeededRandom, forkSeed } from './random'

export const SEED_TREE_VERSION = 'labelled-seed-tree-v2' as const

export const SEED_STREAM_LABELS = Object.freeze([
  'generator',
  'generation',
  'algorithm',
  'island',
  'map-cell',
  'pareto-run',
  'candidate',
  'operator',
  'melody',
  'rhythm',
  'tonality',
  'beat',
  'collaborator-selection',
  'ui-only-shuffling',
  'attempt',
] as const)

export type SeedStreamLabel = (typeof SEED_STREAM_LABELS)[number]
export type SeedStreamKey = string | number

const SEED_STREAM_LABEL_SET: ReadonlySet<string> = new Set(
  SEED_STREAM_LABELS,
)

export interface SeedPathSegment {
  readonly label: SeedStreamLabel
  readonly key: SeedStreamKey | null
}

export interface SeedTreeProvenance {
  readonly version: typeof SEED_TREE_VERSION
  readonly rngVersion: typeof RNG_VERSION
  readonly rootSeed: string
  readonly path: readonly SeedPathSegment[]
  readonly derivedSeed: string
}

function normalizeRootSeed(seed: string): string {
  const normalized = seed.trim()
  if (normalized.length === 0) {
    throw new RangeError('Root seed must contain at least one non-whitespace character')
  }
  if (normalized.length > 256) {
    throw new RangeError('Root seed must contain at most 256 characters')
  }
  return normalized
}

function normalizeKey(key: SeedStreamKey | undefined): SeedStreamKey | null {
  if (key === undefined) return null
  if (typeof key === 'number') {
    if (!Number.isSafeInteger(key) || key < 0) {
      throw new RangeError('Numeric seed path keys must be non-negative safe integers')
    }
    return key
  }

  const normalized = key.trim()
  if (normalized.length === 0) {
    throw new RangeError('String seed path keys must not be blank')
  }
  if (normalized.length > 256) {
    throw new RangeError('String seed path keys must contain at most 256 characters')
  }
  return normalized
}

function normalizeLabel(value: unknown): SeedStreamLabel {
  if (typeof value !== 'string' || !SEED_STREAM_LABEL_SET.has(value)) {
    throw new RangeError('Seed path labels must be registered V2 constants')
  }
  return value as SeedStreamLabel
}

function normalizePath(
  path: readonly SeedPathSegment[],
): readonly SeedPathSegment[] {
  if (!Array.isArray(path)) {
    throw new TypeError('Seed path must be an array')
  }

  const normalized: SeedPathSegment[] = []
  for (let index = 0; index < path.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(path, index)) {
      throw new TypeError('Seed path arrays must be dense')
    }
    const segment = path[index] as unknown
    if (typeof segment !== 'object' || segment === null || Array.isArray(segment)) {
      throw new TypeError('Seed path segments must be objects')
    }
    const { label, key } = segment as Readonly<Record<string, unknown>>
    normalized.push(
      Object.freeze({
        label: normalizeLabel(label),
        key: normalizeKey(
          key === null || key === undefined
            ? undefined
            : (key as SeedStreamKey),
        ),
      }),
    )
  }
  return normalized
}

function deriveSeed(
  rootSeed: string,
  path: readonly SeedPathSegment[],
): string {
  return forkSeed(
    rootSeed,
    stableStringify({
      version: SEED_TREE_VERSION,
      rngVersion: RNG_VERSION,
      path,
    }),
  )
}

/**
 * Immutable, labelled deterministic seed hierarchy for V2 creative work.
 *
 * Each independent concern receives a path rather than consuming a shared
 * sequential stream. Adding beat or UI-only draws therefore cannot perturb a
 * melody, island, Pareto, or collaborator stream.
 */
export class SeedTree {
  readonly rootSeed: string
  readonly path: readonly SeedPathSegment[]

  constructor(
    rootSeed: string,
    path: readonly SeedPathSegment[] = [],
  ) {
    this.rootSeed = normalizeRootSeed(rootSeed)
    this.path = Object.freeze(normalizePath(path))
    Object.freeze(this)
  }

  child(label: SeedStreamLabel, key?: SeedStreamKey): SeedTree {
    return new SeedTree(this.rootSeed, [
      ...this.path,
      { label: normalizeLabel(label), key: normalizeKey(key) },
    ])
  }

  seed(): string {
    return deriveSeed(this.rootSeed, this.path)
  }

  random(): SeededRandom {
    return new SeededRandom(this.seed())
  }

  provenance(): SeedTreeProvenance {
    return {
      version: SEED_TREE_VERSION,
      rngVersion: RNG_VERSION,
      rootSeed: this.rootSeed,
      path: this.path.map(({ label, key }) => ({ label, key })),
      derivedSeed: this.seed(),
    }
  }
}

export function createSeedTree(rootSeed: string): SeedTree {
  return new SeedTree(rootSeed)
}
