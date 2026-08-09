import { melodyDegreeToMidi } from '../domain/pitch'
import { SeededRandom } from '../domain/random'
import { SCALE_CATALOGUE, getScale } from '../domain/scales'
import {
  DEFAULT_MODERN_SETTINGS,
  MODERN_GENERATOR_VERSION,
  generateModernCandidate,
  generateModernPopulation,
  normalizeModernSettings,
} from './modern'

function expectModernInvariants(
  candidate: ReturnType<typeof generateModernCandidate>,
  maxLeap: number,
): void {
  const { melody } = candidate
  const { constraints } = melody
  const scale = getScale(constraints.scaleId)
  let expectedStart = 0
  let previousDegree: number | null = null

  expect(candidate.provenance.strategy).toBe('modern')
  expect(candidate.provenance.generatorVersion).toBe(MODERN_GENERATOR_VERSION)
  expect(melody.events.length).toBeGreaterThanOrEqual(4)

  for (const event of melody.events) {
    expect(event.startTick).toBe(expectedStart)
    expect(event.startTick % constraints.gridTicks).toBe(0)
    expect(event.durationTicks).toBeGreaterThan(0)
    expect(event.durationTicks % constraints.gridTicks).toBe(0)
    expectedStart += event.durationTicks

    if (event.degree !== null) {
      const midi = melodyDegreeToMidi(event.degree, constraints, scale)
      expect(midi).toBeGreaterThanOrEqual(constraints.register.minMidi)
      expect(midi).toBeLessThanOrEqual(constraints.register.maxMidi)
      if (previousDegree !== null) {
        expect(Math.abs(event.degree - previousDegree)).toBeLessThanOrEqual(maxLeap)
      }
      previousDegree = event.degree
    }
  }

  expect(expectedStart).toBe(constraints.totalTicks)
  expect(melody.events[0]?.degree).toBe(0)
  if (constraints.tonicBoundary.end) {
    expect(melody.events.at(-1)?.degree).toBe(0)
  }
}

describe('Modern constrained generator', () => {
  it('normalizes settings into a feasible, conservative range', () => {
    expect(
      normalizeModernSettings({
        tonicPitchClass: -1,
        registerLowOctave: 7,
        registerHighOctave: 3,
        phraseBeats: 2,
        gridTicks: 480,
        noteCount: 32,
        tempoBpm: 999,
        populationSize: 99,
      }),
    ).toMatchObject({
      tonicPitchClass: 11,
      registerLowOctave: 7,
      registerHighOctave: 8,
      phraseBeats: 4,
      gridTicks: 480,
      noteCount: 4,
      tempoBpm: 240,
      populationSize: 16,
    })
  })

  it('is exactly reproducible as an ordered population', () => {
    const settings = { ...DEFAULT_MODERN_SETTINGS, seed: 'glass-orbit' }
    const first = generateModernPopulation(settings)
    const second = generateModernPopulation(settings)

    expect(first).toEqual(second)
    expect(first.map(({ id }) => id)).toHaveLength(new Set(first.map(({ id }) => id)).size)
    expect(generateModernPopulation({ ...settings, seed: 'glass-orbit-2' })).not.toEqual(first)
  })

  it('supports quantized rests without resting at required boundaries', () => {
    const candidate = generateModernCandidate(
      {
        ...DEFAULT_MODERN_SETTINGS,
        allowRests: true,
        noteCount: 10,
        phraseBeats: 8,
      },
      new SeededRandom('rest-fixture'),
      'rest-fixture',
    )

    expectModernInvariants(candidate, DEFAULT_MODERN_SETTINGS.maxLeap)
    expect(candidate.melody.events[0]?.degree).not.toBeNull()
    expect(candidate.melody.events.at(-1)?.degree).not.toBeNull()
  })

  it('preserves all hard constraints across every scale and tonic', () => {
    for (const scale of SCALE_CATALOGUE) {
      for (let tonicPitchClass = 0; tonicPitchClass < 12; tonicPitchClass += 1) {
        for (const seed of ['matrix-a', 'matrix-b']) {
          const candidate = generateModernCandidate(
            {
              ...DEFAULT_MODERN_SETTINGS,
              scaleId: scale.id,
              tonicPitchClass,
              allowRests: true,
              noteCount: 7,
              phraseBeats: 6,
              maxLeap: 3,
            },
            new SeededRandom(`${seed}-${scale.id}-${tonicPitchClass}`),
            seed,
          )
          expectModernInvariants(candidate, 3)
        }
      }
    }
  })

  it('can leave the ending open when tonic closure is disabled', () => {
    const candidate = generateModernCandidate(
      { ...DEFAULT_MODERN_SETTINGS, tonicClosure: false },
      new SeededRandom('open-ending'),
      'open-ending',
    )

    expect(candidate.melody.constraints.tonicBoundary.end).toBe(false)
    expectModernInvariants(candidate, DEFAULT_MODERN_SETTINGS.maxLeap)
  })
})
