import { stableStringify } from '../../domain/identity'

export type V1SourceKind =
  | 'local-storage-project-v1'
  | 'project-envelope-v1'
  | 'candidate-envelope-v1'

export interface Sha256 {
  digest(bytes: Uint8Array): Promise<Uint8Array>
}

const SHA256_BYTE_LENGTH = 32
const LOWERCASE_SHA256_PATTERN = /^[0-9a-f]{64}$/u

export function assertLowercaseSha256(value: string): void {
  if (!LOWERCASE_SHA256_PATTERN.test(value)) {
    throw new TypeError('SHA-256 values must be 64 lowercase hexadecimal characters')
  }
}

export function sha256BytesToHex(bytes: Uint8Array): string {
  if (bytes.byteLength !== SHA256_BYTE_LENGTH) {
    throw new RangeError('SHA-256 adapters must return exactly 32 bytes')
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function v1SourceHashInput(
  sourceKind: V1SourceKind,
  decodedV1: unknown,
): Uint8Array {
  return new TextEncoder().encode(
    stableStringify({ sourceKind, decodedV1 }),
  )
}

export async function computeV1SourceHash(
  sha256: Sha256,
  sourceKind: V1SourceKind,
  decodedV1: unknown,
): Promise<string> {
  const digest = await sha256.digest(v1SourceHashInput(sourceKind, decodedV1))
  const result = sha256BytesToHex(digest)
  assertLowercaseSha256(result)
  return result
}

export class WebCryptoSha256 implements Sha256 {
  readonly #subtle: SubtleCrypto

  constructor(subtle: SubtleCrypto = globalThis.crypto.subtle) {
    this.#subtle = subtle
  }

  async digest(bytes: Uint8Array): Promise<Uint8Array> {
    const source = new Uint8Array(bytes)
    const digest = await this.#subtle.digest('SHA-256', source)
    return new Uint8Array(digest)
  }
}
