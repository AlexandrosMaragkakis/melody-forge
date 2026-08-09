import { resolve } from 'node:path'

import { expect, test } from '@playwright/test'

const V1_PROJECT_FIXTURE = resolve(
  process.cwd(),
  'src/test/fixtures/v1/project-five-beat-history.v1.json',
)

test('Modern, five-beat V1 data, history, favorites, and reload remain usable', async ({
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

  await page.locator('.strategy-switch').getByText('Modern', { exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Modern' })).toBeChecked()
  await page.getByRole('spinbutton', { name: 'Phrase length' }).fill('5')
  await page.getByRole('textbox', { name: 'Seed' }).fill('v1-browser-five-beats')
  await page.getByRole('button', { name: 'Generate population' }).click()

  const cards = page.locator('.candidate-area article.candidate-card')
  await expect(cards).toHaveCount(8)
  await expect(cards.first().locator('.origin-badge')).toHaveText('Modern')
  await expect(cards.first().getByText('5 beats', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Play candidate 1' }).click()
  await expect(page.getByRole('button', { name: 'Stop candidate 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop candidate 1' }).click()

  const parents = page.getByRole('checkbox', { name: 'Parent', exact: true })
  await parents.nth(0).check()
  await parents.nth(1).check()
  await page.getByRole('button', { name: 'Evolve next generation' }).click()
  await expect(page.getByText(/Generation 1 created with/u)).toBeVisible()
  await page.getByRole('button', { name: 'Earlier' }).click()
  await expect(page.getByText(/Generation 0 · 1\/2/u).first()).toBeVisible()
  await page.getByRole('button', { name: 'Later' }).click()
  await expect(page.getByText(/Generation 1 · 2\/2/u).first()).toBeVisible()

  await page
    .getByRole('button', { name: 'Add candidate to favorites' })
    .first()
    .click()
  await expect(page.getByText('Saved to favorites locally.')).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles(V1_PROJECT_FIXTURE)
  await expect(page.getByText('Project imported and validated.')).toBeVisible()
  await expect(cards).toHaveCount(4)
  await expect(cards.first().getByText('5 beats', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Earlier' }).click()
  await expect(page.getByText(/Generation 0 · 1\/2/u).first()).toBeVisible()
  await page.getByRole('button', { name: 'Later' }).click()
  await expect(page.getByText(/Generation 1 · 2\/2/u).first()).toBeVisible()

  const favoritesPanel = page.locator('.favorites-panel')
  await favoritesPanel.locator(':scope > summary').click()
  await expect(favoritesPanel.locator('article.candidate-card')).toHaveCount(2)
  await favoritesPanel
    .getByRole('button', { name: 'Play candidate 1' })
    .click()
  await expect(
    favoritesPanel.getByRole('button', { name: 'Stop candidate 1' }),
  ).toBeVisible()
  await favoritesPanel
    .getByRole('button', { name: 'Stop candidate 1' })
    .click()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('melody-forge:project:v1')
        if (raw === null) return null
        const envelope = JSON.parse(raw) as {
          readonly schemaVersion?: number
          readonly project?: {
            readonly history?: ReadonlyArray<{
              readonly id?: string
              readonly candidates?: ReadonlyArray<{
                readonly id?: string
                readonly melody?: { readonly constraints?: { readonly totalTicks?: number } }
              }>
            }>
            readonly favorites?: ReadonlyArray<{ readonly id?: string }>
          }
        }
        return {
          schemaVersion: envelope.schemaVersion,
          historyIds: envelope.project?.history?.map(({ id }) => id),
          totalTicks:
            envelope.project?.history?.[0]?.candidates?.[0]?.melody?.constraints
              ?.totalTicks,
          favoriteIds: envelope.project?.favorites?.map(({ id }) => id),
        }
      }),
    )
    .toEqual({
      schemaVersion: 1,
      historyIds: [
        'generation-78d27e630c461958',
        'generation-de3f609f993b7868',
      ],
      totalTicks: 2_400,
      favoriteIds: [
        'legacy-14d4a7dce6581503',
        'evolved-84da177b30089c00',
      ],
    })

  await page.reload()
  await expect(page.getByText(/Generation 1 · 2\/2/u).first()).toBeVisible()
  await expect(cards).toHaveCount(4)
  await expect(cards.first().getByText('5 beats', { exact: true })).toBeVisible()

  await page.screenshot({
    path: testInfo.outputPath('v1-compatibility-current.png'),
    fullPage: true,
  })
  expect(consoleProblems, consoleProblems.join('\n')).toEqual([])
})
