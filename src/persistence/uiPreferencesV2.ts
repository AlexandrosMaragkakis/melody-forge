export const UI_PREFERENCES_STORAGE_KEY_V2 =
  'melody-forge:ui-preferences:v2' as const
export const UI_PREFERENCES_VERSION_V2 = 'ui-preferences-v2' as const

export const UI_PREFERENCES_LIMITS_V2 = Object.freeze({
  maxUtf8Bytes: 16_384,
  maxRegisteredPaths: 64,
  maxNestingDepth: 4,
  maxStringScalars: 256,
})

export type VisualDensityV2 = 'comfortable' | 'compact'
export type ReducedMotionOverrideV2 = 'system' | 'reduce'
export type LibraryViewV2 = 'grid' | 'list'
export type AnalysisViewV2 = 'visual' | 'table'

export interface UiPreferenceViewsV2 {
  readonly library: LibraryViewV2
  readonly map: AnalysisViewV2
  readonly pareto: AnalysisViewV2
}

export interface UiPreferencePanelSizesV2 {
  readonly controlsWidthPx: number
  readonly inspectorWidthPx: number
}

export interface UiPreferenceDisclosuresV2 {
  readonly transportMore: boolean
  readonly sound: boolean
  readonly beatAdvanced: boolean
  readonly createAdvanced: boolean
  readonly mutationAdvanced: boolean
  readonly tonalAdvanced: boolean
  readonly history: boolean
  readonly technical: boolean
}

export interface UiPreferenceValuesV2 {
  readonly visualDensity: VisualDensityV2
  readonly reducedMotionOverride: ReducedMotionOverrideV2
  readonly views: UiPreferenceViewsV2
  readonly panelSizes: UiPreferencePanelSizesV2
  readonly disclosures: UiPreferenceDisclosuresV2
}

export interface UiPreferencesRecordV2 {
  readonly version: typeof UI_PREFERENCES_VERSION_V2
  readonly values: UiPreferenceValuesV2
}

export type UiPreferenceScalarV2 = string | number | boolean | null

export interface UiPreferenceLeafDefinitionV2 {
  /** A path below `values`; its segment count is its nesting depth. */
  readonly path: readonly string[]
  readonly defaultValue: UiPreferenceScalarV2
  readonly validate: (value: unknown) => boolean
}

export interface UiPreferenceRegistryV2 {
  readonly version: string
  /** Leaf order also defines canonical object-key order. */
  readonly leaves: readonly UiPreferenceLeafDefinitionV2[]
}

export interface RegisteredUiPreferencesRecordV2 {
  readonly version: string
  readonly values: Readonly<Record<string, unknown>>
}

export type UiPreferencesDecodeResultV2<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

export interface UiPreferencesStorageReaderV2 {
  getItem(key: string): string | null
}

export interface UiPreferencesStorageWriterV2 {
  setItem(key: string, value: string): void
}

export type UiPreferencesLoadResultV2 =
  | {
      readonly ok: true
      readonly value: UiPreferencesRecordV2
      readonly source: 'stored' | 'empty'
    }
  | {
      readonly ok: false
      readonly value: UiPreferencesRecordV2
      readonly error: string
    }

export type UiPreferencesSaveResultV2 =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string }

const DEFAULT_VIEWS_V2: UiPreferenceViewsV2 = Object.freeze({
  library: 'grid',
  map: 'visual',
  pareto: 'visual',
})

const DEFAULT_PANEL_SIZES_V2: UiPreferencePanelSizesV2 = Object.freeze({
  controlsWidthPx: 244,
  inspectorWidthPx: 312,
})

const DEFAULT_DISCLOSURES_V2: UiPreferenceDisclosuresV2 = Object.freeze({
  transportMore: false,
  sound: false,
  beatAdvanced: false,
  createAdvanced: false,
  mutationAdvanced: false,
  tonalAdvanced: false,
  history: false,
  technical: false,
})

const DEFAULT_VALUES_V2: UiPreferenceValuesV2 = Object.freeze({
  visualDensity: 'comfortable',
  reducedMotionOverride: 'system',
  views: DEFAULT_VIEWS_V2,
  panelSizes: DEFAULT_PANEL_SIZES_V2,
  disclosures: DEFAULT_DISCLOSURES_V2,
})

export const DEFAULT_UI_PREFERENCES_V2: UiPreferencesRecordV2 = Object.freeze({
  version: UI_PREFERENCES_VERSION_V2,
  values: DEFAULT_VALUES_V2,
})

function oneOf(...allowed: readonly UiPreferenceScalarV2[]) {
  return (value: unknown): boolean => allowed.includes(value as UiPreferenceScalarV2)
}

function integerBetween(minimum: number, maximum: number) {
  return (value: unknown): boolean =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
}

const isBoolean = (value: unknown): boolean => typeof value === 'boolean'

/** The fixed 15-leaf production registry, in canonical serialization order. */
export const UI_PREFERENCE_REGISTRY_V2: UiPreferenceRegistryV2 = Object.freeze({
  version: UI_PREFERENCES_VERSION_V2,
  leaves: Object.freeze([
    Object.freeze({
      path: Object.freeze(['visualDensity']),
      defaultValue: 'comfortable',
      validate: oneOf('comfortable', 'compact'),
    }),
    Object.freeze({
      path: Object.freeze(['reducedMotionOverride']),
      defaultValue: 'system',
      validate: oneOf('system', 'reduce'),
    }),
    Object.freeze({
      path: Object.freeze(['views', 'library']),
      defaultValue: 'grid',
      validate: oneOf('grid', 'list'),
    }),
    Object.freeze({
      path: Object.freeze(['views', 'map']),
      defaultValue: 'visual',
      validate: oneOf('visual', 'table'),
    }),
    Object.freeze({
      path: Object.freeze(['views', 'pareto']),
      defaultValue: 'visual',
      validate: oneOf('visual', 'table'),
    }),
    Object.freeze({
      path: Object.freeze(['panelSizes', 'controlsWidthPx']),
      defaultValue: 244,
      validate: integerBetween(216, 264),
    }),
    Object.freeze({
      path: Object.freeze(['panelSizes', 'inspectorWidthPx']),
      defaultValue: 312,
      validate: integerBetween(288, 336),
    }),
    ...[
      'transportMore',
      'sound',
      'beatAdvanced',
      'createAdvanced',
      'mutationAdvanced',
      'tonalAdvanced',
      'history',
      'technical',
    ].map((name) =>
      Object.freeze({
        path: Object.freeze(['disclosures', name]),
        defaultValue: false,
        validate: isBoolean,
      }),
    ),
  ]),
})

interface RegistryNodeV2 {
  readonly children: Map<string, RegistryNodeV2>
  leaf: UiPreferenceLeafDefinitionV2 | null
}

interface CompiledRegistryV2 {
  readonly version: string
  readonly root: RegistryNodeV2
}

function decodeError<T>(error: string): UiPreferencesDecodeResultV2<T> {
  return { ok: false, error }
}

function scalarLength(value: string): number | null {
  let scalars = 0
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) {
        return null
      }
      index += 1
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return null
    }
    scalars += 1
  }
  return scalars
}

function validString(value: string): boolean {
  const length = scalarLength(value)
  return length !== null && length <= UI_PREFERENCES_LIMITS_V2.maxStringScalars
}

function validScalar(value: unknown): value is UiPreferenceScalarV2 {
  if (value === null || typeof value === 'boolean') {
    return true
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  return typeof value === 'string' && validString(value)
}

function utf8ByteLengthWithinLimit(text: string): number | null {
  let bytes = 0
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index)
    if (unit <= 0x7f) {
      bytes += 1
    } else if (unit <= 0x7ff) {
      bytes += 2
    } else if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1)
      if (index + 1 >= text.length || next < 0xdc00 || next > 0xdfff) {
        return null
      }
      bytes += 4
      index += 1
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return null
    } else {
      bytes += 3
    }

    if (bytes > UI_PREFERENCES_LIMITS_V2.maxUtf8Bytes) {
      return bytes
    }
  }
  return bytes
}

function createRegistryNode(): RegistryNodeV2 {
  return { children: new Map(), leaf: null }
}

function isRuntimeArray(value: unknown): boolean {
  return Array.isArray(value)
}

function compileRegistry(
  registry: UiPreferenceRegistryV2,
): UiPreferencesDecodeResultV2<CompiledRegistryV2> {
  if (!validString(registry.version) || registry.version.length === 0) {
    return decodeError('The preference registry version is invalid.')
  }
  if (!isRuntimeArray(registry.leaves)) {
    return decodeError('The preference registry leaves must be an array.')
  }
  const leaves: readonly UiPreferenceLeafDefinitionV2[] = registry.leaves
  if (leaves.length > UI_PREFERENCES_LIMITS_V2.maxRegisteredPaths) {
    return decodeError(
      `The preference registry exceeds ${String(UI_PREFERENCES_LIMITS_V2.maxRegisteredPaths)} registered paths.`,
    )
  }

  const root = createRegistryNode()
  for (const definition of leaves) {
    if (
      !isRuntimeArray(definition.path) ||
      definition.path.length === 0 ||
      definition.path.length > UI_PREFERENCES_LIMITS_V2.maxNestingDepth
    ) {
      return decodeError(
        `A preference registry path has invalid depth; the maximum is ${String(UI_PREFERENCES_LIMITS_V2.maxNestingDepth)}.`,
      )
    }
    if (
      !definition.path.every(
        (segment: unknown) =>
          typeof segment === 'string' &&
          segment.length > 0 &&
          !segment.includes('.') &&
          validString(segment),
      )
    ) {
      return decodeError('A preference registry path segment is invalid.')
    }
    if (!validScalar(definition.defaultValue)) {
      return decodeError('A preference registry default is not a valid scalar.')
    }
    let defaultIsValid: boolean
    try {
      defaultIsValid = definition.validate(definition.defaultValue)
    } catch {
      return decodeError('A preference registry validator threw an error.')
    }
    if (!defaultIsValid) {
      return decodeError('A preference registry default fails its validator.')
    }

    let node = root
    for (const segment of definition.path) {
      if (node.leaf !== null) {
        return decodeError('Preference registry paths may not overlap.')
      }
      let child = node.children.get(segment)
      if (child === undefined) {
        child = createRegistryNode()
        node.children.set(segment, child)
      }
      node = child
    }
    if (node.leaf !== null || node.children.size > 0) {
      return decodeError('Preference registry paths may not overlap.')
    }
    node.leaf = definition
  }

  return { ok: true, value: { version: registry.version, root } }
}

function plainRecordKeys(value: unknown): readonly string[] | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const prototype = Reflect.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return null
  }
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key !== 'string')) {
    return null
  }
  for (const key of keys) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key)
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return null
    }
  }
  return keys as string[]
}

function defineCanonicalProperty(
  record: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

function normalizeNode(
  input: Readonly<Record<string, unknown>>,
  node: RegistryNodeV2,
  path: readonly string[],
): UiPreferencesDecodeResultV2<Readonly<Record<string, unknown>>> {
  const inputKeys = plainRecordKeys(input)
  if (inputKeys === null) {
    return decodeError(`Preference object ${path.join('.') || 'values'} is not plain.`)
  }
  for (const key of inputKeys) {
    if (!node.children.has(key)) {
      return decodeError(`Unknown preference path: ${[...path, key].join('.')}.`)
    }
  }

  const normalized: Record<string, unknown> = {}
  for (const [key, child] of node.children) {
    const childPath = [...path, key]
    const isPresent = Object.prototype.hasOwnProperty.call(input, key)
    if (child.leaf !== null) {
      const value = isPresent ? input[key] : child.leaf.defaultValue
      if (!validScalar(value)) {
        return decodeError(`Preference ${childPath.join('.')} is not a valid scalar.`)
      }
      let accepted: boolean
      try {
        accepted = child.leaf.validate(value)
      } catch {
        return decodeError(`Preference validator failed for ${childPath.join('.')}.`)
      }
      if (!accepted) {
        return decodeError(`Preference ${childPath.join('.')} has an invalid value.`)
      }
      defineCanonicalProperty(normalized, key, value)
      continue
    }

    const nestedInput = isPresent ? input[key] : {}
    const nestedKeys = plainRecordKeys(nestedInput)
    if (nestedKeys === null) {
      return decodeError(`Preference object ${childPath.join('.')} is not plain.`)
    }
    const nested = normalizeNode(
      nestedInput as Readonly<Record<string, unknown>>,
      child,
      childPath,
    )
    if (!nested.ok) {
      return nested
    }
    defineCanonicalProperty(normalized, key, nested.value)
  }
  return { ok: true, value: normalized }
}

function normalizeWithCompiledRegistry(
  input: unknown,
  registry: CompiledRegistryV2,
): UiPreferencesDecodeResultV2<RegisteredUiPreferencesRecordV2> {
  const rootKeys = plainRecordKeys(input)
  if (
    rootKeys === null ||
    rootKeys.length !== 2 ||
    !rootKeys.includes('version') ||
    !rootKeys.includes('values')
  ) {
    return decodeError('The preference root must contain exactly version and values.')
  }

  const root = input as Readonly<Record<string, unknown>>
  if (root.version !== registry.version) {
    return decodeError('The preference record version is unsupported.')
  }
  const valueKeys = plainRecordKeys(root.values)
  if (valueKeys === null) {
    return decodeError('The preference values root must be a plain object.')
  }
  const values = normalizeNode(
    root.values as Readonly<Record<string, unknown>>,
    registry.root,
    [],
  )
  if (!values.ok) {
    return values
  }

  return {
    ok: true,
    value: { version: registry.version, values: values.value },
  }
}

/**
 * Decode a preference JSON value with an injected, closed leaf registry.
 * Registry validation and the UTF-8 gate both run before JSON parsing.
 */
export function decodeUiPreferencesWithRegistryV2(
  serialized: string,
  registry: UiPreferenceRegistryV2,
): UiPreferencesDecodeResultV2<RegisteredUiPreferencesRecordV2> {
  const compiled = compileRegistry(registry)
  if (!compiled.ok) {
    return compiled
  }

  const byteLength = utf8ByteLengthWithinLimit(serialized)
  if (byteLength === null) {
    return decodeError('The preference JSON contains an unpaired UTF-16 surrogate.')
  }
  if (byteLength > UI_PREFERENCES_LIMITS_V2.maxUtf8Bytes) {
    return decodeError(
      `The preference JSON exceeds ${String(UI_PREFERENCES_LIMITS_V2.maxUtf8Bytes)} UTF-8 bytes.`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized) as unknown
  } catch {
    return decodeError('The preference value is not valid JSON.')
  }
  return normalizeWithCompiledRegistry(parsed, compiled.value)
}

export function decodeUiPreferencesV2(
  serialized: string,
): UiPreferencesDecodeResultV2<UiPreferencesRecordV2> {
  const decoded = decodeUiPreferencesWithRegistryV2(
    serialized,
    UI_PREFERENCE_REGISTRY_V2,
  )
  return decoded.ok
    ? { ok: true, value: decoded.value as unknown as UiPreferencesRecordV2 }
    : decoded
}

export function normalizeUiPreferencesV2(
  input: unknown,
): UiPreferencesDecodeResultV2<UiPreferencesRecordV2> {
  const compiled = compileRegistry(UI_PREFERENCE_REGISTRY_V2)
  if (!compiled.ok) {
    return compiled
  }
  const normalized = normalizeWithCompiledRegistry(input, compiled.value)
  return normalized.ok
    ? { ok: true, value: normalized.value as unknown as UiPreferencesRecordV2 }
    : normalized
}

/** Encode in frozen declared-key order, as compact JSON without BOM or LF. */
export function encodeUiPreferencesV2(input: unknown): string {
  const normalized = normalizeUiPreferencesV2(input)
  if (!normalized.ok) {
    throw new TypeError(normalized.error)
  }
  return JSON.stringify(normalized.value)
}

export function createDefaultUiPreferencesV2(): UiPreferencesRecordV2 {
  return {
    version: UI_PREFERENCES_VERSION_V2,
    values: {
      visualDensity: 'comfortable',
      reducedMotionOverride: 'system',
      views: { library: 'grid', map: 'visual', pareto: 'visual' },
      panelSizes: { controlsWidthPx: 244, inspectorWidthPx: 312 },
      disclosures: {
        transportMore: false,
        sound: false,
        beatAdvanced: false,
        createAdvanced: false,
        mutationAdvanced: false,
        tonalAdvanced: false,
        history: false,
        technical: false,
      },
    },
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function loadUiPreferencesV2(
  storage: UiPreferencesStorageReaderV2,
): UiPreferencesLoadResultV2 {
  let serialized: string | null
  try {
    serialized = storage.getItem(UI_PREFERENCES_STORAGE_KEY_V2)
  } catch (error) {
    return {
      ok: false,
      value: createDefaultUiPreferencesV2(),
      error: `UI preferences could not be read: ${errorMessage(error)}`,
    }
  }

  if (serialized === null) {
    return {
      ok: true,
      value: createDefaultUiPreferencesV2(),
      source: 'empty',
    }
  }
  const decoded = decodeUiPreferencesV2(serialized)
  return decoded.ok
    ? { ok: true, value: decoded.value, source: 'stored' }
    : {
        ok: false,
        value: createDefaultUiPreferencesV2(),
        error: decoded.error,
      }
}

export function saveUiPreferencesV2(
  input: unknown,
  storage: UiPreferencesStorageWriterV2,
): UiPreferencesSaveResultV2 {
  let serialized: string
  try {
    serialized = encodeUiPreferencesV2(input)
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }

  try {
    storage.setItem(UI_PREFERENCES_STORAGE_KEY_V2, serialized)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: `UI preferences could not be saved: ${errorMessage(error)}`,
    }
  }
}
