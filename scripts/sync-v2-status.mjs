import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const statusPath = resolve(repositoryRoot, 'PROJECT_STATUS.md')
const planPath = resolve(repositoryRoot, 'docs/V2_IMPLEMENTATION_PLAN.md')
const startMarker = '<!-- V2-CHECKLIST:START (generated; run npm run status:sync) -->'
const endMarker = '<!-- V2-CHECKLIST:END -->'

function countOccurrences(text, value) {
  return text.split(value).length - 1
}

function planBodyForRootStatus(plan) {
  return plan
    .replace(/^# .*?\r?\n+(?=\S)/u, '')
    .replace(/\]\(\.\/([^)]+)\)/gu, '](docs/$1)')
}

function generatedChecklist(plan) {
  const planBody = planBodyForRootStatus(plan)
  return `${startMarker}
## V2 complete mirrored implementation checklist

This section is generated from \`docs/V2_IMPLEMENTATION_PLAN.md\` so every
stable requirement ID, status, deliverable, test, browser check, and next action
is mechanically identical. Links relative to the plan's \`docs/\` directory are
normalized for this repository-root mirror. Do not edit inside the markers;
update the plan and run \`npm run status:sync\`.

${planBody.trimEnd()}
${endMarker}`
}

const status = readFileSync(statusPath, 'utf8')
const plan = readFileSync(planPath, 'utf8')
const generated = generatedChecklist(plan)
const startCount = countOccurrences(status, startMarker)
const endCount = countOccurrences(status, endMarker)
let nextStatus

if (startCount === 0 && endCount === 0) {
  nextStatus = `${status.trimEnd()}\n\n${generated}\n`
} else {
  if (startCount !== 1 || endCount !== 1) {
    throw new Error('PROJECT_STATUS.md must contain exactly one complete generated V2 checklist')
  }
  const startIndex = status.indexOf(startMarker)
  const endIndex = status.indexOf(endMarker)
  if (endIndex < startIndex) {
    throw new Error('PROJECT_STATUS.md has generated V2 checklist markers in the wrong order')
  }
  nextStatus = `${status.slice(0, startIndex).trimEnd()}\n\n${generated}${status
    .slice(endIndex + endMarker.length)
    .replace(/^\s*/u, '\n')}`
}

writeFileSync(statusPath, nextStatus)
