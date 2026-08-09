import type { Tick } from '../types'
import { rationalTickToNumber } from './rational'
import {
  normalizeNumericTickToClosedLoop,
  performedTickNumberToScoreTickNumber,
  scoreTickToPerformedTick,
} from './swing'
import {
  TRANSPORT_PPQ,
  type RationalTick,
  type TransportSpec,
} from './types'
import { assertValidTransportSpec } from './validation'

function assertTempo(tempoBpm: number): void {
  if (!Number.isFinite(tempoBpm) || tempoBpm <= 0) {
    throw new RangeError('tempoBpm must be a positive finite number')
  }
}

function assertPpq(ppq: number): void {
  if (!Number.isSafeInteger(ppq) || ppq <= 0) {
    throw new RangeError('ppq must be a positive safe integer')
  }
}

export function ticksToSeconds(
  ticks: Tick | RationalTick,
  tempoBpm: number,
  ppq = TRANSPORT_PPQ,
): number {
  assertTempo(tempoBpm)
  assertPpq(ppq)
  const tickValue =
    typeof ticks === 'number' ? ticks : rationalTickToNumber(ticks)
  if (!Number.isFinite(tickValue) || tickValue < 0) {
    throw new RangeError('ticks must be a non-negative finite value')
  }
  return (tickValue * 60) / (tempoBpm * ppq)
}

export interface ScoreTickToSecondsOptions {
  readonly applySwing?: boolean
}

export function scoreTickToSeconds(
  transport: TransportSpec,
  scoreTick: Tick,
  options: ScoreTickToSecondsOptions = {},
): number {
  assertValidTransportSpec(transport)
  if (
    !Number.isSafeInteger(scoreTick) ||
    scoreTick < transport.loopStartTick ||
    scoreTick > transport.loopEndTick
  ) {
    throw new RangeError(
      'scoreTick must be a safe integer inside the closed loop',
    )
  }
  const performedTick =
    options.applySwing === false
      ? scoreTick
      : scoreTickToPerformedTick(transport, scoreTick)
  return ticksToSeconds(
    performedTick,
    transport.tempoBpm,
    transport.ppq,
  )
}

export function secondsToPerformedTicks(
  seconds: number,
  tempoBpm: number,
  ppq = TRANSPORT_PPQ,
): number {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError('seconds must be a non-negative finite number')
  }
  assertTempo(tempoBpm)
  assertPpq(ppq)
  return (seconds * tempoBpm * ppq) / 60
}

export interface SecondsToScoreTickOptions {
  readonly applySwing?: boolean
}

export function secondsToScoreTick(
  transport: TransportSpec,
  seconds: number,
  options: SecondsToScoreTickOptions = {},
): number {
  assertValidTransportSpec(transport)
  const performedTick = secondsToPerformedTicks(
    seconds,
    transport.tempoBpm,
    transport.ppq,
  )
  try {
    const boundedPerformedTick = normalizeNumericTickToClosedLoop(
      transport,
      performedTick,
    )
    return options.applySwing === false
      ? boundedPerformedTick
      : performedTickNumberToScoreTickNumber(
          transport,
          boundedPerformedTick,
        )
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RangeError('seconds resolve beyond the transport loop', {
        cause: error,
      })
    }
    throw error
  }
}
