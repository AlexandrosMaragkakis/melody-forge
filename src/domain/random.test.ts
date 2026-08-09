import {
  RNG_VERSION,
  SeededRandom,
  forkSeed,
  randomBoolean,
  randomInt,
  randomItem,
  shuffled,
  weightedChoice,
  type RandomSource,
} from './random'

class SequenceRandom implements RandomSource {
  private index = 0

  constructor(private readonly values: readonly number[]) {}

  next(): number {
    const value = this.values[this.index]
    this.index += 1
    if (value === undefined || value < 0 || value >= 1) {
      throw new Error('Sequence exhausted or outside [0, 1)')
    }
    return value
  }
}

describe('SeededRandom', () => {
  it('repeats the exact stream for the same seed and version', () => {
    const first = new SeededRandom('amber-static')
    const second = new SeededRandom('amber-static')
    const firstValues = Array.from({ length: 12 }, () => first.next())
    const secondValues = Array.from({ length: 12 }, () => second.next())

    expect(RNG_VERSION).toBe('sfc32-v1')
    expect(firstValues).toEqual(secondValues)
    expect(firstValues).toEqual([
      0.6512039473745972,
      0.7161255343817174,
      0.24506897758692503,
      0.6547371814958751,
      0.22584596322849393,
      0.9149838031735271,
      0.14170507225207984,
      0.7727662513498217,
      0.20985256577841938,
      0.33677096432074904,
      0.4137744843028486,
      0.9021429980639368,
    ])
  })

  it('makes different seeds and deterministic forks independent', () => {
    const source = new SeededRandom('root')
    const sourceAgain = new SeededRandom('root')

    expect(source.next()).not.toBe(new SeededRandom('other').next())
    expect(source.fork('candidate-2').next()).toBe(
      sourceAgain.fork('candidate-2').next(),
    )
    expect(source.fork('candidate-2').next()).not.toBe(
      source.fork('candidate-3').next(),
    )
    expect(forkSeed('root', 2)).toBe('root::2')
  })
})

describe('random helpers', () => {
  it('maps the edges of [0, 1) onto inclusive integer bounds', () => {
    expect(randomInt(new SequenceRandom([0]), 4, 32)).toBe(4)
    expect(randomInt(new SequenceRandom([0.999_999]), 4, 32)).toBe(32)
    expect(() => randomInt(new SequenceRandom([0]), 2, 1)).toThrow(RangeError)
  })

  it('supports injected choices without hidden randomness', () => {
    expect(randomBoolean(new SequenceRandom([0.24]), 0.25)).toBe(true)
    expect(randomBoolean(new SequenceRandom([0.25]), 0.25)).toBe(false)
    expect(randomItem(new SequenceRandom([0.67]), ['a', 'b', 'c'])).toBe('c')
    expect(
      weightedChoice(new SequenceRandom([0.79]), [
        { value: 'step', weight: 7 },
        { value: 'leap', weight: 3 },
      ]),
    ).toBe('leap')
  })

  it('shuffles reproducibly without changing the source collection', () => {
    const input = [1, 2, 3, 4, 5]
    expect(shuffled(new SeededRandom('shuffle'), input)).toEqual(
      shuffled(new SeededRandom('shuffle'), input),
    )
    expect(input).toEqual([1, 2, 3, 4, 5])
  })

  it('rejects invalid probabilities and weights', () => {
    expect(() => randomBoolean(new SequenceRandom([0]), 1.1)).toThrow(RangeError)
    expect(() => weightedChoice(new SequenceRandom([0]), [])).toThrow(RangeError)
    expect(() =>
      weightedChoice(new SequenceRandom([0]), [{ value: 'x', weight: 0 }]),
    ).toThrow(RangeError)
  })
})
