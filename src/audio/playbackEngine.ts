import type { PlaybackPlan } from './playbackPlan'

export interface PlaybackEngineSession {
  /** Immediately silences audio and cancels every event owned by this session. */
  stop(): void
  /** Releases all scheduler and synthesizer resources; safe to call repeatedly. */
  dispose(): void
}

export interface PlaybackEngineStartOptions {
  readonly loop: boolean
  readonly onComplete: () => void
}

/** Audio-library-neutral boundary used by the playback controller and its tests. */
export interface PlaybackEngine {
  /** Must be called from the Play user gesture. Implementations should be idempotent. */
  initialize(): Promise<void>
  start(plan: PlaybackPlan, options: PlaybackEngineStartOptions): PlaybackEngineSession
  dispose(): void
}
