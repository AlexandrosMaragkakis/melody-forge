import { getScale } from '../domain/scales'
import { melodyDegreeToMidi, midiToScaleDegree } from '../domain/pitch'
import type { Candidate, Melody } from '../domain/types'
import type { CandidateNoveltyReport, NoveltyComponents } from './types'

function greatestCommonDivisor(first: number, second: number): number {
  let left = Math.abs(first)
  let right = Math.abs(second)
  while (right !== 0) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

function degreeAtTick(melody: Melody, tick: number): number | null {
  const event = melody.events.find(
    (candidate) =>
      tick >= candidate.startTick &&
      tick < candidate.startTick + candidate.durationTicks,
  )
  const degree = event?.degree ?? null
  if (degree === null || melody.constraints.pitchMapping !== 'legacy-fixed-octave') {
    return degree
  }

  const scale = getScale(melody.constraints.scaleId)
  const midi = melodyDegreeToMidi(degree, melody.constraints, scale)
  return midiToScaleDegree(midi, melody.constraints.tonicMidi, scale) ?? degree
}

function internalBoundaries(melody: Melody): ReadonlySet<number> {
  return new Set(
    melody.events
      .slice(1)
      .map(({ startTick }) => startTick)
      .filter((tick) => tick > 0 && tick < melody.constraints.totalTicks),
  )
}

function boundaryDistance(left: Melody, right: Melody): number {
  const leftBoundaries = internalBoundaries(left)
  const rightBoundaries = internalBoundaries(right)
  const union = new Set([...leftBoundaries, ...rightBoundaries])
  if (union.size === 0) {
    return 0
  }

  let intersectionSize = 0
  for (const boundary of leftBoundaries) {
    if (rightBoundaries.has(boundary)) {
      intersectionSize += 1
    }
  }
  return 1 - intersectionSize / union.size
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Explainable structural distance. Components intentionally remain separate;
 * their mean is used only as a deterministic diversity tie-breaker.
 */
export function melodyNovelty(
  left: Melody,
  right: Melody,
): NoveltyComponents {
  if (left.constraints.totalTicks !== right.constraints.totalTicks) {
    return { pitch: 1, rhythm: 1, rests: 1, mean: 1 }
  }

  const quantum = greatestCommonDivisor(
    left.constraints.gridTicks,
    right.constraints.gridTicks,
  )
  const sampleCount = left.constraints.totalTicks / quantum
  const scaleCardinality = Math.max(
    getScale(left.constraints.scaleId).offsets.length,
    getScale(right.constraints.scaleId).offsets.length,
  )
  let jointlySoundingSamples = 0
  let pitchDistanceTotal = 0
  let restDifferenceSamples = 0

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const tick = sample * quantum
    const leftDegree = degreeAtTick(left, tick)
    const rightDegree = degreeAtTick(right, tick)
    const leftRest = leftDegree === null
    const rightRest = rightDegree === null

    if (leftRest !== rightRest) {
      restDifferenceSamples += 1
    }
    if (!leftRest && !rightRest) {
      jointlySoundingSamples += 1
      pitchDistanceTotal += Math.min(
        1,
        Math.abs(leftDegree - rightDegree) / scaleCardinality,
      )
    }
  }

  const pitch =
    jointlySoundingSamples === 0
      ? 0
      : clampUnit(pitchDistanceTotal / jointlySoundingSamples)
  const rhythm = clampUnit(boundaryDistance(left, right))
  const rests =
    sampleCount === 0 ? 0 : clampUnit(restDifferenceSamples / sampleCount)

  return {
    pitch,
    rhythm,
    rests,
    mean: (pitch + rhythm + rests) / 3,
  }
}

export function analyzePopulationNovelty(
  candidates: readonly Candidate[],
): readonly CandidateNoveltyReport[] {
  return candidates.map((candidate, candidateIndex) => {
    let nearestCandidateId: string | null = null
    let nearestComponents: NoveltyComponents | null = null

    for (const [otherIndex, other] of candidates.entries()) {
      if (otherIndex === candidateIndex) {
        continue
      }
      const components = melodyNovelty(candidate.melody, other.melody)
      if (
        nearestComponents === null ||
        components.mean < nearestComponents.mean
      ) {
        nearestCandidateId = other.id
        nearestComponents = components
      }
    }

    return {
      candidateId: candidate.id,
      nearestCandidateId,
      components: nearestComponents,
    }
  })
}
