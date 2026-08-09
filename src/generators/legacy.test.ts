import {
  LEGACY_OCTAVE_MIN_MIDI,
  melodyDegreeToMidi,
  positiveModulo,
} from '../domain/pitch'
import type { RandomSource } from '../domain/random'
import {
  SCALE_CATALOGUE,
  getScale,
  type ScaleId,
} from '../domain/scales'
import {
  LEGACY_GENERATOR_VERSION,
  LEGACY_MAX_NOTE_COUNT,
  LEGACY_MAX_POPULATION_SIZE,
  LEGACY_MAX_TEMPO_BPM,
  LEGACY_MIN_NOTE_COUNT,
  LEGACY_MIN_POPULATION_SIZE,
  LEGACY_MIN_TEMPO_BPM,
  LEGACY_TICKS_PER_NOTE,
  generateLegacyCandidate,
  generateLegacyPopulation,
  normalizeLegacySettings,
  type LegacyGeneratorSettings,
} from './legacy'

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

  expectConsumed(): void {
    expect(this.index).toBe(this.values.length)
  }
}

function settings(
  overrides: Partial<LegacyGeneratorSettings> = {},
): LegacyGeneratorSettings {
  return {
    tonicPitchClass: 0,
    scaleId: 'diatonic-ionian',
    noteCount: 8,
    tempoBpm: 108,
    populationSize: 8,
    seed: 'legacy-amber',
    ...overrides,
  }
}

function soundingMidi(candidate: ReturnType<typeof generateLegacyCandidate>) {
  const scale = getScale(candidate.melody.constraints.scaleId)
  return candidate.melody.events.map((event) => {
    if (event.degree === null) {
      return null
    }
    return melodyDegreeToMidi(
      event.degree,
      candidate.melody.constraints,
      scale,
    )
  })
}

describe('Legacy settings', () => {
  it('accepts every supported note count and both population bounds', () => {
    for (
      let noteCount = LEGACY_MIN_NOTE_COUNT;
      noteCount <= LEGACY_MAX_NOTE_COUNT;
      noteCount += 1
    ) {
      const candidate = generateLegacyCandidate(
        settings({ noteCount, populationSize: LEGACY_MIN_POPULATION_SIZE }),
      )
      expect(candidate.melody.events).toHaveLength(noteCount)
      expect(candidate.melody.constraints.totalTicks).toBe(
        noteCount * LEGACY_TICKS_PER_NOTE,
      )
    }

    expect(
      generateLegacyPopulation(
        settings({ populationSize: LEGACY_MIN_POPULATION_SIZE }),
      ),
    ).toHaveLength(LEGACY_MIN_POPULATION_SIZE)
    expect(
      generateLegacyPopulation(
        settings({ populationSize: LEGACY_MAX_POPULATION_SIZE }),
      ),
    ).toHaveLength(LEGACY_MAX_POPULATION_SIZE)
  })

  it('normalizes the seed and rejects invalid bounds before generation', () => {
    expect(normalizeLegacySettings(settings({ seed: '  audible-seed  ' })).seed).toBe(
      'audible-seed',
    )

    for (const tonicPitchClass of [-1, 12, 1.5]) {
      expect(() =>
        normalizeLegacySettings(settings({ tonicPitchClass })),
      ).toThrow(RangeError)
    }
    for (const noteCount of [LEGACY_MIN_NOTE_COUNT - 1, LEGACY_MAX_NOTE_COUNT + 1]) {
      expect(() => normalizeLegacySettings(settings({ noteCount }))).toThrow(
        RangeError,
      )
    }
    for (const populationSize of [
      LEGACY_MIN_POPULATION_SIZE - 1,
      LEGACY_MAX_POPULATION_SIZE + 1,
    ]) {
      expect(() =>
        normalizeLegacySettings(settings({ populationSize })),
      ).toThrow(RangeError)
    }
    for (const tempoBpm of [
      LEGACY_MIN_TEMPO_BPM - 1,
      LEGACY_MAX_TEMPO_BPM + 1,
      Number.NaN,
    ]) {
      expect(() => normalizeLegacySettings(settings({ tempoBpm }))).toThrow(
        RangeError,
      )
    }
    expect(() => normalizeLegacySettings(settings({ seed: '   ' }))).toThrow(
      RangeError,
    )
    expect(() =>
      normalizeLegacySettings(
        settings({ scaleId: 'not-a-scale' as ScaleId }),
      ),
    ).toThrow(RangeError)
  })
})

describe('Legacy melody construction', () => {
  it('forces tonic endpoints and creates contiguous equal notes without rests', () => {
    const candidate = generateLegacyCandidate(settings({ noteCount: 12 }))
    const { events, constraints } = candidate.melody

    expect(events[0]?.degree).toBe(0)
    expect(events.at(-1)?.degree).toBe(0)
    expect(events.every((event) => event.degree !== null)).toBe(true)
    expect(events).toEqual(
      events.map((event, index) => ({
        ...event,
        startTick: index * LEGACY_TICKS_PER_NOTE,
        durationTicks: LEGACY_TICKS_PER_NOTE,
      })),
    )
    expect(constraints).toMatchObject({
      tonicMidi: 60,
      register: { minMidi: 60, maxMidi: 71 },
      pitchMapping: 'legacy-fixed-octave',
      ticksPerBeat: 480,
      gridTicks: 480,
      totalTicks: 12 * 480,
      tonicBoundary: { start: true, end: true },
    })
    expect(soundingMidi(candidate).every((midi) => midi !== null && midi >= 60 && midi <= 71)).toBe(
      true,
    )
  })

  it('makes every degree reachable using the selected scale cardinality', () => {
    for (const scale of SCALE_CATALOGUE) {
      const values = scale.offsets.map(
        (_, index) => (index + 0.5) / scale.offsets.length,
      )
      const random = new SequenceRandom(values)
      const candidate = generateLegacyCandidate(
        settings({
          tonicPitchClass: 9,
          scaleId: scale.id,
          noteCount: scale.offsets.length + 2,
          populationSize: 1,
        }),
        random,
      )

      const expectedMidi = scale.offsets.map(
        (offset) =>
          LEGACY_OCTAVE_MIN_MIDI + positiveModulo(9 + offset, 12),
      )
      expect(soundingMidi(candidate).slice(1, -1)).toEqual(expectedMidi)
      random.expectConsumed()
    }
  })

  it.each([
    {
      name: 'C# Ionian',
      tonicPitchClass: 1,
      expectedInternalMidi: [61, 63, 65, 66, 68, 70, 60],
      expectedInternalDegrees: [0, 1, 2, 3, 4, 5, -1],
    },
    {
      name: 'B Ionian',
      tonicPitchClass: 11,
      expectedInternalMidi: [71, 61, 63, 64, 66, 68, 70],
      expectedInternalDegrees: [0, -6, -5, -4, -3, -2, -1],
    },
  ])(
    'retains the downward fixed-octave wrap for $name',
    ({ tonicPitchClass, expectedInternalMidi, expectedInternalDegrees }) => {
      const scale = getScale('diatonic-ionian')
      const random = new SequenceRandom(
        scale.offsets.map((_, index) => (index + 0.5) / scale.offsets.length),
      )
      const candidate = generateLegacyCandidate(
        settings({ tonicPitchClass, noteCount: 9, populationSize: 1 }),
        random,
      )

      expect(soundingMidi(candidate).slice(1, -1)).toEqual(expectedInternalMidi)
      expect(candidate.melody.events.slice(1, -1).map((event) => event.degree)).toEqual(
        expectedInternalDegrees,
      )
      expect(candidate.melody.constraints.tonicMidi).toBe(
        LEGACY_OCTAVE_MIN_MIDI + tonicPitchClass,
      )
      random.expectConsumed()
    },
  )
})

describe('Legacy reproducibility and provenance', () => {
  it('repeats the exact ordered population for identical versioned inputs', () => {
    const input = settings({
      tonicPitchClass: 6,
      scaleId: 'octatonic-half-whole',
      noteCount: 16,
      populationSize: 8,
      seed: 'ordered-legacy-population',
    })
    const first = generateLegacyPopulation(input)
    const second = generateLegacyPopulation(input)

    expect(first).toEqual(second)
    expect(new Set(first.map((candidate) => candidate.id))).toHaveLength(8)
    expect(first.every((candidate) => candidate.provenance.generatorVersion === LEGACY_GENERATOR_VERSION)).toBe(
      true,
    )
    expect(first.map((candidate) => candidate.provenance.settings.populationIndex)).toEqual(
      [0, 1, 2, 3, 4, 5, 6, 7],
    )
    expect(first.every((candidate) => candidate.provenance.strategy === 'legacy')).toBe(
      true,
    )
    expect(first.every((candidate) => candidate.provenance.parentIds.length === 0)).toBe(
      true,
    )
  })

  it('changes the ordered musical output when the seed changes', () => {
    const common = {
      tonicPitchClass: 4,
      scaleId: 'melodic-minor-04' as const,
      noteCount: 32,
      populationSize: 8,
      tempoBpm: 108,
    }
    const first = generateLegacyPopulation({ ...common, seed: 'seed-one' })
    const second = generateLegacyPopulation({ ...common, seed: 'seed-two' })
    const pitches = (population: typeof first) =>
      population.map((candidate) =>
        candidate.melody.events.map((event) => event.degree),
      )

    expect(pitches(first)).not.toEqual(pitches(second))
    expect(first.map((candidate) => candidate.id)).not.toEqual(
      second.map((candidate) => candidate.id),
    )
  })
})
