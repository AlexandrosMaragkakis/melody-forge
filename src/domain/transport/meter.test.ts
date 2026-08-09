import { describe, expect, it } from 'vitest'

import {
  createTransportSpec,
  getBarSpans,
  getBeatSpan,
  getGroupSpan,
  getMeterGroupSpans,
  getScorePosition,
  getSubdivisionSpan,
  isBarBoundary,
  isLoopBoundary,
  isTickInLoop,
  wrapLoopTick,
} from '.'

describe('bar, beat, group, and subdivision math', () => {
  it('partitions an exact loop into full and partial bars without data loss', () => {
    const fiveBeatLegacy = createTransportSpec({
      meter: '4/4',
      loopEndTick: 5 * 480,
      meterSource: 'v1-implicit',
    })

    expect(getBarSpans(fiveBeatLegacy)).toEqual([
      {
        index: 0,
        number: 1,
        startTick: 0,
        endTick: 1920,
        durationTicks: 1920,
        isPartial: false,
      },
      {
        index: 1,
        number: 2,
        startTick: 1920,
        endTick: 2400,
        durationTicks: 480,
        isPartial: true,
      },
    ])
    expect(
      getBarSpans(fiveBeatLegacy).reduce(
        (sum, span) => sum + span.durationTicks,
        0,
      ),
    ).toBe(fiveBeatLegacy.loopEndTick)
  })

  it('computes odd-meter group spans and a complete current position', () => {
    const transport = createTransportSpec({
      meter: '7/8',
      loopEndTick: 1680,
      swing: { subdivisionTicks: 120, amountPermille: 500 },
    })

    expect(getMeterGroupSpans(transport.meter)).toEqual([
      {
        index: 0,
        number: 1,
        startBeatIndex: 0,
        endBeatIndex: 2,
        startTickInBar: 0,
        endTickInBar: 480,
        durationTicks: 480,
      },
      {
        index: 1,
        number: 2,
        startBeatIndex: 2,
        endBeatIndex: 4,
        startTickInBar: 480,
        endTickInBar: 960,
        durationTicks: 480,
      },
      {
        index: 2,
        number: 3,
        startBeatIndex: 4,
        endBeatIndex: 7,
        startTickInBar: 960,
        endTickInBar: 1680,
        durationTicks: 720,
      },
    ])

    expect(getScorePosition(transport, 1080)).toEqual({
      scoreTick: 1080,
      barIndex: 0,
      barNumber: 1,
      tickInBar: 1080,
      beatIndex: 4,
      beatNumber: 5,
      tickInBeat: 120,
      groupIndex: 2,
      groupNumber: 3,
      tickInGroup: 120,
      subdivisionIndexInBeat: 1,
      tickInSubdivision: 0,
      isPartialBar: false,
    })
  })

  it('uses the shared display grid independently of swing subdivision', () => {
    const transport = createTransportSpec({
      meter: '4/4',
      loopEndTick: 1920,
      gridTicks: 120,
      swing: { subdivisionTicks: 240, amountPermille: 667 },
    })

    expect(getScorePosition(transport, 360)).toMatchObject({
      subdivisionIndexInBeat: 3,
      tickInSubdivision: 0,
    })
    expect(getSubdivisionSpan(transport, 0, 0, 3)).toEqual({
      startTick: 360,
      endTick: 480,
      durationTicks: 120,
      isClippedByLoop: false,
    })
  })

  it('marks positions and spans clipped by a partial final bar', () => {
    const transport = createTransportSpec({
      meter: '4/4',
      loopEndTick: 2160,
    })

    expect(getScorePosition(transport, 2000)).toMatchObject({
      barIndex: 1,
      barNumber: 2,
      beatIndex: 0,
      beatNumber: 1,
      isPartialBar: true,
    })
    expect(getBeatSpan(transport, 1, 0)).toEqual({
      startTick: 1920,
      endTick: 2160,
      durationTicks: 240,
      isClippedByLoop: true,
    })
    expect(getBeatSpan(transport, 1, 1)).toBeNull()
    expect(getSubdivisionSpan(transport, 1, 0, 0)).toEqual({
      startTick: 1920,
      endTick: 2160,
      durationTicks: 240,
      isClippedByLoop: false,
    })
    expect(getSubdivisionSpan(transport, 1, 0, 1)).toBeNull()
    expect(getGroupSpan(transport, 1, 0)).toEqual({
      startTick: 1920,
      endTick: 2160,
      durationTicks: 240,
      isClippedByLoop: true,
    })
    expect(getGroupSpan(transport, 1, 1)).toBeNull()
  })
})

describe('loop positions and boundaries', () => {
  const transport = createTransportSpec({
    meter: '4/4',
    loopEndTick: 2400,
  })

  it('uses a half-open local loop and distinguishes bar/loop boundaries', () => {
    expect(isTickInLoop(transport, 0)).toBe(true)
    expect(isTickInLoop(transport, 2399)).toBe(true)
    expect(isTickInLoop(transport, 2400)).toBe(false)
    expect(isTickInLoop(transport, 0.5)).toBe(false)

    expect(isLoopBoundary(transport, -2400)).toBe(true)
    expect(isLoopBoundary(transport, 0)).toBe(true)
    expect(isLoopBoundary(transport, 2400)).toBe(true)
    expect(isLoopBoundary(transport, 4800)).toBe(true)
    expect(isLoopBoundary(transport, 1920)).toBe(false)

    expect(isBarBoundary(transport, 0)).toBe(true)
    expect(isBarBoundary(transport, 1920)).toBe(true)
    expect(isBarBoundary(transport, 2400)).toBe(false)
  })

  it('wraps positive and negative absolute ticks deterministically', () => {
    expect(wrapLoopTick(transport, 0)).toEqual({
      iteration: 0,
      tickInLoop: 0,
      isBoundary: true,
    })
    expect(wrapLoopTick(transport, 2400)).toEqual({
      iteration: 1,
      tickInLoop: 0,
      isBoundary: true,
    })
    expect(wrapLoopTick(transport, 2501)).toEqual({
      iteration: 1,
      tickInLoop: 101,
      isBoundary: false,
    })
    expect(wrapLoopTick(transport, -1)).toEqual({
      iteration: -1,
      tickInLoop: 2399,
      isBoundary: false,
    })
    expect(() => wrapLoopTick(transport, Number.NaN)).toThrow(/safe integer/)
    expect(() => getScorePosition(transport, 2400)).toThrow(
      /inside \[0, 2400\)/,
    )
  })
})
