import type { MeterPresetId, MeterSpec } from './types'

const PRESETS: Readonly<Record<MeterPresetId, MeterSpec>> = Object.freeze({
  '4/4': Object.freeze({
    numerator: 4,
    denominator: 4,
    beatGroups: Object.freeze([2, 2]),
  }),
  '3/4': Object.freeze({
    numerator: 3,
    denominator: 4,
    beatGroups: Object.freeze([3]),
  }),
  '6/8': Object.freeze({
    numerator: 6,
    denominator: 8,
    beatGroups: Object.freeze([3, 3]),
  }),
  '5/4': Object.freeze({
    numerator: 5,
    denominator: 4,
    beatGroups: Object.freeze([3, 2]),
  }),
  '5/8': Object.freeze({
    numerator: 5,
    denominator: 8,
    beatGroups: Object.freeze([2, 3]),
  }),
  '7/8': Object.freeze({
    numerator: 7,
    denominator: 8,
    beatGroups: Object.freeze([2, 2, 3]),
  }),
})

export const METER_PRESET_IDS = Object.freeze([
  '4/4',
  '3/4',
  '6/8',
  '5/4',
  '5/8',
  '7/8',
] as const satisfies readonly MeterPresetId[])

export function getMeterPreset(id: MeterPresetId): MeterSpec {
  const preset = PRESETS[id]
  return {
    numerator: preset.numerator,
    denominator: preset.denominator,
    beatGroups: [...preset.beatGroups],
  }
}

export function isMeterPresetId(value: unknown): value is MeterPresetId {
  return (
    typeof value === 'string' &&
    METER_PRESET_IDS.some((presetId) => presetId === value)
  )
}
