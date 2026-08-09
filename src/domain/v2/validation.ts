import { stableStringify } from '../identity'
import type { ReadonlyJsonObject, ReadonlyJsonValue } from './types'

export type SchemaV2IssueCode =
  | 'not-plain-object'
  | 'not-dense-array'
  | 'exact-keys'
  | 'invalid-value'
  | 'invalid-identity'
  | 'invalid-order'
  | 'duplicate-value'
  | 'unregistered-version'
  | 'unresolved-reference'

export interface SchemaV2Issue {
  readonly code: SchemaV2IssueCode
  readonly path: string
  readonly message: string
}

export class SchemaV2ValidationError extends TypeError {
  readonly issue: SchemaV2Issue

  constructor(code: SchemaV2IssueCode, path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'SchemaV2ValidationError'
    this.issue = { code, path, message }
  }
}

export function failSchemaV2(
  code: SchemaV2IssueCode,
  path: string,
  message: string,
): never {
  throw new SchemaV2ValidationError(code, path, message)
}

export function exactPlainObject(
  value: unknown,
  expectedKeys: readonly string[],
  path: string,
): Readonly<Record<string, unknown>> {
  const record = plainObject(value, path)
  const actualKeys = Reflect.ownKeys(record).map((key) => key as string)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return failSchemaV2(
      'exact-keys',
      path,
      `keys must be exactly ${expectedKeys.join(', ')} in that order; received ${actualKeys.join(', ')}`,
    )
  }
  return record
}

export function denseArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    return failSchemaV2('not-dense-array', path, 'must be a dense array')
  }
  const expectedKeys = Array.from(
    { length: value.length },
    (_, index) => String(index),
  )
  const ownKeys = Reflect.ownKeys(value)
  const dataKeys = ownKeys.filter((key) => key !== 'length')
  if (
    dataKeys.length !== expectedKeys.length ||
    dataKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return failSchemaV2(
      'not-dense-array',
      path,
      'must contain only dense indexed entries',
    )
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index))
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return failSchemaV2(
        'not-dense-array',
        `${path}[${String(index)}]`,
        'array entries must be enumerable own data properties',
      )
    }
  }
  return value
}

export function plainObject(
  value: unknown,
  path: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failSchemaV2('not-plain-object', path, 'must be a plain object')
  }
  const prototype = Reflect.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return failSchemaV2('not-plain-object', path, 'must be a plain object')
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      return failSchemaV2(
        'exact-keys',
        path,
        'symbol keys are not valid serialized fields',
      )
    }
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key)
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return failSchemaV2(
        'exact-keys',
        `${path}.${key}`,
        'fields must be enumerable own data properties',
      )
    }
  }
  return value as Readonly<Record<string, unknown>>
}

export function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    return failSchemaV2('invalid-value', path, 'must be a string')
  }
  return value
}

export function nonEmptyString(value: unknown, path: string): string {
  const text = stringValue(value, path)
  if (text.length === 0) {
    return failSchemaV2('invalid-value', path, 'must not be empty')
  }
  return text
}

export function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    return failSchemaV2('invalid-value', path, 'must be a boolean')
  }
  return value
}

export function nullValue(value: unknown, path: string): null {
  if (value !== null) {
    return failSchemaV2('invalid-value', path, 'must be exactly null')
  }
  return null
}

export function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return failSchemaV2('invalid-value', path, 'must be a finite number')
  }
  return value
}

export function safeInteger(
  value: unknown,
  path: string,
  minimum = Number.MIN_SAFE_INTEGER,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    return failSchemaV2(
      'invalid-value',
      path,
      `must be a safe integer from ${String(minimum)} through ${String(maximum)}`,
    )
  }
  return value
}

export function literalValue<T extends string | number | boolean>(
  value: unknown,
  expected: T,
  path: string,
): T {
  if (value !== expected) {
    return failSchemaV2(
      'invalid-value',
      path,
      `must be exactly ${JSON.stringify(expected)}`,
    )
  }
  return expected
}

export function enumValue<const T extends readonly (string | number)[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number] {
  if (!allowed.some((entry) => entry === value)) {
    return failSchemaV2(
      'invalid-value',
      path,
      `must be one of ${allowed.map(String).join(', ')}`,
    )
  }
  return value as T[number]
}

export function nullableNonEmptyString(
  value: unknown,
  path: string,
): string | null {
  return value === null ? null : nonEmptyString(value, path)
}

export function nullableEpochMilliseconds(
  value: unknown,
  path: string,
): number | null {
  return value === null ? null : safeInteger(value, path, 0)
}

export function lowercaseSha256(value: unknown, path: string): string {
  const digest = stringValue(value, path)
  if (!/^[0-9a-f]{64}$/u.test(digest)) {
    return failSchemaV2(
      'invalid-value',
      path,
      'must be a 64-character lowercase hexadecimal SHA-256 digest',
    )
  }
  return digest
}

export function unicodeScalarLength(value: string, path: string): number {
  let count = 0
  for (const scalar of value) {
    const codePoint = scalar.codePointAt(0)
    if (
      codePoint === undefined ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      return failSchemaV2(
        'invalid-value',
        path,
        'must contain only Unicode scalar values',
      )
    }
    count += 1
  }
  return count
}

export function boundedUnicodeString(
  value: unknown,
  maximumScalars: number,
  path: string,
): string {
  const text = stringValue(value, path)
  if (unicodeScalarLength(text, path) > maximumScalars) {
    return failSchemaV2(
      'invalid-value',
      path,
      `must contain at most ${String(maximumScalars)} Unicode scalar values`,
    )
  }
  return text
}

export function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0)!)
  const rightPoints = Array.from(right, (value) => value.codePointAt(0)!)
  const count = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < count; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!
    if (difference !== 0) return difference
  }
  return leftPoints.length - rightPoints.length
}

export function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  const count = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < count; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!
    if (difference !== 0) return difference
  }
  return leftBytes.length - rightBytes.length
}

export function assertUniqueStrings(
  values: readonly string[],
  path: string,
): void {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    if (seen.has(value)) {
      failSchemaV2(
        'duplicate-value',
        `${path}[${String(index)}]`,
        `duplicates ${JSON.stringify(value)}`,
      )
    }
    seen.add(value)
  })
}

export function stringArray(value: unknown, path: string): readonly string[] {
  const array = denseArray(value, path)
  return array.map((entry, index) =>
    nonEmptyString(entry, `${path}[${String(index)}]`),
  )
}

export function uniqueStringArray(
  value: unknown,
  path: string,
): readonly string[] {
  const array = stringArray(value, path)
  assertUniqueStrings(array, path)
  return array
}

export function sortedUniqueStringArray(
  value: unknown,
  path: string,
): readonly string[] {
  const array = uniqueStringArray(value, path)
  for (let index = 1; index < array.length; index += 1) {
    if (compareUnicodeCodePoints(array[index - 1]!, array[index]!) >= 0) {
      return failSchemaV2(
        'invalid-order',
        `${path}[${String(index)}]`,
        'must be strictly sorted in Unicode code-point order',
      )
    }
  }
  return array
}

export function assertReadonlyJsonValue(
  value: unknown,
  path: string,
  ancestors: Set<object> = new Set<object>(),
): asserts value is ReadonlyJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return
  }
  if (typeof value === 'number') {
    finiteNumber(value, path)
    return
  }
  if (typeof value !== 'object') {
    failSchemaV2('invalid-value', path, 'must contain finite JSON only')
  }
  if (ancestors.has(value)) {
    failSchemaV2('invalid-value', path, 'must not contain cycles')
  }
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      denseArray(value, path).forEach((entry, index) => {
        assertReadonlyJsonValue(entry, `${path}[${String(index)}]`, ancestors)
      })
      return
    }
    const record = plainObject(value, path)
    Reflect.ownKeys(record).forEach((key) => {
      assertReadonlyJsonValue(record[key as string], `${path}.${String(key)}`, ancestors)
    })
  } finally {
    ancestors.delete(value)
  }
}

export function assertReadonlyJsonObject(
  value: unknown,
  path: string,
): asserts value is ReadonlyJsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    failSchemaV2('not-plain-object', path, 'must be a finite JSON object')
  }
  assertReadonlyJsonValue(value, path)
}

export function sameJsonValue(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right)
}

export function deepFreezeV2<T>(value: T): Readonly<T> {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  Object.values(value as Record<string, unknown>).forEach((entry) => {
    deepFreezeV2(entry)
  })
  return Object.freeze(value)
}
