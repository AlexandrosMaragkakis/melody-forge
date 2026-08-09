import { describe, expect, it } from 'vitest'

import {
  assertValidMelody,
  exactMusicalFingerprint,
} from '../domain/invariants'
import { melodyDegreeToMidi } from '../domain/pitch'
import { SeededRandom } from '../domain/random'
import { getScale } from '../domain/scales'
import type {
  Candidate,
  GenerationSnapshot,
  Melody,
} from '../domain/types'
import {
  generateLegacyPopulation,
  type LegacyGeneratorSettings,
} from '../generators/legacy'
import {
  DEFAULT_MODERN_SETTINGS,
  generateModernCandidate,
  generateModernPopulation,
} from '../generators/modern'
import {
  createDescendant,
  evolveFromSnapshot,
  evolvePopulation,
  normalizeEvolutionRequest,
  normalizeMutationStrength,
} from './evolve'
import { melodyNovelty } from './novelty'
import { EVOLUTION_GENERATOR_VERSION } from './types'

function modernParents(seed = 'evolution-modern-parents'): readonly [Candidate, Candidate] {
  const population = generateModernPopulation({
    ...DEFAULT_MODERN_SETTINGS,
    seed,
    populationSize: 2,
    allowRests: true,
    phraseBeats: 6,
    noteCount: 8,
  })
  return [population[0]!, population[1]!]
}

function expectCandidateInvariants(candidate: Candidate): void {
  const scale = getScale(candidate.melody.constraints.scaleId)
  expect(() => assertValidMelody(candidate.melody, scale)).not.toThrow()
  for (const event of candidate.melody.events) {
    if (event.degree === null) {
      continue
    }
    const midi = melodyDegreeToMidi(
      event.degree,
      candidate.melody.constraints,
      scale,
    )
    expect(midi).toBeGreaterThanOrEqual(candidate.melody.constraints.register.minMidi)
    expect(midi).toBeLessThanOrEqual(candidate.melody.constraints.register.maxMidi)
  }
}

function expectUniqueFingerprints(candidates: readonly Candidate[]): void {
  const fingerprints = candidates.map(({ melody }) =>
    exactMusicalFingerprint(melody),
  )
  expect(new Set(fingerprints).size).toBe(fingerprints.length)
}

describe('descendant construction', () => {
  it('normalizes mutation strength to the inclusive unit interval', () => {
    expect(normalizeMutationStrength(-10)).toBe(0)
    expect(normalizeMutationStrength(0.375)).toBe(0.375)
    expect(normalizeMutationStrength(10)).toBe(1)
    expect(normalizeMutationStrength(Number.NaN)).toBe(0)
  })

  it('copies one parent melody exactly at zero mutation with explicit provenance', () => {
    const [parent] = modernParents()
    const child = createDescendant([parent], {
      seed: 'identity-child',
      mutationStrength: 0,
    })

    expect(child).not.toBe(parent)
    expect(child.melody).toEqual(parent.melody)
    expect(child.melody).not.toBe(parent.melody)
    expect(child.provenance).toMatchObject({
      strategy: 'evolution',
      generatorVersion: EVOLUTION_GENERATOR_VERSION,
      generation: 1,
      parentIds: [parent.id],
    })
    expect(child.provenance.operations.map(({ operator }) => operator)).toEqual([
      'zero-mutation-copy',
    ])
  })

  it('mutates one parent while retaining clear ancestry and resemblance', () => {
    const [parent] = modernParents()
    const child = createDescendant(
      [parent],
      {
        seed: 'one-parent-degree-step',
        mutationStrength: 0.8,
        mutationOperators: ['degree-move'],
      },
      new SeededRandom('one-parent-degree-step-random'),
    )

    expect(child.provenance.parentIds).toEqual([parent.id])
    expect(child.provenance.operations.map(({ operator }) => operator)).toEqual([
      'inherit-parent',
      'degree-move',
    ])
    expect(child.melody.constraints).toEqual(parent.melody.constraints)
    expect(child.melody.events).toHaveLength(parent.melody.events.length)
    expect(exactMusicalFingerprint(child.melody)).not.toBe(
      exactMusicalFingerprint(parent.melody),
    )
    expectCandidateInvariants(child)
  })

  it('crosses two parents first and then mutates with both IDs in provenance', () => {
    const parents = modernParents('two-parent-provenance')
    const child = createDescendant(
      parents,
      {
        seed: 'two-parent-child',
        mutationStrength: 0.75,
        crossover: 'compatible-boundary',
        mutationOperators: ['rest-toggle'],
      },
      new SeededRandom('two-parent-child-random'),
    )

    expect(child.provenance.parentIds).toEqual(parents.map(({ id }) => id))
    expect(child.provenance.operations[0]?.operator).toMatch(/crossover/u)
    expect(child.provenance.operations.at(-1)?.operator).toBe('rest-toggle')
    expect(child.provenance.strategy).toBe('evolution')
    expectCandidateInvariants(child)
  })

  it('supports contour/rhythm crossover followed by an actual mutation', () => {
    const parents = modernParents('contour-rhythm-provenance')
    const child = createDescendant(
      parents,
      {
        seed: 'contour-rhythm-child',
        mutationStrength: 0.75,
        crossover: 'contour-rhythm',
        mutationOperators: ['motif-transpose'],
      },
      new SeededRandom('contour-rhythm-child-random'),
    )

    expect(child.provenance.operations[0]?.operator).toBe(
      'contour-rhythm-crossover',
    )
    expect(
      child.provenance.operations.slice(1).some(({ parameters }) => parameters.applied === true),
    ).toBe(true)
    expectCandidateInvariants(child)
  })

  it('rejects invalid parent counts, duplicate IDs, and incompatible constraints', () => {
    const [first, second] = modernParents('invalid-parent-inputs')
    expect(() =>
      normalizeEvolutionRequest({
        parents: [],
        populationSize: 8,
        mutationStrength: 0.5,
        retainElites: true,
        seed: 'invalid',
      }),
    ).toThrow(RangeError)
    expect(() =>
      normalizeEvolutionRequest({
        parents: [first, first],
        populationSize: 8,
        mutationStrength: 0.5,
        retainElites: true,
        seed: 'invalid',
      }),
    ).toThrow(RangeError)
    expect(() =>
      normalizeEvolutionRequest({
        parents: [first, second],
        populationSize: 2,
        mutationStrength: 0.5,
        retainElites: true,
        seed: 'no-descendant-slot',
      }),
    ).toThrow(/descendant slot/u)

    const incompatible: Candidate = {
      ...second,
      id: 'different-constraints',
      melody: {
        ...second.melody,
        constraints: { ...second.melody.constraints, tempoBpm: 180 },
      },
    }
    expect(() =>
      normalizeEvolutionRequest({
        parents: [first, incompatible],
        populationSize: 8,
        mutationStrength: 0.5,
        retainElites: true,
        seed: 'invalid',
      }),
    ).toThrow(RangeError)
  })
})

describe('population evolution', () => {
  it('preserves selected parents unchanged as ordered elites', () => {
    const parents = modernParents('elite-parents')
    const parentSnapshot = structuredClone(parents)
    const result = evolvePopulation({
      parents,
      populationSize: 8,
      mutationStrength: 0.8,
      retainElites: true,
      seed: 'elite-generation',
    })

    expect(result.candidates.slice(0, 2)).toEqual(parents)
    expect(result.candidates[0]).not.toBe(parents[0])
    expect(result.candidates[1]).not.toBe(parents[1])
    expect(parents).toEqual(parentSnapshot)
    expectUniqueFingerprints(result.candidates)
    result.candidates.forEach(expectCandidateInvariants)
  })

  it('returns a deterministic underfilled report instead of duplicating at zero mutation', () => {
    const [parent] = modernParents('zero-underfill')
    const request = {
      parents: [parent],
      populationSize: 8,
      mutationStrength: 0,
      retainElites: false,
      seed: 'zero-underfill-generation',
      maxAttemptsPerSlot: 4,
    } as const
    const first = evolvePopulation(request)
    const second = evolvePopulation(request)

    expect(first).toEqual(second)
    expect(first.candidates).toHaveLength(1)
    expect(first.candidates[0]?.melody).toEqual(parent.melody)
    expect(first.candidates[0]?.provenance.strategy).toBe('evolution')
    expect(first.diversity).toMatchObject({
      requestedPopulationSize: 8,
      producedPopulationSize: 1,
      uniqueFingerprintCount: 1,
      underfilled: true,
    })
    expect(first.diversity.rejectedExactDuplicates).toBeGreaterThan(0)
    expect(first.diversity.notices.map(({ code }) => code)).toContain(
      'underfilled-after-deduplication',
    )
    expectUniqueFingerprints(first.candidates)
  })

  it('keeps a zero-strength retained elite unchanged and reports impossible extra slots', () => {
    const [parent] = modernParents('zero-retained-elite')
    const result = evolvePopulation({
      parents: [parent],
      populationSize: 4,
      mutationStrength: 0,
      retainElites: true,
      seed: 'zero-retained-elite-generation',
      maxAttemptsPerSlot: 3,
    })

    expect(result.candidates).toEqual([parent])
    expect(result.diversity.underfilled).toBe(true)
    expect(result.diversity.producedPopulationSize).toBe(1)
    expect(result.diversity.notices.at(-1)?.code).toBe(
      'underfilled-after-deduplication',
    )
  })

  it('alternates exact parent identities at zero strength with two parents', () => {
    const parents = modernParents('zero-two-parent')
    const result = evolvePopulation({
      parents,
      populationSize: 6,
      mutationStrength: 0,
      retainElites: false,
      seed: 'zero-two-parent-generation',
      maxAttemptsPerSlot: 4,
    })

    expect(result.candidates).toHaveLength(2)
    expect(result.candidates.map(({ melody }) => melody)).toEqual(
      parents.map(({ melody }) => melody),
    )
    expect(
      result.candidates.every(({ provenance }) =>
        provenance.operations.every(
          ({ operator }) => operator === 'zero-mutation-copy',
        ),
      ),
    ).toBe(true)
    expect(result.diversity.underfilled).toBe(true)
  })

  it('is exactly reproducible as an ordered unique population', () => {
    const parents = modernParents('ordered-evolution')
    const request = {
      parents,
      populationSize: 8,
      mutationStrength: 0.9,
      retainElites: true,
      seed: 'ordered-evolution-generation',
      maxAttemptsPerSlot: 12,
    } as const
    const first = evolvePopulation(request)
    const second = evolvePopulation(request)

    expect(first).toEqual(second)
    expect(first.candidates).toHaveLength(8)
    expect(first.diversity.underfilled).toBe(false)
    expect(first.diversity.uniqueFingerprintCount).toBe(8)
    expectUniqueFingerprints(first.candidates)
    expect(first.diversity.novelty).toHaveLength(8)
    for (const report of first.diversity.novelty) {
      if (report.components !== null) {
        expect(report.components.pitch).toBeGreaterThanOrEqual(0)
        expect(report.components.pitch).toBeLessThanOrEqual(1)
        expect(report.components.rhythm).toBeGreaterThanOrEqual(0)
        expect(report.components.rhythm).toBeLessThanOrEqual(1)
        expect(report.components.rests).toBeGreaterThanOrEqual(0)
        expect(report.components.rests).toBeLessThanOrEqual(1)
      }
    }
  })

  it('uses snapshot generation rather than retained elite birth generation', () => {
    const parents = modernParents('snapshot-generation')
    const snapshot: GenerationSnapshot = {
      id: 'generation-five',
      generation: 5,
      seed: 'old-seed',
      generatorVersion: EVOLUTION_GENERATOR_VERSION,
      candidates: parents,
      selectedParentIds: [],
      evolutionSettings: null,
      previousGenerationId: 'generation-four',
    }
    const result = evolveFromSnapshot(snapshot, parents.map(({ id }) => id), {
      populationSize: 6,
      mutationStrength: 0.8,
      retainElites: true,
      seed: 'snapshot-next-generation',
      maxAttemptsPerSlot: 12,
    })

    expect(result.candidates.slice(0, 2).map(({ provenance }) => provenance.generation)).toEqual([
      0,
      0,
    ])
    expect(result.candidates.slice(2).every(({ provenance }) => provenance.generation === 6)).toBe(
      true,
    )
  })
})

describe('explainable novelty components', () => {
  function fourBeatMelody(
    degrees: readonly (number | null)[],
    durations: readonly number[] = [120, 120, 120, 120],
  ): Melody {
    let startTick = 0
    return {
      constraints: {
        scaleId: 'diatonic-ionian',
        tonicPitchClass: 0,
        tonicMidi: 60,
        register: { minMidi: 48, maxMidi: 84 },
        pitchMapping: 'tonic-relative',
        ticksPerBeat: 480,
        gridTicks: 120,
        totalTicks: 480,
        tempoBpm: 108,
        tonicBoundary: { start: false, end: false },
      },
      events: durations.map((durationTicks, index) => {
        const event = {
          startTick,
          durationTicks,
          degree: degrees[index] ?? null,
        }
        startTick += durationTicks
        return event
      }),
    }
  }

  it('separates pitch, onset-rhythm, and rest differences symmetrically', () => {
    const base = fourBeatMelody([0, 1, 2, 3])
    const pitchOnly = fourBeatMelody([0, 3, 2, 3])
    const rhythmBase = fourBeatMelody([0, 0], [240, 240])
    const rhythmOnly = fourBeatMelody([0, 0], [120, 360])
    const restOnly = fourBeatMelody([0, null, 2, 3])

    expect(melodyNovelty(base, pitchOnly)).toMatchObject({
      rhythm: 0,
      rests: 0,
    })
    expect(melodyNovelty(base, pitchOnly).pitch).toBeGreaterThan(0)
    expect(melodyNovelty(rhythmBase, rhythmOnly)).toMatchObject({
      pitch: 0,
      rests: 0,
    })
    expect(melodyNovelty(rhythmBase, rhythmOnly).rhythm).toBeGreaterThan(0)
    expect(melodyNovelty(base, restOnly)).toMatchObject({
      rhythm: 0,
      pitch: 0,
    })
    expect(melodyNovelty(base, restOnly).rests).toBeGreaterThan(0)
    expect(melodyNovelty(base, pitchOnly)).toEqual(
      melodyNovelty(pitchOnly, base),
    )
  })

  it('does not report false Legacy novelty for fixed-octave degree aliases', () => {
    const source = fourBeatMelody([0, 1, 2, 0])
    const legacy: Melody = {
      ...source,
      constraints: {
        ...source.constraints,
        register: { minMidi: 60, maxMidi: 71 },
        pitchMapping: 'legacy-fixed-octave',
      },
    }
    const aliases: Melody = {
      ...legacy,
      events: legacy.events.map((event, index) => ({
        ...event,
        degree:
          event.degree === null || index === 0 || index === legacy.events.length - 1
            ? event.degree
            : event.degree + 7,
      })),
    }

    expect(melodyNovelty(legacy, aliases)).toEqual({
      pitch: 0,
      rhythm: 0,
      rests: 0,
      mean: 0,
    })
  })
})

describe('repeated-generation invariant sweeps', () => {
  it('preserves Legacy fixed-octave invariants over repeated evolution', () => {
    const legacySettings: LegacyGeneratorSettings = {
      tonicPitchClass: 11,
      scaleId: 'octatonic-half-whole',
      noteCount: 10,
      tempoBpm: 112,
      populationSize: 2,
      seed: 'legacy-evolution-base',
    }
    let parents: readonly Candidate[] = generateLegacyPopulation(legacySettings)

    for (let generation = 1; generation <= 3; generation += 1) {
      const result = evolvePopulation({
        parents,
        generation,
        populationSize: 5,
        mutationStrength: 0.85,
        retainElites: true,
        seed: `legacy-evolution-${String(generation)}`,
        maxAttemptsPerSlot: 6,
      })
      expect(result.candidates.length).toBeGreaterThanOrEqual(2)
      expectUniqueFingerprints(result.candidates)
      result.candidates.forEach((candidate) => {
        expectCandidateInvariants(candidate)
        expect(candidate.melody.constraints.pitchMapping).toBe('legacy-fixed-octave')
        const scale = getScale(candidate.melody.constraints.scaleId)
        for (const event of candidate.melody.events) {
          if (event.degree !== null) {
            const midi = melodyDegreeToMidi(
              event.degree,
              candidate.melody.constraints,
              scale,
            )
            expect(midi).toBeGreaterThanOrEqual(60)
            expect(midi).toBeLessThanOrEqual(71)
          }
        }
      })
      parents = result.candidates.slice(0, Math.min(2, result.candidates.length))
    }
  })

  it('preserves Modern scale/register/timing invariants over repeated evolution', () => {
    const base = [
      generateModernCandidate(
        {
          ...DEFAULT_MODERN_SETTINGS,
          scaleId: 'pentatonic-minor',
          tonicPitchClass: 6,
          allowRests: true,
          phraseBeats: 8,
          noteCount: 10,
        },
        new SeededRandom('modern-evolution-parent-a'),
        'modern-evolution-parent-a',
      ),
      generateModernCandidate(
        {
          ...DEFAULT_MODERN_SETTINGS,
          scaleId: 'pentatonic-minor',
          tonicPitchClass: 6,
          allowRests: true,
          phraseBeats: 8,
          noteCount: 10,
        },
        new SeededRandom('modern-evolution-parent-b'),
        'modern-evolution-parent-b',
        1,
      ),
    ] as const
    let parents: readonly Candidate[] = base

    for (let generation = 1; generation <= 3; generation += 1) {
      const result = evolvePopulation({
        parents,
        generation,
        populationSize: 5,
        mutationStrength: 0.85,
        retainElites: true,
        seed: `modern-evolution-${String(generation)}`,
        maxAttemptsPerSlot: 6,
      })
      expect(result.candidates.length).toBeGreaterThanOrEqual(2)
      expectUniqueFingerprints(result.candidates)
      result.candidates.forEach(expectCandidateInvariants)
      parents = result.candidates.slice(0, Math.min(2, result.candidates.length))
    }
  })
})
