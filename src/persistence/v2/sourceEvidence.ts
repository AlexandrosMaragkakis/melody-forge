import { stableId } from '../../domain/identity'
import {
  assertLowercaseSha256,
  sha256BytesToHex,
  type Sha256,
  type V1SourceKind,
} from './sourceHash'

export type ImportedV1SourceKind = Exclude<
  V1SourceKind,
  'local-storage-project-v1'
>

export interface V1SourceEvidenceRecordV2 {
  readonly id: string
  readonly version: 'v1-source-evidence-v1'
  readonly sourceKind: ImportedV1SourceKind
  readonly sourceHash: string
  readonly rawSha256: string
  readonly encoding: 'base64'
  readonly rawBase64: string
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function encodeRfc4648Base64(bytes: Uint8Array): string {
  let result = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const hasSecond = index + 1 < bytes.length
    const hasThird = index + 2 < bytes.length
    const second = bytes[index + 1] ?? 0
    const third = bytes[index + 2] ?? 0
    const value = (first << 16) | (second << 8) | third

    result += BASE64_ALPHABET[(value >>> 18) & 0x3f]
    result += BASE64_ALPHABET[(value >>> 12) & 0x3f]
    result += hasSecond ? BASE64_ALPHABET[(value >>> 6) & 0x3f] : '='
    result += hasThird ? BASE64_ALPHABET[value & 0x3f] : '='
  }
  return result
}

export async function createV1SourceEvidenceRecord(
  sha256: Sha256,
  sourceKind: ImportedV1SourceKind,
  sourceHash: string,
  rawBytes: Uint8Array,
): Promise<V1SourceEvidenceRecordV2> {
  assertLowercaseSha256(sourceHash)
  const rawSha256 = sha256BytesToHex(
    await sha256.digest(new Uint8Array(rawBytes)),
  )
  const identityInput = { sourceHash, rawSha256 }

  return {
    id: stableId('v1-source-evidence', identityInput),
    version: 'v1-source-evidence-v1',
    sourceKind,
    sourceHash,
    rawSha256,
    encoding: 'base64',
    rawBase64: encodeRfc4648Base64(rawBytes),
  }
}
