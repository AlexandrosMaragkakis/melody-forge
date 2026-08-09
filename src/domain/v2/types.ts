import type { Tick } from '../types'
import type { TransportSpec } from '../transport/types'
import type { V1CompatibilityTimingProfile } from '../transport/compatibility'

export type ReadonlyJsonPrimitive = string | number | boolean | null
export type ReadonlyJsonValue =
  | ReadonlyJsonPrimitive
  | readonly ReadonlyJsonValue[]
  | ReadonlyJsonObject
export interface ReadonlyJsonObject {
  readonly [key: string]: ReadonlyJsonValue
}

export interface AlgorithmVersionRegistryV2 {
  readonly version: 'algorithm-version-registry-v2'
  readonly generators: {
    readonly legacy: 'legacy-simple-v1'
    readonly modern: 'modern-constrained-v1'
    readonly v1Evolution: 'interactive-evolution-v1'
  }
  readonly foundations: {
    readonly rng: 'sfc32-v1'
    readonly seedTree: 'labelled-seed-tree-v2'
    readonly transport: 'transport-v2'
    readonly v1CompatibilityTiming: 'v1-compat-timing-v1'
    readonly v1TimingAdaptation: 'v1-timing-adaptation-proposal-v1'
    readonly v1Migration: 'v1-project-migration-v2.0.0'
    readonly melodyRender: 'melody-render-v2.0.0'
    readonly candidateProvenance: 'candidate-provenance-v2'
    readonly preferenceEffect: 'preference-effect-v2'
    readonly beatGenerator: 'beat-generator-v2.0.0'
  }
  readonly strategies: {
    readonly breed: 'breed-strategy-v2.0.0'
    readonly drift: 'drift-strategy-v2.0.0'
    readonly islands: 'islands-strategy-v2.0.0'
    readonly map: 'map-elites-strategy-v2.0.0'
    readonly pareto: 'nsga2-pareto-strategy-v2.0.0'
    readonly pairLab: 'pair-lab-strategy-v2.0.0'
  }
  readonly formulas: {
    readonly customScaleDegeneracy: 'custom-scale-degeneracy-v2.0.0'
    readonly tonalRelationship: 'tonal-relationship-v2.0.0'
    readonly tonalMutationBands: 'tonal-mutation-bands-v2.0.0'
    readonly descriptorCore: 'descriptor-core-v2.0.0'
    readonly motifNgrams: 'motif-ngrams-v2.0.0'
    readonly rhythmEntropy: 'rhythm-entropy-v2.0.0'
    readonly meterSyncopation: 'meter-syncopation-v2.0.0'
    readonly pitchParentDistance: 'pitch-parent-distance-v2.0.0'
    readonly rhythmParentDistance: 'rhythm-parent-distance-v2.0.0'
    readonly tonalParentDistance: 'tonal-parent-distance-v2.0.0'
    readonly structuralDistance: 'structural-distance-v2.0.0'
    readonly beatDistance: 'beat-distance-v2.0.0'
    readonly phenotypeDistance: 'phenotype-distance-v2.0.0'
    readonly beatDescriptors: 'beat-descriptors-v2.0.0'
    readonly accentCoincidence: 'accent-coincidence-v2.0.0'
    readonly tonalAxis: 'tonal-axis-v2.0.0'
    readonly islandsGlobalDiversity: 'islands-global-diversity-v2.0.0'
    readonly pairPhenotypeDistance: 'pair-phenotype-distance-v2.0.0'
    readonly pairLabTransition: 'pair-lab-transition-v2.0.0'
    readonly operatorAttemptBudget: 'operator-attempt-budget-v2.0.0'
  }
  readonly midiImport: {
    readonly bounds: 'midi-import-bounds-v2.0.0'
    readonly monophonicExtraction: 'midi-monophonic-extraction-v2.0.0'
  }
}

export type CanonicalCandidateTimingRefV2 = {
  readonly kind: 'canonical-transport'
  readonly transportId: string
}

export type V1CompatibilityCandidateTimingRefV2 = {
  readonly kind: 'v1-compatibility'
  readonly timingProfileId: string
}

export type CandidateTimingRefV2 =
  | CanonicalCandidateTimingRefV2
  | V1CompatibilityCandidateTimingRefV2

export type ProjectDestinationV2 = 'create' | 'evolve' | 'explore' | 'library'
export type EvolutionWorkspaceModeV2 = 'breed' | 'drift' | 'islands' | 'pair-lab'
export type ExploreWorkspaceModeV2 = 'map' | 'pareto'

export interface ProjectV2 {
  readonly id: string
  readonly version: 'project-v2'
  readonly schemaVersion: 2
  readonly name: string
  readonly rootSeed: string
  readonly algorithmVersions: AlgorithmVersionRegistryV2
  readonly createdAtEpochMs: number | null
  readonly updatedAtEpochMs: number | null
  readonly destination: ProjectDestinationV2
  readonly activeEvolutionMode: EvolutionWorkspaceModeV2
  readonly activeExploreMode: ExploreWorkspaceModeV2
  readonly comparisonTransportId: string | null
  readonly auditionTiming: CandidateTimingRefV2 | null
  readonly activePerformanceId: string
  readonly sharedBeatId: string | null
  readonly activePairingId: string | null
  readonly loopEnabled: boolean
  readonly accompanimentMuted: boolean
  readonly focusedMelodyCandidateId: string | null
  readonly selectedMelodyCandidateIds: readonly string[]
  readonly createStateId: string
  readonly modeStateIds: {
    readonly breed: string
    readonly drift: string
    readonly islands: string
    readonly map: string
    readonly pareto: string
    readonly pairLab: string
  }
  readonly historyGraphId: string
  readonly undoStateId: string
  readonly nextPreferenceOccurrence: number
  readonly preferenceRecordIds: readonly string[]
  readonly activePreferenceRecordIds: readonly string[]
  readonly ratingIds: readonly string[]
  readonly annotationIds: readonly string[]
  readonly libraryItemIds: readonly string[]
  readonly migrationReceiptIds: readonly string[]
}

export interface StoredProjectRecordV2 {
  readonly id: string
  readonly version: 'stored-project-record-v2'
  readonly revision: number
  readonly project: ProjectV2
}

export type ComponentLockKindV2 =
  | 'relative-pitch-shape'
  | 'rhythm'
  | 'contour'
  | 'opening-event'
  | 'closing-event'
  | 'rest-positions'
  | 'tonal-context'
  | 'tonic'
  | 'scale'

export type EventLockScopeV2 = 'pitch' | 'rhythm' | 'both'

export interface ComponentLockV2 {
  readonly id: string
  readonly version: 'component-lock-v2'
  readonly kind: ComponentLockKindV2
  readonly capturedEventIds: readonly string[]
  readonly sourceFingerprint: string
}

export interface AbsolutePitchRequirementV2 {
  readonly eventId: string
  readonly midi: number
}

export interface AbsolutePitchLockV2 {
  readonly id: string
  readonly version: 'absolute-pitch-lock-v2'
  readonly requirements: readonly AbsolutePitchRequirementV2[]
  readonly sourceFingerprint: string
}

export interface EventLockV2 {
  readonly id: string
  readonly version: 'event-lock-v2'
  readonly eventId: string
  readonly scope: EventLockScopeV2
  readonly sourceFingerprint: string
}

export interface RegionLockV2 {
  readonly id: string
  readonly version: 'region-lock-v2'
  readonly startTick: Tick
  readonly endTick: Tick
  readonly scope: EventLockScopeV2
  readonly capturedEventIds: readonly string[]
  readonly sourceFingerprint: string
}

export interface LockSetV2 {
  readonly version: 'lock-set-v2'
  readonly componentLocks: readonly ComponentLockV2[]
  readonly absolutePitchLock: AbsolutePitchLockV2 | null
  readonly eventLocks: readonly EventLockV2[]
  readonly regionLocks: readonly RegionLockV2[]
}

export interface PitchGeneV2 {
  readonly eventId: string
  readonly extendedDegree: number
}

export interface PitchShapeGenomeV2 {
  readonly version: 'pitch-shape-v2'
  readonly mapping: 'tonal-relative' | 'legacy-fixed-octave' | 'absolute-import'
  readonly genes: readonly PitchGeneV2[]
  readonly register: { readonly minMidi: number; readonly maxMidi: number }
}

export interface RhythmGeneV2 {
  readonly eventId: string
  readonly onsetTick: Tick
  readonly durationTicks: Tick
  readonly isRest: boolean
  readonly accent: number
  readonly tieToNext: boolean
}

export interface RhythmGenomeV2 {
  readonly version: 'rhythm-v2'
  readonly events: readonly RhythmGeneV2[]
  readonly sourceGridTicks: Tick
}

export interface MelodyGenomeV2 {
  readonly version: 'melody-genome-v2'
  readonly id: string
  readonly pitchShape: PitchShapeGenomeV2
  readonly rhythm: RhythmGenomeV2
  readonly tonalTimelineId: string
  readonly timing: CandidateTimingRefV2
  readonly locks: LockSetV2
}

export interface RenderedMelodyEventV2 {
  readonly eventId: string
  readonly onsetTick: Tick
  readonly durationTicks: Tick
  readonly midi: number | null
  readonly velocity: number
  readonly tonalSegmentId: string
  /** M2 registers migrated V1 candidates only, for which borrowing is null. */
  readonly borrowing: null
  readonly contributionIds: readonly string[]
}

export interface RenderedMelodyPhenotypeV2 {
  readonly version: 'rendered-melody-phenotype-v2'
  readonly renderVersion: string
  readonly inputFingerprint: string
  readonly timingFingerprint: string
  readonly events: readonly RenderedMelodyEventV2[]
  readonly phenotypeFingerprint: string
}

export interface CandidateDescriptorValueV2 {
  readonly descriptorId: string
  readonly formulaVersion: string
  readonly rawValue: number | null
  readonly normalizedValue: number | null
  readonly dependencyFingerprint: string
}

export interface CandidateOperationProvenanceV2 {
  readonly version: 'candidate-operation-v2'
  readonly kind:
    | 'generate'
    | 'import'
    | 'crossover'
    | 'mutation'
    | 'transform'
    | 'adapt'
    | 'borrow'
    | 'modulate'
  readonly operatorId: string
  readonly parameters: ReadonlyJsonObject
}

export interface CandidateContributionV2 {
  readonly id: string
  readonly version: 'candidate-contribution-v2'
  readonly eventId: string
  readonly component: 'pitch' | 'rhythm' | 'tonal'
  readonly source:
    | 'generator'
    | 'import'
    | 'migrated-v1'
    | 'parent-a'
    | 'parent-b'
    | 'mutation'
    | 'remap'
    | 'repair'
    | 'elite'
  readonly sourceCandidateId: string | null
  readonly sourceEventId: string | null
}

export interface CandidateRepairV2 {
  readonly id: string
  readonly version: 'candidate-repair-v2'
  readonly reasonCode: string
  readonly changes: readonly {
    readonly fieldPath: string
    readonly before: ReadonlyJsonValue
    readonly after: ReadonlyJsonValue
  }[]
}

export interface LockVerificationFingerprintV2 {
  readonly lockId: string
  readonly scopeFingerprint: string
  readonly resultFingerprint: string
  readonly preserved: true
}

export interface CandidateProvenanceV2 {
  readonly version: 'candidate-provenance-v2'
  readonly rootSeed: string
  readonly seedPath: readonly string[]
  readonly rngVersion: string
  readonly algorithmVersion: string
  readonly renderVersion: string
  readonly descriptorSetVersion: string
  readonly operations: readonly CandidateOperationProvenanceV2[]
  readonly contributions: readonly CandidateContributionV2[]
  readonly repairs: readonly CandidateRepairV2[]
  readonly lockVerificationFingerprints: readonly LockVerificationFingerprintV2[]
}

export interface CandidateLineageV2 {
  readonly version: 'candidate-lineage-v2'
  readonly geneticParentCandidateIds: readonly string[]
  readonly componentParentCandidateIds: {
    readonly pitch: readonly string[]
    readonly rhythm: readonly string[]
    readonly tonal: readonly string[]
  }
  readonly sourceHistoryNodeIds: readonly string[]
}

export interface FrozenV1CandidateV1 {
  readonly id: string
  readonly melody: {
    readonly events: readonly {
      readonly startTick: number
      readonly durationTicks: number
      readonly degree: number | null
    }[]
    readonly constraints: {
      readonly scaleId: string
      readonly tonicPitchClass: number
      readonly tonicMidi: number
      readonly register: { readonly minMidi: number; readonly maxMidi: number }
      readonly pitchMapping: 'tonic-relative' | 'legacy-fixed-octave'
      readonly ticksPerBeat: number
      readonly gridTicks: number
      readonly totalTicks: number
      readonly tempoBpm: number
      readonly tonicBoundary: { readonly start: boolean; readonly end: boolean }
    }
  }
  readonly provenance: {
    readonly strategy: 'legacy' | 'modern' | 'evolution'
    readonly generatorVersion: string
    readonly seed: string
    readonly settings: ReadonlyJsonObject
    readonly generation: number
    readonly parentIds: readonly string[]
    readonly operations: readonly {
      readonly operator: string
      readonly parameters: ReadonlyJsonObject
    }[]
  }
}

export interface V1CompatibilitySourceV2 {
  readonly version: 'frozen-v1-candidate-v1'
  readonly candidate: FrozenV1CandidateV1
}

export interface NativeMelodyCandidateV2 {
  readonly id: string
  readonly version: 'melody-candidate-v2'
  readonly candidateKind: 'native-v2'
  readonly melodyGenomeId: string
  readonly renderedPhenotype: RenderedMelodyPhenotypeV2
  readonly descriptorValues: readonly CandidateDescriptorValueV2[]
  readonly provenance: CandidateProvenanceV2
  readonly lineage: CandidateLineageV2
  readonly compatibilitySource: null
}

export interface MigratedV1MelodyCandidateV2
  extends Omit<NativeMelodyCandidateV2, 'candidateKind' | 'compatibilitySource'> {
  readonly candidateKind: 'migrated-v1'
  readonly compatibilitySource: V1CompatibilitySourceV2
}

export type MelodyCandidateV2 =
  | NativeMelodyCandidateV2
  | MigratedV1MelodyCandidateV2

export interface LegacyCreateSettingsV2 {
  readonly tonicPitchClass: number
  readonly scaleId: string
  readonly noteCount: number
  readonly tempoBpm: number
  readonly populationSize: number
  readonly seed: string
}

export interface ModernCreateSettingsV2 {
  readonly tonicPitchClass: number
  readonly scaleId: string
  readonly registerLowOctave: number
  readonly registerHighOctave: number
  readonly noteCount: number
  readonly phraseBeats: number
  readonly tempoBpm: number
  readonly gridTicks: 120 | 240 | 480
  readonly allowRests: boolean
  readonly maxLeap: number
  readonly tonicClosure: boolean
  readonly populationSize: number
  readonly seed: string
}

export interface CreateStateV2 {
  readonly id: string
  readonly version: 'create-state-v2'
  readonly projectId: string
  readonly activeGenerator: 'legacy' | 'modern'
  readonly legacySettings: LegacyCreateSettingsV2
  readonly modernSettings: ModernCreateSettingsV2
}

export type EvolutionModeV2 =
  | 'breed'
  | 'drift'
  | 'islands'
  | 'map'
  | 'pareto'
  | 'pair-lab'

export interface EmptyModePayloadV2 {
  readonly version: 'empty-mode-state-v2'
  readonly initialized: false
}

export interface BreedModePayloadV2 {
  readonly version: 'breed-mode-state-v2.0.0'
  readonly initialized: true
  readonly populationCandidateIds: readonly string[]
  readonly parentCandidateIds: readonly string[]
  readonly populationSize: number
  readonly mutationStrength: number
  readonly retainElites: boolean
  readonly crossoverPolicy: 'conservative-directed'
  readonly exactDeduplication: boolean
  readonly noveltyProtection: boolean
  readonly seed: string
  readonly generationOrdinal: number
}

export type RegisteredModePayloadV2 = EmptyModePayloadV2 | BreedModePayloadV2

export interface ModeStateV2 {
  readonly id: string
  readonly version: 'mode-state-v2'
  readonly projectId: string
  readonly mode: EvolutionModeV2
  readonly payload: RegisteredModePayloadV2
}

export interface V1EvolutionSettingsV2 {
  readonly populationSize: number
  readonly mutationStrength: number
  readonly retainElites: boolean
}

export interface MigratedV1SnapshotPayloadV2 {
  readonly version: 'migrated-v1-snapshot-payload-v2'
  readonly sourceSeed: string
  readonly sourceGeneratorVersion: string
  readonly sourceEvolutionSettings: V1EvolutionSettingsV2 | null
}

export type RegisteredSnapshotPayloadV2 = MigratedV1SnapshotPayloadV2

export type HistoryModeV2 =
  | 'create'
  | 'breed'
  | 'drift'
  | 'islands'
  | 'map'
  | 'pareto'
  | 'pair-lab'
  | 'import'
  | 'transform'

export interface SnapshotV2 {
  readonly id: string
  readonly version: 'snapshot-v2'
  readonly projectId: string
  readonly sourceKind: 'native-v2' | 'migrated-v1'
  readonly mode: HistoryModeV2
  readonly generationOrdinal: number
  readonly seed: string
  readonly algorithmVersions: AlgorithmVersionRegistryV2
  readonly candidateIds: readonly string[]
  readonly selectedCandidateIds: readonly string[]
  readonly ratingIds: readonly string[]
  readonly annotationIds: readonly string[]
  readonly payload: RegisteredSnapshotPayloadV2
}

export interface HistoryActionSummaryV2 {
  readonly version: 'history-action-summary-v2'
  readonly kind:
    | 'generate'
    | 'evolve'
    | 'promote-anchor'
    | 'migrate-v1'
    | 'import'
    | 'transform'
}

export interface V1LinearHistoryGraphSourceV2 {
  readonly version: 'v1-linear-history-graph-source-v2'
  readonly sourceHistoryLength: number
  readonly sourceHistoryIndex: number
}

export interface V1LinearHistoryNodeSourceV2 {
  readonly version: 'v1-linear-history-node-source-v2'
  readonly sourceHistoryOrdinal: number
  readonly sourceSnapshotId: string
  readonly sourcePreviousGenerationId: string | null
  readonly parentResolution:
    | 'root'
    | 'source-previous-generation-id'
    | 'stored-order-fallback'
}

export interface HistoryGraphV2 {
  readonly id: string
  readonly version: 'history-graph-v2'
  readonly projectId: string
  readonly nextNodeOccurrence: number
  readonly nodeIds: readonly string[]
  readonly rootNodeIds: readonly string[]
  readonly activeNodeId: string | null
  readonly v1LinearSource: V1LinearHistoryGraphSourceV2 | null
}

export interface HistoryNodeV2 {
  readonly id: string
  readonly version: 'history-node-v2'
  readonly projectId: string
  readonly historyGraphId: string
  readonly occurrenceOrdinal: number
  readonly parentNodeId: string | null
  readonly snapshotId: string
  readonly mode: HistoryModeV2
  readonly action: HistoryActionSummaryV2
  readonly v1LinearSource: V1LinearHistoryNodeSourceV2 | null
}

export interface LibraryOriginReferenceV2 {
  readonly kind: 'project-save' | 'v1-favorite' | 'json-import'
  readonly projectId: string | null
  readonly historyNodeId: string | null
  readonly sourceHash: string | null
  readonly sourceId: string
}

export interface LibraryItemV2 {
  readonly id: string
  readonly version: 'library-item-v2'
  readonly kind: 'melody-candidate' | 'beat' | 'pairing'
  readonly componentId: string
  readonly name: string
  readonly note: string
  readonly favorite: boolean
  readonly savedAtEpochMs: number | null
  readonly originReferences: readonly LibraryOriginReferenceV2[]
}

export type UserMetadataTargetKindV2 = 'melody-candidate' | 'beat' | 'pairing'

export interface RatingV2 {
  readonly id: string
  readonly version: 'rating-v2'
  readonly projectId: string
  readonly targetKind: UserMetadataTargetKindV2
  readonly targetId: string
  readonly value: 1 | 2 | 3 | 4 | 5
}

export interface AnnotationV2 {
  readonly id: string
  readonly version: 'annotation-v2'
  readonly projectId: string
  readonly targetKind: UserMetadataTargetKindV2
  readonly targetId: string
  readonly text: string
}

export interface UndoPatchV2 {
  readonly targetKind:
    | 'project'
    | 'create-state'
    | 'mode-state'
    | 'rating'
    | 'annotation'
    | 'active-preference-membership'
  readonly targetId: string
  readonly fieldPath: readonly string[]
  readonly before: ReadonlyJsonValue
  readonly after: ReadonlyJsonValue
}

export interface UndoEntryV2 {
  readonly occurrenceOrdinal: number
  readonly historyNodeId: string | null
  readonly commandId: string
  readonly forwardPatches: readonly UndoPatchV2[]
  readonly inversePatches: readonly UndoPatchV2[]
}

export interface UndoStateV2 {
  readonly id: string
  readonly version: 'undo-state-v2'
  readonly projectId: string
  readonly nextOccurrence: number
  readonly undoEntries: readonly UndoEntryV2[]
  readonly redoEntries: readonly UndoEntryV2[]
}

export interface PerformanceSettingsV2 {
  readonly id: string
  readonly version: 'performance-v2'
  readonly voice:
    | 'soft-pluck'
    | 'bell-mallet'
    | 'warm-lead'
    | 'bass'
    | 'chiptune'
    | 'soft-keys'
  readonly articulation: number
  readonly accentAmount: number
  readonly reverb: {
    readonly enabled: boolean
    readonly amount: number
    readonly tailTicks: Tick
  }
  readonly delay: {
    readonly enabled: boolean
    readonly amount: number
    readonly delayTicks: Tick
    readonly feedback: number
  }
  readonly melodyVolume: number
  readonly beatVolume: number
  readonly effectsVolume: number
  readonly masterVolume: number
}

export interface V1CompatibilityPerformanceSettingsV2 {
  readonly id: string
  readonly version: 'v1-compat-performance-v1'
  readonly voiceFactoryId: 'v1-triangle-compat'
}

export type PerformanceSettingsRecordV2 =
  | PerformanceSettingsV2
  | V1CompatibilityPerformanceSettingsV2

export type ScaleRefV2 =
  | { readonly kind: 'catalogue'; readonly scaleId: string }
  | { readonly kind: 'custom'; readonly customScaleId: string }

export interface TonalSegmentV2 {
  readonly id: string
  readonly startTick: Tick
  readonly endTick: Tick
  readonly tonicPitchClass: number
  readonly tonicMidi: number
  readonly scale: ScaleRefV2
  readonly borrowingPolicyId: string | null
}

export interface TonalTimelineV2 {
  readonly id: string
  readonly version: 'tonal-timeline-v2'
  readonly segments: readonly TonalSegmentV2[]
}

export interface AuditionPairingV2 {
  readonly id: string
  readonly version: 'audition-pairing-v2'
  readonly melodyCandidateId: string
  readonly beatId: string | null
  readonly timing: CandidateTimingRefV2
  readonly performanceId: string
}

export interface V1MigrationCandidateMappingV2 {
  readonly sourceCandidateId: string
  readonly melodyGenomeId: string
  readonly timingProfileId: string
  readonly tonalTimelineId: string
  readonly pairingId: string
  readonly compatibilityPerformanceId: string
}

export interface V1MigrationSnapshotMappingV2 {
  readonly sourceHistoryOrdinal: number
  readonly sourceSnapshotId: string
  readonly historyNodeId: string
}

export interface V1MigrationReceiptV2 {
  readonly id: string
  readonly version: 'v1-migration-receipt-v2'
  readonly migrationVersion: 'v1-project-migration-v2.0.0'
  readonly sourceKind: 'local-storage-project-v1' | 'project-envelope-v1'
  readonly sourceHash: string
  readonly projectId: string
  readonly stagedRevision: number
  readonly status: 'pending-readback' | 'verified'
  readonly candidateMappings: readonly V1MigrationCandidateMappingV2[]
  readonly snapshotMappings: readonly V1MigrationSnapshotMappingV2[]
  readonly createdAtEpochMs: number | null
  readonly verifiedAtEpochMs: number | null
}

export interface ActiveProjectMetadataV2 {
  readonly id: 'active-project'
  readonly version: 'active-project-metadata-v2'
  readonly projectId: string
  readonly revision: number
}

/**
 * The exact schema-2 table key order at the M2 registration boundary. Later
 * milestones replace the `never` rows only after registering exact codecs;
 * they do not rename or reorder this table wrapper.
 */
export interface M2ProjectEntityArrayTablesV2 {
  readonly createStates: readonly CreateStateV2[]
  readonly modeStates: readonly ModeStateV2[]
  readonly historyGraphs: readonly HistoryGraphV2[]
  readonly historyNodes: readonly HistoryNodeV2[]
  readonly snapshots: readonly SnapshotV2[]
  readonly melodyCandidates: readonly MigratedV1MelodyCandidateV2[]
  readonly melodyGenomes: readonly MelodyGenomeV2[]
  readonly transports: readonly TransportSpec[]
  readonly v1TimingProfiles: readonly V1CompatibilityTimingProfile[]
  readonly tonalTimelines: readonly TonalTimelineV2[]
  readonly customScales: readonly never[]
  readonly beats: readonly never[]
  readonly performanceSettings: readonly PerformanceSettingsRecordV2[]
  readonly pairings: readonly AuditionPairingV2[]
  readonly preferenceRecords: readonly never[]
  readonly libraryItems: readonly LibraryItemV2[]
  readonly ratings: readonly RatingV2[]
  readonly annotations: readonly AnnotationV2[]
  readonly undoStates: readonly UndoStateV2[]
  readonly migrationReceipts: readonly V1MigrationReceiptV2[]
}

export type ProjectEntityArrayTablesV2 = M2ProjectEntityArrayTablesV2

export interface StoredProjectGraphV2 {
  readonly record: StoredProjectRecordV2
  readonly tables: M2ProjectEntityArrayTablesV2
}

export type PersistableProjectGraphV2 = StoredProjectGraphV2
