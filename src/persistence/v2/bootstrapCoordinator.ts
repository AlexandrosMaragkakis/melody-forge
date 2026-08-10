import type { ProjectState } from '../../app/state'
import { createNewProjectKernelV2 } from '../../domain/v2/defaults'
import type {
  ActiveProjectMetadataV2,
  PersistableProjectGraphV2,
  StoredProjectGraphV2,
  StoredProjectRecordV2,
  V1MigrationReceiptV2,
} from '../../domain/v2/types'
import { decodeProjectEnvelope } from '../schema'
import { PROJECT_STORAGE_KEY } from '../storage'
import {
  loadUiPreferencesV2,
  type UiPreferencesRecordV2,
  type UiPreferencesStorageReaderV2,
} from '../uiPreferencesV2'
import type {
  ActivateProjectInputV2,
  ActivateStagedMigrationInputV2,
  InstallAndActivateProjectInputV2,
} from './indexedDbAuthority'
import {
  computeV1SourceHash,
  type Sha256,
} from './sourceHash'
import {
  convertV1ProjectV2,
  type V1ProjectConversionV2,
} from './v1Migration'
import {
  assertV1V2EquivalentV2,
  createV1ProjectEquivalenceReportV2,
  withReadBackGraphV2,
  type V1V2EquivalenceReportV2,
} from './v1Equivalence'

export type V2BootstrapOriginV2 =
  | 'active-v2'
  | 'migrated-v1'
  | 'resumed-v1'
  | 'fresh-v2'

export type V2BootstrapFailurePhaseV2 =
  | 'open-indexeddb'
  | 'load-active-project'
  | 'read-v1-source'
  | 'decode-v1-source'
  | 'hash-v1-source'
  | 'convert-v1-source'
  | 'verify-before-stage'
  | 'inspect-v1-stage'
  | 'stage-v1-migration'
  | 'load-v1-stage'
  | 'verify-after-readback'
  | 'activate-v1-migration'
  | 'create-fresh-kernel'
  | 'activate-fresh-kernel'
  | 'verify-active-project'

export interface V2BootstrapEquivalenceEvidenceV2 {
  readonly beforeStage: V1V2EquivalenceReportV2
  readonly afterReadback: V1V2EquivalenceReportV2
}

export interface V2BootstrapSuccessV2 {
  readonly ok: true
  readonly preferences: UiPreferencesRecordV2
  readonly preferenceWarning: string | null
  readonly graph: StoredProjectGraphV2
  readonly origin: V2BootstrapOriginV2
  readonly equivalence: V2BootstrapEquivalenceEvidenceV2 | null
}

export interface V2BootstrapFailureV2 {
  readonly ok: false
  readonly preferences: UiPreferencesRecordV2
  readonly preferenceWarning: string | null
  readonly phase: V2BootstrapFailurePhaseV2
  readonly error: V2BootstrapCoordinatorErrorV2
}

export type V2BootstrapResultV2 =
  | V2BootstrapSuccessV2
  | V2BootstrapFailureV2

export class V2BootstrapCoordinatorErrorV2 extends Error {
  readonly code = 'v2-bootstrap-failed' as const
  readonly phase: V2BootstrapFailurePhaseV2

  constructor(phase: V2BootstrapFailurePhaseV2, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`V2 bootstrap failed during ${phase}: ${detail}`, { cause })
    this.name = 'V2BootstrapCoordinatorErrorV2'
    this.phase = phase
  }
}

/** The coordinator depends on promises and domain values, never IDB events. */
export interface V2BootstrapProjectStoreV2 {
  open(): Promise<void>
  loadActiveProject(): Promise<StoredProjectGraphV2 | null>
  loadProject(projectId: string): Promise<StoredProjectGraphV2 | null>
  loadMigrationReceiptBySourceHash(
    sourceHash: string,
  ): Promise<V1MigrationReceiptV2 | null>
  installAndActivateProject(
    input: InstallAndActivateProjectInputV2,
  ): Promise<ActiveProjectMetadataV2>
  activateProject(
    input: ActivateProjectInputV2,
  ): Promise<ActiveProjectMetadataV2>
  stageV1Migration(
    graph: PersistableProjectGraphV2,
    pendingReceipt: V1MigrationReceiptV2,
    sourceEvidence: null,
  ): Promise<StoredProjectRecordV2>
  activateStagedMigration(
    input: ActivateStagedMigrationInputV2,
  ): Promise<ActiveProjectMetadataV2>
}

export interface V2BootstrapCoordinatorOptionsV2 {
  readonly storage: UiPreferencesStorageReaderV2
  readonly store: V2BootstrapProjectStoreV2
  readonly sha256: Sha256
  readonly projectIdFactory: () => string
  readonly metadataClock: () => number
}

async function inPhase<T>(
  phase: V2BootstrapFailurePhaseV2,
  operation: () => T | Promise<T>,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw new V2BootstrapCoordinatorErrorV2(phase, error)
  }
}

function decodeV1LocalStorageProject(rawSource: string): ProjectState {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawSource) as unknown
  } catch {
    throw new TypeError('V1 recovery data is not valid JSON')
  }
  const decoded = decodeProjectEnvelope(parsed)
  if (!decoded.ok) {
    throw new TypeError(`V1 recovery data is incompatible: ${decoded.error}`)
  }
  return decoded.value
}

function migrationReceipt(
  conversion: V1ProjectConversionV2,
): V1MigrationReceiptV2 {
  const matches = conversion.graph.tables.migrationReceipts.filter(
    ({ sourceHash }) => sourceHash === conversion.sourceHash,
  )
  if (matches.length !== 1 || matches[0] === undefined) {
    throw new TypeError('V1 conversion must contain exactly one matching receipt')
  }
  return matches[0]
}

function assertLoadedProject(
  graph: StoredProjectGraphV2 | null,
  projectId: string,
  context: string,
): StoredProjectGraphV2 {
  if (graph === null) {
    throw new TypeError(`${context} project ${projectId} is missing`)
  }
  if (graph.record.id !== projectId) {
    throw new TypeError(`${context} project ID differs from ${projectId}`)
  }
  return graph
}

async function verifyActiveProject(
  store: V2BootstrapProjectStoreV2,
  projectId: string,
): Promise<StoredProjectGraphV2> {
  return inPhase('verify-active-project', async () =>
    assertLoadedProject(
      await store.loadActiveProject(),
      projectId,
      'activated',
    ),
  )
}

async function bootstrapV1Project(
  options: V2BootstrapCoordinatorOptionsV2,
  rawSource: string,
): Promise<Pick<V2BootstrapSuccessV2, 'graph' | 'origin' | 'equivalence'>> {
  const source = await inPhase('decode-v1-source', () =>
    decodeV1LocalStorageProject(rawSource),
  )
  const sourceHash = await inPhase('hash-v1-source', () =>
    computeV1SourceHash(options.sha256, 'local-storage-project-v1', source),
  )
  const conversion = await inPhase('convert-v1-source', () =>
    convertV1ProjectV2({
      sourceKind: 'local-storage-project-v1',
      sourceHash,
      decodedV1: source,
      sha256: options.sha256,
    }),
  )
  const beforeStage = await inPhase('verify-before-stage', async () => {
    const result = await createV1ProjectEquivalenceReportV2(
      source,
      conversion,
      options.sha256,
      'before-stage',
    )
    assertV1V2EquivalentV2(result)
    return result
  })
  const pendingReceipt = await inPhase('convert-v1-source', () =>
    migrationReceipt(conversion),
  )
  const existingReceipt = await inPhase('inspect-v1-stage', () =>
    options.store.loadMigrationReceiptBySourceHash(sourceHash),
  )

  await inPhase('stage-v1-migration', () =>
    options.store.stageV1Migration(
      conversion.graph,
      pendingReceipt,
      null,
    ),
  )
  const stagedReceipt = await inPhase('inspect-v1-stage', async () => {
    const result =
      await options.store.loadMigrationReceiptBySourceHash(sourceHash)
    if (result === null) {
      throw new TypeError('staged V1 migration receipt is missing')
    }
    if (
      result.id !== pendingReceipt.id ||
      result.projectId !== conversion.projectId ||
      result.stagedRevision !== conversion.graph.record.revision
    ) {
      throw new TypeError('staged V1 migration receipt differs from conversion')
    }
    return result
  })
  const readBackGraph = await inPhase('load-v1-stage', async () =>
    assertLoadedProject(
      await options.store.loadProject(conversion.projectId),
      conversion.projectId,
      'staged',
    ),
  )
  const readBackConversion = withReadBackGraphV2(conversion, readBackGraph)
  const afterReadback = await inPhase('verify-after-readback', async () => {
    const result = await createV1ProjectEquivalenceReportV2(
      source,
      readBackConversion,
      options.sha256,
      'after-readback',
    )
    assertV1V2EquivalentV2(result)
    return result
  })

  await inPhase('activate-v1-migration', () =>
    stagedReceipt.status === 'pending-readback'
      ? options.store.activateStagedMigration({
          receiptId: stagedReceipt.id,
          projectId: conversion.projectId,
          expectedStagedRevision: readBackGraph.record.revision,
          expectedPriorActive: null,
        })
      : options.store.activateProject({
          projectId: conversion.projectId,
          expectedTargetRevision: readBackGraph.record.revision,
          expectedPriorActive: null,
        }),
  )

  return {
    graph: await verifyActiveProject(options.store, conversion.projectId),
    origin: existingReceipt === null ? 'migrated-v1' : 'resumed-v1',
    equivalence: { beforeStage, afterReadback },
  }
}

async function bootstrapFreshProject(
  options: V2BootstrapCoordinatorOptionsV2,
): Promise<Pick<V2BootstrapSuccessV2, 'graph' | 'origin' | 'equivalence'>> {
  const graph = await inPhase('create-fresh-kernel', () =>
    createNewProjectKernelV2({
      projectIdFactory: options.projectIdFactory,
      metadataClock: options.metadataClock,
    }),
  )
  await inPhase('activate-fresh-kernel', () =>
    options.store.installAndActivateProject({
      graph,
      expectedStoredRevision: null,
      expectedPriorActive: null,
      reason: 'native-create',
    }),
  )
  return {
    graph: await verifyActiveProject(options.store, graph.record.id),
    origin: 'fresh-v2',
    equivalence: null,
  }
}

/**
 * Coordinates the registered M2 persistence bootstrap without creating UI,
 * selectors, audio controllers, or a schema-1 write path.
 */
export async function runV2BootstrapCoordinator(
  options: V2BootstrapCoordinatorOptionsV2,
): Promise<V2BootstrapResultV2> {
  const loadedPreferences = loadUiPreferencesV2(options.storage)
  const preferences = loadedPreferences.value
  const preferenceWarning = loadedPreferences.ok
    ? null
    : loadedPreferences.error

  try {
    await inPhase('open-indexeddb', () => options.store.open())
    const activeGraph = await inPhase('load-active-project', () =>
      options.store.loadActiveProject(),
    )
    if (activeGraph !== null) {
      return {
        ok: true,
        preferences,
        preferenceWarning,
        graph: activeGraph,
        origin: 'active-v2',
        equivalence: null,
      }
    }

    const rawV1Source = await inPhase('read-v1-source', () =>
      options.storage.getItem(PROJECT_STORAGE_KEY),
    )
    const project =
      rawV1Source === null
        ? await bootstrapFreshProject(options)
        : await bootstrapV1Project(options, rawV1Source)
    return {
      ok: true,
      preferences,
      preferenceWarning,
      ...project,
    }
  } catch (error) {
    const failure =
      error instanceof V2BootstrapCoordinatorErrorV2
        ? error
        : new V2BootstrapCoordinatorErrorV2('load-active-project', error)
    return {
      ok: false,
      preferences,
      preferenceWarning,
      phase: failure.phase,
      error: failure,
    }
  }
}
