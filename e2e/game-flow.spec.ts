import { expect, test, type Page } from '@playwright/test';
import { setDrawInterval } from './support/db';
import { trackCspViolations } from './support/csp';
import { createRoom, joinByCode, newGuest } from './support/players';

/** Células de número da cartela (a casa livre tem aria-label "Casa livre" e fica fora). */
const cardCells = (page: Page) => page.getByRole('button', { name: /^[BINGO] \d+/ });

/** "B 12, marcado" -> "B 12". */
async function cardNumbers(page: Page): Promise<string[]> {
  const labels = await cardCells(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  return labels.map((l) => l.split(',')[0]).sort();
}

/**
 * Toca na próxima casa não marcada, em rodízio. A cartela não mostra o que já saiu (como no bingo real):
 * casa sorteada vira marcada, as outras só avisam "ainda não saiu".
 */
async function tapUnmarked(page: Page, i: number): Promise<void> {
  const cells = cardCells(page).and(page.locator('[aria-pressed="false"]'));
  const n = await cells.count();
  if (n === 0) return;
  await cells.nth(i % n).click();
  await page.waitForTimeout(60);
}

/** Marca todo número já sorteado na cartela de `page`, até o botão BINGO! habilitar. */
async function playUntilBingo(page: Page): Promise<void> {
  const bingo = page.getByRole('button', { name: 'BINGO!' });
  for (let i = 0; i < 3000 && !(await bingo.isEnabled()); i++) await tapUnmarked(page, i);
  await expect(bingo).toBeEnabled();
}

test('partida completa: dois jogadores, vitória validada e ranking sem convidados', async ({ browser }) => {
  const host = await newGuest(browser, 'Ana');
  const guest = await newGuest(browser, 'Beto');
  const csp = trackCspViolations(host.page);

  const code = await createRoom(host.page, 'Sala E2E');
  await joinByCode(guest.page, code);
  await setDrawInterval(code, 300);

  for (const p of [host.page, guest.page]) await p.getByRole('button', { name: /gerar cartela/i }).click();
  await host.page.getByRole('button', { name: 'Iniciar partida' }).click();

  // O BINGO! só existe na tela de jogo (3D ou 2D); o current-number só aparece no 3D.
  await expect(host.page.getByRole('button', { name: 'BINGO!' })).toBeVisible({ timeout: 30_000 });
  await playUntilBingo(host.page);
  await host.page.getByRole('button', { name: 'BINGO!' }).click();

  await expect(host.page.getByText('Você venceu!')).toBeVisible({ timeout: 15_000 });
  await expect(guest.page.getByText('Ana fez BINGO!')).toBeVisible();

  // Convidados não pontuam nem entram no ranking (back: ELIGIBLE.isGuest=false); a página só precisa carregar sem erro de CSP.
  await host.page.goto('/ranking');
  await expect(host.page.getByRole('heading', { name: 'Ranking' })).toBeVisible();
  await expect(host.page.getByText(/Entre com Google e jogue/)).toBeVisible();
  await expect(host.page.getByRole('listitem').filter({ hasText: 'Ana' })).toHaveCount(0);
  expect(csp).toEqual([]);

  await host.context.close();
  await guest.context.close();
});

test('recarregar no meio da partida volta à mesma partida e à mesma cartela', async ({ browser }) => {
  const host = await newGuest(browser, 'Carla');
  const guest = await newGuest(browser, 'Davi');
  const code = await createRoom(host.page, 'Sala Reload');
  await joinByCode(guest.page, code);
  await setDrawInterval(code, 500);
  for (const p of [host.page, guest.page]) await p.getByRole('button', { name: /gerar cartela/i }).click();
  await host.page.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(guest.page.getByRole('button', { name: 'BINGO!' })).toBeVisible({ timeout: 30_000 });

  // Espera um número sorteado, marca-o e guarda a cartela antes do reload.
  const marked = guest.page.locator('button[aria-label$=", marcado"]');
  for (let i = 0; i < 1500 && (await marked.count()) === 0; i++) await tapUnmarked(guest.page, i);
  await expect(marked).toHaveCount(1);
  const markedLabel = ((await guest.page.locator('button[aria-label$=", marcado"]').first().getAttribute('aria-label')) ?? '').split(',')[0];
  const before = await cardNumbers(guest.page);
  expect(before).toHaveLength(24);

  await guest.page.reload();
  await expect(guest.page.getByRole('button', { name: 'BINGO!' })).toBeVisible({ timeout: 30_000 });
  await expect(guest.page).toHaveURL(new RegExp(`/${code}$`));
  expect(await cardNumbers(guest.page)).toEqual(before);
  // A marcação feita antes do reload foi preservada pelo servidor.
  await expect(guest.page.getByRole('button', { name: `${markedLabel}, marcado` })).toBeVisible();

  await host.context.close();
  await guest.context.close();
});

test('@mobile modo 2D (movimento reduzido) joga até o início da partida', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByRole('button', { name: 'Jogar como convidado' }).click();
  await expect(page).toHaveURL(/\/nickname/, { timeout: 30_000 });
  await page.getByLabel('Apelido').fill('Eva');
  await page.getByRole('button', { name: 'Continuar' }).click();
  const code = await createRoom(page, 'Sala 2D');
  await expect(page.getByRole('heading', { name: 'Sala 2D' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('strong', { hasText: code })).toBeVisible();
  await context.close();
});
