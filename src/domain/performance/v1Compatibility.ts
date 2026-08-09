/**
 * The shipped V1 voice is a compatibility algorithm, not a user-editable V2
 * performance preset. Keep every audible constant here so retained V1 playback
 * and migrated V1 audition cannot drift into separate implementations.
 */
export const V1_TRIANGLE_COMPATIBILITY_PROFILE = Object.freeze({
  version: 'v1-compat-performance-v1',
  voiceFactoryId: 'v1-triangle-compat',
  synth: Object.freeze({
    oscillator: Object.freeze({ type: 'triangle' as const }),
    envelope: Object.freeze({
      attack: 0.008,
      decay: 0.12,
      sustain: 0.42,
      release: 0.16,
    }),
    portamento: 0.008,
    volume: -8,
  }),
  triggerVelocity: 0.72,
  gate: Object.freeze({
    minimumSeconds: 0.01,
    sourceDurationMultiplier: 0.9,
  }),
  routing: 'direct-destination' as const,
})

export interface V1TriangleCompatibilitySourceEvent {
  readonly startSeconds: number
  readonly durationSeconds: number
  readonly midi: number | null
}

export interface V1TriangleCompatibilityScheduledEvent {
  /** Index in the complete source event sequence, including rests. */
  readonly sourceEventIndex: number
  readonly startSeconds: number
  readonly durationSeconds: number
  readonly midi: number
  readonly gateSeconds: number
  readonly velocity: typeof V1_TRIANGLE_COMPATIBILITY_PROFILE.triggerVelocity
}

/** Reproduces the V1 articulation gap without introducing a V2 control. */
export function v1TriangleCompatibilityGateSeconds(
  sourceEventDurationSeconds: number,
): number {
  return Math.max(
    V1_TRIANGLE_COMPATIBILITY_PROFILE.gate.minimumSeconds,
    sourceEventDurationSeconds *
      V1_TRIANGLE_COMPATIBILITY_PROFILE.gate.sourceDurationMultiplier,
  )
}

/**
 * Produces the exact ordered note schedule consumed by the compatibility
 * adapter. Rests retain their timing in the source plan but create no synth
 * trigger, matching the V1 route.
 */
export function createV1TriangleCompatibilitySchedule(
  sourceEvents: readonly V1TriangleCompatibilitySourceEvent[],
): readonly V1TriangleCompatibilityScheduledEvent[] {
  const scheduledEvents: V1TriangleCompatibilityScheduledEvent[] = []

  sourceEvents.forEach((event, sourceEventIndex) => {
    if (event.midi === null) return

    scheduledEvents.push(
      Object.freeze({
        sourceEventIndex,
        startSeconds: event.startSeconds,
        durationSeconds: event.durationSeconds,
        midi: event.midi,
        gateSeconds: v1TriangleCompatibilityGateSeconds(
          event.durationSeconds,
        ),
        velocity: V1_TRIANGLE_COMPATIBILITY_PROFILE.triggerVelocity,
      }),
    )
  })

  return Object.freeze(scheduledEvents)
}
