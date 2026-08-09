import type { ScaleId } from './scales'

/** Integer musical time measured from the beginning of a phrase. */
export type Tick = number

/** MIDI note number. Valid sounding values are checked at the domain boundary. */
export type MidiNote = number

/** Chromatic pitch class where C is 0 and B is 11. */
export type PitchClass = number

/**
 * An extended diatonic degree. Zero is the tonic, `scale.length` is the tonic
 * one octave above, and negative values address degrees below the anchor.
 */
export type ScaleDegree = number

export type PitchMapping = 'tonic-relative' | 'legacy-fixed-octave'

export interface MelodyEvent {
  readonly startTick: Tick
  readonly durationTicks: Tick
  /** A null degree is an explicit rest that still occupies its time span. */
  readonly degree: ScaleDegree | null
}

export interface MidiRegister {
  /** Inclusive lower MIDI bound. */
  readonly minMidi: MidiNote
  /** Inclusive upper MIDI bound. */
  readonly maxMidi: MidiNote
}

export interface TonicBoundaryFlags {
  readonly start: boolean
  readonly end: boolean
}

/** The complete musical context required to interpret a melody's events. */
export interface MelodyConstraints {
  readonly scaleId: ScaleId
  readonly tonicPitchClass: PitchClass
  /** MIDI pitch represented by extended scale degree zero. */
  readonly tonicMidi: MidiNote
  readonly register: MidiRegister
  readonly pitchMapping: PitchMapping
  readonly ticksPerBeat: Tick
  readonly gridTicks: Tick
  readonly totalTicks: Tick
  readonly tempoBpm: number
  readonly tonicBoundary: TonicBoundaryFlags
}

/**
 * Events cover the phrase contiguously. Silence is represented by an event
 * whose degree is null, so gaps and overlapping events are never implicit.
 */
export interface Melody {
  readonly events: readonly MelodyEvent[]
  readonly constraints: MelodyConstraints
}

export type GenerationStrategy = 'legacy' | 'modern' | 'evolution'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

export interface EvolutionOperationProvenance {
  /** Stable operator name, such as `degree-step` or `event-crossover`. */
  readonly operator: string
  readonly parameters: Readonly<Record<string, JsonValue>>
}

/** Reproducibility and ancestry recorded with every candidate. */
export interface CandidateProvenance {
  /** Evolved descendants always use `evolution`, irrespective of their parent strategy. */
  readonly strategy: GenerationStrategy
  readonly generatorVersion: string
  readonly seed: string
  /** Generator settings needed to explain and reproduce this exact candidate. */
  readonly settings: Readonly<Record<string, JsonValue>>
  /** Initial generated populations use generation zero. */
  readonly generation: number
  readonly parentIds: readonly string[]
  readonly operations: readonly EvolutionOperationProvenance[]
}

export type Provenance = CandidateProvenance

export interface Candidate {
  readonly id: string
  readonly melody: Melody
  readonly provenance: CandidateProvenance
}

export interface EvolutionSettings {
  readonly populationSize: number
  /** Normalized strength in the inclusive range 0–1. */
  readonly mutationStrength: number
  readonly retainElites: boolean
}

/** A self-contained history entry suitable for browser-local persistence. */
export interface GenerationSnapshot {
  readonly id: string
  readonly generation: number
  readonly seed: string
  readonly generatorVersion: string
  readonly candidates: readonly Candidate[]
  readonly selectedParentIds: readonly string[]
  readonly evolutionSettings: EvolutionSettings | null
  readonly previousGenerationId: string | null
}
