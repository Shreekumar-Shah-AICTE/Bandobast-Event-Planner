import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { weddingProfile } from '../../test/fixtures.js';
import { renderPlan } from '../../test/render.js';

describe('vendors tab', () => {
  it('moves a vendor one step at a time and counts bookings', async () => {
    const { user } = renderPlan(weddingProfile());
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    expect(screen.getByText(/^0 of \d+ booked/)).toBeInTheDocument();
    const status = screen.getByRole('combobox', { name: 'Status of Caterer' });
    expect(within(status).queryByRole('option', { name: 'Booked' })).not.toBeInTheDocument();
    await user.selectOptions(status, 'contacted');
    expect(status).toHaveValue('contacted');
    await user.selectOptions(status, 'quoted');
    await user.selectOptions(status, 'booked');
    expect(screen.getByText(/^1 of \d+ booked/)).toBeInTheDocument();
  });

  it('lists questions to ask and links a Maps search that opens in a new tab', async () => {
    const { user } = renderPlan(weddingProfile());
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    expect(screen.getAllByText(/^Questions to ask \(\d+\)$/).length).toBeGreaterThan(3);
    const link = screen.getAllByRole('link', {
      name: /in Pune on Google Maps \(opens in a new tab\)$/,
    })[0];
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link?.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
  });
});
