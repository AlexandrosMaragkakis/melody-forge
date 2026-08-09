import { describe, expect, it } from 'vitest'

import {
  assertValidMelody,
  exactMusicalFingerprint,
} from '../domain/invariants'
import type { RandomSource } from '../domain/random'
import { getScale } from '../domain/scales'
import type { Candidate, Melody } from '../domain/types'
import {
  applyMutationOperator,
  assertCompatibleParents,
  compatibleBoundaryCrossover,
  compatibleCrossoverBoundaries,
  contourRhythmCrossover,
} from './operators'
import { MUTATION_OPERATOR_NAMES } from './types'

class FixedRandom implements RandomSource {
  constructor(private readonly value: number) {}

  next(): number {
    return this.value
  }
}

function melodyA(): Melody {
  return {
    constraints: {
      scaleId: 'diatonic-ionian',
      tonicPitchClass: 0,
      tonicMidi: 60,
      register: { minMidi: 48, maxMidi: 84 },
      pitchMapping: 'tonic-relative',
      ticksPerBeat: 480,
      gridTicks: 120,
      totalTicks: 1920,
      tempoBpm: 108,
      tonicBoundary: { start: true, end: true },
    },
    events: [
      { startTick: 0, durationTicks: 240, degree: 0 },
      { startTick: 240, durationTicks: 360, degree: 1 },
      { startTick: 600, durationTicks: 120, degree: 3 },
      { startTick: 720, durationTicks: 240, degree: 2 },
      { startTick: 960, durationTicks: 360, degree: null },
      { startTick: 1320, durationTicks: 240, degree: 4 },
      { startTick: 1560, durationTicks: 120, degree: 2 },
      { startTick: 1680, durationTicks: 240, degree: 0 },
    ],
  }
}

function melodyB(): Melody {
  return {
    constraints: { ...melodyA().constraints },
    events: [
      { startTick: 0, durationTicks: 360, degree: 0 },
      { startTick: 360, durationTicks: 120, degree: 4 },
      { startTick: 480, durationTicks: 240, degree: 3 },
      { startTick: 720, durationTicks: 360, degree: null },
      { startTick: 1080, durationTicks: 120, degree: 5 },
      { startTick: 1200, durationTicks: 240, degree: 2 },
      { startTick: 1440, durationTicks: 240, degree: 1 },
      { startTick: 1680, durationTicks: 240, degree: 0 },
    ],
  }
}

function candidate(id: string, melody: Melody): Candidate {
  return {
    id,
    melody,
    provenance: {
      strategy: 'modern',
      generatorVersion: 'fixture-v1',
      seed: id,
      settings: {},
      generation: 0,
      parentIds: [],
      operations: [],
    },
  }
}

function expectInvariants(melody: Melody): void {
  const scale = getScale(melody.constraints.scaleId)
  expect(() => assertValidMelody(melody, scale)).not.toThrow()
  expect(melody.events[0]?.degree).toBe(0)
  expect(melody.events.at(-1)?.degree).toBe(0)
  expect(
    melody.events.reduce((total, event) => total + event.durationTicks, 0),
  ).toBe(melody.constraints.totalTicks)
}

describe('evolution mutation operators', () => {
  it.each(MUTATION_OPERATOR_NAMES)('%s is deterministic and preserves every hard invariant', (name) => {
    const original = melodyA()
    const originalSnapshot = structuredClone(original)
    const first = applyMutationOperator(original, name, 1, new FixedRandom(0.25))
    const second = applyMutationOperator(original, name, 1, new FixedRandom(0.25))

    expect(first).toEqual(second)
    expect(first.operation.operator).toBe(name)
    expect(first.changed).toBe(true)
    expect(exactMusicalFingerprint(first.melody)).not.toBe(
      exactMusicalFingerprint(original),
    )
    expectInvariants(first.melody)
    expect(original).toEqual(originalSnapshot)
  })

  it('distinguishes nearby and occasional larger degree movement in provenance', () => {
    const larger = applyMutationOperator(
      melodyA(),
      'degree-move',
      1,
      new FixedRandom(0.25),
    )
    const nearby = applyMutationOperator(
      melodyA(),
      'degree-move',
      1,
      new FixedRandom(0.9),
    )

    expect(larger.operation.parameters.largerMovement).toBe(true)
    expect(nearby.operation.parameters.largerMovement).toBe(false)
    expectInvariants(larger.melody)
    expectInvariants(nearby.melody)
  })

  it.each([
    ['pentatonic-major', 5],
    ['whole-tone', 6],
    ['diatonic-ionian', 7],
    ['octatonic-half-whole', 8],
  ] as const)('moves degrees without assuming seven notes for %s', (scaleId, cardinality) => {
    const fixture = melodyA()
    const scaleMelody: Melody = {
      ...fixture,
      constraints: { ...fixture.constraints, scaleId },
    }
    const moved = applyMutationOperator(
      scaleMelody,
      'degree-move',
      1,
      new FixedRandom(0.25),
    )

    expect(getScale(scaleId).offsets).toHaveLength(cardinality)
    expect(moved.changed).toBe(true)
    expectInvariants(moved.melody)
  })

  it('makes every operator an identity at zero mutation', () => {
    for (const name of MUTATION_OPERATOR_NAMES) {
      const original = melodyA()
      const transformed = applyMutationOperator(
        original,
        name,
        0,
        new FixedRandom(0.25),
      )
      expect(transformed.changed).toBe(false)
      expect(transformed.melody).toEqual(original)
    }
  })

  it('split and merge rebuild contiguous grid timing without changing phrase length', () => {
    const split = applyMutationOperator(
      melodyA(),
      'rhythm-split',
      1,
      new FixedRandom(0.25),
    )
    const merged = applyMutationOperator(
      melodyA(),
      'rhythm-merge',
      1,
      new FixedRandom(0.25),
    )

    expect(split.melody.events).toHaveLength(melodyA().events.length + 1)
    expect(merged.melody.events).toHaveLength(melodyA().events.length - 1)
    for (const transformed of [split.melody, merged.melody]) {
      let startTick = 0
      for (const event of transformed.events) {
        expect(event.startTick).toBe(startTick)
        expect(event.startTick % transformed.constraints.gridTicks).toBe(0)
        expect(event.durationTicks % transformed.constraints.gridTicks).toBe(0)
        expect(event.durationTicks).toBeGreaterThan(0)
        startTick += event.durationTicks
      }
      expect(startTick).toBe(transformed.constraints.totalTicks)
    }
  })

  it('keeps evolutionary event counts within the short-melody 4–32 bounds', () => {
    const minimum: Melody = {
      ...melodyA(),
      constraints: { ...melodyA().constraints, totalTicks: 480 },
      events: [
        { startTick: 0, durationTicks: 120, degree: 0 },
        { startTick: 120, durationTicks: 120, degree: 1 },
        { startTick: 240, durationTicks: 120, degree: 2 },
        { startTick: 360, durationTicks: 120, degree: 0 },
      ],
    }
    const maximum: Melody = {
      ...melodyA(),
      constraints: { ...melodyA().constraints, totalTicks: 3_840 },
      events: Array.from({ length: 32 }, (_, index) => ({
        startTick: index * 120,
        durationTicks: 120,
        degree: index === 0 || index === 31 ? 0 : 1,
      })),
    }

    expect(
      applyMutationOperator(minimum, 'rhythm-merge', 1, new FixedRandom(0.25))
        .changed,
    ).toBe(false)
    expect(
      applyMutationOperator(maximum, 'rhythm-split', 1, new FixedRandom(0.25))
        .changed,
    ).toBe(false)
    expect(() =>
      assertCompatibleParents([
        candidate('too-short', { ...minimum, events: minimum.events.slice(0, 3) }),
      ]),
    ).toThrow(/4–32/u)
  })
})

describe('evolution crossover operators', () => {
  const first = candidate('parent-a', melodyA())
  const second = candidate('parent-b', melodyB())

  it('splices exact parent material at a compatible boundary', () => {
    expect(compatibleCrossoverBoundaries(first, second)).toEqual([720, 1680])
    const crossed = compatibleBoundaryCrossover(
      first,
      second,
      new FixedRandom(0),
    )
    const parameters = crossed.operation.parameters
    const boundaryTick = parameters.boundaryTick

    expect(boundaryTick).toBe(720)
    expect(parameters.prefixParentId).toBe(second.id)
    expect(parameters.suffixParentId).toBe(first.id)
    expect(crossed.melody.events.filter(({ startTick }) => startTick < 720)).toEqual(
      second.melody.events.filter(({ startTick }) => startTick < 720),
    )
    expect(crossed.melody.events.filter(({ startTick }) => startTick >= 720)).toEqual(
      first.melody.events.filter(({ startTick }) => startTick >= 720),
    )
    expectInvariants(crossed.melody)
  })

  it('inherits timing and rest placement from one parent and pitches from the other', () => {
    const crossed = contourRhythmCrossover(first, second)

    expect(crossed.operation.parameters.pitchParentId).toBe(first.id)
    expect(crossed.operation.parameters.rhythmParentId).toBe(second.id)
    expect(
      crossed.melody.events.map(({ startTick, durationTicks }) => ({
        startTick,
        durationTicks,
      })),
    ).toEqual(
      second.melody.events.map(({ startTick, durationTicks }) => ({
        startTick,
        durationTicks,
      })),
    )
    expect(crossed.melody.events.map(({ degree }) => degree === null)).toEqual(
      second.melody.events.map(({ degree }) => degree === null),
    )
    expectInvariants(crossed.melody)
  })

  it('rejects crossover when parent constraints differ', () => {
    const incompatible = candidate('incompatible', {
      ...melodyB(),
      constraints: { ...melodyB().constraints, tempoBpm: 120 },
    })
    expect(() => compatibleCrossoverBoundaries(first, incompatible)).toThrow(
      RangeError,
    )
    expect(() => contourRhythmCrossover(first, incompatible)).toThrow(RangeError)
  })
})
