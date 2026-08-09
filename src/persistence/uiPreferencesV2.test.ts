import {
  DEFAULT_UI_PREFERENCES_V2,
  UI_PREFERENCE_REGISTRY_V2,
  UI_PREFERENCES_LIMITS_V2,
  UI_PREFERENCES_STORAGE_KEY_V2,
  createDefaultUiPreferencesV2,
  decodeUiPreferencesV2,
  decodeUiPreferencesWithRegistryV2,
  encodeUiPreferencesV2,
  loadUiPreferencesV2,
  normalizeUiPreferencesV2,
  saveUiPreferencesV2,
  type UiPreferenceRegistryV2,
  type UiPreferencesRecordV2,
} from './uiPreferencesV2'

const CANONICAL_DEFAULT =
  '{"version":"ui-preferences-v2","values":{"visualDensity":"comfortable","reducedMotionOverride":"system","views":{"library":"grid","map":"visual","pareto":"visual"},"panelSizes":{"controlsWidthPx":244,"inspectorWidthPx":312},"disclosures":{"transportMore":false,"sound":false,"beatAdvanced":false,"createAdvanced":false,"mutationAdvanced":false,"tonalAdvanced":false,"history":false,"technical":false}}}'

function completePreferences(): UiPreferencesRecordV2 {
  return {
    version: 'ui-preferences-v2',
    values: {
      visualDensity: 'compact',
      reducedMotionOverride: 'reduce',
      views: { library: 'list', map: 'table', pareto: 'table' },
      panelSizes: { controlsWidthPx: 216, inspectorWidthPx: 336 },
      disclosures: {
        transportMore: true,
        sound: true,
        beatAdvanced: true,
        createAdvanced: true,
        mutationAdvanced: true,
        tonalAdvanced: true,
        history: true,
        technical: true,
      },
    },
  }
}

function syntheticRegistry(
  pathCount: number,
  defaultValue: string | number | boolean | null = false,
): UiPreferenceRegistryV2 {
  return {
    version: 'synthetic-v2',
    leaves: Array.from({ length: pathCount }, (_, index) => ({
      path: [`p${String(index)}`],
      defaultValue,
      validate: (value: unknown) => typeof value === typeof defaultValue,
    })),
  }
}

describe('schema-2 UI preference registry', () => {
  it('freezes the exact 15-leaf defaults and canonical bytes', () => {
    expect(UI_PREFERENCE_REGISTRY_V2.leaves).toHaveLength(15)
    expect(DEFAULT_UI_PREFERENCES_V2).toEqual(createDefaultUiPreferencesV2())
    expect(encodeUiPreferencesV2(DEFAULT_UI_PREFERENCES_V2)).toBe(
      CANONICAL_DEFAULT,
    )
    expect(CANONICAL_DEFAULT.startsWith('\ufeff')).toBe(false)
    expect(CANONICAL_DEFAULT.endsWith('\n')).toBe(false)
    expect(Object.isFrozen(DEFAULT_UI_PREFERENCES_V2)).toBe(true)
    expect(Object.isFrozen(DEFAULT_UI_PREFERENCES_V2.values.disclosures)).toBe(
      true,
    )
  })

  it('accepts every alternative and preserves panel-width boundaries', () => {
    const preferences = completePreferences()
    const encoded = encodeUiPreferencesV2(preferences)

    expect(decodeUiPreferencesV2(encoded)).toEqual({
      ok: true,
      value: preferences,
    })
    expect(encoded).toContain(
      '"panelSizes":{"controlsWidthPx":216,"inspectorWidthPx":336}',
    )

    const oppositeBoundaries = {
      ...preferences,
      values: {
        ...preferences.values,
        panelSizes: { controlsWidthPx: 264, inspectorWidthPx: 288 },
      },
    }
    expect(decodeUiPreferencesV2(encodeUiPreferencesV2(oppositeBoundaries))).toEqual(
      { ok: true, value: oppositeBoundaries },
    )
  })

  it('merges every missing registered leaf from defaults in declared order', () => {
    const decoded = decodeUiPreferencesV2(
      '{"values":{"views":{"library":"list"},"disclosures":{"sound":true}},"version":"ui-preferences-v2"}',
    )

    expect(decoded).toEqual({
      ok: true,
      value: {
        ...createDefaultUiPreferencesV2(),
        values: {
          ...createDefaultUiPreferencesV2().values,
          views: { library: 'list', map: 'visual', pareto: 'visual' },
          disclosures: {
            ...createDefaultUiPreferencesV2().values.disclosures,
            sound: true,
          },
        },
      },
    })
    if (decoded.ok) {
      expect(encodeUiPreferencesV2(decoded.value)).toBe(
        CANONICAL_DEFAULT.replace('"library":"grid"', '"library":"list"').replace(
          '"sound":false',
          '"sound":true',
        ),
      )
    }
  })

  it.each([
    ['unsupported version', { version: 'ui-preferences-v3', values: {} }],
    ['missing root key', { version: 'ui-preferences-v2' }],
    [
      'extra root key',
      { version: 'ui-preferences-v2', values: {}, projectId: 'project-1' },
    ],
    ['non-object values', { version: 'ui-preferences-v2', values: [] }],
    [
      'unknown values key',
      { version: 'ui-preferences-v2', values: { seed: 'domain-data' } },
    ],
    [
      'unknown nested key',
      {
        version: 'ui-preferences-v2',
        values: { views: { library: 'grid', candidateId: 'candidate-1' } },
      },
    ],
    [
      'invalid enum',
      { version: 'ui-preferences-v2', values: { visualDensity: 'dense' } },
    ],
    [
      'fractional width',
      {
        version: 'ui-preferences-v2',
        values: { panelSizes: { controlsWidthPx: 216.5 } },
      },
    ],
    [
      'controls width below range',
      {
        version: 'ui-preferences-v2',
        values: { panelSizes: { controlsWidthPx: 215 } },
      },
    ],
    [
      'inspector width below range',
      {
        version: 'ui-preferences-v2',
        values: { panelSizes: { inspectorWidthPx: 287 } },
      },
    ],
    [
      'width above range',
      {
        version: 'ui-preferences-v2',
        values: { panelSizes: { controlsWidthPx: 265 } },
      },
    ],
    [
      'inspector width above range',
      {
        version: 'ui-preferences-v2',
        values: { panelSizes: { inspectorWidthPx: 337 } },
      },
    ],
    [
      'non-Boolean disclosure',
      {
        version: 'ui-preferences-v2',
        values: { disclosures: { history: 1 } },
      },
    ],
  ])('rejects the whole record for an %s', (_label, value) => {
    expect(normalizeUiPreferencesV2(value).ok).toBe(false)
  })

  it('requires plain, exact data objects when encoding', () => {
    class Values {
      visualDensity = 'comfortable'
    }
    expect(
      normalizeUiPreferencesV2({
        version: 'ui-preferences-v2',
        values: new Values(),
      }).ok,
    ).toBe(false)

    const withSymbol = createDefaultUiPreferencesV2() as unknown as Record<
      PropertyKey,
      unknown
    >
    withSymbol[Symbol('hidden-domain-state')] = 'candidate-1'
    expect(normalizeUiPreferencesV2(withSymbol).ok).toBe(false)
  })
})

describe('generic preference decoder limits', () => {
  it('accepts 63 and 64 paths, then rejects 65 paths before parsing', () => {
    for (const pathCount of [63, 64]) {
      const result = decodeUiPreferencesWithRegistryV2(
        '{"version":"synthetic-v2","values":{}}',
        syntheticRegistry(pathCount),
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(Object.keys(result.value.values)).toHaveLength(pathCount)
      }
    }

    const parse = vi.spyOn(JSON, 'parse')
    const rejected = decodeUiPreferencesWithRegistryV2(
      '{"version":"synthetic-v2","values":{}}',
      syntheticRegistry(65),
    )
    expect(rejected.ok).toBe(false)
    expect(parse).not.toHaveBeenCalled()
    parse.mockRestore()
  })

  it('accepts depth four and rejects depth five or overlapping paths', () => {
    const atLimit: UiPreferenceRegistryV2 = {
      version: 'synthetic-v2',
      leaves: [
        {
          path: ['one', 'two', 'three', 'four'],
          defaultValue: null,
          validate: (value) => value === null,
        },
      ],
    }
    expect(
      decodeUiPreferencesWithRegistryV2(
        '{"version":"synthetic-v2","values":{}}',
        atLimit,
      ).ok,
    ).toBe(true)

    expect(
      decodeUiPreferencesWithRegistryV2(
        '{"version":"synthetic-v2","values":{}}',
        {
          ...atLimit,
          leaves: [{ ...atLimit.leaves[0]!, path: ['a', 'b', 'c', 'd', 'e'] }],
        },
      ).ok,
    ).toBe(false)
    expect(
      decodeUiPreferencesWithRegistryV2(
        '{"version":"synthetic-v2","values":{}}',
        {
          ...atLimit,
          leaves: [
            { ...atLimit.leaves[0]!, path: ['a'] },
            { ...atLimit.leaves[0]!, path: ['a', 'b'] },
          ],
        },
      ).ok,
    ).toBe(false)
  })

  it('counts UTF-8 bytes, accepts the exact cap, and gates overflow preparse', () => {
    const registry = syntheticRegistry(15, '')
    const values = Object.fromEntries(
      registry.leaves.map((leaf) => [leaf.path[0]!, '🚀'.repeat(256)]),
    )
    const base = JSON.stringify({ version: registry.version, values })
    const baseBytes = new TextEncoder().encode(base).length
    expect(baseBytes).toBeLessThan(UI_PREFERENCES_LIMITS_V2.maxUtf8Bytes)
    expect(baseBytes).toBeGreaterThan(base.length)
    const padding = ' '.repeat(UI_PREFERENCES_LIMITS_V2.maxUtf8Bytes - baseBytes)
    const exact = `${base}${padding}`

    expect(new TextEncoder().encode(exact).length).toBe(16_384)
    expect(
      decodeUiPreferencesWithRegistryV2(exact.slice(0, -1), registry).ok,
    ).toBe(true)
    expect(decodeUiPreferencesWithRegistryV2(exact, registry).ok).toBe(true)

    const parse = vi.spyOn(JSON, 'parse')
    const overflow = decodeUiPreferencesWithRegistryV2(`${exact} `, registry)
    expect(overflow.ok).toBe(false)
    expect(parse).not.toHaveBeenCalled()
    parse.mockRestore()
  })

  it('enforces 256 Unicode scalars, paired surrogates, and finite defaults', () => {
    const stringRegistry: UiPreferenceRegistryV2 = {
      version: 'synthetic-v2',
      leaves: [
        {
          path: ['text'],
          defaultValue: '',
          validate: (value) => typeof value === 'string',
        },
      ],
    }
    const encodeText = (text: string) =>
      JSON.stringify({ version: stringRegistry.version, values: { text } })

    expect(
      decodeUiPreferencesWithRegistryV2(
        encodeText('🚀'.repeat(256)),
        stringRegistry,
      ).ok,
    ).toBe(true)
    expect(
      decodeUiPreferencesWithRegistryV2(
        encodeText('🚀'.repeat(257)),
        stringRegistry,
      ).ok,
    ).toBe(false)
    expect(
      decodeUiPreferencesWithRegistryV2(encodeText('\ud800'), stringRegistry).ok,
    ).toBe(false)
    expect(
      decodeUiPreferencesWithRegistryV2(
        '{"version":"synthetic-v2","values":{"number":1e400}}',
        {
          version: 'synthetic-v2',
          leaves: [
            {
              path: ['number'],
              defaultValue: 0,
              validate: (value) => typeof value === 'number',
            },
          ],
        },
      ).ok,
    ).toBe(false)
    expect(
      decodeUiPreferencesWithRegistryV2(
        '{"version":"synthetic-v2","values":{}}',
        {
          version: 'synthetic-v2',
          leaves: [
            {
              path: ['number'],
              defaultValue: Number.POSITIVE_INFINITY,
              validate: () => true,
            },
          ],
        },
      ).ok,
    ).toBe(false)
  })

  it('falls back for malformed JSON', () => {
    expect(decodeUiPreferencesV2('{not-json').ok).toBe(false)
  })
})

describe('UI preference localStorage adapter', () => {
  it('reads and writes only the sole V2 key with canonical replay', () => {
    const calls: Array<readonly [string, string]> = []
    const preferences = completePreferences()
    expect(
      saveUiPreferencesV2(preferences, {
        setItem: (key, value) => calls.push([key, value]),
      }),
    ).toEqual({ ok: true })
    expect(calls).toEqual([
      [UI_PREFERENCES_STORAGE_KEY_V2, encodeUiPreferencesV2(preferences)],
    ])

    const readKeys: string[] = []
    const loaded = loadUiPreferencesV2({
      getItem: (key) => {
        readKeys.push(key)
        return calls[0]![1]
      },
    })
    expect(readKeys).toEqual([UI_PREFERENCES_STORAGE_KEY_V2])
    expect(loaded).toEqual({ ok: true, value: preferences, source: 'stored' })
    if (loaded.ok) {
      expect(encodeUiPreferencesV2(loaded.value)).toBe(calls[0]![1])
    }
  })

  it('uses fresh defaults for empty, unknown, invalid, and unavailable data', () => {
    expect(loadUiPreferencesV2({ getItem: () => null })).toEqual({
      ok: true,
      value: createDefaultUiPreferencesV2(),
      source: 'empty',
    })

    for (const serialized of [
      '{"version":"ui-preferences-v2","values":{"candidateId":"c-1"}}',
      '{"version":"ui-preferences-v2","values":{"visualDensity":"dense"}}',
      '{bad',
    ]) {
      const result = loadUiPreferencesV2({ getItem: () => serialized })
      expect(result.ok).toBe(false)
      expect(result.value).toEqual(DEFAULT_UI_PREFERENCES_V2)
    }

    const unavailable = loadUiPreferencesV2({
      getItem: () => {
        throw new DOMException('Denied', 'SecurityError')
      },
    })
    expect(unavailable.ok).toBe(false)
    expect(unavailable.value).toEqual(DEFAULT_UI_PREFERENCES_V2)
  })

  it('never writes invalid/domain data and reports unavailable writes', () => {
    let writes = 0
    const invalid = {
      ...createDefaultUiPreferencesV2(),
      values: {
        ...createDefaultUiPreferencesV2().values,
        projectId: 'project-1',
      },
    }
    expect(
      saveUiPreferencesV2(invalid, {
        setItem: () => {
          writes += 1
        },
      }).ok,
    ).toBe(false)
    expect(writes).toBe(0)

    const unavailable = saveUiPreferencesV2(createDefaultUiPreferencesV2(), {
      setItem: () => {
        throw new DOMException('Full', 'QuotaExceededError')
      },
    })
    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) {
      expect(unavailable.error).toContain('Full')
    }
  })
})
