/** Timeline tab: every task by due date, your own tasks, ways to catch up, calendar links and an .ics export. */
import { useRef, type RefObject } from 'react';
import { buildIcs, calendarUrl, taskCalendarEntry } from '../../domain/calendar.js';
import { formatDate, type IsoDate } from '../../domain/dates.js';
import type { Plan } from '../../domain/plan.js';
import type { ScheduledTask } from '../../domain/timeline.js';
import { downloadText } from '../common/download.js';
import { plural } from '../common/format.js';
import { TaskStatusBadge } from '../common/Labels.js';
import type { PlanControls } from '../dashboard/controls.js';
import { removeCustomTask } from '../../domain/customTasks.js';
import { CustomTaskForm } from './CustomTaskForm.js';
import { compress, setDone } from './taskEdits.js';

/** "3 days to spare", "5 days late", "No days to spare", "Done". */
export function slackText(task: ScheduledTask): string {
  if (task.status === 'done') return 'Done';
  if (task.slack < 0) return `${plural(-task.slack, 'day')} late`;
  return task.slack === 0 ? 'No days to spare' : `${plural(task.slack, 'day')} to spare`;
}

/** Saves the plan's dates as an .ics file the user can import into any calendar. */
export function downloadIcs(plan: Plan, today: IsoDate): void {
  const { title, eventDate } = plan.input.profile;
  const text = buildIcs({ title, eventDate, tasks: plan.schedule.tasks, today });
  downloadText(text, 'bandobast-plan.ics', 'text/calendar');
}

export function TimelinePanel({ controls }: { readonly controls: PlanControls }) {
  const { plan, today } = controls;
  const tasks = plan.schedule.tasks.toSorted((a, b) => a.due.localeCompare(b.due));
  const open = tasks.filter((task) => task.status !== 'done').length;
  const nameRef = useRef<HTMLInputElement>(null);
  return (
    <section aria-labelledby="timeline-title">
      <h2 id="timeline-title">Timeline</h2>
      <p>{`${plural(open, 'open task')}, ${String(plan.schedule.lateCount)} late. Tasks wait for the ones they depend on.`}</p>
      <button
        type="button"
        onClick={() => {
          downloadIcs(plan, today);
        }}
      >
        Download all dates (.ics)
      </button>
      {plan.tips.length > 0 && (
        <section aria-labelledby="catch-up-title" className="catch-up">
          <h3 id="catch-up-title">Ways to catch up</h3>
          <ul>
            {plan.tips.map((tip) => (
              <li key={tip.taskId}>
                <strong>{tip.title}:</strong> {tip.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      <CustomTaskForm controls={controls} nameRef={nameRef} />
      <ol className="task-list">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} controls={controls} nameRef={nameRef} />
        ))}
      </ol>
    </section>
  );
}

interface RowProps {
  readonly task: ScheduledTask;
  readonly controls: PlanControls;
  /** The custom-task name field, focused after a task is removed. */
  readonly nameRef: RefObject<HTMLInputElement | null>;
}

function TaskRow({ task, controls, nameRef }: RowProps) {
  const { plan, today } = controls;
  const id = `task-${task.id}`;
  const critical = task.critical && task.status !== 'done';
  return (
    <li className={`task task-${task.status}`}>
      <div className="task-main">
        <input
          type="checkbox"
          id={id}
          checked={task.status === 'done'}
          onChange={(event) => {
            controls.edit(setDone(plan.input, task.id, event.target.checked, today));
          }}
        />
        <label htmlFor={id}>{task.title}</label> <TaskStatusBadge status={task.status} />
        {task.custom && <span className="badge badge-custom">Your task</span>}
      </div>
      <p className="task-meta">
        {`Due ${formatDate(task.due)} · ${slackText(task)}${critical ? ' · On the critical path' : ''}${task.compressed ? ' · Shortened' : ''}`}
      </p>
      <TaskActions task={task} controls={controls} nameRef={nameRef} />
    </li>
  );
}

function TaskActions({ task, controls, nameRef }: RowProps) {
  const { input } = controls.plan;
  const { title, city } = input.profile;
  return (
    <div className="task-actions">
      {task.savingDays > 0 && task.status === 'late' && (
        <button
          type="button"
          onClick={() => {
            controls.edit(compress(input, task.id));
          }}
        >
          {`Shorten it (saves ${plural(task.savingDays, 'day')})`}
          <span className="visually-hidden">{`: ${task.title}`}</span>
        </button>
      )}
      <a
        href={calendarUrl(taskCalendarEntry(task, title, city))}
        target="_blank"
        rel="noopener noreferrer"
      >
        Add to Google Calendar
        <span className="visually-hidden">{`: ${task.title} (opens in a new tab)`}</span>
      </a>
      {task.custom && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            controls.edit(removeCustomTask(input, task.id));
            nameRef.current?.focus();
          }}
        >
          Remove
          <span className="visually-hidden">{`: ${task.title}`}</span>
        </button>
      )}
    </div>
  );
}
