import { stableId } from '../identity'
import type { Candidate, Tick } from '../types'
import { createRationalTick } from './rational'
import {
  MAX_TRANSPORT_BAR_SPANS,
  MAX_TRANSPORT_GRID_OPPORTUNITIES,
  TRANSPORT_MAX_TEMPO_BPM,
  TRANSPORT_MIN_TEMPO_BPM,
  TRANSPORT_PPQ,
  type MeterSpec,
  type RationalTick,
} from './types'

export const V1_COMPATIBILITY_TIMING_VERSION =
  'v1-compat-timing-v1' as const
export const V1_TIMING_ADAPTATION_PROPOSAL_VERSION =
  'v1-timing-adaptation-proposal-v1' as const
export const MAX_V1_ADAPTATION_BOUNDARIES = 258 as const

const V1_DISPLAY_METER: MeterSpec = {
  numerator: 4,
  denominator: 4,
  beatGroups: [2, 2],
}

export interface V1CompatibilityTimingProfile {
  readonly id: string
  readonly version: typeof V1_COMPATIBILITY_TIMING_VERSION
  readonly sourceCandidateId: string
  readonly sourceTicksPerBeat: Tick
  readonly sourceGridTicks: Tick
  readonly tempoBpm: number
  readonly displayMeter: MeterSpec
  readonly gridTicks: Tick
  readonly loopStartTick: 0
  readonly loopEndTick: Tick
  readonly swing: {
    readonly subdivisionTicks: Tick
    readonly amountPermille: 500
  }
}

export interface CreateV1CompatibilityTimingProfileOptions {
  readonly sourceCandidateId: string
  readonly sourceTicksPerBeat: Tick
  readonly sourceGridTicks: Tick
  readonly tempoBpm: number
  readonly loopEndTick: Tick
}

type V1TimingCandidate = Pick<Candidate, 'id'> & {
  readonly melody: {
    readonly constraints: Pick<
      Candidate['melody']['constraints'],
      'ticksPerBeat' | 'gridTicks' | 'tempoBpm' | 'totalTicks'
    >
  }
}

export type V1CompatibilityTimingValidationIssueCode =
  | 'not-an-object'
  | 'unexpected-field'
  | 'invalid-profile-id'
  | 'profile-id-mismatch'
  | 'unsupported-version'
  | 'invalid-source-candidate-id'
  | 'invalid-source-ppq'
  | 'invalid-source-grid'
  | 'invalid-tempo'
  | 'invalid-display-meter'
  | 'invalid-grid'
  | 'source-grid-mismatch'
  | 'invalid-loop-start'
  | 'invalid-loop-end'
  | 'source-loop-off-grid'
  | 'invalid-swing'
  | 'invalid-swing-subdivision'
  | 'swing-grid-mismatch'
  | 'invalid-swing-amount'

export interface V1CompatibilityTimingValidationIssue {
  readonly code: V1CompatibilityTimingValidationIssueCode
  readonly path: string
  readonly message: string
}

export type V1TimingAdaptationIssueCode =
  | 'too-few-boundaries'
  | 'too-many-boundaries'
  | 'invalid-boundary'
  | 'missing-loop-start'
  | 'missing-loop-end'
  | 'unordered-boundaries'
  | 'unsafe-canonical-tick'
  | 'invalid-canonical-grid'
  | 'canonical-grid-incompatible'
  | 'canonical-grid-opportunities-exceeded'
  | 'canonical-tempo-out-of-range'
  | 'canonical-loop-too-long'
  | 'zero-duration-after-rounding'

export interface V1TimingAdaptationIssue {
  readonly code: V1TimingAdaptationIssueCode
  readonly path: string
  readonly message: string
}

export interface V1TimingAdaptationBoundary {
  readonly index: number
  readonly sourceTick: Tick
  /** The exact reduced value of sourceTick * 480 / sourceTicksPerBeat. */
  readonly exactCanonicalTick: RationalTick
  /** Null only when the rounded canonical tick exceeds the safe Tick range. */
  readonly suggestedCanonicalTick: Tick | null
  readonly requiresRounding: boolean
}

export interface V1TimingAdaptationGrid {
  readonly sourceGridTicks: Tick
  /** The exact reduced value of sourceGridTicks * 480 / sourceTicksPerBeat. */
  readonly exactCanonicalGridTicks: RationalTick
  /** Null when rounding cannot produce a positive safe canonical grid. */
  readonly suggestedCanonicalGridTicks: Tick | null
  readonly requiresRounding: boolean
}

export type V1TimingAdaptationStatus =
  | 'exact-preview'
  | 'rounding-preview'
  | 'impossible'

/**
 * A read-only preview. It deliberately contains no adapted events and no apply
 * operation; a separate confirmation boundary must create a V2 derivative.
 */
export interface V1TimingAdaptationProposal {
  readonly version: typeof V1_TIMING_ADAPTATION_PROPOSAL_VERSION
  readonly sourceProfileId: string
  readonly sourceCandidateId: string
  readonly sourceTicksPerBeat: Tick
  readonly targetTicksPerBeat: typeof TRANSPORT_PPQ
  readonly roundingRule: 'nearest-tick-ties-later'
  readonly status: V1TimingAdaptationStatus
  readonly confirmationRequired: true
  readonly requiresRounding: boolean
  readonly grid: V1TimingAdaptationGrid
  readonly boundaries: readonly V1TimingAdaptationBoundary[]
  readonly issues: readonly V1TimingAdaptationIssue[]
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Reflect.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function unexpectedFieldIssues(
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
  path: string,
): readonly V1CompatibilityTimingValidationIssue[] {
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .sort()
    .map((key) => {
      const fieldPath = path.length === 0 ? key : `${path}.${key}`
      return validationIssue(
        'unexpected-field',
        fieldPath,
        `${fieldPath} is not part of v1-compat-timing-v1`,
      )
    })
}

function isDenseArray(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false
  }
  return true
}

function isPositiveSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  )
}

function validationIssue(
  code: V1CompatibilityTimingValidationIssueCode,
  path: string,
  message: string,
): V1CompatibilityTimingValidationIssue {
  return { code, path, message }
}

function adaptationIssue(
  code: V1TimingAdaptationIssueCode,
  path: string,
  message: string,
): V1TimingAdaptationIssue {
  return { code, path, message }
}

function isV1DisplayMeter(value: unknown): value is MeterSpec {
  return (
    isRecord(value) &&
    value.numerator === 4 &&
    value.denominator === 4 &&
    Array.isArray(value.beatGroups) &&
    isDenseArray(value.beatGroups) &&
    value.beatGroups.length === 2 &&
    value.beatGroups[0] === 2 &&
    value.beatGroups[1] === 2 &&
    unexpectedFieldIssues(
      value,
      new Set(['numerator', 'denominator', 'beatGroups']),
      'displayMeter',
    ).length === 0
  )
}

function identityInputFromProfile(
  profile: Omit<V1CompatibilityTimingProfile, 'id'>,
): Omit<V1CompatibilityTimingProfile, 'id'> {
  return {
    version: profile.version,
    sourceCandidateId: profile.sourceCandidateId,
    sourceTicksPerBeat: profile.sourceTicksPerBeat,
    sourceGridTicks: profile.sourceGridTicks,
    tempoBpm: profile.tempoBpm,
    displayMeter: {
      numerator: profile.displayMeter.numerator,
      denominator: profile.displayMeter.denominator,
      beatGroups: [...profile.displayMeter.beatGroups],
    },
    gridTicks: profile.gridTicks,
    loopStartTick: profile.loopStartTick,
    loopEndTick: profile.loopEndTick,
    swing: {
      subdivisionTicks: profile.swing.subdivisionTicks,
      amountPermille: profile.swing.amountPermille,
    },
  }
}

export function validateV1CompatibilityTimingProfile(
  value: unknown,
): readonly V1CompatibilityTimingValidationIssue[] {
  if (!isRecord(value)) {
    return [
      validationIssue(
        'not-an-object',
        'profile',
        'profile must be an object',
      ),
    ]
  }

  const issues: V1CompatibilityTimingValidationIssue[] = []

  issues.push(
    ...unexpectedFieldIssues(
      value,
      new Set([
        'id',
        'version',
        'sourceCandidateId',
        'sourceTicksPerBeat',
        'sourceGridTicks',
        'tempoBpm',
        'displayMeter',
        'gridTicks',
        'loopStartTick',
        'loopEndTick',
        'swing',
      ]),
      '',
    ),
  )

  if (
    typeof value.id !== 'string' ||
    !/^v1-timing-[0-9a-f]{16}$/u.test(value.id)
  ) {
    issues.push(
      validationIssue(
        'invalid-profile-id',
        'id',
        'id must be a deterministic v1-timing identifier',
      ),
    )
  }

  if (value.version !== V1_COMPATIBILITY_TIMING_VERSION) {
    issues.push(
      validationIssue(
        'unsupported-version',
        'version',
        'version must be ' + V1_COMPATIBILITY_TIMING_VERSION,
      ),
    )
  }

  if (
    typeof value.sourceCandidateId !== 'string' ||
    value.sourceCandidateId.length === 0
  ) {
    issues.push(
      validationIssue(
        'invalid-source-candidate-id',
        'sourceCandidateId',
        'sourceCandidateId must be a non-empty string',
      ),
    )
  }

  if (!isPositiveSafeInteger(value.sourceTicksPerBeat)) {
    issues.push(
      validationIssue(
        'invalid-source-ppq',
        'sourceTicksPerBeat',
        'sourceTicksPerBeat must be a positive safe integer',
      ),
    )
  }

  if (!isPositiveSafeInteger(value.sourceGridTicks)) {
    issues.push(
      validationIssue(
        'invalid-source-grid',
        'sourceGridTicks',
        'sourceGridTicks must be a positive safe integer',
      ),
    )
  }

  if (
    typeof value.tempoBpm !== 'number' ||
    !Number.isFinite(value.tempoBpm) ||
    value.tempoBpm <= 0
  ) {
    issues.push(
      validationIssue(
        'invalid-tempo',
        'tempoBpm',
        'tempoBpm must be a positive finite number',
      ),
    )
  }

  if (!isV1DisplayMeter(value.displayMeter)) {
    issues.push(
      validationIssue(
        'invalid-display-meter',
        'displayMeter',
        'displayMeter must be implicit 4/4 grouped as 2+2',
      ),
    )
  }

  if (!isPositiveSafeInteger(value.gridTicks)) {
    issues.push(
      validationIssue(
        'invalid-grid',
        'gridTicks',
        'gridTicks must be a positive safe integer',
      ),
    )
  } else if (
    isPositiveSafeInteger(value.sourceGridTicks) &&
    value.gridTicks !== value.sourceGridTicks
  ) {
    issues.push(
      validationIssue(
        'source-grid-mismatch',
        'gridTicks',
        'gridTicks must preserve sourceGridTicks exactly',
      ),
    )
  }

  if (value.loopStartTick !== 0) {
    issues.push(
      validationIssue(
        'invalid-loop-start',
        'loopStartTick',
        'loopStartTick must be exactly zero',
      ),
    )
  }

  if (!isPositiveSafeInteger(value.loopEndTick)) {
    issues.push(
      validationIssue(
        'invalid-loop-end',
        'loopEndTick',
        'loopEndTick must be a positive safe integer',
      ),
    )
  } else if (
    isPositiveSafeInteger(value.sourceGridTicks) &&
    value.loopEndTick % value.sourceGridTicks !== 0
  ) {
    issues.push(
      validationIssue(
        'source-loop-off-grid',
        'loopEndTick',
        'loopEndTick must retain the schema-valid V1 source grid alignment',
      ),
    )
  }

  if (!isRecord(value.swing)) {
    issues.push(
      validationIssue(
        'invalid-swing',
        'swing',
        'swing must be an object',
      ),
    )
  } else {
    issues.push(
      ...unexpectedFieldIssues(
        value.swing,
        new Set(['subdivisionTicks', 'amountPermille']),
        'swing',
      ),
    )
    if (!isPositiveSafeInteger(value.swing.subdivisionTicks)) {
      issues.push(
        validationIssue(
          'invalid-swing-subdivision',
          'swing.subdivisionTicks',
          'swing.subdivisionTicks must be a positive safe integer',
        ),
      )
    } else if (
      isPositiveSafeInteger(value.sourceGridTicks) &&
      value.swing.subdivisionTicks !== value.sourceGridTicks
    ) {
      issues.push(
        validationIssue(
          'swing-grid-mismatch',
          'swing.subdivisionTicks',
          'straight compatibility swing must use sourceGridTicks',
        ),
      )
    }

    if (value.swing.amountPermille !== 500) {
      issues.push(
        validationIssue(
          'invalid-swing-amount',
          'swing.amountPermille',
          'compatibility swing must be straight at 500 permille',
        ),
      )
    }
  }

  if (issues.length === 0) {
    const identityInput: Omit<V1CompatibilityTimingProfile, 'id'> = {
      version: V1_COMPATIBILITY_TIMING_VERSION,
      sourceCandidateId: value.sourceCandidateId as string,
      sourceTicksPerBeat: value.sourceTicksPerBeat as number,
      sourceGridTicks: value.sourceGridTicks as number,
      tempoBpm: value.tempoBpm as number,
      displayMeter: {
        numerator: 4,
        denominator: 4,
        beatGroups: [2, 2],
      },
      gridTicks: value.gridTicks as number,
      loopStartTick: 0,
      loopEndTick: value.loopEndTick as number,
      swing: {
        subdivisionTicks: (value.swing as Readonly<Record<string, unknown>>)
          .subdivisionTicks as number,
        amountPermille: 500,
      },
    }
    if (value.id !== stableId('v1-timing', identityInput)) {
      issues.push(
        validationIssue(
          'profile-id-mismatch',
          'id',
          'id does not match the complete compatibility timing content',
        ),
      )
    }
  }

  return issues
}

export class V1CompatibilityTimingValidationError extends Error {
  readonly issues: readonly V1CompatibilityTimingValidationIssue[]

  constructor(issues: readonly V1CompatibilityTimingValidationIssue[]) {
    super(
      issues
        .map(({ path, message }) => path + ': ' + message)
        .join('\n'),
    )
    this.name = 'V1CompatibilityTimingValidationError'
    this.issues = issues.map((entry) => ({ ...entry }))
  }
}

export function assertValidV1CompatibilityTimingProfile(
  value: unknown,
): asserts value is V1CompatibilityTimingProfile {
  const issues = validateV1CompatibilityTimingProfile(value)
  if (issues.length > 0) {
    throw new V1CompatibilityTimingValidationError(issues)
  }
}

export function isV1CompatibilityTimingProfile(
  value: unknown,
): value is V1CompatibilityTimingProfile {
  return validateV1CompatibilityTimingProfile(value).length === 0
}

export function createV1CompatibilityTimingProfile(
  options: CreateV1CompatibilityTimingProfileOptions,
): V1CompatibilityTimingProfile {
  const identityInput: Omit<V1CompatibilityTimingProfile, 'id'> = {
    version: V1_COMPATIBILITY_TIMING_VERSION,
    sourceCandidateId: options.sourceCandidateId,
    sourceTicksPerBeat: options.sourceTicksPerBeat,
    sourceGridTicks: options.sourceGridTicks,
    tempoBpm: options.tempoBpm,
    displayMeter: {
      numerator: V1_DISPLAY_METER.numerator,
      denominator: V1_DISPLAY_METER.denominator,
      beatGroups: [...V1_DISPLAY_METER.beatGroups],
    },
    gridTicks: options.sourceGridTicks,
    loopStartTick: 0,
    loopEndTick: options.loopEndTick,
    swing: {
      subdivisionTicks: options.sourceGridTicks,
      amountPermille: 500,
    },
  }
  const preflight = {
    id: 'v1-timing-0000000000000000',
    ...identityInput,
  }
  const preflightIssues = validateV1CompatibilityTimingProfile(
    preflight,
  ).filter(({ code }) => code !== 'profile-id-mismatch')
  if (preflightIssues.length > 0) {
    throw new V1CompatibilityTimingValidationError(preflightIssues)
  }
  const profile: V1CompatibilityTimingProfile = {
    id: stableId('v1-timing', identityInput),
    ...identityInputFromProfile(identityInput),
  }

  assertValidV1CompatibilityTimingProfile(profile)
  return profile
}

export function createV1CompatibilityTimingProfileForCandidate(
  candidate: V1TimingCandidate,
): V1CompatibilityTimingProfile {
  const { constraints } = candidate.melody
  return createV1CompatibilityTimingProfile({
    sourceCandidateId: candidate.id,
    sourceTicksPerBeat: constraints.ticksPerBeat,
    sourceGridTicks: constraints.gridTicks,
    tempoBpm: constraints.tempoBpm,
    loopEndTick: constraints.totalTicks,
  })
}

function validateSourceBoundaries(
  profile: V1CompatibilityTimingProfile,
  sourceEventBoundaries: readonly Tick[],
): readonly V1TimingAdaptationIssue[] {
  const issues: V1TimingAdaptationIssue[] = []

  if (sourceEventBoundaries.length < 2) {
    issues.push(
      adaptationIssue(
        'too-few-boundaries',
        'sourceEventBoundaries',
        'sourceEventBoundaries must include loop start and loop end',
      ),
    )
  }


  if (sourceEventBoundaries.length > MAX_V1_ADAPTATION_BOUNDARIES) {
    issues.push(
      adaptationIssue(
        'too-many-boundaries',
        'sourceEventBoundaries',
        `sourceEventBoundaries must contain at most ${String(MAX_V1_ADAPTATION_BOUNDARIES)} entries`,
      ),
    )
    return issues
  }

  for (let index = 0; index < sourceEventBoundaries.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(sourceEventBoundaries, index)) {
      issues.push(
        adaptationIssue(
          'invalid-boundary',
          `sourceEventBoundaries[${String(index)}]`,
          'source event boundary arrays must be dense',
        ),
      )
      continue
    }
    const sourceTick = sourceEventBoundaries[index]
    if (
      typeof sourceTick !== 'number' ||
      !Number.isSafeInteger(sourceTick) ||
      sourceTick < 0
    ) {
      issues.push(
        adaptationIssue(
          'invalid-boundary',
          `sourceEventBoundaries[${String(index)}]`,
          'each source event boundary must be a non-negative safe integer',
        ),
      )
      continue
    }
    if (
      index > 0 &&
      Object.prototype.hasOwnProperty.call(sourceEventBoundaries, index - 1) &&
      sourceTick <= (sourceEventBoundaries[index - 1] ?? -1)
    ) {
      issues.push(
        adaptationIssue(
          'unordered-boundaries',
          `sourceEventBoundaries[${String(index)}]`,
          'source event boundaries must be strictly increasing',
        ),
      )
    }
  }

  if (sourceEventBoundaries[0] !== profile.loopStartTick) {
    issues.push(
      adaptationIssue(
        'missing-loop-start',
        'sourceEventBoundaries[0]',
        'the first source event boundary must equal loopStartTick 0',
      ),
    )
  }

  if (sourceEventBoundaries.at(-1) !== profile.loopEndTick) {
    issues.push(
      adaptationIssue(
        'missing-loop-end',
        `sourceEventBoundaries[${String(Math.max(0, sourceEventBoundaries.length - 1))}]`,
        'the final source event boundary must equal loopEndTick ' +
          String(profile.loopEndTick),
      ),
    )
  }

  return issues
}

function exactCanonicalTick(
  sourceTick: Tick,
  sourceTicksPerBeat: Tick,
): RationalTick {
  return createRationalTick(
    BigInt(sourceTick) * BigInt(TRANSPORT_PPQ),
    BigInt(sourceTicksPerBeat),
  )
}

function roundToNearestTickTiesLater(value: RationalTick): bigint {
  const quotient = value.numerator / value.denominator
  const remainder = value.numerator % value.denominator
  return remainder * 2n >= value.denominator ? quotient + 1n : quotient
}

function mapBoundary(
  sourceTick: Tick,
  index: number,
  sourceTicksPerBeat: Tick,
): V1TimingAdaptationBoundary {
  const exact = exactCanonicalTick(sourceTick, sourceTicksPerBeat)
  const suggestedInteger = roundToNearestTickTiesLater(exact)
  const isSafe =
    suggestedInteger >= 0n &&
    suggestedInteger <= BigInt(Number.MAX_SAFE_INTEGER)

  return {
    index,
    sourceTick,
    exactCanonicalTick: exact,
    suggestedCanonicalTick: isSafe ? Number(suggestedInteger) : null,
    requiresRounding: exact.denominator !== 1n,
  }
}

function mapGrid(profile: V1CompatibilityTimingProfile): V1TimingAdaptationGrid {
  const exact = exactCanonicalTick(
    profile.sourceGridTicks,
    profile.sourceTicksPerBeat,
  )
  const suggestedInteger = roundToNearestTickTiesLater(exact)
  const isSafe =
    suggestedInteger > 0n &&
    suggestedInteger <= BigInt(Number.MAX_SAFE_INTEGER)

  return {
    sourceGridTicks: profile.sourceGridTicks,
    exactCanonicalGridTicks: exact,
    suggestedCanonicalGridTicks: isSafe ? Number(suggestedInteger) : null,
    requiresRounding: exact.denominator !== 1n,
  }
}

export function proposeV1TimingAdaptation(
  profile: V1CompatibilityTimingProfile,
  sourceEventBoundaries: readonly Tick[],
): V1TimingAdaptationProposal {
  assertValidV1CompatibilityTimingProfile(profile)

  const sourceIssues = validateSourceBoundaries(profile, sourceEventBoundaries)
  const canMap = sourceIssues.every(
    ({ code }) => code !== 'invalid-boundary' && code !== 'too-many-boundaries',
  )
  const boundaries = canMap
    ? sourceEventBoundaries.map((sourceTick, index) =>
        mapBoundary(sourceTick, index, profile.sourceTicksPerBeat),
      )
    : []
  const grid = mapGrid(profile)
  const issues = [...sourceIssues]

  if (
    profile.tempoBpm < TRANSPORT_MIN_TEMPO_BPM ||
    profile.tempoBpm > TRANSPORT_MAX_TEMPO_BPM
  ) {
    issues.push(
      adaptationIssue(
        'canonical-tempo-out-of-range',
        'tempoBpm',
        'the preserved V1 tempo is outside the canonical 30–300 BPM range; compatibility audition and export remain available',
      ),
    )
  }

  boundaries.forEach((boundary, index) => {
    if (boundary.suggestedCanonicalTick === null) {
      issues.push(
        adaptationIssue(
          'unsafe-canonical-tick',
          `boundaries[${String(index)}].suggestedCanonicalTick`,
          'the rounded 480-PPQ tick exceeds the safe integer range',
        ),
      )
    }

    const previous = boundaries[index - 1]
    if (
      previous !== undefined &&
      previous.suggestedCanonicalTick !== null &&
      boundary.suggestedCanonicalTick !== null &&
      boundary.suggestedCanonicalTick <= previous.suggestedCanonicalTick
    ) {
      issues.push(
        adaptationIssue(
          'zero-duration-after-rounding',
          `boundaries[${String(index)}].suggestedCanonicalTick`,
          'rounding would collapse a positive source event to zero duration',
        ),
      )
    }
  })

  const suggestedLoopEnd = boundaries.at(-1)?.suggestedCanonicalTick
  const canonicalDisplayBarTicks = TRANSPORT_PPQ * 4
  if (
    suggestedLoopEnd !== undefined &&
    suggestedLoopEnd !== null &&
    Math.ceil(suggestedLoopEnd / canonicalDisplayBarTicks) >
      MAX_TRANSPORT_BAR_SPANS
  ) {
    issues.push(
      adaptationIssue(
        'canonical-loop-too-long',
        `boundaries[${String(Math.max(0, boundaries.length - 1))}].suggestedCanonicalTick`,
        'the canonical derivative would exceed the 256-bar transport limit; compatibility audition and export remain available',
      ),
    )
  }

  if (grid.suggestedCanonicalGridTicks === null) {
    issues.push(
      adaptationIssue(
        'invalid-canonical-grid',
        'grid.suggestedCanonicalGridTicks',
        'the rounded 480-PPQ grid must be a positive safe integer; compatibility audition and export remain available',
      ),
    )
  } else if (TRANSPORT_PPQ % grid.suggestedCanonicalGridTicks !== 0) {
    issues.push(
      adaptationIssue(
        'canonical-grid-incompatible',
        'grid.suggestedCanonicalGridTicks',
        'the rounded 480-PPQ grid must divide the implicit 4/4 denominator beat; choose an explicit canonical grid adaptation',
      ),
    )
  }

  if (
    suggestedLoopEnd !== undefined &&
    suggestedLoopEnd !== null &&
    grid.suggestedCanonicalGridTicks !== null &&
    Math.ceil(suggestedLoopEnd / grid.suggestedCanonicalGridTicks) >
      MAX_TRANSPORT_GRID_OPPORTUNITIES
  ) {
    issues.push(
      adaptationIssue(
        'canonical-grid-opportunities-exceeded',
        'grid.suggestedCanonicalGridTicks',
        'the canonical derivative would exceed 65,536 grid opportunities; choose an explicit coarser grid adaptation',
      ),
    )
  }

  const requiresRounding =
    grid.requiresRounding ||
    boundaries.some(
      ({ requiresRounding: boundaryRequiresRounding }) =>
        boundaryRequiresRounding,
    )
  const status: V1TimingAdaptationStatus =
    issues.length > 0
      ? 'impossible'
      : requiresRounding
        ? 'rounding-preview'
        : 'exact-preview'

  return {
    version: V1_TIMING_ADAPTATION_PROPOSAL_VERSION,
    sourceProfileId: profile.id,
    sourceCandidateId: profile.sourceCandidateId,
    sourceTicksPerBeat: profile.sourceTicksPerBeat,
    targetTicksPerBeat: TRANSPORT_PPQ,
    roundingRule: 'nearest-tick-ties-later',
    status,
    confirmationRequired: true,
    requiresRounding,
    grid,
    boundaries,
    issues,
  }
}

/**
 * True only when every supplied boundary maps to an integer 480-PPQ tick.
 * Canonical tempo/length/grid readiness is deliberately not part of this
 * narrowly named predicate; the proposal may still be impossible for those
 * reasons.
 * It never bypasses the mandatory adaptation preview and confirmation flow.
 */
export function canMapExactlyToCanonicalPpq(
  profile: unknown,
  sourceEventBoundaries: readonly Tick[],
): boolean {
  if (!isV1CompatibilityTimingProfile(profile)) {
    return false
  }
  const proposal = proposeV1TimingAdaptation(profile, sourceEventBoundaries)
  return (
    proposal.boundaries.length === sourceEventBoundaries.length &&
    proposal.boundaries.every(
      ({ requiresRounding, suggestedCanonicalTick }) =>
        !requiresRounding && suggestedCanonicalTick !== null,
    ) &&
    proposal.issues.every(
      ({ code }) =>
        code === 'canonical-tempo-out-of-range' ||
        code === 'canonical-loop-too-long' ||
        code === 'invalid-canonical-grid' ||
        code === 'canonical-grid-incompatible' ||
        code === 'canonical-grid-opportunities-exceeded',
    )
  )
}
