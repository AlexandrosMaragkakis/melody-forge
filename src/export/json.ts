import type { ProjectState } from '../app/state'
import type { Candidate } from '../domain/types'
import {
  createCandidateEnvelope,
  createProjectEnvelope,
  decodeCandidateEnvelope,
  decodeProjectEnvelope,
  type DecodeResult,
} from '../persistence/schema'

function parseJson(text: string): DecodeResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, error: 'The selected file is not valid JSON.' }
  }
}

export function encodeProjectJson(state: ProjectState): string {
  return `${JSON.stringify(createProjectEnvelope(state), null, 2)}\n`
}

export function decodeProjectJson(text: string): DecodeResult<ProjectState> {
  const parsed = parseJson(text)
  return parsed.ok ? decodeProjectEnvelope(parsed.value) : parsed
}

export function encodeCandidateJson(candidate: Candidate): string {
  return `${JSON.stringify(createCandidateEnvelope(candidate), null, 2)}\n`
}

export function decodeCandidateJson(text: string): DecodeResult<Candidate> {
  const parsed = parseJson(text)
  return parsed.ok ? decodeCandidateEnvelope(parsed.value) : parsed
}
