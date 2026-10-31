/** The sections of the Impact Report. Each renders nothing when its part did not change. */
import { CATEGORIES } from '../../domain/catalog.js';
import { formatDate } from '../../domain/dates.js';
import type { ImpactReport } from '../../domain/diff.js';
import { formatDelta, formatInr } from '../../domain/money.js';
import type { CompressionTip } from '../../domain/timeline.js';
import { listText, plural } from '../common/format.js';
import { FeasibilityBadge, ProvenanceBadge } from '../common/Labels.js';

interface ReportProps {
  readonly report: ImpactReport;
}

/** "₹96,000 → ₹1,04,000", or "₹96,000 (unchanged)". O(1). */
export const fromTo = (before: string, after: string): string =>
  before === after ? `${after} (unchanged)` : `${before} → ${after}`;

export function ProfileChanges({ report }: ReportProps) {
  const { guests, budget, eventDate, feasibility, contingency } = report;
  return (
    <ul className="impact-facts">
      {guests !== null && <li>{`Guests: ${String(guests.before)} → ${String(guests.after)}`}</li>}
      {budget !== null && (
        <li>{`Budget: ${formatInr(budget.before)} → ${formatInr(budget.after)}`}</li>
      )}
      {eventDate !== null && (
        <li>{`Event date: ${formatDate(eventDate.before)} → ${formatDate(eventDate.after)}`}</li>
      )}
      <li>
        Budget check:{' '}
        {feasibility.before === feasibility.after ? (
          <>
            <FeasibilityBadge feasibility={feasibility.after} /> (unchanged)
          </>
        ) : (
          <>
            <FeasibilityBadge feasibility={feasibility.before} /> →{' '}
            <FeasibilityBadge feasibility={feasibility.after} />
          </>
        )}
      </li>
      <li>{`Reserve for surprises: ${fromTo(formatInr(contingency.before), formatInr(contingency.after))}`}</li>
      {report.movedTasks > 0 && (
        <li>{`${plural(report.movedTasks, 'task')} moved to new dates`}</li>
      )}
    </ul>
  );
}

export function LineChanges({ report }: ReportProps) {
  if (report.lines.length === 0 && report.untouched.length === 0) return null;
  return (
    <>
      {report.lines.length > 0 && (
        <table className="data-table">
          <caption>Budget lines that moved</caption>
          <thead>
            <tr>
              <th scope="col">Line</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
              <th scope="col">Change</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((line) => (
              <tr key={line.category}>
                <th scope="row">{CATEGORIES[line.category].label}</th>
                <td className="num">{formatInr(line.before)}</td>
                <td className="num">{formatInr(line.after)}</td>
                <td className="num">{formatDelta(line.after - line.before)}</td>
                <td>
                  <ProvenanceBadge provenance={line.provenance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {report.untouched.length > 0 && (
        <p>
          Kept as you set them:{' '}
          {listText(report.untouched.map((category) => CATEGORIES[category].label))}.
        </p>
      )}
    </>
  );
}

interface TaskChangesProps extends ReportProps {
  readonly tips: readonly CompressionTip[];
  readonly onShorten: (taskId: string) => void;
}

export function TaskChanges({ report, tips, onShorten }: TaskChangesProps) {
  const { newlyLate, newlyTight, recovered } = report;
  return (
    <>
      {newlyLate.length > 0 && (
        <div className="impact-tasks">
          <h3>Now late</h3>
          <ul>
            {newlyLate.map((task) => (
              <LateTask
                key={task.id}
                title={task.title}
                tip={tips.find((t) => t.taskId === task.id)}
                onShorten={onShorten}
              />
            ))}
          </ul>
        </div>
      )}
      {newlyTight.length > 0 && (
        <p>{`Now tight: ${listText(newlyTight.map((task) => task.title))}.`}</p>
      )}
      {recovered.length > 0 && (
        <p>{`Back on track: ${listText(recovered.map((task) => task.title))}.`}</p>
      )}
    </>
  );
}

interface LateTaskProps {
  readonly title: string;
  readonly tip: CompressionTip | undefined;
  readonly onShorten: (taskId: string) => void;
}

function LateTask({ title, tip, onShorten }: LateTaskProps) {
  return (
    <li>
      <strong>{title}</strong>
      {tip !== undefined && (
        <>
          {`: ${tip.text} `}
          <button
            type="button"
            onClick={() => {
              onShorten(tip.taskId);
            }}
          >
            {`Shorten it (saves ${plural(tip.savingDays, 'day')})`}
            <span className="visually-hidden">{`: ${title}`}</span>
          </button>
          {!tip.clears && <span className="hint"> Still late after this.</span>}
        </>
      )}
    </li>
  );
}

export function QuoteChanges({ report }: ReportProps) {
  if (report.quotes.length === 0) return null;
  return (
    <p>
      {'Quote totals for the new guest count: '}
      {report.quotes
        .map((q) => `${q.vendorName} ${formatInr(q.before)} → ${formatInr(q.after)}`)
        .join('; ')}
      .
    </p>
  );
}
