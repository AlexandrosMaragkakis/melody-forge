import type { Candidate, Melody } from '../domain/types'
import type {
  PlaybackEngine,
  PlaybackEngineSession,
} from './playbackEngine'
import { createPlaybackPlan } from './playbackPlan'

export type PlaybackStatus = 'idle' | 'initializing' | 'playing' | 'disposed'

export type PlaybackSource = Pick<Candidate, 'id' | 'melody'>

export interface PlayOptions {
  readonly loop?: boolean
  readonly tempoBpm?: number
}

export interface PlaybackControllerSnapshot {
  readonly status: PlaybackStatus
  /** The candidate being initialized or played; null when inactive. */
  readonly candidateId: string | null
  readonly loop: boolean
  /** Effective playback tempo for the latest request. */
  readonly tempoBpm: number | null
}

export type PlaybackControllerListener = (snapshot: PlaybackControllerSnapshot) => void

interface StoredRequest {
  readonly source: PlaybackSource
  readonly loop: boolean
  readonly tempoBpm: number
}

export class PlaybackControllerDisposedError extends Error {
  constructor() {
    super('Playback controller has been disposed')
    this.name = 'PlaybackControllerDisposedError'
  }
}

/**
 * Owns exactly one playback session. An operation token prevents delayed audio
 * initialization and stale completion callbacks from reviving old candidates.
 */
export class PlaybackController {
  private readonly listeners = new Set<PlaybackControllerListener>()
  private activeSession: PlaybackEngineSession | null = null
  private initialization: Promise<void> | null = null
  private initialized = false
  private disposed = false
  private operationToken = 0
  private lastRequest: StoredRequest | null = null
  private snapshot: PlaybackControllerSnapshot = {
    status: 'idle',
    candidateId: null,
    loop: false,
    tempoBpm: null,
  }

  constructor(private readonly engine: PlaybackEngine) {}

  getSnapshot(): PlaybackControllerSnapshot {
    return { ...this.snapshot }
  }

  subscribe(listener: PlaybackControllerListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  async play(source: PlaybackSource, options: PlayOptions = {}): Promise<void> {
    this.assertNotDisposed()
    if (source.id.trim().length === 0) {
      throw new RangeError('Playback source ID must not be empty')
    }

    const loop = options.loop ?? this.snapshot.loop
    const tempoBpm = options.tempoBpm ?? source.melody.constraints.tempoBpm
    // Build and validate before interrupting currently valid playback.
    const plan = createPlaybackPlan(source.melody, { tempoBpm })
    const request: StoredRequest = { source, loop, tempoBpm }
    this.lastRequest = request

    const token = ++this.operationToken
    this.cancelActiveSession()
    this.setSnapshot({
      status: 'initializing',
      candidateId: source.id,
      loop,
      tempoBpm,
    })

    try {
      await this.ensureInitialized()
    } catch (error) {
      if (this.isCurrent(token)) {
        this.setSnapshot({
          status: 'idle',
          candidateId: null,
          loop,
          tempoBpm,
        })
      }
      throw error
    }

    if (!this.isCurrent(token)) {
      return
    }

    let session: PlaybackEngineSession | null = null
    let completedSynchronously = false
    const onComplete = () => {
      if (session === null) {
        completedSynchronously = true
        return
      }
      this.finishSession(token, session)
    }

    try {
      session = this.engine.start(plan, { loop, onComplete })
    } catch (error) {
      if (this.isCurrent(token)) {
        this.setSnapshot({
          status: 'idle',
          candidateId: null,
          loop,
          tempoBpm,
        })
      }
      throw error
    }

    if (!this.isCurrent(token)) {
      this.stopAndDisposeSession(session)
      return
    }

    if (completedSynchronously) {
      session.dispose()
      this.setSnapshot({
        status: 'idle',
        candidateId: null,
        loop,
        tempoBpm,
      })
      return
    }

    this.activeSession = session
    this.setSnapshot({
      status: 'playing',
      candidateId: source.id,
      loop,
      tempoBpm,
    })
  }

  stop(): void {
    if (this.disposed) return

    this.operationToken += 1
    this.cancelActiveSession()
    this.setSnapshot({
      ...this.snapshot,
      status: 'idle',
      candidateId: null,
    })
  }

  async replay(): Promise<void> {
    this.assertNotDisposed()
    if (this.lastRequest === null) {
      throw new Error('There is no melody to replay')
    }
    const { source, loop, tempoBpm } = this.lastRequest
    await this.play(source, { loop, tempoBpm })
  }

  async setLoop(loop: boolean): Promise<void> {
    this.assertNotDisposed()
    if (typeof loop !== 'boolean') {
      throw new TypeError('loop must be a boolean')
    }

    const request = this.lastRequest
    if (request === null) {
      this.setSnapshot({ ...this.snapshot, loop })
      return
    }

    this.lastRequest = { ...request, loop }
    if (this.snapshot.status === 'playing' || this.snapshot.status === 'initializing') {
      await this.play(request.source, { loop, tempoBpm: request.tempoBpm })
      return
    }
    this.setSnapshot({ ...this.snapshot, loop })
  }

  async setTempo(tempoBpm: number): Promise<void> {
    this.assertNotDisposed()
    if (!Number.isFinite(tempoBpm) || tempoBpm <= 0) {
      throw new RangeError('tempoBpm must be a positive finite number')
    }

    const request = this.lastRequest
    if (request === null) {
      throw new Error('There is no melody whose tempo can be changed')
    }

    this.lastRequest = { ...request, tempoBpm }
    if (this.snapshot.status === 'playing' || this.snapshot.status === 'initializing') {
      await this.play(request.source, { loop: request.loop, tempoBpm })
      return
    }
    this.setSnapshot({ ...this.snapshot, tempoBpm })
  }

  dispose(): void {
    if (this.disposed) return

    this.operationToken += 1
    this.cancelActiveSession()
    this.engine.dispose()
    this.disposed = true
    this.lastRequest = null
    this.setSnapshot({
      ...this.snapshot,
      status: 'disposed',
      candidateId: null,
    })
    this.listeners.clear()
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new PlaybackControllerDisposedError()
    }
  }

  private isCurrent(token: number): boolean {
    return !this.disposed && token === this.operationToken
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    if (this.initialization === null) {
      // Deliberately invoke the engine immediately in the Play call stack so a
      // browser implementation can resume AudioContext from the user gesture.
      const initialization = this.engine.initialize()

      this.initialization = initialization.then(
        () => {
          this.initialized = true
        },
        (error: unknown) => {
          this.initialization = null
          throw error
        },
      )
    }

    await this.initialization
  }

  private finishSession(token: number, session: PlaybackEngineSession): void {
    if (!this.isCurrent(token) || this.activeSession !== session) return

    this.activeSession = null
    session.dispose()
    this.setSnapshot({
      ...this.snapshot,
      status: 'idle',
      candidateId: null,
    })
  }

  private cancelActiveSession(): void {
    const session = this.activeSession
    this.activeSession = null
    if (session !== null) {
      this.stopAndDisposeSession(session)
    }
  }

  private stopAndDisposeSession(session: PlaybackEngineSession): void {
    try {
      session.stop()
    } finally {
      session.dispose()
    }
  }

  private setSnapshot(snapshot: PlaybackControllerSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) {
      listener(this.getSnapshot())
    }
  }
}

/** Structural helper for UI code that has a melody but no full Candidate object. */
export function playbackSource(id: string, melody: Melody): PlaybackSource {
  return { id, melody }
}
