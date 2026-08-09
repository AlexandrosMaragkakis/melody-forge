import { describe, expect, it } from 'vitest'

import {
  V1_TRIANGLE_COMPATIBILITY_PROFILE,
  createV1TriangleCompatibilitySchedule,
  v1TriangleCompatibilityGateSeconds,
} from './v1Compatibility'

describe('V1 triangle compatibility performance', () => {
  it('owns the exact frozen factory, routing, and trigger constants', () => {
    expect(V1_TRIANGLE_COMPATIBILITY_PROFILE).toEqual({
      version: 'v1-compat-performance-v1',
      voiceFactoryId: 'v1-triangle-compat',
      synth: {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.008,
          decay: 0.12,
          sustain: 0.42,
          release: 0.16,
        },
        portamento: 0.008,
        volume: -8,
      },
      triggerVelocity: 0.72,
      gate: {
        minimumSeconds: 0.01,
        sourceDurationMultiplier: 0.9,
      },
      routing: 'direct-destination',
    })

    expect(Object.isFrozen(V1_TRIANGLE_COMPATIBILITY_PROFILE)).toBe(true)
    expect(Object.isFrozen(V1_TRIANGLE_COMPATIBILITY_PROFILE.synth)).toBe(true)
    expect(
      Object.isFrozen(V1_TRIANGLE_COMPATIBILITY_PROFILE.synth.oscillator),
    ).toBe(true)
    expect(
      Object.isFrozen(V1_TRIANGLE_COMPATIBILITY_PROFILE.synth.envelope),
    ).toBe(true)
    expect(Object.isFrozen(V1_TRIANGLE_COMPATIBILITY_PROFILE.gate)).toBe(true)
  })

  it('uses the exact V1 minimum and proportional gate rule', () => {
    expect(v1TriangleCompatibilityGateSeconds(0.005)).toBe(0.01)
    expect(v1TriangleCompatibilityGateSeconds(1 / 90)).toBe(0.01)
    expect(v1TriangleCompatibilityGateSeconds(0.5)).toBe(0.45)
    expect(v1TriangleCompatibilityGateSeconds(2)).toBe(1.8)
  })

  it('plans sounding events in source order while retaining exact timing data', () => {
    const sourceEvents = [
      { startSeconds: 0, durationSeconds: 0.5, midi: 60 },
      { startSeconds: 0.5, durationSeconds: 0.25, midi: null },
      { startSeconds: 0.75, durationSeconds: 0.01, midi: 67 },
      { startSeconds: 0.76, durationSeconds: 1, midi: 64 },
    ] as const
    const sourceBefore = JSON.stringify(sourceEvents)

    const schedule = createV1TriangleCompatibilitySchedule(sourceEvents)

    expect(schedule).toEqual([
      {
        sourceEventIndex: 0,
        startSeconds: 0,
        durationSeconds: 0.5,
        midi: 60,
        gateSeconds: 0.45,
        velocity: 0.72,
      },
      {
        sourceEventIndex: 2,
        startSeconds: 0.75,
        durationSeconds: 0.01,
        midi: 67,
        gateSeconds: 0.01,
        velocity: 0.72,
      },
      {
        sourceEventIndex: 3,
        startSeconds: 0.76,
        durationSeconds: 1,
        midi: 64,
        gateSeconds: 0.9,
        velocity: 0.72,
      },
    ])
    expect(schedule.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(schedule)).toBe(true)
    expect(JSON.stringify(sourceEvents)).toBe(sourceBefore)
    expect(createV1TriangleCompatibilitySchedule(sourceEvents)).toEqual(
      schedule,
    )
  })
})
