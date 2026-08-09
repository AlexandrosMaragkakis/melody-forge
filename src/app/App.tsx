import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'

import {
  PlaybackController,
  createTonePlaybackEngine,
  type PlaybackControllerSnapshot,
} from '../audio'
import { CandidateCard } from '../components/CandidateCard'
import { ControlPanel } from '../components/ControlPanel'
import { EvolutionBar } from '../components/EvolutionBar'
import { FavoritesPanel } from '../components/FavoritesPanel'
import { getScale } from '../domain/scales'
import type { Candidate } from '../domain/types'
import { EVOLUTION_GENERATOR_VERSION, evolveFromSnapshot } from '../evolution'
import {
  downloadBytes,
  downloadText,
  encodeCandidateJson,
  encodeCandidateMidi,
  encodeProjectJson,
  safeDownloadName,
} from '../export'
import {
  generateLegacyPopulation,
  normalizeLegacySettings,
  type LegacyGeneratorSettings,
} from '../generators/legacy'
import {
  generateModernPopulation,
  normalizeModernSettings,
  type ModernSettings,
} from '../generators/modern'
import { decodeProjectJson } from '../export/json'
import { loadProjectState, saveProjectState } from '../persistence'
import {
  activeSnapshot,
  createGenerationSnapshot,
  projectReducer,
} from './state'
import type { GeneratorMode } from './types'

interface Notice {
  readonly kind: 'info' | 'error'
  readonly message: string
}

const IDLE_PLAYBACK: PlaybackControllerSnapshot = {
  status: 'idle',
  candidateId: null,
  loop: false,
  tempoBpm: null,
}

function candidateFilename(candidate: Candidate, extension: string): string {
  const scale = getScale(candidate.melody.constraints.scaleId)
  return safeDownloadName(
    `${candidate.provenance.strategy}-${scale.displayName}-${candidate.id.slice(-7)}`,
    extension,
  )
}

export function App() {
  const loaded = useMemo(() => loadProjectState(), [])
  const [project, dispatch] = useReducer(projectReducer, loaded.state)
  const [selectedParentIds, setSelectedParentIds] = useState<readonly string[]>([])
  const [playback, setPlayback] = useState<PlaybackControllerSnapshot>(IDLE_PLAYBACK)
  const [notice, setNotice] = useState<Notice | null>(
    loaded.ok ? null : { kind: 'error', message: loaded.error },
  )
  const playbackRef = useRef<PlaybackController | null>(null)
  const snapshot = activeSnapshot(project)

  useEffect(() => {
    const controller = new PlaybackController(createTonePlaybackEngine())
    playbackRef.current = controller
    const unsubscribe = controller.subscribe(setPlayback)
    return () => {
      unsubscribe()
      controller.dispose()
      if (playbackRef.current === controller) {
        playbackRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const result = saveProjectState(project)
    if (!result.ok) {
      queueMicrotask(() => setNotice({ kind: 'error', message: result.error }))
    }
  }, [project])

  function stopPlayback(announce = true): void {
    playbackRef.current?.stop()
    if (announce) {
      setNotice({ kind: 'info', message: 'Playback stopped.' })
    }
  }

  function clearTransientState(): void {
    stopPlayback(false)
    setSelectedParentIds([])
  }

  function handleModeChange(mode: GeneratorMode): void {
    clearTransientState()
    dispatch({ type: 'set-mode', mode })
  }

  function maybeUpdatePlayingTempo(tempoBpm: number): void {
    if (playback.status !== 'playing' && playback.status !== 'initializing') {
      return
    }
    void playbackRef.current?.setTempo(tempoBpm).catch((error: unknown) => {
      setNotice({
        kind: 'error',
        message: `Tempo change failed: ${error instanceof Error ? error.message : String(error)}`,
      })
    })
  }

  function handleLegacyChange(settings: LegacyGeneratorSettings): void {
    if (settings.tempoBpm !== project.legacySettings.tempoBpm) {
      maybeUpdatePlayingTempo(settings.tempoBpm)
    }
    dispatch({ type: 'set-legacy-settings', settings })
  }

  function handleModernChange(settings: ModernSettings): void {
    if (settings.tempoBpm !== project.modernSettings.tempoBpm) {
      maybeUpdatePlayingTempo(settings.tempoBpm)
    }
    dispatch({ type: 'set-modern-settings', settings })
  }

  function handleGenerate(): void {
    clearTransientState()
    try {
      if (project.mode === 'legacy') {
        const settings = normalizeLegacySettings(project.legacySettings)
        const candidates = generateLegacyPopulation(settings)
        dispatch({ type: 'set-legacy-settings', settings })
        dispatch({
          type: 'start-population',
          snapshot: createGenerationSnapshot(candidates, settings.seed),
        })
      } else {
        const settings = normalizeModernSettings(project.modernSettings)
        const candidates = generateModernPopulation(settings)
        dispatch({ type: 'set-modern-settings', settings })
        dispatch({
          type: 'start-population',
          snapshot: createGenerationSnapshot(candidates, settings.seed),
        })
      }
      setNotice({
        kind: 'info',
        message: 'Population generated. Listen, then select one or two parents.',
      })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  function handleToggleParent(candidateId: string): void {
    setSelectedParentIds((selected) => {
      if (selected.includes(candidateId)) {
        return selected.filter((id) => id !== candidateId)
      }
      if (selected.length >= 2) {
        setNotice({
          kind: 'info',
          message: 'Two parents are already selected. Deselect one before adding another.',
        })
        return selected
      }
      return [...selected, candidateId]
    })
  }

  async function handlePlay(candidate: Candidate): Promise<void> {
    try {
      if (playbackRef.current === null) {
        throw new Error('Audio is still initializing. Try Play again.')
      }
      await playbackRef.current.play(candidate, {
        loop: project.loop,
        tempoBpm: candidate.melody.constraints.tempoBpm,
      })
      const currentPlayback = playbackRef.current?.getSnapshot()
      if (
        currentPlayback?.status !== 'playing' ||
        currentPlayback.candidateId !== candidate.id
      ) {
        return
      }
      setNotice({
        kind: 'info',
        message: `Playing ${getScale(candidate.melody.constraints.scaleId).displayName}${project.loop ? ' on a loop' : ''}.`,
      })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: `Playback could not start: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  function handleLoopChange(loop: boolean): void {
    dispatch({ type: 'set-loop', loop })
    void playbackRef.current?.setLoop(loop).catch((error: unknown) => {
      setNotice({
        kind: 'error',
        message: `Loop change failed: ${error instanceof Error ? error.message : String(error)}`,
      })
    })
  }

  function handleEvolve(): void {
    if (snapshot === null || selectedParentIds.length === 0) {
      return
    }
    stopPlayback(false)
    const baseSeed =
      project.mode === 'legacy'
        ? project.legacySettings.seed
        : project.modernSettings.seed
    const seed = `${baseSeed}::evolution-${String(snapshot.generation + 1)}`

    try {
      const result = evolveFromSnapshot(snapshot, selectedParentIds, {
        ...project.evolutionSettings,
        seed,
      })
      if (result.candidates.length === 0) {
        throw new Error('No unique descendants could be produced')
      }
      const nextSnapshot = createGenerationSnapshot(
        result.candidates,
        seed,
        selectedParentIds,
        project.evolutionSettings,
        snapshot.id,
        {
          generation: snapshot.generation + 1,
          generatorVersion: EVOLUTION_GENERATOR_VERSION,
        },
      )
      dispatch({ type: 'append-generation', snapshot: nextSnapshot })
      setSelectedParentIds([])
      const summary = result.diversity.underfilled
        ? result.diversity.notices.map(({ message }) => message).join(' ')
        : `Generation ${String(nextSnapshot.generation)} created with ${String(result.candidates.length)} unique candidates.`
      setNotice({ kind: 'info', message: summary })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: `Evolution failed: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  function viewHistory(index: number): void {
    clearTransientState()
    dispatch({ type: 'view-history', index })
    setNotice({ kind: 'info', message: 'Loaded an immutable generation snapshot.' })
  }

  function toggleFavorite(candidate: Candidate): void {
    const wasFavorite = project.favorites.some(({ id }) => id === candidate.id)
    dispatch({ type: 'toggle-favorite', candidate })
    setNotice({
      kind: 'info',
      message: wasFavorite ? 'Removed from favorites.' : 'Saved to favorites locally.',
    })
  }

  function exportCandidateJson(candidate: Candidate): void {
    downloadText(
      encodeCandidateJson(candidate),
      candidateFilename(candidate, 'json'),
    )
    setNotice({ kind: 'info', message: 'Candidate JSON downloaded.' })
  }

  function exportCandidateMidi(candidate: Candidate): void {
    try {
      downloadBytes(
        encodeCandidateMidi(candidate),
        candidateFilename(candidate, 'mid'),
        'audio/midi',
      )
      setNotice({ kind: 'info', message: 'Monophonic MIDI downloaded.' })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: `MIDI export failed: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  function exportProject(): void {
    downloadText(
      encodeProjectJson(project),
      safeDownloadName('melody-forge-project', 'json'),
    )
    setNotice({ kind: 'info', message: 'Versioned project JSON downloaded.' })
  }

  async function importProject(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    if (file.size > 5_000_000) {
      setNotice({ kind: 'error', message: 'Project files must be smaller than 5 MB.' })
      return
    }

    try {
      const decoded = decodeProjectJson(await file.text())
      if (!decoded.ok) {
        setNotice({ kind: 'error', message: `Import rejected: ${decoded.error}` })
        return
      }
      clearTransientState()
      dispatch({ type: 'replace-project', state: decoded.value })
      setNotice({ kind: 'info', message: 'Project imported and validated.' })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  const favorites = new Set(project.favorites.map(({ id }) => id))
  const historyLabel =
    snapshot === null
      ? 'No generation'
      : `Generation ${String(snapshot.generation)} · ${String(project.historyIndex + 1)}/${String(project.history.length)}`

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Local-first melody laboratory</p>
        <h1>Melody Forge</h1>
        <p>Shape short melodic ideas, listen closely, and evolve the keepers.</p>
      </header>

      <div className="workspace">
        <ControlPanel
          mode={project.mode}
          legacy={project.legacySettings}
          modern={project.modernSettings}
          onModeChange={handleModeChange}
          onLegacyChange={handleLegacyChange}
          onModernChange={handleModernChange}
          onGenerate={handleGenerate}
        />

        {notice ? (
          <p
            className={`status-message${notice.kind === 'error' ? ' is-error' : ''}`}
            role={notice.kind === 'error' ? 'alert' : 'status'}
            aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}
          >
            {notice.message}
          </p>
        ) : null}

        {snapshot ? (
          <>
            <EvolutionBar
              settings={project.evolutionSettings}
              selectedCount={selectedParentIds.length}
              loop={project.loop}
              canGoBack={project.historyIndex > 0}
              canGoForward={project.historyIndex < project.history.length - 1}
              historyLabel={historyLabel}
              onSettingsChange={(settings) =>
                dispatch({ type: 'set-evolution-settings', settings })
              }
              onLoopChange={handleLoopChange}
              onEvolve={handleEvolve}
              onBack={() => viewHistory(project.historyIndex - 1)}
              onForward={() => viewHistory(project.historyIndex + 1)}
              onStop={stopPlayback}
              onExportProject={exportProject}
              importInput={
                <label className="file-upload">
                  Import project
                  <input
                    className="sr-only"
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => void importProject(event)}
                  />
                </label>
              }
            />

            <section className="candidate-area" aria-labelledby="candidates-heading">
              <div className="candidate-area-heading">
                <h2 id="candidates-heading">Candidates</h2>
                <p>{historyLabel}</p>
              </div>
              <div className="candidate-grid">
                {snapshot.candidates.map((candidate, index) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    index={index}
                    selected={selectedParentIds.includes(candidate.id)}
                    favorite={favorites.has(candidate.id)}
                    playing={playback.candidateId === candidate.id}
                    onToggleSelected={() => handleToggleParent(candidate.id)}
                    onToggleFavorite={() => toggleFavorite(candidate)}
                    onPlay={() => void handlePlay(candidate)}
                    onStop={stopPlayback}
                    onExportJson={() => exportCandidateJson(candidate)}
                    onExportMidi={() => exportCandidateMidi(candidate)}
                  />
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="empty-state" aria-labelledby="empty-heading">
            <div>
              <p className="section-kicker">Ready when you are</p>
              <h2 id="empty-heading">Generate your first population</h2>
              <p>
                Eight short candidates is a good start. Every seed is repeatable,
                so ideas remain reproducible while you explore.
              </p>
            </div>
          </section>
        )}

        <FavoritesPanel
          favorites={project.favorites}
          playingId={playback.candidateId}
          onPlay={(candidate) => void handlePlay(candidate)}
          onStop={stopPlayback}
          onRemove={toggleFavorite}
          onExportJson={exportCandidateJson}
          onExportMidi={exportCandidateMidi}
        />
      </div>
    </main>
  )
}
