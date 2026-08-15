import { expect, test } from '@playwright/test';

test('installs the production service worker and reloads the shell offline', async ({
  context,
  page,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers are not available in this browser.');
    }
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Signal Health' })).toBeVisible();

  const cachedShell = await page.evaluate(async () => {
    const keys = await caches.keys();
    return keys.find((key) => key.startsWith('tone-capture-doctor-shell-')) ?? null;
  });
  expect(cachedShell).toBe('tone-capture-doctor-shell-v2');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Signal Health' })).toBeVisible();
  await context.setOffline(false);
});
