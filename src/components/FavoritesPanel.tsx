import type { Candidate } from '../domain/types'
import { CandidateCard } from './CandidateCard'

interface FavoritesPanelProps {
  readonly favorites: readonly Candidate[]
  readonly playingId: string | null
  readonly onPlay: (candidate: Candidate) => void
  readonly onStop: () => void
  readonly onRemove: (candidate: Candidate) => void
  readonly onExportJson: (candidate: Candidate) => void
  readonly onExportMidi: (candidate: Candidate) => void
}

export function FavoritesPanel({
  favorites,
  playingId,
  onPlay,
  onStop,
  onRemove,
  onExportJson,
  onExportMidi,
}: FavoritesPanelProps) {
  if (favorites.length === 0) {
    return null
  }

  return (
    <details className="favorites-panel">
      <summary>
        Favorites <span>{favorites.length}</span>
      </summary>
      <div className="favorites-grid">
        {favorites.map((candidate, index) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            index={index}
            selected={false}
            favorite
            playing={playingId === candidate.id}
            compact
            onToggleFavorite={() => onRemove(candidate)}
            onPlay={() => onPlay(candidate)}
            onStop={onStop}
            onExportJson={() => onExportJson(candidate)}
            onExportMidi={() => onExportMidi(candidate)}
          />
        ))}
      </div>
    </details>
  )
}
