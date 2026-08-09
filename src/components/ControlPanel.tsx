import { pitchClassName } from '../domain/pitch'
import type { GeneratorMode } from '../app/types'
import {
  SCALE_CATALOGUE,
  SCALE_FAMILIES,
  type ScaleFamily,
  type ScaleId,
} from '../domain/scales'
import type { LegacyGeneratorSettings } from '../generators/legacy'
import {
  MODERN_GRID_OPTIONS,
  type ModernGridTicks,
  type ModernSettings,
} from '../generators/modern'

interface ControlPanelProps {
  readonly mode: GeneratorMode
  readonly legacy: LegacyGeneratorSettings
  readonly modern: ModernSettings
  readonly onModeChange: (mode: GeneratorMode) => void
  readonly onLegacyChange: (settings: LegacyGeneratorSettings) => void
  readonly onModernChange: (settings: ModernSettings) => void
  readonly onGenerate: () => void
}

const FAMILY_NAMES: Readonly<Record<ScaleFamily, string>> = {
  diatonic: 'Diatonic modes',
  'harmonic-minor': 'Harmonic-minor modes',
  'melodic-minor': 'Melodic-minor modes',
  pentatonic: 'Pentatonic',
  blues: 'Blues',
  symmetric: 'Symmetric',
}

const GRID_NAMES: Readonly<Record<ModernGridTicks, string>> = {
  120: 'Sixteenth notes',
  240: 'Eighth notes',
  480: 'Quarter notes',
}

function ScaleSelect({
  value,
  onChange,
}: {
  readonly value: ScaleId
  readonly onChange: (value: ScaleId) => void
}) {
  return (
    <select
      id="scale"
      value={value}
      onChange={(event) => onChange(event.target.value as ScaleId)}
    >
      {SCALE_FAMILIES.map((family) => (
        <optgroup key={family} label={FAMILY_NAMES[family]}>
          {SCALE_CATALOGUE.filter((scale) => scale.family === family).map(
            (scale) => (
              <option key={scale.id} value={scale.id}>
                {scale.displayName}
              </option>
            ),
          )}
        </optgroup>
      ))}
    </select>
  )
}

export function ControlPanel({
  mode,
  legacy,
  modern,
  onModeChange,
  onLegacyChange,
  onModernChange,
  onGenerate,
}: ControlPanelProps) {
  const active = mode === 'legacy' ? legacy : modern

  function updateCommon<K extends 'tonicPitchClass' | 'scaleId' | 'tempoBpm' | 'noteCount' | 'populationSize' | 'seed'>(
    key: K,
    value: (LegacyGeneratorSettings & ModernSettings)[K],
  ): void {
    if (mode === 'legacy') {
      onLegacyChange({ ...legacy, [key]: value })
    } else {
      onModernChange({ ...modern, [key]: value })
    }
  }

  return (
    <section className="control-panel" aria-labelledby="generator-heading">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Start a population</p>
          <h2 id="generator-heading">Generator</h2>
        </div>
        <fieldset className="strategy-switch">
          <legend className="sr-only">Generator strategy</legend>
          <label className={mode === 'legacy' ? 'is-active' : ''}>
            <input
              type="radio"
              name="strategy"
              value="legacy"
              checked={mode === 'legacy'}
              onChange={() => onModeChange('legacy')}
            />
            Legacy
          </label>
          <label className={mode === 'modern' ? 'is-active' : ''}>
            <input
              type="radio"
              name="strategy"
              value="modern"
              checked={mode === 'modern'}
              onChange={() => onModeChange('modern')}
            />
            Modern
          </label>
        </fieldset>
      </div>

      <p className="strategy-description">
        {mode === 'legacy'
          ? 'Independent scale tones in the original fixed C4–B4 octave, with tonic endpoints.'
          : 'Tonic-relative phrases shaped by a rhythmic grid, compact leaps, contour, and motif echoes.'}
      </p>

      <div className="control-grid">
        <div className="field">
          <label htmlFor="tonic">Tonic</label>
          <select
            id="tonic"
            value={active.tonicPitchClass}
            onChange={(event) =>
              updateCommon('tonicPitchClass', Number(event.target.value))
            }
          >
            {Array.from({ length: 12 }, (_, pitchClass) => (
              <option key={pitchClass} value={pitchClass}>
                {pitchClassName(pitchClass)}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-wide">
          <label htmlFor="scale">Scale</label>
          <ScaleSelect
            value={active.scaleId}
            onChange={(scaleId) => updateCommon('scaleId', scaleId)}
          />
        </div>

        <div className="field">
          <label htmlFor="notes">Events</label>
          <input
            id="notes"
            type="number"
            min={4}
            max={32}
            value={active.noteCount}
            onChange={(event) => updateCommon('noteCount', Number(event.target.value))}
          />
        </div>

        <div className="field">
          <label htmlFor="tempo">Tempo</label>
          <div className="input-suffix">
            <input
              id="tempo"
              type="number"
              min={40}
              max={240}
              value={active.tempoBpm}
              onChange={(event) => updateCommon('tempoBpm', Number(event.target.value))}
            />
            <span>BPM</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="population">Candidates</label>
          <input
            id="population"
            type="number"
            min={2}
            max={16}
            value={active.populationSize}
            onChange={(event) =>
              updateCommon('populationSize', Number(event.target.value))
            }
          />
        </div>

        {mode === 'modern' ? (
          <>
            <div className="field">
              <label htmlFor="phrase-beats">Phrase length</label>
              <div className="input-suffix">
                <input
                  id="phrase-beats"
                  type="number"
                  min={2}
                  max={16}
                  value={modern.phraseBeats}
                  onChange={(event) =>
                    onModernChange({
                      ...modern,
                      phraseBeats: Number(event.target.value),
                    })
                  }
                />
                <span>beats</span>
              </div>
            </div>

            <div className="field">
              <label htmlFor="rhythm-grid">Rhythmic grid</label>
              <select
                id="rhythm-grid"
                value={modern.gridTicks}
                onChange={(event) =>
                  onModernChange({
                    ...modern,
                    gridTicks: Number(event.target.value) as ModernGridTicks,
                  })
                }
              >
                {MODERN_GRID_OPTIONS.map((ticks) => (
                  <option key={ticks} value={ticks}>
                    {GRID_NAMES[ticks]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field-span-two">
              <span className="field-label">Tonic-relative register</span>
              <div className="register-range">
                <label>
                  <span>Low octave</span>
                  <select
                    aria-label="Register low octave"
                    value={modern.registerLowOctave}
                    onChange={(event) =>
                      onModernChange({
                        ...modern,
                        registerLowOctave: Number(event.target.value),
                      })
                    }
                  >
                    {[2, 3, 4, 5, 6].map((octave) => (
                      <option key={octave} value={octave}>
                        {octave}
                      </option>
                    ))}
                  </select>
                </label>
                <span aria-hidden="true">to</span>
                <label>
                  <span>High octave</span>
                  <select
                    aria-label="Register high octave"
                    value={modern.registerHighOctave}
                    onChange={(event) =>
                      onModernChange({
                        ...modern,
                        registerHighOctave: Number(event.target.value),
                      })
                    }
                  >
                    {[3, 4, 5, 6, 7].map((octave) => (
                      <option key={octave} value={octave}>
                        {octave}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="field field-span-two range-field">
              <label htmlFor="max-leap">
                Maximum leap <output>{modern.maxLeap} degrees</output>
              </label>
              <input
                id="max-leap"
                type="range"
                min={1}
                max={12}
                value={modern.maxLeap}
                onChange={(event) =>
                  onModernChange({ ...modern, maxLeap: Number(event.target.value) })
                }
              />
            </div>

            <label className="check-field">
              <input
                type="checkbox"
                checked={modern.allowRests}
                onChange={(event) =>
                  onModernChange({ ...modern, allowRests: event.target.checked })
                }
              />
              Allow sparse rests
            </label>

            <label className="check-field">
              <input
                type="checkbox"
                checked={modern.tonicClosure}
                onChange={(event) =>
                  onModernChange({ ...modern, tonicClosure: event.target.checked })
                }
              />
              Close on tonic
            </label>
          </>
        ) : null}

        <div className="field field-seed">
          <label htmlFor="seed">Seed</label>
          <input
            id="seed"
            type="text"
            maxLength={80}
            value={active.seed}
            autoComplete="off"
            spellCheck="false"
            onChange={(event) => updateCommon('seed', event.target.value)}
          />
        </div>

        <button type="button" className="primary-action" onClick={onGenerate}>
          Generate population
        </button>
      </div>
    </section>
  )
}
