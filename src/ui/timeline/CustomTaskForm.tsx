/** "Add your own task": a name and a due date; the task joins the timeline with the built-in ones. */
import { useState, type Ref, type SyntheticEvent } from 'react';
import { LIMITS } from '../../../shared/limits.js';
import { addCustomTask } from '../../domain/customTasks.js';
import type { PlanControls } from '../dashboard/controls.js';

export function CustomTaskForm({
  controls,
  nameRef,
}: {
  readonly controls: PlanControls;
  /** Takes focus back after a task is added or removed. */
  readonly nameRef: Ref<HTMLInputElement>;
}) {
  const [draft, setDraft] = useState({ title: '', dueOn: '' });
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const result = addCustomTask(controls.plan.input, draft, controls.today);
    setProblem(result.ok ? null : result.error);
    if (!result.ok) return;
    controls.edit(result.value);
    setDraft({ title: '', dueOn: '' });
  };
  return (
    <form className="inline-form custom-task-form" onSubmit={submit} aria-label="Add your own task">
      <label htmlFor="custom-task-title">Your task</label>
      <input
        id="custom-task-title"
        ref={nameRef}
        value={draft.title}
        maxLength={LIMITS.maxTitleLength}
        placeholder="Book the mehendi artist"
        onChange={(event) => {
          setDraft({ ...draft, title: event.target.value });
        }}
      />
      <label htmlFor="custom-task-due">Due on</label>
      <input
        id="custom-task-due"
        type="date"
        min={controls.today}
        value={draft.dueOn}
        onChange={(event) => {
          setDraft({ ...draft, dueOn: event.target.value });
        }}
      />
      <button type="submit">Add task</button>
      {problem !== null && (
        <p className="error-text" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}
