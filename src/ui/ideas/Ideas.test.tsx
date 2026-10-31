import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aiOk, mockAi } from '../../test/ai.js';
import { weddingProfile } from '../../test/fixtures.js';
import { renderPlan } from '../../test/render.js';

const openIdeas = async () => {
  const view = renderPlan(weddingProfile());
  await view.user.click(screen.getByRole('tab', { name: 'Ideas' }));
  return view;
};

const fresh = {
  title: 'Marigold welcome arch',
  description: 'Fresh marigold strings at the entrance for photos with elders.',
  category: 'decor',
  costLevel: 1,
  tags: ['traditional'],
};

describe('ideas tab', () => {
  it('steers the ideas with one refinement at a time', async () => {
    const { user } = await openIdeas();
    const cheaper = screen.getByRole('button', { name: 'Cheaper' });
    expect(cheaper).toHaveAttribute('aria-pressed', 'false');
    await user.click(cheaper);
    expect(cheaper).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Kid-friendly' }));
    expect(cheaper).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Kid-friendly' }));
    expect(screen.getByRole('button', { name: 'Kid-friendly' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('adds checked ideas from Gemini and marks them', async () => {
    mockAi(() => aiOk({ ideas: [fresh] }));
    const { user } = await openIdeas();
    await user.click(screen.getByRole('button', { name: 'More ideas from Gemini' }));
    expect(await screen.findByText('Added 1 ideas from Gemini.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marigold welcome arch' })).toBeInTheDocument();
    expect(screen.getByText('From Gemini, checked')).toBeInTheDocument();
  });

  it('says when no new idea passed the checks', async () => {
    mockAi(() => aiOk({ ideas: [{ ...fresh, description: 'Call Raj Decor on 98765 43210.' }] }));
    const { user } = await openIdeas();
    await user.click(screen.getByRole('button', { name: 'More ideas from Gemini' }));
    expect(await screen.findByText('No new idea passed the checks this time.')).toBeInTheDocument();
  });

  it('explains when the AI is not available', async () => {
    const { user } = await openIdeas();
    await user.click(screen.getByRole('button', { name: 'More ideas from Gemini' }));
    expect(await screen.findByText(/The AI is not available right now/)).toBeInTheDocument();
  });
});
