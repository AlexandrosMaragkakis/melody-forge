import { V1_TRIANGLE_COMPATIBILITY_PROFILE } from '../performance/v1Compatibility'
import { performanceSettingsIdV2 } from './identities'
import type {
  PerformanceSettingsRecordV2,
  PerformanceSettingsV2,
  V1CompatibilityPerformanceSettingsV2,
} from './types'
import {
  booleanValue,
  deepFreezeV2,
  enumValue,
  exactPlainObject,
  failSchemaV2,
  literalValue,
  nonEmptyString,
  plainObject,
  safeInteger,
} from './validation'

export const DEFAULT_SOFT_PLUCK_PERFORMANCE_SETTINGS_V2 = deepFreezeV2({
  version: 'performance-v2',
  voice: 'soft-pluck',
  articulation: 55,
  accentAmount: 35,
  reverb: { enabled: true, amount: 10, tailTicks: 960 },
  delay: { enabled: false, amount: 0, delayTicks: 240, feedback: 20 },
  melodyVolume: 82,
  beatVolume: 68,
  effectsVolume: 20,
  masterVolume: 80,
} as const)

export const DEFAULT_SOFT_PLUCK_PERFORMANCE_V2 = deepFreezeV2({
  id: performanceSettingsIdV2(DEFAULT_SOFT_PLUCK_PERFORMANCE_SETTINGS_V2),
  ...DEFAULT_SOFT_PLUCK_PERFORMANCE_SETTINGS_V2,
} satisfies PerformanceSettingsV2)

const COMPATIBILITY_SETTINGS_WITHOUT_ID = deepFreezeV2({
  version: V1_TRIANGLE_COMPATIBILITY_PROFILE.version,
  voiceFactoryId: V1_TRIANGLE_COMPATIBILITY_PROFILE.voiceFactoryId,
} as const)

export const V1_COMPATIBILITY_PERFORMANCE_V2 = deepFreezeV2({
  id: performanceSettingsIdV2(COMPATIBILITY_SETTINGS_WITHOUT_ID),
  ...COMPATIBILITY_SETTINGS_WITHOUT_ID,
} satisfies V1CompatibilityPerformanceSettingsV2)

const PERFORMANCE_VOICES = [
  'soft-pluck',
  'bell-mallet',
  'warm-lead',
  'bass',
  'chiptune',
  'soft-keys',
] as const

function integerPercentage(
  value: unknown,
  path: string,
  maximum: number,
): number {
  return safeInteger(value, path, 0, maximum)
}

function assertPerformanceIdentity(
  id: unknown,
  settings:
    | Omit<PerformanceSettingsV2, 'id'>
    | Omit<V1CompatibilityPerformanceSettingsV2, 'id'>,
): void {
  const actualId = nonEmptyString(id, 'performance.id')
  const expectedId = performanceSettingsIdV2(settings)
  if (actualId !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'performance.id',
      `must equal ${expectedId}`,
    )
  }
}

export function assertPerformanceSettingsRecordV2(
  value: unknown,
): asserts value is PerformanceSettingsRecordV2 {
  const discriminator = plainObject(value, 'performance')

  if (discriminator.version === 'v1-compat-performance-v1') {
    const record = exactPlainObject(
      value,
      ['id', 'version', 'voiceFactoryId'],
      'performance',
    )
    literalValue(
      record.version,
      V1_TRIANGLE_COMPATIBILITY_PROFILE.version,
      'performance.version',
    )
    literalValue(
      record.voiceFactoryId,
      V1_TRIANGLE_COMPATIBILITY_PROFILE.voiceFactoryId,
      'performance.voiceFactoryId',
    )
    assertPerformanceIdentity(record.id, {
      version: 'v1-compat-performance-v1',
      voiceFactoryId: 'v1-triangle-compat',
    })
    return
  }

  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'voice',
      'articulation',
      'accentAmount',
      'reverb',
      'delay',
      'melodyVolume',
      'beatVolume',
      'effectsVolume',
      'masterVolume',
    ],
    'performance',
  )
  literalValue(record.version, 'performance-v2', 'performance.version')
  const voice = enumValue(record.voice, PERFORMANCE_VOICES, 'performance.voice')
  const articulation = integerPercentage(
    record.articulation,
    'performance.articulation',
    100,
  )
  const accentAmount = integerPercentage(
    record.accentAmount,
    'performance.accentAmount',
    100,
  )
  const reverb = exactPlainObject(
    record.reverb,
    ['enabled', 'amount', 'tailTicks'],
    'performance.reverb',
  )
  const reverbSettings = {
    enabled: booleanValue(reverb.enabled, 'performance.reverb.enabled'),
    amount: integerPercentage(
      reverb.amount,
      'performance.reverb.amount',
      30,
    ),
    tailTicks: safeInteger(
      reverb.tailTicks,
      'performance.reverb.tailTicks',
      120,
      3840,
    ),
  }
  const delay = exactPlainObject(
    record.delay,
    ['enabled', 'amount', 'delayTicks', 'feedback'],
    'performance.delay',
  )
  const delaySettings = {
    enabled: booleanValue(delay.enabled, 'performance.delay.enabled'),
    amount: integerPercentage(delay.amount, 'performance.delay.amount', 25),
    delayTicks: enumValue(
      delay.delayTicks,
      [120, 240, 480, 960] as const,
      'performance.delay.delayTicks',
    ),
    feedback: integerPercentage(
      delay.feedback,
      'performance.delay.feedback',
      75,
    ),
  }
  const settings: Omit<PerformanceSettingsV2, 'id'> = {
    version: 'performance-v2',
    voice,
    articulation,
    accentAmount,
    reverb: reverbSettings,
    delay: delaySettings,
    melodyVolume: integerPercentage(
      record.melodyVolume,
      'performance.melodyVolume',
      100,
    ),
    beatVolume: integerPercentage(
      record.beatVolume,
      'performance.beatVolume',
      100,
    ),
    effectsVolume: integerPercentage(
      record.effectsVolume,
      'performance.effectsVolume',
      100,
    ),
    masterVolume: integerPercentage(
      record.masterVolume,
      'performance.masterVolume',
      100,
    ),
  }
  assertPerformanceIdentity(record.id, settings)
}
