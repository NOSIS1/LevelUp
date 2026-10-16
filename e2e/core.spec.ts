import { expect, test } from '@playwright/test';

test.describe('LevelUp core flows', () => {
  test('creates an English session and displays earned XP', async ({ page }) => {
    await page.goto('/english/session/new');
    await page.getByLabel('Продолжительность (минуты)').fill('25');
    await page.getByRole('button', { name: 'Завершить занятие' }).click();
    await expect(page).toHaveURL(/\/english$/);
    await expect(page.getByText('+25 XP').first()).toBeVisible();
  });

  test('adds and reviews a vocabulary card', async ({ page }) => {
    await page.goto('/english');
    await page.getByRole('button', { name: 'Добавить' }).click();
    await page.getByLabel('Английское слово').fill('playwright-e2e-word');
    await page.getByLabel('Перевод').fill('тест браузера');
    await page.getByRole('button', { name: 'Сохранить слово' }).click();
    await expect(page.getByText('playwright-e2e-word', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Показать ответ' }).click();
    await expect(page.getByText('тест браузера', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Вспомнил', exact: true }).click();
    await expect(page.getByText('1 верно')).toBeVisible();
  });

  test('creates a goal and exports local data', async ({ page }) => {
    await page.goto('/goals');
    await page.getByRole('button', { name: 'Новая цель' }).click();
    await page.getByLabel('Название цели').fill('E2E goal');
    await page.getByLabel('Целевое значение').fill('3');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('E2E goal')).toBeVisible();

    await page.goto('/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Экспортировать JSON' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^levelup-export-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
