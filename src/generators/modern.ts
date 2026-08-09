import { stableId } from '../domain/identity'
import { assertValidMelody } from '../domain/invariants'
import { normalizePitchClass, scaleDegreeToMidi } from '../domain/pitch'
import {
  SeededRandom,
  forkSeed,
  randomBoolean,
  randomInt,
  shuffled,
  weightedChoice,
  type RandomSource,
} from '../domain/random'
import { getScale, type ScaleId } from '../domain/scales'
import type {
  Candidate,
  JsonValue,
  Melody,
  MelodyEvent,
  ScaleDegree,
} from '../domain/types'

export const MODERN_GENERATOR_VERSION = 'modern-constrained-v1' as const
export const TICKS_PER_BEAT = 480
export const MODERN_GRID_OPTIONS = [120, 240, 480] as const

export type ModernGridTicks = (typeof MODERN_GRID_OPTIONS)[number]

export interface ModernSettings {
  readonly tonicPitchClass: number
  readonly scaleId: ScaleId
  readonly registerLowOctave: number
  readonly registerHighOctave: number
  readonly noteCount: number
  readonly phraseBeats: number
  readonly tempoBpm: number
  readonly gridTicks: ModernGridTicks
  readonly allowRests: boolean
  readonly maxLeap: number
  readonly tonicClosure: boolean
  readonly populationSize: number
  readonly seed: string
}

export const DEFAULT_MODERN_SETTINGS: ModernSettings = {
  tonicPitchClass: 0,
  scaleId: 'diatonic-ionian',
  registerLowOctave: 4,
  registerHighOctave: 6,
  noteCount: 8,
  phraseBeats: 4,
  tempoBpm: 108,
  gridTicks: 240,
  allowRests: false,
  maxLeap: 4,
  tonicClosure: true,
  populationSize: 8,
  seed: 'paper-kite',
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

function normalizeGrid(value: number): ModernGridTicks {
  return MODERN_GRID_OPTIONS.reduce((nearest, option) =>
    Math.abs(option - value) < Math.abs(nearest - value) ? option : nearest,
  )
}

export function normalizeModernSettings(
  input: Partial<ModernSettings>,
): ModernSettings {
  const tonicPitchClass = normalizePitchClass(
    input.tonicPitchClass ?? DEFAULT_MODERN_SETTINGS.tonicPitchClass,
  )
  const registerLowOctave = clampInteger(
    input.registerLowOctave ?? DEFAULT_MODERN_SETTINGS.registerLowOctave,
    1,
    7,
  )
  const registerHighOctave = clampInteger(
    input.registerHighOctave ?? DEFAULT_MODERN_SETTINGS.registerHighOctave,
    registerLowOctave + 1,
    Math.min(8, registerLowOctave + 4),
  )
  const gridTicks = normalizeGrid(
    input.gridTicks ?? DEFAULT_MODERN_SETTINGS.gridTicks,
  )
  const requestedPhraseBeats = clampInteger(
    input.phraseBeats ?? DEFAULT_MODERN_SETTINGS.phraseBeats,
    2,
    16,
  )
  const phraseBeats = Math.max(
    requestedPhraseBeats,
    Math.ceil((4 * gridTicks) / TICKS_PER_BEAT),
  )
  const availableGridUnits = Math.floor(
    (phraseBeats * TICKS_PER_BEAT) / gridTicks,
  )
  const noteCount = clampInteger(
    input.noteCount ?? DEFAULT_MODERN_SETTINGS.noteCount,
    4,
    Math.min(32, availableGridUnits),
  )

  return {
    tonicPitchClass,
    scaleId: input.scaleId ?? DEFAULT_MODERN_SETTINGS.scaleId,
    registerLowOctave,
    registerHighOctave,
    noteCount,
    phraseBeats,
    tempoBpm: clampInteger(
      input.tempoBpm ?? DEFAULT_MODERN_SETTINGS.tempoBpm,
      40,
      240,
    ),
    gridTicks,
    allowRests: input.allowRests ?? DEFAULT_MODERN_SETTINGS.allowRests,
    maxLeap: clampInteger(
      input.maxLeap ?? DEFAULT_MODERN_SETTINGS.maxLeap,
      1,
      12,
    ),
    tonicClosure: input.tonicClosure ?? DEFAULT_MODERN_SETTINGS.tonicClosure,
    populationSize: clampInteger(
      input.populationSize ?? DEFAULT_MODERN_SETTINGS.populationSize,
      2,
      16,
    ),
    seed: (input.seed ?? DEFAULT_MODERN_SETTINGS.seed).slice(0, 80),
  }
}

function midiForTonicAtOctave(tonicPitchClass: number, octave: number): number {
  return (octave + 1) * 12 + tonicPitchClass
}

function generateDurations(
  totalTicks: number,
  eventCount: number,
  gridTicks: ModernGridTicks,
  random: RandomSource,
): number[] {
  const totalUnits = totalTicks / gridTicks
  const baseUnits = Math.floor(totalUnits / eventCount)
  const units = Array.from({ length: eventCount }, () => baseUnits)
  const remainderIndexes = shuffled(
    random,
    Array.from({ length: eventCount }, (_, index) => index),
  )

  for (let index = 0; index < totalUnits % eventCount; index += 1) {
    units[remainderIndexes[index]!]! += 1
  }

  // Small neighbor-to-neighbor transfers add syncopation without producing
  // extreme values. A duration is never allowed to fall below one grid unit.
  const transferCount = Math.min(eventCount, Math.floor(totalUnits / 3))
  for (let transfer = 0; transfer < transferCount; transfer += 1) {
    if (!randomBoolean(random, 0.45)) {
      continue
    }
    const donor = randomInt(random, 0, eventCount - 1)
    const direction = randomBoolean(random) ? 1 : -1
    const receiver = (donor + direction + eventCount) % eventCount
    if (units[donor]! > 1) {
      units[donor]! -= 1
      units[receiver]! += 1
    }
  }

  return units.map((durationUnits) => durationUnits * gridTicks)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function chooseMagnitude(random: RandomSource, maximum: number): number {
  const choices = Array.from({ length: maximum }, (_, index) => ({
    value: index + 1,
    weight: 1 / (index + 1) ** 1.7,
  }))
  return weightedChoice(random, choices)
}

function generateDegrees(
  eventCount: number,
  minimumDegree: number,
  maximumDegree: number,
  settings: ModernSettings,
  random: RandomSource,
): Array<ScaleDegree | null> {
  const degrees: Array<ScaleDegree | null> = [0]
  let previousSoundingDegree = 0
  let contourDirection = randomBoolean(random) ? 1 : -1
  const finalGeneratedIndex = settings.tonicClosure
    ? eventCount - 2
    : eventCount - 1

  for (let index = 1; index <= finalGeneratedIndex; index += 1) {
    const futureEvents = eventCount - 1 - index
    const mayRest =
      settings.allowRests &&
      index < eventCount - 1 &&
      Math.abs(previousSoundingDegree) <= futureEvents * settings.maxLeap

    if (mayRest && randomBoolean(random, 0.12)) {
      degrees.push(null)
      continue
    }

    if (randomBoolean(random, 0.22)) {
      contourDirection *= -1
    }

    const reachableMinimum = settings.tonicClosure
      ? -futureEvents * settings.maxLeap
      : minimumDegree
    const reachableMaximum = settings.tonicClosure
      ? futureEvents * settings.maxLeap
      : maximumDegree
    const allowedMinimum = Math.max(
      minimumDegree,
      previousSoundingDegree - settings.maxLeap,
      reachableMinimum,
    )
    const allowedMaximum = Math.min(
      maximumDegree,
      previousSoundingDegree + settings.maxLeap,
      reachableMaximum,
    )

    let proposed: number
    const motifSource = index >= 3 ? degrees[index - 3] : undefined
    if (motifSource !== undefined && motifSource !== null && randomBoolean(random, 0.28)) {
      proposed = motifSource + randomInt(random, -1, 1)
    } else if (randomBoolean(random, 0.1)) {
      proposed = previousSoundingDegree
    } else {
      const magnitude = chooseMagnitude(random, settings.maxLeap)
      proposed = previousSoundingDegree + contourDirection * magnitude
    }

    if (proposed < allowedMinimum || proposed > allowedMaximum) {
      contourDirection *= -1
      proposed = previousSoundingDegree +
        contourDirection * Math.min(settings.maxLeap, Math.abs(proposed - previousSoundingDegree))
    }

    const degree = clamp(proposed, allowedMinimum, allowedMaximum)
    degrees.push(degree)
    previousSoundingDegree = degree
  }

  if (settings.tonicClosure) {
    degrees.push(0)
  }

  return degrees
}

function modernSettingsProvenance(
  settings: ModernSettings,
): Readonly<Record<string, JsonValue>> {
  return {
    tonicPitchClass: settings.tonicPitchClass,
    scaleId: settings.scaleId,
    registerLowOctave: settings.registerLowOctave,
    registerHighOctave: settings.registerHighOctave,
    noteCount: settings.noteCount,
    phraseBeats: settings.phraseBeats,
    tempoBpm: settings.tempoBpm,
    gridTicks: settings.gridTicks,
    allowRests: settings.allowRests,
    maxLeap: settings.maxLeap,
    tonicClosure: settings.tonicClosure,
  }
}

export function generateModernCandidate(
  requestedSettings: Partial<ModernSettings>,
  random: RandomSource,
  candidateSeed: string,
  populationIndex = 0,
): Candidate {
  const settings = normalizeModernSettings(requestedSettings)
  const scale = getScale(settings.scaleId)
  const middleOctave = Math.floor(
    (settings.registerLowOctave + settings.registerHighOctave) / 2,
  )
  const tonicMidi = midiForTonicAtOctave(settings.tonicPitchClass, middleOctave)
  const register = {
    minMidi: midiForTonicAtOctave(
      settings.tonicPitchClass,
      settings.registerLowOctave,
    ),
    maxMidi: midiForTonicAtOctave(
      settings.tonicPitchClass,
      settings.registerHighOctave,
    ),
  }
  const minimumDegree = -scale.offsets.length *
    (middleOctave - settings.registerLowOctave)
  const maximumDegree = scale.offsets.length *
    (settings.registerHighOctave - middleOctave)
  const totalTicks = settings.phraseBeats * TICKS_PER_BEAT
  const durations = generateDurations(
    totalTicks,
    settings.noteCount,
    settings.gridTicks,
    random,
  )
  const degrees = generateDegrees(
    settings.noteCount,
    minimumDegree,
    maximumDegree,
    settings,
    random,
  )
  let startTick = 0
  const events: MelodyEvent[] = durations.map((durationTicks, index) => {
    const event: MelodyEvent = {
      startTick,
      durationTicks,
      degree: degrees[index] ?? null,
    }
    startTick += durationTicks
    return event
  })
  const melody: Melody = {
    events,
    constraints: {
      scaleId: settings.scaleId,
      tonicPitchClass: settings.tonicPitchClass,
      tonicMidi,
      register,
      pitchMapping: 'tonic-relative',
      ticksPerBeat: TICKS_PER_BEAT,
      gridTicks: settings.gridTicks,
      totalTicks,
      tempoBpm: settings.tempoBpm,
      tonicBoundary: { start: true, end: settings.tonicClosure },
    },
  }
  const provenance = {
    strategy: 'modern' as const,
    generatorVersion: MODERN_GENERATOR_VERSION,
    seed: candidateSeed,
    settings: modernSettingsProvenance(settings),
    generation: 0,
    parentIds: [],
    operations: [
      {
        operator: 'weighted-contour',
        parameters: { maxLeap: settings.maxLeap, motifWindow: 3 },
      },
      {
        operator: 'balanced-grid-rhythm',
        parameters: { gridTicks: settings.gridTicks, totalTicks },
      },
      ...(settings.allowRests
        ? [
            {
              operator: 'sparse-rests',
              parameters: { probability: 0.12 },
            },
          ]
        : []),
    ],
  }
  const id = stableId('candidate', {
    populationIndex,
    melody,
    provenance,
  })

  assertValidMelody(melody, scale)

  return { id, melody, provenance }
}

export function generateModernPopulation(
  requestedSettings: Partial<ModernSettings> = {},
): Candidate[] {
  const settings = normalizeModernSettings(requestedSettings)

  return Array.from({ length: settings.populationSize }, (_, index) => {
    const candidateSeed = forkSeed(settings.seed, `modern-${index}`)
    return generateModernCandidate(
      settings,
      new SeededRandom(candidateSeed),
      candidateSeed,
      index,
    )
  })
}

/** Exposed for focused invariant tests and explainable UI help. */
export function soundingMidis(candidate: Candidate): number[] {
  const scale = getScale(candidate.melody.constraints.scaleId)
  return candidate.melody.events.flatMap((event) =>
    event.degree === null
      ? []
      : [
          scaleDegreeToMidi(
            event.degree,
            candidate.melody.constraints.tonicMidi,
            scale,
          ),
        ],
  )
}
