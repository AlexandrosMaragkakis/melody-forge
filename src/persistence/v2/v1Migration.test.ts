/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ProjectState } from '../../app/state'
import { stableStringify } from '../../domain/identity'
import type { Candidate } from '../../domain/types'
import { migratedV1EventIdV2 } from '../../domain/v2/identities'
import type { M2ProjectEntityArrayTablesV2 } from '../../domain/v2/types'
import {
  assertStoredProjectGraphV2,
  createLibraryItemV2,
  mergeLibraryOriginsV2,
} from '../../domain/v2'
import {
  decodeCandidateEnvelope,
  decodeProjectEnvelope,
} from '../schema'
import {
  WebCryptoSha256,
  computeV1SourceHash,
} from './sourceHash'
import {
  V1_MIGRATION_SPEC_SEAMS_V2,
  V1MigrationSourceHashMismatchError,
  convertV1CandidatePreviewV2,
  convertV1ProjectV2,
  convertV1SourceV2,
} from './v1Migration'
import { V1MigrationCollisionError } from './v1Traversal'

const FIXTURES = join(process.cwd(), 'src/test/fixtures/v1')

function fixtureProject(name: string): ProjectState {
  const decoded = decodeProjectEnvelope(
    JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as unknown,
  )
  if (!decoded.ok) throw new Error(decoded.error)
  return decoded.value
}

function fixtureCandidate(name: string): Candidate {
  const decoded = decodeCandidateEnvelope(
    JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as unknown,
  )
  if (!decoded.ok) throw new Error(decoded.error)
  return decoded.value
}

async function projectConversion(
  project: ProjectState,
  sourceKind: 'project-envelope-v1' | 'local-storage-project-v1' =
    'project-envelope-v1',
) {
  const sha256 = new WebCryptoSha256()
  const sourceHash = await computeV1SourceHash(sha256, sourceKind, project)
  return convertV1ProjectV2({
    sourceKind,
    sourceHash,
    decodedV1: project,
    sha256,
  })
}

function expectUniqueSortedTableIds(
  tables: M2ProjectEntityArrayTablesV2,
): void {
  const entries = Object.entries(tables) as Array<
    [keyof M2ProjectEntityArrayTablesV2, readonly { readonly id: string }[]]
  >
  entries.forEach(([tableName, rows]) => {
    const ids = rows.map(({ id }) => id)
    expect(ids, tableName).toEqual([...new Set(ids)].sort())
  })
}

describe('pure deterministic V1 migration', () => {
  it('maps a complete project into the exact M2 graph without reinterpreting V1 data', async () => {
    const project = fixtureProject('project-five-beat-history.v1.json')
    const conversion = await projectConversion(project)
    const { graph } = conversion
    const root = graph.record.project
    const receipt = graph.tables.migrationReceipts[0]!
    const breed = graph.tables.modeStates.find(({ mode }) => mode === 'breed')!
    const create = graph.tables.createStates[0]!

    expect(() => assertStoredProjectGraphV2(graph)).not.toThrow()
    expect(root).toMatchObject({
      id: conversion.projectId,
      name: 'Untitled Melody',
      createdAtEpochMs: null,
      updatedAtEpochMs: null,
      destination: 'create',
      activeEvolutionMode: 'breed',
      activeExploreMode: 'map',
      comparisonTransportId: null,
      auditionTiming: null,
      sharedBeatId: null,
      activePairingId: null,
      loopEnabled: true,
      accompanimentMuted: true,
      focusedMelodyCandidateId: null,
      selectedMelodyCandidateIds: [],
    })
    expect(root.rootSeed).toBe(`v1-migration/${conversion.sourceHash}`)
    expect(create).toMatchObject({
      activeGenerator: project.mode,
      legacySettings: project.legacySettings,
      modernSettings: project.modernSettings,
    })
    expect(breed.payload).toEqual({
      version: 'breed-mode-state-v2.0.0',
      initialized: true,
      populationCandidateIds: project.history[1]!.candidates.map(({ id }) => id),
      parentCandidateIds: project.history[1]!.selectedParentIds,
      populationSize: project.evolutionSettings.populationSize,
      mutationStrength: project.evolutionSettings.mutationStrength,
      retainElites: project.evolutionSettings.retainElites,
      crossoverPolicy: 'conservative-directed',
      exactDeduplication: true,
      noveltyProtection: true,
      seed: project.history[1]!.seed,
      generationOrdinal: project.history[1]!.generation,
    })
    expect(
      graph.tables.modeStates
        .filter(({ mode }) => mode !== 'breed')
        .every(({ payload }) => payload.version === 'empty-mode-state-v2'),
    ).toBe(true)

    expect(receipt).toMatchObject({
      sourceKind: 'project-envelope-v1',
      sourceHash: conversion.sourceHash,
      projectId: conversion.projectId,
      stagedRevision: 1,
      status: 'pending-readback',
      createdAtEpochMs: null,
      verifiedAtEpochMs: null,
    })
    expect(receipt.candidateMappings.map(({ sourceCandidateId }) => sourceCandidateId)).toEqual([
      'candidate-2e3dbf51cb754063',
      'candidate-e7a7faaf8d22eb7e',
      'evolved-84da177b30089c00',
      'evolved-49303416fbb0c401',
      'candidate-afc0141f74faee53',
      'candidate-ba1b5a5c0d5dfc6d',
      'legacy-14d4a7dce6581503',
    ])
    expect(receipt.snapshotMappings.map(({ sourceHistoryOrdinal, sourceSnapshotId }) => ({
      sourceHistoryOrdinal,
      sourceSnapshotId,
    }))).toEqual(
      project.history.map(({ id }, sourceHistoryOrdinal) => ({
        sourceHistoryOrdinal,
        sourceSnapshotId: id,
      })),
    )

    const firstSource = project.history[0]!.candidates[0]!
    const firstCandidate = graph.tables.melodyCandidates.find(
      ({ id }) => id === firstSource.id,
    )!
    const firstGenome = graph.tables.melodyGenomes.find(
      ({ id }) => id === firstCandidate.melodyGenomeId,
    )!
    const firstTiming = graph.tables.v1TimingProfiles.find(
      ({ id }) =>
        firstGenome.timing.kind === 'v1-compatibility' &&
        id === firstGenome.timing.timingProfileId,
    )!
    expect(firstCandidate.id).toBe(firstSource.id)
    expect(firstCandidate.candidateKind).toBe('migrated-v1')
    expect(firstCandidate.compatibilitySource.candidate).toEqual(firstSource)
    expect(firstGenome.rhythm.events.map(({ onsetTick, durationTicks, isRest }) => ({
      onsetTick,
      durationTicks,
      isRest,
    }))).toEqual(
      firstSource.melody.events.map(({ startTick, durationTicks, degree }) => ({
        onsetTick: startTick,
        durationTicks,
        isRest: degree === null,
      })),
    )
    expect(firstGenome.rhythm.events[0]!.eventId).toBe(
      migratedV1EventIdV2(firstSource.id, 0),
    )
    expect(firstGenome.rhythm.events.every(({ accent, tieToNext }) =>
      accent === 0 && !tieToNext)).toBe(true)
    expect(firstCandidate.renderedPhenotype.events.every(({ velocity }) =>
      velocity === 88 / 127)).toBe(true)
    expect(firstTiming).toMatchObject({
      sourceCandidateId: firstSource.id,
      sourceTicksPerBeat: 480,
      sourceGridTicks: 240,
      tempoBpm: 117,
      displayMeter: { numerator: 4, denominator: 4, beatGroups: [2, 2] },
      loopStartTick: 0,
      loopEndTick: 2_400,
      swing: { subdivisionTicks: 240, amountPermille: 500 },
    })
    expect(graph.tables.beats).toEqual([])
    expect(graph.tables.transports).toEqual([])
    expect(graph.tables.customScales).toEqual([])
    expect(graph.tables.performanceSettings).toHaveLength(1)
    expect(graph.tables.pairings.every(({ beatId }) => beatId === null)).toBe(true)

    expect(graph.tables.melodyCandidates).toHaveLength(7)
    expect(graph.tables.melodyGenomes).toHaveLength(7)
    expect(graph.tables.v1TimingProfiles).toHaveLength(7)
    expect(graph.tables.pairings).toHaveLength(7)
    expect(graph.tables.tonalTimelines.length).toBeLessThan(7)
    expect(
      new Set(graph.tables.melodyGenomes.map(({ tonalTimelineId }) => tonalTimelineId))
        .size,
    ).toBe(graph.tables.tonalTimelines.length)
    expectUniqueSortedTableIds(graph.tables)

    expect(root.libraryItemIds.map((id) =>
      graph.tables.libraryItems.find((item) => item.id === id)?.componentId)).toEqual(
      project.favorites.map(({ id }) => id),
    )
    expect(graph.tables.libraryItems.every((item) =>
      item.name === 'Untitled Melody' &&
      item.note === '' &&
      item.favorite &&
      item.savedAtEpochMs === null &&
      item.originReferences[0]?.kind === 'v1-favorite')).toBe(true)
    expect(Object.isFrozen(conversion)).toBe(true)
    expect(Object.isFrozen(graph.record.project)).toBe(true)
    expect(V1_MIGRATION_SPEC_SEAMS_V2).toHaveLength(5)
  })

  it('keeps project and candidate source scopes distinct while reusing candidate bytes', async () => {
    const project = fixtureProject('project-five-beat-history.v1.json')
    const candidate = fixtureCandidate('candidate-modern-five-beat.v1.json')
    const sha256 = new WebCryptoSha256()
    const projectEnvelopeHash = await computeV1SourceHash(
      sha256,
      'project-envelope-v1',
      project,
    )
    const localStorageHash = await computeV1SourceHash(
      sha256,
      'local-storage-project-v1',
      project,
    )
    const candidateHash = await computeV1SourceHash(
      sha256,
      'candidate-envelope-v1',
      candidate,
    )
    const [projectEnvelope, localStorage, preview] = await Promise.all([
      convertV1SourceV2({
        sourceKind: 'project-envelope-v1',
        sourceHash: projectEnvelopeHash,
        decodedV1: project,
        sha256,
      }),
      convertV1SourceV2({
        sourceKind: 'local-storage-project-v1',
        sourceHash: localStorageHash,
        decodedV1: project,
        sha256,
      }),
      convertV1CandidatePreviewV2({
        sourceKind: 'candidate-envelope-v1',
        sourceHash: candidateHash,
        decodedV1: candidate,
        sha256,
      }),
    ])
    if (!('graph' in projectEnvelope) || !('graph' in localStorage)) {
      throw new Error('Expected complete project conversions')
    }

    expect(projectEnvelope.sourceHash).not.toBe(localStorage.sourceHash)
    expect(projectEnvelope.projectId).not.toBe(localStorage.projectId)
    expect(
      stableStringify(projectEnvelope.graph.tables.melodyCandidates),
    ).toBe(stableStringify(localStorage.graph.tables.melodyCandidates))
    expect(preview.rootCandidateId).toBe(candidate.id)
    expect(preview.candidate.id).toBe(candidate.id)
    expect(preview.candidate.compatibilitySource.candidate).toEqual(candidate)
    expect(preview.pairing).toMatchObject({
      melodyCandidateId: candidate.id,
      beatId: null,
      performanceId: preview.performanceId,
    })
    expect(preview).not.toHaveProperty('projectId')
    expect(preview).not.toHaveProperty('rootSeed')
    expect(preview).not.toHaveProperty('graph')
    expect(preview).not.toHaveProperty('receipt')
    expect(
      stableStringify(preview.candidate),
    ).toBe(
      stableStringify(
        projectEnvelope.graph.tables.melodyCandidates.find(
          ({ id }) => id === candidate.id,
        ),
      ),
    )
  })

  it('preserves candidate-specific 96 and 480 PPQ profiles without rescaling', async () => {
    const project = fixtureProject('project-mixed-ppq-favorites.v1.json')
    const conversion = await projectConversion(project)
    const profilesByCandidate = new Map(
      conversion.graph.tables.v1TimingProfiles.map((profile) => [
        profile.sourceCandidateId,
        profile,
      ]),
    )

    expect(profilesByCandidate.get('candidate-v1-non-480-ppq')).toMatchObject({
      sourceTicksPerBeat: 96,
      sourceGridTicks: 48,
      gridTicks: 48,
      loopEndTick: 480,
    })
    expect(profilesByCandidate.get('candidate-v1-canonical-480-ppq')).toMatchObject({
      sourceTicksPerBeat: 480,
      sourceGridTicks: 240,
      gridTicks: 240,
      loopEndTick: 2_400,
    })
    expect(conversion.graph.tables.historyNodes).toEqual([])
    expect(conversion.graph.tables.snapshots).toEqual([])
    expect(conversion.graph.tables.historyGraphs[0]).toMatchObject({
      nextNodeOccurrence: 0,
      nodeIds: [],
      rootNodeIds: [],
      activeNodeId: null,
      v1LinearSource: {
        sourceHistoryLength: 0,
        sourceHistoryIndex: -1,
      },
    })
    expect(() => assertStoredProjectGraphV2(conversion.graph)).not.toThrow()
  })

  it('reads no clock or random source and replays byte-identically', async () => {
    const project = fixtureProject('project-favorites-only.v1.json')
    const sha256 = new WebCryptoSha256()
    const sourceHash = await computeV1SourceHash(
      sha256,
      'project-envelope-v1',
      project,
    )
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('migration read Math.random')
    })
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('migration read Date.now')
    })
    try {
      const first = await convertV1ProjectV2({
        sourceKind: 'project-envelope-v1',
        sourceHash,
        decodedV1: project,
        sha256,
      })
      const second = await convertV1ProjectV2({
        sourceKind: 'project-envelope-v1',
        sourceHash,
        decodedV1: project,
        sha256,
      })
      expect(stableStringify(first)).toBe(stableStringify(second))
    } finally {
      random.mockRestore()
      clock.mockRestore()
    }
  })

  it('rejects source-hash mismatch and same V1 candidate ID with unequal bytes', async () => {
    const project = fixtureProject('project-favorites-only.v1.json')
    const sha256 = new WebCryptoSha256()
    await expect(
      convertV1ProjectV2({
        sourceKind: 'project-envelope-v1',
        sourceHash: '0'.repeat(64),
        decodedV1: project,
        sha256,
      }),
    ).rejects.toBeInstanceOf(V1MigrationSourceHashMismatchError)

    const original = project.favorites[0]!
    const conflict: Candidate = {
      ...original,
      melody: {
        ...original.melody,
        constraints: {
          ...original.melody.constraints,
          tempoBpm: original.melody.constraints.tempoBpm + 1,
        },
      },
    }
    const collidingProject: ProjectState = {
      ...project,
      favorites: [original, conflict],
    }
    const sourceHash = await computeV1SourceHash(
      sha256,
      'project-envelope-v1',
      collidingProject,
    )
    await expect(
      convertV1ProjectV2({
        sourceKind: 'project-envelope-v1',
        sourceHash,
        decodedV1: collidingProject,
        sha256,
      }),
    ).rejects.toBeInstanceOf(V1MigrationCollisionError)
  })

  it('uses UTF-8 byte order when stable-unioning non-ASCII Library origins', () => {
    const sourceHash = 'a'.repeat(64)
    const make = (sourceId: string) =>
      createLibraryItemV2({
        kind: 'melody-candidate',
        componentId: 'candidate-shared',
        initialization: 'migrated-v1-favorite',
        origin: {
          kind: 'v1-favorite',
          projectId: 'project-unicode',
          historyNodeId: null,
          sourceHash,
          sourceId,
        },
      })
    const merged = mergeLibraryOriginsV2(make('\u{10000}'), make('\uE000'))

    // UTF-16 `<` gives the reverse order; canonical UTF-8 compares EE before F0.
    expect(merged.originReferences.map(({ sourceId }) => sourceId)).toEqual([
      '\uE000',
      '\u{10000}',
    ])
  })
})
