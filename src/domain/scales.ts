export const SCALE_FAMILIES = [
  'diatonic',
  'harmonic-minor',
  'melodic-minor',
  'pentatonic',
  'blues',
  'symmetric',
] as const

export type ScaleFamily = (typeof SCALE_FAMILIES)[number]

interface ScaleDefinitionData {
  readonly id: string
  readonly displayName: string
  readonly aliases: readonly string[]
  readonly family: ScaleFamily
  /** Strictly ascending pitch-class offsets. Tonic 0 is included; octave 12 is not. */
  readonly offsets: readonly number[]
}

const SCALE_CATALOGUE_DATA = [
  {
    id: 'diatonic-ionian',
    displayName: 'Ionian',
    aliases: ['Major', 'Major Scale'],
    family: 'diatonic',
    offsets: [0, 2, 4, 5, 7, 9, 11],
  },
  {
    id: 'diatonic-dorian',
    displayName: 'Dorian',
    aliases: [],
    family: 'diatonic',
    offsets: [0, 2, 3, 5, 7, 9, 10],
  },
  {
    id: 'diatonic-phrygian',
    displayName: 'Phrygian',
    aliases: [],
    family: 'diatonic',
    offsets: [0, 1, 3, 5, 7, 8, 10],
  },
  {
    id: 'diatonic-lydian',
    displayName: 'Lydian',
    aliases: [],
    family: 'diatonic',
    offsets: [0, 2, 4, 6, 7, 9, 11],
  },
  {
    id: 'diatonic-mixolydian',
    displayName: 'Mixolydian',
    aliases: [],
    family: 'diatonic',
    offsets: [0, 2, 4, 5, 7, 9, 10],
  },
  {
    id: 'diatonic-aeolian',
    displayName: 'Aeolian',
    aliases: ['Natural Minor', 'Natural Minor Scale'],
    family: 'diatonic',
    offsets: [0, 2, 3, 5, 7, 8, 10],
  },
  {
    id: 'diatonic-locrian',
    displayName: 'Locrian',
    aliases: [],
    family: 'diatonic',
    offsets: [0, 1, 3, 5, 6, 8, 10],
  },
  {
    id: 'harmonic-minor-01',
    displayName: 'Harmonic Minor',
    aliases: ['Aeolian ♮7'],
    family: 'harmonic-minor',
    offsets: [0, 2, 3, 5, 7, 8, 11],
  },
  {
    id: 'harmonic-minor-02',
    displayName: 'Locrian ♮6',
    aliases: ['Locrian #6', 'Locrian#6', 'Locrian Natural 6'],
    family: 'harmonic-minor',
    offsets: [0, 1, 3, 5, 6, 9, 10],
  },
  {
    id: 'harmonic-minor-03',
    displayName: 'Ionian ♯5',
    aliases: ['Ionian #5', 'Ionian#5', 'Ionian Augmented'],
    family: 'harmonic-minor',
    offsets: [0, 2, 4, 5, 8, 9, 11],
  },
  {
    id: 'harmonic-minor-04',
    displayName: 'Dorian ♯4',
    aliases: ['Dorian #4', 'Dorian#4'],
    family: 'harmonic-minor',
    offsets: [0, 2, 3, 6, 7, 9, 10],
  },
  {
    id: 'harmonic-minor-05',
    displayName: 'Phrygian Dominant',
    aliases: [],
    family: 'harmonic-minor',
    offsets: [0, 1, 4, 5, 7, 8, 10],
  },
  {
    id: 'harmonic-minor-06',
    displayName: 'Lydian ♯2',
    aliases: ['Lydian #2', 'Lydian#2'],
    family: 'harmonic-minor',
    offsets: [0, 3, 4, 6, 7, 9, 11],
  },
  {
    id: 'harmonic-minor-07',
    displayName: 'Ultra Locrian',
    aliases: ['Super Locrian', 'Super Locrian ♭♭7'],
    family: 'harmonic-minor',
    offsets: [0, 1, 3, 4, 6, 8, 9],
  },
  {
    id: 'melodic-minor-01',
    displayName: 'Melodic Minor',
    aliases: ['Ascending Melodic Minor', 'Jazz Minor'],
    family: 'melodic-minor',
    offsets: [0, 2, 3, 5, 7, 9, 11],
  },
  {
    id: 'melodic-minor-02',
    displayName: 'Dorian ♭2',
    aliases: ['Dorian b2', 'Phrygian ♮6'],
    family: 'melodic-minor',
    offsets: [0, 1, 3, 5, 7, 9, 10],
  },
  {
    id: 'melodic-minor-03',
    displayName: 'Lydian Augmented',
    aliases: [],
    family: 'melodic-minor',
    offsets: [0, 2, 4, 6, 8, 9, 11],
  },
  {
    id: 'melodic-minor-04',
    displayName: 'Lydian Dominant',
    aliases: ['Acoustic Scale'],
    family: 'melodic-minor',
    offsets: [0, 2, 4, 6, 7, 9, 10],
  },
  {
    id: 'melodic-minor-05',
    displayName: 'Mixolydian ♭6',
    aliases: ['Mixolydian b6', 'Aeolian Dominant'],
    family: 'melodic-minor',
    offsets: [0, 2, 4, 5, 7, 8, 10],
  },
  {
    id: 'melodic-minor-06',
    displayName: 'Locrian ♮2',
    aliases: ['Aeolian b5', 'Half-Diminished Scale'],
    family: 'melodic-minor',
    offsets: [0, 2, 3, 5, 6, 8, 10],
  },
  {
    id: 'melodic-minor-07',
    displayName: 'Altered',
    aliases: ['Altered Scale', 'Super Locrian'],
    family: 'melodic-minor',
    offsets: [0, 1, 3, 4, 6, 8, 10],
  },
  {
    id: 'pentatonic-major',
    displayName: 'Major Pentatonic',
    aliases: [],
    family: 'pentatonic',
    offsets: [0, 2, 4, 7, 9],
  },
  {
    id: 'pentatonic-minor',
    displayName: 'Minor Pentatonic',
    aliases: [],
    family: 'pentatonic',
    offsets: [0, 3, 5, 7, 10],
  },
  {
    id: 'blues-major',
    displayName: 'Major Blues',
    aliases: ['Major Blues Scale'],
    family: 'blues',
    offsets: [0, 2, 3, 4, 7, 9],
  },
  {
    id: 'blues-minor',
    displayName: 'Minor Blues',
    aliases: ['Minor Blues Scale', 'Blues Scale'],
    family: 'blues',
    offsets: [0, 3, 5, 6, 7, 10],
  },
  {
    id: 'whole-tone',
    displayName: 'Whole-Tone',
    aliases: ['Whole Tone', 'Whole-Tone Scale'],
    family: 'symmetric',
    offsets: [0, 2, 4, 6, 8, 10],
  },
  {
    id: 'octatonic-whole-half',
    displayName: 'Octatonic (Whole–Half)',
    aliases: ['Whole-Half Diminished', 'Whole Half Diminished'],
    family: 'symmetric',
    offsets: [0, 2, 3, 5, 6, 8, 9, 11],
  },
  {
    id: 'octatonic-half-whole',
    displayName: 'Octatonic (Half–Whole)',
    aliases: ['Half-Whole Diminished', 'Half Whole Diminished', 'Dominant Diminished'],
    family: 'symmetric',
    offsets: [0, 1, 3, 4, 6, 7, 9, 10],
  },
] as const satisfies readonly ScaleDefinitionData[]

export type ScaleId = (typeof SCALE_CATALOGUE_DATA)[number]['id']

export interface ScaleDefinition {
  readonly id: ScaleId
  readonly displayName: string
  readonly aliases: readonly string[]
  readonly family: ScaleFamily
  readonly offsets: readonly number[]
}

/** The application-owned canonical catalogue. Tonic is always offset zero. */
export const SCALE_CATALOGUE: readonly ScaleDefinition[] = SCALE_CATALOGUE_DATA

export type ScaleGroupId =
  | 'legacy-major'
  | 'legacy-minor-natural'
  | 'legacy-minor-harmonic'
  | 'legacy-minor-melodic'

export interface ScaleGroup {
  readonly id: ScaleGroupId
  readonly displayName: string
  readonly scaleIds: readonly ScaleId[]
}

/**
 * Historical menu organization. Natural minor deliberately reuses the seven
 * diatonic definitions in its original Aeolian-first order.
 */
export const SCALE_GROUPS: Readonly<Record<ScaleGroupId, ScaleGroup>> = {
  'legacy-major': {
    id: 'legacy-major',
    displayName: 'Legacy Major Modes',
    scaleIds: [
      'diatonic-ionian',
      'diatonic-dorian',
      'diatonic-phrygian',
      'diatonic-lydian',
      'diatonic-mixolydian',
      'diatonic-aeolian',
      'diatonic-locrian',
    ],
  },
  'legacy-minor-natural': {
    id: 'legacy-minor-natural',
    displayName: 'Legacy Natural Minor Modes',
    scaleIds: [
      'diatonic-aeolian',
      'diatonic-locrian',
      'diatonic-ionian',
      'diatonic-dorian',
      'diatonic-phrygian',
      'diatonic-lydian',
      'diatonic-mixolydian',
    ],
  },
  'legacy-minor-harmonic': {
    id: 'legacy-minor-harmonic',
    displayName: 'Legacy Harmonic Minor Modes',
    scaleIds: [
      'harmonic-minor-01',
      'harmonic-minor-02',
      'harmonic-minor-03',
      'harmonic-minor-04',
      'harmonic-minor-05',
      'harmonic-minor-06',
      'harmonic-minor-07',
    ],
  },
  'legacy-minor-melodic': {
    id: 'legacy-minor-melodic',
    displayName: 'Legacy Melodic Minor Modes',
    scaleIds: [
      'melodic-minor-01',
      'melodic-minor-02',
      'melodic-minor-03',
      'melodic-minor-04',
      'melodic-minor-05',
      'melodic-minor-06',
      'melodic-minor-07',
    ],
  },
}

export type LegacyScaleContext =
  | { readonly path: 'major' }
  | {
      readonly path: 'minor'
      readonly minor: 'natural' | 'harmonic' | 'melodic'
    }

const LEGACY_NAMES: Readonly<
  Record<ScaleGroupId, Readonly<Record<string, ScaleId>>>
> = {
  'legacy-major': {
    ionian: 'diatonic-ionian',
    dorian: 'diatonic-dorian',
    phrygian: 'diatonic-phrygian',
    lydian: 'diatonic-lydian',
    mixolydian: 'diatonic-mixolydian',
    aeolian: 'diatonic-aeolian',
    locrian: 'diatonic-locrian',
  },
  'legacy-minor-natural': {
    aeolian: 'diatonic-aeolian',
    locrian: 'diatonic-locrian',
    ionian: 'diatonic-ionian',
    dorian: 'diatonic-dorian',
    phrygian: 'diatonic-phrygian',
    lydian: 'diatonic-lydian',
    mixolydian: 'diatonic-mixolydian',
  },
  'legacy-minor-harmonic': {
    'harmonic minor': 'harmonic-minor-01',
    'locrian#6': 'harmonic-minor-02',
    'ionian#5': 'harmonic-minor-03',
    'dorian#4': 'harmonic-minor-04',
    'phrygian dominant': 'harmonic-minor-05',
    'lydian#2': 'harmonic-minor-06',
    'super locrian': 'harmonic-minor-07',
  },
  'legacy-minor-melodic': {
    'melodic minor': 'melodic-minor-01',
    'dorian b2': 'melodic-minor-02',
    'lydian augmented': 'melodic-minor-03',
    'lydian dominant': 'melodic-minor-04',
    'mixolydian b6': 'melodic-minor-05',
    'aeolian b5': 'melodic-minor-06',
    'altered scale': 'melodic-minor-07',
  },
}

const SCALE_BY_ID = new Map<ScaleId, ScaleDefinition>(
  SCALE_CATALOGUE.map((scale) => [scale.id, scale]),
)
const SCALE_FAMILY_SET = new Set<string>(SCALE_FAMILIES)

export function normalizeScaleName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en')
    .replaceAll('♯', '#')
    .replaceAll('♭', 'b')
    .replace(/\s+/g, ' ')
}

export function findScaleById(id: string): ScaleDefinition | undefined {
  return SCALE_CATALOGUE.find((scale) => scale.id === id)
}

/** Lookup for trusted domain IDs. Persisted or user data should use findScaleById first. */
export function getScale(id: ScaleId): ScaleDefinition {
  const scale = SCALE_BY_ID.get(id)
  if (scale === undefined) {
    throw new RangeError(`Unknown scale ID: ${String(id)}`)
  }
  return scale
}

/** Name lookup intentionally returns every match because some theory aliases collide. */
export function findScalesByName(value: string): readonly ScaleDefinition[] {
  const normalized = normalizeScaleName(value)
  if (normalized.length === 0) {
    return []
  }

  return SCALE_CATALOGUE.filter((scale) =>
    [scale.id, scale.displayName, ...scale.aliases].some(
      (candidate) => normalizeScaleName(candidate) === normalized,
    ),
  )
}

export function getScalesByFamily(family: ScaleFamily): readonly ScaleDefinition[] {
  return SCALE_CATALOGUE.filter((scale) => scale.family === family)
}

export function getScaleGroup(id: ScaleGroupId): ScaleGroup {
  return SCALE_GROUPS[id]
}

export function getScalesInGroup(id: ScaleGroupId): readonly ScaleDefinition[] {
  return getScaleGroup(id).scaleIds.map(getScale)
}

export function getLegacyScaleGroup(context: LegacyScaleContext): ScaleGroup {
  if (context.path === 'major') {
    return SCALE_GROUPS['legacy-major']
  }
  return SCALE_GROUPS[`legacy-minor-${context.minor}`]
}

/**
 * Resolves only names accepted by the corresponding historical menu. This is
 * deliberately context-scoped: harmonic-minor `super locrian` is not the
 * melodic-minor Altered scale, despite that common modern alias collision.
 */
export function resolveLegacyScale(
  context: LegacyScaleContext,
  legacyName: string,
): ScaleDefinition | undefined {
  const group = getLegacyScaleGroup(context)
  const scaleId = LEGACY_NAMES[group.id][normalizeScaleName(legacyName)]
  return scaleId === undefined ? undefined : getScale(scaleId)
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string')
}

export function validateScaleDefinition(value: unknown): readonly string[] {
  if (!isRecord(value)) {
    return ['Scale definition must be an object']
  }

  const errors: string[] = []
  const { id, displayName, aliases, family, offsets } = value

  if (typeof id !== 'string' || !SCALE_BY_ID.has(id as ScaleId)) {
    errors.push('Scale ID must be a known canonical ID')
  }
  if (typeof displayName !== 'string' || displayName.trim().length === 0) {
    errors.push('Scale displayName must be a non-empty string')
  }
  if (!SCALE_FAMILY_SET.has(typeof family === 'string' ? family : '')) {
    errors.push('Scale family must be one of the six canonical families')
  }

  if (!isStringArray(aliases)) {
    errors.push('Scale aliases must be strings')
  } else {
    const normalizedAliases = aliases.map((alias) => normalizeScaleName(alias))
    if (
      normalizedAliases.some((alias) => alias.length === 0) ||
      new Set(normalizedAliases).size !== normalizedAliases.length
    ) {
      errors.push('Scale aliases must be non-empty and unique within a definition')
    }
  }

  if (!Array.isArray(offsets) || offsets.length === 0) {
    errors.push('Scale offsets must be a non-empty array')
  } else {
    let previous = -1
    for (const offset of offsets) {
      if (!Number.isSafeInteger(offset) || (offset as number) < 0 || (offset as number) > 11) {
        errors.push('Scale offsets must be safe integers from 0 through 11')
        break
      }
      if ((offset as number) <= previous) {
        errors.push('Scale offsets must be unique and strictly increasing')
        break
      }
      previous = offset as number
    }
    if (offsets[0] !== 0) {
      errors.push('Scale offsets must begin with tonic 0')
    }
  }

  return errors
}

export function isValidScaleDefinition(value: unknown): value is ScaleDefinition {
  return validateScaleDefinition(value).length === 0
}

export function validateScaleCatalogue(
  catalogue: readonly unknown[] = SCALE_CATALOGUE,
): readonly string[] {
  const errors: string[] = []
  const seenIds = new Set<string>()
  const seenOffsets = new Map<string, string>()

  for (const [index, value] of catalogue.entries()) {
    for (const error of validateScaleDefinition(value)) {
      errors.push(`Scale at index ${String(index)}: ${error}`)
    }
    if (!isRecord(value)) {
      continue
    }

    const id = typeof value.id === 'string' ? value.id : `index-${String(index)}`
    if (seenIds.has(id)) {
      errors.push(`Duplicate scale ID: ${id}`)
    }
    seenIds.add(id)

    if (Array.isArray(value.offsets)) {
      const offsetKey = value.offsets.join(',')
      const existingId = seenOffsets.get(offsetKey)
      if (existingId !== undefined) {
        errors.push(`Duplicate scale offsets: ${existingId} and ${id}`)
      } else {
        seenOffsets.set(offsetKey, id)
      }
    }
  }

  return errors
}

export function assertValidScaleCatalogue(
  catalogue: readonly unknown[] = SCALE_CATALOGUE,
): void {
  const errors = validateScaleCatalogue(catalogue)
  if (errors.length > 0) {
    throw new Error(`Invalid scale catalogue:\n${errors.join('\n')}`)
  }
}

/** Transposes tonic-relative offsets while preserving scale-degree order. */
export function transposeScale(
  scaleOrId: ScaleDefinition | ScaleId,
  tonicPitchClass: number,
): readonly number[] {
  if (!Number.isSafeInteger(tonicPitchClass) || tonicPitchClass < 0 || tonicPitchClass > 11) {
    throw new RangeError(
      `tonicPitchClass must be an integer from 0 through 11; received ${String(tonicPitchClass)}`,
    )
  }

  const scale = typeof scaleOrId === 'string' ? getScale(scaleOrId) : scaleOrId
  return scale.offsets.map((offset) => (tonicPitchClass + offset) % 12)
}
