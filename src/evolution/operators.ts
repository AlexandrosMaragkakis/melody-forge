import { stableStringify } from '../domain/identity'
import { cloneMelody, exactMusicalFingerprint } from '../domain/invariants'
import {
  legacyScaleDegreeToMidi,
  midiToScaleDegree,
  scaleDegreeToMidi,
} from '../domain/pitch'
import {
  randomBoolean,
  randomInt,
  randomItem,
  type RandomSource,
} from '../domain/random'
import { getScale } from '../domain/scales'
import type {
  Candidate,
  EvolutionOperationProvenance,
  JsonValue,
  Melody,
  MelodyEvent,
} from '../domain/types'
import type {
  EvolutionOperatorResult,
  MutationOperatorName,
} from './types'
import {
  MAX_EVOLUTION_EVENT_COUNT,
  MIN_EVOLUTION_EVENT_COUNT,
} from './types'

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}

function provenance(
  operator: string,
  parameters: Readonly<Record<string, JsonValue>>,
): EvolutionOperationProvenance {
  return { operator, parameters }
}

function result(
  original: Melody,
  melody: Melody,
  operator: string,
  parameters: Readonly<Record<string, JsonValue>>,
): EvolutionOperatorResult {
  return {
    melody,
    changed:
      exactMusicalFingerprint(original) !== exactMusicalFingerprint(melody),
    operation: provenance(operator, parameters),
  }
}

function unchanged(
  melody: Melody,
  operator: string,
  reason: string,
): EvolutionOperatorResult {
  return result(melody, cloneMelody(melody), operator, {
    applied: false,
    reason,
  })
}

function modernAllowedDegrees(melody: Melody): readonly number[] {
  const { constraints } = melody
  const scale = getScale(constraints.scaleId)
  const minimumOctave =
    Math.floor((constraints.register.minMidi - constraints.tonicMidi - 11) / 12) - 1
  const maximumOctave =
    Math.ceil((constraints.register.maxMidi - constraints.tonicMidi + 11) / 12) + 1
  const degrees: number[] = []

  for (let octave = minimumOctave; octave <= maximumOctave; octave += 1) {
    for (let index = 0; index < scale.offsets.length; index += 1) {
      const degree = octave * scale.offsets.length + index
      const midi = scaleDegreeToMidi(degree, constraints.tonicMidi, scale)
      if (
        midi >= constraints.register.minMidi &&
        midi <= constraints.register.maxMidi
      ) {
        degrees.push(degree)
      }
    }
  }

  return degrees.sort((left, right) => left - right)
}

/** Maps a proposed extended degree to the nearest representation allowed by the melody. */
export function constrainDegreeToMelody(
  proposedDegree: number,
  melody: Melody,
): number {
  const { constraints } = melody
  const scale = getScale(constraints.scaleId)

  if (constraints.pitchMapping === 'legacy-fixed-octave') {
    const midi = legacyScaleDegreeToMidi(
      proposedDegree,
      constraints.tonicPitchClass,
      scale,
    )
    const canonicalDegree = midiToScaleDegree(
      midi,
      constraints.tonicMidi,
      scale,
    )
    if (canonicalDegree === null) {
      throw new Error('A legacy scale degree could not be represented in its fixed octave')
    }
    return canonicalDegree
  }

  const allowed = modernAllowedDegrees(melody)
  if (allowed.length === 0) {
    throw new RangeError('The configured register contains no usable scale degree')
  }

  return allowed.reduce((nearest, degree) => {
    const nearestDistance = Math.abs(nearest - proposedDegree)
    const candidateDistance = Math.abs(degree - proposedDegree)
    return candidateDistance < nearestDistance ? degree : nearest
  })
}

function rebuildMelody(
  source: Melody,
  requestedEvents: readonly Pick<MelodyEvent, 'durationTicks' | 'degree'>[],
): Melody {
  const melody = cloneMelody(source)
  let startTick = 0
  const events = requestedEvents.map(({ durationTicks, degree }) => {
    const event: MelodyEvent = {
      startTick,
      durationTicks,
      degree:
        degree === null ? null : constrainDegreeToMelody(degree, melody),
    }
    startTick += durationTicks
    return event
  })

  if (events.length > 0 && melody.constraints.tonicBoundary.start) {
    events[0] = { ...events[0]!, degree: 0 }
  }
  if (events.length > 0 && melody.constraints.tonicBoundary.end) {
    const finalIndex = events.length - 1
    events[finalIndex] = { ...events[finalIndex]!, degree: 0 }
  }

  return { constraints: melody.constraints, events }
}

function mutableBounds(melody: Melody): {
  readonly start: number
  readonly endExclusive: number
} {
  return {
    start: melody.constraints.tonicBoundary.start ? 1 : 0,
    endExclusive:
      melody.events.length - (melody.constraints.tonicBoundary.end ? 1 : 0),
  }
}

function chooseSegment(
  melody: Melody,
  random: RandomSource,
): { readonly start: number; readonly length: number } | null {
  const bounds = mutableBounds(melody)
  const available = bounds.endExclusive - bounds.start
  if (available < 2) {
    return null
  }

  const length = randomInt(random, 2, Math.min(4, available))
  return {
    start: randomInt(random, bounds.start, bounds.endExclusive - length),
    length,
  }
}

function degreesOf(melody: Melody): Array<number | null> {
  return melody.events.map(({ degree }) => degree)
}

function melodyWithDegrees(
  melody: Melody,
  degrees: readonly (number | null)[],
): Melody {
  return rebuildMelody(
    melody,
    melody.events.map((event, index) => ({
      durationTicks: event.durationTicks,
      degree: degrees[index] ?? null,
    })),
  )
}

function mutateDegreeMove(
  melody: Melody,
  strength: number,
  random: RandomSource,
): EvolutionOperatorResult {
  const operator = 'degree-move'
  const bounds = mutableBounds(melody)
  const eligible = melody.events
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event, index }) =>
        index >= bounds.start &&
        index < bounds.endExclusive &&
        event.degree !== null,
    )
  if (eligible.length === 0) {
    return unchanged(melody, operator, 'no mutable sounding event')
  }

  const selected = randomItem(random, eligible)
  const scaleSize = getScale(melody.constraints.scaleId).offsets.length
  const largeMovement = randomBoolean(random, 0.08 + strength * 0.27)
  const maximumLargeMagnitude = Math.max(2, Math.round(scaleSize * (0.5 + strength)))
  const magnitude = largeMovement
    ? randomInt(random, 2, maximumLargeMagnitude)
    : randomInt(random, 1, Math.max(1, Math.round(1 + strength)))
  const direction = randomBoolean(random) ? 1 : -1
  const originalDegree = selected.event.degree!
  let proposed = constrainDegreeToMelody(
    originalDegree + direction * magnitude,
    melody,
  )
  if (proposed === originalDegree) {
    proposed = constrainDegreeToMelody(
      originalDegree - direction * magnitude,
      melody,
    )
  }

  const degrees = degreesOf(melody)
  degrees[selected.index] = proposed
  const mutated = melodyWithDegrees(melody, degrees)
  return result(melody, mutated, operator, {
    applied: proposed !== originalDegree,
    eventIndex: selected.index,
    fromDegree: originalDegree,
    toDegree: proposed,
    requestedMagnitude: magnitude,
    largerMovement: largeMovement,
  })
}

function mutateMotifRepeat(
  melody: Melody,
  random: RandomSource,
): EvolutionOperatorResult {
  const operator = 'motif-repeat'
  const segment = chooseSegment(melody, random)
  if (segment === null) {
    return unchanged(melody, operator, 'fewer than two mutable events')
  }

  const bounds = mutableBounds(melody)
  const finalStart = bounds.endExclusive - segment.length
  let targetStart = randomInt(random, bounds.start, finalStart)
  if (targetStart === segment.start && finalStart > bounds.start) {
    targetStart =
      targetStart === finalStart ? bounds.start : targetStart + 1
  }

  const degrees = degreesOf(melody)
  const motif = degrees.slice(segment.start, segment.start + segment.length)
  for (let index = 0; index < segment.length; index += 1) {
    degrees[targetStart + index] = motif[index] ?? null
  }
  const mutated = melodyWithDegrees(melody, degrees)
  return result(melody, mutated, operator, {
    applied: exactMusicalFingerprint(melody) !== exactMusicalFingerprint(mutated),
    sourceStart: segment.start,
    targetStart,
    length: segment.length,
  })
}

function mutateMotifReverse(
  melody: Melody,
  random: RandomSource,
): EvolutionOperatorResult {
  const operator = 'motif-reverse'
  const segment = chooseSegment(melody, random)
  if (segment === null) {
    return unchanged(melody, operator, 'fewer than two mutable events')
  }

  const degrees = degreesOf(melody)
  const reversed = degrees
    .slice(segment.start, segment.start + segment.length)
    .reverse()
  degrees.splice(segment.start, segment.length, ...reversed)
  const mutated = melodyWithDegrees(melody, degrees)
  return result(melody, mutated, operator, {
    applied: exactMusicalFingerprint(melody) !== exactMusicalFingerprint(mutated),
    start: segment.start,
    length: segment.length,
  })
}

function mutateMotifShift(
  melody: Melody,
  random: RandomSource,
): EvolutionOperatorResult {
  const operator = 'motif-shift'
  const segment = chooseSegment(melody, random)
  if (segment === null) {
    return unchanged(melody, operator, 'fewer than two mutable events')
  }

  const shift = randomInt(random, 1, segment.length - 1)
  const degrees = degreesOf(melody)
  const motif = degrees.slice(segment.start, segment.start + segment.length)
  const shifted = motif.slice(-shift).concat(motif.slice(0, -shift))
  degrees.splice(segment.start, segment.length, ...shifted)
  const mutated = melodyWithDegrees(melody, degrees)
  return result(melody, mutated, operator, {
    applied: exactMusicalFingerprint(melody) !== exactMusicalFingerprint(mutated),
    start: segment.start,
    length: segment.length,
    shift,
  })
}

function mutateMotifInvert(
  melody: Melody,
  random: RandomSource,
): EvolutionOperatorResult {
  const operator = 'motif-invert'
  const segment = chooseSegment(melody, random)
  if (segment === null) {
    return unchanged(melody, operator, 'fewer than two mutable events')
  }

  const degrees = degreesOf(melody)
  const motif = degrees.slice(segment.start, segment.start + segment.length)
  const pivot = motif.find((degree): degree is number => degree !== null)
  if (pivot === undefined) {
    return unchanged(melody, operator, 'selected motif contains only rests')
  }

  for (let index = 0; index < motif.length; index += 1) {
    const degree = motif[index]
    if (degree !== null && degree !== undefined) {
      degrees[segment.start + index] = constrainDegreeToMelody(
        2 * pivot - degree,
        melody,
      )
    }
  }
  const mutated = melodyWithDegrees(melody, degrees)
  return result(melody, mutated, operator, {
    applied: exactMusicalFingerprint(melody) !== exactMusicalFingerprint(mutated),
    start: segment.start,
    length: segment.length,
    pivotDegree: pivot,
  })
}

function mutateMotifTranspose(
  melody: Melody,
  strength: number,
  random: RandomSource,
): EvolutionOperatorResult {
  const operator = 'motif-transpose'
  const segment = chooseSegment(melody, random)
  if (segment === null) {
    return unchanged(melody, operator, 'fewer than two mutable events')
  }

  const maximumMagnitude = Math.max(1, Math.round(1 + strength * 3))
  const requestedDelta =
    randomInt(random, 1, maximumMagnitude) * (randomBoolean(random) ? 1 : -1)
  const degrees = degreesOf(melody)
  for (let index = segment.start; index < segment.start + segment.length; index += 1) {
    const degree = degrees[index]
    if (degree !== null && degree !== undefined) {
      degrees[index] = constrainDegreeToMelody(degree + requestedDelta, melody)
    }
  }
  const mutated = melodyWithDegrees(melody, degrees)
  return result(melody, mutated, operator, {
    applied: exactMusicalFingerprint(melody) !== exactMusicalFingerprint(mutated),
    start: segment.start,
    length: segment.length,
    requestedDelta,
  })
}

function mutateRhythmSplit(
  melody: Melody,
  random: RandomSource,
): EvolutionOperatorResult {
  const operator = 'rhythm-split'
  if (melody.events.length >= MAX_EVOLUTION_EVENT_COUNT) {
    return unchanged(melody, operator, 'melody already has the maximum event count')
  }
  const grid = melody.constraints.gridTicks
  const eligible = melody.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.durationTicks >= grid * 2)
  if (eligible.length === 0) {
    return unchanged(melody, operator, 'no event spans at least two grid units')
  }

  const selected = randomItem(random, eligible)
  const totalUnits = selected.event.durationTicks / grid
  const firstUnits = randomInt(random, 1, totalUnits - 1)
  const requestedEvents = melody.events.map(({ durationTicks, degree }) => ({
    durationTicks,
    degree,
  }))
  requestedEvents.splice(
    selected.index,
    1,
    { durationTicks: firstUnits * grid, degree: selected.event.degree },
    {
      durationTicks: (totalUnits - firstUnits) * grid,
      degree: selected.event.degree,
    },
  )
  const mutated = rebuildMelody(melody, requestedEvents)
  return result(melody, mutated, operator, {
    applied: true,
    eventIndex: selected.index,
    firstDurationTicks: firstUnits * grid,
    secondDurationTicks: (totalUnits - firstUnits) * grid,
  })
}

function mutateRhythmMerge(
  melody: Melody,
  random: RandomSource,
): EvolutionOperatorResult {
  const operator = 'rhythm-merge'
  if (melody.events.length <= MIN_EVOLUTION_EVENT_COUNT) {
    return unchanged(melody, operator, 'melody already has the minimum event count')
  }

  const firstIndex = randomInt(random, 0, melody.events.length - 2)
  const first = melody.events[firstIndex]!
  const second = melody.events[firstIndex + 1]!
  let inheritedDegree: number | null
  if (firstIndex === 0 && melody.constraints.tonicBoundary.start) {
    inheritedDegree = first.degree
  } else if (
    firstIndex + 1 === melody.events.length - 1 &&
    melody.constraints.tonicBoundary.end
  ) {
    inheritedDegree = second.degree
  } else {
    inheritedDegree = randomBoolean(random) ? first.degree : second.degree
  }

  const requestedEvents = melody.events.map(({ durationTicks, degree }) => ({
    durationTicks,
    degree,
  }))
  requestedEvents.splice(firstIndex, 2, {
    durationTicks: first.durationTicks + second.durationTicks,
    degree: inheritedDegree,
  })
  const mutated = rebuildMelody(melody, requestedEvents)
  return result(melody, mutated, operator, {
    applied: true,
    firstEventIndex: firstIndex,
    inheritedDegree,
    mergedDurationTicks: first.durationTicks + second.durationTicks,
  })
}

function nearestSoundingDegree(
  melody: Melody,
  selectedIndex: number,
): number {
  for (let distance = 1; distance < melody.events.length; distance += 1) {
    const before = melody.events[selectedIndex - distance]?.degree
    if (before !== undefined && before !== null) {
      return before
    }
    const after = melody.events[selectedIndex + distance]?.degree
    if (after !== undefined && after !== null) {
      return after
    }
  }
  return 0
}

function mutateRestToggle(
  melody: Melody,
  random: RandomSource,
): EvolutionOperatorResult {
  const operator = 'rest-toggle'
  const bounds = mutableBounds(melody)
  const eligible = Array.from(
    { length: Math.max(0, bounds.endExclusive - bounds.start) },
    (_, index) => bounds.start + index,
  )
  if (eligible.length === 0) {
    return unchanged(melody, operator, 'no mutable event')
  }

  const selectedIndex = randomItem(random, eligible)
  const degrees = degreesOf(melody)
  const previousDegree = degrees[selectedIndex]
  const nextDegree =
    previousDegree === null
      ? constrainDegreeToMelody(nearestSoundingDegree(melody, selectedIndex), melody)
      : null
  degrees[selectedIndex] = nextDegree
  const mutated = melodyWithDegrees(melody, degrees)
  return result(melody, mutated, operator, {
    applied: true,
    eventIndex: selectedIndex,
    fromRest: previousDegree === null,
    toRest: nextDegree === null,
  })
}

export function applyMutationOperator(
  melody: Melody,
  operator: MutationOperatorName,
  mutationStrength: number,
  random: RandomSource,
): EvolutionOperatorResult {
  const strength = clampUnit(mutationStrength)
  if (strength === 0) {
    return unchanged(melody, operator, 'mutation strength is zero')
  }

  switch (operator) {
    case 'degree-move':
      return mutateDegreeMove(melody, strength, random)
    case 'motif-repeat':
      return mutateMotifRepeat(melody, random)
    case 'motif-reverse':
      return mutateMotifReverse(melody, random)
    case 'motif-shift':
      return mutateMotifShift(melody, random)
    case 'motif-invert':
      return mutateMotifInvert(melody, random)
    case 'motif-transpose':
      return mutateMotifTranspose(melody, strength, random)
    case 'rhythm-split':
      return mutateRhythmSplit(melody, random)
    case 'rhythm-merge':
      return mutateRhythmMerge(melody, random)
    case 'rest-toggle':
      return mutateRestToggle(melody, random)
  }
}

export function assertCompatibleParents(
  parents: readonly Candidate[],
): void {
  if (parents.length !== 1 && parents.length !== 2) {
    throw new RangeError('Evolution requires exactly one or two selected parents')
  }
  if (new Set(parents.map(({ id }) => id)).size !== parents.length) {
    throw new RangeError('Selected parent IDs must be unique')
  }
  for (const parent of parents) {
    if (
      parent.melody.events.length < MIN_EVOLUTION_EVENT_COUNT ||
      parent.melody.events.length > MAX_EVOLUTION_EVENT_COUNT
    ) {
      throw new RangeError(
        `Evolution supports melodies with ${String(MIN_EVOLUTION_EVENT_COUNT)}–${String(MAX_EVOLUTION_EVENT_COUNT)} events`,
      )
    }
  }
  if (
    parents.length === 2 &&
    stableStringify(parents[0]!.melody.constraints) !==
      stableStringify(parents[1]!.melody.constraints)
  ) {
    throw new RangeError('Two-parent crossover requires identical melody constraints')
  }
}

export function compatibleCrossoverBoundaries(
  first: Candidate,
  second: Candidate,
): readonly number[] {
  assertCompatibleParents([first, second])
  const firstBoundaries = new Set(
    first.melody.events.slice(1).map(({ startTick }) => startTick),
  )
  return second.melody.events
    .slice(1)
    .map(({ startTick }) => startTick)
    .filter(
      (tick) => {
        if (
          tick <= 0 ||
          tick >= first.melody.constraints.totalTicks ||
          !firstBoundaries.has(tick)
        ) {
          return false
        }
        const firstPrefix = first.melody.events.filter(
          ({ startTick }) => startTick < tick,
        ).length
        const firstSuffix = first.melody.events.length - firstPrefix
        const secondPrefix = second.melody.events.filter(
          ({ startTick }) => startTick < tick,
        ).length
        const secondSuffix = second.melody.events.length - secondPrefix
        return [firstPrefix + secondSuffix, secondPrefix + firstSuffix].every(
          (eventCount) =>
            eventCount >= MIN_EVOLUTION_EVENT_COUNT &&
            eventCount <= MAX_EVOLUTION_EVENT_COUNT,
        )
      },
    )
}

export function compatibleBoundaryCrossover(
  first: Candidate,
  second: Candidate,
  random: RandomSource,
): EvolutionOperatorResult {
  const boundaries = compatibleCrossoverBoundaries(first, second)
  if (boundaries.length === 0) {
    return unchanged(
      first.melody,
      'compatible-boundary-crossover',
      'parents have no shared internal event boundary',
    )
  }

  const boundaryTick = randomItem(random, boundaries)
  const swapOrientation = randomBoolean(random)
  const prefixParent = swapOrientation ? second : first
  const suffixParent = swapOrientation ? first : second
  const prefix = prefixParent.melody.events.filter(
    ({ startTick }) => startTick < boundaryTick,
  )
  const suffix = suffixParent.melody.events.filter(
    ({ startTick }) => startTick >= boundaryTick,
  )
  const child = rebuildMelody(first.melody, [...prefix, ...suffix])

  return result(first.melody, child, 'compatible-boundary-crossover', {
    applied: true,
    boundaryTick,
    prefixParentId: prefixParent.id,
    suffixParentId: suffixParent.id,
  })
}

function nearestSoundingEventDegree(
  melody: Melody,
  eventIndex: number,
): number {
  const direct = melody.events[eventIndex]?.degree
  if (direct !== undefined && direct !== null) {
    return direct
  }
  return nearestSoundingDegree(melody, eventIndex)
}

function pitchEventIndexAtTick(melody: Melody, tick: number): number {
  const index = melody.events.findIndex(
    (event) =>
      tick >= event.startTick && tick < event.startTick + event.durationTicks,
  )
  return index === -1 ? Math.max(0, melody.events.length - 1) : index
}

/** Inherits event timing/rest placement from one parent and pitch contour from the other. */
export function contourRhythmCrossover(
  pitchParent: Candidate,
  rhythmParent: Candidate,
): EvolutionOperatorResult {
  assertCompatibleParents([pitchParent, rhythmParent])
  const requestedEvents = rhythmParent.melody.events.map((rhythmEvent) => {
    if (rhythmEvent.degree === null) {
      return { durationTicks: rhythmEvent.durationTicks, degree: null }
    }

    const midpoint = rhythmEvent.startTick + Math.floor(rhythmEvent.durationTicks / 2)
    const pitchIndex = pitchEventIndexAtTick(pitchParent.melody, midpoint)
    return {
      durationTicks: rhythmEvent.durationTicks,
      degree: nearestSoundingEventDegree(pitchParent.melody, pitchIndex),
    }
  })
  const child = rebuildMelody(rhythmParent.melody, requestedEvents)

  return result(rhythmParent.melody, child, 'contour-rhythm-crossover', {
    applied: true,
    pitchParentId: pitchParent.id,
    rhythmParentId: rhythmParent.id,
    eventCount: requestedEvents.length,
  })
}
