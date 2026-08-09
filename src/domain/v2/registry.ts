import type { AlgorithmVersionRegistryV2 } from './types'
import {
  deepFreezeV2,
  exactPlainObject,
  literalValue,
} from './validation'

export const ALGORITHM_VERSION_REGISTRY_V2 = deepFreezeV2({
  version: 'algorithm-version-registry-v2',
  generators: {
    legacy: 'legacy-simple-v1',
    modern: 'modern-constrained-v1',
    v1Evolution: 'interactive-evolution-v1',
  },
  foundations: {
    rng: 'sfc32-v1',
    seedTree: 'labelled-seed-tree-v2',
    transport: 'transport-v2',
    v1CompatibilityTiming: 'v1-compat-timing-v1',
    v1TimingAdaptation: 'v1-timing-adaptation-proposal-v1',
    v1Migration: 'v1-project-migration-v2.0.0',
    melodyRender: 'melody-render-v2.0.0',
    candidateProvenance: 'candidate-provenance-v2',
    preferenceEffect: 'preference-effect-v2',
    beatGenerator: 'beat-generator-v2.0.0',
  },
  strategies: {
    breed: 'breed-strategy-v2.0.0',
    drift: 'drift-strategy-v2.0.0',
    islands: 'islands-strategy-v2.0.0',
    map: 'map-elites-strategy-v2.0.0',
    pareto: 'nsga2-pareto-strategy-v2.0.0',
    pairLab: 'pair-lab-strategy-v2.0.0',
  },
  formulas: {
    customScaleDegeneracy: 'custom-scale-degeneracy-v2.0.0',
    tonalRelationship: 'tonal-relationship-v2.0.0',
    tonalMutationBands: 'tonal-mutation-bands-v2.0.0',
    descriptorCore: 'descriptor-core-v2.0.0',
    motifNgrams: 'motif-ngrams-v2.0.0',
    rhythmEntropy: 'rhythm-entropy-v2.0.0',
    meterSyncopation: 'meter-syncopation-v2.0.0',
    pitchParentDistance: 'pitch-parent-distance-v2.0.0',
    rhythmParentDistance: 'rhythm-parent-distance-v2.0.0',
    tonalParentDistance: 'tonal-parent-distance-v2.0.0',
    structuralDistance: 'structural-distance-v2.0.0',
    beatDistance: 'beat-distance-v2.0.0',
    phenotypeDistance: 'phenotype-distance-v2.0.0',
    beatDescriptors: 'beat-descriptors-v2.0.0',
    accentCoincidence: 'accent-coincidence-v2.0.0',
    tonalAxis: 'tonal-axis-v2.0.0',
    islandsGlobalDiversity: 'islands-global-diversity-v2.0.0',
    pairPhenotypeDistance: 'pair-phenotype-distance-v2.0.0',
    pairLabTransition: 'pair-lab-transition-v2.0.0',
    operatorAttemptBudget: 'operator-attempt-budget-v2.0.0',
  },
  midiImport: {
    bounds: 'midi-import-bounds-v2.0.0',
    monophonicExtraction: 'midi-monophonic-extraction-v2.0.0',
  },
} as const satisfies AlgorithmVersionRegistryV2)

type LiteralRecord = Readonly<Record<string, string>>

function assertLiteralRecord(
  value: unknown,
  expected: LiteralRecord,
  path: string,
): void {
  const expectedKeys = Object.keys(expected)
  const record = exactPlainObject(value, expectedKeys, path)
  expectedKeys.forEach((key) => {
    literalValue(record[key], expected[key]!, `${path}.${key}`)
  })
}

export function assertAlgorithmVersionRegistryV2(
  value: unknown,
): asserts value is AlgorithmVersionRegistryV2 {
  const record = exactPlainObject(
    value,
    ['version', 'generators', 'foundations', 'strategies', 'formulas', 'midiImport'],
    'algorithmVersions',
  )
  literalValue(
    record.version,
    ALGORITHM_VERSION_REGISTRY_V2.version,
    'algorithmVersions.version',
  )
  assertLiteralRecord(
    record.generators,
    ALGORITHM_VERSION_REGISTRY_V2.generators,
    'algorithmVersions.generators',
  )
  assertLiteralRecord(
    record.foundations,
    ALGORITHM_VERSION_REGISTRY_V2.foundations,
    'algorithmVersions.foundations',
  )
  assertLiteralRecord(
    record.strategies,
    ALGORITHM_VERSION_REGISTRY_V2.strategies,
    'algorithmVersions.strategies',
  )
  assertLiteralRecord(
    record.formulas,
    ALGORITHM_VERSION_REGISTRY_V2.formulas,
    'algorithmVersions.formulas',
  )
  assertLiteralRecord(
    record.midiImport,
    ALGORITHM_VERSION_REGISTRY_V2.midiImport,
    'algorithmVersions.midiImport',
  )
}
