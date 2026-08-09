import { useId } from 'react'

import { formatMidiNote, melodyDegreeToMidi } from '../domain/pitch'
import { getScale } from '../domain/scales'
import type { Candidate } from '../domain/types'

interface CandidateCardProps {
  readonly candidate: Candidate
  readonly index: number
  readonly selected: boolean
  readonly favorite: boolean
  readonly playing: boolean
  readonly compact?: boolean
  readonly onToggleSelected?: () => void
  readonly onToggleFavorite: () => void
  readonly onPlay: () => void
  readonly onStop: () => void
  readonly onExportJson: () => void
  readonly onExportMidi: () => void
}

function strategyName(candidate: Candidate): string {
  switch (candidate.provenance.strategy) {
    case 'legacy':
      return 'Legacy'
    case 'modern':
      return 'Modern'
    case 'evolution':
      return 'Evolved'
  }
}

function noteSummary(candidate: Candidate): string[] {
  const scale = getScale(candidate.melody.constraints.scaleId)
  return candidate.melody.events.map((event) =>
    event.degree === null
      ? 'rest'
      : formatMidiNote(
          melodyDegreeToMidi(event.degree, candidate.melody.constraints, scale),
        ),
  )
}

function contourSegments(candidate: Candidate): string[] {
  const sounding = candidate.melody.events.filter(
    (event): event is typeof event & { readonly degree: number } =>
      event.degree !== null,
  )
  if (sounding.length === 0) {
    return []
  }

  const degrees = sounding.map(({ degree }) => degree)
  const minimum = Math.min(...degrees)
  const maximum = Math.max(...degrees)
  const span = Math.max(1, maximum - minimum)
  const total = candidate.melody.constraints.totalTicks
  const segments: string[] = []
  let current: string[] = []

  for (const event of candidate.melody.events) {
    if (event.degree === null) {
      if (current.length > 0) {
        segments.push(current.join(' '))
        current = []
      }
      continue
    }
    const x = ((event.startTick + event.durationTicks / 2) / total) * 100
    const y = 30 - ((event.degree - minimum) / span) * 22
    current.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  if (current.length > 0) {
    segments.push(current.join(' '))
  }
  return segments
}

function phraseBeats(candidate: Candidate): string {
  const beats =
    candidate.melody.constraints.totalTicks /
    candidate.melody.constraints.ticksPerBeat
  return Number.isInteger(beats)
    ? String(beats)
    : beats.toFixed(2).replace(/0+$/u, '').replace(/\.$/u, '')
}

export function CandidateCard({
  candidate,
  index,
  selected,
  favorite,
  playing,
  compact = false,
  onToggleSelected,
  onToggleFavorite,
  onPlay,
  onStop,
  onExportJson,
  onExportMidi,
}: CandidateCardProps) {
  const scale = getScale(candidate.melody.constraints.scaleId)
  const notes = noteSummary(candidate)
  const segments = contourSegments(candidate)
  // A favorite can be rendered beside the same active candidate, so this ID
  // belongs to the card instance rather than to the musical candidate.
  const titleId = useId()

  return (
    <article
      className={`candidate-card${selected ? ' is-selected' : ''}${playing ? ' is-playing' : ''}${compact ? ' is-compact' : ''}`}
      aria-labelledby={titleId}
    >
      <header className="candidate-header">
        <div>
          <p className="candidate-number">Candidate {index + 1}</p>
          <h3 id={titleId}>{scale.displayName}</h3>
        </div>
        <span className={`origin-badge origin-${candidate.provenance.strategy}`}>
          {strategyName(candidate)}
        </span>
      </header>

      {!compact ? (
        <svg
          className="contour"
          viewBox="0 0 100 36"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Pitch contour for candidate ${index + 1}`}
        >
          <line x1="0" y1="31" x2="100" y2="31" className="contour-axis" />
          {segments.map((points) => (
            <polyline key={points} points={points} className="contour-line" />
          ))}
        </svg>
      ) : null}

      <p className="note-sequence" aria-label={`Notes: ${notes.join(', ')}`}>
        {notes.map((note, noteIndex) => (
          <span key={`${String(noteIndex)}-${note}`} className={note === 'rest' ? 'is-rest' : ''}>
            {note === 'rest' ? '—' : note}
          </span>
        ))}
      </p>

      <div className="candidate-meta">
        <span>{candidate.melody.events.length} events</span>
        <span>{phraseBeats(candidate)} beats</span>
        <span>{candidate.melody.constraints.tempoBpm} BPM</span>
        <span>Generation {candidate.provenance.generation}</span>
      </div>

      <div className="candidate-actions">
        <button
          type="button"
          className={playing ? 'stop-button' : 'play-button'}
          onClick={playing ? onStop : onPlay}
          aria-label={`${playing ? 'Stop' : 'Play'} candidate ${index + 1}`}
        >
          <span aria-hidden="true">{playing ? '■' : '▶'}</span>
          {playing ? 'Stop' : 'Play'}
        </button>

        {onToggleSelected ? (
          <label className="parent-choice">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
            />
            Parent
          </label>
        ) : null}

        <button
          type="button"
          className="icon-action"
          aria-pressed={favorite}
          aria-label={`${favorite ? 'Remove candidate from' : 'Add candidate to'} favorites`}
          onClick={onToggleFavorite}
        >
          <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
        </button>
      </div>

      <details className="candidate-details">
        <summary>Provenance & export</summary>
        <dl>
          <div>
            <dt>Seed</dt>
            <dd>{candidate.provenance.seed}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{candidate.provenance.generatorVersion}</dd>
          </div>
          {candidate.provenance.parentIds.length > 0 ? (
            <div>
              <dt>Parents</dt>
              <dd>
                {candidate.provenance.parentIds
                  .map((id) => id.slice(-8))
                  .join(' + ')}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Operations</dt>
            <dd>
              {candidate.provenance.operations
                .map(({ operator }) => operator.replaceAll('-', ' '))
                .join(', ') || 'Elite copy'}
            </dd>
          </div>
        </dl>
        <div className="export-actions">
          <button type="button" onClick={onExportMidi}>
            MIDI
          </button>
          <button type="button" onClick={onExportJson}>
            JSON
          </button>
        </div>
      </details>
    </article>
  )
}
