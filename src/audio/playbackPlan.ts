import { assertValidMelody } from '../domain/invariants'
import { MIDI_MAX, MIDI_MIN, melodyDegreeToMidi } from '../domain/pitch'
import { getScale } from '../domain/scales'
import type { Melody } from '../domain/types'

export interface PlaybackPlanEvent {
  readonly startSeconds: number
  readonly durationSeconds: number
  /** Null preserves an explicit rest in the plan. */
  readonly midi: number | null
}

export interface PlaybackPlan {
  readonly events: readonly PlaybackPlanEvent[]
  readonly tempoBpm: number
  readonly ticksPerBeat: number
  readonly totalTicks: number
  readonly totalDurationSeconds: number
  /** Looping always spans the complete phrase, including trailing rests. */
  readonly loopDurationSeconds: number
}

export interface PlaybackPlanOptions {
  /** Overrides playback tempo without mutating or regenerating the melody. */
  readonly tempoBpm?: number
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`)
  }
}

export function ticksToSeconds(
  ticks: number,
  tempoBpm: number,
  ticksPerBeat: number,
): number {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError('ticks must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(ticksPerBeat) || ticksPerBeat <= 0) {
    throw new RangeError('ticksPerBeat must be a positive safe integer')
  }
  assertPositiveFinite(tempoBpm, 'tempoBpm')
  return (ticks * 60) / (tempoBpm * ticksPerBeat)
}

/**
 * Pure conversion from the degree/tick domain model to scheduler-ready seconds
 * and integer MIDI. Domain validation happens before any plan is returned.
 */
export function createPlaybackPlan(
  melody: Melody,
  options: PlaybackPlanOptions = {},
): PlaybackPlan {
  const scale = getScale(melody.constraints.scaleId)
  assertValidMelody(melody, scale)

  const tempoBpm = options.tempoBpm ?? melody.constraints.tempoBpm
  assertPositiveFinite(tempoBpm, 'tempoBpm')
  const { ticksPerBeat, totalTicks } = melody.constraints

  const events = melody.events.map((event): PlaybackPlanEvent => {
    const midi =
      event.degree === null
        ? null
        : melodyDegreeToMidi(event.degree, melody.constraints, scale)

    if (midi !== null && (!Number.isSafeInteger(midi) || midi < MIDI_MIN || midi > MIDI_MAX)) {
      throw new RangeError(`Mapped MIDI note ${String(midi)} is outside ${MIDI_MIN}–${MIDI_MAX}`)
    }

    return {
      startSeconds: ticksToSeconds(event.startTick, tempoBpm, ticksPerBeat),
      durationSeconds: ticksToSeconds(event.durationTicks, tempoBpm, ticksPerBeat),
      midi,
    }
  })

  const totalDurationSeconds = ticksToSeconds(totalTicks, tempoBpm, ticksPerBeat)

  return {
    events,
    tempoBpm,
    ticksPerBeat,
    totalTicks,
    totalDurationSeconds,
    loopDurationSeconds: totalDurationSeconds,
  }
}
