import {
  SCALE_CATALOGUE,
  SCALE_FAMILIES,
  SCALE_GROUPS,
  assertValidScaleCatalogue,
  findScaleById,
  findScalesByName,
  getLegacyScaleGroup,
  getScale,
  getScaleGroup,
  getScalesByFamily,
  getScalesInGroup,
  isValidScaleDefinition,
  resolveLegacyScale,
  transposeScale,
  validateScaleCatalogue,
  validateScaleDefinition,
} from './scales'
import type { LegacyScaleContext, ScaleId } from './scales'

const EXPECTED_SCALES = [
  ['diatonic-ionian', [0, 2, 4, 5, 7, 9, 11]],
  ['diatonic-dorian', [0, 2, 3, 5, 7, 9, 10]],
  ['diatonic-phrygian', [0, 1, 3, 5, 7, 8, 10]],
  ['diatonic-lydian', [0, 2, 4, 6, 7, 9, 11]],
  ['diatonic-mixolydian', [0, 2, 4, 5, 7, 9, 10]],
  ['diatonic-aeolian', [0, 2, 3, 5, 7, 8, 10]],
  ['diatonic-locrian', [0, 1, 3, 5, 6, 8, 10]],
  ['harmonic-minor-01', [0, 2, 3, 5, 7, 8, 11]],
  ['harmonic-minor-02', [0, 1, 3, 5, 6, 9, 10]],
  ['harmonic-minor-03', [0, 2, 4, 5, 8, 9, 11]],
  ['harmonic-minor-04', [0, 2, 3, 6, 7, 9, 10]],
  ['harmonic-minor-05', [0, 1, 4, 5, 7, 8, 10]],
  ['harmonic-minor-06', [0, 3, 4, 6, 7, 9, 11]],
  ['harmonic-minor-07', [0, 1, 3, 4, 6, 8, 9]],
  ['melodic-minor-01', [0, 2, 3, 5, 7, 9, 11]],
  ['melodic-minor-02', [0, 1, 3, 5, 7, 9, 10]],
  ['melodic-minor-03', [0, 2, 4, 6, 8, 9, 11]],
  ['melodic-minor-04', [0, 2, 4, 6, 7, 9, 10]],
  ['melodic-minor-05', [0, 2, 4, 5, 7, 8, 10]],
  ['melodic-minor-06', [0, 2, 3, 5, 6, 8, 10]],
  ['melodic-minor-07', [0, 1, 3, 4, 6, 8, 10]],
  ['pentatonic-major', [0, 2, 4, 7, 9]],
  ['pentatonic-minor', [0, 3, 5, 7, 10]],
  ['blues-major', [0, 2, 3, 4, 7, 9]],
  ['blues-minor', [0, 3, 5, 6, 7, 10]],
  ['whole-tone', [0, 2, 4, 6, 8, 10]],
  ['octatonic-whole-half', [0, 2, 3, 5, 6, 8, 9, 11]],
  ['octatonic-half-whole', [0, 1, 3, 4, 6, 7, 9, 10]],
] as const satisfies readonly (readonly [ScaleId, readonly number[]])[]

const MAJOR_CONTEXT = { path: 'major' } as const satisfies LegacyScaleContext
const NATURAL_CONTEXT = {
  path: 'minor',
  minor: 'natural',
} as const satisfies LegacyScaleContext
const HARMONIC_CONTEXT = {
  path: 'minor',
  minor: 'harmonic',
} as const satisfies LegacyScaleContext
const MELODIC_CONTEXT = {
  path: 'minor',
  minor: 'melodic',
} as const satisfies LegacyScaleContext

const LEGACY_ROUTES = [
  [MAJOR_CONTEXT, 'ionian', 'diatonic-ionian'],
  [MAJOR_CONTEXT, 'dorian', 'diatonic-dorian'],
  [MAJOR_CONTEXT, 'phrygian', 'diatonic-phrygian'],
  [MAJOR_CONTEXT, 'lydian', 'diatonic-lydian'],
  [MAJOR_CONTEXT, 'mixolydian', 'diatonic-mixolydian'],
  [MAJOR_CONTEXT, 'aeolian', 'diatonic-aeolian'],
  [MAJOR_CONTEXT, 'locrian', 'diatonic-locrian'],
  [NATURAL_CONTEXT, 'aeolian', 'diatonic-aeolian'],
  [NATURAL_CONTEXT, 'locrian', 'diatonic-locrian'],
  [NATURAL_CONTEXT, 'ionian', 'diatonic-ionian'],
  [NATURAL_CONTEXT, 'dorian', 'diatonic-dorian'],
  [NATURAL_CONTEXT, 'phrygian', 'diatonic-phrygian'],
  [NATURAL_CONTEXT, 'lydian', 'diatonic-lydian'],
  [NATURAL_CONTEXT, 'mixolydian', 'diatonic-mixolydian'],
  [HARMONIC_CONTEXT, 'harmonic minor', 'harmonic-minor-01'],
  [HARMONIC_CONTEXT, 'locrian#6', 'harmonic-minor-02'],
  [HARMONIC_CONTEXT, 'ionian#5', 'harmonic-minor-03'],
  [HARMONIC_CONTEXT, 'dorian#4', 'harmonic-minor-04'],
  [HARMONIC_CONTEXT, 'phrygian dominant', 'harmonic-minor-05'],
  [HARMONIC_CONTEXT, 'lydian#2', 'harmonic-minor-06'],
  [HARMONIC_CONTEXT, 'super locrian', 'harmonic-minor-07'],
  [MELODIC_CONTEXT, 'melodic minor', 'melodic-minor-01'],
  [MELODIC_CONTEXT, 'dorian b2', 'melodic-minor-02'],
  [MELODIC_CONTEXT, 'lydian augmented', 'melodic-minor-03'],
  [MELODIC_CONTEXT, 'lydian dominant', 'melodic-minor-04'],
  [MELODIC_CONTEXT, 'mixolydian b6', 'melodic-minor-05'],
  [MELODIC_CONTEXT, 'aeolian b5', 'melodic-minor-06'],
  [MELODIC_CONTEXT, 'altered scale', 'melodic-minor-07'],
] as const satisfies readonly (
  readonly [LegacyScaleContext, string, ScaleId]
)[]

describe('canonical scale catalogue', () => {
  it('contains exactly the 28 verified IDs and pitch-class offsets', () => {
    expect(SCALE_CATALOGUE.map(({ id, offsets }) => [id, offsets])).toEqual(
      EXPECTED_SCALES,
    )
  })

  it('uses exactly six families with the expected catalogue cardinalities', () => {
    expect(SCALE_FAMILIES).toEqual([
      'diatonic',
      'harmonic-minor',
      'melodic-minor',
      'pentatonic',
      'blues',
      'symmetric',
    ])

    expect(
      Object.fromEntries(
        SCALE_FAMILIES.map((family) => [family, getScalesByFamily(family).length]),
      ),
    ).toEqual({
      diatonic: 7,
      'harmonic-minor': 7,
      'melodic-minor': 7,
      pentatonic: 2,
      blues: 2,
      symmetric: 3,
    })

    const cardinalityCounts = new Map<number, number>()
    for (const scale of SCALE_CATALOGUE) {
      cardinalityCounts.set(
        scale.offsets.length,
        (cardinalityCounts.get(scale.offsets.length) ?? 0) + 1,
      )
    }
    expect(Object.fromEntries(cardinalityCounts)).toEqual({ 5: 2, 6: 3, 7: 21, 8: 2 })
  })

  it('has valid shapes, unique IDs, unique definitions, and strictly increasing offsets', () => {
    expect(SCALE_CATALOGUE).toHaveLength(28)
    expect(validateScaleCatalogue()).toEqual([])
    expect(() => assertValidScaleCatalogue()).not.toThrow()
    expect(SCALE_CATALOGUE.every(isValidScaleDefinition)).toBe(true)

    const ids = SCALE_CATALOGUE.map(({ id }) => id)
    const offsetSignatures = SCALE_CATALOGUE.map(({ offsets }) => offsets.join(','))
    expect(new Set(ids).size).toBe(SCALE_CATALOGUE.length)
    expect(new Set(offsetSignatures).size).toBe(SCALE_CATALOGUE.length)

    for (const scale of SCALE_CATALOGUE) {
      expect(scale.displayName.trim()).not.toBe('')
      expect(scale.offsets[0]).toBe(0)
      expect(scale.offsets.every((offset) => Number.isInteger(offset))).toBe(true)
      expect(scale.offsets.every((offset) => offset >= 0 && offset < 12)).toBe(true)
      expect(scale.offsets.every((offset, index) => index === 0 || offset > scale.offsets[index - 1]!)).toBe(true)
    }
  })

  it('provides safe ID and name lookups while retaining ambiguous theory aliases', () => {
    expect(getScale('diatonic-ionian').displayName).toBe('Ionian')
    expect(findScaleById('pentatonic-minor')?.offsets).toEqual([0, 3, 5, 7, 10])
    expect(findScaleById('not-a-scale')).toBeUndefined()
    expect(findScalesByName('major scale').map(({ id }) => id)).toEqual([
      'diatonic-ionian',
    ])
    expect(findScalesByName('super locrian').map(({ id }) => id)).toEqual([
      'harmonic-minor-07',
      'melodic-minor-07',
    ])
  })

  it('reports malformed definitions and duplicate catalogue entries', () => {
    expect(
      validateScaleDefinition({
        id: 'diatonic-ionian',
        displayName: 'Broken',
        aliases: [],
        family: 'diatonic',
        offsets: [0, 4, 2],
      }),
    ).toContain('Scale offsets must be unique and strictly increasing')

    expect(validateScaleCatalogue([getScale('diatonic-ionian'), getScale('diatonic-ionian')])).toEqual(
      expect.arrayContaining([
        'Duplicate scale ID: diatonic-ionian',
        'Duplicate scale offsets: diatonic-ionian and diatonic-ionian',
      ]),
    )
  })
})

describe('scale transposition', () => {
  it('transposes every catalogue entry over every tonic pitch class', () => {
    for (const scale of SCALE_CATALOGUE) {
      for (let tonic = 0; tonic < 12; tonic += 1) {
        const pitchClasses = transposeScale(scale.id, tonic)
        expect(pitchClasses).toHaveLength(scale.offsets.length)
        expect(new Set(pitchClasses).size).toBe(scale.offsets.length)

        pitchClasses.forEach((pitchClass, degree) => {
          expect(Number.isInteger(pitchClass)).toBe(true)
          expect(pitchClass).toBeGreaterThanOrEqual(0)
          expect(pitchClass).toBeLessThan(12)
          expect((pitchClass - tonic + 12) % 12).toBe(scale.offsets[degree])
        })
      }
    }
  })

  it('rejects tonic values outside the twelve pitch classes', () => {
    expect(() => transposeScale('diatonic-ionian', -1)).toThrow(RangeError)
    expect(() => transposeScale('diatonic-ionian', 12)).toThrow(RangeError)
    expect(() => transposeScale('diatonic-ionian', 1.5)).toThrow(RangeError)
  })

  it('preserves the legacy fixed C4-B4 wrap for C-sharp Ionian', () => {
    const pitchClasses = transposeScale('diatonic-ionian', 1)
    const legacyMidi = pitchClasses.map((pitchClass) => 60 + pitchClass)

    expect(pitchClasses).toEqual([1, 3, 5, 6, 8, 10, 0])
    expect(legacyMidi).toEqual([61, 63, 65, 66, 68, 70, 60])
  })
})

describe('legacy scale contexts', () => {
  it.each(LEGACY_ROUTES)('resolves %s / %s to %s', (context, legacyName, id) => {
    expect(resolveLegacyScale(context, legacyName)?.id).toBe(id)
  })

  it('retains the natural-minor Aeolian-first reorder without duplicate definitions', () => {
    const expected = [
      'diatonic-aeolian',
      'diatonic-locrian',
      'diatonic-ionian',
      'diatonic-dorian',
      'diatonic-phrygian',
      'diatonic-lydian',
      'diatonic-mixolydian',
    ]

    expect(SCALE_GROUPS['legacy-minor-natural'].scaleIds).toEqual(expected)
    expect(getLegacyScaleGroup(NATURAL_CONTEXT)).toBe(
      getScaleGroup('legacy-minor-natural'),
    )
    expect(getScalesInGroup('legacy-minor-natural').map(({ id }) => id)).toEqual(expected)
    for (const scale of getScalesInGroup('legacy-minor-natural')) {
      expect(scale).toBe(getScale(scale.id))
    }
  })

  it('keeps the harmonic Super Locrian route scoped away from melodic Altered', () => {
    expect(resolveLegacyScale(HARMONIC_CONTEXT, '  SUPER   LOCRIAN ')?.id).toBe(
      'harmonic-minor-07',
    )
    expect(resolveLegacyScale(MELODIC_CONTEXT, 'altered scale')?.id).toBe(
      'melodic-minor-07',
    )
    expect(resolveLegacyScale(MELODIC_CONTEXT, 'super locrian')).toBeUndefined()
    expect(resolveLegacyScale(HARMONIC_CONTEXT, 'altered scale')).toBeUndefined()
    expect(getScale('harmonic-minor-07').offsets).toEqual([0, 1, 3, 4, 6, 8, 9])
    expect(getScale('melodic-minor-07').offsets).toEqual([0, 1, 3, 4, 6, 8, 10])
  })

  it('does not accept a mode from a different legacy menu', () => {
    expect(resolveLegacyScale(MAJOR_CONTEXT, 'harmonic minor')).toBeUndefined()
    expect(resolveLegacyScale(NATURAL_CONTEXT, 'harmonic minor')).toBeUndefined()
    expect(resolveLegacyScale(HARMONIC_CONTEXT, 'ionian')).toBeUndefined()
  })
})
