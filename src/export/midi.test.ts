import type { Melody } from '../domain/types'
import {
  encodeMelodyMidi,
  encodeVariableLengthQuantity,
} from './midi'

interface DecodedEvent {
  readonly tick: number
  readonly status: number
  readonly data: readonly number[]
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! * 0x1_00_00_00 +
    bytes[offset + 1]! * 0x1_00_00 +
    bytes[offset + 2]! * 0x1_00 +
    bytes[offset + 3]!
  )
}

function readVlq(bytes: Uint8Array, start: number): { value: number; next: number } {
  let value = 0
  let index = start
  while (index < bytes.length) {
    const byte = bytes[index]!
    value = value * 128 + (byte & 0x7f)
    index += 1
    if ((byte & 0x80) === 0) {
      return { value, next: index }
    }
  }
  throw new Error('Unterminated variable-length quantity')
}

function decodeTrack(bytes: Uint8Array): { division: number; events: DecodedEvent[] } {
  expect(ascii(bytes, 0, 4)).toBe('MThd')
  expect(u32(bytes, 4)).toBe(6)
  expect(u16(bytes, 8)).toBe(0)
  expect(u16(bytes, 10)).toBe(1)
  expect(ascii(bytes, 14, 4)).toBe('MTrk')
  const division = u16(bytes, 12)
  const trackLength = u32(bytes, 18)
  const end = 22 + trackLength
  const events: DecodedEvent[] = []
  let index = 22
  let tick = 0

  while (index < end) {
    const delta = readVlq(bytes, index)
    tick += delta.value
    index = delta.next
    const status = bytes[index]!
    index += 1

    if (status === 0xff) {
      const metaType = bytes[index]!
      index += 1
      const length = readVlq(bytes, index)
      index = length.next
      const data = [...bytes.slice(index, index + length.value)]
      index += length.value
      events.push({ tick, status: 0xff00 | metaType, data })
    } else {
      const dataLength = (status & 0xf0) === 0xc0 ? 1 : 2
      const data = [...bytes.slice(index, index + dataLength)]
      index += dataLength
      events.push({ tick, status, data })
    }
  }
  expect(index).toBe(end)
  return { division, events }
}

function melodyWithRests(): Melody {
  return {
    constraints: {
      scaleId: 'diatonic-ionian',
      tonicPitchClass: 0,
      tonicMidi: 60,
      register: { minMidi: 60, maxMidi: 72 },
      pitchMapping: 'tonic-relative',
      ticksPerBeat: 480,
      gridTicks: 240,
      totalTicks: 1_200,
      tempoBpm: 120,
      tonicBoundary: { start: true, end: false },
    },
    events: [
      { startTick: 0, durationTicks: 240, degree: 0 },
      { startTick: 240, durationTicks: 240, degree: null },
      { startTick: 480, durationTicks: 480, degree: 1 },
      { startTick: 960, durationTicks: 240, degree: null },
    ],
  }
}

describe('MIDI export', () => {
  it('encodes canonical variable-length quantities', () => {
    expect(encodeVariableLengthQuantity(0)).toEqual([0])
    expect(encodeVariableLengthQuantity(127)).toEqual([0x7f])
    expect(encodeVariableLengthQuantity(128)).toEqual([0x81, 0x00])
    expect(encodeVariableLengthQuantity(480)).toEqual([0x83, 0x60])
    expect(() => encodeVariableLengthQuantity(-1)).toThrow(RangeError)
  })

  it('preserves tempo, pitches, rests, trailing silence, and exact absolute ticks', () => {
    const decoded = decodeTrack(encodeMelodyMidi(melodyWithRests()))
    expect(decoded.division).toBe(480)
    expect(decoded.events).toEqual([
      { tick: 0, status: 0xff51, data: [0x07, 0xa1, 0x20] },
      { tick: 0, status: 0xc0, data: [0] },
      { tick: 0, status: 0x90, data: [60, 88] },
      { tick: 240, status: 0x80, data: [60, 0] },
      { tick: 480, status: 0x90, data: [62, 88] },
      { tick: 960, status: 0x80, data: [62, 0] },
      { tick: 1_200, status: 0xff2f, data: [] },
    ])
  })

  it('orders a note-off before a note-on at the same tick', () => {
    const melody = melodyWithRests()
    const adjacent: Melody = {
      ...melody,
      constraints: { ...melody.constraints, totalTicks: 480 },
      events: [
        { startTick: 0, durationTicks: 240, degree: 0 },
        { startTick: 240, durationTicks: 240, degree: 1 },
      ],
    }
    const eventsAtBoundary = decodeTrack(encodeMelodyMidi(adjacent)).events.filter(
      ({ tick }) => tick === 240,
    )
    expect(eventsAtBoundary.map(({ status }) => status)).toEqual([0x80, 0x90])
  })
})
