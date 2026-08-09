import { downloadText, safeDownloadName, type DownloadEnvironment } from './download'

describe('browser downloads', () => {
  it('sanitizes filenames', () => {
    expect(safeDownloadName('  C# / favorite melody  ', '.MID')).toBe(
      'C-favorite-melody.mid',
    )
    expect(safeDownloadName('***', '')).toBe('melody-forge.bin')
  })

  it('clicks a temporary anchor and revokes the object URL', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const createObjectURL = vi.fn(() => 'blob:melody-fixture')
    const revokeObjectURL = vi.fn()
    let deferred: (() => void) | undefined
    const environment: DownloadEnvironment = {
      document,
      url: { createObjectURL, revokeObjectURL },
      defer: (callback) => {
        deferred = callback
      },
    }

    downloadText('{}', 'fixture.json', environment)

    expect(click).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download="fixture.json"]')).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    deferred?.()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:melody-fixture')
    click.mockRestore()
  })
})
