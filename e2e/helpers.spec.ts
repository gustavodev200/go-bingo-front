import { expect, test } from '@playwright/test';
import { createRoom, joinByCode, newGuest } from './support/players';

test('dois convidados entram na mesma sala', async ({ browser }) => {
  const host = await newGuest(browser, 'Ana');
  const guest = await newGuest(browser, 'Beto');
  const code = await createRoom(host.page, 'Sala E2E');
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  await joinByCode(guest.page, code);
  await expect(host.page.getByText('Beto')).toBeVisible();
  await expect(guest.page.getByText('Ana')).toBeVisible();
  await host.context.close();
  await guest.context.close();
});
