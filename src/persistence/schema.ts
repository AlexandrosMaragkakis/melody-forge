import {
  cloneProjectState,
  MAX_FAVORITES,
  MAX_HISTORY_LENGTH,
  type ProjectState,
} from '../app/state'
import { validateMelody } from '../domain/invariants'
import { findScaleById } from '../domain/scales'
import type {
  Candidate,
  CandidateProvenance,
  EvolutionOperationProvenance,
  EvolutionSettings,
  GenerationSnapshot,
  JsonValue,
  Melody,
  MelodyEvent,
} from '../domain/types'
import {
  normalizeLegacySettings,
  type LegacyGeneratorSettings,
} from '../generators/legacy'
import {
  normalizeModernSettings,
  type ModernSettings,
} from '../generators/modern'

export const PROJECT_SCHEMA_VERSION = 1 as const
export const PROJECT_ENVELOPE_KIND = 'melody-forge-project' as const
export const CANDIDATE_ENVELOPE_KIND = 'melody-forge-candidate' as const

export interface ProjectEnvelopeV1 {
  readonly kind: typeof PROJECT_ENVELOPE_KIND
  readonly schemaVersion: typeof PROJECT_SCHEMA_VERSION
  readonly project: ProjectState
}

export interface CandidateEnvelopeV1 {
  readonly kind: typeof CANDIDATE_ENVELOPE_KIND
  readonly schemaVersion: typeof PROJECT_SCHEMA_VERSION
  readonly candidate: Candidate
}

export type DecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isJsonValue(
  value: unknown,
  depth = 0,
  ancestors: Set<object> = new Set(),
): value is JsonValue {
  if (depth > 20) {
    return false
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  if (typeof value !== 'object' || ancestors.has(value)) {
    return false
  }

  ancestors.add(value)
  const valid = Array.isArray(value)
    ? value.every((entry) => isJsonValue(entry, depth + 1, ancestors))
    : Object.values(value).every((entry) =>
        isJsonValue(entry, depth + 1, ancestors),
      )
  ancestors.delete(value)
  return valid
}

function parseOperations(
  value: unknown,
  errors: string[],
  path: string,
): readonly EvolutionOperationProvenance[] | null {
  if (!Array.isArray(value) || value.length > 64) {
    errors.push(`${path} must be an array with at most 64 operations`)
    return null
  }

  const operations: EvolutionOperationProvenance[] = []
  for (const [index, entry] of value.entries()) {
    if (
      !isRecord(entry) ||
      typeof entry.operator !== 'string' ||
      entry.operator.length === 0 ||
      !isRecord(entry.parameters) ||
      !isJsonValue(entry.parameters)
    ) {
      errors.push(`${path}[${String(index)}] is not valid operation provenance`)
      return null
    }
    operations.push({
      operator: entry.operator,
      parameters: entry.parameters,
    })
  }
  return operations
}

function parseProvenance(
  value: unknown,
  errors: string[],
  path: string,
): CandidateProvenance | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`)
    return null
  }

  const { strategy, generatorVersion, seed, settings, generation, parentIds } = value
  const operations = parseOperations(value.operations, errors, `${path}.operations`)
  if (
    (strategy !== 'legacy' && strategy !== 'modern' && strategy !== 'evolution') ||
    typeof generatorVersion !== 'string' ||
    generatorVersion.length === 0 ||
    typeof seed !== 'string' ||
    !isRecord(settings) ||
    !isJsonValue(settings) ||
    !isSafeInteger(generation) ||
    generation < 0 ||
    !isStringArray(parentIds) ||
    parentIds.length > 2 ||
    operations === null
  ) {
    errors.push(`${path} has invalid strategy, version, seed, settings, generation, or parents`)
    return null
  }

  return {
    strategy,
    generatorVersion,
    seed,
    settings,
    generation,
    parentIds: [...parentIds],
    operations,
  }
}

function parseMelody(
  value: unknown,
  errors: string[],
  path: string,
): Melody | null {
  if (!isRecord(value) || !Array.isArray(value.events) || !isRecord(value.constraints)) {
    errors.push(`${path} must contain event and constraint data`)
    return null
  }
  if (value.events.length === 0 || value.events.length > 128) {
    errors.push(`${path}.events must contain 1–128 entries`)
    return null
  }

  const events: MelodyEvent[] = []
  for (const [index, event] of value.events.entries()) {
    if (
      !isRecord(event) ||
      !isSafeInteger(event.startTick) ||
      !isSafeInteger(event.durationTicks) ||
      (event.degree !== null && !isSafeInteger(event.degree))
    ) {
      errors.push(`${path}.events[${String(index)}] has invalid integer timing or degree`)
      return null
    }
    events.push({
      startTick: event.startTick,
      durationTicks: event.durationTicks,
      degree: event.degree,
    })
  }

  const constraints = value.constraints
  const scale =
    typeof constraints.scaleId === 'string'
      ? findScaleById(constraints.scaleId)
      : undefined
  if (
    scale === undefined ||
    !isSafeInteger(constraints.tonicPitchClass) ||
    !isSafeInteger(constraints.tonicMidi) ||
    !isRecord(constraints.register) ||
    !isSafeInteger(constraints.register.minMidi) ||
    !isSafeInteger(constraints.register.maxMidi) ||
    (constraints.pitchMapping !== 'tonic-relative' &&
      constraints.pitchMapping !== 'legacy-fixed-octave') ||
    !isSafeInteger(constraints.ticksPerBeat) ||
    !isSafeInteger(constraints.gridTicks) ||
    !isSafeInteger(constraints.totalTicks) ||
    !isFiniteNumber(constraints.tempoBpm) ||
    !isRecord(constraints.tonicBoundary) ||
    typeof constraints.tonicBoundary.start !== 'boolean' ||
    typeof constraints.tonicBoundary.end !== 'boolean'
  ) {
    errors.push(`${path}.constraints contains invalid musical fields`)
    return null
  }

  const melody: Melody = {
    events,
    constraints: {
      scaleId: scale.id,
      tonicPitchClass: constraints.tonicPitchClass,
      tonicMidi: constraints.tonicMidi,
      register: {
        minMidi: constraints.register.minMidi,
        maxMidi: constraints.register.maxMidi,
      },
      pitchMapping: constraints.pitchMapping,
      ticksPerBeat: constraints.ticksPerBeat,
      gridTicks: constraints.gridTicks,
      totalTicks: constraints.totalTicks,
      tempoBpm: constraints.tempoBpm,
      tonicBoundary: {
        start: constraints.tonicBoundary.start,
        end: constraints.tonicBoundary.end,
      },
    },
  }
  const issues = validateMelody(melody, scale)
  if (issues.length > 0) {
    errors.push(
      `${path} violates melody invariants: ${issues
        .map(({ code }) => code)
        .join(', ')}`,
    )
    return null
  }
  return melody
}

export function decodeCandidateValue(value: unknown): DecodeResult<Candidate> {
  const errors: string[] = []
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return { ok: false, error: 'Candidate must have a non-empty string ID' }
  }
  const melody = parseMelody(value.melody, errors, 'candidate.melody')
  const provenance = parseProvenance(
    value.provenance,
    errors,
    'candidate.provenance',
  )
  if (melody === null || provenance === null) {
    return { ok: false, error: errors.join('; ') }
  }
  return { ok: true, value: { id: value.id, melody, provenance } }
}

function parseEvolutionSettings(value: unknown): EvolutionSettings | null {
  if (
    !isRecord(value) ||
    !isSafeInteger(value.populationSize) ||
    value.populationSize < 1 ||
    value.populationSize > 16 ||
    !isFiniteNumber(value.mutationStrength) ||
    value.mutationStrength < 0 ||
    value.mutationStrength > 1 ||
    typeof value.retainElites !== 'boolean'
  ) {
    return null
  }
  return {
    populationSize: value.populationSize,
    mutationStrength: value.mutationStrength,
    retainElites: value.retainElites,
  }
}

function parseSnapshot(
  value: unknown,
  errors: string[],
  path: string,
): GenerationSnapshot | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !isSafeInteger(value.generation) ||
    value.generation < 0 ||
    typeof value.seed !== 'string' ||
    typeof value.generatorVersion !== 'string' ||
    !Array.isArray(value.candidates) ||
    value.candidates.length === 0 ||
    value.candidates.length > 16 ||
    !isStringArray(value.selectedParentIds) ||
    value.selectedParentIds.length > 2 ||
    new Set(value.selectedParentIds).size !== value.selectedParentIds.length ||
    (value.previousGenerationId !== null &&
      typeof value.previousGenerationId !== 'string')
  ) {
    errors.push(`${path} has an invalid snapshot envelope`)
    return null
  }

  const candidates: Candidate[] = []
  const candidateIds = new Set<string>()
  for (const [index, candidateValue] of value.candidates.entries()) {
    const decoded = decodeCandidateValue(candidateValue)
    if (!decoded.ok) {
      errors.push(`${path}.candidates[${String(index)}]: ${decoded.error}`)
      return null
    }
    if (decoded.value.provenance.generation > value.generation) {
      errors.push(`${path}.candidates[${String(index)}] comes from a future generation`)
      return null
    }
    if (candidateIds.has(decoded.value.id)) {
      errors.push(`${path}.candidates must have unique IDs`)
      return null
    }
    candidateIds.add(decoded.value.id)
    candidates.push(decoded.value)
  }

  const evolutionSettings =
    value.evolutionSettings === null
      ? null
      : parseEvolutionSettings(value.evolutionSettings)
  if (value.evolutionSettings !== null && evolutionSettings === null) {
    errors.push(`${path}.evolutionSettings is invalid`)
    return null
  }

  return {
    id: value.id,
    generation: value.generation,
    seed: value.seed,
    generatorVersion: value.generatorVersion,
    candidates,
    selectedParentIds: [...value.selectedParentIds],
    evolutionSettings,
    previousGenerationId: value.previousGenerationId,
  }
}

function parseLegacySettings(value: unknown): LegacyGeneratorSettings | null {
  if (!isRecord(value)) {
    return null
  }
  const scale = typeof value.scaleId === 'string' ? findScaleById(value.scaleId) : undefined
  if (
    scale === undefined ||
    !isSafeInteger(value.tonicPitchClass) ||
    !isSafeInteger(value.noteCount) ||
    !isFiniteNumber(value.tempoBpm) ||
    !isSafeInteger(value.populationSize) ||
    typeof value.seed !== 'string'
  ) {
    return null
  }
  const settings: LegacyGeneratorSettings = {
    tonicPitchClass: value.tonicPitchClass,
    scaleId: scale.id,
    noteCount: value.noteCount,
    tempoBpm: value.tempoBpm,
    populationSize: value.populationSize,
    seed: value.seed,
  }
  try {
    return normalizeLegacySettings(settings)
  } catch {
    return null
  }
}

function parseModernSettings(value: unknown): ModernSettings | null {
  if (!isRecord(value)) {
    return null
  }
  const scale = typeof value.scaleId === 'string' ? findScaleById(value.scaleId) : undefined
  if (
    scale === undefined ||
    !isSafeInteger(value.tonicPitchClass) ||
    !isSafeInteger(value.registerLowOctave) ||
    !isSafeInteger(value.registerHighOctave) ||
    !isSafeInteger(value.noteCount) ||
    !isSafeInteger(value.phraseBeats) ||
    !isFiniteNumber(value.tempoBpm) ||
    (value.gridTicks !== 120 && value.gridTicks !== 240 && value.gridTicks !== 480) ||
    typeof value.allowRests !== 'boolean' ||
    !isSafeInteger(value.maxLeap) ||
    typeof value.tonicClosure !== 'boolean' ||
    !isSafeInteger(value.populationSize) ||
    typeof value.seed !== 'string'
  ) {
    return null
  }
  const settings: ModernSettings = {
    tonicPitchClass: value.tonicPitchClass,
    scaleId: scale.id,
    registerLowOctave: value.registerLowOctave,
    registerHighOctave: value.registerHighOctave,
    noteCount: value.noteCount,
    phraseBeats: value.phraseBeats,
    tempoBpm: value.tempoBpm,
    gridTicks: value.gridTicks,
    allowRests: value.allowRests,
    maxLeap: value.maxLeap,
    tonicClosure: value.tonicClosure,
    populationSize: value.populationSize,
    seed: value.seed,
  }
  const normalized = normalizeModernSettings(settings)
  return JSON.stringify(normalized) === JSON.stringify(settings) ? normalized : null
}

export function decodeProjectValue(value: unknown): DecodeResult<ProjectState> {
  if (!isRecord(value)) {
    return { ok: false, error: 'Project must be an object' }
  }

  const legacySettings = parseLegacySettings(value.legacySettings)
  const modernSettings = parseModernSettings(value.modernSettings)
  const evolutionSettings = parseEvolutionSettings(value.evolutionSettings)
  if (
    (value.mode !== 'legacy' && value.mode !== 'modern') ||
    legacySettings === null ||
    modernSettings === null ||
    evolutionSettings === null ||
    !Array.isArray(value.history) ||
    value.history.length > MAX_HISTORY_LENGTH ||
    !isSafeInteger(value.historyIndex) ||
    !Array.isArray(value.favorites) ||
    value.favorites.length > MAX_FAVORITES ||
    typeof value.loop !== 'boolean'
  ) {
    return { ok: false, error: 'Project settings or collection bounds are invalid' }
  }

  const errors: string[] = []
  const history: GenerationSnapshot[] = []
  for (const [index, snapshotValue] of value.history.entries()) {
    const snapshot = parseSnapshot(snapshotValue, errors, `history[${String(index)}]`)
    if (snapshot === null) {
      return { ok: false, error: errors.join('; ') }
    }
    history.push(snapshot)
  }

  if (
    (history.length === 0 && value.historyIndex !== -1) ||
    (history.length > 0 &&
      (value.historyIndex < 0 || value.historyIndex >= history.length))
  ) {
    return { ok: false, error: 'Project history index is out of bounds' }
  }

  const favorites: Candidate[] = []
  const favoriteIds = new Set<string>()
  for (const [index, favoriteValue] of value.favorites.entries()) {
    const candidate = decodeCandidateValue(favoriteValue)
    if (!candidate.ok) {
      return {
        ok: false,
        error: `favorites[${String(index)}]: ${candidate.error}`,
      }
    }
    if (favoriteIds.has(candidate.value.id)) {
      return { ok: false, error: 'Favorite candidate IDs must be unique' }
    }
    favoriteIds.add(candidate.value.id)
    favorites.push(candidate.value)
  }

  return {
    ok: true,
    value: cloneProjectState({
      mode: value.mode,
      legacySettings,
      modernSettings,
      evolutionSettings,
      history,
      historyIndex: value.historyIndex,
      favorites,
      loop: value.loop,
    }),
  }
}

export function decodeProjectEnvelope(value: unknown): DecodeResult<ProjectState> {
  if (!isRecord(value) || value.kind !== PROJECT_ENVELOPE_KIND) {
    return { ok: false, error: 'File is not a Melody Forge project' }
  }
  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported project schema version: ${String(value.schemaVersion)}`,
    }
  }
  return decodeProjectValue(value.project)
}

export function decodeCandidateEnvelope(value: unknown): DecodeResult<Candidate> {
  if (!isRecord(value) || value.kind !== CANDIDATE_ENVELOPE_KIND) {
    return { ok: false, error: 'File is not a Melody Forge candidate' }
  }
  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported candidate schema version: ${String(value.schemaVersion)}`,
    }
  }
  return decodeCandidateValue(value.candidate)
}

export function createProjectEnvelope(state: ProjectState): ProjectEnvelopeV1 {
  return {
    kind: PROJECT_ENVELOPE_KIND,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    project: cloneProjectState(state),
  }
}

export function createCandidateEnvelope(candidate: Candidate): CandidateEnvelopeV1 {
  const decoded = decodeCandidateValue(candidate)
  if (!decoded.ok) {
    throw new TypeError(decoded.error)
  }
  return {
    kind: CANDIDATE_ENVELOPE_KIND,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    candidate: decoded.value,
  }
}
