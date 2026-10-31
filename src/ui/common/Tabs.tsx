/** WAI-ARIA tabs with automatic activation: arrow keys, Home and End move between tabs. */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { at } from '../../domain/access.js';

export interface TabSpec<T extends string> {
  readonly id: T;
  readonly label: string;
  /** Short count or warning shown after the label, e.g. "2 late". */
  readonly note?: string | undefined;
}

interface TabsProps<T extends string> {
  readonly label: string;
  readonly tabs: readonly TabSpec<T>[];
  readonly selected: T;
  readonly onSelect: (id: T) => void;
  readonly children: ReactNode;
}

const KEY_STEP: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };

/** Index of the tab a key moves to, or null for other keys. O(1). */
export function targetIndex(key: string, index: number, count: number): number | null {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = KEY_STEP[key];
  return step === undefined ? null : (index + step + count) % count;
}

interface TabButtonProps<T extends string> {
  readonly tab: TabSpec<T>;
  readonly selected: boolean;
  readonly register: (id: T, element: HTMLButtonElement | null) => void;
  readonly onSelect: (id: T) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function TabButton<T extends string>({
  tab,
  selected,
  register,
  onSelect,
  onKeyDown,
}: TabButtonProps<T>) {
  return (
    <button
      ref={(element) => {
        register(tab.id, element);
      }}
      type="button"
      role="tab"
      id={`tab-${tab.id}`}
      aria-selected={selected}
      aria-controls={`panel-${tab.id}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => {
        onSelect(tab.id);
      }}
      onKeyDown={onKeyDown}
    >
      {tab.label}
      {tab.note !== undefined && (
        <>
          {' '}
          <span className="tab-note">{tab.note}</span>
        </>
      )}
    </button>
  );
}

export function Tabs<T extends string>({
  label,
  tabs,
  selected,
  onSelect,
  children,
}: TabsProps<T>) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = targetIndex(event.key, index, tabs.length);
    if (next === null) return;
    event.preventDefault();
    const tab = at(tabs, next);
    onSelect(tab.id);
    buttons.current.get(tab.id)?.focus();
  };
  const register = (id: T, element: HTMLButtonElement | null) => {
    if (element !== null) buttons.current.set(id, element);
  };
  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tablist">
        {tabs.map((tab, index) => (
          <TabButton
            key={tab.id}
            tab={tab}
            selected={tab.id === selected}
            register={register}
            onSelect={onSelect}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          />
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${selected}`}
        aria-labelledby={`tab-${selected}`}
        className="tabpanel"
      >
        {children}
      </div>
    </div>
  );
}
