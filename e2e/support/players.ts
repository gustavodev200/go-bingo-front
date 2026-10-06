import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export async function newGuest(browser: Browser, nickname: string): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByRole('button', { name: 'Jogar como convidado' }).click();
  // O Turnstile de teste (site key 1x00…AA) resolve sozinho e dispara o signInAnonymously.
  await expect(page).toHaveURL(/\/apelido/, { timeout: 30_000 });
  await page.getByLabel('Apelido').fill(nickname);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).not.toHaveURL(/\/apelido/);
  return { page, context };
}

export async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/criar');
  await page.getByLabel('Nome da sala').fill(name);
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page).toHaveURL(/\/[A-Z0-9]{6}$/);
  return new URL(page.url()).pathname.slice(1);
}

export async function joinByCode(page: Page, code: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Código da sala').fill(code);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${code}$`));
}
