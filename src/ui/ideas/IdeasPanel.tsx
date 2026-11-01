/** Ideas tab: curated ideas ranked for these guests, steerable, plus checked ideas from Gemini. */
import { useMemo, useState } from 'react';
import { REFINEMENTS, type EventProfile } from '../../../shared/schemas.js';
import { moreIdeas, type Reading } from '../../ai/readers.js';
import { CATEGORIES } from '../../domain/catalog.js';
import { suggestIdeas, type Idea, type Refinement } from '../../domain/ideas.js';
import { costText } from '../common/format.js';
import { useAsk } from '../common/hooks.js';
import { SourceNote } from '../common/Labels.js';

export const REFINEMENT_LABELS: Readonly<Record<Refinement, string>> = {
  cheaper: 'Cheaper',
  traditional: 'More traditional',
  kids: 'Kid-friendly',
  elders: 'Elder-friendly',
  eco: 'Eco-friendly',
};

const SHOWN = 8;

export function IdeasPanel({ profile }: { readonly profile: EventProfile }) {
  const [refinement, setRefinement] = useState<Refinement | null>(null);
  const [extra, setExtra] = useState<readonly Idea[]>([]);
  const ask = useAsk<Reading<readonly Idea[]>>();
  const library = useMemo(
    () => suggestIdeas(profile, refinement).slice(0, SHOWN),
    [profile, refinement],
  );
  const shown = [...library, ...extra];
  const refine = (next: Refinement) => {
    ask.clear();
    setRefinement(refinement === next ? null : next);
    setExtra([]);
  };
  const more = async () => {
    const reading = await ask.run((signal) => moreIdeas(profile, refinement, shown, signal));
    if (reading !== null) setExtra((current) => [...current, ...reading.value]);
  };
  return (
    <section aria-labelledby="ideas-title">
      <h2 id="ideas-title">Ideas</h2>
      <Refinements selected={refinement} onToggle={refine} />
      <ul className="card-grid">
        {shown.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </ul>
      <button type="button" disabled={ask.busy} aria-busy={ask.busy} onClick={() => void more()}>
        {ask.busy ? 'Asking Gemini…' : 'More ideas from Gemini'}
      </button>
      <div role="status" className="status-area">
        {ask.result !== null && <IdeasNote reading={ask.result} />}
      </div>
    </section>
  );
}

function IdeasNote({ reading }: { readonly reading: Reading<readonly Idea[]> }) {
  return (
    <>
      {reading.source === 'ai' && (
        <p>
          {reading.value.length === 0
            ? 'No new idea passed the checks this time.'
            : `Added ${String(reading.value.length)} ideas from Gemini.`}
        </p>
      )}
      <SourceNote reading={reading} />
    </>
  );
}

interface RefinementsProps {
  readonly selected: Refinement | null;
  readonly onToggle: (refinement: Refinement) => void;
}

function Refinements({ selected, onToggle }: RefinementsProps) {
  return (
    <div className="examples" role="group" aria-labelledby="refine-label">
      <span id="refine-label">Show ideas that are:</span>
      {REFINEMENTS.map((refinement) => (
        <button
          key={refinement}
          type="button"
          className="chip"
          aria-pressed={selected === refinement}
          onClick={() => {
            onToggle(refinement);
          }}
        >
          {REFINEMENT_LABELS[refinement]}
        </button>
      ))}
    </div>
  );
}

function IdeaCard({ idea }: { readonly idea: Idea }) {
  const cost = costText(idea.costLevel);
  return (
    <li className="card idea">
      <h3>{idea.title}</h3>
      <p>{idea.description}</p>
      <p className="hint">
        {CATEGORIES[idea.category].label} · <span aria-hidden="true">{cost.signs}</span>
        <span className="visually-hidden">{cost.words}</span>
        {idea.source === 'ai' && (
          <>
            {' '}
            <span className="badge badge-source-ai">From Gemini, checked</span>
          </>
        )}
      </p>
    </li>
  );
}
