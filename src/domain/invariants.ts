import type { ScaleDefinition } from './scales'
import { getScale } from './scales'
import {
  MIDI_MAX,
  MIDI_MIN,
  isTonicScaleDegree,
  melodyDegreeToMidi,
  normalizePitchClass,
} from './pitch'
import type {
  Candidate,
  CandidateProvenance,
  GenerationSnapshot,
  JsonValue,
  Melody,
  MelodyConstraints,
} from './types'

export type ScaleForMelody = Pick<ScaleDefinition, 'id' | 'offsets'>

export type MelodyValidationCode =
  | 'EMPTY_EVENTS'
  | 'INVALID_SCALE'
  | 'SCALE_ID_MISMATCH'
  | 'INVALID_PITCH_MAPPING'
  | 'INVALID_TONIC_PITCH_CLASS'
  | 'INVALID_TONIC_MIDI'
  | 'TONIC_MIDI_PITCH_CLASS_MISMATCH'
  | 'INVALID_REGISTER'
  | 'TONIC_OUTSIDE_REGISTER'
  | 'INVALID_TICKS_PER_BEAT'
  | 'INVALID_GRID'
  | 'INVALID_TOTAL_TICKS'
  | 'INVALID_TEMPO'
  | 'INVALID_TONIC_BOUNDARY'
  | 'TOTAL_NOT_ON_GRID'
  | 'INVALID_START_TICK'
  | 'INVALID_DURATION'
  | 'EVENT_NOT_ON_GRID'
  | 'NON_CONTIGUOUS'
  | 'INVALID_DEGREE'
  | 'MIDI_OUT_OF_REGISTER'
  | 'PHRASE_TOTAL_MISMATCH'
  | 'TONIC_START_REQUIRED'
  | 'TONIC_END_REQUIRED'

export interface MelodyValidationIssue {
  readonly code: MelodyValidationCode
  readonly path: string
  readonly message: string
}

function issue(
  code: MelodyValidationCode,
  path: string,
  message: string,
): MelodyValidationIssue {
  return { code, path, message }
}

function isSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value)
}

function isValidMidi(value: number): boolean {
  return isSafeInteger(value) && value >= MIDI_MIN && value <= MIDI_MAX
}

function hasValidOffsets(scale: ScaleForMelody): boolean {
  if (scale.offsets.length === 0 || scale.offsets[0] !== 0) {
    return false
  }

  let previous = -1
  for (const offset of scale.offsets) {
    if (!isSafeInteger(offset) || offset < 0 || offset > 11 || offset <= previous) {
      return false
    }
    previous = offset
  }
  return true
}

/**
 * Validates both configuration and event invariants. Events are degree-based,
 * so an integer degree is in-scale by construction; validation only has to
 * confirm that its mapped MIDI note fits the configured inclusive register.
 */
export function validateMelody(
  melody: Melody,
  scale: ScaleForMelody,
): readonly MelodyValidationIssue[] {
  const issues: MelodyValidationIssue[] = []
  const { constraints, events } = melody
  const {
    gridTicks,
    pitchMapping,
    register,
    tempoBpm,
    ticksPerBeat,
    tonicBoundary,
    tonicMidi,
    tonicPitchClass,
    totalTicks,
  } = constraints

  const validScale = hasValidOffsets(scale)
  if (!validScale) {
    issues.push(
      issue(
        'INVALID_SCALE',
        'scale.offsets',
        'Scale offsets must start at zero and be unique ascending integers from 0 to 11.',
      ),
    )
  }

  if (scale.id !== constraints.scaleId) {
    issues.push(
      issue(
        'SCALE_ID_MISMATCH',
        'constraints.scaleId',
        `Melody scale ${String(constraints.scaleId)} does not match supplied scale ${String(scale.id)}.`,
      ),
    )
  }

  const validPitchMapping =
    pitchMapping === 'tonic-relative' || pitchMapping === 'legacy-fixed-octave'
  if (!validPitchMapping) {
    issues.push(
      issue('INVALID_PITCH_MAPPING', 'constraints.pitchMapping', 'Pitch mapping is not supported.'),
    )
  }

  const validTonicPitchClass =
    isSafeInteger(tonicPitchClass) && tonicPitchClass >= 0 && tonicPitchClass <= 11
  if (!validTonicPitchClass) {
    issues.push(
      issue(
        'INVALID_TONIC_PITCH_CLASS',
        'constraints.tonicPitchClass',
        'Tonic pitch class must be an integer from 0 to 11.',
      ),
    )
  }

  const validTonicMidi = isValidMidi(tonicMidi)
  if (!validTonicMidi) {
    issues.push(
      issue(
        'INVALID_TONIC_MIDI',
        'constraints.tonicMidi',
        `Tonic MIDI must be an integer from ${MIDI_MIN} to ${MIDI_MAX}.`,
      ),
    )
  } else if (
    validTonicPitchClass &&
    normalizePitchClass(tonicMidi) !== tonicPitchClass
  ) {
    issues.push(
      issue(
        'TONIC_MIDI_PITCH_CLASS_MISMATCH',
        'constraints.tonicMidi',
        'Tonic MIDI anchor must have the configured tonic pitch class.',
      ),
    )
  }

  const validRegister =
    isValidMidi(register.minMidi) &&
    isValidMidi(register.maxMidi) &&
    register.minMidi <= register.maxMidi
  if (!validRegister) {
    issues.push(
      issue(
        'INVALID_REGISTER',
        'constraints.register',
        `Register bounds must be inclusive MIDI integers from ${MIDI_MIN} to ${MIDI_MAX}, with minMidi <= maxMidi.`,
      ),
    )
  } else if (validTonicMidi && (tonicMidi < register.minMidi || tonicMidi > register.maxMidi)) {
    issues.push(
      issue(
        'TONIC_OUTSIDE_REGISTER',
        'constraints.tonicMidi',
        'Tonic MIDI anchor must lie inside the configured register.',
      ),
    )
  }

  const validTicksPerBeat = isSafeInteger(ticksPerBeat) && ticksPerBeat > 0
  if (!validTicksPerBeat) {
    issues.push(
      issue(
        'INVALID_TICKS_PER_BEAT',
        'constraints.ticksPerBeat',
        'Ticks per beat must be a positive integer.',
      ),
    )
  }

  const validGrid = isSafeInteger(gridTicks) && gridTicks > 0
  if (!validGrid) {
    issues.push(
      issue('INVALID_GRID', 'constraints.gridTicks', 'Grid size must be a positive integer.'),
    )
  }

  const validTotal = isSafeInteger(totalTicks) && totalTicks > 0
  if (!validTotal) {
    issues.push(
      issue(
        'INVALID_TOTAL_TICKS',
        'constraints.totalTicks',
        'Phrase total must be a positive integer number of ticks.',
      ),
    )
  } else if (validGrid && totalTicks % gridTicks !== 0) {
    issues.push(
      issue(
        'TOTAL_NOT_ON_GRID',
        'constraints.totalTicks',
        'Phrase total must align to the configured rhythmic grid.',
      ),
    )
  }

  if (!Number.isFinite(tempoBpm) || tempoBpm <= 0) {
    issues.push(
      issue('INVALID_TEMPO', 'constraints.tempoBpm', 'Tempo must be a positive finite number.'),
    )
  }

  if (typeof tonicBoundary.start !== 'boolean' || typeof tonicBoundary.end !== 'boolean') {
    issues.push(
      issue(
        'INVALID_TONIC_BOUNDARY',
        'constraints.tonicBoundary',
        'Tonic boundary flags must be booleans.',
      ),
    )
  }

  if (events.length === 0) {
    issues.push(issue('EMPTY_EVENTS', 'events', 'A melody must contain at least one event.'))
  }

  let previousEnd: number | null = 0
  for (const [index, event] of events.entries()) {
    const eventPath = `events[${index}]`
    const validStart = isSafeInteger(event.startTick) && event.startTick >= 0
    const validDuration = isSafeInteger(event.durationTicks) && event.durationTicks > 0

    if (!validStart) {
      issues.push(
        issue(
          'INVALID_START_TICK',
          `${eventPath}.startTick`,
          'Event start must be a non-negative integer tick.',
        ),
      )
    }
    if (!validDuration) {
      issues.push(
        issue(
          'INVALID_DURATION',
          `${eventPath}.durationTicks`,
          'Event duration must be a positive integer number of ticks.',
        ),
      )
    }

    if (validStart && previousEnd !== null && event.startTick !== previousEnd) {
      issues.push(
        issue(
          'NON_CONTIGUOUS',
          `${eventPath}.startTick`,
          `Event must start at tick ${String(previousEnd)} to keep the phrase contiguous and monophonic.`,
        ),
      )
    }

    if (
      validGrid &&
      ((validStart && event.startTick % gridTicks !== 0) ||
        (validDuration && event.durationTicks % gridTicks !== 0))
    ) {
      issues.push(
        issue(
          'EVENT_NOT_ON_GRID',
          eventPath,
          'Event start and duration must align to the configured rhythmic grid.',
        ),
      )
    }

    if (event.degree !== null && !isSafeInteger(event.degree)) {
      issues.push(
        issue(
          'INVALID_DEGREE',
          `${eventPath}.degree`,
          'A sounding event degree must be a safe integer; rests use null.',
        ),
      )
    } else if (
      event.degree !== null &&
      validScale &&
      validPitchMapping &&
      validTonicMidi &&
      validTonicPitchClass &&
      validRegister
    ) {
      const midi = melodyDegreeToMidi(event.degree, constraints, scale)
      if (midi < register.minMidi || midi > register.maxMidi) {
        issues.push(
          issue(
            'MIDI_OUT_OF_REGISTER',
            `${eventPath}.degree`,
            `Mapped MIDI ${String(midi)} is outside the inclusive register ${String(register.minMidi)}–${String(register.maxMidi)}.`,
          ),
        )
      }
    }

    previousEnd =
      validStart && validDuration ? event.startTick + event.durationTicks : null
  }

  if (validTotal && previousEnd !== null && previousEnd !== totalTicks) {
    issues.push(
      issue(
        'PHRASE_TOTAL_MISMATCH',
        'events',
        `Events end at tick ${String(previousEnd)}, but the phrase total is ${String(totalTicks)}.`,
      ),
    )
  }

  if (validScale && events.length > 0) {
    const firstDegree = events[0]?.degree
    const lastDegree = events[events.length - 1]?.degree

    if (
      tonicBoundary.start &&
      (firstDegree === null ||
        firstDegree === undefined ||
        !isSafeInteger(firstDegree) ||
        !isTonicScaleDegree(firstDegree, scale.offsets.length))
    ) {
      issues.push(
        issue(
          'TONIC_START_REQUIRED',
          'events[0].degree',
          'The first event must be a sounding tonic when tonic start is required.',
        ),
      )
    }

    if (
      tonicBoundary.end &&
      (lastDegree === null ||
        lastDegree === undefined ||
        !isSafeInteger(lastDegree) ||
        !isTonicScaleDegree(lastDegree, scale.offsets.length))
    ) {
      issues.push(
        issue(
          'TONIC_END_REQUIRED',
          `events[${String(events.length - 1)}].degree`,
          'The final event must be a sounding tonic when tonic end is required.',
        ),
      )
    }
  }

  return issues
}

export class MelodyInvariantError extends Error {
  readonly issues: readonly MelodyValidationIssue[]

  constructor(issues: readonly MelodyValidationIssue[]) {
    super(issues.map(({ path, message }) => `${path}: ${message}`).join('\n'))
    this.name = 'MelodyInvariantError'
    this.issues = issues.map((validationIssue) => ({ ...validationIssue }))
  }
}

export function assertValidMelody(melody: Melody, scale: ScaleForMelody): void {
  const issues = validateMelody(melody, scale)
  if (issues.length > 0) {
    throw new MelodyInvariantError(issues)
  }
}

export function isValidMelody(melody: Melody, scale: ScaleForMelody): boolean {
  return validateMelody(melody, scale).length === 0
}

/**
 * Collision-free structural key for exact musical deduplication. Generator
 * constraints that do not change playback (register, grid, boundary flags) are
 * deliberately omitted, as are IDs and provenance.
 */
export function exactMusicalFingerprint(melody: Melody): string {
  const { constraints, events } = melody
  const scale = getScale(constraints.scaleId)
  return JSON.stringify([
    'melody-v2',
    constraints.scaleId,
    constraints.tonicPitchClass,
    constraints.tonicMidi,
    constraints.pitchMapping,
    constraints.ticksPerBeat,
    constraints.totalTicks,
    constraints.tempoBpm,
    events.map((event) => [
      event.startTick,
      event.durationTicks,
      event.degree === null
        ? null
        : melodyDegreeToMidi(event.degree, constraints, scale),
    ]),
  ])
}

export const melodyFingerprint = exactMusicalFingerprint

function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(cloneJsonValue)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneJsonValue(nestedValue)]),
    )
  }
  return value
}

function cloneJsonRecord(
  value: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, cloneJsonValue(nestedValue)]),
  )
}

export function cloneMelodyConstraints(constraints: MelodyConstraints): MelodyConstraints {
  return {
    ...constraints,
    register: { ...constraints.register },
    tonicBoundary: { ...constraints.tonicBoundary },
  }
}

export function cloneMelody(melody: Melody): Melody {
  return {
    constraints: cloneMelodyConstraints(melody.constraints),
    events: melody.events.map((event) => ({ ...event })),
  }
}

export function cloneProvenance(provenance: CandidateProvenance): CandidateProvenance {
  return {
    ...provenance,
    settings: cloneJsonRecord(provenance.settings),
    parentIds: [...provenance.parentIds],
    operations: provenance.operations.map((operation) => ({
      ...operation,
      parameters: cloneJsonRecord(operation.parameters),
    })),
  }
}

export function cloneCandidate(candidate: Candidate): Candidate {
  return {
    ...candidate,
    melody: cloneMelody(candidate.melody),
    provenance: cloneProvenance(candidate.provenance),
  }
}

export function cloneGenerationSnapshot(snapshot: GenerationSnapshot): GenerationSnapshot {
  return {
    ...snapshot,
    candidates: snapshot.candidates.map(cloneCandidate),
    selectedParentIds: [...snapshot.selectedParentIds],
    evolutionSettings:
      snapshot.evolutionSettings === null ? null : { ...snapshot.evolutionSettings },
  }
}
