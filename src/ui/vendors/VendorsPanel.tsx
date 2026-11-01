/** Vendors tab: a card per vendor with status, what to ask for, questions, payments and a Maps search. */
import type { VendorStatus } from '../../../shared/schemas.js';
import { mapsSearchUrl } from '../../domain/calendar.js';
import { CATEGORIES } from '../../domain/catalog.js';
import { formatInr } from '../../domain/money.js';
import { nextStatuses, STATUS_LABELS, type VendorCard } from '../../domain/vendors.js';
import { plural } from '../common/format.js';
import type { PlanControls } from '../dashboard/controls.js';
import { VendorPaymentsBlock } from './Payments.js';

export function VendorsPanel({ controls }: { readonly controls: PlanControls }) {
  const { vendors } = controls.plan;
  const booked = vendors.filter((card) => card.status === 'booked').length;
  return (
    <section aria-labelledby="vendors-panel-title">
      <h2 id="vendors-panel-title">Vendors</h2>
      <p>{`${String(booked)} of ${String(vendors.length)} booked. Status moves one step at a time: to contact, contacted, quote received, booked.`}</p>
      <ul className="card-grid">
        {vendors.map((card) => (
          <VendorItem key={card.category} card={card} controls={controls} />
        ))}
      </ul>
    </section>
  );
}

function VendorItem({
  card,
  controls,
}: {
  readonly card: VendorCard;
  readonly controls: PlanControls;
}) {
  const { input } = controls.plan;
  const search = CATEGORIES[card.category].search;
  const quotes = card.quoteCount > 0 ? ` · ${plural(card.quoteCount, 'quote')}` : '';
  return (
    <li className={`card vendor vendor-${card.status}`}>
      <h3>{card.vendor}</h3>
      <p className="hint">{`${card.label} · planned ${formatInr(card.planned)}${quotes}`}</p>
      <StatusSelect
        card={card}
        onChange={(status) => {
          controls.edit({ ...input, vendors: { ...input.vendors, [card.category]: status } });
        }}
      />
      <h4>What to ask for</h4>
      <ul>
        {card.requirements.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
      <details>
        <summary>{`Questions to ask (${String(card.questions.length)})`}</summary>
        <ul>
          {card.questions.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </details>
      <VendorPaymentsBlock category={card.category} vendor={card.vendor} controls={controls} />
      {search !== null && (
        <a
          className="target-link"
          href={mapsSearchUrl(search, input.profile.city)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {`Find ${search} in ${input.profile.city} `}
          <span className="visually-hidden">on Google Maps (opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}

interface StatusSelectProps {
  readonly card: VendorCard;
  readonly onChange: (status: VendorStatus) => void;
}

/** Only the current status and the ones reachable in one step are offered. */
function StatusSelect({ card, onChange }: StatusSelectProps) {
  const id = `status-${card.category}`;
  return (
    <>
      <label htmlFor={id}>
        Status <span className="visually-hidden">of {card.vendor}</span>
      </label>
      <select
        id={id}
        value={card.status}
        onChange={(event) => {
          onChange(event.target.value as VendorStatus);
        }}
      >
        {[card.status, ...nextStatuses(card.status)].map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </>
  );
}
