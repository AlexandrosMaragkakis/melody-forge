/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ProjectState } from '../../app/state'
import type { Candidate, GenerationSnapshot } from '../../domain/types'
import { decodeProjectEnvelope } from '../schema'
import {
  V1MigrationCollisionError,
  resolveV1HistoryParent,
  traverseUniqueV1Candidates,
  traverseUniqueV1Snapshots,
} from './v1Traversal'

const FIXTURES = join(process.cwd(), 'src/test/fixtures/v1')

function fixtureProject(name: string): ProjectState {
  const decoded = decodeProjectEnvelope(
    JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as unknown,
  )
  if (!decoded.ok) throw new Error(decoded.error)
  return decoded.value
}

function snapshot(
  id: string,
  previousGenerationId: string | null,
  candidates: readonly Candidate[] = [],
): GenerationSnapshot {
  return {
    id,
    generation: 0,
    seed: id,
    generatorVersion: 'modern-constrained-v1',
    candidates,
    selectedParentIds: [],
    evolutionSettings: null,
    previousGenerationId,
  }
}

describe('frozen V1 migration traversal', () => {
  it('uses active-population, history, then favorite first-seen order', () => {
    const project = fixtureProject('project-five-beat-history.v1.json')
    const traversal = traverseUniqueV1Candidates(project)

    expect(traversal.map(({ candidate }) => candidate.id)).toEqual([
      'candidate-2e3dbf51cb754063',
      'candidate-e7a7faaf8d22eb7e',
      'evolved-84da177b30089c00',
      'evolved-49303416fbb0c401',
      'candidate-afc0141f74faee53',
      'candidate-ba1b5a5c0d5dfc6d',
      'legacy-14d4a7dce6581503',
    ])
    expect(traversal[0]?.firstSeenAt).toEqual({
      kind: 'active-population',
      candidateOrdinal: 0,
    })
    expect(
      traversal.find(({ candidate }) => candidate.id.startsWith('legacy-'))
        ?.firstSeenAt,
    ).toEqual({ kind: 'favorite', favoriteOrdinal: 0 })
    expect(
      traversal.find(
        ({ candidate }) => candidate.id === 'evolved-84da177b30089c00',
      )?.occurrences,
    ).toEqual([
      { kind: 'active-population', candidateOrdinal: 2 },
      { kind: 'history', historyOrdinal: 1, candidateOrdinal: 2 },
      { kind: 'favorite', favoriteOrdinal: 1 },
    ])
  })

  it('accepts identical duplicates and rejects an ID with different bytes', () => {
    const project = fixtureProject('project-favorites-only.v1.json')
    const candidate = project.favorites[0]!
    const duplicateProject = {
      ...project,
      favorites: [candidate, candidate],
    }
    expect(traverseUniqueV1Candidates(duplicateProject)).toHaveLength(1)

    const conflict = {
      ...candidate,
      melody: {
        ...candidate.melody,
        constraints: {
          ...candidate.melody.constraints,
          tempoBpm: candidate.melody.constraints.tempoBpm + 1,
        },
      },
    }
    expect(() =>
      traverseUniqueV1Candidates({
        ...project,
        favorites: [candidate, conflict],
      }),
    ).toThrow(V1MigrationCollisionError)
  })

  it('deduplicates equal snapshot rows without losing occurrence ordinals', () => {
    const project = fixtureProject('project-five-beat-history.v1.json')
    const repeated = project.history[0]!
    const traversal = traverseUniqueV1Snapshots({
      ...project,
      history: [repeated, repeated],
      historyIndex: 1,
    })
    expect(traversal).toHaveLength(1)
    expect(traversal[0]?.sourceHistoryOrdinals).toEqual([0, 1])

    const conflictingSnapshot = {
      ...repeated,
      seed: `${repeated.seed}-different`,
    }
    expect(() =>
      traverseUniqueV1Snapshots({
        ...project,
        history: [repeated, conflictingSnapshot],
        historyIndex: 1,
      }),
    ).toThrow(V1MigrationCollisionError)
  })

  it('resolves the greatest earlier explicit link, then the stored fallback', () => {
    const history = [
      snapshot('repeat', null),
      snapshot('middle', 'repeat'),
      snapshot('repeat', 'missing'),
      snapshot('last', 'repeat'),
      snapshot('fallback', 'not-present'),
    ]

    expect(resolveV1HistoryParent(history, 0)).toEqual({
      parentHistoryOrdinal: null,
      resolution: 'root',
    })
    expect(resolveV1HistoryParent(history, 1)).toEqual({
      parentHistoryOrdinal: 0,
      resolution: 'source-previous-generation-id',
    })
    expect(resolveV1HistoryParent(history, 3)).toEqual({
      parentHistoryOrdinal: 2,
      resolution: 'source-previous-generation-id',
    })
    expect(resolveV1HistoryParent(history, 4)).toEqual({
      parentHistoryOrdinal: 3,
      resolution: 'stored-order-fallback',
    })
    expect(() => resolveV1HistoryParent(history, history.length)).toThrow(
      /identify a stored snapshot/u,
    )
  })
})
