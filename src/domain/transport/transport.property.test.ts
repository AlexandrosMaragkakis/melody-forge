import { describe, expect, it } from 'vitest'

import { randomInt, randomItem } from '../random'
import { createSeedTree } from '../seedTree'
import {
  METER_PRESET_IDS,
  createTransportSpec,
  getBarLengthTicks,
  getBarSpans,
  getMeterPreset,
  getMeterUnitTicks,
  getScorePosition,
  performedTickToScoreTick,
  rationalTickFromInteger,
  rationalTicksEqual,
  scoreTickToPerformedTick,
  validateTransportSpec,
  wrapLoopTick,
} from '.'

const PROPERTY_SUITE_ID = 'property/transport-meter-swing/v2'
const CASE_COUNT = 1_000

describe('transport properties', () => {
  it(`replays ${String(CASE_COUNT)} deterministic meter/partial/swing cases`, () => {
    const random = createSeedTree(PROPERTY_SUITE_ID).random()

    for (let caseIndex = 0; caseIndex < CASE_COUNT; caseIndex += 1) {
      const meter = randomItem(random, METER_PRESET_IDS)
      const meterSpec = getMeterPreset(meter)
      const meterUnitTicks = getMeterUnitTicks(meterSpec)
      const barTicks = getBarLengthTicks(meterSpec)
      const gridDivisor = randomItem(random, [1, 2, 4])
      const swingDivisor = randomItem(random, [2, 4])
      const fullBars = randomInt(random, 0, 6)
      const partialTicks = randomInt(random, 1, barTicks)
      const loopEndTick = fullBars * barTicks + partialTicks
      const transport = createTransportSpec({
        meter,
        loopEndTick,
        tempoBpm: randomInt(random, 30, 300),
        gridTicks: meterUnitTicks / gridDivisor,
        swing: {
          subdivisionTicks: meterUnitTicks / swingDivisor,
          amountPermille: randomInt(random, 500, 750),
        },
      })

      expect(
        validateTransportSpec(transport),
        `${PROPERTY_SUITE_ID} case ${String(caseIndex)}`,
      ).toEqual([])

      const spans = getBarSpans(transport)
      expect(spans[0]?.startTick).toBe(0)
      expect(spans.at(-1)?.endTick).toBe(loopEndTick)
      expect(
        spans.reduce((sum, span) => sum + span.durationTicks, 0),
      ).toBe(loopEndTick)
      spans.forEach((span, index) => {
        expect(span.startTick).toBe(index === 0 ? 0 : spans[index - 1]?.endTick)
        expect(span.durationTicks).toBeGreaterThan(0)
      })

      const scoreTick = randomInt(random, 0, loopEndTick)
      const performed = scoreTickToPerformedTick(transport, scoreTick)
      expect(
        rationalTicksEqual(
          performedTickToScoreTick(transport, performed),
          rationalTickFromInteger(scoreTick),
        ),
        `${PROPERTY_SUITE_ID} case ${String(caseIndex)} tick ${String(scoreTick)}`,
      ).toBe(true)
      expect(
        rationalTicksEqual(
          scoreTickToPerformedTick(transport, loopEndTick),
          rationalTickFromInteger(loopEndTick),
        ),
      ).toBe(true)

      if (scoreTick < loopEndTick) {
        const position = getScorePosition(transport, scoreTick)
        expect(position.scoreTick).toBe(scoreTick)
        expect(position.tickInBar).toBeGreaterThanOrEqual(0)
        expect(position.tickInBeat).toBeGreaterThanOrEqual(0)
        expect(position.tickInSubdivision).toBeGreaterThanOrEqual(0)
      }

      const loopCount = randomInt(random, 0, 1_024)
      expect(wrapLoopTick(transport, loopCount * loopEndTick)).toEqual({
        iteration: loopCount,
        tickInLoop: 0,
        isBoundary: true,
      })
      expect(wrapLoopTick(transport, 1_024 * loopEndTick)).toEqual({
        iteration: 1_024,
        tickInLoop: 0,
        isBoundary: true,
      })
    }
  })
})
