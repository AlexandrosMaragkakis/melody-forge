import { historyGraphIdV2, historyNodeIdV2 } from './identities'
import { assertAlgorithmVersionRegistryV2 } from './registry'
import type {
  HistoryActionSummaryV2,
  HistoryGraphV2,
  HistoryModeV2,
  HistoryNodeV2,
  MigratedV1SnapshotPayloadV2,
  SnapshotV2,
  V1LinearHistoryGraphSourceV2,
  V1LinearHistoryNodeSourceV2,
} from './types'
import {
  booleanValue,
  deepFreezeV2,
  denseArray,
  enumValue,
  exactPlainObject,
  failSchemaV2,
  finiteNumber,
  literalValue,
  nonEmptyString,
  nullableNonEmptyString,
  safeInteger,
  sortedUniqueStringArray,
  stringValue,
  uniqueStringArray,
} from './validation'

const HISTORY_MODES = [
  'create',
  'breed',
  'drift',
  'islands',
  'map',
  'pareto',
  'pair-lab',
  'import',
  'transform',
] as const satisfies readonly HistoryModeV2[]

const HISTORY_ACTION_KINDS = [
  'generate',
  'evolve',
  'promote-anchor',
  'migrate-v1',
  'import',
  'transform',
] as const

function assertV1EvolutionSettings(
  value: unknown,
  path: string,
): void {
  const record = exactPlainObject(
    value,
    ['populationSize', 'mutationStrength', 'retainElites'],
    path,
  )
  safeInteger(record.populationSize, `${path}.populationSize`, 1, 16)
  const mutationStrength = finiteNumber(
    record.mutationStrength,
    `${path}.mutationStrength`,
  )
  if (mutationStrength < 0 || mutationStrength > 1) {
    failSchemaV2(
      'invalid-value',
      `${path}.mutationStrength`,
      'must be between zero and one',
    )
  }
  booleanValue(record.retainElites, `${path}.retainElites`)
}

function assertMigratedSnapshotPayload(
  value: unknown,
  path: string,
): MigratedV1SnapshotPayloadV2 {
  const record = exactPlainObject(
    value,
    ['version', 'sourceSeed', 'sourceGeneratorVersion', 'sourceEvolutionSettings'],
    path,
  )
  literalValue(
    record.version,
    'migrated-v1-snapshot-payload-v2',
    `${path}.version`,
  )
  const sourceSeed = stringValue(record.sourceSeed, `${path}.sourceSeed`)
  const sourceGeneratorVersion = stringValue(
    record.sourceGeneratorVersion,
    `${path}.sourceGeneratorVersion`,
  )
  if (record.sourceEvolutionSettings !== null) {
    assertV1EvolutionSettings(
      record.sourceEvolutionSettings,
      `${path}.sourceEvolutionSettings`,
    )
  }
  return {
    version: 'migrated-v1-snapshot-payload-v2',
    sourceSeed,
    sourceGeneratorVersion,
    sourceEvolutionSettings:
      record.sourceEvolutionSettings as MigratedV1SnapshotPayloadV2['sourceEvolutionSettings'],
  }
}

export function assertSnapshotV2(value: unknown): asserts value is SnapshotV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'projectId',
      'sourceKind',
      'mode',
      'generationOrdinal',
      'seed',
      'algorithmVersions',
      'candidateIds',
      'selectedCandidateIds',
      'ratingIds',
      'annotationIds',
      'payload',
    ],
    'snapshot',
  )
  stringValue(record.id, 'snapshot.id')
  literalValue(record.version, 'snapshot-v2', 'snapshot.version')
  nonEmptyString(record.projectId, 'snapshot.projectId')
  if (record.sourceKind !== 'migrated-v1') {
    failSchemaV2(
      'unregistered-version',
      'snapshot.sourceKind',
      'M2 registers only migrated-v1 snapshots',
    )
  }
  enumValue(record.mode, HISTORY_MODES, 'snapshot.mode')
  safeInteger(record.generationOrdinal, 'snapshot.generationOrdinal', 0)
  stringValue(record.seed, 'snapshot.seed')
  assertAlgorithmVersionRegistryV2(record.algorithmVersions)
  const candidateIds = uniqueStringArray(record.candidateIds, 'snapshot.candidateIds')
  if (candidateIds.length === 0 || candidateIds.length > 16) {
    failSchemaV2(
      'invalid-value',
      'snapshot.candidateIds',
      'migrated V1 snapshots must contain 1 through 16 candidates',
    )
  }
  const selectedCandidateIds = uniqueStringArray(
    record.selectedCandidateIds,
    'snapshot.selectedCandidateIds',
  )
  if (selectedCandidateIds.length > 2) {
    failSchemaV2(
      'invalid-value',
      'snapshot.selectedCandidateIds',
      'may contain at most two ordered selections',
    )
  }
  const candidateSet = new Set(candidateIds)
  selectedCandidateIds.forEach((id, index) => {
    if (!candidateSet.has(id)) {
      failSchemaV2(
        'unresolved-reference',
        `snapshot.selectedCandidateIds[${String(index)}]`,
        'must be a member of candidateIds',
      )
    }
  })
  const ratingIds = sortedUniqueStringArray(record.ratingIds, 'snapshot.ratingIds')
  const annotationIds = sortedUniqueStringArray(
    record.annotationIds,
    'snapshot.annotationIds',
  )
  if (ratingIds.length !== 0 || annotationIds.length !== 0) {
    failSchemaV2(
      'unregistered-version',
      'snapshot.ratingIds',
      'M2 migrated-V1 snapshots require empty rating and annotation sets',
    )
  }
  assertMigratedSnapshotPayload(record.payload, 'snapshot.payload')
}

function assertHistoryAction(
  value: unknown,
  path: string,
): HistoryActionSummaryV2 {
  const record = exactPlainObject(value, ['version', 'kind'], path)
  return {
    version: literalValue(
      record.version,
      'history-action-summary-v2',
      `${path}.version`,
    ),
    kind: enumValue(record.kind, HISTORY_ACTION_KINDS, `${path}.kind`),
  }
}

function assertV1GraphSource(
  value: unknown,
  path: string,
): V1LinearHistoryGraphSourceV2 {
  const record = exactPlainObject(
    value,
    ['version', 'sourceHistoryLength', 'sourceHistoryIndex'],
    path,
  )
  const sourceHistoryLength = safeInteger(
    record.sourceHistoryLength,
    `${path}.sourceHistoryLength`,
    0,
  )
  const sourceHistoryIndex = safeInteger(
    record.sourceHistoryIndex,
    `${path}.sourceHistoryIndex`,
    -1,
  )
  if (
    (sourceHistoryLength === 0 && sourceHistoryIndex !== -1) ||
    (sourceHistoryLength > 0 &&
      (sourceHistoryIndex < 0 || sourceHistoryIndex >= sourceHistoryLength))
  ) {
    failSchemaV2(
      'invalid-value',
      `${path}.sourceHistoryIndex`,
      'must be -1 for empty history or an index within source history',
    )
  }
  return {
    version: literalValue(
      record.version,
      'v1-linear-history-graph-source-v2',
      `${path}.version`,
    ),
    sourceHistoryLength,
    sourceHistoryIndex,
  }
}

function assertV1NodeSource(
  value: unknown,
  path: string,
): V1LinearHistoryNodeSourceV2 {
  const record = exactPlainObject(
    value,
    [
      'version',
      'sourceHistoryOrdinal',
      'sourceSnapshotId',
      'sourcePreviousGenerationId',
      'parentResolution',
    ],
    path,
  )
  return {
    version: literalValue(
      record.version,
      'v1-linear-history-node-source-v2',
      `${path}.version`,
    ),
    sourceHistoryOrdinal: safeInteger(
      record.sourceHistoryOrdinal,
      `${path}.sourceHistoryOrdinal`,
      0,
    ),
    sourceSnapshotId: stringValue(
      record.sourceSnapshotId,
      `${path}.sourceSnapshotId`,
    ),
    sourcePreviousGenerationId:
      record.sourcePreviousGenerationId === null
        ? null
        : stringValue(
            record.sourcePreviousGenerationId,
            `${path}.sourcePreviousGenerationId`,
          ),
    parentResolution: enumValue(
      record.parentResolution,
      [
        'root',
        'source-previous-generation-id',
        'stored-order-fallback',
      ] as const,
      `${path}.parentResolution`,
    ),
  }
}

export function assertHistoryGraphV2(
  value: unknown,
): asserts value is HistoryGraphV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'projectId',
      'nextNodeOccurrence',
      'nodeIds',
      'rootNodeIds',
      'activeNodeId',
      'v1LinearSource',
    ],
    'historyGraph',
  )
  literalValue(record.version, 'history-graph-v2', 'historyGraph.version')
  const projectId = nonEmptyString(record.projectId, 'historyGraph.projectId')
  const expectedId = historyGraphIdV2(projectId)
  if (record.id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'historyGraph.id',
      `must equal ${expectedId}`,
    )
  }
  const nodeIds = uniqueStringArray(record.nodeIds, 'historyGraph.nodeIds')
  safeInteger(record.nextNodeOccurrence, 'historyGraph.nextNodeOccurrence', 0)
  if (record.nextNodeOccurrence !== nodeIds.length) {
    failSchemaV2(
      'invalid-value',
      'historyGraph.nextNodeOccurrence',
      'must equal nodeIds.length',
    )
  }
  const rootNodeIds = uniqueStringArray(
    record.rootNodeIds,
    'historyGraph.rootNodeIds',
  )
  const nodeSet = new Set(nodeIds)
  rootNodeIds.forEach((id, index) => {
    if (!nodeSet.has(id)) {
      failSchemaV2(
        'unresolved-reference',
        `historyGraph.rootNodeIds[${String(index)}]`,
        'must be a nodeIds member',
      )
    }
  })
  const activeNodeId = nullableNonEmptyString(
    record.activeNodeId,
    'historyGraph.activeNodeId',
  )
  if (
    (nodeIds.length === 0 && activeNodeId !== null) ||
    (nodeIds.length > 0 &&
      (activeNodeId === null || !nodeSet.has(activeNodeId)))
  ) {
    failSchemaV2(
      'unresolved-reference',
      'historyGraph.activeNodeId',
      'must be null exactly for an empty graph and otherwise resolve in nodeIds',
    )
  }
  if (record.v1LinearSource !== null) {
    const source = assertV1GraphSource(
      record.v1LinearSource,
      'historyGraph.v1LinearSource',
    )
    if (source.sourceHistoryLength !== nodeIds.length) {
      failSchemaV2(
        'invalid-value',
        'historyGraph.v1LinearSource.sourceHistoryLength',
        'must equal the normalized occurrence count',
      )
    }
    const expectedActiveId =
      source.sourceHistoryIndex === -1
        ? null
        : nodeIds[source.sourceHistoryIndex] ?? null
    if (activeNodeId !== expectedActiveId) {
      failSchemaV2(
        'invalid-value',
        'historyGraph.activeNodeId',
        'must preserve v1LinearSource.sourceHistoryIndex exactly',
      )
    }
  }
}

export function assertHistoryNodeV2(
  value: unknown,
): asserts value is HistoryNodeV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'projectId',
      'historyGraphId',
      'occurrenceOrdinal',
      'parentNodeId',
      'snapshotId',
      'mode',
      'action',
      'v1LinearSource',
    ],
    'historyNode',
  )
  const nodeWithoutId: Omit<HistoryNodeV2, 'id'> = {
    version: literalValue(
      record.version,
      'history-node-v2',
      'historyNode.version',
    ),
    projectId: nonEmptyString(record.projectId, 'historyNode.projectId'),
    historyGraphId: nonEmptyString(
      record.historyGraphId,
      'historyNode.historyGraphId',
    ),
    occurrenceOrdinal: safeInteger(
      record.occurrenceOrdinal,
      'historyNode.occurrenceOrdinal',
      0,
    ),
    parentNodeId: nullableNonEmptyString(
      record.parentNodeId,
      'historyNode.parentNodeId',
    ),
    snapshotId: stringValue(record.snapshotId, 'historyNode.snapshotId'),
    mode: enumValue(record.mode, HISTORY_MODES, 'historyNode.mode'),
    action: assertHistoryAction(record.action, 'historyNode.action'),
    v1LinearSource:
      record.v1LinearSource === null
        ? null
        : assertV1NodeSource(
            record.v1LinearSource,
            'historyNode.v1LinearSource',
          ),
  }
  const expectedId = historyNodeIdV2(nodeWithoutId)
  if (record.id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'historyNode.id',
      `must equal ${expectedId}`,
    )
  }
}

export function assertHistoryGraphClosureV2(
  graph: HistoryGraphV2,
  nodes: readonly HistoryNodeV2[],
  snapshotIds?: ReadonlySet<string>,
): void {
  assertHistoryGraphV2(graph)
  denseArray(nodes, 'historyNodes')
  if (nodes.length !== graph.nodeIds.length) {
    failSchemaV2(
      'unresolved-reference',
      'historyNodes',
      'must contain exactly the graph node occurrences',
    )
  }
  const expectedRoots: string[] = []
  const seen = new Set<string>()
  nodes.forEach((node, index) => {
    assertHistoryNodeV2(node)
    const path = `historyNodes[${String(index)}]`
    if (node.id !== graph.nodeIds[index]) {
      failSchemaV2(
        'invalid-order',
        `${path}.id`,
        'must follow historyGraph.nodeIds occurrence order',
      )
    }
    if (
      node.projectId !== graph.projectId ||
      node.historyGraphId !== graph.id
    ) {
      failSchemaV2(
        'unresolved-reference',
        path,
        'must belong to the owning project and history graph',
      )
    }
    if (node.occurrenceOrdinal !== index) {
      failSchemaV2(
        'invalid-order',
        `${path}.occurrenceOrdinal`,
        'must equal its nodeIds occurrence index',
      )
    }
    if (node.parentNodeId === null) {
      expectedRoots.push(node.id)
    } else if (!seen.has(node.parentNodeId)) {
      failSchemaV2(
        'unresolved-reference',
        `${path}.parentNodeId`,
        'must resolve to an earlier occurrence',
      )
    }
    if (snapshotIds !== undefined && !snapshotIds.has(node.snapshotId)) {
      failSchemaV2(
        'unresolved-reference',
        `${path}.snapshotId`,
        'must resolve to a snapshot in the same graph',
      )
    }
    if (graph.v1LinearSource !== null) {
      if (
        node.v1LinearSource === null ||
        node.v1LinearSource.sourceHistoryOrdinal !== index
      ) {
        failSchemaV2(
          'invalid-value',
          `${path}.v1LinearSource`,
          'must preserve the matching V1 source ordinal',
        )
      }
      const source = node.v1LinearSource
      if (source.sourceSnapshotId !== node.snapshotId) {
        failSchemaV2(
          'invalid-value',
          `${path}.v1LinearSource.sourceSnapshotId`,
          'must equal the copied snapshot ID',
        )
      }
      if (node.action.kind !== 'migrate-v1') {
        failSchemaV2(
          'invalid-value',
          `${path}.action.kind`,
          'V1 history occurrences must record migrate-v1',
        )
      }
      if (index === 0) {
        if (node.parentNodeId !== null || source.parentResolution !== 'root') {
          failSchemaV2(
            'invalid-value',
            path,
            'V1 ordinal zero must be the sole root with root resolution',
          )
        }
      } else {
        if (node.parentNodeId === null || source.parentResolution === 'root') {
          failSchemaV2(
            'invalid-value',
            path,
            'later V1 occurrences require an earlier parent and non-root resolution',
          )
        }
        const matchingPrior = nodes
          .slice(0, index)
          .filter(
            (prior) =>
              prior.v1LinearSource?.sourceSnapshotId ===
              source.sourcePreviousGenerationId,
          )
          .at(-1)
        if (matchingPrior !== undefined) {
          if (
            source.parentResolution !== 'source-previous-generation-id' ||
            node.parentNodeId !== matchingPrior.id
          ) {
            failSchemaV2(
              'invalid-value',
              `${path}.parentNodeId`,
              'must select the greatest earlier matching source snapshot',
            )
          }
        } else if (
          source.parentResolution !== 'stored-order-fallback' ||
          node.parentNodeId !== nodes[index - 1]!.id
        ) {
          failSchemaV2(
            'invalid-value',
            `${path}.parentNodeId`,
            'must fall back to the preceding stored occurrence',
          )
        }
      }
    }
    seen.add(node.id)
  })
  if (
    expectedRoots.length !== graph.rootNodeIds.length ||
    expectedRoots.some((id, index) => graph.rootNodeIds[index] !== id)
  ) {
    failSchemaV2(
      'invalid-order',
      'historyGraph.rootNodeIds',
      'must be the relative-order subset of null-parent nodes',
    )
  }
}

export function createEmptyHistoryGraphV2(
  projectId: string,
  v1LinearSource: V1LinearHistoryGraphSourceV2 | null = null,
): HistoryGraphV2 {
  const graph: HistoryGraphV2 = {
    id: historyGraphIdV2(projectId),
    version: 'history-graph-v2',
    projectId,
    nextNodeOccurrence: 0,
    nodeIds: [],
    rootNodeIds: [],
    activeNodeId: null,
    v1LinearSource,
  }
  assertHistoryGraphV2(graph)
  return deepFreezeV2(graph)
}
