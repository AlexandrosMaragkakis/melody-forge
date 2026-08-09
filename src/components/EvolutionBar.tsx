import type { EvolutionSettings } from '../domain/types'

interface EvolutionBarProps {
  readonly settings: EvolutionSettings
  readonly selectedCount: number
  readonly loop: boolean
  readonly canGoBack: boolean
  readonly canGoForward: boolean
  readonly historyLabel: string
  readonly onSettingsChange: (settings: EvolutionSettings) => void
  readonly onLoopChange: (loop: boolean) => void
  readonly onEvolve: () => void
  readonly onBack: () => void
  readonly onForward: () => void
  readonly onStop: () => void
  readonly onExportProject: () => void
  readonly importInput: React.ReactNode
}

export function EvolutionBar({
  settings,
  selectedCount,
  loop,
  canGoBack,
  canGoForward,
  historyLabel,
  onSettingsChange,
  onLoopChange,
  onEvolve,
  onBack,
  onForward,
  onStop,
  onExportProject,
  importInput,
}: EvolutionBarProps) {
  const hasDescendantSlot =
    !settings.retainElites || settings.populationSize > selectedCount
  const evolveHelp =
    selectedCount > 0 && !hasDescendantSlot
      ? 'Increase the next population or disable elite retention to leave room for a descendant.'
      : selectedCount === 0
      ? 'Select one or two candidate cards as parents.'
      : selectedCount === 1
        ? 'Create mutated descendants from one parent.'
        : 'Cross both parents, then mutate their descendants.'

  return (
    <section className="evolution-bar" aria-labelledby="evolution-heading">
      <div className="section-heading evolution-title">
        <div>
          <p className="section-kicker">Shape the next round</p>
          <h2 id="evolution-heading">Evolution</h2>
        </div>
        <p className="parent-count" aria-live="polite">
          {selectedCount}/2 parents
        </p>
      </div>

      <div className="evolution-controls">
        <div className="field range-field mutation-field">
          <label htmlFor="mutation-strength">
            Mutation <output>{Math.round(settings.mutationStrength * 100)}%</output>
          </label>
          <input
            id="mutation-strength"
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.mutationStrength * 100)}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                mutationStrength: Number(event.target.value) / 100,
              })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="evolution-population">Next population</label>
          <input
            id="evolution-population"
            type="number"
            min={2}
            max={16}
            value={settings.populationSize}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                populationSize: Number(event.target.value),
              })
            }
          />
        </div>

        <label className="check-field">
          <input
            type="checkbox"
            checked={settings.retainElites}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                retainElites: event.target.checked,
              })
            }
          />
          Retain selected parents
        </label>

        <label className="check-field">
          <input
            type="checkbox"
            checked={loop}
            onChange={(event) => onLoopChange(event.target.checked)}
          />
          Loop playback
        </label>

        <button
          type="button"
          className="primary-action evolve-action"
          disabled={selectedCount === 0 || !hasDescendantSlot}
          aria-describedby="evolve-help"
          onClick={onEvolve}
        >
          Evolve next generation
        </button>
        <p id="evolve-help" className="control-help">
          {evolveHelp}
        </p>
      </div>

      <div className="workspace-tools">
        <div className="history-controls" aria-label="Generation history">
          <button type="button" disabled={!canGoBack} onClick={onBack}>
            ← Earlier
          </button>
          <span>{historyLabel}</span>
          <button type="button" disabled={!canGoForward} onClick={onForward}>
            Later →
          </button>
        </div>
        <div className="file-controls">
          <button type="button" onClick={onStop}>
            Stop audio
          </button>
          <button type="button" onClick={onExportProject}>
            Export project
          </button>
          {importInput}
        </div>
      </div>
    </section>
  )
}
