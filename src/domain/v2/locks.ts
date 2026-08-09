import { stableId, stableStringify } from '../identity'
import type {
  AbsolutePitchLockV2,
  ComponentLockV2,
  EventLockV2,
  LockSetV2,
  RegionLockV2,
} from './types'
import {
  deepFreezeV2,
  denseArray,
  enumValue,
  exactPlainObject,
  failSchemaV2,
  literalValue,
  lowercaseSha256,
  nonEmptyString,
  safeInteger,
  sortedUniqueStringArray,
} from './validation'

const COMPONENT_LOCK_KINDS = [
  'relative-pitch-shape',
  'rhythm',
  'contour',
  'opening-event',
  'closing-event',
  'rest-positions',
  'tonal-context',
  'tonic',
  'scale',
] as const

const EVENT_LOCK_SCOPES = ['pitch', 'rhythm', 'both'] as const

export const EMPTY_LOCK_SET_V2 = deepFreezeV2({
  version: 'lock-set-v2',
  componentLocks: [],
  absolutePitchLock: null,
  eventLocks: [],
  regionLocks: [],
} as const satisfies LockSetV2)

function assertLockId(
  id: unknown,
  identityValue: Readonly<Record<string, unknown>>,
  path: string,
): string {
  const actual = nonEmptyString(id, `${path}.id`)
  const expected = stableId('lock', identityValue)
  if (actual !== expected) {
    failSchemaV2('invalid-identity', `${path}.id`, `must equal ${expected}`)
  }
  return actual
}

function assertComponentLock(
  value: unknown,
  path: string,
): ComponentLockV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'kind', 'capturedEventIds', 'sourceFingerprint'],
    path,
  )
  literalValue(record.version, 'component-lock-v2', `${path}.version`)
  const kind = enumValue(record.kind, COMPONENT_LOCK_KINDS, `${path}.kind`)
  const capturedEventIds = sortedUniqueStringArray(
    record.capturedEventIds,
    `${path}.capturedEventIds`,
  )
  if (
    (kind === 'opening-event' || kind === 'closing-event') &&
    capturedEventIds.length !== 1
  ) {
    failSchemaV2(
      'invalid-value',
      `${path}.capturedEventIds`,
      `${kind} must capture exactly one sounding event`,
    )
  }
  if (
    (kind === 'tonal-context' || kind === 'tonic' || kind === 'scale') &&
    capturedEventIds.length !== 0
  ) {
    failSchemaV2(
      'invalid-value',
      `${path}.capturedEventIds`,
      `${kind} must not capture event IDs`,
    )
  }
  const sourceFingerprint = lowercaseSha256(
    record.sourceFingerprint,
    `${path}.sourceFingerprint`,
  )
  const identityValue = {
    version: 'component-lock-v2',
    kind,
    capturedEventIds,
    sourceFingerprint,
  } as const
  return {
    id: assertLockId(record.id, identityValue, path),
    ...identityValue,
  }
}

function assertAbsolutePitchLock(
  value: unknown,
  path: string,
): AbsolutePitchLockV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'requirements', 'sourceFingerprint'],
    path,
  )
  literalValue(record.version, 'absolute-pitch-lock-v2', `${path}.version`)
  const requirements = denseArray(record.requirements, `${path}.requirements`).map(
    (entry, index) => {
      const requirementPath = `${path}.requirements[${String(index)}]`
      const requirement = exactPlainObject(
        entry,
        ['eventId', 'midi'],
        requirementPath,
      )
      return {
        eventId: nonEmptyString(
          requirement.eventId,
          `${requirementPath}.eventId`,
        ),
        midi: safeInteger(requirement.midi, `${requirementPath}.midi`, 0, 127),
      }
    },
  )
  if (requirements.length === 0) {
    failSchemaV2(
      'invalid-value',
      `${path}.requirements`,
      'must contain at least one requirement',
    )
  }
  requirements.forEach((requirement, index) => {
    if (
      index > 0 &&
      requirements[index - 1]!.eventId >= requirement.eventId
    ) {
      failSchemaV2(
        requirements[index - 1]!.eventId === requirement.eventId
          ? 'duplicate-value'
          : 'invalid-order',
        `${path}.requirements[${String(index)}].eventId`,
        'requirements must be unique and event-ID-sorted',
      )
    }
  })
  const sourceFingerprint = lowercaseSha256(
    record.sourceFingerprint,
    `${path}.sourceFingerprint`,
  )
  const identityValue = {
    version: 'absolute-pitch-lock-v2',
    requirements,
    sourceFingerprint,
  } as const
  return {
    id: assertLockId(record.id, identityValue, path),
    ...identityValue,
  }
}

function assertEventLock(value: unknown, path: string): EventLockV2 {
  const record = exactPlainObject(
    value,
    ['id', 'version', 'eventId', 'scope', 'sourceFingerprint'],
    path,
  )
  literalValue(record.version, 'event-lock-v2', `${path}.version`)
  const identityValue = {
    version: 'event-lock-v2',
    eventId: nonEmptyString(record.eventId, `${path}.eventId`),
    scope: enumValue(record.scope, EVENT_LOCK_SCOPES, `${path}.scope`),
    sourceFingerprint: lowercaseSha256(
      record.sourceFingerprint,
      `${path}.sourceFingerprint`,
    ),
  } as const
  return {
    id: assertLockId(record.id, identityValue, path),
    ...identityValue,
  }
}

function assertRegionLock(value: unknown, path: string): RegionLockV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'startTick',
      'endTick',
      'scope',
      'capturedEventIds',
      'sourceFingerprint',
    ],
    path,
  )
  literalValue(record.version, 'region-lock-v2', `${path}.version`)
  const startTick = safeInteger(record.startTick, `${path}.startTick`, 0)
  const endTick = safeInteger(record.endTick, `${path}.endTick`, 1)
  if (endTick <= startTick) {
    failSchemaV2(
      'invalid-value',
      `${path}.endTick`,
      'must be greater than startTick',
    )
  }
  const identityValue = {
    version: 'region-lock-v2',
    startTick,
    endTick,
    scope: enumValue(record.scope, EVENT_LOCK_SCOPES, `${path}.scope`),
    capturedEventIds: sortedUniqueStringArray(
      record.capturedEventIds,
      `${path}.capturedEventIds`,
    ),
    sourceFingerprint: lowercaseSha256(
      record.sourceFingerprint,
      `${path}.sourceFingerprint`,
    ),
  } as const
  return {
    id: assertLockId(record.id, identityValue, path),
    ...identityValue,
  }
}

function assertLockArrayOrder(
  locks: readonly { readonly id: string }[],
  path: string,
): void {
  locks.forEach((lock, index) => {
    if (index > 0 && locks[index - 1]!.id >= lock.id) {
      failSchemaV2(
        locks[index - 1]!.id === lock.id
          ? 'duplicate-value'
          : 'invalid-order',
        `${path}[${String(index)}].id`,
        'locks must be unique and sorted by embedded ID',
      )
    }
  })
}

export function assertLockSetV2(value: unknown): asserts value is LockSetV2 {
  const record = exactPlainObject(
    value,
    [
      'version',
      'componentLocks',
      'absolutePitchLock',
      'eventLocks',
      'regionLocks',
    ],
    'locks',
  )
  literalValue(record.version, 'lock-set-v2', 'locks.version')
  const componentLocks = denseArray(
    record.componentLocks,
    'locks.componentLocks',
  ).map((entry, index) =>
    assertComponentLock(entry, `locks.componentLocks[${String(index)}]`),
  )
  const eventLocks = denseArray(record.eventLocks, 'locks.eventLocks').map(
    (entry, index) =>
      assertEventLock(entry, `locks.eventLocks[${String(index)}]`),
  )
  const regionLocks = denseArray(record.regionLocks, 'locks.regionLocks').map(
    (entry, index) =>
      assertRegionLock(entry, `locks.regionLocks[${String(index)}]`),
  )
  const absolutePitchLock =
    record.absolutePitchLock === null
      ? null
      : assertAbsolutePitchLock(record.absolutePitchLock, 'locks.absolutePitchLock')

  assertLockArrayOrder(componentLocks, 'locks.componentLocks')
  assertLockArrayOrder(eventLocks, 'locks.eventLocks')
  assertLockArrayOrder(regionLocks, 'locks.regionLocks')

  const componentKinds = new Set<string>()
  componentLocks.forEach((lock, index) => {
    if (componentKinds.has(lock.kind)) {
      failSchemaV2(
        'duplicate-value',
        `locks.componentLocks[${String(index)}].kind`,
        `component kind ${lock.kind} may appear only once`,
      )
    }
    componentKinds.add(lock.kind)
  })

  const allIds = [
    ...componentLocks.map(({ id }) => id),
    ...(absolutePitchLock === null ? [] : [absolutePitchLock.id]),
    ...eventLocks.map(({ id }) => id),
    ...regionLocks.map(({ id }) => id),
  ]
  if (new Set(allIds).size !== allIds.length) {
    failSchemaV2(
      'duplicate-value',
      'locks',
      'all embedded lock IDs must be unique across the set',
    )
  }
}

export function assertEmptyMigratedV1LockSetV2(
  value: unknown,
): asserts value is LockSetV2 {
  assertLockSetV2(value)
  if (stableStringify(value) !== stableStringify(EMPTY_LOCK_SET_V2)) {
    failSchemaV2(
      'unregistered-version',
      'locks',
      'M2 accepts only the exact empty migrated-V1 lock set',
    )
  }
}
