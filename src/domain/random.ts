export const RNG_VERSION = 'sfc32-v1' as const

export interface RandomSource {
  next(): number
}

function xmur3(value: string): () => number {
  let hash = 1_779_033_703 ^ value.length

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3_432_918_353)
    hash = (hash << 13) | (hash >>> 19)
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_507)
    hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_909)
    hash ^= hash >>> 16
    return hash >>> 0
  }
}

export class SeededRandom implements RandomSource {
  readonly seed: string

  private stateA: number
  private stateB: number
  private stateC: number
  private stateD: number

  constructor(seed: string) {
    this.seed = seed
    const seedHash = xmur3(`${RNG_VERSION}\0${seed}`)
    this.stateA = seedHash()
    this.stateB = seedHash()
    this.stateC = seedHash()
    this.stateD = seedHash()
  }

  next(): number {
    this.stateA >>>= 0
    this.stateB >>>= 0
    this.stateC >>>= 0
    this.stateD >>>= 0

    const sum = (this.stateA + this.stateB + this.stateD) | 0
    this.stateD = (this.stateD + 1) | 0
    this.stateA = this.stateB ^ (this.stateB >>> 9)
    this.stateB = (this.stateC + (this.stateC << 3)) | 0
    this.stateC = ((this.stateC << 21) | (this.stateC >>> 11)) + sum

    return (sum >>> 0) / 4_294_967_296
  }

  fork(label: string): SeededRandom {
    return new SeededRandom(forkSeed(this.seed, label))
  }
}

export function forkSeed(seed: string, label: string | number): string {
  return `${seed}::${String(label)}`
}

export function randomInt(
  random: RandomSource,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)) {
    throw new RangeError('Random integer bounds must be safe integers')
  }

  if (maximum < minimum) {
    throw new RangeError('Random integer maximum must be at least the minimum')
  }

  return minimum + Math.floor(random.next() * (maximum - minimum + 1))
}

export function randomBoolean(
  random: RandomSource,
  probability = 0.5,
): boolean {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError('Probability must be between zero and one')
  }

  return random.next() < probability
}

export function randomItem<T>(
  random: RandomSource,
  values: readonly T[],
): T {
  if (values.length === 0) {
    throw new RangeError('Cannot choose from an empty collection')
  }

  return values[randomInt(random, 0, values.length - 1)]!
}

export interface WeightedChoice<T> {
  readonly value: T
  readonly weight: number
}

export function weightedChoice<T>(
  random: RandomSource,
  choices: readonly WeightedChoice<T>[],
): T {
  if (choices.length === 0) {
    throw new RangeError('Cannot choose from an empty weighted collection')
  }

  let totalWeight = 0
  for (const choice of choices) {
    if (!Number.isFinite(choice.weight) || choice.weight < 0) {
      throw new RangeError('Choice weights must be finite and non-negative')
    }
    totalWeight += choice.weight
  }

  if (totalWeight <= 0) {
    throw new RangeError('At least one choice must have positive weight')
  }

  const target = random.next() * totalWeight
  let cumulativeWeight = 0
  let lastPositiveValue: T | undefined

  for (const choice of choices) {
    cumulativeWeight += choice.weight
    if (choice.weight > 0) {
      lastPositiveValue = choice.value
    }
    if (target < cumulativeWeight) {
      return choice.value
    }
  }

  return lastPositiveValue!
}

export function shuffled<T>(
  random: RandomSource,
  values: readonly T[],
): T[] {
  const result = [...values]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index)
    const held = result[index]!
    result[index] = result[swapIndex]!
    result[swapIndex] = held
  }

  return result
}
