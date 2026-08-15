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
  await page.locator('#language-select').selectOption('ko');
  await expect(page.getByText('로컬 우선 오디오 진단')).toBeVisible();
  await page.locator('#language-select').selectOption('en');
  await expect(page.getByRole('button', { name: 'Start Signal Health' })).toBeEnabled();

  await page.getByRole('button', { name: 'Start Signal Health' }).click();

  await expect(page.getByRole('status')).toHaveText('Connected');
  await expect(page.getByRole('combobox', { name: 'Choose an audio input' })).toBeVisible();
  await expect(page.getByText('Sample rate', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop Signal Health' })).toBeVisible();

  await page.getByRole('button', { name: 'Stop Signal Health' }).click();
  await expect(page.getByRole('status')).toHaveText('Stopped');
});

test('keeps the dashboard usable at compact widths and updates document language', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);

  await page.locator('#language-select').selectOption('ko');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page.getByRole('region', { name: 'Dry/Wet Doctor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Signal Health 시작' })).toBeVisible();
});

test('migrates a legacy IndexedDB snapshot without marking it comparable', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('tone-capture-doctor-local');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('tone-capture-doctor-local', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('snapshots', { keyPath: 'id' });
        request.result.createObjectStore('test-sessions', { keyPath: 'sessionId' });
        const events = request.result.createObjectStore('test-events', { keyPath: 'eventId' });
        events.createIndex('sessionId', 'sessionId', { unique: false });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('snapshots', 'readwrite');
        transaction.objectStore('snapshots').put({
          algorithmVersion: '0.1.0',
          channelCount: 1,
          createdAt: '2026-08-16T00:00:00.000Z',
          endSample: 2_048,
          fftSize: 2_048,
          id: 'legacy-e2e',
          label: 'Legacy E2E snapshot',
          metrics: {
            clippingCandidate: false,
            crestFactorDb: null,
            dominantFrequencyHz: null,
            humConfidence: null,
            humFrequencyHz: null,
            noiseFloorConfidence: null,
            noiseFloorDbfs: -60,
            peakDbfs: -12,
            rmsDbfs: -18,
            sampleCount: 2_048,
            sampleRate: 48_000,
          },
          notes: 'legacy fixture',
          sampleRate: 48_000,
          schemaVersion: 1,
          sessionId: 'legacy-session',
          spectrum: [0.1, 0.2],
          startSample: 0,
          waveform: [0, 0.1],
          window: 'hann',
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });

  await page.goto('/');
  const migrated = await page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open('tone-capture-doctor-local');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const read = database
            .transaction('snapshots', 'readonly')
            .objectStore('snapshots')
            .get('legacy-e2e');
          read.onerror = () => reject(read.error);
          read.onsuccess = () => {
            database.close();
            resolve(read.result);
          };
        };
      }),
  );
  expect(migrated).toMatchObject({
    comparisonStatus: 'legacy-uncomparable',
    schemaVersion: 1,
  });
});
