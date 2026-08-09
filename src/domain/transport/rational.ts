import type { RationalTick } from './types'

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value
}

function greatestCommonDivisor(first: bigint, second: bigint): bigint {
  let left = absolute(first)
  let right = absolute(second)
  while (right !== 0n) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

export function createRationalTick(
  numerator: bigint,
  denominator: bigint = 1n,
): RationalTick {
  if (denominator === 0n) {
    throw new RangeError('Rational tick denominator must not be zero')
  }
  const sign = denominator < 0n ? -1n : 1n
  const signedNumerator = numerator * sign
  const positiveDenominator = denominator * sign
  const divisor = greatestCommonDivisor(
    signedNumerator,
    positiveDenominator,
  )
  return {
    numerator: signedNumerator / divisor,
    denominator: positiveDenominator / divisor,
  }
}

export function rationalTickFromInteger(value: number): RationalTick {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('Rational tick input must be a safe integer')
  }
  return createRationalTick(BigInt(value))
}

export function addRationalTicks(
  first: RationalTick,
  second: RationalTick,
): RationalTick {
  return createRationalTick(
    first.numerator * second.denominator +
      second.numerator * first.denominator,
    first.denominator * second.denominator,
  )
}

export function subtractRationalTicks(
  first: RationalTick,
  second: RationalTick,
): RationalTick {
  return createRationalTick(
    first.numerator * second.denominator -
      second.numerator * first.denominator,
    first.denominator * second.denominator,
  )
}

export function multiplyRationalTicks(
  first: RationalTick,
  second: RationalTick,
): RationalTick {
  return createRationalTick(
    first.numerator * second.numerator,
    first.denominator * second.denominator,
  )
}

export function divideRationalTicks(
  dividend: RationalTick,
  divisor: RationalTick,
): RationalTick {
  if (divisor.numerator === 0n) {
    throw new RangeError('Cannot divide a rational tick by zero')
  }
  return createRationalTick(
    dividend.numerator * divisor.denominator,
    dividend.denominator * divisor.numerator,
  )
}

export function compareRationalTicks(
  first: RationalTick,
  second: RationalTick,
): -1 | 0 | 1 {
  const difference =
    first.numerator * second.denominator -
    second.numerator * first.denominator
  return difference < 0n ? -1 : difference > 0n ? 1 : 0
}

export function floorRationalTick(value: RationalTick): bigint {
  const quotient = value.numerator / value.denominator
  const remainder = value.numerator % value.denominator
  return remainder < 0n ? quotient - 1n : quotient
}

export function rationalTickToNumber(value: RationalTick): number {
  return Number(value.numerator) / Number(value.denominator)
}

export function rationalTicksEqual(
  first: RationalTick,
  second: RationalTick,
): boolean {
  return compareRationalTicks(first, second) === 0
}
