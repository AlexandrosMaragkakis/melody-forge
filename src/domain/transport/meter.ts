import type { Tick } from '../types'
import {
  type BarSpan,
  type MeterGroupSpan,
  type MeterSpec,
  type ScorePosition,
  type TickSpan,
  type TransportSpec,
  type WrappedLoopTick,
} from './types'
import {
  assertValidTransportSpec,
  TransportValidationError,
  validateMeterSpec,
} from './validation'

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(label + ' must be a safe integer tick')
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  assertSafeInteger(value, label)
  if (value < 0) {
    throw new RangeError(label + ' must be non-negative')
  }
}

function assertMeter(meter: MeterSpec, ppq: number): void {
  const issues = validateMeterSpec(meter, ppq)
  if (issues.length > 0) {
    throw new TransportValidationError(issues)
  }
}

export function getMeterUnitTicks(
  meter: MeterSpec,
  ppq = 480,
): Tick {
  assertMeter(meter, ppq)
  return (ppq * 4) / meter.denominator
}

export function getBarLengthTicks(
  meter: MeterSpec,
  ppq = 480,
): Tick {
  return getMeterUnitTicks(meter, ppq) * meter.numerator
}

export function getSubdivisionsPerMeterUnit(
  transport: TransportSpec,
): number {
  assertValidTransportSpec(transport)
  return (
    getMeterUnitTicks(transport.meter, transport.ppq) /
    transport.gridTicks
  )
}

export function getMeterGroupSpans(
  meter: MeterSpec,
  ppq = 480,
): readonly MeterGroupSpan[] {
  const meterUnitTicks = getMeterUnitTicks(meter, ppq)
  let startBeatIndex = 0

  return meter.beatGroups.map((groupLength, index) => {
    const endBeatIndex = startBeatIndex + groupLength
    const startTickInBar = startBeatIndex * meterUnitTicks
    const endTickInBar = endBeatIndex * meterUnitTicks
    const span: MeterGroupSpan = {
      index,
      number: index + 1,
      startBeatIndex,
      endBeatIndex,
      startTickInBar,
      endTickInBar,
      durationTicks: endTickInBar - startTickInBar,
    }
    startBeatIndex = endBeatIndex
    return span
  })
}

export function getBarSpans(
  transport: TransportSpec,
): readonly BarSpan[] {
  assertValidTransportSpec(transport)
  const barLengthTicks = getBarLengthTicks(transport.meter, transport.ppq)
  const spans: BarSpan[] = []
  let startTick: Tick = transport.loopStartTick
  let index = 0

  while (startTick < transport.loopEndTick) {
    const durationTicks = Math.min(
      barLengthTicks,
      transport.loopEndTick - startTick,
    )
    const endTick = startTick + durationTicks
    spans.push({
      index,
      number: index + 1,
      startTick,
      endTick,
      durationTicks,
      isPartial: durationTicks < barLengthTicks,
    })
    startTick = endTick
    index += 1
  }

  return spans
}

export function isTickInLoop(
  transport: TransportSpec,
  scoreTick: Tick,
): boolean {
  assertValidTransportSpec(transport)
  return (
    Number.isSafeInteger(scoreTick) &&
    scoreTick >= transport.loopStartTick &&
    scoreTick < transport.loopEndTick
  )
}

export function isLoopBoundary(
  transport: TransportSpec,
  absoluteTick: Tick,
): boolean {
  assertValidTransportSpec(transport)
  if (!Number.isSafeInteger(absoluteTick)) {
    return false
  }
  return absoluteTick % transport.loopEndTick === 0
}

export function isBarBoundary(
  transport: TransportSpec,
  scoreTick: Tick,
): boolean {
  assertValidTransportSpec(transport)
  if (
    !Number.isSafeInteger(scoreTick) ||
    scoreTick < transport.loopStartTick ||
    scoreTick > transport.loopEndTick
  ) {
    return false
  }
  const barLengthTicks = getBarLengthTicks(transport.meter, transport.ppq)
  return scoreTick % barLengthTicks === 0
}

export function wrapLoopTick(
  transport: TransportSpec,
  absoluteTick: Tick,
): WrappedLoopTick {
  assertValidTransportSpec(transport)
  assertSafeInteger(absoluteTick, 'absoluteTick')
  const loopLength = transport.loopEndTick
  const iteration = Math.floor(absoluteTick / loopLength)
  const tickInLoop =
    ((absoluteTick % loopLength) + loopLength) % loopLength

  return {
    iteration,
    tickInLoop,
    isBoundary: tickInLoop === 0,
  }
}

export function getBeatSpan(
  transport: TransportSpec,
  barIndex: number,
  beatIndex: number,
): TickSpan | null {
  assertValidTransportSpec(transport)
  assertNonNegativeInteger(barIndex, 'barIndex')
  assertNonNegativeInteger(beatIndex, 'beatIndex')
  if (beatIndex >= transport.meter.numerator) {
    throw new RangeError(
      'beatIndex must be less than meter numerator ' +
        String(transport.meter.numerator),
    )
  }

  const barLength = getBarLengthTicks(transport.meter, transport.ppq)
  const meterUnit = getMeterUnitTicks(transport.meter, transport.ppq)
  const startTick = barIndex * barLength + beatIndex * meterUnit
  if (!Number.isSafeInteger(startTick)) {
    throw new RangeError('beat span start exceeds safe integer timing')
  }
  if (startTick >= transport.loopEndTick) {
    return null
  }
  const availableTicks = transport.loopEndTick - startTick
  const durationTicks = Math.min(meterUnit, availableTicks)
  const endTick = startTick + durationTicks
  return {
    startTick,
    endTick,
    durationTicks,
    isClippedByLoop: availableTicks < meterUnit,
  }
}

export function getSubdivisionSpan(
  transport: TransportSpec,
  barIndex: number,
  beatIndex: number,
  subdivisionIndex: number,
): TickSpan | null {
  assertValidTransportSpec(transport)
  assertNonNegativeInteger(subdivisionIndex, 'subdivisionIndex')
  const subdivisionsPerMeterUnit =
    getSubdivisionsPerMeterUnit(transport)
  if (subdivisionIndex >= subdivisionsPerMeterUnit) {
    throw new RangeError(
      'subdivisionIndex must be less than subdivision count ' +
        String(subdivisionsPerMeterUnit),
    )
  }

  const beat = getBeatSpan(transport, barIndex, beatIndex)
  if (beat === null) {
    return null
  }
  const subdivisionTicks = transport.gridTicks
  const startTick =
    beat.startTick + subdivisionIndex * subdivisionTicks
  if (startTick >= transport.loopEndTick) {
    return null
  }
  const availableTicks = transport.loopEndTick - startTick
  const durationTicks = Math.min(subdivisionTicks, availableTicks)
  return {
    startTick,
    endTick: startTick + durationTicks,
    durationTicks,
    isClippedByLoop: availableTicks < subdivisionTicks,
  }
}

export function getGroupSpan(
  transport: TransportSpec,
  barIndex: number,
  groupIndex: number,
): TickSpan | null {
  assertValidTransportSpec(transport)
  assertNonNegativeInteger(barIndex, 'barIndex')
  assertNonNegativeInteger(groupIndex, 'groupIndex')
  const groups = getMeterGroupSpans(transport.meter, transport.ppq)
  const group = groups[groupIndex]
  if (group === undefined) {
    throw new RangeError(
      'groupIndex must be less than group count ' + String(groups.length),
    )
  }

  const barLength = getBarLengthTicks(transport.meter, transport.ppq)
  const barStart = barIndex * barLength
  const startTick = barStart + group.startTickInBar
  if (!Number.isSafeInteger(startTick)) {
    throw new RangeError('group span start exceeds safe integer timing')
  }
  if (startTick >= transport.loopEndTick) {
    return null
  }
  const groupDuration = group.durationTicks
  const availableTicks = transport.loopEndTick - startTick
  const durationTicks = Math.min(groupDuration, availableTicks)
  const endTick = startTick + durationTicks
  return {
    startTick,
    endTick,
    durationTicks,
    isClippedByLoop: availableTicks < groupDuration,
  }
}

export function getScorePosition(
  transport: TransportSpec,
  scoreTick: Tick,
): ScorePosition {
  assertValidTransportSpec(transport)
  assertNonNegativeInteger(scoreTick, 'scoreTick')
  if (!isTickInLoop(transport, scoreTick)) {
    throw new RangeError(
      'scoreTick must be inside [0, ' +
        String(transport.loopEndTick) +
        ')',
    )
  }

  const barLength = getBarLengthTicks(transport.meter, transport.ppq)
  const meterUnit = getMeterUnitTicks(transport.meter, transport.ppq)
  const barIndex = Math.floor(scoreTick / barLength)
  const barStart = barIndex * barLength
  const tickInBar = scoreTick - barStart
  const beatIndex = Math.floor(tickInBar / meterUnit)
  const tickInBeat = tickInBar - beatIndex * meterUnit
  const groups = getMeterGroupSpans(transport.meter, transport.ppq)
  const group = groups.find(
    ({ startBeatIndex, endBeatIndex }) =>
      beatIndex >= startBeatIndex && beatIndex < endBeatIndex,
  )
  if (group === undefined) {
    throw new RangeError('scoreTick does not resolve to a meter group')
  }

  const barEnd = Math.min(barStart + barLength, transport.loopEndTick)
  const subdivision = transport.gridTicks

  return {
    scoreTick,
    barIndex,
    barNumber: barIndex + 1,
    tickInBar,
    beatIndex,
    beatNumber: beatIndex + 1,
    tickInBeat,
    groupIndex: group.index,
    groupNumber: group.number,
    tickInGroup: tickInBar - group.startTickInBar,
    subdivisionIndexInBeat: Math.floor(tickInBeat / subdivision),
    tickInSubdivision: tickInBeat % subdivision,
    isPartialBar: barEnd - barStart < barLength,
  }
}
