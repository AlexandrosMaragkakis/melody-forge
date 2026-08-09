import { IndexedDbSchemaError } from './indexedDbSchema'

export type IndexedDbPersistenceErrorCode =
  | 'blocked'
  | 'unavailable'
  | 'quota'
  | 'abort'
  | 'conflict'
  | 'immutable-collision'
  | 'not-found'
  | 'decode'
  | 'read-back'
  | 'upgrade'

export type IndexedDbPersistenceOperation =
  | 'open'
  | 'load-active-project'
  | 'load-project'
  | 'load-migration-receipt'
  | 'save-project'
  | 'install-and-activate-project'
  | 'activate-project'
  | 'stage-v1-migration'
  | 'activate-staged-migration'

export class IndexedDbPersistenceError extends Error {
  readonly code: IndexedDbPersistenceErrorCode
  readonly operation: IndexedDbPersistenceOperation

  constructor(
    code: IndexedDbPersistenceErrorCode,
    operation: IndexedDbPersistenceOperation,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'IndexedDbPersistenceError'
    this.code = code
    this.operation = operation
  }
}

export function indexedDbPersistenceError(
  code: IndexedDbPersistenceErrorCode,
  operation: IndexedDbPersistenceOperation,
  message: string,
  cause?: unknown,
): IndexedDbPersistenceError {
  return new IndexedDbPersistenceError(code, operation, message, cause)
}

export function normalizeIndexedDbError(
  error: unknown,
  operation: IndexedDbPersistenceOperation,
  fallbackCode: IndexedDbPersistenceErrorCode = 'abort',
  context = 'IndexedDB operation failed',
): IndexedDbPersistenceError {
  if (error instanceof IndexedDbPersistenceError) return error

  if (error instanceof IndexedDbSchemaError) {
    return indexedDbPersistenceError('upgrade', operation, error.message, error)
  }

  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String(error.name)
      : ''
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : context

  switch (name) {
    case 'QuotaExceededError':
      return indexedDbPersistenceError('quota', operation, message, error)
    case 'ConstraintError':
      return indexedDbPersistenceError(
        'immutable-collision',
        operation,
        message,
        error,
      )
    case 'VersionError':
      return indexedDbPersistenceError('upgrade', operation, message, error)
    case 'InvalidStateError':
    case 'NotSupportedError':
    case 'SecurityError':
      return indexedDbPersistenceError('unavailable', operation, message, error)
    case 'AbortError':
      return indexedDbPersistenceError('abort', operation, message, error)
    default:
      return indexedDbPersistenceError(
        fallbackCode,
        operation,
        message || context,
        error,
      )
  }
}
