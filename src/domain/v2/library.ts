import { stableStringify } from '../identity'
import {
  annotationIdV2,
  libraryItemIdV2,
  ratingIdV2,
  undoStateIdV2,
} from './identities'
import type {
  AnnotationV2,
  LibraryItemV2,
  LibraryOriginReferenceV2,
  RatingV2,
  UndoStateV2,
  UserMetadataTargetKindV2,
} from './types'
import {
  booleanValue,
  boundedUnicodeString,
  compareUtf8,
  deepFreezeV2,
  denseArray,
  enumValue,
  exactPlainObject,
  failSchemaV2,
  literalValue,
  lowercaseSha256,
  nonEmptyString,
  nullableEpochMilliseconds,
  nullableNonEmptyString,
  safeInteger,
} from './validation'

const LIBRARY_KINDS = ['melody-candidate', 'beat', 'pairing'] as const
const METADATA_TARGET_KINDS = LIBRARY_KINDS
const ORIGIN_KINDS = ['project-save', 'v1-favorite', 'json-import'] as const
function assertOrigin(
  value: unknown,
  path: string,
): LibraryOriginReferenceV2 {
  const record = exactPlainObject(
    value,
    ['kind', 'projectId', 'historyNodeId', 'sourceHash', 'sourceId'],
    path,
  )
  const kind = enumValue(record.kind, ORIGIN_KINDS, `${path}.kind`)
  const projectId = nullableNonEmptyString(record.projectId, `${path}.projectId`)
  const historyNodeId = nullableNonEmptyString(
    record.historyNodeId,
    `${path}.historyNodeId`,
  )
  const sourceHash =
    record.sourceHash === null
      ? null
      : lowercaseSha256(record.sourceHash, `${path}.sourceHash`)
  const sourceId = nonEmptyString(record.sourceId, `${path}.sourceId`)

  if (projectId === null) {
    failSchemaV2(
      'invalid-value',
      `${path}.projectId`,
      `${kind} requires retained project evidence`,
    )
  }
  if (kind === 'project-save' && sourceHash !== null) {
    failSchemaV2(
      'invalid-value',
      `${path}.sourceHash`,
      'project-save requires a null source hash',
    )
  }
  if (kind !== 'project-save' && sourceHash === null) {
    failSchemaV2(
      'invalid-value',
      `${path}.sourceHash`,
      `${kind} requires a source hash`,
    )
  }

  return { kind, projectId, historyNodeId, sourceHash, sourceId }
}

function normalizedOrigins(
  values: readonly LibraryOriginReferenceV2[],
): readonly LibraryOriginReferenceV2[] {
  const byBytes = new Map<string, LibraryOriginReferenceV2>()
  values.forEach((origin) => {
    const key = stableStringify(origin)
    byBytes.set(key, origin)
  })
  return [...byBytes.entries()]
    .sort(([left], [right]) => compareUtf8(left, right))
    .map(([, origin]) => origin)
}

function assertOrigins(
  value: unknown,
  path: string,
): readonly LibraryOriginReferenceV2[] {
  const origins = denseArray(value, path).map((origin, index) =>
    assertOrigin(origin, `${path}[${String(index)}]`),
  )
  const canonical = origins.map(stableStringify)
  canonical.forEach((bytes, index) => {
    if (index === 0) return
    const order = compareUtf8(canonical[index - 1]!, bytes)
    if (order >= 0) {
      failSchemaV2(
        order === 0 ? 'duplicate-value' : 'invalid-order',
        `${path}[${String(index)}]`,
        'origins must be duplicate-free and sorted by stableStringify UTF-8 bytes',
      )
    }
  })
  return origins
}

export function assertLibraryItemV2(
  value: unknown,
): asserts value is LibraryItemV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'kind',
      'componentId',
      'name',
      'note',
      'favorite',
      'savedAtEpochMs',
      'originReferences',
    ],
    'libraryItem',
  )
  literalValue(record.version, 'library-item-v2', 'libraryItem.version')
  const kind = enumValue(record.kind, LIBRARY_KINDS, 'libraryItem.kind')
  const componentId = nonEmptyString(record.componentId, 'libraryItem.componentId')
  boundedUnicodeString(record.name, 80, 'libraryItem.name')
  boundedUnicodeString(record.note, 280, 'libraryItem.note')
  booleanValue(record.favorite, 'libraryItem.favorite')
  nullableEpochMilliseconds(record.savedAtEpochMs, 'libraryItem.savedAtEpochMs')
  assertOrigins(record.originReferences, 'libraryItem.originReferences')
  const expectedId = libraryItemIdV2({
    version: 'library-item-v2',
    kind,
    componentId,
  })
  if (record.id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'libraryItem.id',
      `must equal ${expectedId}`,
    )
  }
}

export type LibraryItemInitializationV2 =
  | 'migrated-v1-favorite'
  | 'save'
  | 'favorite'

export interface CreateLibraryItemV2Options {
  readonly kind: LibraryItemV2['kind']
  readonly componentId: string
  readonly origin: LibraryOriginReferenceV2
  readonly initialization: LibraryItemInitializationV2
  readonly metadataClock?: () => number
}

export function createLibraryItemV2(
  options: CreateLibraryItemV2Options,
): LibraryItemV2 {
  const origin = assertOrigin(options.origin, 'libraryItem.originReferences[0]')
  const migrated = options.initialization === 'migrated-v1-favorite'
  let savedAtEpochMs: number | null = null
  if (!migrated) {
    if (options.metadataClock === undefined) {
      failSchemaV2(
        'invalid-value',
        'metadataClock',
        'native/import Save and Favorite require an injected metadata clock',
      )
    }
    savedAtEpochMs = safeInteger(options.metadataClock(), 'metadataClock()', 0)
  }
  const value: LibraryItemV2 = {
    id: libraryItemIdV2({
      version: 'library-item-v2',
      kind: options.kind,
      componentId: options.componentId,
    }),
    version: 'library-item-v2',
    kind: options.kind,
    componentId: options.componentId,
    name: 'Untitled Melody',
    note: '',
    favorite: options.initialization !== 'save',
    savedAtEpochMs,
    originReferences: normalizedOrigins([origin]),
  }
  assertLibraryItemV2(value)
  return deepFreezeV2(value)
}

export function mergeLibraryOriginsV2(
  existing: LibraryItemV2,
  incoming: LibraryItemV2,
): LibraryItemV2 {
  assertLibraryItemV2(existing)
  assertLibraryItemV2(incoming)
  if (
    existing.id !== incoming.id ||
    existing.kind !== incoming.kind ||
    existing.componentId !== incoming.componentId
  ) {
    failSchemaV2(
      'invalid-identity',
      'libraryItem',
      'only equal Library identities may merge',
    )
  }
  const merged: LibraryItemV2 = {
    ...existing,
    originReferences: normalizedOrigins([
      ...existing.originReferences,
      ...incoming.originReferences,
    ]),
  }
  assertLibraryItemV2(merged)
  return deepFreezeV2(merged)
}

export function assertRatingV2(value: unknown): asserts value is RatingV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'projectId', 'targetKind', 'targetId', 'value'],
    'rating',
  )
  literalValue(record.version, 'rating-v2', 'rating.version')
  const projectId = nonEmptyString(record.projectId, 'rating.projectId')
  const targetKind = enumValue(
    record.targetKind,
    METADATA_TARGET_KINDS,
    'rating.targetKind',
  )
  const targetId = nonEmptyString(record.targetId, 'rating.targetId')
  enumValue(record.value, [1, 2, 3, 4, 5] as const, 'rating.value')
  const expectedId = ratingIdV2({
    version: 'rating-v2',
    projectId,
    targetKind,
    targetId,
  })
  if (record.id !== expectedId) {
    failSchemaV2('invalid-identity', 'rating.id', `must equal ${expectedId}`)
  }
}

export function assertAnnotationV2(
  value: unknown,
): asserts value is AnnotationV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'projectId', 'targetKind', 'targetId', 'text'],
    'annotation',
  )
  literalValue(record.version, 'annotation-v2', 'annotation.version')
  const projectId = nonEmptyString(record.projectId, 'annotation.projectId')
  const targetKind = enumValue(
    record.targetKind,
    METADATA_TARGET_KINDS,
    'annotation.targetKind',
  )
  const targetId = nonEmptyString(record.targetId, 'annotation.targetId')
  boundedUnicodeString(record.text, 280, 'annotation.text')
  const expectedId = annotationIdV2({
    version: 'annotation-v2',
    projectId,
    targetKind,
    targetId,
  })
  if (record.id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'annotation.id',
      `must equal ${expectedId}`,
    )
  }
}

export function createRatingV2(
  projectId: string,
  targetKind: UserMetadataTargetKindV2,
  targetId: string,
  value: RatingV2['value'],
): RatingV2 {
  const rating: RatingV2 = {
    id: ratingIdV2({ version: 'rating-v2', projectId, targetKind, targetId }),
    version: 'rating-v2',
    projectId,
    targetKind,
    targetId,
    value,
  }
  assertRatingV2(rating)
  return deepFreezeV2(rating)
}

export function createAnnotationV2(
  projectId: string,
  targetKind: UserMetadataTargetKindV2,
  targetId: string,
  text: string,
): AnnotationV2 {
  const annotation: AnnotationV2 = {
    id: annotationIdV2({
      version: 'annotation-v2',
      projectId,
      targetKind,
      targetId,
    }),
    version: 'annotation-v2',
    projectId,
    targetKind,
    targetId,
    text,
  }
  assertAnnotationV2(annotation)
  return deepFreezeV2(annotation)
}

export function assertUndoStateV2(value: unknown): asserts value is UndoStateV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'projectId',
      'nextOccurrence',
      'undoEntries',
      'redoEntries',
    ],
    'undoState',
  )
  literalValue(record.version, 'undo-state-v2', 'undoState.version')
  const projectId = nonEmptyString(record.projectId, 'undoState.projectId')
  const nextOccurrence = safeInteger(
    record.nextOccurrence,
    'undoState.nextOccurrence',
    0,
  )
  const undoEntries = denseArray(record.undoEntries, 'undoState.undoEntries')
  const redoEntries = denseArray(record.redoEntries, 'undoState.redoEntries')
  if (undoEntries.length !== 0 || redoEntries.length !== 0) {
    failSchemaV2(
      'unregistered-version',
      'undoState',
      'M2 registers no reversible command/path codec; only empty stacks are accepted',
    )
  }
  if (nextOccurrence !== 0) {
    failSchemaV2(
      'unregistered-version',
      'undoState.nextOccurrence',
      'must remain zero until a reversible command/path codec is registered',
    )
  }
  const expectedId = undoStateIdV2(projectId)
  if (record.id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'undoState.id',
      `must equal ${expectedId}`,
    )
  }
}

export function createEmptyUndoStateV2(projectId: string): UndoStateV2 {
  const state: UndoStateV2 = {
    id: undoStateIdV2(projectId),
    version: 'undo-state-v2',
    projectId,
    nextOccurrence: 0,
    undoEntries: [],
    redoEntries: [],
  }
  assertUndoStateV2(state)
  return deepFreezeV2(state)
}
