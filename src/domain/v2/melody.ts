import { stableId, stableStringify } from '../identity'
import { validateMelody } from '../invariants'
import { melodyDegreeToMidi } from '../pitch'
import { findScaleById } from '../scales'
import {
  candidateContributionIdV2,
  candidateRepairIdV2,
  melodyGenomeIdV2,
  migratedV1EventIdV2,
} from './identities'
import { assertEmptyMigratedV1LockSetV2 } from './locks'
import { ALGORITHM_VERSION_REGISTRY_V2 } from './registry'
import type {
  CandidateContributionV2,
  CandidateLineageV2,
  CandidateProvenanceV2,
  CandidateTimingRefV2,
  FrozenV1CandidateV1,
  MelodyGenomeV2,
  MigratedV1MelodyCandidateV2,
  PitchShapeGenomeV2,
  RenderedMelodyPhenotypeV2,
  RhythmGenomeV2,
} from './types'
import {
  assertReadonlyJsonObject,
  assertReadonlyJsonValue,
  booleanValue,
  denseArray,
  enumValue,
  exactPlainObject,
  failSchemaV2,
  finiteNumber,
  literalValue,
  lowercaseSha256,
  nonEmptyString,
  nullValue,
  nullableNonEmptyString,
  plainObject,
  safeInteger,
  stringArray,
  stringValue,
  uniqueStringArray,
} from './validation'

export function assertCandidateTimingRefV2(
  value: unknown,
  path = 'timing',
): asserts value is CandidateTimingRefV2 {
  const preview = plainObject(value, path)
  if (preview.kind === 'canonical-transport') {
    const record = exactPlainObject(value, ['kind', 'transportId'], path)
    literalValue(record.kind, 'canonical-transport', `${path}.kind`)
    nonEmptyString(record.transportId, `${path}.transportId`)
    return
  }
  if (preview.kind === 'v1-compatibility') {
    const record = exactPlainObject(value, ['kind', 'timingProfileId'], path)
    literalValue(record.kind, 'v1-compatibility', `${path}.kind`)
    nonEmptyString(record.timingProfileId, `${path}.timingProfileId`)
    return
  }
  failSchemaV2(
    'invalid-value',
    `${path}.kind`,
    'must be canonical-transport or v1-compatibility',
  )
}

function assertPitchShape(
  value: unknown,
  path: string,
): PitchShapeGenomeV2 {
  const record = exactPlainObject(
    value,
    ['version', 'mapping', 'genes', 'register'],
    path,
  )
  const genes = denseArray(record.genes, `${path}.genes`).map((entry, index) => {
    const genePath = `${path}.genes[${String(index)}]`
    const gene = exactPlainObject(entry, ['eventId', 'extendedDegree'], genePath)
    return {
      eventId: nonEmptyString(gene.eventId, `${genePath}.eventId`),
      extendedDegree: safeInteger(
        gene.extendedDegree,
        `${genePath}.extendedDegree`,
      ),
    }
  })
  const geneIds = genes.map(({ eventId }) => eventId)
  if (new Set(geneIds).size !== geneIds.length) {
    failSchemaV2(
      'duplicate-value',
      `${path}.genes`,
      'event IDs must be unique',
    )
  }
  const register = exactPlainObject(
    record.register,
    ['minMidi', 'maxMidi'],
    `${path}.register`,
  )
  const minMidi = safeInteger(register.minMidi, `${path}.register.minMidi`, 0, 127)
  const maxMidi = safeInteger(register.maxMidi, `${path}.register.maxMidi`, 0, 127)
  if (minMidi > maxMidi) {
    failSchemaV2(
      'invalid-value',
      `${path}.register`,
      'minMidi must not exceed maxMidi',
    )
  }
  return {
    version: literalValue(record.version, 'pitch-shape-v2', `${path}.version`),
    mapping: enumValue(
      record.mapping,
      ['tonal-relative', 'legacy-fixed-octave', 'absolute-import'] as const,
      `${path}.mapping`,
    ),
    genes,
    register: { minMidi, maxMidi },
  }
}

function assertRhythm(value: unknown, path: string): RhythmGenomeV2 {
  const record = exactPlainObject(value, ['version', 'events', 'sourceGridTicks'], path)
  const events = denseArray(record.events, `${path}.events`).map((entry, index) => {
    const eventPath = `${path}.events[${String(index)}]`
    const event = exactPlainObject(
      entry,
      [
        'eventId',
        'onsetTick',
        'durationTicks',
        'isRest',
        'accent',
        'tieToNext',
      ],
      eventPath,
    )
    const accent = finiteNumber(event.accent, `${eventPath}.accent`)
    if (accent !== 0) {
      failSchemaV2(
        'unregistered-version',
        `${eventPath}.accent`,
        'M2 migrated-V1 rhythm genes require accent zero',
      )
    }
    literalValue(event.tieToNext, false, `${eventPath}.tieToNext`)
    return {
      eventId: nonEmptyString(event.eventId, `${eventPath}.eventId`),
      onsetTick: safeInteger(event.onsetTick, `${eventPath}.onsetTick`, 0),
      durationTicks: safeInteger(
        event.durationTicks,
        `${eventPath}.durationTicks`,
        1,
      ),
      isRest: booleanValue(event.isRest, `${eventPath}.isRest`),
      accent,
      tieToNext: false as const,
    }
  })
  const ids = events.map(({ eventId }) => eventId)
  if (new Set(ids).size !== ids.length) {
    failSchemaV2(
      'duplicate-value',
      `${path}.events`,
      'event IDs must be unique',
    )
  }
  events.forEach((event, index) => {
    if (index === 0) return
    const prior = events[index - 1]!
    if (event.onsetTick < prior.onsetTick + prior.durationTicks) {
      failSchemaV2(
        'invalid-order',
        `${path}.events[${String(index)}].onsetTick`,
        'events must be onset ordered and non-overlapping',
      )
    }
  })
  return {
    version: literalValue(record.version, 'rhythm-v2', `${path}.version`),
    events,
    sourceGridTicks: safeInteger(
      record.sourceGridTicks,
      `${path}.sourceGridTicks`,
      1,
    ),
  }
}

export function assertMelodyGenomeV2(
  value: unknown,
): asserts value is MelodyGenomeV2 {
  const record = exactPlainObject(
    value,
    ['version', 'id', 'pitchShape', 'rhythm', 'tonalTimelineId', 'timing', 'locks'],
    'melodyGenome',
  )
  const pitchShape = assertPitchShape(record.pitchShape, 'melodyGenome.pitchShape')
  const rhythm = assertRhythm(record.rhythm, 'melodyGenome.rhythm')
  const soundingEventIds = rhythm.events
    .filter(({ isRest }) => !isRest)
    .map(({ eventId }) => eventId)
  const pitchEventIds = pitchShape.genes.map(({ eventId }) => eventId)
  if (
    soundingEventIds.length !== pitchEventIds.length ||
    soundingEventIds.some((id, index) => pitchEventIds[index] !== id)
  ) {
    failSchemaV2(
      'unresolved-reference',
      'melodyGenome.pitchShape.genes',
      'must correspond in rhythm order to every and only sounding event',
    )
  }
  assertCandidateTimingRefV2(record.timing, 'melodyGenome.timing')
  if (record.timing.kind !== 'v1-compatibility') {
    failSchemaV2(
      'unregistered-version',
      'melodyGenome.timing.kind',
      'M2 melody registration accepts only migrated V1 compatibility timing',
    )
  }
  assertEmptyMigratedV1LockSetV2(record.locks)
  const genomeWithoutId: Omit<MelodyGenomeV2, 'id'> = {
    version: literalValue(
      record.version,
      'melody-genome-v2',
      'melodyGenome.version',
    ),
    pitchShape,
    rhythm,
    tonalTimelineId: nonEmptyString(
      record.tonalTimelineId,
      'melodyGenome.tonalTimelineId',
    ),
    timing: record.timing,
    locks: record.locks,
  }
  const expectedId = melodyGenomeIdV2(genomeWithoutId)
  if (record.id !== expectedId) {
    failSchemaV2(
      'invalid-identity',
      'melodyGenome.id',
      `must equal ${expectedId}`,
    )
  }
}

function assertRenderedPhenotype(
  value: unknown,
  path: string,
): RenderedMelodyPhenotypeV2 {
  const record = exactPlainObject(
    value,
    [
      'version',
      'renderVersion',
      'inputFingerprint',
      'timingFingerprint',
      'events',
      'phenotypeFingerprint',
    ],
    path,
  )
  const events = denseArray(record.events, `${path}.events`).map((entry, index) => {
    const eventPath = `${path}.events[${String(index)}]`
    const event = exactPlainObject(
      entry,
      [
        'eventId',
        'onsetTick',
        'durationTicks',
        'midi',
        'velocity',
        'tonalSegmentId',
        'borrowing',
        'contributionIds',
      ],
      eventPath,
    )
    const midi =
      event.midi === null
        ? null
        : safeInteger(event.midi, `${eventPath}.midi`, 0, 127)
    const velocity = finiteNumber(event.velocity, `${eventPath}.velocity`)
    if (velocity < 0 || velocity > 1) {
      failSchemaV2(
        'invalid-value',
        `${eventPath}.velocity`,
        'must be between zero and one',
      )
    }
    nullValue(event.borrowing, `${eventPath}.borrowing`)
    return {
      eventId: nonEmptyString(event.eventId, `${eventPath}.eventId`),
      onsetTick: safeInteger(event.onsetTick, `${eventPath}.onsetTick`, 0),
      durationTicks: safeInteger(
        event.durationTicks,
        `${eventPath}.durationTicks`,
        1,
      ),
      midi,
      velocity,
      tonalSegmentId: nonEmptyString(
        event.tonalSegmentId,
        `${eventPath}.tonalSegmentId`,
      ),
      borrowing: null,
      contributionIds: uniqueStringArray(
        event.contributionIds,
        `${eventPath}.contributionIds`,
      ),
    }
  })
  const ids = events.map(({ eventId }) => eventId)
  if (new Set(ids).size !== ids.length) {
    failSchemaV2('duplicate-value', `${path}.events`, 'event IDs must be unique')
  }
  return {
    version: literalValue(
      record.version,
      'rendered-melody-phenotype-v2',
      `${path}.version`,
    ),
    renderVersion: nonEmptyString(record.renderVersion, `${path}.renderVersion`),
    inputFingerprint: lowercaseSha256(
      record.inputFingerprint,
      `${path}.inputFingerprint`,
    ),
    timingFingerprint: lowercaseSha256(
      record.timingFingerprint,
      `${path}.timingFingerprint`,
    ),
    events,
    phenotypeFingerprint: lowercaseSha256(
      record.phenotypeFingerprint,
      `${path}.phenotypeFingerprint`,
    ),
  }
}

function assertCandidateProvenance(
  value: unknown,
  path: string,
): CandidateProvenanceV2 {
  const record = exactPlainObject(
    value,
    [
      'version',
      'rootSeed',
      'seedPath',
      'rngVersion',
      'algorithmVersion',
      'renderVersion',
      'descriptorSetVersion',
      'operations',
      'contributions',
      'repairs',
      'lockVerificationFingerprints',
    ],
    path,
  )
  const operations = denseArray(record.operations, `${path}.operations`).map(
    (entry, index) => {
      const operationPath = `${path}.operations[${String(index)}]`
      const operation = exactPlainObject(
        entry,
        ['version', 'kind', 'operatorId', 'parameters'],
        operationPath,
      )
      assertReadonlyJsonObject(operation.parameters, `${operationPath}.parameters`)
      return {
        version: literalValue(
          operation.version,
          'candidate-operation-v2',
          `${operationPath}.version`,
        ),
        kind: enumValue(
          operation.kind,
          [
            'generate',
            'import',
            'crossover',
            'mutation',
            'transform',
            'adapt',
            'borrow',
            'modulate',
          ] as const,
          `${operationPath}.kind`,
        ),
        operatorId: nonEmptyString(
          operation.operatorId,
          `${operationPath}.operatorId`,
        ),
        parameters: operation.parameters,
      }
    },
  )
  const contributions = denseArray(
    record.contributions,
    `${path}.contributions`,
  ).map((entry, index) => {
    const contributionPath = `${path}.contributions[${String(index)}]`
    const contribution = exactPlainObject(
      entry,
      [
        'id',
        'version',
        'eventId',
        'component',
        'source',
        'sourceCandidateId',
        'sourceEventId',
      ],
      contributionPath,
    )
    const withoutId = {
      version: literalValue(
        contribution.version,
        'candidate-contribution-v2',
        `${contributionPath}.version`,
      ),
      eventId: nonEmptyString(
        contribution.eventId,
        `${contributionPath}.eventId`,
      ),
      component: enumValue(
        contribution.component,
        ['pitch', 'rhythm', 'tonal'] as const,
        `${contributionPath}.component`,
      ),
      source: enumValue(
        contribution.source,
        [
          'generator',
          'import',
          'migrated-v1',
          'parent-a',
          'parent-b',
          'mutation',
          'remap',
          'repair',
          'elite',
        ] as const,
        `${contributionPath}.source`,
      ),
      sourceCandidateId: nullableNonEmptyString(
        contribution.sourceCandidateId,
        `${contributionPath}.sourceCandidateId`,
      ),
      sourceEventId: nullableNonEmptyString(
        contribution.sourceEventId,
        `${contributionPath}.sourceEventId`,
      ),
    } as const
    const id = nonEmptyString(contribution.id, `${contributionPath}.id`)
    const expectedId = candidateContributionIdV2(withoutId)
    if (id !== expectedId) {
      failSchemaV2(
        'invalid-identity',
        `${contributionPath}.id`,
        `must equal ${expectedId}`,
      )
    }
    return { id, ...withoutId }
  })
  if (new Set(contributions.map(({ id }) => id)).size !== contributions.length) {
    failSchemaV2(
      'duplicate-value',
      `${path}.contributions`,
      'contribution IDs must be unique',
    )
  }
  const repairs = denseArray(record.repairs, `${path}.repairs`).map(
    (entry, index) => {
      const repairPath = `${path}.repairs[${String(index)}]`
      const repair = exactPlainObject(
        entry,
        ['id', 'version', 'reasonCode', 'changes'],
        repairPath,
      )
      const changes = denseArray(repair.changes, `${repairPath}.changes`).map(
        (change, changeIndex) => {
          const changePath = `${repairPath}.changes[${String(changeIndex)}]`
          const changeRecord = exactPlainObject(
            change,
            ['fieldPath', 'before', 'after'],
            changePath,
          )
          const before = changeRecord.before
          const after = changeRecord.after
          assertReadonlyJsonValue(before, `${changePath}.before`)
          assertReadonlyJsonValue(after, `${changePath}.after`)
          return {
            fieldPath: nonEmptyString(
              changeRecord.fieldPath,
              `${changePath}.fieldPath`,
            ),
            before,
            after,
          }
        },
      )
      const withoutId = {
        version: literalValue(
          repair.version,
          'candidate-repair-v2',
          `${repairPath}.version`,
        ),
        reasonCode: nonEmptyString(repair.reasonCode, `${repairPath}.reasonCode`),
        changes,
      } as const
      const id = nonEmptyString(repair.id, `${repairPath}.id`)
      const expectedId = candidateRepairIdV2(withoutId)
      if (id !== expectedId) {
        failSchemaV2(
          'invalid-identity',
          `${repairPath}.id`,
          `must equal ${expectedId}`,
        )
      }
      return { id, ...withoutId }
    },
  )
  if (new Set(repairs.map(({ id }) => id)).size !== repairs.length) {
    failSchemaV2('duplicate-value', `${path}.repairs`, 'repair IDs must be unique')
  }
  const lockVerificationFingerprints = denseArray(
    record.lockVerificationFingerprints,
    `${path}.lockVerificationFingerprints`,
  ).map((entry, index) => {
    const fingerprintPath = `${path}.lockVerificationFingerprints[${String(index)}]`
    const fingerprint = exactPlainObject(
      entry,
      ['lockId', 'scopeFingerprint', 'resultFingerprint', 'preserved'],
      fingerprintPath,
    )
    return {
      lockId: nonEmptyString(fingerprint.lockId, `${fingerprintPath}.lockId`),
      scopeFingerprint: lowercaseSha256(
        fingerprint.scopeFingerprint,
        `${fingerprintPath}.scopeFingerprint`,
      ),
      resultFingerprint: lowercaseSha256(
        fingerprint.resultFingerprint,
        `${fingerprintPath}.resultFingerprint`,
      ),
      preserved: literalValue(
        fingerprint.preserved,
        true,
        `${fingerprintPath}.preserved`,
      ),
    }
  })
  if (lockVerificationFingerprints.length !== 0) {
    failSchemaV2(
      'unregistered-version',
      `${path}.lockVerificationFingerprints`,
      'M2 migrated candidates have no locks to verify',
    )
  }
  return {
    version: literalValue(
      record.version,
      'candidate-provenance-v2',
      `${path}.version`,
    ),
    rootSeed: stringValue(record.rootSeed, `${path}.rootSeed`),
    seedPath: denseArray(record.seedPath, `${path}.seedPath`).map((entry, index) =>
      nonEmptyString(entry, `${path}.seedPath[${String(index)}]`),
    ),
    rngVersion: nonEmptyString(record.rngVersion, `${path}.rngVersion`),
    algorithmVersion: nonEmptyString(
      record.algorithmVersion,
      `${path}.algorithmVersion`,
    ),
    renderVersion: nonEmptyString(record.renderVersion, `${path}.renderVersion`),
    descriptorSetVersion: nonEmptyString(
      record.descriptorSetVersion,
      `${path}.descriptorSetVersion`,
    ),
    operations,
    contributions,
    repairs,
    lockVerificationFingerprints,
  }
}

function assertCandidateLineage(value: unknown, path: string): CandidateLineageV2 {
  const record = exactPlainObject(
    value,
    [
      'version',
      'geneticParentCandidateIds',
      'componentParentCandidateIds',
      'sourceHistoryNodeIds',
    ],
    path,
  )
  const componentParents = exactPlainObject(
    record.componentParentCandidateIds,
    ['pitch', 'rhythm', 'tonal'],
    `${path}.componentParentCandidateIds`,
  )
  return {
    version: literalValue(
      record.version,
      'candidate-lineage-v2',
      `${path}.version`,
    ),
    geneticParentCandidateIds: stringArray(
      record.geneticParentCandidateIds,
      `${path}.geneticParentCandidateIds`,
    ),
    componentParentCandidateIds: {
      pitch: stringArray(
        componentParents.pitch,
        `${path}.componentParentCandidateIds.pitch`,
      ),
      rhythm: stringArray(
        componentParents.rhythm,
        `${path}.componentParentCandidateIds.rhythm`,
      ),
      tonal: stringArray(
        componentParents.tonal,
        `${path}.componentParentCandidateIds.tonal`,
      ),
    },
    sourceHistoryNodeIds: stringArray(
      record.sourceHistoryNodeIds,
      `${path}.sourceHistoryNodeIds`,
    ),
  }
}

function assertFrozenV1Candidate(
  value: unknown,
  path: string,
): FrozenV1CandidateV1 {
  const record = exactPlainObject(value, ['id', 'melody', 'provenance'], path)
  const melody = exactPlainObject(record.melody, ['events', 'constraints'], `${path}.melody`)
  const events = denseArray(melody.events, `${path}.melody.events`).map(
    (entry, index) => {
      const eventPath = `${path}.melody.events[${String(index)}]`
      const event = exactPlainObject(
        entry,
        ['startTick', 'durationTicks', 'degree'],
        eventPath,
      )
      return {
        startTick: safeInteger(event.startTick, `${eventPath}.startTick`, 0),
        durationTicks: safeInteger(
          event.durationTicks,
          `${eventPath}.durationTicks`,
          1,
        ),
        degree:
          event.degree === null
            ? null
            : safeInteger(event.degree, `${eventPath}.degree`),
      }
    },
  )
  if (events.length === 0 || events.length > 128) {
    failSchemaV2(
      'invalid-value',
      `${path}.melody.events`,
      'frozen V1 candidates must contain 1 through 128 events',
    )
  }
  const constraints = exactPlainObject(
    melody.constraints,
    [
      'scaleId',
      'tonicPitchClass',
      'tonicMidi',
      'register',
      'pitchMapping',
      'ticksPerBeat',
      'gridTicks',
      'totalTicks',
      'tempoBpm',
      'tonicBoundary',
    ],
    `${path}.melody.constraints`,
  )
  const register = exactPlainObject(
    constraints.register,
    ['minMidi', 'maxMidi'],
    `${path}.melody.constraints.register`,
  )
  const minMidi = safeInteger(
    register.minMidi,
    `${path}.melody.constraints.register.minMidi`,
    0,
    127,
  )
  const maxMidi = safeInteger(
    register.maxMidi,
    `${path}.melody.constraints.register.maxMidi`,
    0,
    127,
  )
  if (minMidi > maxMidi) {
    failSchemaV2(
      'invalid-value',
      `${path}.melody.constraints.register`,
      'minMidi must not exceed maxMidi',
    )
  }
  const tonicBoundary = exactPlainObject(
    constraints.tonicBoundary,
    ['start', 'end'],
    `${path}.melody.constraints.tonicBoundary`,
  )
  const provenance = exactPlainObject(
    record.provenance,
    [
      'strategy',
      'generatorVersion',
      'seed',
      'settings',
      'generation',
      'parentIds',
      'operations',
    ],
    `${path}.provenance`,
  )
  assertReadonlyJsonObject(provenance.settings, `${path}.provenance.settings`)
  const operations = denseArray(
    provenance.operations,
    `${path}.provenance.operations`,
  ).map((entry, index) => {
    const operationPath = `${path}.provenance.operations[${String(index)}]`
    const operation = exactPlainObject(
      entry,
      ['operator', 'parameters'],
      operationPath,
    )
    assertReadonlyJsonObject(operation.parameters, `${operationPath}.parameters`)
    return {
      operator: nonEmptyString(operation.operator, `${operationPath}.operator`),
      parameters: operation.parameters,
    }
  })
  if (operations.length > 64) {
    failSchemaV2(
      'invalid-value',
      `${path}.provenance.operations`,
      'frozen V1 provenance may contain at most 64 operations',
    )
  }
  const parentIds = stringArray(
    provenance.parentIds,
    `${path}.provenance.parentIds`,
  )
  if (parentIds.length > 2) {
    failSchemaV2(
      'invalid-value',
      `${path}.provenance.parentIds`,
      'frozen V1 provenance may contain at most two parents',
    )
  }
  const scaleId = stringValue(
    constraints.scaleId,
    `${path}.melody.constraints.scaleId`,
  )
  const scale = findScaleById(scaleId)
  if (scale === undefined || scale.id !== scaleId) {
    failSchemaV2(
      'invalid-value',
      `${path}.melody.constraints.scaleId`,
      'must be the canonical catalogue ID emitted by the V1 decoder',
    )
  }
  const frozen: FrozenV1CandidateV1 = {
    id: nonEmptyString(record.id, `${path}.id`),
    melody: {
      events,
      constraints: {
        scaleId,
        tonicPitchClass: safeInteger(
          constraints.tonicPitchClass,
          `${path}.melody.constraints.tonicPitchClass`,
          0,
          11,
        ),
        tonicMidi: safeInteger(
          constraints.tonicMidi,
          `${path}.melody.constraints.tonicMidi`,
          0,
          127,
        ),
        register: { minMidi, maxMidi },
        pitchMapping: enumValue(
          constraints.pitchMapping,
          ['tonic-relative', 'legacy-fixed-octave'] as const,
          `${path}.melody.constraints.pitchMapping`,
        ),
        ticksPerBeat: safeInteger(
          constraints.ticksPerBeat,
          `${path}.melody.constraints.ticksPerBeat`,
          1,
        ),
        gridTicks: safeInteger(
          constraints.gridTicks,
          `${path}.melody.constraints.gridTicks`,
          1,
        ),
        totalTicks: safeInteger(
          constraints.totalTicks,
          `${path}.melody.constraints.totalTicks`,
          1,
        ),
        tempoBpm: finiteNumber(
          constraints.tempoBpm,
          `${path}.melody.constraints.tempoBpm`,
        ),
        tonicBoundary: {
          start: booleanValue(
            tonicBoundary.start,
            `${path}.melody.constraints.tonicBoundary.start`,
          ),
          end: booleanValue(
            tonicBoundary.end,
            `${path}.melody.constraints.tonicBoundary.end`,
          ),
        },
      },
    },
    provenance: {
      strategy: enumValue(
        provenance.strategy,
        ['legacy', 'modern', 'evolution'] as const,
        `${path}.provenance.strategy`,
      ),
      generatorVersion: nonEmptyString(
        provenance.generatorVersion,
        `${path}.provenance.generatorVersion`,
      ),
      seed: stringValue(provenance.seed, `${path}.provenance.seed`),
      settings: provenance.settings,
      generation: safeInteger(
        provenance.generation,
        `${path}.provenance.generation`,
        0,
      ),
      parentIds,
      operations,
    },
  }
  const issues = validateMelody(
    {
      events: frozen.melody.events,
      constraints: {
        ...frozen.melody.constraints,
        scaleId: scale.id,
      },
    },
    scale,
  )
  if (issues.length > 0) {
    failSchemaV2(
      'invalid-value',
      `${path}.melody`,
      `does not equal a valid frozen V1 decoder value: ${issues
        .map(({ code }) => code)
        .join(', ')}`,
    )
  }
  return frozen
}

export function assertMigratedV1MelodyCandidateV2(
  value: unknown,
): asserts value is MigratedV1MelodyCandidateV2 {
  const record = exactPlainObject(
    value,
    [
      'id',
      'version',
      'candidateKind',
      'melodyGenomeId',
      'renderedPhenotype',
      'descriptorValues',
      'provenance',
      'lineage',
      'compatibilitySource',
    ],
    'melodyCandidate',
  )
  const id = nonEmptyString(record.id, 'melodyCandidate.id')
  literalValue(record.version, 'melody-candidate-v2', 'melodyCandidate.version')
  if (record.candidateKind !== 'migrated-v1') {
    failSchemaV2(
      'unregistered-version',
      'melodyCandidate.candidateKind',
      'M2 registers only migrated-v1 candidates',
    )
  }
  nonEmptyString(record.melodyGenomeId, 'melodyCandidate.melodyGenomeId')
  const phenotype = assertRenderedPhenotype(
    record.renderedPhenotype,
    'melodyCandidate.renderedPhenotype',
  )
  const descriptorValues = denseArray(
    record.descriptorValues,
    'melodyCandidate.descriptorValues',
  ).map((entry, index) => {
    const descriptorPath = `melodyCandidate.descriptorValues[${String(index)}]`
    const descriptor = exactPlainObject(
      entry,
      [
        'descriptorId',
        'formulaVersion',
        'rawValue',
        'normalizedValue',
        'dependencyFingerprint',
      ],
      descriptorPath,
    )
    const rawValue =
      descriptor.rawValue === null
        ? null
        : finiteNumber(descriptor.rawValue, `${descriptorPath}.rawValue`)
    const normalizedValue =
      descriptor.normalizedValue === null
        ? null
        : finiteNumber(
            descriptor.normalizedValue,
            `${descriptorPath}.normalizedValue`,
          )
    if (
      normalizedValue !== null &&
      (normalizedValue < 0 || normalizedValue > 1)
    ) {
      failSchemaV2(
        'invalid-value',
        `${descriptorPath}.normalizedValue`,
        'must be null or between zero and one',
      )
    }
    return {
      descriptorId: nonEmptyString(
        descriptor.descriptorId,
        `${descriptorPath}.descriptorId`,
      ),
      formulaVersion: nonEmptyString(
        descriptor.formulaVersion,
        `${descriptorPath}.formulaVersion`,
      ),
      rawValue,
      normalizedValue,
      dependencyFingerprint: lowercaseSha256(
        descriptor.dependencyFingerprint,
        `${descriptorPath}.dependencyFingerprint`,
      ),
    }
  })
  descriptorValues.forEach((descriptor, index) => {
    if (index === 0) return
    const previous = descriptorValues[index - 1]!
    if (
      previous.descriptorId > descriptor.descriptorId ||
      (previous.descriptorId === descriptor.descriptorId &&
        previous.formulaVersion >= descriptor.formulaVersion)
    ) {
      failSchemaV2(
        'invalid-order',
        `melodyCandidate.descriptorValues[${String(index)}]`,
        'must be ordered by descriptor ID then formula version',
      )
    }
  })
  const provenance = assertCandidateProvenance(
    record.provenance,
    'melodyCandidate.provenance',
  )
  const lineage = assertCandidateLineage(record.lineage, 'melodyCandidate.lineage')
  const compatibility = exactPlainObject(
    record.compatibilitySource,
    ['version', 'candidate'],
    'melodyCandidate.compatibilitySource',
  )
  literalValue(
    compatibility.version,
    'frozen-v1-candidate-v1',
    'melodyCandidate.compatibilitySource.version',
  )
  const frozen = assertFrozenV1Candidate(
    compatibility.candidate,
    'melodyCandidate.compatibilitySource.candidate',
  )
  if (frozen.id !== id) {
    failSchemaV2(
      'invalid-identity',
      'melodyCandidate.compatibilitySource.candidate.id',
      'must equal the copied migrated candidate ID',
    )
  }
  const contributionIds = new Set(provenance.contributions.map(({ id: valueId }) => valueId))
  phenotype.events.forEach((event, eventIndex) => {
    event.contributionIds.forEach((contributionId, contributionIndex) => {
      if (!contributionIds.has(contributionId)) {
        failSchemaV2(
          'unresolved-reference',
          `melodyCandidate.renderedPhenotype.events[${String(eventIndex)}].contributionIds[${String(contributionIndex)}]`,
          'must resolve inside candidate provenance',
        )
      }
    })
  })
  void descriptorValues
  void lineage
}

export function assertMigratedV1MelodyClosureV2(
  candidate: MigratedV1MelodyCandidateV2,
  genome: MelodyGenomeV2,
): void {
  assertMigratedV1MelodyCandidateV2(candidate)
  assertMelodyGenomeV2(genome)
  if (candidate.melodyGenomeId !== genome.id) {
    failSchemaV2(
      'unresolved-reference',
      'melodyCandidate.melodyGenomeId',
      'must resolve to the supplied genome',
    )
  }
  const frozen = candidate.compatibilitySource.candidate
  const frozenEvents = frozen.melody.events
  const constraints = frozen.melody.constraints
  const scale = findScaleById(constraints.scaleId)
  if (scale === undefined) {
    failSchemaV2(
      'unresolved-reference',
      'melodyCandidate.compatibilitySource.candidate.melody.constraints.scaleId',
      'must resolve to the V1 catalogue scale used to render sounding MIDI',
    )
  }
  if (
    frozenEvents.length !== genome.rhythm.events.length ||
    frozenEvents.length !== candidate.renderedPhenotype.events.length
  ) {
    failSchemaV2(
      'unresolved-reference',
      'melodyGenome.rhythm.events',
      'must preserve one event per frozen V1 source event',
    )
  }
  const pitchById = new Map(
    genome.pitchShape.genes.map((gene) => [gene.eventId, gene] as const),
  )
  const expectedContributions: CandidateContributionV2[] = []
  frozenEvents.forEach((source, ordinal) => {
    const eventId = migratedV1EventIdV2(candidate.id, ordinal)
    const rhythm = genome.rhythm.events[ordinal]!
    const rendered = candidate.renderedPhenotype.events[ordinal]!
    const components: readonly CandidateContributionV2['component'][] =
      source.degree === null
        ? ['rhythm', 'tonal']
        : ['pitch', 'rhythm', 'tonal']
    const eventContributions = components.map((component) => {
      const withoutId = {
        version: 'candidate-contribution-v2',
        eventId,
        component,
        source: 'migrated-v1',
        sourceCandidateId: candidate.id,
        sourceEventId: null,
      } as const
      const contribution: CandidateContributionV2 = {
        id: candidateContributionIdV2(withoutId),
        ...withoutId,
      }
      expectedContributions.push(contribution)
      return contribution
    })
    if (
      rhythm.eventId !== eventId ||
      rendered.eventId !== eventId ||
      rhythm.onsetTick !== source.startTick ||
      rendered.onsetTick !== source.startTick ||
      rhythm.durationTicks !== source.durationTicks ||
      rendered.durationTicks !== source.durationTicks ||
      rhythm.isRest !== (source.degree === null)
    ) {
      failSchemaV2(
        'invalid-value',
        `melodyGenome.rhythm.events[${String(ordinal)}]`,
        'must preserve frozen V1 event identity, timing, and rest state',
      )
    }
    const pitch = pitchById.get(eventId)
    if (
      (source.degree === null && pitch !== undefined) ||
      (source.degree !== null && pitch?.extendedDegree !== source.degree) ||
      (source.degree === null && rendered.midi !== null) ||
      (source.degree !== null && rendered.midi === null)
    ) {
      failSchemaV2(
        'invalid-value',
        `melodyGenome.pitchShape.genes[${String(ordinal)}]`,
        'must preserve frozen V1 degree/rest interpretation',
      )
    }
    const expectedMidi =
      source.degree === null
        ? null
        : melodyDegreeToMidi(
            source.degree,
            { ...constraints, scaleId: scale.id },
            scale,
          )
    if (
      rendered.midi !== expectedMidi ||
      rendered.velocity !== 88 / 127 ||
      stableStringify(rendered.contributionIds) !==
        stableStringify(eventContributions.map(({ id }) => id))
    ) {
      failSchemaV2(
        'invalid-value',
        `melodyCandidate.renderedPhenotype.events[${String(ordinal)}]`,
        'must preserve exact V1 MIDI, normalized velocity, and migrated contribution IDs',
      )
    }
  })
  if (
    genome.rhythm.sourceGridTicks !== constraints.gridTicks ||
    genome.pitchShape.register.minMidi !== constraints.register.minMidi ||
    genome.pitchShape.register.maxMidi !== constraints.register.maxMidi ||
    genome.pitchShape.mapping !==
      (constraints.pitchMapping === 'tonic-relative'
        ? 'tonal-relative'
        : 'legacy-fixed-octave')
  ) {
    failSchemaV2(
      'invalid-value',
      'melodyGenome',
      'must preserve frozen V1 grid, register, and pitch mapping',
    )
  }
  const expectedOperations = frozen.provenance.operations.map((operation) => ({
    version: 'candidate-operation-v2' as const,
    kind: 'import' as const,
    operatorId: operation.operator,
    parameters: operation.parameters,
  }))
  const { provenance, lineage } = candidate
  if (
    candidate.descriptorValues.length !== 0 ||
    provenance.rootSeed !== frozen.provenance.seed ||
    provenance.seedPath.length !== 0 ||
    provenance.rngVersion !== ALGORITHM_VERSION_REGISTRY_V2.foundations.rng ||
    provenance.algorithmVersion !== frozen.provenance.generatorVersion ||
    provenance.renderVersion !==
      ALGORITHM_VERSION_REGISTRY_V2.foundations.melodyRender ||
    candidate.renderedPhenotype.renderVersion !==
      ALGORITHM_VERSION_REGISTRY_V2.foundations.melodyRender ||
    provenance.descriptorSetVersion !==
      ALGORITHM_VERSION_REGISTRY_V2.formulas.descriptorCore ||
    stableStringify(provenance.operations) !==
      stableStringify(expectedOperations) ||
    stableStringify(provenance.contributions) !==
      stableStringify(expectedContributions) ||
    provenance.repairs.length !== 0 ||
    provenance.lockVerificationFingerprints.length !== 0
  ) {
    failSchemaV2(
      'invalid-value',
      'melodyCandidate.provenance',
      'must be the exact registered M2 translation of the frozen V1 candidate',
    )
  }
  if (
    stableStringify(lineage.geneticParentCandidateIds) !==
      stableStringify(frozen.provenance.parentIds) ||
    lineage.componentParentCandidateIds.pitch.length !== 0 ||
    lineage.componentParentCandidateIds.rhythm.length !== 0 ||
    lineage.componentParentCandidateIds.tonal.length !== 0 ||
    lineage.sourceHistoryNodeIds.length !== 0
  ) {
    failSchemaV2(
      'invalid-value',
      'melodyCandidate.lineage',
      'must preserve only the frozen V1 genetic parents',
    )
  }
}

export function fingerprintIdForTestV2(value: unknown): string {
  return stableId('fingerprint-fixture', value)
}
