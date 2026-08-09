import { stableId, stableStringify } from '../domain/identity'
import { assertValidMelody } from '../domain/invariants'
import {
  LEGACY_OCTAVE_MAX_MIDI,
  LEGACY_OCTAVE_MIN_MIDI,
  midiToScaleDegree,
  normalizePitchClass,
} from '../domain/pitch'
import {
  RNG_VERSION,
  SeededRandom,
  randomInt,
  type RandomSource,
} from '../domain/random'
import { getScale, type ScaleDefinition, type ScaleId } from '../domain/scales'
import type {
  Candidate,
  CandidateProvenance,
  Melody,
  MelodyEvent,
  PitchClass,
  ScaleDegree,
} from '../domain/types'

export const LEGACY_GENERATOR_VERSION = 'legacy-simple-v1' as const
export const LEGACY_TICKS_PER_NOTE = 480
export const LEGACY_MIN_NOTE_COUNT = 4
export const LEGACY_MAX_NOTE_COUNT = 32
export const LEGACY_MIN_POPULATION_SIZE = 1
export const LEGACY_MAX_POPULATION_SIZE = 16
export const LEGACY_MIN_TEMPO_BPM = 30
export const LEGACY_MAX_TEMPO_BPM = 300

export interface LegacyGeneratorSettings {
  readonly tonicPitchClass: PitchClass
  readonly scaleId: ScaleId
  readonly noteCount: number
  readonly tempoBpm: number
  readonly populationSize: number
  readonly seed: string
}

export type NormalizedLegacyGeneratorSettings = LegacyGeneratorSettings

function assertIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${label} must be an integer from ${minimum} to ${maximum}; received ${String(value)}`,
    )
  }
}

export function normalizeLegacySettings(
  settings: LegacyGeneratorSettings,
): NormalizedLegacyGeneratorSettings {
  assertIntegerInRange(settings.tonicPitchClass, 0, 11, 'tonicPitchClass')
  assertIntegerInRange(
    settings.noteCount,
    LEGACY_MIN_NOTE_COUNT,
    LEGACY_MAX_NOTE_COUNT,
    'noteCount',
  )
  assertIntegerInRange(
    settings.populationSize,
    LEGACY_MIN_POPULATION_SIZE,
    LEGACY_MAX_POPULATION_SIZE,
    'populationSize',
  )

  if (
    !Number.isFinite(settings.tempoBpm) ||
    settings.tempoBpm < LEGACY_MIN_TEMPO_BPM ||
    settings.tempoBpm > LEGACY_MAX_TEMPO_BPM
  ) {
    throw new RangeError(
      `tempoBpm must be between ${LEGACY_MIN_TEMPO_BPM} and ${LEGACY_MAX_TEMPO_BPM}; received ${String(settings.tempoBpm)}`,
    )
  }

  const seed = settings.seed.trim()
  if (seed.length === 0) {
    throw new RangeError('seed must contain at least one non-whitespace character')
  }

  // Resolve once here so an unknown ID fails before any random values are read.
  const scale = getScale(settings.scaleId)

  return {
    tonicPitchClass: normalizePitchClass(settings.tonicPitchClass),
    scaleId: scale.id,
    noteCount: settings.noteCount,
    tempoBpm: settings.tempoBpm,
    populationSize: settings.populationSize,
    seed,
  }
}

/**
 * Encode a Legacy pool index as an extended degree whose tonic-relative MIDI
 * value is the same pitch the historical C4-B4 table produced.
 */
export function legacyPoolIndexToExtendedDegree(
  poolIndex: number,
  tonicPitchClass: PitchClass,
  scale: ScaleDefinition,
): ScaleDegree {
  assertIntegerInRange(poolIndex, 0, scale.offsets.length - 1, 'poolIndex')
  const offset = scale.offsets[poolIndex]
  if (offset === undefined) {
    throw new RangeError('The selected scale degree does not exist')
  }

  const tonicMidi = LEGACY_OCTAVE_MIN_MIDI + tonicPitchClass
  const fixedOctaveMidi =
    LEGACY_OCTAVE_MIN_MIDI + normalizePitchClass(tonicPitchClass + offset)
  const degree = midiToScaleDegree(fixedOctaveMidi, tonicMidi, scale)

  if (degree === null) {
    throw new Error('Legacy pitch could not be represented in the selected scale')
  }
  return degree
}

function candidateRandom(
  settings: NormalizedLegacyGeneratorSettings,
  populationIndex: number,
): RandomSource {
  return new SeededRandom(
    stableStringify({
      generatorVersion: LEGACY_GENERATOR_VERSION,
      rngVersion: RNG_VERSION,
      seed: settings.seed,
      tonicPitchClass: settings.tonicPitchClass,
      scaleId: settings.scaleId,
      noteCount: settings.noteCount,
      tempoBpm: settings.tempoBpm,
      populationIndex,
    }),
  )
}

function createEvents(
  settings: NormalizedLegacyGeneratorSettings,
  scale: ScaleDefinition,
  random: RandomSource,
): readonly MelodyEvent[] {
  const events: MelodyEvent[] = []

  for (let index = 0; index < settings.noteCount; index += 1) {
    const isBoundary = index === 0 || index === settings.noteCount - 1
    const degree = isBoundary
      ? 0
      : legacyPoolIndexToExtendedDegree(
          randomInt(random, 0, scale.offsets.length - 1),
          settings.tonicPitchClass,
          scale,
        )

    events.push({
      startTick: index * LEGACY_TICKS_PER_NOTE,
      durationTicks: LEGACY_TICKS_PER_NOTE,
      degree,
    })
  }

  return events
}

function createProvenance(
  settings: NormalizedLegacyGeneratorSettings,
  scale: ScaleDefinition,
  populationIndex: number,
): CandidateProvenance {
  return {
    strategy: 'legacy',
    generatorVersion: LEGACY_GENERATOR_VERSION,
    seed: settings.seed,
    settings: {
      tonicPitchClass: settings.tonicPitchClass,
      scaleId: settings.scaleId,
      noteCount: settings.noteCount,
      tempoBpm: settings.tempoBpm,
      populationSize: settings.populationSize,
      populationIndex,
      ticksPerNote: LEGACY_TICKS_PER_NOTE,
    },
    generation: 0,
    parentIds: [],
    operations: [
      {
        operator: 'independent-uniform-scale-degree',
        parameters: {
          scaleCardinality: scale.offsets.length,
          sampledInternalNotes: settings.noteCount - 2,
        },
      },
      {
        operator: 'force-tonic-boundaries',
        parameters: { start: true, end: true },
      },
    ],
  }
}

/**
 * Generate one candidate. Supplying `random` is intended for focused proofs;
 * normal callers omit it and receive the versioned seeded stream.
 */
export function generateLegacyCandidate(
  input: LegacyGeneratorSettings,
  random?: RandomSource,
  populationIndex = 0,
): Candidate {
  const settings = normalizeLegacySettings(input)
  assertIntegerInRange(
    populationIndex,
    0,
    settings.populationSize - 1,
    'populationIndex',
  )
  const scale = getScale(settings.scaleId)
  const source = random ?? candidateRandom(settings, populationIndex)
  const totalTicks = settings.noteCount * LEGACY_TICKS_PER_NOTE
  const melody: Melody = {
    events: createEvents(settings, scale, source),
    constraints: {
      scaleId: settings.scaleId,
      tonicPitchClass: settings.tonicPitchClass,
      tonicMidi: LEGACY_OCTAVE_MIN_MIDI + settings.tonicPitchClass,
      register: {
        minMidi: LEGACY_OCTAVE_MIN_MIDI,
        maxMidi: LEGACY_OCTAVE_MAX_MIDI,
      },
      pitchMapping: 'legacy-fixed-octave',
      ticksPerBeat: LEGACY_TICKS_PER_NOTE,
      gridTicks: LEGACY_TICKS_PER_NOTE,
      totalTicks,
      tempoBpm: settings.tempoBpm,
      tonicBoundary: { start: true, end: true },
    },
  }
  const provenance = createProvenance(settings, scale, populationIndex)

  assertValidMelody(melody, scale)

  return {
    id: stableId('legacy', { melody, provenance }),
    melody,
    provenance,
  }
}

export function generateLegacyPopulation(
  input: LegacyGeneratorSettings,
): readonly Candidate[] {
  const settings = normalizeLegacySettings(input)

  return Array.from({ length: settings.populationSize }, (_, populationIndex) =>
    generateLegacyCandidate(
      settings,
      candidateRandom(settings, populationIndex),
      populationIndex,
    ),
  )
}
