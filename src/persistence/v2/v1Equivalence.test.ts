/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ProjectState } from '../../app/state'
import type { Candidate } from '../../domain/types'
import type { StoredProjectGraphV2 } from '../../domain/v2/types'
import {
  decodeCandidateEnvelope,
  decodeProjectEnvelope,
} from '../schema'
import {
  WebCryptoSha256,
  computeV1SourceHash,
} from './sourceHash'
import {
  convertV1CandidatePreviewV2,
  convertV1ProjectV2,
} from './v1Migration'
import {
  V1V2EquivalenceError,
  assertV1V2EquivalentV2,
  createV1CandidatePreviewEquivalenceReportV2,
  createV1ProjectEquivalenceReportV2,
  withReadBackGraphV2,
} from './v1Equivalence'

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

async function convertProjectFixture(name: string) {
  const source = fixtureProject(name)
  const sha256 = new WebCryptoSha256()
  const sourceHash = await computeV1SourceHash(
    sha256,
    'project-envelope-v1',
    source,
  )
  const conversion = await convertV1ProjectV2({
    sourceKind: 'project-envelope-v1',
    sourceHash,
    decodedV1: source,
    sha256,
  })
  return { source, sha256, conversion }
}

function mismatches(report: Awaited<ReturnType<typeof createV1ProjectEquivalenceReportV2>>) {
  return [...report.fields, ...report.candidates.flatMap(({ fields }) => fields)]
    .filter(({ equivalent }) => !equivalent)
}

function mutableClone(graph: StoredProjectGraphV2): StoredProjectGraphV2 {
  return structuredClone(graph)
}

describe('explicit V1/V2 equivalence reporting', () => {
  it('proves a full project before staging with leaf-level non-hash evidence', async () => {
    const { source, sha256, conversion } = await convertProjectFixture(
      'project-five-beat-history.v1.json',
    )
    const report = await createV1ProjectEquivalenceReportV2(
      source,
      conversion,
      sha256,
      'before-stage',
    )
    const paths = [
      ...report.fields.map(({ path }) => path),
      ...report.candidates.flatMap(({ fields }) => fields.map(({ path }) => path)),
    ]

    expect(mismatches(report)).toEqual([])
    expect(report).toMatchObject({
      phase: 'before-stage',
      sourceKind: 'project-envelope-v1',
      sourceHash: conversion.sourceHash,
      projectId: conversion.projectId,
      equivalent: true,
    })
    expect(report.candidates).toHaveLength(7)
    expect(report.fields.length).toBeGreaterThan(150)
    expect(
      report.candidates.reduce((total, candidate) => total + candidate.fields.length, 0),
    ).toBeGreaterThan(1_000)
    expect(paths).toEqual(
      expect.arrayContaining([
        'project.legacySettings.seed',
        'project.modernSettings.seed',
        'project.loopEnabled',
        'project.history.activeIndex',
        'project.history.snapshotIdOrder[0]',
        'project.activePopulation.candidateIdOrder[0]',
        'project.favorites.candidateIdOrder[0]',
        'project.performance.factoryConstants.synth.envelope.attack',
        'project.performance.factoryConstants.synth.envelope.decay',
        'project.performance.factoryConstants.synth.envelope.sustain',
        'project.performance.factoryConstants.synth.envelope.release',
        'project.performance.factoryConstants.synth.portamento',
        'project.performance.factoryConstants.synth.volume',
        'project.performance.factoryConstants.triggerVelocity',
        'project.performance.factoryConstants.gate.minimumSeconds',
        'project.performance.factoryConstants.gate.sourceDurationMultiplier',
      ]),
    )
    expect(paths.some((path) => path.endsWith('.events.degrees[0]'))).toBe(true)
    expect(paths.some((path) => path.endsWith('.events.rests[5]'))).toBe(true)
    expect(paths.some((path) => path.endsWith('.timing.ppq'))).toBe(true)
    expect(paths.some((path) => path.endsWith('.timing.gridTicks'))).toBe(true)
    expect(paths.some((path) => path.endsWith('.timing.tempoBpm'))).toBe(true)
    expect(paths.some((path) => path.endsWith('.timing.loopEndpoint'))).toBe(true)
    expect(paths.some((path) => path.includes('.derivedMidi['))).toBe(true)
    expect(paths.some((path) => path.includes('.playbackPlan.events['))).toBe(true)
    expect(paths.some((path) => path.includes('.compatibilitySchedule['))).toBe(true)
    expect(paths.some((path) => path.includes('.directMidi.bytes['))).toBe(true)
    expect(paths.some((path) => path.endsWith('.fingerprints.input'))).toBe(true)
    expect(report.specSeams).toHaveLength(5)
    expect(mismatches(report)).toEqual([])
    expect(() => assertV1V2EquivalentV2(report)).not.toThrow()
    expect(Object.isFrozen(report)).toBe(true)
    expect(Object.isFrozen(report.candidates[0]?.fields)).toBe(true)
  })

  it('runs the same complete proof after a strict read-back clone', async () => {
    const { source, sha256, conversion } = await convertProjectFixture(
      'project-five-beat-history.v1.json',
    )
    const readBack = withReadBackGraphV2(
      conversion,
      structuredClone(conversion.graph),
    )
    const [before, after] = await Promise.all([
      createV1ProjectEquivalenceReportV2(
        source,
        conversion,
        sha256,
        'before-stage',
      ),
      createV1ProjectEquivalenceReportV2(
        source,
        readBack,
        sha256,
        'after-readback',
      ),
    ])

    expect(after.phase).toBe('after-readback')
    expect(after.equivalent).toBe(true)
    expect(after.fields).toEqual(before.fields)
    expect(after.candidates).toEqual(before.candidates)
  })

  it('reports candidate-envelope preview equivalence without project evidence', async () => {
    const source = fixtureCandidate('candidate-modern-non-480-ppq.v1.json')
    const sha256 = new WebCryptoSha256()
    const sourceHash = await computeV1SourceHash(
      sha256,
      'candidate-envelope-v1',
      source,
    )
    const closure = await convertV1CandidatePreviewV2({
      sourceKind: 'candidate-envelope-v1',
      sourceHash,
      decodedV1: source,
      sha256,
    })
    const report = await createV1CandidatePreviewEquivalenceReportV2(
      source,
      closure,
      sha256,
    )

    expect(report).toMatchObject({
      phase: 'candidate-preview',
      sourceKind: 'candidate-envelope-v1',
      projectId: null,
      equivalent: true,
    })
    expect(report.candidates).toHaveLength(1)
    expect(
      report.candidates[0]?.fields.find(({ path }) => path.endsWith('.timing.ppq')),
    ).toMatchObject({
      source: { present: true, value: 96 },
      migrated: { present: true, value: 96 },
      equivalent: true,
    })
    expect(() => assertV1V2EquivalentV2(report)).not.toThrow()
  })

  it('surfaces a deliberate cross-category mismatch matrix and leaves caller state untouched', async () => {
    const { source, sha256, conversion } = await convertProjectFixture(
      'project-five-beat-history.v1.json',
    )
    const graph = mutableClone(conversion.graph)
    ;(graph.record.project as unknown as { loopEnabled: boolean }).loopEnabled =
      false
    ;(
      graph.tables.createStates[0]!.legacySettings as unknown as { seed: string }
    ).seed = 'changed-legacy-seed'
    ;(
      graph.tables.historyGraphs[0]!.v1LinearSource as unknown as {
        sourceHistoryIndex: number
      }
    ).sourceHistoryIndex = 0
    const candidate = graph.tables.melodyCandidates.find(
      ({ id }) => id === 'candidate-2e3dbf51cb754063',
    )!
    ;(
      candidate.renderedPhenotype.events as unknown as Array<{ midi: number | null }>
    )[1]!.midi = 61
    const genome = graph.tables.melodyGenomes.find(
      ({ id }) => id === candidate.melodyGenomeId,
    )!
    if (genome.timing.kind !== 'v1-compatibility') {
      throw new Error('Expected compatibility timing')
    }
    const timingProfileId = genome.timing.timingProfileId
    const profile = graph.tables.v1TimingProfiles.find(
      ({ id }) => id === timingProfileId,
    )!
    ;(profile as unknown as { tempoBpm: number }).tempoBpm = 119
    const performance = graph.tables.performanceSettings[0]!
    ;(performance as unknown as { voiceFactoryId: string }).voiceFactoryId =
      'changed-factory'

    const activeState = { projectId: 'already-active', revision: 9 }
    const beforeActive = structuredClone(activeState)
    const report = await createV1ProjectEquivalenceReportV2(
      source,
      withReadBackGraphV2(conversion, graph),
      sha256,
      'after-readback',
    )
    const mismatchPaths = mismatches(report).map(({ path }) => path)

    expect(report.equivalent).toBe(false)
    expect(mismatchPaths).toEqual(
      expect.arrayContaining([
        'project.loopEnabled',
        'project.legacySettings.seed',
        'project.strategySeeds.legacy',
        'project.history.activeIndex',
        'project.performance.entity.voiceFactoryId',
      ]),
    )
    expect(mismatchPaths.some((path) => path.endsWith('.derivedMidi[1]'))).toBe(true)
    expect(mismatchPaths.some((path) => path.endsWith('.timing.tempoBpm'))).toBe(true)
    expect(mismatchPaths.some((path) => path.endsWith('.fingerprints.input'))).toBe(true)
    expect(() => assertV1V2EquivalentV2(report)).toThrow(V1V2EquivalenceError)
    expect(activeState).toEqual(beforeActive)
  })

  it('does not let unchanged hashes conceal an explicit non-hash mismatch', async () => {
    const { source, sha256, conversion } = await convertProjectFixture(
      'project-favorites-only.v1.json',
    )
    const graph = mutableClone(conversion.graph)
    ;(graph.record.project as unknown as { loopEnabled: boolean }).loopEnabled =
      !source.loop
    const report = await createV1ProjectEquivalenceReportV2(
      source,
      withReadBackGraphV2(conversion, graph),
      sha256,
      'after-readback',
    )

    expect(report.equivalent).toBe(false)
    expect(mismatches(report).map(({ path }) => path)).toContain(
      'project.loopEnabled',
    )
    expect(
      report.candidates
        .flatMap(({ fields }) => fields)
        .filter(({ path }) => path.includes('.fingerprints.'))
        .every(({ equivalent }) => equivalent),
    ).toBe(true)
  })

  it('turns a missing normalized candidate closure into an explicit mismatch', async () => {
    const { source, sha256, conversion } = await convertProjectFixture(
      'project-favorites-only.v1.json',
    )
    const graph = mutableClone(conversion.graph)
    ;(
      graph.tables as unknown as {
        melodyCandidates: typeof graph.tables.melodyCandidates
      }
    ).melodyCandidates = graph.tables.melodyCandidates.filter(
      ({ id }) => id !== source.favorites[0]!.id,
    )
    const report = await createV1ProjectEquivalenceReportV2(
      source,
      withReadBackGraphV2(conversion, graph),
      sha256,
      'after-readback',
    )

    expect(report.equivalent).toBe(false)
    expect(mismatches(report).map(({ path }) => path)).toContain(
      `candidates[0:${source.favorites[0]!.id}].normalizedClosure`,
    )
  })
})
