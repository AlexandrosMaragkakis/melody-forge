import { stableId } from '../identity'
import {
  createV1CompatibilityTimingProfile,
  type V1CompatibilityTimingProfile,
} from '../transport'
import {
  ALGORITHM_VERSION_REGISTRY_V2,
  DEFAULT_SOFT_PLUCK_PERFORMANCE_SETTINGS_V2,
  DEFAULT_SOFT_PLUCK_PERFORMANCE_V2,
  EMPTY_LOCK_SET_V2,
  V1_COMPATIBILITY_PERFORMANCE_V2,
  annotationIdV2,
  assertActiveProjectMetadataV2,
  assertAlgorithmVersionRegistryV2,
  assertHistoryGraphClosureV2,
  assertLibraryItemV2,
  assertM2ProjectEntityArrayTablesV2,
  assertMigratedV1MelodyCandidateV2,
  assertMigratedV1MelodyClosureV2,
  assertModeStateV2,
  assertPerformanceSettingsRecordV2,
  assertProjectV2,
  assertSnapshotV2,
  assertStoredProjectGraphV2,
  assertUndoStateV2,
  assertV1MigrationReceiptV2,
  candidateContributionIdV2,
  createLibraryItemV2,
  createNewProjectKernelV2,
  compareUnicodeCodePoints,
  historyGraphIdV2,
  historyNodeIdV2,
  melodyGenomeIdV2,
  mergeLibraryOriginsV2,
  migratedV1EventIdV2,
  modeStateIdV2,
  ratingIdV2,
  tonalSegmentIdV2,
  tonalTimelineIdV2,
  v1MigrationReceiptIdV2,
  type HistoryGraphV2,
  type HistoryNodeV2,
  type CandidateContributionV2,
  type MelodyGenomeV2,
  type MigratedV1MelodyCandidateV2,
  type ModeStateV2,
  type ProjectV2,
  type TonalTimelineV2,
  type V1MigrationReceiptV2,
} from './index'

const SHA = '0'.repeat(64)

type Mutable<T> = T extends readonly (infer Element)[]
  ? Mutable<Element>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function jsonClone<T>(value: T): Mutable<T> {
  return JSON.parse(JSON.stringify(value)) as Mutable<T>
}

function migratedMelodyFixture(
  candidateId = 'candidate-v1-copy',
): {
  readonly candidate: MigratedV1MelodyCandidateV2
  readonly genome: MelodyGenomeV2
  readonly timeline: TonalTimelineV2
  readonly profile: V1CompatibilityTimingProfile
} {
  const firstEventId = migratedV1EventIdV2(candidateId, 0)
  const restEventId = migratedV1EventIdV2(candidateId, 1)
  const segmentWithoutId = {
    startTick: 0,
    endTick: 960,
    tonicPitchClass: 0,
    tonicMidi: 60,
    scale: { kind: 'catalogue' as const, scaleId: 'diatonic-ionian' },
    borrowingPolicyId: null,
  }
  const segment = {
    id: tonalSegmentIdV2(segmentWithoutId),
    ...segmentWithoutId,
  }
  const timelineWithoutId = {
    version: 'tonal-timeline-v2' as const,
    segments: [segment],
  }
  const timeline: TonalTimelineV2 = {
    id: tonalTimelineIdV2(timelineWithoutId),
    ...timelineWithoutId,
  }
  const profile = createV1CompatibilityTimingProfile({
    sourceCandidateId: candidateId,
    sourceTicksPerBeat: 480,
    sourceGridTicks: 480,
    tempoBpm: 108,
    loopEndTick: 960,
  })
  const genomeWithoutId: Omit<MelodyGenomeV2, 'id'> = {
    version: 'melody-genome-v2',
    pitchShape: {
      version: 'pitch-shape-v2',
      mapping: 'legacy-fixed-octave',
      genes: [{ eventId: firstEventId, extendedDegree: 0 }],
      register: { minMidi: 60, maxMidi: 71 },
    },
    rhythm: {
      version: 'rhythm-v2',
      events: [
        {
          eventId: firstEventId,
          onsetTick: 0,
          durationTicks: 480,
          isRest: false,
          accent: 0,
          tieToNext: false,
        },
        {
          eventId: restEventId,
          onsetTick: 480,
          durationTicks: 480,
          isRest: true,
          accent: 0,
          tieToNext: false,
        },
      ],
      sourceGridTicks: 480,
    },
    tonalTimelineId: timeline.id,
    timing: { kind: 'v1-compatibility', timingProfileId: profile.id },
    locks: jsonClone(EMPTY_LOCK_SET_V2),
  }
  const genome: MelodyGenomeV2 = {
    version: 'melody-genome-v2',
    id: melodyGenomeIdV2(genomeWithoutId),
    pitchShape: genomeWithoutId.pitchShape,
    rhythm: genomeWithoutId.rhythm,
    tonalTimelineId: genomeWithoutId.tonalTimelineId,
    timing: genomeWithoutId.timing,
    locks: genomeWithoutId.locks,
  }
  const migratedContribution = (
    eventId: string,
    component: CandidateContributionV2['component'],
  ): CandidateContributionV2 => {
    const withoutId = {
      version: 'candidate-contribution-v2' as const,
      eventId,
      component,
      source: 'migrated-v1' as const,
      sourceCandidateId: candidateId,
      sourceEventId: null,
    }
    return { id: candidateContributionIdV2(withoutId), ...withoutId }
  }
  const contributions = [
    migratedContribution(firstEventId, 'pitch'),
    migratedContribution(firstEventId, 'rhythm'),
    migratedContribution(firstEventId, 'tonal'),
    migratedContribution(restEventId, 'rhythm'),
    migratedContribution(restEventId, 'tonal'),
  ]
  const candidate: MigratedV1MelodyCandidateV2 = {
    id: candidateId,
    version: 'melody-candidate-v2',
    candidateKind: 'migrated-v1',
    melodyGenomeId: genome.id,
    renderedPhenotype: {
      version: 'rendered-melody-phenotype-v2',
      renderVersion: 'melody-render-v2.0.0',
      inputFingerprint: SHA,
      timingFingerprint: SHA,
      events: [
        {
          eventId: firstEventId,
          onsetTick: 0,
          durationTicks: 480,
          midi: 60,
          velocity: 88 / 127,
          tonalSegmentId: segment.id,
          borrowing: null,
          contributionIds: contributions.slice(0, 3).map(({ id }) => id),
        },
        {
          eventId: restEventId,
          onsetTick: 480,
          durationTicks: 480,
          midi: null,
          velocity: 88 / 127,
          tonalSegmentId: segment.id,
          borrowing: null,
          contributionIds: contributions.slice(3).map(({ id }) => id),
        },
      ],
      phenotypeFingerprint: SHA,
    },
    descriptorValues: [],
    provenance: {
      version: 'candidate-provenance-v2',
      rootSeed: 'legacy-amber',
      seedPath: [],
      rngVersion: 'sfc32-v1',
      algorithmVersion: 'legacy-simple-v1',
      renderVersion: 'melody-render-v2.0.0',
      descriptorSetVersion: 'descriptor-core-v2.0.0',
      operations: [
        {
          version: 'candidate-operation-v2',
          kind: 'import',
          operatorId: 'legacy-mutation',
          parameters: { amount: 1 },
        },
      ],
      contributions,
      repairs: [],
      lockVerificationFingerprints: [],
    },
    lineage: {
      version: 'candidate-lineage-v2',
      geneticParentCandidateIds: ['parent-v1'],
      componentParentCandidateIds: { pitch: [], rhythm: [], tonal: [] },
      sourceHistoryNodeIds: [],
    },
    compatibilitySource: {
      version: 'frozen-v1-candidate-v1',
      candidate: {
        id: candidateId,
        melody: {
          events: [
            { startTick: 0, durationTicks: 480, degree: 0 },
            { startTick: 480, durationTicks: 480, degree: null },
          ],
          constraints: {
            scaleId: 'diatonic-ionian',
            tonicPitchClass: 0,
            tonicMidi: 60,
            register: { minMidi: 60, maxMidi: 71 },
            pitchMapping: 'legacy-fixed-octave',
            ticksPerBeat: 480,
            gridTicks: 480,
            totalTicks: 960,
            tempoBpm: 108,
            tonicBoundary: { start: true, end: false },
          },
        },
        provenance: {
          strategy: 'legacy',
          generatorVersion: 'legacy-simple-v1',
          seed: 'legacy-amber',
          settings: {},
          generation: 0,
          parentIds: ['parent-v1'],
          operations: [
            { operator: 'legacy-mutation', parameters: { amount: 1 } },
          ],
        },
      },
    },
  }
  return { candidate, genome, timeline, profile }
}

describe('schema-2 algorithm and exact-record boundaries', () => {
  it('freezes the closed algorithm registry and rejects order/value changes', () => {
    expect(Object.isFrozen(ALGORITHM_VERSION_REGISTRY_V2)).toBe(true)
    expect(Object.isFrozen(ALGORITHM_VERSION_REGISTRY_V2.formulas)).toBe(true)
    expect(() => assertAlgorithmVersionRegistryV2(ALGORITHM_VERSION_REGISTRY_V2)).not.toThrow()

    const changed = jsonClone(ALGORITHM_VERSION_REGISTRY_V2)
    changed.formulas.descriptorCore = 'wrong' as 'descriptor-core-v2.0.0'
    expect(() => assertAlgorithmVersionRegistryV2(changed)).toThrow(
      /descriptorCore/u,
    )

    const reordered = {
      version: ALGORITHM_VERSION_REGISTRY_V2.version,
      foundations: ALGORITHM_VERSION_REGISTRY_V2.foundations,
      generators: ALGORITHM_VERSION_REGISTRY_V2.generators,
      strategies: ALGORITHM_VERSION_REGISTRY_V2.strategies,
      formulas: ALGORITHM_VERSION_REGISTRY_V2.formulas,
      midiImport: ALGORITHM_VERSION_REGISTRY_V2.midiImport,
    }
    expect(() => assertAlgorithmVersionRegistryV2(reordered)).toThrow(
      /keys must be exactly/u,
    )
  })

  it('rejects symbol, non-enumerable, accessor, and sparse hidden state', () => {
    const symbolExtra = jsonClone(ALGORITHM_VERSION_REGISTRY_V2) as Record<
      string | symbol,
      unknown
    >
    symbolExtra[Symbol('hidden')] = true
    expect(() => assertAlgorithmVersionRegistryV2(symbolExtra)).toThrow(
      /symbol keys/u,
    )

    let getterReads = 0
    const accessor = jsonClone(ALGORITHM_VERSION_REGISTRY_V2) as Record<
      string,
      unknown
    >
    Object.defineProperty(accessor, 'version', {
      enumerable: true,
      get() {
        getterReads += 1
        return 'algorithm-version-registry-v2'
      },
    })
    expect(() => assertAlgorithmVersionRegistryV2(accessor)).toThrow(
      /data properties/u,
    )
    expect(getterReads).toBe(0)

    const graph = jsonClone(
      createNewProjectKernelV2({
        projectIdFactory: () => 'project-hidden-array',
        metadataClock: () => 1,
      }),
    )
    Object.defineProperty(graph.record.project.selectedMelodyCandidateIds, 'hidden', {
      enumerable: false,
      value: true,
    })
    expect(() => assertStoredProjectGraphV2(graph)).toThrow(/dense indexed/u)
  })
})

describe('fresh schema-2 kernel defaults', () => {
  it('constructs one fully validated revision-1 graph and reads injections once', () => {
    let idReads = 0
    let clockReads = 0
    const graph = createNewProjectKernelV2({
      projectIdFactory: () => {
        idReads += 1
        return 'project-native-fixture'
      },
      metadataClock: () => {
        clockReads += 1
        return 1234
      },
    })

    expect(() => assertStoredProjectGraphV2(graph)).not.toThrow()
    expect(idReads).toBe(1)
    expect(clockReads).toBe(1)
    expect(graph.record).toMatchObject({
      id: 'project-native-fixture',
      revision: 1,
      project: {
        name: 'Untitled Melody',
        rootSeed: 'melody-forge',
        destination: 'create',
        activeEvolutionMode: 'breed',
        activeExploreMode: 'map',
        createdAtEpochMs: 1234,
        updatedAtEpochMs: 1234,
        loopEnabled: false,
        accompanimentMuted: true,
      },
    })
    expect(graph.tables.modeStates).toHaveLength(6)
    expect(graph.tables.modeStates.every(({ payload }) => !payload.initialized)).toBe(true)
    expect(graph.tables.transports[0]).toMatchObject({
      ppq: 480,
      tempoBpm: 108,
      meter: { numerator: 4, denominator: 4, beatGroups: [2, 2] },
      gridTicks: 240,
      loopEndTick: 1920,
      swing: { subdivisionTicks: 240, amountPermille: 500 },
    })
    expect(graph.tables.performanceSettings).toEqual([
      DEFAULT_SOFT_PLUCK_PERFORMANCE_V2,
    ])
    expect(Object.isFrozen(graph)).toBe(true)
    expect(Object.isFrozen(graph.record.project)).toBe(true)
  })

  it('rejects extra runtime fields and root set ordering errors', () => {
    const graph = jsonClone(
      createNewProjectKernelV2({
        projectIdFactory: () => 'project-runtime-field',
        metadataClock: () => 0,
      }),
    )
    const withRuntime = {
      ...graph.record.project,
      playing: false,
    }
    expect(() => assertProjectV2(withRuntime)).toThrow(/playing/u)

    const project = graph.record.project as ProjectV2 & {
      selectedMelodyCandidateIds: string[]
    }
    project.selectedMelodyCandidateIds = ['z', 'a']
    expect(() => assertProjectV2(project)).toThrow(/Unicode code-point order/u)
  })

  it('uses exact content-addressed performance defaults and bounds', () => {
    expect(DEFAULT_SOFT_PLUCK_PERFORMANCE_V2.id).toBe(
      stableId('performance', DEFAULT_SOFT_PLUCK_PERFORMANCE_SETTINGS_V2),
    )
    expect(V1_COMPATIBILITY_PERFORMANCE_V2.id).toBe(
      stableId('performance', {
        version: 'v1-compat-performance-v1',
        voiceFactoryId: 'v1-triangle-compat',
      }),
    )
    expect(() =>
      assertPerformanceSettingsRecordV2(DEFAULT_SOFT_PLUCK_PERFORMANCE_V2),
    ).not.toThrow()

    const tooWet = jsonClone(DEFAULT_SOFT_PLUCK_PERFORMANCE_V2)
    Reflect.set(tooWet.reverb, 'amount', 31)
    expect(() => assertPerformanceSettingsRecordV2(tooWet)).toThrow(
      /zero|0|30/u,
    )
  })
})

describe('registered M2 payload and migrated melody boundaries', () => {
  it('accepts six empty mode rows and caps registered Breed state at 16', () => {
    const projectId = 'project-mode-fixture'
    const payload = {
      version: 'breed-mode-state-v2.0.0',
      initialized: true,
      populationCandidateIds: ['candidate-a'],
      parentCandidateIds: ['candidate-a'],
      populationSize: 16,
      mutationStrength: 0.28,
      retainElites: true,
      crossoverPolicy: 'conservative-directed',
      exactDeduplication: true,
      noveltyProtection: true,
      seed: 'breed-seed',
      generationOrdinal: 1,
    } as const
    const row: ModeStateV2 = {
      id: modeStateIdV2(projectId, 'breed'),
      version: 'mode-state-v2',
      projectId,
      mode: 'breed',
      payload,
    }
    expect(() => assertModeStateV2(row)).not.toThrow()
    expect(() =>
      assertModeStateV2({
        ...row,
        payload: { ...payload, populationSize: 17 },
      }),
    ).toThrow(/16/u)
    expect(() =>
      assertModeStateV2({
        ...row,
        payload: { version: 'future-mode-v3', initialized: true },
      }),
    ).toThrow(/not registered/u)
  })

  it('validates copied candidates, event IDs, empty locks, and V1 closure', () => {
    const { candidate, genome } = migratedMelodyFixture()
    expect(() => assertMigratedV1MelodyCandidateV2(candidate)).not.toThrow()
    expect(() => assertMigratedV1MelodyClosureV2(candidate, genome)).not.toThrow()

    const hiddenMetadata = { ...candidate, ratingIds: ['rating-local'] }
    expect(() => assertMigratedV1MelodyCandidateV2(hiddenMetadata)).toThrow(
      /ratingIds/u,
    )
    const changed = jsonClone(genome)
    changed.rhythm.events[0]!.eventId = 'invented-event'
    expect(() => assertMigratedV1MelodyClosureV2(candidate, changed)).toThrow()

    const wrongMidi = jsonClone(candidate)
    wrongMidi.renderedPhenotype.events[0]!.midi = 61
    expect(() => assertMigratedV1MelodyCandidateV2(wrongMidi)).not.toThrow()
    expect(() => assertMigratedV1MelodyClosureV2(wrongMidi, genome)).toThrow(
      /exact V1 MIDI/u,
    )

    const wrongVelocity = jsonClone(candidate)
    wrongVelocity.renderedPhenotype.events[0]!.velocity = 0.72
    expect(() => assertMigratedV1MelodyCandidateV2(wrongVelocity)).not.toThrow()
    expect(() => assertMigratedV1MelodyClosureV2(wrongVelocity, genome)).toThrow(
      /normalized velocity/u,
    )

    const missingContribution = jsonClone(candidate)
    missingContribution.provenance.contributions.splice(0, 1)
    missingContribution.renderedPhenotype.events[0]!.contributionIds.splice(0, 1)
    expect(() =>
      assertMigratedV1MelodyCandidateV2(missingContribution),
    ).not.toThrow()
    expect(() =>
      assertMigratedV1MelodyClosureV2(missingContribution, genome),
    ).toThrow(/contribution IDs/u)

    const wrongProvenance = jsonClone(candidate)
    wrongProvenance.provenance.rootSeed = 'invented-seed'
    wrongProvenance.provenance.operations[0]!.operatorId = 'invented-operator'
    expect(() => assertMigratedV1MelodyCandidateV2(wrongProvenance)).not.toThrow()
    expect(() =>
      assertMigratedV1MelodyClosureV2(wrongProvenance, genome),
    ).toThrow(/exact registered M2 translation/u)

    const wrongLineage = jsonClone(candidate)
    wrongLineage.lineage.geneticParentCandidateIds = []
    expect(() => assertMigratedV1MelodyCandidateV2(wrongLineage)).not.toThrow()
    expect(() => assertMigratedV1MelodyClosureV2(wrongLineage, genome)).toThrow(
      /frozen V1 genetic parents/u,
    )
  })

  it('accepts a no-receipt candidate-envelope Save rooted by Library', () => {
    const projectId = 'project-candidate-save'
    const graph = jsonClone(
      createNewProjectKernelV2({
        projectIdFactory: () => projectId,
        metadataClock: () => 1,
      }),
    )
    const { candidate, genome, timeline, profile } = migratedMelodyFixture()
    const item = createLibraryItemV2({
      kind: 'melody-candidate',
      componentId: candidate.id,
      initialization: 'save',
      metadataClock: () => 2,
      origin: {
        kind: 'json-import',
        projectId,
        historyNodeId: null,
        sourceHash: SHA,
        sourceId: candidate.id,
      },
    })
    graph.record.project.libraryItemIds = [item.id]
    graph.tables.melodyCandidates = [jsonClone(candidate)]
    graph.tables.melodyGenomes = [jsonClone(genome)]
    graph.tables.v1TimingProfiles = [jsonClone(profile)]
    graph.tables.tonalTimelines = [jsonClone(timeline)]
    graph.tables.libraryItems = [jsonClone(item)]

    expect(graph.tables.migrationReceipts).toEqual([])
    expect(() => assertStoredProjectGraphV2(graph)).not.toThrow()
  })

  it('deduplicates shared content rows and rejects unreachable component extras', () => {
    const projectId = 'project-shared-timeline'
    const graph = jsonClone(
      createNewProjectKernelV2({
        projectIdFactory: () => projectId,
        metadataClock: () => 1,
      }),
    )
    const first = migratedMelodyFixture('candidate-shared-a')
    const second = migratedMelodyFixture('candidate-shared-b')
    expect(first.timeline.id).toBe(second.timeline.id)
    const items = [first, second].map(({ candidate }, index) =>
      createLibraryItemV2({
        kind: 'melody-candidate',
        componentId: candidate.id,
        initialization: 'save',
        metadataClock: () => index + 2,
        origin: {
          kind: 'json-import',
          projectId,
          historyNodeId: null,
          sourceHash: SHA,
          sourceId: candidate.id,
        },
      }),
    )
    graph.record.project.libraryItemIds = items.map(({ id }) => id)
    graph.tables.melodyCandidates = [first.candidate, second.candidate]
      .sort((left, right) => compareUnicodeCodePoints(left.id, right.id))
      .map(jsonClone)
    graph.tables.melodyGenomes = [first.genome, second.genome]
      .sort((left, right) => compareUnicodeCodePoints(left.id, right.id))
      .map(jsonClone)
    graph.tables.v1TimingProfiles = [first.profile, second.profile]
      .sort((left, right) => compareUnicodeCodePoints(left.id, right.id))
      .map(jsonClone)
    graph.tables.tonalTimelines = [jsonClone(first.timeline)]
    graph.tables.libraryItems = items
      .sort((left, right) => compareUnicodeCodePoints(left.id, right.id))
      .map(jsonClone)

    expect(() => assertStoredProjectGraphV2(graph)).not.toThrow()

    const extra = migratedMelodyFixture('candidate-unreachable').genome
    graph.tables.melodyGenomes = [...graph.tables.melodyGenomes, jsonClone(extra)].sort(
      (left, right) => compareUnicodeCodePoints(left.id, right.id),
    )
    expect(() => assertStoredProjectGraphV2(graph)).toThrow(
      /every and only reachable/u,
    )
  })
})

describe('history, Library, metadata, and migration support records', () => {
  it('preserves V1 ordinal parents and active history index exactly', () => {
    const projectId = 'project-history-fixture'
    const graphId = historyGraphIdV2(projectId)
    const rootWithoutId: Omit<HistoryNodeV2, 'id'> = {
      version: 'history-node-v2',
      projectId,
      historyGraphId: graphId,
      occurrenceOrdinal: 0,
      parentNodeId: null,
      snapshotId: 'snapshot-a',
      mode: 'create',
      action: { version: 'history-action-summary-v2', kind: 'migrate-v1' },
      v1LinearSource: {
        version: 'v1-linear-history-node-source-v2',
        sourceHistoryOrdinal: 0,
        sourceSnapshotId: 'snapshot-a',
        sourcePreviousGenerationId: null,
        parentResolution: 'root',
      },
    }
    const root: HistoryNodeV2 = {
      id: historyNodeIdV2(rootWithoutId),
      ...rootWithoutId,
    }
    const childWithoutId: Omit<HistoryNodeV2, 'id'> = {
      version: 'history-node-v2',
      projectId,
      historyGraphId: graphId,
      occurrenceOrdinal: 1,
      parentNodeId: root.id,
      snapshotId: 'snapshot-b',
      mode: 'breed',
      action: { version: 'history-action-summary-v2', kind: 'migrate-v1' },
      v1LinearSource: {
        version: 'v1-linear-history-node-source-v2',
        sourceHistoryOrdinal: 1,
        sourceSnapshotId: 'snapshot-b',
        sourcePreviousGenerationId: 'missing-source',
        parentResolution: 'stored-order-fallback',
      },
    }
    const child: HistoryNodeV2 = {
      id: historyNodeIdV2(childWithoutId),
      ...childWithoutId,
    }
    const graph: HistoryGraphV2 = {
      id: graphId,
      version: 'history-graph-v2',
      projectId,
      nextNodeOccurrence: 2,
      nodeIds: [root.id, child.id],
      rootNodeIds: [root.id],
      activeNodeId: child.id,
      v1LinearSource: {
        version: 'v1-linear-history-graph-source-v2',
        sourceHistoryLength: 2,
        sourceHistoryIndex: 1,
      },
    }
    expect(() => assertHistoryGraphClosureV2(graph, [root, child])).not.toThrow()
    expect(() =>
      assertHistoryGraphClosureV2({ ...graph, activeNodeId: root.id }, [root, child]),
    ).toThrow(/sourceHistoryIndex/u)

    const inventedRootWithoutId = {
      ...childWithoutId,
      parentNodeId: null,
      v1LinearSource: {
        ...childWithoutId.v1LinearSource!,
        parentResolution: 'root' as const,
      },
    }
    const inventedRoot: HistoryNodeV2 = {
      id: historyNodeIdV2(inventedRootWithoutId),
      ...inventedRootWithoutId,
    }
    const badGraph = {
      ...graph,
      nodeIds: [root.id, inventedRoot.id],
      rootNodeIds: [root.id, inventedRoot.id],
      activeNodeId: inventedRoot.id,
    }
    expect(() => assertHistoryGraphClosureV2(badGraph, [root, inventedRoot])).toThrow(
      /sole root|later V1/u,
    )
  })

  it('keeps migrated snapshot metadata sets empty at the M2 boundary', () => {
    const snapshot = {
      id: 'snapshot-v1-copy',
      version: 'snapshot-v2',
      projectId: 'project-snapshot',
      sourceKind: 'migrated-v1',
      mode: 'create',
      generationOrdinal: 0,
      seed: '',
      algorithmVersions: ALGORITHM_VERSION_REGISTRY_V2,
      candidateIds: ['candidate-snapshot'],
      selectedCandidateIds: [],
      ratingIds: [],
      annotationIds: [],
      payload: {
        version: 'migrated-v1-snapshot-payload-v2',
        sourceSeed: '',
        sourceGeneratorVersion: '',
        sourceEvolutionSettings: null,
      },
    } as const
    expect(() => assertSnapshotV2(snapshot)).not.toThrow()
    expect(() =>
      assertSnapshotV2({ ...snapshot, ratingIds: ['rating-invented'] }),
    ).toThrow(/empty rating and annotation/u)
  })

  it('applies absent-only Library defaults and stable-unions origins', () => {
    let migrationClockReads = 0
    const migrated = createLibraryItemV2({
      kind: 'melody-candidate',
      componentId: 'candidate-library',
      initialization: 'migrated-v1-favorite',
      metadataClock: () => {
        migrationClockReads += 1
        return 999
      },
      origin: {
        kind: 'v1-favorite',
        projectId: 'project-library',
        historyNodeId: null,
        sourceHash: SHA,
        sourceId: 'favorite-source',
      },
    })
    expect(migrationClockReads).toBe(0)
    expect(migrated).toMatchObject({
      name: 'Untitled Melody',
      note: '',
      favorite: true,
      savedAtEpochMs: null,
    })

    let saveClockReads = 0
    const saved = createLibraryItemV2({
      kind: 'melody-candidate',
      componentId: 'candidate-library',
      initialization: 'save',
      metadataClock: () => {
        saveClockReads += 1
        return 55
      },
      origin: {
        kind: 'project-save',
        projectId: 'project-library',
        historyNodeId: null,
        sourceHash: null,
        sourceId: 'save-source',
      },
    })
    expect(saveClockReads).toBe(1)
    const edited = { ...migrated, name: 'My melody', note: 'Keep', favorite: false }
    assertLibraryItemV2(edited)
    const merged = mergeLibraryOriginsV2(edited, saved)
    expect(merged).toMatchObject({
      name: 'My melody',
      note: 'Keep',
      favorite: false,
      savedAtEpochMs: null,
    })
    expect(merged.originReferences).toHaveLength(2)
  })

  it('keeps rating/annotation identities independent of editable values', () => {
    const ratingIdentity = {
      version: 'rating-v2' as const,
      projectId: 'project-meta',
      targetKind: 'melody-candidate' as const,
      targetId: 'candidate-meta',
    }
    expect(ratingIdV2(ratingIdentity)).toBe(ratingIdV2(ratingIdentity))
    expect(
      annotationIdV2({
        version: 'annotation-v2',
        projectId: 'project-meta',
        targetKind: 'melody-candidate',
        targetId: 'candidate-meta',
      }),
    ).not.toBe(ratingIdV2(ratingIdentity))
  })

  it('rejects nonempty Undo state until a reversible path registry exists', () => {
    const projectId = 'project-undo-fixture'
    const entry = {
      occurrenceOrdinal: 0,
      historyNodeId: null,
      commandId: 'opaque-command',
      forwardPatches: [],
      inversePatches: [],
    }
    expect(() =>
      assertUndoStateV2({
        id: stableId('undo-state', { version: 'undo-state-v2', projectId }),
        version: 'undo-state-v2',
        projectId,
        nextOccurrence: 1,
        undoEntries: [entry],
        redoEntries: [],
      }),
    ).toThrow(/no reversible command\/path codec/u)
  })

  it('validates exact receipt/active metadata identities and source kinds', () => {
    const identity = {
      version: 'v1-migration-receipt-v2' as const,
      migrationVersion: 'v1-project-migration-v2.0.0' as const,
      sourceHash: SHA,
      projectId: 'project-receipt',
    }
    const receipt: V1MigrationReceiptV2 = {
      id: v1MigrationReceiptIdV2(identity),
      version: identity.version,
      migrationVersion: identity.migrationVersion,
      sourceKind: 'local-storage-project-v1',
      sourceHash: identity.sourceHash,
      projectId: identity.projectId,
      stagedRevision: 1,
      status: 'pending-readback',
      candidateMappings: [],
      snapshotMappings: [],
      createdAtEpochMs: null,
      verifiedAtEpochMs: null,
    }
    expect(() => assertV1MigrationReceiptV2(receipt)).not.toThrow()
    expect(() =>
      assertV1MigrationReceiptV2({
        ...receipt,
        sourceKind: 'candidate-envelope-v1',
      }),
    ).toThrow(/sourceKind/u)
    expect(() =>
      assertActiveProjectMetadataV2({
        id: 'active-project',
        version: 'active-project-metadata-v2',
        projectId: receipt.projectId,
        revision: 1,
      }),
    ).not.toThrow()
  })

  it('rejects reordered or populated reserved M2 tables', () => {
    const graph = jsonClone(
      createNewProjectKernelV2({
        projectIdFactory: () => 'project-tables-fixture',
        metadataClock: () => 0,
      }),
    )
    expect(() => assertM2ProjectEntityArrayTablesV2(graph.tables)).not.toThrow()
    Reflect.set(graph.tables, 'customScales', [{}])
    expect(() => assertM2ProjectEntityArrayTablesV2(graph.tables)).toThrow(
      /no registered M2 row codec/u,
    )
  })
})
