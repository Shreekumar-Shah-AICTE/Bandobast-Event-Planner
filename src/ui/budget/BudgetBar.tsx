/** The budget split as one bar: the biggest lines, the rest and the reserve. The table has the same numbers. */
import type { BudgetPlan } from '../../domain/budget.js';
import { CATEGORIES } from '../../domain/catalog.js';
import { formatCompact, sumPaise, type Paise } from '../../domain/money.js';

const SHOWN = 5;

interface Slice {
  readonly label: string;
  readonly amount: Paise;
}

/** Biggest lines first, then "Everything else" and "Reserve"; empty slices are left out. O(c log c). */
export function budgetSlices(budget: BudgetPlan): readonly Slice[] {
  const lines = budget.lines.toSorted((a, b) => b.planned - a.planned);
  const top = lines
    .slice(0, SHOWN)
    .map((line) => ({ label: CATEGORIES[line.category].label, amount: line.planned }));
  const rest = {
    label: 'Everything else',
    amount: sumPaise(lines.slice(SHOWN).map((l) => l.planned)),
  };
  const reserve = { label: 'Reserve', amount: budget.contingency };
  return [...top, rest, reserve].filter((slice) => slice.amount > 0);
}

/** Each slice's start and width on a 0–100 scale. O(s). */
function layout(slices: readonly Slice[]) {
  const whole = sumPaise(slices.map((slice) => slice.amount));
  const placed: { slice: Slice; x: number; width: number }[] = [];
  let x = 0;
  for (const slice of slices) {
    const width = whole === 0 ? 0 : (slice.amount / whole) * 100;
    placed.push({ slice, x, width });
    x += width;
  }
  return placed;
}

export function BudgetBar({
  budget,
  legend = true,
}: {
  readonly budget: BudgetPlan;
  /** Without the legend the bar is decoration next to text that says the same. */
  readonly legend?: boolean;
}) {
  const placed = layout(budgetSlices(budget));
  const bar = (
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {placed.map(({ slice, x, width }, index) => (
        <rect key={slice.label} x={x} width={width} height="4" className={`seg-${String(index)}`} />
      ))}
    </svg>
  );
  if (!legend) return <div className="budget-bar">{bar}</div>;
  return (
    <figure className="budget-bar">
      {bar}
      <figcaption>
        <ul className="legend">
          {placed.map(({ slice, width }, index) => (
            <li key={slice.label}>
              <span className={`dot seg-${String(index)}`} aria-hidden="true" />
              {`${slice.label} ${formatCompact(slice.amount)} (${String(Math.round(width))}%)`}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
