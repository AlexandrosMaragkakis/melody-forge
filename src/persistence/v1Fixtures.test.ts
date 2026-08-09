/// <reference types="node" />

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { melodyDegreeToMidi } from '../domain/pitch'
import { getScale } from '../domain/scales'
import { encodeCandidateJson, encodeProjectJson } from '../export/json'
import { decodeCandidateEnvelope, decodeProjectEnvelope } from './schema'
import { loadProjectState, PROJECT_STORAGE_KEY } from './storage'

const FIXTURE_DIRECTORY = join(process.cwd(), 'src/test/fixtures/v1')

function fixtureText(name: string): string {
  return readFileSync(join(FIXTURE_DIRECTORY, name), 'utf8')
}

function fixtureJson(name: string): unknown {
  return JSON.parse(fixtureText(name)) as unknown
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('static V1 compatibility fixtures', () => {
  it('locks the complete fixture payload set against its SHA-256 manifest', () => {
    const documentationFiles = ['README.md', 'manifest.sha256']
    const payloadFiles = [
      'candidate-legacy-five-beat.v1.json',
      'candidate-modern-five-beat.v1.json',
      'candidate-modern-five-beat.v1.mid',
      'candidate-modern-non-480-ppq.v1.json',
      'local-storage-project-v1.json',
      'project-favorites-only.v1.json',
      'project-five-beat-history.v1.json',
      'project-mixed-ppq-favorites.v1.json',
    ]
    expect(readdirSync(FIXTURE_DIRECTORY).sort()).toEqual(
      [...documentationFiles, ...payloadFiles].sort(),
    )

    expect(
      sha256(readFileSync(join(FIXTURE_DIRECTORY, 'manifest.sha256'))),
    ).toBe('ce35a6d94fbd17aa4c9b0b37d0ce980ab048bc1bc9c7556b3262cd2aebc8f78a')

    const manifestEntries = fixtureText('manifest.sha256')
      .trimEnd()
      .split('\n')
      .map((line) => {
        const match = /^([0-9a-f]{64}) {2}(.+)$/u.exec(line)
        expect(match, `invalid manifest line: ${line}`).not.toBeNull()
        if (match === null) throw new Error('invalid fixture manifest')
        return { digest: match[1]!, name: match[2]! }
      })
    expect(manifestEntries.map(({ name }) => name)).toEqual(payloadFiles)
    for (const { digest, name } of manifestEntries) {
      expect(sha256(readFileSync(join(FIXTURE_DIRECTORY, name))), name).toBe(
        digest,
      )
    }
  })

  it('keeps the complete legacy source path set and hashes byte-identical', () => {
    const legacyDirectory = join(process.cwd(), 'legacy')
    expect(readdirSync(legacyDirectory).sort()).toEqual([
      'notes_generator1.py',
      'tmp.py',
    ])
    expect(sha256(readFileSync(join(legacyDirectory, 'notes_generator1.py')))).toBe(
      '203c91aa48d2df05f33b3a0910d0c69c68bf16ef194913cb7b52acb94e0c6029',
    )
    expect(sha256(readFileSync(join(legacyDirectory, 'tmp.py')))).toBe(
      'd0d288968392db0f7ad53fb78a8c0ca00567449c7aab01cd8bb032f42789bff2',
    )
  })

  it('keeps all six pre-change browser captures byte-identical', () => {
    const screenshotDirectory = join(process.cwd(), 'screenshots')
    const expected = {
      'desktop-chromium-workflow.png':
        'ff3ea282ea4f0e0a05aeb6d9e1cb3f26f6c96b921a248541de134d487de36a2b',
      'mobile-chromium-workflow.png':
        '5c96bc61874430d2aae5ff07cc1be00905f2067254aa36e6827019db5ef472d6',
      'v1-baseline-desktop-1440x1000.png':
        'ff3ea282ea4f0e0a05aeb6d9e1cb3f26f6c96b921a248541de134d487de36a2b',
      'v1-baseline-mobile-390x844.png':
        '5c96bc61874430d2aae5ff07cc1be00905f2067254aa36e6827019db5ef472d6',
      'v1-baseline-modern-five-beat-desktop-chromium.png':
        '853bf7014439aa125b36670eee26b3a2c176642d3305a53299bf3c900e7efab6',
      'v1-baseline-modern-five-beat-mobile-chromium.png':
        'b957454cb563b46028675c291bf2b14f1902316d53f0a3e7ffb0a70f191cc8ed',
    } as const

    for (const [name, digest] of Object.entries(expected)) {
      expect(sha256(readFileSync(join(screenshotDirectory, name))), name).toBe(
        digest,
      )
    }
  })

  it('decodes and exactly re-encodes a real V1 project with evolutionary history', () => {
    const text = fixtureText('project-five-beat-history.v1.json')
    const decoded = decodeProjectEnvelope(JSON.parse(text) as unknown)

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    expect(decoded.value.history.map(({ id }) => id)).toEqual([
      'generation-78d27e630c461958',
      'generation-de3f609f993b7868',
    ])
    expect(decoded.value.history[1]?.candidates.map(({ id }) => id)).toEqual([
      'candidate-2e3dbf51cb754063',
      'candidate-e7a7faaf8d22eb7e',
      'evolved-84da177b30089c00',
      'evolved-49303416fbb0c401',
    ])
    expect(decoded.value.favorites.map(({ id }) => id)).toEqual([
      'legacy-14d4a7dce6581503',
      'evolved-84da177b30089c00',
    ])
    expect(encodeProjectJson(decoded.value)).toBe(text)
  })

  it('preserves five-beat timing and stored pitches for Modern and Legacy candidates', () => {
    const modern = decodeCandidateEnvelope(
      fixtureJson('candidate-modern-five-beat.v1.json'),
    )
    const legacy = decodeCandidateEnvelope(
      fixtureJson('candidate-legacy-five-beat.v1.json'),
    )

    expect(modern.ok).toBe(true)
    expect(legacy.ok).toBe(true)
    if (!modern.ok || !legacy.ok) return

    expect(modern.value.melody.constraints.totalTicks).toBe(2_400)
    expect(modern.value.melody.events.at(-1)).toMatchObject({
      startTick: 2_160,
      durationTicks: 240,
    })
    expect(modern.value.melody.events.map(({ degree }) => degree)).toEqual([
      0,
      2,
      3,
      4,
      3,
      null,
      2,
      1,
      2,
      0,
    ])

    const legacyScale = getScale(legacy.value.melody.constraints.scaleId)
    expect(legacy.value.melody.constraints.totalTicks).toBe(2_400)
    expect(legacy.value.melody.events.map(({ degree }) => degree)).toEqual([
      0,
      -4,
      -6,
      -2,
      0,
    ])
    expect(
      legacy.value.melody.events.map(({ degree }) =>
        degree === null
          ? null
          : melodyDegreeToMidi(
              degree,
              legacy.value.melody.constraints,
              legacyScale,
            ),
      ),
    ).toEqual([71, 64, 61, 68, 71])
    expect(encodeCandidateJson(legacy.value)).toBe(
      fixtureText('candidate-legacy-five-beat.v1.json'),
    )
  })

  it('loads the captured localStorage envelope without clearing or reinterpretation', () => {
    const stored = fixtureText('local-storage-project-v1.json')
    const reads: string[] = []
    const loaded = loadProjectState({
      getItem(key) {
        reads.push(key)
        return stored
      },
    })

    expect(reads).toEqual([PROJECT_STORAGE_KEY])
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.source).toBe('stored')
    expect(loaded.state.history).toHaveLength(2)
    expect(loaded.state.favorites).toHaveLength(2)
    expect(loaded.state.history[0]?.candidates[0]?.melody.constraints.totalTicks).toBe(
      2_400,
    )
  })

  it('keeps favorites valid without generation history', () => {
    const decoded = decodeProjectEnvelope(
      fixtureJson('project-favorites-only.v1.json'),
    )
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.value.history).toEqual([])
    expect(decoded.value.historyIndex).toBe(-1)
    expect(decoded.value.favorites).toHaveLength(2)
  })

  it('preserves schema-valid non-480 PPQ and mixed timing profiles exactly', () => {
    const candidate = decodeCandidateEnvelope(
      fixtureJson('candidate-modern-non-480-ppq.v1.json'),
    )
    const project = decodeProjectEnvelope(
      fixtureJson('project-mixed-ppq-favorites.v1.json'),
    )

    expect(candidate.ok).toBe(true)
    expect(project.ok).toBe(true)
    if (!candidate.ok || !project.ok) return

    expect(candidate.value.melody.constraints).toMatchObject({
      ticksPerBeat: 96,
      gridTicks: 48,
      totalTicks: 480,
    })
    expect(
      candidate.value.melody.events.map(
        ({ startTick, durationTicks }) => [startTick, durationTicks],
      ),
    ).toEqual(
      Array.from({ length: 10 }, (_, index) => [index * 48, 48]),
    )
    expect(
      project.value.favorites.map(
        ({ melody }) => melody.constraints.ticksPerBeat,
      ),
    ).toEqual([96, 480])
    expect(
      project.value.favorites.map(
        ({ melody }) => melody.constraints.totalTicks,
      ),
    ).toEqual([480, 2_400])
    expect(
      project.value.favorites.map(({ melody }) =>
        melody.events.map(({ startTick, durationTicks }) => [
          startTick,
          durationTicks,
        ]),
      ),
    ).toEqual([
      Array.from({ length: 10 }, (_, index) => [index * 48, 48]),
      Array.from({ length: 10 }, (_, index) => [index * 240, 240]),
    ])
  })

  it('locks the non-480 and mixed-profile fixture bytes', () => {
    expect(
      sha256(
        readFileSync(
          join(FIXTURE_DIRECTORY, 'candidate-modern-non-480-ppq.v1.json'),
        ),
      ),
    ).toBe('2d8387aa0ab887994235d3c385e7953634875b776c8fd410ed2b121ee21ab482')
    expect(
      sha256(
        readFileSync(
          join(FIXTURE_DIRECTORY, 'project-mixed-ppq-favorites.v1.json'),
        ),
      ),
    ).toBe('0780e886c00e642cabdd80075212f8a3b8640a77d7f90621d0dd09330578f807')
  })

  it('locks the exact exported V1 MIDI bytes', () => {
    expect(
      sha256(
        readFileSync(
          join(FIXTURE_DIRECTORY, 'candidate-modern-five-beat.v1.mid'),
        ),
      ),
    ).toBe('b62723c94c75cf83dd0112f35fc10d08e9b9b628f57bf75d7d80327b5edfdabd')
  })
})
