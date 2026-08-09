import { SCALE_CATALOGUE } from '../scales'
import { createStateIdV2, modeStateIdV2 } from './identities'
import type {
  BreedModePayloadV2,
  CreateStateV2,
  EmptyModePayloadV2,
  EvolutionModeV2,
  LegacyCreateSettingsV2,
  ModeStateV2,
  ModernCreateSettingsV2,
} from './types'
import {
  booleanValue,
  deepFreezeV2,
  enumValue,
  exactPlainObject,
  failSchemaV2,
  finiteNumber,
  literalValue,
  nonEmptyString,
  plainObject,
  safeInteger,
  stringValue,
  uniqueStringArray,
} from './validation'

export const EVOLUTION_MODES_V2 = deepFreezeV2([
  'breed',
  'drift',
  'islands',
  'map',
  'pareto',
  'pair-lab',
] as const satisfies readonly EvolutionModeV2[])

export const EMPTY_MODE_PAYLOAD_V2 = deepFreezeV2({
  version: 'empty-mode-state-v2',
  initialized: false,
} as const satisfies EmptyModePayloadV2)

export const DEFAULT_LEGACY_CREATE_SETTINGS_V2 = deepFreezeV2({
  tonicPitchClass: 0,
  scaleId: 'diatonic-ionian',
  noteCount: 8,
  tempoBpm: 108,
  populationSize: 8,
  seed: 'legacy-amber',
} as const satisfies LegacyCreateSettingsV2)

export const DEFAULT_MODERN_CREATE_SETTINGS_V2 = deepFreezeV2({
  tonicPitchClass: 0,
  scaleId: 'diatonic-ionian',
  registerLowOctave: 4,
  registerHighOctave: 6,
  noteCount: 8,
  phraseBeats: 4,
  tempoBpm: 108,
  gridTicks: 240,
  allowRests: false,
  maxLeap: 4,
  tonicClosure: true,
  populationSize: 8,
  seed: 'paper-kite',
} as const satisfies ModernCreateSettingsV2)

const CATALOGUE_SCALE_IDS = new Set(
  SCALE_CATALOGUE.map(({ id }) => id as string),
)

function assertCatalogueScaleId(value: unknown, path: string): string {
  const scaleId = nonEmptyString(value, path)
  if (!CATALOGUE_SCALE_IDS.has(scaleId)) {
    failSchemaV2(
      'invalid-value',
      path,
      'M2 Create settings require a canonical catalogue scale ID',
    )
  }
  return scaleId
}

export function assertLegacyCreateSettingsV2(
  value: unknown,
  path = 'legacySettings',
): asserts value is LegacyCreateSettingsV2 {
  const record = exactPlainObject(
    value,
    [
      'tonicPitchClass',
      'scaleId',
      'noteCount',
      'tempoBpm',
      'populationSize',
      'seed',
    ],
    path,
  )
  safeInteger(record.tonicPitchClass, `${path}.tonicPitchClass`, 0, 11)
  assertCatalogueScaleId(record.scaleId, `${path}.scaleId`)
  safeInteger(record.noteCount, `${path}.noteCount`, 4, 32)
  const tempo = finiteNumber(record.tempoBpm, `${path}.tempoBpm`)
  if (tempo < 30 || tempo > 300) {
    failSchemaV2(
      'invalid-value',
      `${path}.tempoBpm`,
      'must be between 30 and 300',
    )
  }
  safeInteger(record.populationSize, `${path}.populationSize`, 1, 16)
  nonEmptyString(record.seed, `${path}.seed`)
}

export function assertModernCreateSettingsV2(
  value: unknown,
  path = 'modernSettings',
): asserts value is ModernCreateSettingsV2 {
  const record = exactPlainObject(
    value,
    [
      'tonicPitchClass',
      'scaleId',
      'registerLowOctave',
      'registerHighOctave',
      'noteCount',
      'phraseBeats',
      'tempoBpm',
      'gridTicks',
      'allowRests',
      'maxLeap',
      'tonicClosure',
      'populationSize',
      'seed',
    ],
    path,
  )
  safeInteger(record.tonicPitchClass, `${path}.tonicPitchClass`, 0, 11)
  assertCatalogueScaleId(record.scaleId, `${path}.scaleId`)
  const low = safeInteger(
    record.registerLowOctave,
    `${path}.registerLowOctave`,
    1,
    7,
  )
  const high = safeInteger(
    record.registerHighOctave,
    `${path}.registerHighOctave`,
    2,
    8,
  )
  if (high <= low || high > low + 4) {
    failSchemaV2(
      'invalid-value',
      `${path}.registerHighOctave`,
      'must be one through four octaves above registerLowOctave',
    )
  }
  safeInteger(record.noteCount, `${path}.noteCount`, 4, 32)
  safeInteger(record.phraseBeats, `${path}.phraseBeats`, 2, 16)
  safeInteger(record.tempoBpm, `${path}.tempoBpm`, 40, 240)
  enumValue(record.gridTicks, [120, 240, 480] as const, `${path}.gridTicks`)
  booleanValue(record.allowRests, `${path}.allowRests`)
  safeInteger(record.maxLeap, `${path}.maxLeap`, 1, 12)
  booleanValue(record.tonicClosure, `${path}.tonicClosure`)
  safeInteger(record.populationSize, `${path}.populationSize`, 2, 16)
  const seed = nonEmptyString(record.seed, `${path}.seed`)
  if (seed.length > 80) {
    failSchemaV2('invalid-value', `${path}.seed`, 'must be at most 80 code units')
  }
}

export function assertCreateStateV2(
  value: unknown,
): asserts value is CreateStateV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'projectId',
      'activeGenerator',
      'legacySettings',
      'modernSettings',
    ],
    'createState',
  )
  literalValue(record.version, 'create-state-v2', 'createState.version')
  const projectId = nonEmptyString(record.projectId, 'createState.projectId')
  enumValue(
    record.activeGenerator,
    ['legacy', 'modern'] as const,
    'createState.activeGenerator',
  )
  assertLegacyCreateSettingsV2(record.legacySettings, 'createState.legacySettings')
  assertModernCreateSettingsV2(record.modernSettings, 'createState.modernSettings')
  const expectedId = createStateIdV2(projectId)
  if (record.id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'createState.id',
      `must equal ${expectedId}`,
    )
  }
}

function assertEmptyPayload(value: unknown, path: string): EmptyModePayloadV2 {
  const record = exactPlainObject(value, ['version', 'initialized'], path)
  literalValue(record.version, 'empty-mode-state-v2', `${path}.version`)
  literalValue(record.initialized, false, `${path}.initialized`)
  return EMPTY_MODE_PAYLOAD_V2
}

function assertBreedPayload(value: unknown, path: string): BreedModePayloadV2 {
  const record = exactPlainObject(
    value,
    [
      'version',
      'initialized',
      'populationCandidateIds',
      'parentCandidateIds',
      'populationSize',
      'mutationStrength',
      'retainElites',
      'crossoverPolicy',
      'exactDeduplication',
      'noveltyProtection',
      'seed',
      'generationOrdinal',
    ],
    path,
  )
  literalValue(record.version, 'breed-mode-state-v2.0.0', `${path}.version`)
  literalValue(record.initialized, true, `${path}.initialized`)
  const populationCandidateIds = uniqueStringArray(
    record.populationCandidateIds,
    `${path}.populationCandidateIds`,
  )
  const parentCandidateIds = uniqueStringArray(
    record.parentCandidateIds,
    `${path}.parentCandidateIds`,
  )
  if (parentCandidateIds.length > 2) {
    failSchemaV2(
      'invalid-value',
      `${path}.parentCandidateIds`,
      'may contain at most two ordered parents',
    )
  }
  const populationSet = new Set(populationCandidateIds)
  parentCandidateIds.forEach((id, index) => {
    if (!populationSet.has(id)) {
      failSchemaV2(
        'unresolved-reference',
        `${path}.parentCandidateIds[${String(index)}]`,
        'must be a member of populationCandidateIds',
      )
    }
  })
  const populationSize = safeInteger(
    record.populationSize,
    `${path}.populationSize`,
    1,
    16,
  )
  const mutationStrength = finiteNumber(
    record.mutationStrength,
    `${path}.mutationStrength`,
  )
  if (mutationStrength < 0 || mutationStrength > 1) {
    failSchemaV2(
      'invalid-value',
      `${path}.mutationStrength`,
      'must be between zero and one',
    )
  }
  return {
    version: 'breed-mode-state-v2.0.0',
    initialized: true,
    populationCandidateIds,
    parentCandidateIds,
    populationSize,
    mutationStrength,
    retainElites: booleanValue(record.retainElites, `${path}.retainElites`),
    crossoverPolicy: literalValue(
      record.crossoverPolicy,
      'conservative-directed',
      `${path}.crossoverPolicy`,
    ),
    exactDeduplication: booleanValue(
      record.exactDeduplication,
      `${path}.exactDeduplication`,
    ),
    noveltyProtection: booleanValue(
      record.noveltyProtection,
      `${path}.noveltyProtection`,
    ),
    seed: stringValue(record.seed, `${path}.seed`),
    generationOrdinal: safeInteger(
      record.generationOrdinal,
      `${path}.generationOrdinal`,
      0,
    ),
  }
}

export function assertModeStateV2(value: unknown): asserts value is ModeStateV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'projectId', 'mode', 'payload'],
    'modeState',
  )
  literalValue(record.version, 'mode-state-v2', 'modeState.version')
  const projectId = nonEmptyString(record.projectId, 'modeState.projectId')
  const mode = enumValue(record.mode, EVOLUTION_MODES_V2, 'modeState.mode')
  const payloadPreview = plainObject(record.payload, 'modeState.payload')
  if (payloadPreview.version === 'empty-mode-state-v2') {
    assertEmptyPayload(record.payload, 'modeState.payload')
  } else if (payloadPreview.version === 'breed-mode-state-v2.0.0') {
    if (mode !== 'breed') {
      failSchemaV2(
        'unregistered-version',
        'modeState.payload.version',
        'Breed payload is registered only for the Breed mode row',
      )
    }
    assertBreedPayload(record.payload, 'modeState.payload')
  } else {
    failSchemaV2(
      'unregistered-version',
      'modeState.payload.version',
      'payload version is not registered in the M2 schema kernel',
    )
  }
  const expectedId = modeStateIdV2(projectId, mode)
  if (record.id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'modeState.id',
      `must equal ${expectedId}`,
    )
  }
}

export function createDefaultCreateStateV2(projectId: string): CreateStateV2 {
  const value: CreateStateV2 = {
    id: createStateIdV2(projectId),
    version: 'create-state-v2',
    projectId,
    activeGenerator: 'legacy',
    legacySettings: { ...DEFAULT_LEGACY_CREATE_SETTINGS_V2 },
    modernSettings: { ...DEFAULT_MODERN_CREATE_SETTINGS_V2 },
  }
  assertCreateStateV2(value)
  return deepFreezeV2(value)
}

export function createEmptyModeStateV2(
  projectId: string,
  mode: EvolutionModeV2,
): ModeStateV2 {
  const value: ModeStateV2 = {
    id: modeStateIdV2(projectId, mode),
    version: 'mode-state-v2',
    projectId,
    mode,
    payload: { ...EMPTY_MODE_PAYLOAD_V2 },
  }
  assertModeStateV2(value)
  return deepFreezeV2(value)
}

export function createEmptyModeStatesV2(
  projectId: string,
): readonly ModeStateV2[] {
  return deepFreezeV2(
    EVOLUTION_MODES_V2.map((mode) => createEmptyModeStateV2(projectId, mode)),
  )
}
