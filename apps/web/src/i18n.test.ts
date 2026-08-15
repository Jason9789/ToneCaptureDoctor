import { afterEach, describe, expect, it } from 'vitest';

import { getInitialLocale, LOCALE_STORAGE_KEY, persistLocale } from './i18n';

describe('locale selection', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('prefers a stored supported locale', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ko');

    expect(getInitialLocale()).toBe('ko');
  });

  it('persists a supported locale for the next session', () => {
    persistLocale('en');

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });
});
