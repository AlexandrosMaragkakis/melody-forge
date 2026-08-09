import { assertValidMelody } from '../domain/invariants'
import { melodyDegreeToMidi, MIDI_MAX, MIDI_MIN } from '../domain/pitch'
import { getScale } from '../domain/scales'
import type { Candidate, Melody } from '../domain/types'

const MIDI_MAX_DELTA = 0x0fff_ffff

interface TimedMidiMessage {
  readonly tick: number
  readonly priority: number
  readonly bytes: readonly number[]
}

function assertByte(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`MIDI byte outside 0–255: ${String(value)}`)
  }
}

export function encodeVariableLengthQuantity(value: number): number[] {
  if (!Number.isSafeInteger(value) || value < 0 || value > MIDI_MAX_DELTA) {
    throw new RangeError(
      `MIDI delta must be an integer from 0 through ${String(MIDI_MAX_DELTA)}`,
    )
  }

  let remaining = value
  const bytes = [remaining & 0x7f]
  while ((remaining >>= 7) > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80)
  }
  return bytes
}

function u16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff]
}

function u32(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]
}

function ascii(value: string): number[] {
  return Array.from(value, (character) => character.charCodeAt(0))
}

function tempoMessage(tempoBpm: number): readonly number[] {
  const microsecondsPerBeat = Math.round(60_000_000 / tempoBpm)
  if (microsecondsPerBeat < 1 || microsecondsPerBeat > 0xff_ffff) {
    throw new RangeError('Tempo cannot be represented in a MIDI tempo event')
  }
  return [
    0xff,
    0x51,
    0x03,
    (microsecondsPerBeat >>> 16) & 0xff,
    (microsecondsPerBeat >>> 8) & 0xff,
    microsecondsPerBeat & 0xff,
  ]
}

export function encodeMelodyMidi(melody: Melody): Uint8Array {
  const scale = getScale(melody.constraints.scaleId)
  assertValidMelody(melody, scale)
  const division = melody.constraints.ticksPerBeat
  if (division < 1 || division > 0x7fff) {
    throw new RangeError('MIDI ticks per beat must be between 1 and 32767')
  }

  const messages: TimedMidiMessage[] = [
    { tick: 0, priority: 0, bytes: tempoMessage(melody.constraints.tempoBpm) },
    // Acoustic Grand Piano on MIDI channel one.
    { tick: 0, priority: 1, bytes: [0xc0, 0x00] },
  ]

  for (const event of melody.events) {
    if (event.degree === null) {
      continue
    }
    const midi = melodyDegreeToMidi(event.degree, melody.constraints, scale)
    if (!Number.isSafeInteger(midi) || midi < MIDI_MIN || midi > MIDI_MAX) {
      throw new RangeError(`Sounding MIDI note is invalid: ${String(midi)}`)
    }
    messages.push(
      {
        tick: event.startTick,
        priority: 3,
        bytes: [0x90, midi, 88],
      },
      {
        tick: event.startTick + event.durationTicks,
        priority: 2,
        bytes: [0x80, midi, 0],
      },
    )
  }

  messages.sort(
    (first, second) =>
      first.tick - second.tick || first.priority - second.priority,
  )

  const track: number[] = []
  let previousTick = 0
  for (const message of messages) {
    if (message.tick > melody.constraints.totalTicks) {
      throw new RangeError('A MIDI event exceeds the configured phrase total')
    }
    track.push(...encodeVariableLengthQuantity(message.tick - previousTick))
    for (const byte of message.bytes) {
      assertByte(byte)
      track.push(byte)
    }
    previousTick = message.tick
  }

  track.push(
    ...encodeVariableLengthQuantity(
      melody.constraints.totalTicks - previousTick,
    ),
    0xff,
    0x2f,
    0x00,
  )

  const header = [
    ...ascii('MThd'),
    ...u32(6),
    ...u16(0),
    ...u16(1),
    ...u16(division),
  ]
  const trackChunk = [...ascii('MTrk'), ...u32(track.length), ...track]
  return Uint8Array.from([...header, ...trackChunk])
}

export function encodeCandidateMidi(candidate: Candidate): Uint8Array {
  return encodeMelodyMidi(candidate.melody)
}
