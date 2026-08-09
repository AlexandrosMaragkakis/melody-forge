import {
  SEED_STREAM_LABELS,
  SEED_TREE_VERSION,
  SeedTree,
  createSeedTree,
} from './seedTree'

describe('SeedTree', () => {
  it('derives stable labelled paths without consuming a parent stream', () => {
    const first = createSeedTree('  forge-root  ')
      .child('generation', 3)
      .child('candidate', '  slot-02  ')
      .child('melody')
    const repeated = createSeedTree('forge-root')
      .child('generation', 3)
      .child('candidate', 'slot-02')
      .child('melody')

    const goldenSeed =
      'forge-root::{"path":[{"key":3,"label":"generation"},{"key":"slot-02","label":"candidate"},{"key":null,"label":"melody"}],"rngVersion":"sfc32-v1","version":"labelled-seed-tree-v2"}'
    expect(first.seed()).toBe(goldenSeed)
    expect(first.seed()).toBe(repeated.seed())
    const goldenRandom = first.random()
    expect([
      goldenRandom.next(),
      goldenRandom.next(),
      goldenRandom.next(),
    ]).toEqual([
      0.8038267099764198,
      0.11007355432957411,
      0.29623300628736615,
    ])
    expect(repeated.random().next()).toBe(0.8038267099764198)
    expect(first.provenance()).toEqual(repeated.provenance())
    expect(first.provenance()).toMatchObject({
      version: SEED_TREE_VERSION,
      rootSeed: 'forge-root',
      path: [
        { label: 'generation', key: 3 },
        { label: 'candidate', key: 'slot-02' },
        { label: 'melody', key: null },
      ],
      derivedSeed: goldenSeed,
    })
  })

  it('isolates melody, beat, UI, island, and collaborator streams', () => {
    const candidate = new SeedTree('separation-proof')
      .child('generation', 8)
      .child('candidate', 1)
    const values = [
      candidate.child('melody').random().next(),
      candidate.child('beat').random().next(),
      candidate.child('ui-only-shuffling').random().next(),
      candidate.child('island', 'rhythmic').random().next(),
      candidate.child('collaborator-selection', 0).random().next(),
    ]

    expect(new Set(values).size).toBe(values.length)
    expect(candidate.child('melody').random().next()).toBe(values[0])
  })

  it('distinguishes path structure, labels, numeric keys, and string keys', () => {
    const root = createSeedTree('collision-proof')
    const seeds = [
      root.child('generation', 1).child('candidate', 2).seed(),
      root.child('generation', 12).seed(),
      root.child('generation', '1').child('candidate', 2).seed(),
      root.child('candidate', 1).child('generation', 2).seed(),
      root.child('generation', 1).child('beat', 2).seed(),
    ]

    expect(new Set(seeds).size).toBe(seeds.length)
  })

  it('publishes every required V2 stream label', () => {
    expect(SEED_STREAM_LABELS).toEqual([
      'generator',
      'generation',
      'algorithm',
      'island',
      'map-cell',
      'pareto-run',
      'candidate',
      'operator',
      'melody',
      'rhythm',
      'tonality',
      'beat',
      'collaborator-selection',
      'ui-only-shuffling',
      'attempt',
    ])
  })

  it('rejects ambiguous or unstable path input', () => {
    expect(() => createSeedTree('   ')).toThrow(/Root seed/u)
    expect(() => createSeedTree('root').child('candidate', '  ')).toThrow(
      /must not be blank/u,
    )
    expect(() => createSeedTree('root').child('candidate', -1)).toThrow(
      /non-negative/u,
    )
    expect(() => createSeedTree('root').child('candidate', 1.5)).toThrow(
      /safe integers/u,
    )
    expect(() =>
      createSeedTree('root').child('unregistered' as never),
    ).toThrow(/registered V2 constants/u)

    const sparsePath = Array(1) as unknown as ConstructorParameters<
      typeof SeedTree
    >[1]
    expect(() => new SeedTree('root', sparsePath)).toThrow(
      /path arrays must be dense/u,
    )
  })

  it('freezes exported labels, path arrays, and path segments at runtime', () => {
    const tree = createSeedTree('immutable-root').child('candidate', 1)

    expect(Object.isFrozen(SEED_STREAM_LABELS)).toBe(true)
    expect(Object.isFrozen(tree)).toBe(true)
    expect(Object.isFrozen(tree.path)).toBe(true)
    expect(Object.isFrozen(tree.path[0])).toBe(true)
    expect(() =>
      Object.defineProperty(tree.path, '0', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: {
          label: 'beat',
          key: null,
        },
      }),
    ).toThrow(TypeError)
    expect(() =>
      Object.defineProperty(tree, 'rootSeed', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: 'changed-root',
      }),
    ).toThrow(TypeError)
    expect(tree.rootSeed).toBe('immutable-root')
    expect(tree.path).toEqual([{ label: 'candidate', key: 1 }])
  })
})
