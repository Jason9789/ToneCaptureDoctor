import { expect, test } from '@playwright/test';

test('requests audio after Start and displays the local input session', async ({ page }) => {
  await page.addInitScript(() => {
    const createTrack = (deviceId: string) => ({
      addEventListener: () => undefined,
      getSettings: () => ({
        autoGainControl: false,
        channelCount: 2,
        deviceId,
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 48_000,
      }),
      removeEventListener: () => undefined,
      stop: () => undefined,
    });

    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        ...originalMediaDevices,
        enumerateDevices: async () => [
          {
            deviceId: 'e2e-interface',
            groupId: 'e2e-group',
            kind: 'audioinput',
            label: 'E2E Instrument Interface',
          },
        ],
        getUserMedia: async () => {
          const track = createTrack('e2e-interface');
          return {
            getAudioTracks: () => [track],
            getTracks: () => [track],
          };
        },
      },
    });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Signal Health' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Signal Health' })).toBeEnabled();

  await page.getByRole('button', { name: 'Start Signal Health' }).click();

  await expect(page.getByRole('status')).toHaveText('Connected');
  await expect(page.getByRole('combobox', { name: 'Choose an audio input' })).toBeVisible();
  await expect(page.getByText('Sample rate')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop Signal Health' })).toBeVisible();

  await page.getByRole('button', { name: 'Stop Signal Health' }).click();
  await expect(page.getByRole('status')).toHaveText('Stopped');
});
