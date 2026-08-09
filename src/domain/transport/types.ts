import type { Tick } from '../types'

export const TRANSPORT_VERSION = 'transport-v2' as const
export const TRANSPORT_PPQ = 480 as const
export const TRANSPORT_MIN_TEMPO_BPM = 30 as const
export const TRANSPORT_MAX_TEMPO_BPM = 300 as const
export const MAX_METER_NUMERATOR = 32 as const
export const MAX_METER_GROUPS = 32 as const
export const MAX_TRANSPORT_BAR_SPANS = 256 as const
export const MAX_TRANSPORT_GRID_OPPORTUNITIES = 65_536 as const

export type MeterDenominator = 1 | 2 | 4 | 8 | 16
export type MeterPresetId = '4/4' | '3/4' | '6/8' | '5/4' | '5/8' | '7/8'
export type MeterSource = 'explicit' | 'midi' | 'v1-implicit'

export interface MeterSpec {
  readonly numerator: number
  readonly denominator: MeterDenominator
  readonly beatGroups: readonly number[]
}

export interface SwingSpec {
  /** Score-tick subdivision paired by the swing map. */
  readonly subdivisionTicks: Tick
  /** 500 is straight; 667 is approximately a 2:1 first/second subdivision. */
  readonly amountPermille: number
}

export interface TransportSpec {
  readonly id: string
  readonly version: typeof TRANSPORT_VERSION
  readonly ppq: typeof TRANSPORT_PPQ
  readonly tempoBpm: number
  readonly meter: MeterSpec
  /** Canonical comparison/display grid. Source rhythm grids are provenance. */
  readonly gridTicks: Tick
  readonly loopStartTick: 0
  /** Exclusive loop boundary. */
  readonly loopEndTick: Tick
  readonly swing: SwingSpec
  readonly meterSource: MeterSource
}

export interface BarSpan {
  readonly index: number
  readonly number: number
  readonly startTick: Tick
  readonly endTick: Tick
  readonly durationTicks: Tick
  readonly isPartial: boolean
}

export interface MeterGroupSpan {
  readonly index: number
  readonly number: number
  readonly startBeatIndex: number
  readonly endBeatIndex: number
  readonly startTickInBar: Tick
  readonly endTickInBar: Tick
  readonly durationTicks: Tick
}

export interface TickSpan {
  readonly startTick: Tick
  readonly endTick: Tick
  readonly durationTicks: Tick
  readonly isClippedByLoop: boolean
}

export interface ScorePosition {
  readonly scoreTick: Tick
  readonly barIndex: number
  readonly barNumber: number
  readonly tickInBar: Tick
  /** Meter-denominator unit, zero based. */
  readonly beatIndex: number
  readonly beatNumber: number
  readonly tickInBeat: Tick
  readonly groupIndex: number
  readonly groupNumber: number
  readonly tickInGroup: Tick
  readonly subdivisionIndexInBeat: number
  readonly tickInSubdivision: Tick
  readonly isPartialBar: boolean
}

export interface WrappedLoopTick {
  readonly iteration: number
  readonly tickInLoop: Tick
  readonly isBoundary: boolean
}

export interface RationalTick {
  readonly numerator: bigint
  readonly denominator: bigint
}

export type TransportValidationIssueCode =
  | 'not-an-object'
  | 'invalid-transport-id'
  | 'transport-id-mismatch'
  | 'unexpected-field'
  | 'unsupported-version'
  | 'unsupported-ppq'
  | 'invalid-tempo'
  | 'invalid-ppq'
  | 'invalid-meter'
  | 'invalid-meter-numerator'
  | 'meter-numerator-too-large'
  | 'invalid-meter-denominator'
  | 'invalid-meter-groups'
  | 'too-many-meter-groups'
  | 'meter-group-sum'
  | 'unsafe-meter-length'
  | 'invalid-grid'
  | 'incompatible-grid'
  | 'too-many-grid-opportunities'
  | 'invalid-loop-start'
  | 'invalid-loop-end'
  | 'loop-too-long'
  | 'invalid-swing'
  | 'invalid-swing-subdivision'
  | 'incompatible-swing-subdivision'
  | 'invalid-swing-amount'
  | 'invalid-meter-source'

export interface TransportValidationIssue {
  readonly code: TransportValidationIssueCode
  readonly path: string
  readonly message: string
}

export interface CreateTransportSpecOptions {
  readonly meter: MeterPresetId | MeterSpec
  readonly loopEndTick: Tick
  readonly tempoBpm?: number
  readonly gridTicks?: Tick
  readonly swing?: SwingSpec
  readonly meterSource?: MeterSource
}
