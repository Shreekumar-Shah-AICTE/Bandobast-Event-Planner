/** First screen: what Bandobast does, and the ways to start. */
import type { Persisted } from '../domain/storage.js';
import { OpenPlanFile } from './common/PlanFile.js';

interface WelcomeProps {
  readonly onStart: () => void;
  readonly onSample: () => void;
  readonly onOpen: (saved: Persisted) => void;
}

const FEATURES = [
  {
    icon: '⇄',
    title: 'Change Test.',
    text: 'Type “50 more guests, budget down 10%, event 2 weeks earlier” and see what moved, what is now late, and ways to rebalance.',
  },
  {
    icon: '₹',
    title: 'Every rupee labelled.',
    text: 'Estimate, Your number, Quote or Booked, so you know which numbers are firm.',
  },
  {
    icon: '✓',
    title: 'Vendors and payments.',
    text: 'Checklists and questions for each vendor, quotes checked for hidden charges, and advances tracked against bookings.',
  },
  {
    icon: 'AI',
    title: 'AI that is checked.',
    text: 'Gemini reads your words and pasted quotes; code does the maths and rejects anything not found in what you wrote.',
  },
] as const;

/** The first screen: start a new plan, try the sample wedding, or open a saved plan file. */
export function Welcome({ onStart, onSample, onOpen }: WelcomeProps) {
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="hero">
        <h1 id="welcome-title" tabIndex={-1}>
          Plan your celebration, and keep the plan true when things change
        </h1>
        <p className="lead">
          Weddings, birthdays, anniversaries and community events: a budget split for your guest
          count, a timeline that knows what depends on what, vendor checklists with questions to
          ask, and quote checks for hidden charges.
        </p>
        <div className="actions">
          <button type="button" className="primary" onClick={onStart}>
            Start a new plan
          </button>
          <button type="button" className="ghost" onClick={onSample}>
            Try the sample: Riya &amp; Arjun&apos;s wedding, Pune
          </button>
        </div>
      </div>
      <div className="actions returning">
        <p className="hint">Saved a plan on another device? Open its file here.</p>
        <OpenPlanFile onOpen={onOpen} />
      </div>
      <ul className="feature-grid">
        {FEATURES.map(({ icon, title, text }) => (
          <li key={title} className="feature">
            <span className="feature-icon" aria-hidden="true">
              {icon}
            </span>
            <strong>{title}</strong> {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
