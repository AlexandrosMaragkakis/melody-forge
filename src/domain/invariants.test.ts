import { describe, expect, it } from 'vitest'

import type { ScaleId } from './scales'
import {
  MelodyInvariantError,
  assertValidMelody,
  cloneCandidate,
  cloneGenerationSnapshot,
  exactMusicalFingerprint,
  isValidMelody,
  validateMelody,
} from './invariants'
import { melodyDegreeToMidi, midiToPitchClass } from './pitch'
import type { Candidate, GenerationSnapshot, Melody } from './types'

const IONIAN = {
  id: 'diatonic-ionian' as ScaleId,
  offsets: [0, 2, 4, 5, 7, 9, 11],
} as const

function makeValidMelody(): Melody {
  return {
    constraints: {
      scaleId: IONIAN.id,
      tonicPitchClass: 0,
      tonicMidi: 60,
      register: { minMidi: 48, maxMidi: 84 },
      pitchMapping: 'tonic-relative',
      ticksPerBeat: 480,
      gridTicks: 120,
      totalTicks: 1920,
      tempoBpm: 112,
      tonicBoundary: { start: true, end: true },
    },
    events: [
      { startTick: 0, durationTicks: 480, degree: 0 },
      { startTick: 480, durationTicks: 480, degree: 2 },
      { startTick: 960, durationTicks: 480, degree: null },
      { startTick: 1440, durationTicks: 480, degree: 7 },
    ],
  }
}

function issueCodes(melody: Melody): readonly string[] {
  return validateMelody(melody, IONIAN).map(({ code }) => code)
}

describe('melody invariants', () => {
  it('accepts a contiguous, grid-aligned, monophonic phrase with an explicit rest', () => {
    const melody = makeValidMelody()
    expect(validateMelody(melody, IONIAN)).toEqual([])
    expect(isValidMelody(melody, IONIAN)).toBe(true)
    expect(() => assertValidMelody(melody, IONIAN)).not.toThrow()
  })

  it('requires positive integer timing and a positive finite tempo', () => {
    const valid = makeValidMelody()
    const invalid: Melody = {
      ...valid,
      constraints: {
        ...valid.constraints,
        ticksPerBeat: 0,
        gridTicks: 0.5,
        totalTicks: -1,
        tempoBpm: Number.POSITIVE_INFINITY,
      },
      events: [{ startTick: -1, durationTicks: 0, degree: 0 }],
    }

    expect(issueCodes(invalid)).toEqual(
      expect.arrayContaining([
        'INVALID_TICKS_PER_BEAT',
        'INVALID_GRID',
        'INVALID_TOTAL_TICKS',
        'INVALID_TEMPO',
        'INVALID_START_TICK',
        'INVALID_DURATION',
      ]),
    )
  })

  it.each([
    ['gap', 600],
    ['overlap', 360],
  ])('rejects a %s between events', (_label, secondStart) => {
    const valid = makeValidMelody()
    const melody: Melody = {
      ...valid,
      events: valid.events.map((event, index) =>
        index === 1 ? { ...event, startTick: secondStart } : event,
      ),
    }
    expect(issueCodes(melody)).toContain('NON_CONTIGUOUS')
  })

  it('requires event timing and phrase totals to align with the grid', () => {
    const valid = makeValidMelody()
    const offGrid: Melody = {
      ...valid,
      constraints: { ...valid.constraints, totalTicks: 1921 },
      events: valid.events.map((event, index) =>
        index === 0 ? { ...event, durationTicks: 481 } : event,
      ),
    }
    const codes = issueCodes(offGrid)
    expect(codes).toContain('EVENT_NOT_ON_GRID')
    expect(codes).toContain('TOTAL_NOT_ON_GRID')
    expect(codes).toContain('NON_CONTIGUOUS')
  })

  it('requires contiguous events to equal the configured phrase total', () => {
    const valid = makeValidMelody()
    const wrongTotal: Melody = {
      ...valid,
      constraints: { ...valid.constraints, totalTicks: 2040 },
    }
    expect(issueCodes(wrongTotal)).toContain('PHRASE_TOTAL_MISMATCH')
  })

  it('maps integer degrees into the scale and enforces inclusive MIDI bounds', () => {
    const valid = makeValidMelody()
    const allDegrees = Array.from({ length: 15 }, (_, index) => index - 7)
    for (const degree of allDegrees) {
      const midi = melodyDegreeToMidi(degree, valid.constraints, IONIAN)
      const relativePitchClass = (midiToPitchClass(midi) - valid.constraints.tonicPitchClass + 12) % 12
      expect(IONIAN.offsets).toContain(relativePitchClass)
    }

    const outOfBounds: Melody = {
      ...valid,
      events: valid.events.map((event, index) =>
        index === 1 ? { ...event, degree: 21 } : event,
      ),
    }
    expect(issueCodes(outOfBounds)).toContain('MIDI_OUT_OF_REGISTER')

    const atInclusiveMaximum: Melody = {
      ...valid,
      constraints: {
        ...valid.constraints,
        register: { minMidi: 48, maxMidi: 84 },
      },
      events: valid.events.map((event, index) =>
        index === 1 ? { ...event, degree: 14 } : event,
      ),
    }
    expect(issueCodes(atInclusiveMaximum)).not.toContain('MIDI_OUT_OF_REGISTER')
  })

  it('enforces configured tonic boundaries, including octave-equivalent degrees', () => {
    const valid = makeValidMelody()
    const invalid: Melody = {
      ...valid,
      events: valid.events.map((event, index) => {
        if (index === 0) return { ...event, degree: 1 }
        if (index === valid.events.length - 1) return { ...event, degree: null }
        return event
      }),
    }
    expect(issueCodes(invalid)).toEqual(
      expect.arrayContaining(['TONIC_START_REQUIRED', 'TONIC_END_REQUIRED']),
    )

    const boundariesDisabled: Melody = {
      ...invalid,
      constraints: {
        ...invalid.constraints,
        tonicBoundary: { start: false, end: false },
      },
    }
    expect(issueCodes(boundariesDisabled)).not.toEqual(
      expect.arrayContaining(['TONIC_START_REQUIRED', 'TONIC_END_REQUIRED']),
    )
  })

  it('rejects inconsistent tonic anchors, scale IDs, and empty phrases', () => {
    const valid = makeValidMelody()
    const malformed: Melody = {
      events: [],
      constraints: {
        ...valid.constraints,
        scaleId: 'not-the-supplied-scale' as ScaleId,
        tonicMidi: 61,
      },
    }
    expect(issueCodes(malformed)).toEqual(
      expect.arrayContaining([
        'EMPTY_EVENTS',
        'SCALE_ID_MISMATCH',
        'TONIC_MIDI_PITCH_CLASS_MISMATCH',
      ]),
    )
    expect(() => assertValidMelody(malformed, IONIAN)).toThrow(MelodyInvariantError)
  })
})

describe('exact identity and immutable copies', () => {
  function makeCandidate(): Candidate {
    return {
      id: 'candidate-1',
      melody: makeValidMelody(),
      provenance: {
        strategy: 'evolution',
        generatorVersion: 'evolution-v1',
        seed: 'example-seed',
        settings: { mutation: { amount: 0.25 }, grid: [120, 240] },
        generation: 2,
        parentIds: ['parent-a', 'parent-b'],
        operations: [
          {
            operator: 'event-crossover',
            parameters: { boundary: 2, sources: ['parent-a', 'parent-b'] },
          },
        ],
      },
    }
  }

  it('uses exact musical content but not non-sounding constraints in fingerprints', () => {
    const original = makeValidMelody()
    const widerRegister: Melody = {
      ...original,
      constraints: {
        ...original.constraints,
        register: { minMidi: 36, maxMidi: 96 },
        gridTicks: 60,
      },
    }
    const changedNote: Melody = {
      ...original,
      events: original.events.map((event, index) =>
        index === 1 ? { ...event, degree: 3 } : event,
      ),
    }

    expect(exactMusicalFingerprint(widerRegister)).toBe(exactMusicalFingerprint(original))
    expect(exactMusicalFingerprint(changedNote)).not.toBe(exactMusicalFingerprint(original))
  })

  it('deduplicates octave-equivalent raw degrees under Legacy fixed-octave mapping', () => {
    const original = makeValidMelody()
    const legacy: Melody = {
      ...original,
      constraints: {
        ...original.constraints,
        register: { minMidi: 60, maxMidi: 71 },
        pitchMapping: 'legacy-fixed-octave',
      },
      events: original.events.map((event, index) =>
        index === 1 ? { ...event, degree: 1 } : event,
      ),
    }
    const octaveAlias: Melody = {
      ...legacy,
      events: legacy.events.map((event, index) =>
        index === 1 ? { ...event, degree: 8 } : event,
      ),
    }

    expect(exactMusicalFingerprint(octaveAlias)).toBe(
      exactMusicalFingerprint(legacy),
    )
  })

  it('deep-copies candidates, provenance JSON, and generation snapshots', () => {
    const candidate = makeCandidate()
    const candidateCopy = cloneCandidate(candidate)
    expect(candidateCopy).toEqual(candidate)
    expect(candidateCopy).not.toBe(candidate)
    expect(candidateCopy.melody.events).not.toBe(candidate.melody.events)
    expect(candidateCopy.melody.events[0]).not.toBe(candidate.melody.events[0])
    expect(candidateCopy.provenance.settings).not.toBe(candidate.provenance.settings)
    expect(candidateCopy.provenance.operations[0]?.parameters).not.toBe(
      candidate.provenance.operations[0]?.parameters,
    )

    const snapshot: GenerationSnapshot = {
      id: 'generation-2',
      generation: 2,
      seed: 'generation-seed',
      generatorVersion: 'evolution-v1',
      candidates: [candidate],
      selectedParentIds: [candidate.id],
      evolutionSettings: {
        populationSize: 8,
        mutationStrength: 0.25,
        retainElites: true,
      },
      previousGenerationId: 'generation-1',
    }
    const snapshotCopy = cloneGenerationSnapshot(snapshot)
    expect(snapshotCopy).toEqual(snapshot)
    expect(snapshotCopy.candidates).not.toBe(snapshot.candidates)
    expect(snapshotCopy.candidates[0]).not.toBe(snapshot.candidates[0])
    expect(snapshotCopy.selectedParentIds).not.toBe(snapshot.selectedParentIds)
    expect(snapshotCopy.evolutionSettings).not.toBe(snapshot.evolutionSettings)
  })
})
