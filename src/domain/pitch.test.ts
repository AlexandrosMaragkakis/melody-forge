import { describe, expect, it } from 'vitest'

import {
  formatMidiNote,
  legacyScaleDegreeToMidi,
  midiToPitchClass,
  midiToScaleDegree,
  normalizePitchClass,
  pitchClassName,
  positiveModulo,
  scaleDegreeToMidi,
  scaleDegreeToPitchClass,
} from './pitch'

const IONIAN = { offsets: [0, 2, 4, 5, 7, 9, 11] } as const
const MINOR_PENTATONIC = { offsets: [0, 3, 5, 7, 10] } as const

describe('pitch arithmetic', () => {
  it('normalizes negative values with mathematical modulo', () => {
    expect(positiveModulo(-1, 7)).toBe(6)
    expect(positiveModulo(-15, 7)).toBe(6)
    expect(normalizePitchClass(-1)).toBe(11)
    expect(normalizePitchClass(25)).toBe(1)
  })

  it('maps positive and negative extended scale degrees around a tonic anchor', () => {
    expect(scaleDegreeToMidi(-8, 60, IONIAN)).toBe(47)
    expect(scaleDegreeToMidi(-7, 60, IONIAN)).toBe(48)
    expect(scaleDegreeToMidi(-1, 60, IONIAN)).toBe(59)
    expect(scaleDegreeToMidi(0, 60, IONIAN)).toBe(60)
    expect(scaleDegreeToMidi(6, 60, IONIAN)).toBe(71)
    expect(scaleDegreeToMidi(7, 60, IONIAN)).toBe(72)
  })

  it('round-trips every in-scale MIDI note across negative and positive octaves', () => {
    for (let degree = -30; degree <= 30; degree += 1) {
      const midi = scaleDegreeToMidi(degree, 60, MINOR_PENTATONIC)
      expect(midiToScaleDegree(midi, 60, MINOR_PENTATONIC)).toBe(degree)
    }
    expect(midiToScaleDegree(61, 60, IONIAN)).toBeNull()
  })

  it('wraps legacy output into C4–B4 even for negative and non-C degrees', () => {
    expect(legacyScaleDegreeToMidi(-1, 0, IONIAN)).toBe(71)
    expect(legacyScaleDegreeToMidi(-7, 0, IONIAN)).toBe(60)
    expect(legacyScaleDegreeToMidi(1, 11, IONIAN)).toBe(61)
    expect(scaleDegreeToPitchClass(-1, 11, IONIAN)).toBe(10)
  })

  it('formats pitch classes and MIDI notes without changing pitch', () => {
    expect(midiToPitchClass(60)).toBe(0)
    expect(pitchClassName(1)).toBe('C#')
    expect(pitchClassName(13, 'flat')).toBe('Db')
    expect(formatMidiNote(0)).toBe('C-1')
    expect(formatMidiNote(60)).toBe('C4')
    expect(formatMidiNote(70, 'flat')).toBe('Bb4')
  })

  it('rejects malformed degree and scale inputs', () => {
    expect(() => scaleDegreeToMidi(0.5, 60, IONIAN)).toThrow(/safe integer/)
    expect(() => scaleDegreeToMidi(0, 60, { offsets: [] })).toThrow(/at least one/)
    expect(() => scaleDegreeToMidi(0, 60, { offsets: [0, 2, 2] })).toThrow(
      /strictly ascending/,
    )
    expect(() => positiveModulo(1, 0)).toThrow(/positive/)
  })
})
