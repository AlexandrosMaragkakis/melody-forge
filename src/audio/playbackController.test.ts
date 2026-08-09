import { describe, expect, it } from 'vitest'

import type { Melody } from '../domain/types'
import type {
  PlaybackEngine,
  PlaybackEngineSession,
  PlaybackEngineStartOptions,
} from './playbackEngine'
import {
  PlaybackController,
  PlaybackControllerDisposedError,
  type PlaybackSource,
} from './playbackController'
import type { PlaybackPlan } from './playbackPlan'

class FakeSession implements PlaybackEngineSession {
  stopCalls = 0
  disposeCalls = 0

  stop(): void {
    this.stopCalls += 1
  }

  dispose(): void {
    this.disposeCalls += 1
  }
}

interface FakeStart {
  readonly plan: PlaybackPlan
  readonly options: PlaybackEngineStartOptions
  readonly session: FakeSession
}

class FakeEngine implements PlaybackEngine {
  initializeCalls = 0
  disposeCalls = 0
  readonly starts: FakeStart[] = []
  initialization: Promise<void> = Promise.resolve()

  initialize(): Promise<void> {
    this.initializeCalls += 1
    return this.initialization
  }

  start(plan: PlaybackPlan, options: PlaybackEngineStartOptions): PlaybackEngineSession {
    const session = new FakeSession()
    this.starts.push({ plan, options, session })
    return session
  }

  dispose(): void {
    this.disposeCalls += 1
  }
}

function deferred(): {
  readonly promise: Promise<void>
  readonly resolve: () => void
} {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve: () => resolvePromise?.(),
  }
}

function melody(secondDegree = 2): Melody {
  return {
    constraints: {
      scaleId: 'diatonic-ionian',
      tonicPitchClass: 0,
      tonicMidi: 60,
      register: { minMidi: 48, maxMidi: 84 },
      pitchMapping: 'tonic-relative',
      ticksPerBeat: 480,
      gridTicks: 480,
      totalTicks: 1920,
      tempoBpm: 120,
      tonicBoundary: { start: true, end: true },
    },
    events: [
      { startTick: 0, durationTicks: 480, degree: 0 },
      { startTick: 480, durationTicks: 480, degree: secondDegree },
      { startTick: 960, durationTicks: 480, degree: null },
      { startTick: 1440, durationTicks: 480, degree: 0 },
    ],
  }
}

function source(id: string, secondDegree = 2): PlaybackSource {
  return { id, melody: melody(secondDegree) }
}

describe('PlaybackController', () => {
  it('initializes audio only from play and starts one validated plan', async () => {
    const engine = new FakeEngine()
    const controller = new PlaybackController(engine)
    expect(engine.initializeCalls).toBe(0)

    const playing = controller.play(source('candidate-a'))
    // initialize() is invoked synchronously before play reaches its first await.
    expect(engine.initializeCalls).toBe(1)
    expect(controller.getSnapshot().status).toBe('initializing')
    await playing

    expect(engine.starts).toHaveLength(1)
    expect(engine.starts[0]?.plan.events.map(({ midi }) => midi)).toEqual([
      60,
      64,
      null,
      60,
    ])
    expect(controller.getSnapshot()).toEqual({
      status: 'playing',
      candidateId: 'candidate-a',
      loop: false,
      tempoBpm: 120,
    })
  })

  it('stops immediately and replays the last request without reinitializing audio', async () => {
    const engine = new FakeEngine()
    const controller = new PlaybackController(engine)
    await controller.play(source('candidate-a'))
    const firstSession = engine.starts[0]?.session

    controller.stop()
    expect(firstSession?.stopCalls).toBe(1)
    expect(firstSession?.disposeCalls).toBe(1)
    expect(controller.getSnapshot().status).toBe('idle')

    await controller.replay()
    expect(engine.initializeCalls).toBe(1)
    expect(engine.starts).toHaveLength(2)
    expect(controller.getSnapshot().candidateId).toBe('candidate-a')
  })

  it('cancels the old session before switching candidates', async () => {
    const engine = new FakeEngine()
    const controller = new PlaybackController(engine)
    await controller.play(source('candidate-a'))
    const firstSession = engine.starts[0]?.session

    await controller.play(source('candidate-b', 3))
    expect(firstSession?.stopCalls).toBe(1)
    expect(firstSession?.disposeCalls).toBe(1)
    expect(engine.starts).toHaveLength(2)
    expect(controller.getSnapshot().candidateId).toBe('candidate-b')
  })

  it('passes loop state to the engine and restarts when loop changes', async () => {
    const engine = new FakeEngine()
    const controller = new PlaybackController(engine)
    await controller.play(source('candidate-a'), { loop: true })

    expect(engine.starts[0]?.options.loop).toBe(true)
    expect(engine.starts[0]?.plan.loopDurationSeconds).toBe(2)
    await controller.setLoop(false)

    expect(engine.starts[0]?.session.stopCalls).toBe(1)
    expect(engine.starts[1]?.options.loop).toBe(false)
    expect(controller.getSnapshot().loop).toBe(false)
  })

  it('rebuilds the plan and restarts from the beginning when tempo changes', async () => {
    const engine = new FakeEngine()
    const controller = new PlaybackController(engine)
    await controller.play(source('candidate-a'))
    expect(engine.starts[0]?.plan.totalDurationSeconds).toBe(2)

    await controller.setTempo(60)
    expect(engine.starts[0]?.session.stopCalls).toBe(1)
    expect(engine.starts[1]?.plan.totalDurationSeconds).toBe(4)
    expect(engine.starts[1]?.plan.events[0]?.startSeconds).toBe(0)
    expect(controller.getSnapshot().tempoBpm).toBe(60)
  })

  it('ignores stale completion callbacks after switching candidates', async () => {
    const engine = new FakeEngine()
    const controller = new PlaybackController(engine)
    await controller.play(source('candidate-a'))
    await controller.play(source('candidate-b', 3))

    engine.starts[0]?.options.onComplete()
    expect(controller.getSnapshot().status).toBe('playing')
    expect(controller.getSnapshot().candidateId).toBe('candidate-b')

    engine.starts[1]?.options.onComplete()
    expect(controller.getSnapshot().status).toBe('idle')
    expect(controller.getSnapshot().candidateId).toBeNull()
    expect(engine.starts[1]?.session.disposeCalls).toBe(1)
  })

  it('allows only the latest request to start after delayed initialization', async () => {
    const engine = new FakeEngine()
    const initialization = deferred()
    engine.initialization = initialization.promise
    const controller = new PlaybackController(engine)

    const firstPlay = controller.play(source('candidate-a'))
    const secondPlay = controller.play(source('candidate-b', 3))
    expect(engine.initializeCalls).toBe(1)
    expect(engine.starts).toHaveLength(0)

    initialization.resolve()
    await Promise.all([firstPlay, secondPlay])
    expect(engine.starts).toHaveLength(1)
    expect(controller.getSnapshot().candidateId).toBe('candidate-b')
  })

  it('disposes the active session and engine, then rejects further playback', async () => {
    const engine = new FakeEngine()
    const controller = new PlaybackController(engine)
    const snapshots: string[] = []
    controller.subscribe(({ status }) => snapshots.push(status))
    await controller.play(source('candidate-a'))
    const session = engine.starts[0]?.session

    controller.dispose()
    controller.dispose()
    expect(session?.stopCalls).toBe(1)
    expect(session?.disposeCalls).toBe(1)
    expect(engine.disposeCalls).toBe(1)
    expect(controller.getSnapshot().status).toBe('disposed')
    expect(snapshots.at(-1)).toBe('disposed')
    await expect(controller.play(source('candidate-b'))).rejects.toBeInstanceOf(
      PlaybackControllerDisposedError,
    )
    await expect(controller.replay()).rejects.toBeInstanceOf(
      PlaybackControllerDisposedError,
    )
  })
})
