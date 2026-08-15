import { expect, test } from '@playwright/test';

test('loads the Signal Health placeholder dashboard', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Signal Health' })).toBeVisible();
  await expect(page.getByText('No audio input connected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Signal Health' })).toBeDisabled();
});
