import { describe, expect, it } from 'vitest'

import type { Melody } from '../domain/types'
import { createPlaybackPlan, ticksToSeconds } from './playbackPlan'

function modernMelody(): Melody {
  return {
    constraints: {
      scaleId: 'diatonic-ionian',
      tonicPitchClass: 0,
      tonicMidi: 60,
      register: { minMidi: 48, maxMidi: 84 },
      pitchMapping: 'tonic-relative',
      ticksPerBeat: 480,
      gridTicks: 240,
      totalTicks: 960,
      tempoBpm: 120,
      tonicBoundary: { start: true, end: true },
    },
    events: [
      { startTick: 0, durationTicks: 480, degree: 0 },
      { startTick: 480, durationTicks: 240, degree: null },
      { startTick: 720, durationTicks: 240, degree: 7 },
    ],
  }
}

describe('playback plan conversion', () => {
  it('converts ticks, rests, tempo, and degrees into scheduler-ready seconds and MIDI', () => {
    const plan = createPlaybackPlan(modernMelody())

    expect(plan).toEqual({
      events: [
        { startSeconds: 0, durationSeconds: 0.5, midi: 60 },
        { startSeconds: 0.5, durationSeconds: 0.25, midi: null },
        { startSeconds: 0.75, durationSeconds: 0.25, midi: 72 },
      ],
      tempoBpm: 120,
      ticksPerBeat: 480,
      totalTicks: 960,
      totalDurationSeconds: 1,
      loopDurationSeconds: 1,
    })
  })

  it('applies tempo overrides without mutating the melody', () => {
    const melody = modernMelody()
    const plan = createPlaybackPlan(melody, { tempoBpm: 60 })

    expect(plan.totalDurationSeconds).toBe(2)
    expect(plan.events[0]?.durationSeconds).toBe(1)
    expect(melody.constraints.tempoBpm).toBe(120)
  })

  it('preserves the fixed C4–B4 Legacy mapping for wrapped degrees', () => {
    const melody: Melody = {
      constraints: {
        scaleId: 'diatonic-ionian',
        tonicPitchClass: 11,
        tonicMidi: 71,
        register: { minMidi: 60, maxMidi: 71 },
        pitchMapping: 'legacy-fixed-octave',
        ticksPerBeat: 480,
        gridTicks: 480,
        totalTicks: 1920,
        tempoBpm: 120,
        tonicBoundary: { start: true, end: true },
      },
      events: [
        { startTick: 0, durationTicks: 480, degree: 0 },
        { startTick: 480, durationTicks: 480, degree: 1 },
        { startTick: 960, durationTicks: 480, degree: -1 },
        { startTick: 1440, durationTicks: 480, degree: 0 },
      ],
    }

    expect(createPlaybackPlan(melody).events.map(({ midi }) => midi)).toEqual([
      71,
      61,
      70,
      71,
    ])
  })

  it('rejects invalid time values and invalid melodies', () => {
    expect(() => ticksToSeconds(-1, 120, 480)).toThrow(/non-negative/)
    expect(() => ticksToSeconds(1, 0, 480)).toThrow(/positive finite/)

    const melody = modernMelody()
    const invalid: Melody = {
      ...melody,
      events: melody.events.map((event, index) =>
        index === 1 ? { ...event, startTick: 600 } : event,
      ),
    }
    expect(() => createPlaybackPlan(invalid)).toThrow(/contiguous/)
  })
})
