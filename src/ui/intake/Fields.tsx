/** Labelled form controls with hints and inline errors wired up for screen readers. */
import type { ChangeEvent } from 'react';

const describedBy = (id: string, hint: boolean, error: boolean): string | undefined => {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter((part) => part !== '');
  return ids.length > 0 ? ids.join(' ') : undefined;
};

interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly type?: 'text' | 'date';
  readonly inputMode?: 'numeric' | 'text';
  readonly maxLength?: number;
  readonly min?: string;
  readonly autoComplete?: string;
}

/** A labelled text input with an optional hint and error, linked by `aria-describedby`. */
export function TextField({ id, label, value, onChange, error, hint, ...rest }: TextFieldProps) {
  return (
    <div className={error === undefined ? 'field' : 'field has-error'}>
      <label htmlFor={id}>{label}</label>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="error-text">
          {error}
        </p>
      )}
      <input
        id={id}
        name={id}
        type={rest.type ?? 'text'}
        value={value}
        inputMode={rest.inputMode}
        maxLength={rest.maxLength}
        min={rest.min}
        autoComplete={rest.autoComplete ?? 'off'}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy(id, hint !== undefined, error !== undefined)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}

/** One choice in a radio or checkbox group. */
export interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface GroupProps<T extends string> {
  readonly name: string;
  readonly legend: string;
  readonly options: readonly Option<T>[];
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

function Legend({ name, legend, hint, error }: Omit<GroupProps<string>, 'options'>) {
  return (
    <>
      <legend>{legend}</legend>
      {hint !== undefined && (
        <p id={`${name}-hint`} className="hint">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${name}-error`} className="error-text">
          {error}
        </p>
      )}
    </>
  );
}

/** Radio buttons; the first option's id is `${name}-${value}` for error links. */
export function ChoiceGroup<T extends string>(
  props: GroupProps<T> & { readonly value: T | null; readonly onChange: (value: T) => void },
) {
  const { name, options, value, onChange, hint, error } = props;
  return (
    <fieldset
      className={error === undefined ? 'field' : 'field has-error'}
      aria-describedby={describedBy(name, hint !== undefined, error !== undefined)}
    >
      <Legend name={name} legend={props.legend} hint={hint} error={error} />
      <div className="choices">
        {options.map((option) => (
          <label key={option.value} className="choice" htmlFor={`${name}-${option.value}`}>
            <input
              id={`${name}-${option.value}`}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Checkboxes; with `max`, unchecked boxes are disabled once that many are chosen. */
export function CheckGroup<T extends string>(
  props: GroupProps<T> & {
    readonly values: readonly T[];
    readonly onChange: (values: T[]) => void;
    readonly max?: number;
  },
) {
  const { name, options, values, onChange, hint, max } = props;
  const full = max !== undefined && values.length >= max;
  const toggle = (value: T, on: boolean) => {
    onChange(on ? [...values, value] : values.filter((entry) => entry !== value));
  };
  return (
    <fieldset className="field" aria-describedby={describedBy(name, hint !== undefined, false)}>
      <Legend name={name} legend={props.legend} hint={hint} />
      <div className="choices">
        {options.map((option) => (
          <label key={option.value} className="choice" htmlFor={`${name}-${option.value}`}>
            <input
              id={`${name}-${option.value}`}
              type="checkbox"
              name={name}
              checked={values.includes(option.value)}
              disabled={full && !values.includes(option.value)}
              onChange={(event) => {
                toggle(option.value, event.target.checked);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
