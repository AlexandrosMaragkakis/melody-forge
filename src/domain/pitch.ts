import type { ScaleDefinition } from './scales'
import type {
  MelodyConstraints,
  MidiNote,
  PitchClass,
  ScaleDegree,
} from './types'

export const MIDI_MIN = 0
export const MIDI_MAX = 127
export const LEGACY_OCTAVE_MIN_MIDI = 60
export const LEGACY_OCTAVE_MAX_MIDI = 71

export type AccidentalPreference = 'sharp' | 'flat'
export type ScalePitchCollection = Pick<ScaleDefinition, 'offsets'>

export const SHARP_PITCH_CLASS_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

export const FLAT_PITCH_CLASS_NAMES = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer; received ${String(value)}`)
  }
}

function assertUsableOffsets(scale: ScalePitchCollection): void {
  const { offsets } = scale

  if (offsets.length === 0) {
    throw new RangeError('A scale must contain at least one pitch-class offset')
  }

  let previous = -1
  for (const offset of offsets) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 11) {
      throw new RangeError(`Scale offsets must be unique integers from 0 to 11; received ${String(offset)}`)
    }
    if (offset <= previous) {
      throw new RangeError('Scale offsets must be unique and strictly ascending')
    }
    previous = offset
  }

  if (offsets[0] !== 0) {
    throw new RangeError('A scale must begin with tonic offset 0')
  }
}

/** Mathematical modulo whose result is always in the range 0..modulus-1. */
export function positiveModulo(value: number, modulus: number): number {
  assertSafeInteger(value, 'value')
  assertSafeInteger(modulus, 'modulus')
  if (modulus <= 0) {
    throw new RangeError(`modulus must be positive; received ${String(modulus)}`)
  }
  return ((value % modulus) + modulus) % modulus
}

export function normalizePitchClass(value: number): PitchClass {
  return positiveModulo(value, 12)
}

function splitScaleDegree(
  degree: ScaleDegree,
  scale: ScalePitchCollection,
): { readonly octave: number; readonly index: number } {
  assertSafeInteger(degree, 'degree')
  assertUsableOffsets(scale)
  const size = scale.offsets.length

  return {
    octave: Math.floor(degree / size),
    index: positiveModulo(degree, size),
  }
}

/** Converts an extended scale degree to its chromatic pitch class. */
export function scaleDegreeToPitchClass(
  degree: ScaleDegree,
  tonicPitchClass: PitchClass,
  scale: ScalePitchCollection,
): PitchClass {
  const { index } = splitScaleDegree(degree, scale)
  assertSafeInteger(tonicPitchClass, 'tonicPitchClass')
  const offset = scale.offsets[index]

  // splitScaleDegree guarantees that the indexed offset exists.
  return normalizePitchClass(tonicPitchClass + (offset ?? 0))
}

/**
 * Converts an extended scale degree to MIDI relative to degree-zero's anchor.
 * Floor division is intentional: degree -1 is the final scale tone below the
 * tonic rather than the final scale tone above it.
 */
export function scaleDegreeToMidi(
  degree: ScaleDegree,
  tonicMidi: MidiNote,
  scale: ScalePitchCollection,
): MidiNote {
  const { octave, index } = splitScaleDegree(degree, scale)
  assertSafeInteger(tonicMidi, 'tonicMidi')
  const offset = scale.offsets[index]
  const midi = tonicMidi + octave * 12 + (offset ?? 0)
  assertSafeInteger(midi, 'resulting MIDI note')
  return midi
}

/** Returns null when the MIDI pitch does not belong to the scale. */
export function midiToScaleDegree(
  midi: MidiNote,
  tonicMidi: MidiNote,
  scale: ScalePitchCollection,
): ScaleDegree | null {
  assertSafeInteger(midi, 'midi')
  assertSafeInteger(tonicMidi, 'tonicMidi')
  assertUsableOffsets(scale)

  const delta = midi - tonicMidi
  const octave = Math.floor(delta / 12)
  const pitchClassOffset = positiveModulo(delta, 12)
  const index = scale.offsets.indexOf(pitchClassOffset)

  return index === -1 ? null : octave * scale.offsets.length + index
}

/**
 * Recreates the historical C4–B4 mapping. Extended octave information is
 * deliberately discarded after resolving the degree's scale pitch class.
 */
export function legacyScaleDegreeToMidi(
  degree: ScaleDegree,
  tonicPitchClass: PitchClass,
  scale: ScalePitchCollection,
): MidiNote {
  return LEGACY_OCTAVE_MIN_MIDI + scaleDegreeToPitchClass(degree, tonicPitchClass, scale)
}

export function melodyDegreeToMidi(
  degree: ScaleDegree,
  constraints: MelodyConstraints,
  scale: ScalePitchCollection,
): MidiNote {
  return constraints.pitchMapping === 'legacy-fixed-octave'
    ? legacyScaleDegreeToMidi(degree, constraints.tonicPitchClass, scale)
    : scaleDegreeToMidi(degree, constraints.tonicMidi, scale)
}

export function isTonicScaleDegree(degree: ScaleDegree, scaleSize: number): boolean {
  assertSafeInteger(degree, 'degree')
  return positiveModulo(degree, scaleSize) === 0
}

export function midiToPitchClass(midi: MidiNote): PitchClass {
  assertSafeInteger(midi, 'midi')
  if (midi < MIDI_MIN || midi > MIDI_MAX) {
    throw new RangeError(`midi must be between ${MIDI_MIN} and ${MIDI_MAX}; received ${String(midi)}`)
  }
  return normalizePitchClass(midi)
}

export function pitchClassName(
  pitchClass: PitchClass,
  preference: AccidentalPreference = 'sharp',
): string {
  const normalized = normalizePitchClass(pitchClass)
  const names = preference === 'flat' ? FLAT_PITCH_CLASS_NAMES : SHARP_PITCH_CLASS_NAMES
  return names[normalized] ?? names[0]
}

/** Formats MIDI 60 as C4, following the standard convention that MIDI 0 is C-1. */
export function formatMidiNote(
  midi: MidiNote,
  preference: AccidentalPreference = 'sharp',
): string {
  const pitchClass = midiToPitchClass(midi)
  const octave = Math.floor(midi / 12) - 1
  return `${pitchClassName(pitchClass, preference)}${octave}`
}

export const midiNoteName = formatMidiNote
