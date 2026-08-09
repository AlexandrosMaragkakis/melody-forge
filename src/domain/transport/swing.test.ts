import { describe, expect, it } from 'vitest'

import {
  compareRationalTicks,
  createRationalTick,
  createTransportSpec,
  performedTickNumberToScoreTickNumber,
  performedTickToScoreTick,
  rationalTickFromInteger,
  rationalTicksEqual,
  scoreTickToPerformedTick,
  scoreTickToPerformedTickNumber,
  scoreTickToSeconds,
  secondsToScoreTick,
  ticksToSeconds,
} from '.'

function swungTransport(loopEndTick = 1920) {
  return createTransportSpec({
    meter: '4/4',
    loopEndTick,
    tempoBpm: 120,
    swing: { subdivisionTicks: 240, amountPermille: 667 },
  })
}

describe('exact rational swing', () => {
  it('maps the offbeat exactly and anchors every pair boundary', () => {
    const transport = swungTransport()

    expect(scoreTickToPerformedTick(transport, 240)).toEqual({
      numerator: 8004n,
      denominator: 25n,
    })
    for (const boundary of [0, 480, 960, 1440, 1920]) {
      expect(
        rationalTicksEqual(
          scoreTickToPerformedTick(transport, boundary),
          rationalTickFromInteger(boundary),
        ),
      ).toBe(true)
    }
  })

  it('round-trips every sampled score tick exactly without cumulative drift', () => {
    const transport = swungTransport()
    let previous = scoreTickToPerformedTick(transport, 0)

    for (let scoreTick = 0; scoreTick <= 1920; scoreTick += 17) {
      const performed = scoreTickToPerformedTick(transport, scoreTick)
      const restored = performedTickToScoreTick(transport, performed)
      expect(
        rationalTicksEqual(restored, rationalTickFromInteger(scoreTick)),
      ).toBe(true)
      expect(compareRationalTicks(performed, previous)).toBeGreaterThanOrEqual(
        0,
      )
      previous = performed
    }

    expect(
      performedTickToScoreTick(
        transport,
        scoreTickToPerformedTick(transport, 1920),
      ),
    ).toEqual(rationalTickFromInteger(1920))
  })

  it('leaves an incomplete pair tail straight to preserve the loop endpoint', () => {
    const transport = swungTransport(600)

    expect(scoreTickToPerformedTick(transport, 240)).toEqual({
      numerator: 8004n,
      denominator: 25n,
    })
    expect(scoreTickToPerformedTick(transport, 480)).toEqual(
      rationalTickFromInteger(480),
    )
    expect(scoreTickToPerformedTick(transport, 540)).toEqual(
      rationalTickFromInteger(540),
    )
    expect(scoreTickToPerformedTick(transport, 600)).toEqual(
      rationalTickFromInteger(600),
    )
  })

  it('is identity at straight swing and rejects invalid performed ticks', () => {
    const straight = createTransportSpec({
      meter: '5/8',
      loopEndTick: 1200,
      swing: { subdivisionTicks: 120, amountPermille: 500 },
    })

    for (const tick of [0, 1, 120, 599, 1200]) {
      expect(scoreTickToPerformedTick(straight, tick)).toEqual(
        rationalTickFromInteger(tick),
      )
    }
    expect(() =>
      performedTickToScoreTick(straight, createRationalTick(1n, 0n)),
    ).toThrow(/denominator/)
    expect(() =>
      performedTickToScoreTick(straight, createRationalTick(1201n)),
    ).toThrow(/must be in/)
  })
})

describe('audio/playhead numeric boundaries', () => {
  it('converts exact ticks to seconds with optional swing', () => {
    const transport = swungTransport()
    const performedTick = scoreTickToPerformedTick(transport, 240)

    expect(ticksToSeconds(480, 120)).toBe(0.5)
    expect(ticksToSeconds(performedTick, 120)).toBeCloseTo(0.3335, 12)
    expect(scoreTickToSeconds(transport, 240)).toBeCloseTo(0.3335, 12)
    expect(
      scoreTickToSeconds(transport, 240, { applySwing: false }),
    ).toBe(0.25)
  })

  it('uses the numeric inverse only at the clock boundary', () => {
    const transport = swungTransport()
    for (const tick of [0, 120, 240, 360, 480, 719, 960, 1919, 1920]) {
      const performed = scoreTickToPerformedTickNumber(transport, tick)
      expect(
        performedTickNumberToScoreTickNumber(transport, performed),
      ).toBeCloseTo(tick, 10)

      const seconds = scoreTickToSeconds(transport, tick)
      expect(secondsToScoreTick(transport, seconds)).toBeCloseTo(tick, 10)
    }
  })

  it('clamps only representational endpoint error at decimal tempos', () => {
    const transport = createTransportSpec({
      meter: '4/4',
      loopEndTick: 1_920 * 256,
      tempoBpm: 30.002,
    })
    const endpointSeconds = scoreTickToSeconds(
      transport,
      transport.loopEndTick,
    )

    expect(secondsToScoreTick(transport, endpointSeconds)).toBe(
      transport.loopEndTick,
    )
    expect(
      secondsToScoreTick(transport, endpointSeconds, { applySwing: false }),
    ).toBe(transport.loopEndTick)
    expect(
      performedTickNumberToScoreTickNumber(
        transport,
        transport.loopEndTick + 5e-8,
      ),
    ).toBe(transport.loopEndTick)
    expect(
      performedTickNumberToScoreTickNumber(
        transport,
        transport.loopEndTick - 5e-8,
      ),
    ).toBe(transport.loopEndTick)
    expect(
      performedTickNumberToScoreTickNumber(transport, -5e-8),
    ).toBe(0)
    expect(() =>
      performedTickNumberToScoreTickNumber(
        transport,
        transport.loopEndTick + 2e-7,
      ),
    ).toThrow(/finite and in/)
    expect(() =>
      secondsToScoreTick(transport, endpointSeconds + 1e-8),
    ).toThrow(/beyond/)
  })

  it('rejects invalid time boundaries with actionable messages', () => {
    const transport = swungTransport()
    expect(() => ticksToSeconds(-1, 120)).toThrow(/non-negative/)
    expect(() => ticksToSeconds(1, 0)).toThrow(/positive finite/)
    expect(() => scoreTickToPerformedTick(transport, 1921)).toThrow(
      /safe integer in/,
    )
    expect(() =>
      scoreTickToSeconds(transport, 1921, { applySwing: false }),
    ).toThrow(/closed loop/)
    expect(() =>
      secondsToScoreTick(transport, 3, { applySwing: false }),
    ).toThrow(/beyond/)
    expect(() =>
      performedTickNumberToScoreTickNumber(transport, Number.NaN),
    ).toThrow(/finite/)
  })
})
