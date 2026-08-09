import {
  WebCryptoSha256,
  assertLowercaseSha256,
  computeV1SourceHash,
  sha256BytesToHex,
  v1SourceHashInput,
  type Sha256,
} from './sourceHash'

describe('V1 source hashing', () => {
  it('hashes exact canonical decoded content with the source kind in scope', async () => {
    const decoded = {
      z: [3, 2, 1],
      nested: { beta: true, alpha: 'value' },
    }
    const reordered = {
      nested: { alpha: 'value', beta: true },
      z: [3, 2, 1],
    }
    const sha256 = new WebCryptoSha256()

    const projectHash = await computeV1SourceHash(
      sha256,
      'project-envelope-v1',
      decoded,
    )
    expect(projectHash).toBe(
      'cc1fc35d560e314a9c548be0e3d56630f88dc61933a7019415e0f4e38755a7b3',
    )
    expect(
      await computeV1SourceHash(
        sha256,
        'project-envelope-v1',
        reordered,
      ),
    ).toBe(projectHash)
    expect(
      await computeV1SourceHash(
        sha256,
        'candidate-envelope-v1',
        reordered,
      ),
    ).not.toBe(projectHash)
  })

  it('passes only the canonical UTF-8 bytes to an injected adapter', async () => {
    let received: Uint8Array | undefined
    const adapter: Sha256 = {
      digest(bytes) {
        received = new Uint8Array(bytes)
        return Promise.resolve(
          Uint8Array.from({ length: 32 }, (_, index) => index),
        )
      },
    }

    await expect(
      computeV1SourceHash(adapter, 'local-storage-project-v1', { id: 'v1' }),
    ).resolves.toBe(
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    )
    expect(new TextDecoder().decode(received)).toBe(
      '{"decodedV1":{"id":"v1"},"sourceKind":"local-storage-project-v1"}',
    )
  })

  it('rejects noncanonical identity input and malformed digest output', async () => {
    const sparse = Array(1)
    expect(() =>
      v1SourceHashInput('candidate-envelope-v1', sparse),
    ).toThrow(/arrays must be dense/u)
    expect(() => sha256BytesToHex(new Uint8Array(31))).toThrow(
      /exactly 32 bytes/u,
    )
    expect(() => assertLowercaseSha256('A'.repeat(64))).toThrow(
      /lowercase hexadecimal/u,
    )

    const invalidAdapter: Sha256 = {
      digest() {
        return Promise.resolve(new Uint8Array(33))
      },
    }
    await expect(
      computeV1SourceHash(invalidAdapter, 'candidate-envelope-v1', {}),
    ).rejects.toThrow(/exactly 32 bytes/u)
  })
})
