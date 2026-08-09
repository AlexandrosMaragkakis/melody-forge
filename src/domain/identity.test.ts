import { stableId, stableStringify } from './identity'

describe('stable identity', () => {
  it('sorts object keys recursively while retaining array order', () => {
    const first = {
      z: [{ beta: 2, alpha: 1 }, 'tail'],
      a: true,
    }
    const reordered = {
      a: true,
      z: [{ alpha: 1, beta: 2 }, 'tail'],
    }

    expect(stableStringify(first)).toBe(stableStringify(reordered))
    expect(stableId('candidate', first)).toBe(stableId('candidate', reordered))
    expect(stableId('candidate', [1, 2])).not.toBe(
      stableId('candidate', [2, 1]),
    )
  })

  it('is deterministic and changes with musical content', () => {
    const input = { degree: -6, durationTicks: 480 }

    expect(stableId('candidate', input)).toBe(stableId('candidate', input))
    expect(stableId('candidate', input)).toMatch(/^candidate-[0-9a-f]{16}$/u)
    expect(stableId('candidate', input)).not.toBe(
      stableId('candidate', { degree: -5, durationTicks: 480 }),
    )
  })

  it('rejects values that cannot be represented safely in exported JSON', () => {
    expect(() => stableStringify(Number.NaN)).toThrow(TypeError)
    expect(() => stableStringify({ missing: undefined })).toThrow(TypeError)
    expect(() => stableStringify(new Date())).toThrow(TypeError)

    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic
    expect(() => stableStringify(cyclic)).toThrow(TypeError)
    expect(() => stableId('Not Valid', {})).toThrow(TypeError)
  })
})
