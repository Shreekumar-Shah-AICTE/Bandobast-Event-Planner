import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CACHED_MODEL } from '../../../shared/aiContracts.js';
import { SourceNote } from './Labels.js';

describe('SourceNote', () => {
  it('names the Gemini model that read the text', () => {
    render(
      <SourceNote reading={{ source: 'ai', value: null, model: 'gemini-test', note: null }} />,
    );
    expect(
      screen.getByText(/Read by Gemini \(gemini-test\), then checked by code\./),
    ).toBeVisible();
  });

  it('says when the answer was saved from an earlier identical request', () => {
    render(<SourceNote reading={{ source: 'ai', value: null, model: CACHED_MODEL, note: null }} />);
    expect(
      screen.getByText(/Read by Gemini earlier \(a saved answer for the same text\)/),
    ).toBeVisible();
  });

  it('says when the built-in rules read the text, and why', () => {
    render(
      <SourceNote reading={{ source: 'rules', value: null, model: null, note: 'AI is busy.' }} />,
    );
    expect(screen.getByText('Rules')).toBeVisible();
    expect(screen.getByText(/AI is busy\./)).toBeVisible();
  });
});
