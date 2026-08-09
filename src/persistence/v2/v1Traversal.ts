import type { ProjectState } from '../../app/state'
import { stableStringify } from '../../domain/identity'
import type { Candidate, GenerationSnapshot } from '../../domain/types'

export type V1CandidateSourceLocation =
  | {
      readonly kind: 'active-population'
      readonly candidateOrdinal: number
    }
  | {
      readonly kind: 'history'
      readonly historyOrdinal: number
      readonly candidateOrdinal: number
    }
  | {
      readonly kind: 'favorite'
      readonly favoriteOrdinal: number
    }

export interface TraversedV1Candidate {
  readonly candidate: Candidate
  readonly canonicalBytes: string
  readonly firstSeenAt: V1CandidateSourceLocation
  readonly occurrences: readonly V1CandidateSourceLocation[]
}

export interface TraversedV1Snapshot {
  readonly snapshot: GenerationSnapshot
  readonly canonicalBytes: string
  readonly sourceHistoryOrdinals: readonly number[]
}

export type V1HistoryParentResolution =
  | {
      readonly parentHistoryOrdinal: null
      readonly resolution: 'root'
    }
  | {
      readonly parentHistoryOrdinal: number
      readonly resolution:
        | 'source-previous-generation-id'
        | 'stored-order-fallback'
    }

export class V1MigrationCollisionError extends Error {
  readonly code = 'v1-immutable-id-collision' as const
  readonly entityKind: 'candidate' | 'snapshot'
  readonly entityId: string

  constructor(entityKind: 'candidate' | 'snapshot', entityId: string) {
    super(
      `V1 ${entityKind} ID ${entityId} occurs with different canonical decoded bytes`,
    )
    this.name = 'V1MigrationCollisionError'
    this.entityKind = entityKind
    this.entityId = entityId
  }
}

interface MutableCandidateEntry {
  readonly candidate: Candidate
  readonly canonicalBytes: string
  readonly firstSeenAt: V1CandidateSourceLocation
  readonly occurrences: V1CandidateSourceLocation[]
}

function appendCandidate(
  entries: Map<string, MutableCandidateEntry>,
  candidate: Candidate,
  location: V1CandidateSourceLocation,
): void {
  const canonicalBytes = stableStringify(candidate)
  const existing = entries.get(candidate.id)
  if (existing === undefined) {
    entries.set(candidate.id, {
      candidate,
      canonicalBytes,
      firstSeenAt: location,
      occurrences: [location],
    })
    return
  }
  if (existing.canonicalBytes !== canonicalBytes) {
    throw new V1MigrationCollisionError('candidate', candidate.id)
  }
  existing.occurrences.push(location)
}

/**
 * Uses the frozen V1 migration order: active population, every stored history
 * snapshot, then favorites. Map insertion order therefore is receipt order.
 */
export function traverseUniqueV1Candidates(
  project: ProjectState,
): readonly TraversedV1Candidate[] {
  const entries = new Map<string, MutableCandidateEntry>()
  const activeSnapshot =
    project.historyIndex < 0
      ? undefined
      : project.history[project.historyIndex]

  activeSnapshot?.candidates.forEach((candidate, candidateOrdinal) => {
    appendCandidate(entries, candidate, {
      kind: 'active-population',
      candidateOrdinal,
    })
  })

  project.history.forEach((snapshot, historyOrdinal) => {
    snapshot.candidates.forEach((candidate, candidateOrdinal) => {
      appendCandidate(entries, candidate, {
        kind: 'history',
        historyOrdinal,
        candidateOrdinal,
      })
    })
  })

  project.favorites.forEach((candidate, favoriteOrdinal) => {
    appendCandidate(entries, candidate, {
      kind: 'favorite',
      favoriteOrdinal,
    })
  })

  return [...entries.values()].map((entry) => ({
    candidate: entry.candidate,
    canonicalBytes: entry.canonicalBytes,
    firstSeenAt: entry.firstSeenAt,
    occurrences: [...entry.occurrences],
  }))
}

/** Snapshot rows deduplicate by copied V1 ID while occurrences remain distinct. */
export function traverseUniqueV1Snapshots(
  project: ProjectState,
): readonly TraversedV1Snapshot[] {
  const entries = new Map<
    string,
    {
      snapshot: GenerationSnapshot
      canonicalBytes: string
      sourceHistoryOrdinals: number[]
    }
  >()

  project.history.forEach((snapshot, sourceHistoryOrdinal) => {
    const canonicalBytes = stableStringify(snapshot)
    const existing = entries.get(snapshot.id)
    if (existing === undefined) {
      entries.set(snapshot.id, {
        snapshot,
        canonicalBytes,
        sourceHistoryOrdinals: [sourceHistoryOrdinal],
      })
      return
    }
    if (existing.canonicalBytes !== canonicalBytes) {
      throw new V1MigrationCollisionError('snapshot', snapshot.id)
    }
    existing.sourceHistoryOrdinals.push(sourceHistoryOrdinal)
  })

  return [...entries.values()].map((entry) => ({
    snapshot: entry.snapshot,
    canonicalBytes: entry.canonicalBytes,
    sourceHistoryOrdinals: [...entry.sourceHistoryOrdinals],
  }))
}

/**
 * Resolves the V1 linear evidence without fabricating branches. A matching
 * previousGenerationId chooses the greatest earlier occurrence; otherwise the
 * immediately preceding stored occurrence is the deterministic fallback.
 */
export function resolveV1HistoryParent(
  history: readonly GenerationSnapshot[],
  sourceHistoryOrdinal: number,
): V1HistoryParentResolution {
  if (
    !Number.isSafeInteger(sourceHistoryOrdinal) ||
    sourceHistoryOrdinal < 0 ||
    sourceHistoryOrdinal >= history.length
  ) {
    throw new RangeError('sourceHistoryOrdinal must identify a stored snapshot')
  }
  if (sourceHistoryOrdinal === 0) {
    return { parentHistoryOrdinal: null, resolution: 'root' }
  }

  const previousGenerationId =
    history[sourceHistoryOrdinal]?.previousGenerationId ?? null
  if (previousGenerationId !== null) {
    for (let ordinal = sourceHistoryOrdinal - 1; ordinal >= 0; ordinal -= 1) {
      if (history[ordinal]?.id === previousGenerationId) {
        return {
          parentHistoryOrdinal: ordinal,
          resolution: 'source-previous-generation-id',
        }
      }
    }
  }

  return {
    parentHistoryOrdinal: sourceHistoryOrdinal - 1,
    resolution: 'stored-order-fallback',
  }
}
