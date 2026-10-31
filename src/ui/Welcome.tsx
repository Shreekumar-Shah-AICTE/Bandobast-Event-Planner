/** First screen: what Bandobast does, and two ways to start. */
import { useFocusOnMount } from './common/hooks.js';

interface WelcomeProps {
  readonly onStart: () => void;
  readonly onSample: () => void;
}

export function Welcome({ onStart, onSample }: WelcomeProps) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <h1 id="welcome-title" ref={heading} tabIndex={-1}>
        Plan your celebration, and keep the plan true when things change
      </h1>
      <p className="lead">
        Weddings, birthdays, anniversaries and community events: a budget split for your guest
        count, a timeline that knows what depends on what, vendor checklists with questions to ask,
        and quote checks for hidden charges.
      </p>
      <div className="actions">
        <button type="button" className="primary" onClick={onStart}>
          Start a new plan
        </button>
        <button type="button" onClick={onSample}>
          Try the sample: Riya &amp; Arjun&apos;s wedding, Pune
        </button>
      </div>
      <ul className="feature-list">
        <li>
          <strong>Change Test.</strong> Type &ldquo;50 more guests, budget down 10%, event 2 weeks
          earlier&rdquo; and see what moved, what is now late, and ways to rebalance.
        </li>
        <li>
          <strong>Every rupee labelled.</strong> Estimate, Your number, Quote or Booked, so you know
          which numbers are firm.
        </li>
        <li>
          <strong>AI that is checked.</strong> Gemini reads your words and pasted quotes; code does
          the maths and rejects anything not found in what you wrote.
        </li>
      </ul>
    </section>
  );
}
