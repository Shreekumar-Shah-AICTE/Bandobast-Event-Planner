/** New plan: an optional description box, then a short form with clear error messages. */
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import type { EventProfile } from '../../../shared/schemas.js';
import type { IsoDate } from '../../domain/dates.js';
import { useFocusOnMount } from '../common/hooks.js';
import { DescribeBox } from './DescribeBox.js';
import { EventFields, PreferenceFields } from './IntakeFields.js';
import { EMPTY_FORM, fillFrom, validate, type FieldError, type FormValues } from './form.js';

interface IntakeProps {
  readonly today: IsoDate;
  readonly onDone: (profile: EventProfile) => void;
  readonly onCancel: () => void;
}

/** Id of the control each error links to. */
export const fieldId = (field: FieldError['field']): string =>
  field === 'eventType' ? 'eventType-wedding' : `field-${field}`;

function ErrorSummary({ errors }: { readonly errors: readonly FieldError[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
  }, [errors]);
  return (
    <div
      ref={box}
      className="error-summary"
      role="alert"
      tabIndex={-1}
      aria-labelledby="errors-title"
    >
      <h2 id="errors-title">
        {errors.length === 1 ? 'Please fix 1 thing' : `Please fix ${String(errors.length)} things`}
      </h2>
      <ul>
        {errors.map((error) => (
          <li key={error.field}>
            <a href={`#${fieldId(error.field)}`}>{error.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Intake({ today, onDone, onCancel }: IntakeProps) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<readonly FieldError[]>([]);
  const change = (patch: Partial<FormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const result = validate(values, today);
    if (result.profile === null) setErrors(result.errors);
    else onDone(result.profile);
  };
  return (
    <section className="intake" aria-labelledby="intake-title">
      <h1 id="intake-title" ref={heading} tabIndex={-1}>
        Tell us about your event
      </h1>
      <DescribeBox
        today={today}
        onRead={(draft) => {
          setValues((current) => fillFrom(current, draft));
        }}
      />
      <form className="panel" aria-labelledby="form-title" noValidate onSubmit={submit}>
        <h2 id="form-title">The details</h2>
        {errors.length > 0 && <ErrorSummary errors={errors} />}
        <EventFields values={values} errors={errors} today={today} onChange={change} />
        <PreferenceFields values={values} onChange={change} />
        <div className="actions">
          <button type="submit" className="primary">
            Make my plan
          </button>
          <button type="button" onClick={onCancel}>
            Back
          </button>
        </div>
      </form>
    </section>
  );
}
