/** Event title and the four facts that matter at a glance. */
import { daysBetween, formatDate, type IsoDate } from '../../domain/dates.js';
import { formatInr, type Paise } from '../../domain/money.js';
import type { Plan } from '../../domain/plan.js';
import { EVENT_LABELS, plural } from '../common/format.js';
import { FeasibilityBadge } from '../common/Labels.js';

/** "Short by ₹50,000" or "₹1,20,000 to spare", against typical costs plus the reserve. */
export const gapText = (gap: Paise): string =>
  gap > 0 ? `Short by ${formatInr(gap)} against typical costs` : `${formatInr(-gap)} to spare`;

const timeLeft = (today: IsoDate, date: IsoDate): string => {
  const days = daysBetween(today, date);
  if (days > 0) return `${plural(days, 'day')} to go`;
  return days === 0 ? 'Today is the day' : 'The event date has passed';
};

/** The plan's header: the event, the time left, the budget check, late tasks and vendors booked. */
export function PlanHeader({ plan, today }: { readonly plan: Plan; readonly today: IsoDate }) {
  const { profile } = plan.input;
  const booked = plan.vendors.filter((card) => card.status === 'booked').length;
  return (
    <header className="plan-header">
      <h1 id="plan-title" tabIndex={-1}>
        {profile.title}
      </h1>
      <p className="plan-meta">
        {EVENT_LABELS[profile.eventType]} · {profile.city} · {formatDate(profile.eventDate)} ·{' '}
        {plural(profile.guests, 'guest')} · {formatInr(profile.budgetPaise)}
      </p>
      <dl className="facts">
        <div>
          <dt>Time left</dt>
          <dd>{timeLeft(today, profile.eventDate)}</dd>
        </div>
        <div>
          <dt>Budget check</dt>
          <dd>
            <FeasibilityBadge feasibility={plan.budget.feasibility} /> {gapText(plan.budget.gap)}
          </dd>
        </div>
        <div>
          <dt>Late tasks</dt>
          <dd>{plan.schedule.lateCount === 0 ? 'None' : String(plan.schedule.lateCount)}</dd>
        </div>
        <div>
          <dt>Vendors booked</dt>
          <dd>{`${String(booked)} of ${String(plan.vendors.length)}`}</dd>
        </div>
      </dl>
    </header>
  );
}
