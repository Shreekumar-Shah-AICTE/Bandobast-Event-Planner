/** The intake form's two groups of fields. */
import { LIMITS } from '../../../shared/limits.js';
import { AUDIENCE, DIETS, EVENT_TYPES, STYLES } from '../../../shared/schemas.js';
import { AUDIENCE_LABELS, CATEGORIES, DIET_LABELS, STYLE_LABELS } from '../../domain/catalog.js';
import { addDays, type IsoDate } from '../../domain/dates.js';
import { formatInr } from '../../domain/money.js';
import { templateFor } from '../../domain/templates/index.js';
import { capitalise, EVENT_LABELS } from '../common/format.js';
import { CheckGroup, ChoiceGroup, TextField } from './Fields.js';
import { parseBudget, type FieldError, type FieldName, type FormValues } from './form.js';

interface FieldsProps {
  readonly values: FormValues;
  readonly onChange: (patch: Partial<FormValues>) => void;
}

const errorFor = (errors: readonly FieldError[], field: FieldName): string | undefined =>
  errors.find((error) => error.field === field)?.message;

function budgetHint(text: string): string {
  const amount = parseBudget(text);
  const reads = amount === null ? '' : ` Reads as ${formatInr(amount)}.`;
  return `For example 12 lakh, 5L or ₹3,50,000.${reads}`;
}

type EventProps = FieldsProps & { readonly errors: readonly FieldError[] };

function Basics({ values, errors, onChange }: EventProps) {
  return (
    <>
      <ChoiceGroup
        name="eventType"
        legend="What are you planning?"
        options={EVENT_TYPES.map((type) => ({ value: type, label: EVENT_LABELS[type] }))}
        value={values.eventType}
        error={errorFor(errors, 'eventType')}
        onChange={(eventType) => {
          onChange({ eventType, priorities: [] });
        }}
      />
      <TextField
        id="field-title"
        label="Name of the plan"
        value={values.title}
        maxLength={LIMITS.maxTitleLength}
        error={errorFor(errors, 'title')}
        onChange={(title) => {
          onChange({ title });
        }}
      />
      <TextField
        id="field-city"
        label="City or town"
        value={values.city}
        maxLength={LIMITS.maxCityLength}
        autoComplete="address-level2"
        error={errorFor(errors, 'city')}
        onChange={(city) => {
          onChange({ city });
        }}
      />
    </>
  );
}

function Size({ values, errors, today, onChange }: EventProps & { readonly today: IsoDate }) {
  return (
    <>
      <TextField
        id="field-eventDate"
        label="Date of the event"
        type="date"
        min={addDays(today, 1)}
        value={values.eventDate}
        error={errorFor(errors, 'eventDate')}
        onChange={(eventDate) => {
          onChange({ eventDate });
        }}
      />
      <TextField
        id="field-guests"
        label="Number of guests"
        inputMode="numeric"
        value={values.guests}
        error={errorFor(errors, 'guests')}
        onChange={(guests) => {
          onChange({ guests });
        }}
      />
      <TextField
        id="field-budget"
        label="Total budget"
        hint={budgetHint(values.budget)}
        value={values.budget}
        error={errorFor(errors, 'budget')}
        onChange={(budget) => {
          onChange({ budget });
        }}
      />
    </>
  );
}

/** The event fields: type, title, city, date, guests and budget. */
export function EventFields(props: EventProps & { readonly today: IsoDate }) {
  return (
    <>
      <Basics {...props} />
      <Size {...props} />
    </>
  );
}

/** The preference fields: priorities, diet, audience and style. */
export function PreferenceFields({ values, onChange }: FieldsProps) {
  const categories = values.eventType === null ? [] : templateFor(values.eventType).categories;
  return (
    <>
      {categories.length > 0 && (
        <CheckGroup
          name="priorities"
          legend="What matters most?"
          hint={`Pick up to ${String(LIMITS.maxPriorities)}. These get protected when money is tight.`}
          max={LIMITS.maxPriorities}
          options={categories.map(({ id }) => ({ value: id, label: CATEGORIES[id].label }))}
          values={values.priorities}
          onChange={(priorities) => {
            onChange({ priorities });
          }}
        />
      )}
      <CheckGroup
        name="audience"
        legend="Who is coming?"
        options={AUDIENCE.map((need) => ({ value: need, label: AUDIENCE_LABELS[need] }))}
        values={values.audience}
        onChange={(audience) => {
          onChange({ audience });
        }}
      />
      <ChoiceGroup
        name="diet"
        legend="Food"
        options={DIETS.map((diet) => ({ value: diet, label: capitalise(DIET_LABELS[diet]) }))}
        value={values.diet}
        onChange={(diet) => {
          onChange({ diet });
        }}
      />
      <ChoiceGroup
        name="style"
        legend="Style"
        options={STYLES.map((style) => ({ value: style, label: STYLE_LABELS[style] }))}
        value={values.style}
        onChange={(style) => {
          onChange({ style });
        }}
      />
    </>
  );
}
