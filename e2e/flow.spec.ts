// The main flow in both languages: set up a profile, get a program, do a workout, read the summary.
import { expect, test, type Page } from '@playwright/test';

/** Fail the test on any error the page logs or throws. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

test.beforeEach(async ({ request }) => {
  // Importing an empty export wipes all data, so every test starts without a profile.
  const res = await request.post('/api/import/json', { data: { app: 'open-strength', tables: {} } });
  expect(res.ok()).toBeTruthy();
});

for (const lang of ['en', 'nl'] as const) {
  const T = (en: string, nl: string) => (lang === 'nl' ? nl : en);

  test(`profile → program → workout → summary (${lang})`, async ({ page }) => {
    const errors = collectErrors(page);
    page.on('dialog', (d) => void d.accept());

    // A new user sees English and is asked to set up a profile.
    await page.goto('/');
    await page.getByRole('link', { name: 'Set up your profile' }).click();
    if (lang === 'nl') await page.getByRole('button', { name: 'Nederlands' }).click();
    await expect(page.getByRole('heading', { name: T('Set up your profile', 'Profiel instellen') })).toBeVisible();

    await page.getByLabel(T('Name', 'Naam')).fill('Test');
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: T('Save and make my program', 'Opslaan en programma maken') }).click();

    // Without AI the app builds a rule-based program and opens it.
    await expect(page).toHaveURL(/\/program$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(T('Full body A/B for muscle growth', 'Full body A/B voor spiermassa'));
    await expect(page.getByText(T('Workout 1 of 12', 'Training 1 van 12'))).toBeVisible();

    // Today: start the next workout.
    await page.goto('/');
    await page.getByRole('button', { name: T('Start workout', 'Start training') }).click();
    await expect(page).toHaveURL(/\/workout\/\d+$/);

    // Log every set with the prefilled weight and reps; the app moves on by itself.
    const log = page.locator('.log-btn');
    await expect(log).toBeVisible();
    let logged = 0;
    while (logged < 40 && (await log.isVisible())) {
      await log.click();
      logged++;
      await page.waitForTimeout(150);
    }
    expect(logged).toBeGreaterThanOrEqual(8);
    // Every exercise shows a check mark in the strip once all its sets are logged.
    await expect(page.locator('.strip button:not(.done)')).toHaveCount(0);
    await page.getByRole('button', { name: T('Finish', 'Afronden') }).click();

    // Summary: the engine's advice for every exercise.
    await expect(page).toHaveURL(/\/summary$/);
    await expect(page.getByRole('heading', { name: T('Next workout', 'Volgende training') })).toBeVisible();
    const outcomes = page.locator('.outcome');
    await expect(outcomes.first()).toBeVisible();
    expect(await outcomes.count()).toBeGreaterThanOrEqual(4);
    await expect(outcomes.first().locator('.reason')).not.toBeEmpty();

    // Back on Today the next workout is number 2.
    await page.getByRole('link', { name: T('Done', 'Klaar') }).click();
    await expect(page.getByText(T('Workout 2 of 12', 'Training 2 van 12'))).toBeVisible();

    // Without Open Nutrilog configured the profile says so, and nothing else changes.
    await page.goto('/profile');
    await expect(page.getByText(T('Nutrition: not linked', 'Voeding: niet gekoppeld'))).toBeVisible();

    expect(errors).toEqual([]);
  });
}

test('the exercise library filters and opens a guide', async ({ page, request }) => {
  const errors = collectErrors(page);
  await request.put('/api/profile', {
    data: { age: 35, heightCm: 180, weightKg: 80, level: 'beginner', goal: 'hypertrophy', trainingDays: 2, sessionMinutes: 45, equipment: ['barbell', 'bench', 'dumbbell'], limitations: '' },
  });
  await page.goto('/exercises');
  await page.getByRole('searchbox', { name: 'Search exercises' }).fill('bench press');
  await page.getByRole('link', { name: /Barbell bench press/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Barbell bench press' })).toBeVisible();
  await expect(page.locator('.steps li').first()).toContainText('Lie on the bench');
  expect(errors).toEqual([]);
});
