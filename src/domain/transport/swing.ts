import type { Tick } from '../types'
import {
  addRationalTicks,
  compareRationalTicks,
  createRationalTick,
  divideRationalTicks,
  floorRationalTick,
  multiplyRationalTicks,
  rationalTickFromInteger,
  rationalTickToNumber,
  subtractRationalTicks,
} from './rational'
import type { RationalTick, TransportSpec } from './types'
import { assertValidTransportSpec } from './validation'

/** Numeric audio-clock boundary tolerance; exact rational transforms use none. */
export const NUMERIC_TICK_BOUNDARY_EPSILON = 1e-7

export function normalizeNumericTickToClosedLoop(
  transport: TransportSpec,
  performedTick: number,
): number {
  assertValidTransportSpec(transport)
  if (!Number.isFinite(performedTick)) {
    throw new RangeError(
      'performedTick must be finite and in [0, ' +
        String(transport.loopEndTick) +
        ']',
    )
  }
  const boundedPerformedTick =
    Math.abs(performedTick - transport.loopStartTick) <=
    NUMERIC_TICK_BOUNDARY_EPSILON
      ? transport.loopStartTick
      : Math.abs(performedTick - transport.loopEndTick) <=
          NUMERIC_TICK_BOUNDARY_EPSILON
        ? transport.loopEndTick
        : performedTick
  if (
    boundedPerformedTick < transport.loopStartTick ||
    boundedPerformedTick > transport.loopEndTick
  ) {
    throw new RangeError(
      'performedTick must be finite and in [0, ' +
        String(transport.loopEndTick) +
        ']',
    )
  }
  return boundedPerformedTick
}

function assertScoreTickInClosedLoop(
  transport: TransportSpec,
  scoreTick: Tick,
): void {
  if (
    !Number.isSafeInteger(scoreTick) ||
    scoreTick < transport.loopStartTick ||
    scoreTick > transport.loopEndTick
  ) {
    throw new RangeError(
      'scoreTick must be a safe integer in [0, ' +
        String(transport.loopEndTick) +
        ']',
    )
  }
}

function assertPerformedTickInClosedLoop(
  transport: TransportSpec,
  performedTick: RationalTick,
): void {
  const zero = rationalTickFromInteger(transport.loopStartTick)
  const end = rationalTickFromInteger(transport.loopEndTick)
  if (
    performedTick.denominator <= 0n ||
    compareRationalTicks(performedTick, zero) < 0 ||
    compareRationalTicks(performedTick, end) > 0
  ) {
    throw new RangeError(
      'performedTick must be in [0, ' +
        String(transport.loopEndTick) +
        ']',
    )
  }
}

function getSwingRegionEnd(transport: TransportSpec): number {
  const pairTicks = transport.swing.subdivisionTicks * 2
  return Math.floor(transport.loopEndTick / pairTicks) * pairTicks
}

function getFirstPerformedLength(
  transport: TransportSpec,
): RationalTick {
  const pairTicks = transport.swing.subdivisionTicks * 2
  return createRationalTick(
    BigInt(pairTicks) * BigInt(transport.swing.amountPermille),
    1000n,
  )
}

/**
 * Map a canonical integer score tick onto an exact performed-tick rational.
 *
 * Only complete subdivision pairs are swung. An incomplete loop tail remains
 * straight, which keeps the exact loop endpoint anchored and prevents drift.
 */
export function scoreTickToPerformedTick(
  transport: TransportSpec,
  scoreTick: Tick,
): RationalTick {
  assertValidTransportSpec(transport)
  assertScoreTickInClosedLoop(transport, scoreTick)

  const subdivision = transport.swing.subdivisionTicks
  const pairTicks = subdivision * 2
  const swingRegionEnd = getSwingRegionEnd(transport)
  if (
    transport.swing.amountPermille === 500 ||
    scoreTick >= swingRegionEnd
  ) {
    return rationalTickFromInteger(scoreTick)
  }

  const pairIndex = Math.floor(scoreTick / pairTicks)
  const pairStart = pairIndex * pairTicks
  const offset = scoreTick - pairStart
  const firstPerformedLength = getFirstPerformedLength(transport)
  const pairStartRational = rationalTickFromInteger(pairStart)

  if (offset <= subdivision) {
    const scaledOffset = multiplyRationalTicks(
      rationalTickFromInteger(offset),
      divideRationalTicks(
        firstPerformedLength,
        rationalTickFromInteger(subdivision),
      ),
    )
    return addRationalTicks(pairStartRational, scaledOffset)
  }

  const secondScoreOffset = offset - subdivision
  const secondPerformedLength = subtractRationalTicks(
    rationalTickFromInteger(pairTicks),
    firstPerformedLength,
  )
  const scaledSecondOffset = multiplyRationalTicks(
    rationalTickFromInteger(secondScoreOffset),
    divideRationalTicks(
      secondPerformedLength,
      rationalTickFromInteger(subdivision),
    ),
  )
  return addRationalTicks(
    addRationalTicks(pairStartRational, firstPerformedLength),
    scaledSecondOffset,
  )
}

/** Exact inverse of scoreTickToPerformedTick for rational performed ticks. */
export function performedTickToScoreTick(
  transport: TransportSpec,
  performedTick: RationalTick,
): RationalTick {
  assertValidTransportSpec(transport)
  const normalized = createRationalTick(
    performedTick.numerator,
    performedTick.denominator,
  )
  assertPerformedTickInClosedLoop(transport, normalized)

  const subdivision = transport.swing.subdivisionTicks
  const pairTicks = subdivision * 2
  const swingRegionEnd = getSwingRegionEnd(transport)
  const swingEndRational = rationalTickFromInteger(swingRegionEnd)
  if (
    transport.swing.amountPermille === 500 ||
    compareRationalTicks(normalized, swingEndRational) >= 0
  ) {
    return normalized
  }

  const pairIndexBigInt = floorRationalTick(
    divideRationalTicks(
      normalized,
      rationalTickFromInteger(pairTicks),
    ),
  )
  const pairIndex = Number(pairIndexBigInt)
  const pairStart = pairIndex * pairTicks
  const pairStartRational = rationalTickFromInteger(pairStart)
  const offset = subtractRationalTicks(normalized, pairStartRational)
  const firstPerformedLength = getFirstPerformedLength(transport)

  if (compareRationalTicks(offset, firstPerformedLength) <= 0) {
    const scoreOffset = multiplyRationalTicks(
      offset,
      divideRationalTicks(
        rationalTickFromInteger(subdivision),
        firstPerformedLength,
      ),
    )
    return addRationalTicks(pairStartRational, scoreOffset)
  }

  const secondPerformedOffset = subtractRationalTicks(
    offset,
    firstPerformedLength,
  )
  const secondPerformedLength = subtractRationalTicks(
    rationalTickFromInteger(pairTicks),
    firstPerformedLength,
  )
  const scoreOffset = addRationalTicks(
    rationalTickFromInteger(subdivision),
    multiplyRationalTicks(
      secondPerformedOffset,
      divideRationalTicks(
        rationalTickFromInteger(subdivision),
        secondPerformedLength,
      ),
    ),
  )
  return addRationalTicks(pairStartRational, scoreOffset)
}

export function scoreTickToPerformedTickNumber(
  transport: TransportSpec,
  scoreTick: Tick,
): number {
  return rationalTickToNumber(
    scoreTickToPerformedTick(transport, scoreTick),
  )
}

/**
 * Numeric inverse for an audio-clock/playhead boundary. Creative and persisted
 * timing should use performedTickToScoreTick's exact rational path.
 */
export function performedTickNumberToScoreTickNumber(
  transport: TransportSpec,
  performedTick: number,
): number {
  const boundedPerformedTick = normalizeNumericTickToClosedLoop(
    transport,
    performedTick,
  )

  const subdivision = transport.swing.subdivisionTicks
  const pairTicks = subdivision * 2
  const swingRegionEnd = getSwingRegionEnd(transport)
  if (
    transport.swing.amountPermille === 500 ||
    boundedPerformedTick >= swingRegionEnd
  ) {
    return boundedPerformedTick
  }

  const pairIndex = Math.floor(boundedPerformedTick / pairTicks)
  const pairStart = pairIndex * pairTicks
  const offset = boundedPerformedTick - pairStart
  const firstLength =
    (pairTicks * transport.swing.amountPermille) / 1000

  return offset <= firstLength
    ? pairStart + (offset * subdivision) / firstLength
    : pairStart +
        subdivision +
        ((offset - firstLength) * subdivision) /
          (pairTicks - firstLength)
}
