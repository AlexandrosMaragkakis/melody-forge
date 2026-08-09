import {
  createV1SourceEvidenceRecord,
  encodeRfc4648Base64,
} from './sourceEvidence'
import { WebCryptoSha256 } from './sourceHash'

describe('V1 raw source evidence', () => {
  it('encodes RFC 4648 standard base64 with padding and no whitespace', () => {
    const encoder = new TextEncoder()
    expect(encodeRfc4648Base64(encoder.encode(''))).toBe('')
    expect(encodeRfc4648Base64(encoder.encode('f'))).toBe('Zg==')
    expect(encodeRfc4648Base64(encoder.encode('fo'))).toBe('Zm8=')
    expect(encodeRfc4648Base64(encoder.encode('foo'))).toBe('Zm9v')
    expect(encodeRfc4648Base64(encoder.encode('foobar'))).toBe('Zm9vYmFy')
  })

  it('builds deterministic imported evidence without retaining mutable bytes', async () => {
    const rawBytes = new TextEncoder().encode('{"schemaVersion":1}\n')
    const record = await createV1SourceEvidenceRecord(
      new WebCryptoSha256(),
      'project-envelope-v1',
      'cc1fc35d560e314a9c548be0e3d56630f88dc61933a7019415e0f4e38755a7b3',
      rawBytes,
    )

    expect(record).toEqual({
      id: 'v1-source-evidence-5929aa2e297c19ae',
      version: 'v1-source-evidence-v1',
      sourceKind: 'project-envelope-v1',
      sourceHash:
        'cc1fc35d560e314a9c548be0e3d56630f88dc61933a7019415e0f4e38755a7b3',
      rawSha256:
        '80f3d90666804a9335821cdb40782458835ffedaef33088bd1dc5eb3ef85ce61',
      encoding: 'base64',
      rawBase64: 'eyJzY2hlbWFWZXJzaW9uIjoxfQo=',
    })

    rawBytes.fill(0)
    expect(record.rawBase64).toBe('eyJzY2hlbWFWZXJzaW9uIjoxfQo=')
  })

  it('rejects a noncanonical source hash before hashing raw bytes', async () => {
    await expect(
      createV1SourceEvidenceRecord(
        new WebCryptoSha256(),
        'candidate-envelope-v1',
        'A'.repeat(64),
        new Uint8Array(),
      ),
    ).rejects.toThrow(/lowercase hexadecimal/u)
  })
})
