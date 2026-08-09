import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('complete local creative loop remains usable and clean', async ({
  page,
}, testInfo) => {
  const consoleProblems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`))

  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Melody Forge' })).toBeVisible()
  await page.getByRole('button', { name: 'Generate population' }).click()
  await expect(page.locator('article.candidate-card')).toHaveCount(8)

  await page.getByRole('button', { name: 'Play candidate 1' }).click()
  await expect(page.getByRole('button', { name: 'Stop candidate 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop candidate 1' }).click()
  await expect(page.getByRole('button', { name: 'Play candidate 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Play candidate 1' }).click()
  await expect(page.getByRole('button', { name: 'Stop candidate 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop candidate 1' }).click()

  const parentChoices = page.getByRole('checkbox', {
    name: 'Parent',
    exact: true,
  })
  await parentChoices.nth(0).check()
  await parentChoices.nth(1).check()
  await expect(page.getByText('2/2 parents')).toBeVisible()
  await page.getByRole('button', { name: 'Evolve next generation' }).click()
  await expect(page.getByText(/Generation 1 created with/)).toBeVisible()
  await expect(page.locator('article.candidate-card')).toHaveCount(8)

  await page.getByRole('button', { name: 'Play candidate 3' }).click()
  await expect(page.getByRole('button', { name: 'Stop candidate 3' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop candidate 3' }).click()
  await page
    .getByRole('button', { name: 'Add candidate to favorites' })
    .nth(2)
    .click()
  await expect(page.getByText('Saved to favorites locally.')).toBeVisible()

  await page.reload()
  await expect(page.getByText(/Generation 1 · 2\/2/).first()).toBeVisible()
  await expect(page.locator('.favorites-panel > summary')).toContainText('Favorites')

  const projectDownloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export project' }).click()
  const projectDownload = await projectDownloadEvent
  expect(projectDownload.suggestedFilename()).toBe('melody-forge-project.json')
  const projectPath = await projectDownload.path()
  expect(projectPath).not.toBeNull()
  if (projectPath === null) {
    throw new Error('Playwright did not provide a local project download path')
  }

  const thirdCandidate = page.locator('article.candidate-card').nth(2)
  await thirdCandidate.getByText('Provenance & export').click()
  const midiDownloadEvent = page.waitForEvent('download')
  await thirdCandidate.getByRole('button', { name: 'MIDI' }).click()
  const midiDownload = await midiDownloadEvent
  expect(midiDownload.suggestedFilename()).toMatch(/\.mid$/)
  await thirdCandidate.getByText('Provenance & export').click()

  await page.locator('input[type="file"]').setInputFiles(projectPath)
  await expect(page.getByText('Project imported and validated.')).toBeVisible()

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

  await page.keyboard.press('Tab')
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.tagName ?? ''))
    .not.toBe('BODY')

  const legacyRadio = page.getByRole('radio', { name: 'Legacy' })
  await legacyRadio.focus()
  await expect
    .poll(() =>
      legacyRadio.locator('..').evaluate((label) => getComputedStyle(label).outlineStyle),
    )
    .toBe('solid')

  const importInput = page.locator('input[type="file"]')
  await importInput.focus()
  await expect
    .poll(() =>
      importInput.locator('..').evaluate((label) => getComputedStyle(label).outlineStyle),
    )
    .toBe('solid')

  await page.locator('.favorites-panel > summary').click()
  const renderedIds = await page.locator('[id]').evaluateAll((elements) =>
    elements.map((element) => element.id),
  )
  expect(new Set(renderedIds).size).toBe(renderedIds.length)

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(
    accessibility.violations,
    accessibility.violations
      .map(({ id, help }) => `${id}: ${help}`)
      .join('\n'),
  ).toEqual([])

  await page.screenshot({
    path: testInfo.outputPath('creative-loop-current.png'),
    fullPage: true,
  })

  expect(consoleProblems, consoleProblems.join('\n')).toEqual([])
})
