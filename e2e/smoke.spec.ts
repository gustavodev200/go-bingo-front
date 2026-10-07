import { expect, test } from '@playwright/test';

test('@smoke visitante sem sessão cai no login com a opção de convidado', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Jogar como convidado' })).toBeVisible();
});

test('@smoke manifest e página offline respondem', async ({ request }) => {
  expect((await request.get('/manifest.webmanifest')).ok()).toBe(true);
  expect((await request.get('/~offline')).ok()).toBe(true);
});
