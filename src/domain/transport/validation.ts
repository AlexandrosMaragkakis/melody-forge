import { getMeterPreset, isMeterPresetId } from './presets'
import { stableId } from '../identity'
import {
  MAX_METER_GROUPS,
  MAX_METER_NUMERATOR,
  MAX_TRANSPORT_BAR_SPANS,
  MAX_TRANSPORT_GRID_OPPORTUNITIES,
  TRANSPORT_MAX_TEMPO_BPM,
  TRANSPORT_MIN_TEMPO_BPM,
  TRANSPORT_PPQ,
  TRANSPORT_VERSION,
  type CreateTransportSpecOptions,
  type MeterDenominator,
  type MeterSpec,
  type TransportSpec,
  type TransportValidationIssue,
} from './types'

const ALLOWED_DENOMINATORS = new Set<number>([1, 2, 4, 8, 16])
const ALLOWED_METER_SOURCES = new Set<string>([
  'explicit',
  'midi',
  'v1-implicit',
])

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Reflect.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
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

function issue(
  code: TransportValidationIssue['code'],
  path: string,
  message: string,
): TransportValidationIssue {
  return { code, path, message }
}

function unexpectedFieldIssues(
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
  path: string,
): readonly TransportValidationIssue[] {
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .sort()
    .map((key) =>
      issue(
        'unexpected-field',
        path.length === 0 ? key : path + '.' + key,
        (path.length === 0 ? key : path + '.' + key) +
          ' is not part of transport-v2',
      ),
    )
}

export function validateMeterSpec(
  value: unknown,
  ppq: number = TRANSPORT_PPQ,
  path = 'meter',
): readonly TransportValidationIssue[] {
  if (!isRecord(value)) {
    return [
      issue('invalid-meter', path, path + ' must be a meter object'),
    ]
  }

  const issues: TransportValidationIssue[] = []

  issues.push(
    ...unexpectedFieldIssues(
      value,
      new Set(['numerator', 'denominator', 'beatGroups']),
      path,
    ),
  )

  const { numerator, denominator, beatGroups } = value

  if (!isPositiveSafeInteger(ppq)) {
    issues.push(
      issue(
        'invalid-ppq',
        'ppq',
        'ppq must be a positive safe integer',
      ),
    )
  }

  if (!isPositiveSafeInteger(numerator)) {
    issues.push(
      issue(
        'invalid-meter-numerator',
        path + '.numerator',
        path + '.numerator must be a positive safe integer',
      ),
    )
  } else if (numerator > MAX_METER_NUMERATOR) {
    issues.push(
      issue(
        'meter-numerator-too-large',
        path + '.numerator',
        path + '.numerator must be at most ' +
          String(MAX_METER_NUMERATOR),
      ),
    )
  }

  if (
    typeof denominator !== 'number' ||
    !ALLOWED_DENOMINATORS.has(denominator)
  ) {
    issues.push(
      issue(
        'invalid-meter-denominator',
        path + '.denominator',
        path + '.denominator must be one of 1, 2, 4, 8, or 16',
      ),
    )
  }

  if (!Array.isArray(beatGroups) || beatGroups.length === 0) {
    issues.push(
      issue(
        'invalid-meter-groups',
        path + '.beatGroups',
        path + '.beatGroups must contain positive safe integers',
      ),
    )
  } else if (beatGroups.length > MAX_METER_GROUPS) {
    issues.push(
      issue(
        'too-many-meter-groups',
        path + '.beatGroups',
        path + '.beatGroups must contain at most ' +
          String(MAX_METER_GROUPS) +
          ' groups',
      ),
    )
  } else if (!isDenseArray(beatGroups) || !beatGroups.every(isPositiveSafeInteger)) {
    issues.push(
      issue(
        'invalid-meter-groups',
        path + '.beatGroups',
        path + '.beatGroups must contain positive safe integers',
      ),
    )
  } else {
    const groupSum = beatGroups.reduce((sum, group) => sum + group, 0)
    if (Number.isSafeInteger(numerator) && groupSum !== numerator) {
      issues.push(
        issue(
          'meter-group-sum',
          path + '.beatGroups',
          path +
            '.beatGroups must sum to numerator ' +
            String(numerator),
        ),
      )
    }
  }

  if (
    isPositiveSafeInteger(numerator) &&
    typeof denominator === 'number' &&
    ALLOWED_DENOMINATORS.has(denominator) &&
    isPositiveSafeInteger(ppq)
  ) {
    const unitTicks = (ppq * 4) / denominator
    const barTicks = unitTicks * numerator
    if (!Number.isSafeInteger(unitTicks) || !Number.isSafeInteger(barTicks)) {
      issues.push(
        issue(
          'unsafe-meter-length',
          path,
          path +
            ' must resolve to safe integer tick lengths at ' +
            String(ppq) +
            ' PPQ',
        ),
      )
    }
  }

  return issues
}

export function validateTransportSpec(
  value: unknown,
): readonly TransportValidationIssue[] {
  if (!isRecord(value)) {
    return [
      issue(
        'not-an-object',
        'transport',
        'transport must be an object',
      ),
    ]
  }

  const issues: TransportValidationIssue[] = []

  issues.push(
    ...unexpectedFieldIssues(
      value,
      new Set([
        'id',
        'version',
        'ppq',
        'tempoBpm',
        'meter',
        'gridTicks',
        'loopStartTick',
        'loopEndTick',
        'swing',
        'meterSource',
      ]),
      '',
    ),
  )

  if (
    typeof value.id !== 'string' ||
    !/^transport-[0-9a-f]{16}$/u.test(value.id)
  ) {
    issues.push(
      issue(
        'invalid-transport-id',
        'id',
        'id must be a deterministic transport identifier',
      ),
    )
  }

  if (value.version !== TRANSPORT_VERSION) {
    issues.push(
      issue(
        'unsupported-version',
        'version',
        'version must be ' + TRANSPORT_VERSION,
      ),
    )
  }

  if (value.ppq !== TRANSPORT_PPQ) {
    issues.push(
      issue(
        'unsupported-ppq',
        'ppq',
        'V2 transport requires ' +
          String(TRANSPORT_PPQ) +
          ' PPQ; V1 alternate PPQ uses a compatibility timing profile',
      ),
    )
  }

  if (
    typeof value.tempoBpm !== 'number' ||
    !Number.isFinite(value.tempoBpm) ||
    value.tempoBpm < TRANSPORT_MIN_TEMPO_BPM ||
    value.tempoBpm > TRANSPORT_MAX_TEMPO_BPM
  ) {
    issues.push(
      issue(
        'invalid-tempo',
        'tempoBpm',
        'tempoBpm must be a finite number from ' +
          String(TRANSPORT_MIN_TEMPO_BPM) +
          ' through ' +
          String(TRANSPORT_MAX_TEMPO_BPM),
      ),
    )
  }

  issues.push(...validateMeterSpec(value.meter, TRANSPORT_PPQ))

  if (!isPositiveSafeInteger(value.gridTicks)) {
    issues.push(
      issue(
        'invalid-grid',
        'gridTicks',
        'gridTicks must be a positive safe integer',
      ),
    )
  } else if (
    isRecord(value.meter) &&
    typeof value.meter.denominator === 'number' &&
    ALLOWED_DENOMINATORS.has(value.meter.denominator)
  ) {
    const meterUnitTicks =
      (TRANSPORT_PPQ * 4) / value.meter.denominator
    if (
      !Number.isSafeInteger(meterUnitTicks) ||
      meterUnitTicks % value.gridTicks !== 0
    ) {
      issues.push(
        issue(
          'incompatible-grid',
          'gridTicks',
          'gridTicks must divide the meter unit of ' +
            String(meterUnitTicks) +
            ' ticks',
        ),
      )
    }
  }

  if (value.loopStartTick !== 0) {
    issues.push(
      issue(
        'invalid-loop-start',
        'loopStartTick',
        'loopStartTick must be exactly zero in transport-v2',
      ),
    )
  }

  if (!isPositiveSafeInteger(value.loopEndTick)) {
    issues.push(
      issue(
        'invalid-loop-end',
        'loopEndTick',
        'loopEndTick must be a positive safe integer',
      ),
    )
  } else if (
    isRecord(value.meter) &&
    isPositiveSafeInteger(value.meter.numerator) &&
    value.meter.numerator <= MAX_METER_NUMERATOR &&
    typeof value.meter.denominator === 'number' &&
    ALLOWED_DENOMINATORS.has(value.meter.denominator)
  ) {
    const meterUnitTicks =
      (TRANSPORT_PPQ * 4) / value.meter.denominator
    const barTicks = meterUnitTicks * value.meter.numerator
    const barSpanCount = Math.ceil(value.loopEndTick / barTicks)
    if (
      !Number.isSafeInteger(barSpanCount) ||
      barSpanCount > MAX_TRANSPORT_BAR_SPANS
    ) {
      issues.push(
        issue(
          'loop-too-long',
          'loopEndTick',
          'loopEndTick may span at most ' +
            String(MAX_TRANSPORT_BAR_SPANS) +
            ' bars, including a partial final bar',
        ),
      )
    }
  }

  if (!isRecord(value.swing)) {
    issues.push(
      issue('invalid-swing', 'swing', 'swing must be an object'),
    )
  } else {
    issues.push(
      ...unexpectedFieldIssues(
        value.swing,
        new Set(['subdivisionTicks', 'amountPermille']),
        'swing',
      ),
    )
    const { subdivisionTicks, amountPermille } = value.swing
    if (!isPositiveSafeInteger(subdivisionTicks)) {
      issues.push(
        issue(
          'invalid-swing-subdivision',
          'swing.subdivisionTicks',
          'swing.subdivisionTicks must be a positive safe integer',
        ),
      )
    } else if (
      isRecord(value.meter) &&
      typeof value.meter.denominator === 'number' &&
      ALLOWED_DENOMINATORS.has(value.meter.denominator)
    ) {
      const meterUnitTicks =
        (TRANSPORT_PPQ * 4) / value.meter.denominator
      const pairTicks = subdivisionTicks * 2
      if (
        !Number.isSafeInteger(meterUnitTicks) ||
        !Number.isSafeInteger(pairTicks) ||
        meterUnitTicks % pairTicks !== 0
      ) {
        issues.push(
          issue(
            'incompatible-swing-subdivision',
            'swing.subdivisionTicks',
            'two swing subdivisions must divide the meter unit of ' +
              String(meterUnitTicks) +
              ' ticks',
          ),
        )
      }
    }

    if (
      typeof amountPermille !== 'number' ||
      !Number.isSafeInteger(amountPermille) ||
      amountPermille < 500 ||
      amountPermille > 750
    ) {
      issues.push(
        issue(
          'invalid-swing-amount',
          'swing.amountPermille',
          'swing.amountPermille must be an integer from 500 (straight) through 750',
        ),
      )
    }
  }

  if (
    typeof value.meterSource !== 'string' ||
    !ALLOWED_METER_SOURCES.has(value.meterSource)
  ) {
    issues.push(
      issue(
        'invalid-meter-source',
        'meterSource',
        'meterSource must be explicit, midi, or v1-implicit',
      ),
    )
  }

  if (
    isPositiveSafeInteger(value.gridTicks) &&
    isPositiveSafeInteger(value.loopEndTick)
  ) {
    const gridOpportunityCount = Math.ceil(
      value.loopEndTick / value.gridTicks,
    )
    if (
      !Number.isSafeInteger(gridOpportunityCount) ||
      gridOpportunityCount > MAX_TRANSPORT_GRID_OPPORTUNITIES
    ) {
      issues.push(
        issue(
          'too-many-grid-opportunities',
          'loopEndTick',
          'loopEndTick and gridTicks may define at most ' +
            String(MAX_TRANSPORT_GRID_OPPORTUNITIES) +
            ' grid opportunities',
        ),
      )
    }
  }

  if (issues.length === 0) {
    const meter = value.meter as Readonly<Record<string, unknown>>
    const swing = value.swing as Readonly<Record<string, unknown>>
    const identityInput = {
      version: value.version,
      ppq: value.ppq,
      tempoBpm: value.tempoBpm,
      meter: {
        numerator: meter.numerator,
        denominator: meter.denominator,
        beatGroups: [...(meter.beatGroups as readonly number[])],
      },
      gridTicks: value.gridTicks,
      loopStartTick: value.loopStartTick,
      loopEndTick: value.loopEndTick,
      swing: {
        subdivisionTicks: swing.subdivisionTicks,
        amountPermille: swing.amountPermille,
      },
      meterSource: value.meterSource,
    }
    const expectedId = stableId('transport', identityInput)
    if (value.id !== expectedId) {
      issues.push(
        issue(
          'transport-id-mismatch',
          'id',
          'id does not match the canonical transport content',
        ),
      )
    }
  }

  return issues
}

export class TransportValidationError extends Error {
  readonly issues: readonly TransportValidationIssue[]

  constructor(issues: readonly TransportValidationIssue[]) {
    super(
      issues
        .map(({ path, message }) => path + ': ' + message)
        .join('\n'),
    )
    this.name = 'TransportValidationError'
    this.issues = issues.map((entry) => ({ ...entry }))
  }
}

export function assertValidTransportSpec(
  value: unknown,
): asserts value is TransportSpec {
  const issues = validateTransportSpec(value)
  if (issues.length > 0) {
    throw new TransportValidationError(issues)
  }
}

function cloneMeter(meter: MeterSpec): MeterSpec {
  return {
    numerator: meter.numerator,
    denominator: meter.denominator,
    beatGroups: [...meter.beatGroups],
  }
}

function defaultGridTicks(meter: MeterSpec): number {
  const meterUnitTicks = (TRANSPORT_PPQ * 4) / meter.denominator
  return Number.isSafeInteger(meterUnitTicks)
    ? meterUnitTicks / 2
    : TRANSPORT_PPQ / 2
}

function defaultSwingSubdivision(
  meter: MeterSpec,
  gridTicks: number,
): number {
  const meterUnitTicks = (TRANSPORT_PPQ * 4) / meter.denominator
  const pairTicks = gridTicks * 2
  return Number.isSafeInteger(meterUnitTicks) &&
    Number.isSafeInteger(gridTicks) &&
    Number.isSafeInteger(pairTicks) &&
    meterUnitTicks % pairTicks === 0
    ? gridTicks
    : meterUnitTicks / 2
}

export function createTransportSpec(
  options: CreateTransportSpecOptions,
): TransportSpec {
  const meterValue: unknown = isMeterPresetId(options.meter)
    ? getMeterPreset(options.meter)
    : options.meter
  const meterIssues = validateMeterSpec(meterValue, TRANSPORT_PPQ)
  if (meterIssues.length > 0) {
    throw new TransportValidationError(meterIssues)
  }
  const meter = cloneMeter(meterValue as MeterSpec)

  const gridTicks = options.gridTicks ?? defaultGridTicks(meter)
  const identityInput = {
    version: TRANSPORT_VERSION,
    ppq: TRANSPORT_PPQ,
    tempoBpm: options.tempoBpm ?? 108,
    meter,
    gridTicks,
    loopStartTick: 0,
    loopEndTick: options.loopEndTick,
    swing: options.swing !== undefined
      ? { ...options.swing }
      : {
          subdivisionTicks: defaultSwingSubdivision(meter, gridTicks),
          amountPermille: 500,
        },
    meterSource: options.meterSource ?? 'explicit',
  }
  const preflight = {
    id: 'transport-0000000000000000',
    ...identityInput,
  }
  const preflightIssues = validateTransportSpec(preflight).filter(
    ({ code }) => code !== 'transport-id-mismatch',
  )
  if (preflightIssues.length > 0) {
    throw new TransportValidationError(preflightIssues)
  }
  const candidate = {
    id: stableId('transport', identityInput),
    ...identityInput,
  }

  assertValidTransportSpec(candidate)
  return candidate
}

export function isMeterDenominator(
  value: number,
): value is MeterDenominator {
  return ALLOWED_DENOMINATORS.has(value)
}
