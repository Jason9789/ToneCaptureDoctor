import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('Signal Health shell', () => {
  it('shows the local-first placeholder dashboard without requesting audio', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'ToneCaptureDoctor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Signal Health' })).toBeInTheDocument();
    expect(screen.getByText('No audio input connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Signal Health' })).toBeDisabled();
  });
});
