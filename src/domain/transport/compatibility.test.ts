/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { decodeCandidateEnvelope, decodeProjectEnvelope } from '../../persistence/schema'
import type { Candidate } from '../types'
import {
  MAX_V1_ADAPTATION_BOUNDARIES,
  V1CompatibilityTimingValidationError,
  createV1CompatibilityTimingProfile,
  createV1CompatibilityTimingProfileForCandidate,
  canMapExactlyToCanonicalPpq,
  isV1CompatibilityTimingProfile,
  proposeV1TimingAdaptation,
  validateV1CompatibilityTimingProfile,
} from '.'

const FIXTURE_DIRECTORY = join(process.cwd(), 'src/test/fixtures/v1')

function fixtureJson(name: string): unknown {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIRECTORY, name), 'utf8'),
  ) as unknown
}

function candidateBoundaries(candidate: Candidate): readonly number[] {
  return [
    ...candidate.melody.events.map(({ startTick }) => startTick),
    candidate.melody.constraints.totalTicks,
  ]
}

describe('V1 compatibility timing profiles', () => {
  it('preserves the 96-PPQ golden candidate under an exact candidate-specific identity', () => {
    const sourceEnvelope = fixtureJson(
      'candidate-modern-non-480-ppq.v1.json',
    )
    const sourceBefore = JSON.stringify(sourceEnvelope)
    const decoded = decodeCandidateEnvelope(sourceEnvelope)

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    const profile = createV1CompatibilityTimingProfileForCandidate(
      decoded.value,
    )

    expect(profile).toEqual({
      id: 'v1-timing-cd1167de38e0c1c5',
      version: 'v1-compat-timing-v1',
      sourceCandidateId: 'candidate-v1-non-480-ppq',
      sourceTicksPerBeat: 96,
      sourceGridTicks: 48,
      tempoBpm: 117,
      displayMeter: {
        numerator: 4,
        denominator: 4,
        beatGroups: [2, 2],
      },
      gridTicks: 48,
      loopStartTick: 0,
      loopEndTick: 480,
      swing: { subdivisionTicks: 48, amountPermille: 500 },
    })
    expect(validateV1CompatibilityTimingProfile(profile)).toEqual([])
    expect(isV1CompatibilityTimingProfile(profile)).toBe(true)
    expect(JSON.stringify(sourceEnvelope)).toBe(sourceBefore)
  })

  it('creates distinct profiles for every mixed-profile favorite, including 480 PPQ', () => {
    const sourceEnvelope = fixtureJson(
      'project-mixed-ppq-favorites.v1.json',
    )
    const sourceBefore = JSON.stringify(sourceEnvelope)
    const decoded = decodeProjectEnvelope(sourceEnvelope)

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    const profiles = decoded.value.favorites.map(
      createV1CompatibilityTimingProfileForCandidate,
    )

    expect(profiles.map(({ id }) => id)).toEqual([
      'v1-timing-cd1167de38e0c1c5',
      'v1-timing-3bef466f97cb8005',
    ])
    expect(profiles.map(({ sourceTicksPerBeat }) => sourceTicksPerBeat)).toEqual([
      96,
      480,
    ])
    expect(profiles.map(({ loopEndTick }) => loopEndTick)).toEqual([
      480,
      2_400,
    ])
    expect(
      profiles.map((profile, index) =>
        canMapExactlyToCanonicalPpq(
          profile,
          candidateBoundaries(decoded.value.favorites[index]!),
        ),
      ),
    ).toEqual([true, true])
    expect(JSON.stringify(sourceEnvelope)).toBe(sourceBefore)
  })

  it('uses all fields, including candidate identity, for deterministic IDs', () => {
    const options = {
      sourceCandidateId: 'source-a',
      sourceTicksPerBeat: 480,
      sourceGridTicks: 120,
      tempoBpm: 117.5,
      loopEndTick: 1_920,
    } as const
    const first = createV1CompatibilityTimingProfile(options)
    const replay = createV1CompatibilityTimingProfile({ ...options })
    const otherCandidate = createV1CompatibilityTimingProfile({
      ...options,
      sourceCandidateId: 'source-b',
    })

    expect(replay).toEqual(first)
    expect(otherCandidate.id).not.toBe(first.id)
    expect(first.tempoBpm).toBe(117.5)
    expect(validateV1CompatibilityTimingProfile(first)).toEqual([])
    expect(
      validateV1CompatibilityTimingProfile({
        ...first,
        tempoBpm: 118,
      }).map(({ code }) => code),
    ).toEqual(['profile-id-mismatch'])
  })

  it('does not impose canonical divisibility or bounds on schema-valid V1 timing', () => {
    const largestSourceTick = Number.MAX_SAFE_INTEGER
    const profile = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'safe-integer-edge',
      sourceTicksPerBeat: largestSourceTick,
      sourceGridTicks: largestSourceTick,
      tempoBpm: 0.5,
      loopEndTick: largestSourceTick,
    })

    expect(validateV1CompatibilityTimingProfile(profile)).toEqual([])
    expect(
      canMapExactlyToCanonicalPpq(profile, [0, largestSourceTick]),
    ).toBe(true)
  })

  it('reports structured field errors and rejects invalid construction', () => {
    const profile = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'validation-source',
      sourceTicksPerBeat: 96,
      sourceGridTicks: 48,
      tempoBpm: 117,
      loopEndTick: 480,
    })
    const issues = validateV1CompatibilityTimingProfile({
      ...profile,
      displayMeter: {
        numerator: 4,
        denominator: 4,
        beatGroups: [4],
      },
      gridTicks: 24,
      loopStartTick: 1,
      swing: { subdivisionTicks: 24, amountPermille: 600 },
    })

    expect(issues.map(({ code }) => code)).toEqual([
      'invalid-display-meter',
      'source-grid-mismatch',
      'invalid-loop-start',
      'swing-grid-mismatch',
      'invalid-swing-amount',
    ])
    expect(issues[0]?.path).toBe('displayMeter')
    expect(issues[0]?.message).toContain('4/4')
    expect(() =>
      createV1CompatibilityTimingProfile({
        sourceCandidateId: 'invalid',
        sourceTicksPerBeat: 0,
        sourceGridTicks: 1,
        tempoBpm: 120,
        loopEndTick: 1,
      }),
    ).toThrow(V1CompatibilityTimingValidationError)
    expect(isV1CompatibilityTimingProfile(null)).toBe(false)
    expect(
      validateV1CompatibilityTimingProfile({
        ...profile,
        unexpected: true,
      }).map(({ code }) => code),
    ).toEqual(['unexpected-field'])
    expect(
      validateV1CompatibilityTimingProfile({
        ...profile,
        swing: { ...profile.swing, unexpected: true },
      }).map(({ code }) => code),
    ).toEqual(['unexpected-field'])
    expect(
      validateV1CompatibilityTimingProfile(Object.create(profile)).map(
        ({ code }) => code,
      ),
    ).toEqual(['not-an-object'])

    for (const invalidOptions of [
      {
        sourceCandidateId: 'non-finite-tempo',
        sourceTicksPerBeat: 480,
        sourceGridTicks: 120,
        tempoBpm: Number.POSITIVE_INFINITY,
        loopEndTick: 480,
      },
      {
        sourceCandidateId: 'non-finite-loop',
        sourceTicksPerBeat: 480,
        sourceGridTicks: 120,
        tempoBpm: 120,
        loopEndTick: Number.NaN,
      },
    ]) {
      expect(() =>
        createV1CompatibilityTimingProfile(invalidOptions),
      ).toThrow(V1CompatibilityTimingValidationError)
    }
  })
})

describe('V1 timing adaptation proposals', () => {
  it('maps every 96-PPQ golden boundary exactly to canonical 480 PPQ', () => {
    const decoded = decodeCandidateEnvelope(
      fixtureJson('candidate-modern-non-480-ppq.v1.json'),
    )
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    const profile = createV1CompatibilityTimingProfileForCandidate(
      decoded.value,
    )
    const sourceBoundaries = candidateBoundaries(decoded.value)
    const sourceBefore = JSON.stringify(decoded.value)
    const proposal = proposeV1TimingAdaptation(profile, sourceBoundaries)

    expect(proposal).toMatchObject({
      version: 'v1-timing-adaptation-proposal-v1',
      sourceProfileId: profile.id,
      sourceCandidateId: decoded.value.id,
      sourceTicksPerBeat: 96,
      targetTicksPerBeat: 480,
      roundingRule: 'nearest-tick-ties-later',
      status: 'exact-preview',
      confirmationRequired: true,
      requiresRounding: false,
      grid: {
        sourceGridTicks: 48,
        exactCanonicalGridTicks: { numerator: 240n, denominator: 1n },
        suggestedCanonicalGridTicks: 240,
        requiresRounding: false,
      },
      issues: [],
    })
    expect(proposal.boundaries).toHaveLength(sourceBoundaries.length)
    expect(
      proposal.boundaries.map(
        ({ sourceTick, exactCanonicalTick, suggestedCanonicalTick, requiresRounding }) => ({
          sourceTick,
          exactCanonicalTick,
          suggestedCanonicalTick,
          requiresRounding,
        }),
      ),
    ).toEqual(
      sourceBoundaries.map((sourceTick) => ({
        sourceTick,
        exactCanonicalTick: {
          numerator: BigInt(sourceTick * 5),
          denominator: 1n,
        },
        suggestedCanonicalTick: sourceTick * 5,
        requiresRounding: false,
      })),
    )
    expect(JSON.stringify(decoded.value)).toBe(sourceBefore)
  })

  it('previews deterministic reduced-rational rounding for a non-divisible PPQ', () => {
    const profile = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'seven-ppq-source',
      sourceTicksPerBeat: 7,
      sourceGridTicks: 1,
      tempoBpm: 120,
      loopEndTick: 3,
    })
    const sourceBoundaries = [0, 1, 2, 3] as const
    const sourceProfileBefore = JSON.stringify(profile)
    const proposal = proposeV1TimingAdaptation(profile, sourceBoundaries)

    expect(proposal.status).toBe('impossible')
    expect(proposal.confirmationRequired).toBe(true)
    expect(proposal.requiresRounding).toBe(true)
    expect(proposal.grid).toEqual({
      sourceGridTicks: 1,
      exactCanonicalGridTicks: { numerator: 480n, denominator: 7n },
      suggestedCanonicalGridTicks: 69,
      requiresRounding: true,
    })
    expect(proposal.issues.map(({ code }) => code)).toEqual([
      'canonical-grid-incompatible',
    ])
    expect(proposal.boundaries).toEqual([
      {
        index: 0,
        sourceTick: 0,
        exactCanonicalTick: { numerator: 0n, denominator: 1n },
        suggestedCanonicalTick: 0,
        requiresRounding: false,
      },
      {
        index: 1,
        sourceTick: 1,
        exactCanonicalTick: { numerator: 480n, denominator: 7n },
        suggestedCanonicalTick: 69,
        requiresRounding: true,
      },
      {
        index: 2,
        sourceTick: 2,
        exactCanonicalTick: { numerator: 960n, denominator: 7n },
        suggestedCanonicalTick: 137,
        requiresRounding: true,
      },
      {
        index: 3,
        sourceTick: 3,
        exactCanonicalTick: { numerator: 1_440n, denominator: 7n },
        suggestedCanonicalTick: 206,
        requiresRounding: true,
      },
    ])
    expect(
      canMapExactlyToCanonicalPpq(profile, sourceBoundaries),
    ).toBe(false)
    expect(sourceBoundaries).toEqual([0, 1, 2, 3])
    expect(JSON.stringify(profile)).toBe(sourceProfileBefore)
  })

  it('marks a rounding collapse as impossible instead of creating zero-duration events', () => {
    const profile = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'collapsed-source',
      sourceTicksPerBeat: 2_000,
      sourceGridTicks: 1,
      tempoBpm: 100,
      loopEndTick: 2,
    })
    const proposal = proposeV1TimingAdaptation(profile, [0, 1, 2])

    expect(proposal.status).toBe('impossible')
    expect(proposal.requiresRounding).toBe(true)
    expect(
      proposal.issues.map(({ code }) => code),
    ).toEqual([
      'zero-duration-after-rounding',
      'zero-duration-after-rounding',
      'invalid-canonical-grid',
    ])
    expect(
      proposal.boundaries.map(({ suggestedCanonicalTick }) =>
        suggestedCanonicalTick,
      ),
    ).toEqual([0, 0, 0])
  })

  it('lists a factor-one grid and enforces canonical grid opportunities', () => {
    const factorOne = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'factor-one-grid-source',
      sourceTicksPerBeat: 480,
      sourceGridTicks: 120,
      tempoBpm: 120,
      loopEndTick: 480,
    })
    const exact = proposeV1TimingAdaptation(factorOne, [0, 480])
    expect(exact.status).toBe('exact-preview')
    expect(exact.grid).toEqual({
      sourceGridTicks: 120,
      exactCanonicalGridTicks: { numerator: 120n, denominator: 1n },
      suggestedCanonicalGridTicks: 120,
      requiresRounding: false,
    })

    const tooManyOpportunities = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'fine-grid-compatible-source',
      sourceTicksPerBeat: 480,
      sourceGridTicks: 1,
      tempoBpm: 120,
      loopEndTick: 65_537,
    })
    const rejected = proposeV1TimingAdaptation(
      tooManyOpportunities,
      [0, 65_537],
    )
    expect(validateV1CompatibilityTimingProfile(tooManyOpportunities)).toEqual(
      [],
    )
    expect(rejected.status).toBe('impossible')
    expect(rejected.grid.suggestedCanonicalGridTicks).toBe(1)
    expect(rejected.issues.map(({ code }) => code)).toEqual([
      'canonical-grid-opportunities-exceeded',
    ])
    expect(
      canMapExactlyToCanonicalPpq(tooManyOpportunities, [0, 65_537]),
    ).toBe(true)
  })

  it('preserves an oversized V1 source but blocks an impossible canonical derivative', () => {
    const loopEndTick = 257 * 1_920
    const profile = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'oversized-compatible-source',
      sourceTicksPerBeat: 480,
      sourceGridTicks: 480,
      tempoBpm: 120,
      loopEndTick,
    })
    const proposal = proposeV1TimingAdaptation(profile, [0, loopEndTick])

    expect(validateV1CompatibilityTimingProfile(profile)).toEqual([])
    expect(proposal.status).toBe('impossible')
    expect(proposal.issues.map(({ code }) => code)).toEqual([
      'canonical-loop-too-long',
    ])
    expect(proposal.boundaries.at(-1)?.suggestedCanonicalTick).toBe(
      loopEndTick,
    )
  })

  it('preserves an out-of-range V1 tempo but requires explicit canonical adaptation', () => {
    const profile = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'slow-compatible-source',
      sourceTicksPerBeat: 480,
      sourceGridTicks: 240,
      tempoBpm: 0.5,
      loopEndTick: 1_920,
    })
    const proposal = proposeV1TimingAdaptation(profile, [0, 1_920])

    expect(validateV1CompatibilityTimingProfile(profile)).toEqual([])
    expect(proposal.status).toBe('impossible')
    expect(proposal.issues.map(({ code }) => code)).toEqual([
      'canonical-tempo-out-of-range',
    ])
    expect(canMapExactlyToCanonicalPpq(profile, [0, 1_920])).toBe(true)
  })

  it('detects malformed coverage and ordering without changing the source profile', () => {
    const profile = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'ordered-boundary-source',
      sourceTicksPerBeat: 480,
      sourceGridTicks: 120,
      tempoBpm: 108,
      loopEndTick: 480,
    })
    const before = JSON.stringify(profile)
    const proposal = proposeV1TimingAdaptation(profile, [120, 120, 360])

    expect(proposal.status).toBe('impossible')
    expect(proposal.issues.map(({ code }) => code)).toEqual([
      'unordered-boundaries',
      'missing-loop-start',
      'missing-loop-end',
      'zero-duration-after-rounding',
    ])
    expect(JSON.stringify(profile)).toBe(before)
    expect(
      canMapExactlyToCanonicalPpq(
        { ...profile, id: 'bad-id' },
        [0, 480],
      ),
    ).toBe(false)
  })

  it('rejects sparse and oversized boundary arrays before mapping or hashing', () => {
    const profile = createV1CompatibilityTimingProfile({
      sourceCandidateId: 'bounded-boundary-source',
      sourceTicksPerBeat: 480,
      sourceGridTicks: 120,
      tempoBpm: 108,
      loopEndTick: 480,
    })
    const sparse = Array<number>(3)
    sparse[0] = 0
    sparse[2] = 480

    const sparseProposal = proposeV1TimingAdaptation(profile, sparse)
    expect(sparseProposal.status).toBe('impossible')
    expect(sparseProposal.boundaries).toEqual([])
    expect(sparseProposal.issues.map(({ code }) => code)).toEqual([
      'invalid-boundary',
    ])
    expect(canMapExactlyToCanonicalPpq(profile, sparse)).toBe(false)

    const oversized = Array.from(
      { length: MAX_V1_ADAPTATION_BOUNDARIES + 1 },
      (_, index) => index,
    )
    const oversizedProposal = proposeV1TimingAdaptation(profile, oversized)
    expect(oversizedProposal.status).toBe('impossible')
    expect(oversizedProposal.boundaries).toEqual([])
    expect(oversizedProposal.issues.map(({ code }) => code)).toEqual([
      'too-many-boundaries',
    ])
  })
})
