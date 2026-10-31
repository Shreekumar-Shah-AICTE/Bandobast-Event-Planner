/** Overview tab: what is due next, where the money goes, vendor progress and payments. */
import { CATEGORIES } from '../../domain/catalog.js';
import { formatDate } from '../../domain/dates.js';
import { formatCompact, formatInr } from '../../domain/money.js';
import type { Plan } from '../../domain/plan.js';
import { listText } from '../common/format.js';
import { paymentTotals } from '../vendors/Payments.js';
import { TaskStatusBadge } from '../common/Labels.js';
import type { PlanControls } from './controls.js';

export type TabId = 'overview' | 'budget' | 'timeline' | 'vendors' | 'quotes' | 'ideas' | 'history';

const NEXT_TASKS = 5;
const TOP_LINES = 3;

/** Open tasks, soonest due first. O(t log t). */
export const upcoming = (plan: Plan) =>
  plan.schedule.tasks
    .filter((task) => task.status !== 'done')
    .toSorted((a, b) => a.due.localeCompare(b.due))
    .slice(0, NEXT_TASKS);

const biggest = (plan: Plan): string =>
  listText(
    plan.budget.lines
      .toSorted((a, b) => b.planned - a.planned)
      .slice(0, TOP_LINES)
      .map((line) => `${CATEGORIES[line.category].label} ${formatCompact(line.planned)}`),
  );

interface CardProps {
  readonly id: string;
  readonly title: string;
  readonly go: string;
  readonly onGo: () => void;
  readonly children: React.ReactNode;
}

function Card({ id, title, go, onGo, children }: CardProps) {
  return (
    <article className="card" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
      <button type="button" className="link-button" onClick={onGo}>
        {go}
      </button>
    </article>
  );
}

function NextTasks({ plan }: { readonly plan: Plan }) {
  const next = upcoming(plan);
  if (next.length === 0) return <p>Every task is done.</p>;
  return (
    <ol className="compact-list">
      {next.map((task) => (
        <li key={task.id}>
          {task.title} <span className="hint">{`due ${formatDate(task.due)}`}</span>{' '}
          <TaskStatusBadge status={task.status} />
        </li>
      ))}
    </ol>
  );
}

function Payments({ plan }: { readonly plan: Plan }) {
  const { next, overdue } = plan.payments;
  if (next === null && plan.payments.paid === 0) {
    return <p>No payments yet. Add advances and instalments on each vendor&apos;s card.</p>;
  }
  const vendor = (category: string) =>
    plan.vendors.find((card) => card.category === category)?.vendor ?? category;
  return (
    <>
      <p>{`Payments: ${paymentTotals(plan.payments)}.`}</p>
      {overdue > 0 && <p className="warning-text">{`${formatInr(overdue)} is overdue.`}</p>}
      {next !== null && (
        <p>{`Next: ${next.label} to ${vendor(next.category)}, ${formatInr(next.amountPaise)}, due ${formatDate(next.dueOn)}.`}</p>
      )}
    </>
  );
}

export function Overview({
  controls,
  onGo,
}: {
  readonly controls: PlanControls;
  readonly onGo: (tab: TabId) => void;
}) {
  const { plan } = controls;
  const booked = plan.vendors.filter((card) => card.status === 'booked').length;
  return (
    <section aria-labelledby="overview-title">
      <h2 id="overview-title">Overview</h2>
      <div className="card-grid">
        <Card
          id="next-title"
          title="Coming up"
          go="Open the timeline"
          onGo={() => {
            onGo('timeline');
          }}
        >
          <NextTasks plan={plan} />
        </Card>
        <Card
          id="money-title"
          title="Money"
          go="Open the budget"
          onGo={() => {
            onGo('budget');
          }}
        >
          <p>{`Biggest lines: ${biggest(plan)}.`}</p>
          <p>{`Reserve for surprises: ${formatInr(plan.budget.contingency)}.`}</p>
        </Card>
        <Card
          id="vendors-title"
          title="Vendors"
          go="Open vendors"
          onGo={() => {
            onGo('vendors');
          }}
        >
          <p>{`${String(booked)} of ${String(plan.vendors.length)} booked. ${String(plan.quotes.length)} quotes checked.`}</p>
          <Payments plan={plan} />
        </Card>
      </div>
    </section>
  );
}
