import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const requirementsRelativePath = 'docs/V2_REQUIREMENTS.md'
const planRelativePath = 'docs/V2_IMPLEMENTATION_PLAN.md'
const manifestRelativePath = 'docs/V2_REQUIREMENT_IDS.txt'
const statusRelativePath = 'PROJECT_STATUS.md'
const requiredDocuments = [
  'docs/V2_PRODUCT_SPEC.md',
  'docs/V2_UI_SPEC.md',
  'docs/V2_ARCHITECTURE.md',
  planRelativePath,
  requirementsRelativePath,
  manifestRelativePath,
]
const allowedStatuses = new Set([
  'not started',
  'in progress',
  'done',
  'blocked',
])
const requirementIdPattern = /^[A-Z][A-Z0-9]*-[A-Z0-9-]+$/u
const startMarker = '<!-- V2-CHECKLIST:START (generated; run npm run status:sync) -->'
const endMarker = '<!-- V2-CHECKLIST:END -->'
const lockedManifestEntryCount = 691
const lockedManifestSha256 = '070231a703bb246f5d8b531e2594bc8a44fa7c298eb6d4fbf6166a4a0538a79f'

for (const documentPath of requiredDocuments) {
  if (!existsSync(resolve(repositoryRoot, documentPath))) {
    throw new Error(`Required V2 document is missing: ${documentPath}`)
  }
}

function linesWithNumbers(text) {
  return text.split(/\r?\n/u).map((line, index) => ({
    line,
    lineNumber: index + 1,
  }))
}

function tableCells(line, expectedCount, sourceName, lineNumber) {
  const pieces = line.split('|')
  if (pieces.at(0) !== '' || pieces.at(-1) !== '') {
    throw new Error(`${sourceName}:${String(lineNumber)} has malformed table edges`)
  }
  const cells = pieces.slice(1, -1).map((cell) => cell.trim())
  if (cells.length !== expectedCount) {
    throw new Error(
      `${sourceName}:${String(lineNumber)} must have exactly ${String(expectedCount)} fields; found ${String(cells.length)}`,
    )
  }
  const emptyIndex = cells.findIndex((cell) => cell.length === 0)
  if (emptyIndex !== -1) {
    throw new Error(
      `${sourceName}:${String(lineNumber)} field ${String(emptyIndex + 1)} is empty`,
    )
  }
  return cells
}

function uniqueRows(rows, sourceName) {
  const result = new Map()
  for (const row of rows) {
    if (result.has(row.id)) {
      throw new Error(`${sourceName} contains duplicate ID ${row.id}`)
    }
    result.set(row.id, row)
  }
  if (result.size === 0) {
    throw new Error(`${sourceName} contains no requirement rows`)
  }
  return result
}

function requirementRows(text) {
  let activeMilestone
  const milestoneHeadings = []
  const rows = []
  for (const { line, lineNumber } of linesWithNumbers(text)) {
    const heading = line.match(/^## Milestone (\d+)\b/u)
    if (heading) {
      activeMilestone = Number(heading[1])
      milestoneHeadings.push({ milestone: activeMilestone, lineNumber })
      continue
    }
    if (line.startsWith('| ID |')) continue
    if (!/^\| [A-Z]/u.test(line)) continue
    if (activeMilestone === undefined) {
      throw new Error(
        `${requirementsRelativePath}:${String(lineNumber)} has a requirement row before a milestone`,
      )
    }
    const cells = tableCells(line, 7, requirementsRelativePath, lineNumber)
    const [id, requirement, implementation, ui, automated, browser, status] = cells
    if (!requirementIdPattern.test(id)) {
      throw new Error(
        `${requirementsRelativePath}:${String(lineNumber)} has invalid ID ${id}`,
      )
    }
    if (!allowedStatuses.has(status)) {
      throw new Error(
        `${requirementsRelativePath}:${String(lineNumber)} uses invalid status for ${id}: ${status}`,
      )
    }
    rows.push({
      milestone: activeMilestone,
      id,
      requirement,
      implementation,
      ui,
      automated,
      browser,
      status,
      lineNumber,
    })
  }
  const expectedMilestones = Array.from({ length: 11 }, (_, index) => index + 1)
  const actualMilestones = milestoneHeadings.map(({ milestone }) => milestone)
  if (JSON.stringify(actualMilestones) !== JSON.stringify(expectedMilestones)) {
    throw new Error(
      `${requirementsRelativePath} milestone headings must be exactly 1 through 11 once each; found ${actualMilestones.join(', ')}`,
    )
  }
  return { rows, byId: uniqueRows(rows, requirementsRelativePath) }
}

function manifestEntries(text) {
  const entries = linesWithNumbers(text).flatMap(({ line, lineNumber }) => {
    if (line.length === 0 || line.startsWith('#')) return []
    const match = line.match(/^M(0[1-9]|1[01])\t([A-Z][A-Z0-9-]+)$/u)
    if (!match) {
      throw new Error(
        `${manifestRelativePath}:${String(lineNumber)} must use M01<TAB>ID through M11<TAB>ID`,
      )
    }
    return [{ milestone: Number(match[1]), id: match[2], lineNumber }]
  })
  const byId = uniqueRows(entries, manifestRelativePath)
  const seenMilestones = new Set(entries.map(({ milestone }) => milestone))
  for (let milestone = 1; milestone <= 11; milestone += 1) {
    if (!seenMilestones.has(milestone)) {
      throw new Error(`${manifestRelativePath} contains no IDs for milestone ${String(milestone)}`)
    }
  }
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index].milestone < entries[index - 1].milestone) {
      throw new Error(
        `${manifestRelativePath}:${String(entries[index].lineNumber)} moves backwards from milestone ${String(entries[index - 1].milestone)} to ${String(entries[index].milestone)}`,
      )
    }
  }
  return { entries, byId }
}

function checklistRows(text, sourceName) {
  let activeMilestone
  const milestoneHeadings = []
  const rows = []
  for (const { line, lineNumber } of linesWithNumbers(text)) {
    const heading = line.match(/^## Milestone (\d+)\b/u)
    if (heading) {
      activeMilestone = Number(heading[1])
      milestoneHeadings.push({ milestone: activeMilestone, lineNumber })
      continue
    }
    if (!/^\| \[[ x]\] \|/u.test(line)) continue
    if (activeMilestone === undefined) {
      throw new Error(`${sourceName}:${String(lineNumber)} has a checklist row before a milestone`)
    }
    const cells = tableCells(line, 6, sourceName, lineNumber)
    const [checkCell, idCell, status, deliverable, automated, browser] = cells
    const checkMatch = checkCell.match(/^\[([ x])\]$/u)
    const idMatch = idCell.match(/^`([A-Z][A-Z0-9-]+)`$/u)
    if (!checkMatch || !idMatch) {
      throw new Error(`${sourceName}:${String(lineNumber)} has invalid checkbox or ID syntax`)
    }
    const id = idMatch[1]
    if (!allowedStatuses.has(status)) {
      throw new Error(
        `${sourceName}:${String(lineNumber)} uses invalid status for ${id}: ${status}`,
      )
    }
    const checked = checkMatch[1] === 'x'
    if (checked !== (status === 'done')) {
      throw new Error(
        `${sourceName}:${String(lineNumber)} checkbox/status mismatch for ${id}: ${checkCell} ${status}`,
      )
    }
    rows.push({
      milestone: activeMilestone,
      id,
      checked,
      status,
      deliverable,
      automated,
      browser,
      lineNumber,
    })
  }
  const expectedMilestones = Array.from({ length: 11 }, (_, index) => index + 1)
  const actualMilestones = milestoneHeadings.map(({ milestone }) => milestone)
  if (JSON.stringify(actualMilestones) !== JSON.stringify(expectedMilestones)) {
    throw new Error(
      `${sourceName} milestone headings must be exactly 1 through 11 once each; found ${actualMilestones.join(', ')}`,
    )
  }
  return { rows, byId: uniqueRows(rows, sourceName) }
}

function assertExactManifestSet(requirements, manifest) {
  const missing = [...manifest.keys()].filter((id) => !requirements.has(id))
  const extra = [...requirements.keys()].filter((id) => !manifest.has(id))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${requirementsRelativePath} does not match the locked ID manifest:\n` +
        `missing=${missing.join(', ') || 'none'}\n` +
        `extra=${extra.join(', ') || 'none'}`,
    )
  }
}

function assertRequirementsMatchManifest(requirements, manifest) {
  if (requirements.length !== manifest.length) {
    throw new Error(
      `${requirementsRelativePath} has ${String(requirements.length)} rows; locked manifest has ${String(manifest.length)}`,
    )
  }
  for (let index = 0; index < manifest.length; index += 1) {
    const expected = manifest[index]
    const actual = requirements[index]
    if (actual.id !== expected.id || actual.milestone !== expected.milestone) {
      throw new Error(
        `${requirementsRelativePath}:${String(actual.lineNumber)} position ${String(index + 1)} must be milestone ${String(expected.milestone)} ${expected.id}; found milestone ${String(actual.milestone)} ${actual.id}`,
      )
    }
  }
}

function expectedDeliverable(row) {
  return `${row.requirement} Implementation: ${row.implementation}. UI: ${row.ui}.`
}

function assertPlanMatches(requirements, manifest, plan) {
  if (plan.rows.length !== manifest.length) {
    throw new Error(
      `${planRelativePath} has ${String(plan.rows.length)} rows; locked manifest has ${String(manifest.length)}`,
    )
  }
  for (let index = 0; index < manifest.length; index += 1) {
    const expectedPosition = manifest[index]
    const actual = plan.rows[index]
    if (
      actual.id !== expectedPosition.id ||
      actual.milestone !== expectedPosition.milestone
    ) {
      throw new Error(
        `${planRelativePath}:${String(actual.lineNumber)} position ${String(index + 1)} must be milestone ${String(expectedPosition.milestone)} ${expectedPosition.id}; found milestone ${String(actual.milestone)} ${actual.id}`,
      )
    }
    const requirement = requirements.get(actual.id)
    if (actual.status !== requirement.status) {
      throw new Error(
        `${actual.id} status mismatch: requirements=${requirement.status}, plan=${actual.status}`,
      )
    }
    const deliverable = expectedDeliverable(requirement)
    if (actual.deliverable !== deliverable) {
      throw new Error(`${actual.id} plan deliverable/UI is not the exact requirements reconstruction`)
    }
    if (actual.automated !== requirement.automated) {
      throw new Error(`${actual.id} plan automated evidence differs from requirements`)
    }
    if (actual.browser !== requirement.browser) {
      throw new Error(`${actual.id} plan browser evidence differs from requirements`)
    }
  }
}

function countOccurrences(text, value) {
  return text.split(value).length - 1
}

function planBodyForRootStatus(planText) {
  return planText
    .replace(/^# .*?\r?\n+(?=\S)/u, '')
    .replace(/\]\(\.\/([^)]+)\)/gu, '](docs/$1)')
}

function generatedChecklist(planText) {
  const planBody = planBodyForRootStatus(planText)
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

const requirementsText = readFileSync(
  resolve(repositoryRoot, requirementsRelativePath),
  'utf8',
)
const planText = readFileSync(resolve(repositoryRoot, planRelativePath), 'utf8')
const manifestText = readFileSync(
  resolve(repositoryRoot, manifestRelativePath),
  'utf8',
)
const projectStatus = readFileSync(resolve(repositoryRoot, statusRelativePath), 'utf8')

const manifest = manifestEntries(manifestText)
const manifestSha256 = createHash('sha256').update(manifestText).digest('hex')
if (
  manifest.entries.length !== lockedManifestEntryCount ||
  manifestSha256 !== lockedManifestSha256
) {
  throw new Error(
    `${manifestRelativePath} reviewed lock mismatch: expected exactly ${String(lockedManifestEntryCount)} IDs and raw SHA-256 ${lockedManifestSha256}; found ${String(manifest.entries.length)} IDs and raw SHA-256 ${manifestSha256}. A reviewed traceability change must update both lock constants.`,
  )
}
const requirements = requirementRows(requirementsText)
const plan = checklistRows(planText, planRelativePath)
assertExactManifestSet(requirements.byId, manifest.byId)
assertRequirementsMatchManifest(requirements.rows, manifest.entries)
assertPlanMatches(requirements.byId, manifest.entries, plan)

if (
  countOccurrences(projectStatus, startMarker) !== 1 ||
  countOccurrences(projectStatus, endMarker) !== 1
) {
  throw new Error(`${statusRelativePath} must contain exactly one generated marker pair`)
}
const start = projectStatus.indexOf(startMarker)
const end = projectStatus.indexOf(endMarker)
if (end <= start) {
  throw new Error(`${statusRelativePath} has generated markers in the wrong order`)
}
const actualGenerated = projectStatus.slice(start, end + endMarker.length)
const expectedGenerated = generatedChecklist(planText)
if (actualGenerated !== expectedGenerated) {
  throw new Error(
    `${statusRelativePath} generated checklist is stale or not byte-exact; run npm run status:sync`,
  )
}

const statusChecklist = checklistRows(actualGenerated, `${statusRelativePath} V2 checklist`)
assertPlanMatches(requirements.byId, manifest.entries, statusChecklist)

console.log(
  `V2 traceability OK: ${String(requirements.byId.size)} locked IDs with exact fields and order across 11 milestones and ${statusRelativePath}.`,
)
