const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n
const FNV_PRIME_64 = 0x100000001b3n
const UINT64_MASK = 0xffffffffffffffffn

/**
 * Serialize JSON-compatible data with recursively sorted object keys.
 *
 * Candidate IDs must not depend on insertion order, locale, timestamps, or a
 * platform-specific object hash. Rejecting non-JSON values also keeps identity
 * inputs compatible with persistence and exported provenance.
 */
export function stableStringify(value: unknown): string {
  return serialize(value, new Set<object>())
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null) {
    return 'null'
  }

  switch (typeof value) {
    case 'boolean':
    case 'string':
      return JSON.stringify(value)
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError('Identity data must contain only finite numbers')
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value)
    case 'object':
      break
    default:
      throw new TypeError('Identity data must be JSON-compatible')
  }

  if (ancestors.has(value)) {
    throw new TypeError('Identity data must not contain cycles')
  }

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => serialize(item, ancestors)).join(',')}]`
    }

    const prototype = Reflect.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Identity data must contain only plain objects')
    }

    const record = value as Record<string, unknown>
    const entries = Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serialize(record[key], ancestors)}`,
      )
    return `{${entries.join(',')}}`
  } finally {
    ancestors.delete(value)
  }
}

/** A compact deterministic identifier for JSON-compatible domain data. */
export function stableId(prefix: string, value: unknown): string {
  if (!/^[a-z][a-z0-9-]*$/u.test(prefix)) {
    throw new TypeError('Identity prefix must be a lowercase slug')
  }

  const serialized = stableStringify(value)
  let hash = FNV_OFFSET_BASIS_64

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= BigInt(serialized.charCodeAt(index))
    hash = (hash * FNV_PRIME_64) & UINT64_MASK
  }

  return `${prefix}-${hash.toString(16).padStart(16, '0')}`
}
