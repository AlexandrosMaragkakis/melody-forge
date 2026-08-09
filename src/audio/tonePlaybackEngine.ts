import type * as ToneTypes from 'tone'

import type {
  PlaybackEngine,
  PlaybackEngineSession,
  PlaybackEngineStartOptions,
} from './playbackEngine'
import type { PlaybackPlan } from './playbackPlan'

type ToneModule = typeof ToneTypes
type ToneSynth = InstanceType<ToneModule['Synth']>
type ToneTransport = ReturnType<ToneModule['getTransport']>

interface ActiveToneSession {
  readonly tone: ToneModule
  readonly synth: ToneSynth
  readonly transport: ToneTransport
  readonly scheduledIds: number[]
  stopped: boolean
}

/**
 * Tone.js stays entirely behind PlaybackEngine. No synth or AudioContext is
 * started until initialize() is invoked from the controller's Play path.
 */
export class TonePlaybackEngine implements PlaybackEngine {
  private active: ActiveToneSession | null = null
  private tone: ToneModule | null = null
  private initialization: Promise<void> | null = null
  private initialized = false
  private disposed = false

  initialize(): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('Tone playback engine has been disposed'))
    }
    if (this.initialized) return Promise.resolve()

    if (this.initialization === null) {
      // Importing Tone creates its AudioContext, so the import itself belongs
      // in the Play gesture path. This avoids an eager suspended context and
      // its autoplay warning during page load.
      this.initialization = import('tone')
        .then((tone) => {
          this.tone = tone
          return tone.start()
        })
        .then(
          () => {
            if (this.disposed) {
              throw new Error('Tone playback engine was disposed during initialization')
            }
            this.initialized = true
          },
          (error: unknown) => {
            this.initialization = null
            throw error
          },
        )
    }

    return this.initialization
  }

  start(plan: PlaybackPlan, options: PlaybackEngineStartOptions): PlaybackEngineSession {
    if (this.disposed) {
      throw new Error('Tone playback engine has been disposed')
    }
    if (!this.initialized) {
      throw new Error('Tone playback engine must be initialized from a user gesture before start')
    }
    const tone = this.tone
    if (tone === null) {
      throw new Error('Tone playback engine initialized without its audio module')
    }

    this.stopActive()
    const transport = tone.getTransport()
    this.resetTransport(tone, transport)
    transport.bpm.value = plan.tempoBpm

    const synth = new tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.008,
        decay: 0.12,
        sustain: 0.42,
        release: 0.16,
      },
      portamento: 0.008,
      volume: -8,
    }).toDestination()

    const active: ActiveToneSession = {
      tone,
      synth,
      transport,
      scheduledIds: [],
      stopped: false,
    }
    this.active = active

    for (const event of plan.events) {
      if (event.midi === null) continue
      const midi = event.midi

      const eventId = transport.schedule((time) => {
        if (active.stopped) return
        // Leave a small articulation gap while retaining monophonic timing.
        const gateSeconds = Math.max(0.01, event.durationSeconds * 0.9)
        synth.triggerAttackRelease(
          tone.Midi(midi).toFrequency(),
          gateSeconds,
          time,
          0.72,
        )
      }, event.startSeconds)
      active.scheduledIds.push(eventId)
    }

    if (options.loop) {
      transport.setLoopPoints(0, plan.loopDurationSeconds)
      transport.loop = true
    } else {
      const completionId = transport.scheduleOnce((time) => {
        tone.getDraw().schedule(() => {
          if (active.stopped) return
          this.teardown(active)
          options.onComplete()
        }, time)
      }, plan.totalDurationSeconds)
      active.scheduledIds.push(completionId)
      transport.loop = false
    }

    transport.seconds = 0
    transport.start()

    return {
      stop: () => this.teardown(active),
      dispose: () => this.teardown(active),
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.stopActive()
    this.disposed = true
  }

  private stopActive(): void {
    if (this.active !== null) {
      this.teardown(this.active)
    }
  }

  private resetTransport(tone: ToneModule, transport: ToneTransport): void {
    transport.stop()
    transport.loop = false
    transport.cancel(0)
    transport.seconds = 0
    tone.getDraw().cancel(0)
  }

  private teardown(active: ActiveToneSession): void {
    if (active.stopped) return
    active.stopped = true
    if (this.active === active) {
      this.active = null
    }

    active.transport.stop()
    active.transport.loop = false
    for (const eventId of active.scheduledIds) {
      active.transport.clear(eventId)
    }
    active.transport.cancel(0)
    active.transport.seconds = 0
    active.tone.getDraw().cancel(0)
    active.synth.triggerRelease()
    active.synth.dispose()
  }
}

export function createTonePlaybackEngine(): PlaybackEngine {
  return new TonePlaybackEngine()
}
