import { describe, expect, it } from 'vitest'

import {
  METER_PRESET_IDS,
  MAX_METER_GROUPS,
  MAX_METER_NUMERATOR,
  MAX_TRANSPORT_BAR_SPANS,
  MAX_TRANSPORT_GRID_OPPORTUNITIES,
  TRANSPORT_PPQ,
  TRANSPORT_VERSION,
  TransportValidationError,
  assertValidTransportSpec,
  createTransportSpec,
  getBarLengthTicks,
  getMeterPreset,
  getMeterUnitTicks,
  getSubdivisionsPerMeterUnit,
  validateTransportSpec,
  validateMeterSpec,
} from '.'

describe('transport meter presets', () => {
  it('owns all required meters with exact 480 PPQ lengths and groupings', () => {
    const expected = {
      '4/4': { unit: 480, bar: 1920, groups: [2, 2] },
      '3/4': { unit: 480, bar: 1440, groups: [3] },
      '6/8': { unit: 240, bar: 1440, groups: [3, 3] },
      '5/4': { unit: 480, bar: 2400, groups: [3, 2] },
      '5/8': { unit: 240, bar: 1200, groups: [2, 3] },
      '7/8': { unit: 240, bar: 1680, groups: [2, 2, 3] },
    } as const

    expect(METER_PRESET_IDS).toEqual(Object.keys(expected))
    for (const id of METER_PRESET_IDS) {
      const meter = getMeterPreset(id)
      expect(getMeterUnitTicks(meter)).toBe(expected[id].unit)
      expect(getBarLengthTicks(meter)).toBe(expected[id].bar)
      expect(meter.beatGroups).toEqual(expected[id].groups)
      expect(
        meter.beatGroups.reduce((sum, length) => sum + length, 0),
      ).toBe(meter.numerator)

      const transport = createTransportSpec({
        meter: id,
        loopEndTick: expected[id].bar,
      })
      expect(
        expected[id].unit % (transport.swing.subdivisionTicks * 2),
      ).toBe(0)
      expect(expected[id].unit % transport.gridTicks).toBe(0)
    }
  })

  it('creates validated immutable-shape transport data with safe defaults', () => {
    const defaultFourFour = createTransportSpec({
      meter: '4/4',
      loopEndTick: 1_920,
    })
    expect(defaultFourFour).toEqual({
      id: defaultFourFour.id,
      version: 'transport-v2',
      ppq: 480,
      tempoBpm: 108,
      meter: { numerator: 4, denominator: 4, beatGroups: [2, 2] },
      gridTicks: 240,
      loopStartTick: 0,
      loopEndTick: 1_920,
      swing: { subdivisionTicks: 240, amountPermille: 500 },
      meterSource: 'explicit',
    })

    const transport = createTransportSpec({
      meter: '7/8',
      loopEndTick: 1680,
    })

    expect(transport).toEqual({
      id: transport.id,
      version: TRANSPORT_VERSION,
      ppq: TRANSPORT_PPQ,
      tempoBpm: 108,
      meter: {
        numerator: 7,
        denominator: 8,
        beatGroups: [2, 2, 3],
      },
      gridTicks: 120,
      loopStartTick: 0,
      loopEndTick: 1680,
      swing: { subdivisionTicks: 120, amountPermille: 500 },
      meterSource: 'explicit',
    })
    expect(getSubdivisionsPerMeterUnit(transport)).toBe(2)
    expect(transport.id).toMatch(/^transport-[0-9a-f]{16}$/u)

    const sixteenthMeter = createTransportSpec({
      meter: { numerator: 3, denominator: 16, beatGroups: [3] },
      loopEndTick: 360,
    })
    expect(sixteenthMeter.gridTicks).toBe(60)
    expect(sixteenthMeter.swing.subdivisionTicks).toBe(60)

    const fineGrid = createTransportSpec({
      meter: '4/4',
      loopEndTick: 1_920,
      gridTicks: 120,
    })
    expect(fineGrid.swing.subdivisionTicks).toBe(120)
    const coarseGrid = createTransportSpec({
      meter: '4/4',
      loopEndTick: 1_920,
      gridTicks: 480,
    })
    expect(coarseGrid.swing.subdivisionTicks).toBe(240)
  })
})

describe('transport validation', () => {
  it('reports actionable paths and issue codes for incompatible data', () => {
    const base = createTransportSpec({
      meter: '4/4',
      loopEndTick: 1920,
    })
    const issues = validateTransportSpec({
      ...base,
      version: 'transport-v3',
      ppq: 960,
      tempoBpm: 0,
      loopStartTick: 1,
      loopEndTick: 0,
      meter: {
        numerator: 5,
        denominator: 8,
        beatGroups: [2, 2],
      },
      gridTicks: 70,
      swing: {
        subdivisionTicks: 70,
        amountPermille: 900,
      },
      meterSource: 'guessed',
    })

    expect(issues.map(({ code }) => code)).toEqual([
      'unsupported-version',
      'unsupported-ppq',
      'invalid-tempo',
      'meter-group-sum',
      'incompatible-grid',
      'invalid-loop-start',
      'invalid-loop-end',
      'incompatible-swing-subdivision',
      'invalid-swing-amount',
      'invalid-meter-source',
    ])
    const groupIssue = issues.find(
      ({ code }) => code === 'meter-group-sum',
    )
    expect(groupIssue?.path).toBe('meter.beatGroups')
    expect(groupIssue?.message).toContain('sum to numerator 5')
  })

  it('rejects malformed meters, unsafe values, and unsupported PPQ', () => {
    const base = createTransportSpec({
      meter: '4/4',
      loopEndTick: 1920,
    })

    expect(validateTransportSpec(null)).toEqual([
      {
        code: 'not-an-object',
        path: 'transport',
        message: 'transport must be an object',
      },
    ])
    expect(
      validateTransportSpec({ ...base, meter: { numerator: 4 } }).map(
        ({ code }) => code,
      ),
    ).toEqual([
      'invalid-meter-denominator',
      'invalid-meter-groups',
    ])
    expect(
      validateTransportSpec({
        ...base,
        gridTicks: 0,
        swing: { subdivisionTicks: 0, amountPermille: 499 },
      }).map(({ code }) => code),
    ).toEqual([
      'invalid-grid',
      'invalid-swing-subdivision',
      'invalid-swing-amount',
    ])

    expect(
      validateTransportSpec({ ...base, gridTicks: 320 }).map(
        ({ code }) => code,
      ),
    ).toEqual(['incompatible-grid'])

    expect(
      validateTransportSpec({
        ...base,
        swing: { subdivisionTicks: 480, amountPermille: 500 },
      }).map(({ code }) => code),
    ).toEqual(['incompatible-swing-subdivision'])

    expect(
      validateTransportSpec({ ...base, tempoBpm: 109 }).map(
        ({ code }) => code,
      ),
    ).toEqual(['transport-id-mismatch'])
  })

  it('rejects unsafe meter PPQ, dimensions, tempo, and loop allocations', () => {
    const meter = { numerator: 4, denominator: 4, beatGroups: [2, 2] } as const
    for (const ppq of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateMeterSpec(meter, ppq).map(({ code }) => code)).toContain(
        'invalid-ppq',
      )
      expect(() => getMeterUnitTicks(meter, ppq)).toThrow(
        /ppq must be a positive safe integer/,
      )
    }

    expect(
      validateMeterSpec({
        numerator: MAX_METER_NUMERATOR + 1,
        denominator: 4,
        beatGroups: [MAX_METER_NUMERATOR + 1],
      }).map(({ code }) => code),
    ).toContain('meter-numerator-too-large')
    expect(
      validateMeterSpec({
        numerator: MAX_METER_GROUPS + 1,
        denominator: 4,
        beatGroups: Array.from(
          { length: MAX_METER_GROUPS + 1 },
          () => 1,
        ),
      }).map(({ code }) => code),
    ).toContain('too-many-meter-groups')

    expect(
      validateMeterSpec({
        numerator: 0,
        denominator: 4,
        beatGroups: [1],
      }).map(({ code }) => code),
    ).toContain('invalid-meter-numerator')
    expect(
      validateMeterSpec({
        numerator: 1,
        denominator: 1,
        beatGroups: [1],
      }),
    ).toEqual([])
    expect(
      validateMeterSpec({
        numerator: MAX_METER_NUMERATOR,
        denominator: 16,
        beatGroups: Array.from(
          { length: MAX_METER_GROUPS },
          () => 1,
        ),
      }),
    ).toEqual([])
    for (const denominator of [1, 2, 4, 8, 16] as const) {
      expect(
        validateMeterSpec({
          numerator: 1,
          denominator,
          beatGroups: [1],
        }),
      ).toEqual([])
    }
    expect(
      validateMeterSpec({
        numerator: 1,
        denominator: 3,
        beatGroups: [1],
      }).map(({ code }) => code),
    ).toContain('invalid-meter-denominator')
    for (const group of [0, -1]) {
      expect(
        validateMeterSpec({
          numerator: 1,
          denominator: 4,
          beatGroups: [group],
        }).map(({ code }) => code),
      ).toContain('invalid-meter-groups')
    }

    const base = createTransportSpec({ meter: '4/4', loopEndTick: 1_920 })
    for (const tempoBpm of [
      29.999,
      300.001,
      Number.MIN_VALUE,
      Number.MAX_VALUE,
    ]) {
      expect(
        validateTransportSpec({ ...base, tempoBpm }).map(({ code }) => code),
      ).toContain('invalid-tempo')
    }
    expect(
      validateTransportSpec({ ...base, tempoBpm: 30 }).map(({ code }) => code),
    ).toEqual(['transport-id-mismatch'])
    expect(
      validateTransportSpec({ ...base, tempoBpm: 300 }).map(({ code }) => code),
    ).toEqual(['transport-id-mismatch'])

    expect(
      validateTransportSpec({
        ...base,
        swing: { ...base.swing, amountPermille: 750 },
      }).map(({ code }) => code),
    ).toEqual(['transport-id-mismatch'])
    expect(
      validateTransportSpec({
        ...base,
        swing: { ...base.swing, amountPermille: 751 },
      }).map(({ code }) => code),
    ).toContain('invalid-swing-amount')

    const maximumLoop = createTransportSpec({
      meter: '4/4',
      loopEndTick: 1_920 * MAX_TRANSPORT_BAR_SPANS,
    })
    expect(validateTransportSpec(maximumLoop)).toEqual([])
    expect(() =>
      createTransportSpec({
        meter: '4/4',
        loopEndTick: 1_920 * MAX_TRANSPORT_BAR_SPANS + 1,
      }),
    ).toThrow(/at most 256 bars/)
    expect(
      validateTransportSpec({
        ...base,
        loopEndTick: Number.MAX_SAFE_INTEGER,
      }).map(({ code }) => code),
    ).toContain('loop-too-long')

    const maximumGrid = createTransportSpec({
      meter: '4/4',
      gridTicks: 1,
      loopEndTick: MAX_TRANSPORT_GRID_OPPORTUNITIES,
    })
    expect(validateTransportSpec(maximumGrid)).toEqual([])
    expect(() =>
      createTransportSpec({
        meter: '4/4',
        gridTicks: 1,
        loopEndTick: MAX_TRANSPORT_GRID_OPPORTUNITIES + 1,
      }),
    ).toThrow(/at most 65536 grid opportunities/)
  })

  it('reports structured constructor errors before content hashing', () => {
    const invalidOptions = [
      { meter: '4/4', loopEndTick: 1_920, tempoBpm: Number.POSITIVE_INFINITY },
      { meter: '4/4', loopEndTick: Number.NaN },
      { meter: '4/4', loopEndTick: 1_920, gridTicks: Number.POSITIVE_INFINITY },
      {
        meter: '4/4',
        loopEndTick: 1_920,
        swing: {
          subdivisionTicks: Number.POSITIVE_INFINITY,
          amountPermille: 500,
        },
      },
      { meter: null, loopEndTick: 1_920 },
      { meter: { numerator: 4 }, loopEndTick: 1_920 },
    ] as unknown as Parameters<typeof createTransportSpec>[0][]

    for (const options of invalidOptions) {
      expect(() => createTransportSpec(options)).toThrow(
        TransportValidationError,
      )
    }

    const base = createTransportSpec({ meter: '4/4', loopEndTick: 1_920 })
    const cyclic: Record<string, unknown> = { ...base }
    cyclic.unexpected = cyclic
    expect(() => validateTransportSpec(cyclic)).not.toThrow()
    expect(validateTransportSpec(cyclic).map(({ code }) => code)).toEqual([
      'unexpected-field',
    ])
    expect(
      validateTransportSpec({
        ...base,
        meter: { ...base.meter, unexpected: undefined },
      }).map(({ code }) => code),
    ).toEqual(['unexpected-field'])

    const sparseGroups = Array<number>(2)
    sparseGroups[1] = 2
    const sparseTransport = {
      ...base,
      meter: { ...base.meter, beatGroups: sparseGroups },
    }
    expect(() => validateTransportSpec(sparseTransport)).not.toThrow()
    expect(
      validateTransportSpec(sparseTransport).map(({ code }) => code),
    ).toEqual(['invalid-meter-groups'])

    expect(
      validateTransportSpec(Object.create(base)).map(({ code }) => code),
    ).toEqual(['not-an-object'])
  })

  it('throws a structured validation error from constructors and assertions', () => {
    expect(() =>
      createTransportSpec({
        meter: { numerator: 5, denominator: 8, beatGroups: [3, 3] },
        loopEndTick: 1200,
      }),
    ).toThrow(/meter\.beatGroups.*sum to numerator 5/)

    const valid = createTransportSpec({ meter: '4/4', loopEndTick: 1920 })
    try {
      assertValidTransportSpec({ ...valid, version: 'wrong' })
      throw new Error('expected transport validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(TransportValidationError)
      if (error instanceof TransportValidationError) {
        expect(error.issues[0]).toMatchObject({
          code: 'unsupported-version',
          path: 'version',
        })
        expect(error.message).toContain('version: version must be transport-v2')
      }
    }
  })
})
