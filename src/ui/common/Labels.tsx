/** Badges and notes that say where a number or an answer came from. */
import type { Feasibility, Provenance } from '../../domain/budget.js';
import type { TaskStatus } from '../../domain/timeline.js';
import type { Reading } from '../../ai/readers.js';
import { CACHED_MODEL } from '../../../shared/aiContracts.js';

/** Words for each provenance badge. */
export const PROVENANCE_LABELS: Readonly<Record<Provenance, string>> = {
  estimate: 'Estimate',
  user: 'Your number',
  quote: 'Quote',
  booked: 'Booked',
};

/** Shows where an amount comes from, in words. */
export function ProvenanceBadge({ provenance }: { readonly provenance: Provenance }) {
  return <span className={`badge badge-${provenance}`}>{PROVENANCE_LABELS[provenance]}</span>;
}

/** Words for each budget check. */
export const FEASIBILITY_LABELS: Readonly<Record<Feasibility, string>> = {
  comfortable: 'Comfortable',
  fits: 'Fits',
  tight: 'Tight',
  over: 'Over budget',
};

/** Shows the budget check, in words. */
export function FeasibilityBadge({ feasibility }: { readonly feasibility: Feasibility }) {
  return <span className={`badge badge-${feasibility}`}>{FEASIBILITY_LABELS[feasibility]}</span>;
}

/** Words for each task status. */
export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  done: 'Done',
  late: 'Late',
  tight: 'Tight',
  ok: 'On track',
};

/** Shows a task's status, in words. */
export function TaskStatusBadge({ status }: { readonly status: TaskStatus }) {
  return <span className={`badge badge-task-${status}`}>{TASK_STATUS_LABELS[status]}</span>;
}

function aiNote(model: string | null): string {
  return model === CACHED_MODEL
    ? 'Read by Gemini earlier (a saved answer for the same text), then checked by code.'
    : `Read by Gemini (${model ?? 'model'}), then checked by code.`;
}

/** "Read by Gemini (model)" or "Read by the built-in rules", plus why. */
export function SourceNote({ reading }: { readonly reading: Reading<unknown> }) {
  const who =
    reading.source === 'ai'
      ? aiNote(reading.model)
      : (reading.note ?? 'Read by the built-in rules.');
  return (
    <p className="source-note">
      <span className={`badge badge-source-${reading.source}`}>
        {reading.source === 'ai' ? 'AI' : 'Rules'}
      </span>{' '}
      {who}
    </p>
  );
}
