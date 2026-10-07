import { expect, test } from '@playwright/test';
import { createRoom, joinByCode, newGuest } from './support/players';

test('só o host vê "Iniciar partida"', async ({ browser }) => {
  const host = await newGuest(browser, 'Fabi');
  const guest = await newGuest(browser, 'Gil');
  const code = await createRoom(host.page, 'Sala Host');
  await joinByCode(guest.page, code);
  await expect(host.page.getByRole('button', { name: /iniciar partida|aguardando/i })).toBeVisible();
  await expect(guest.page.getByRole('button', { name: /iniciar partida|aguardando/i })).toHaveCount(0);
  await expect(guest.page.getByRole('button', { name: 'Sair da sala' })).toBeVisible();
  await host.context.close();
  await guest.context.close();
});

test('código inexistente não derruba o app e mostra erro', async ({ browser }) => {
  const { page, context } = await newGuest(browser, 'Hugo');
  await page.goto('/ZZZZZZ');
  await expect(page.getByRole('alert').filter({ hasText: 'Sala não encontrada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible();
  await context.close();
});

test('rota protegida sem sessão redireciona ao login preservando o destino', async ({ page }) => {
  await page.goto('/create');
  await expect(page).toHaveURL(/\/login\?next=%2Fcreate/);
});
