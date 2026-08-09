import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PROJECT_STORAGE_KEY } from '../persistence'
import { App } from './App'

const audioHarness = vi.hoisted(() => ({
  deferNextPlay: false,
  resolveNextPlay: null as (() => void) | null,
}))

vi.mock('../audio', () => {
  class FakePlaybackController {
    private listener:
      | ((snapshot: {
          status: string
          candidateId: string | null
          loop: boolean
          tempoBpm: number | null
        }) => void)
      | null = null
    private snapshot = {
      status: 'idle',
      candidateId: null as string | null,
      loop: false,
      tempoBpm: null as number | null,
    }

    subscribe(listener: typeof this.listener): () => void {
      this.listener = listener
      listener?.(this.snapshot)
      return () => {
        this.listener = null
      }
    }

    getSnapshot(): typeof this.snapshot {
      return { ...this.snapshot }
    }

    play(
      source: { readonly id: string; readonly melody: { readonly constraints: { readonly tempoBpm: number } } },
      options: { readonly loop?: boolean; readonly tempoBpm?: number },
    ): Promise<void> {
      if (audioHarness.deferNextPlay) {
        audioHarness.deferNextPlay = false
        this.snapshot = {
          status: 'initializing',
          candidateId: source.id,
          loop: options.loop ?? false,
          tempoBpm: options.tempoBpm ?? source.melody.constraints.tempoBpm,
        }
        this.listener?.(this.snapshot)
        return new Promise((resolve) => {
          audioHarness.resolveNextPlay = resolve
        })
      }
      this.snapshot = {
        status: 'playing',
        candidateId: source.id,
        loop: options.loop ?? false,
        tempoBpm: options.tempoBpm ?? source.melody.constraints.tempoBpm,
      }
      this.listener?.(this.snapshot)
      return Promise.resolve()
    }

    stop(): void {
      this.snapshot = { ...this.snapshot, status: 'idle', candidateId: null }
      this.listener?.(this.snapshot)
    }

    setLoop(loop: boolean): Promise<void> {
      this.snapshot = { ...this.snapshot, loop }
      this.listener?.(this.snapshot)
      return Promise.resolve()
    }

    setTempo(tempoBpm: number): Promise<void> {
      this.snapshot = { ...this.snapshot, tempoBpm }
      this.listener?.(this.snapshot)
      return Promise.resolve()
    }

    dispose(): void {
      this.stop()
    }
  }

  return {
    PlaybackController: FakePlaybackController,
    createTonePlaybackEngine: () => ({}),
  }
})

describe('essential browser workspace', () => {
  beforeEach(() => {
    audioHarness.deferNextPlay = false
    audioHarness.resolveNextPlay = null
  })

  it('generates, auditions, selects, evolves, favorites, and restores locally', async () => {
    const user = userEvent.setup()
    const firstRender = render(<App />)

    expect(screen.getByRole('heading', { name: 'Generate your first population' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Generate population' }))
    expect(await screen.findAllByRole('article')).toHaveLength(8)

    await user.click(screen.getByRole('button', { name: 'Play candidate 1' }))
    expect(screen.getByRole('button', { name: 'Stop candidate 1' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Stop candidate 1' }))
    expect(screen.getByRole('button', { name: 'Play candidate 1' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Play candidate 1' }))

    const parentChoices = screen.getAllByRole('checkbox', { name: 'Parent' })
    await user.click(parentChoices[0]!)
    await user.click(parentChoices[1]!)
    expect(screen.getByText('2/2 parents')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Evolve next generation' }))
    expect(await screen.findByText(/Generation 1 created with/)).toBeVisible()
    expect(screen.getAllByText(/Generation 1 · 2\/2/)).not.toHaveLength(0)

    await user.click(
      screen.getAllByRole('button', { name: 'Add candidate to favorites' })[0]!,
    )
    expect(screen.getByText('Saved to favorites locally.')).toBeVisible()
    expect(screen.getByText(/Favorites/)).toBeVisible()

    await waitFor(() => {
      expect(localStorage.length).toBe(1)
    })
    firstRender.unmount()
    render(<App />)

    expect(await screen.findAllByText(/Generation 1 · 2\/2/)).not.toHaveLength(0)
    expect(screen.getByText(/Favorites/)).toBeVisible()
  })

  it.each([
    {
      label: 'malformed',
      recoveryBytes: '{not-valid-json',
      notice: /Saved local data was not valid JSON/u,
    },
    {
      label: 'unsupported',
      recoveryBytes:
        '{"kind":"melody-forge-project","schemaVersion":99,"project":{}}',
      notice: /Saved local data was incompatible/u,
    },
  ])('never overwrites $label V1 recovery bytes with mounted defaults', async ({
    recoveryBytes,
    notice,
  }) => {
    const user = userEvent.setup()
    localStorage.setItem(PROJECT_STORAGE_KEY, recoveryBytes)

    render(<App />)

    expect(await screen.findByText(notice)).toBeVisible()
    expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(recoveryBytes)

    await user.click(screen.getByRole('button', { name: 'Generate population' }))
    expect(await screen.findAllByRole('article')).toHaveLength(8)
    await waitFor(() => {
      expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe(recoveryBytes)
    })
  })

  it('limits parent selection to two with visible feedback', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Generate population' }))
    const parentChoices = await screen.findAllByRole('checkbox', { name: 'Parent' })

    await user.click(parentChoices[0]!)
    await user.click(parentChoices[1]!)
    await user.click(parentChoices[2]!)

    expect(parentChoices[0]).toBeChecked()
    expect(parentChoices[1]).toBeChecked()
    expect(parentChoices[2]).not.toBeChecked()
    expect(screen.getByText(/Two parents are already selected/)).toBeVisible()
  })

  it('requires room for a descendant when both selected parents are retained', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Generate population' }))
    const parentChoices = await screen.findAllByRole('checkbox', { name: 'Parent' })
    await user.click(parentChoices[0]!)
    await user.click(parentChoices[1]!)
    const population = screen.getByRole('spinbutton', { name: 'Next population' })
    await user.clear(population)
    await user.type(population, '2')

    expect(screen.getByRole('button', { name: 'Evolve next generation' })).toBeDisabled()
    expect(screen.getByText(/leave room for a descendant/)).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Retain selected parents' }))
    expect(screen.getByRole('button', { name: 'Evolve next generation' })).toBeEnabled()
  })

  it('does not announce stale playback after Stop wins an initialization race', async () => {
    const user = userEvent.setup()
    audioHarness.deferNextPlay = true
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Generate population' }))

    await user.click(screen.getByRole('button', { name: 'Play candidate 1' }))
    await user.click(screen.getByRole('button', { name: 'Stop candidate 1' }))
    audioHarness.resolveNextPlay?.()

    await waitFor(() => {
      expect(screen.getByText('Playback stopped.')).toBeVisible()
      expect(screen.queryByText(/^Playing /)).not.toBeInTheDocument()
    })
  })

  it('exposes and restores the Modern constraint workflow', async () => {
    const user = userEvent.setup()
    const firstRender = render(<App />)

    await user.click(screen.getByRole('radio', { name: 'Modern' }))
    expect(screen.getByRole('combobox', { name: 'Rhythmic grid' })).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Scale' }), 'blues-minor')
    await user.clear(screen.getByRole('spinbutton', { name: 'Events' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Events' }), '6')
    await user.clear(screen.getByRole('spinbutton', { name: 'Phrase length' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Phrase length' }), '8')
    await user.click(screen.getByRole('checkbox', { name: 'Allow sparse rests' }))
    await user.clear(screen.getByRole('textbox', { name: 'Seed' }))
    await user.type(screen.getByRole('textbox', { name: 'Seed' }), 'modern-glass')
    await user.click(screen.getByRole('button', { name: 'Generate population' }))

    expect(screen.getAllByText('6 events')).toHaveLength(8)
    expect(screen.getAllByText('8 beats')).toHaveLength(8)
    expect(document.querySelectorAll('.origin-modern')).toHaveLength(8)
    firstRender.unmount()
    render(<App />)

    expect(screen.getByRole('radio', { name: 'Modern' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Scale' })).toHaveValue('blues-minor')
    expect(screen.getByRole('textbox', { name: 'Seed' })).toHaveValue('modern-glass')
  })
})
