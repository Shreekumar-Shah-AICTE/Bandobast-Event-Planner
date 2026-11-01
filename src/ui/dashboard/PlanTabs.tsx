/** The plan's sections as tabs. Overview links jump to a tab and move focus to it. */
import { useEffect, useRef, useState } from 'react';
import type { PlanAction, PlanState } from '../../state/planState.js';
import { BudgetPanel } from '../budget/BudgetPanel.js';
import { Tabs, type TabSpec } from '../common/Tabs.js';
import { HistoryPanel } from '../history/HistoryPanel.js';
import { IdeasPanel } from '../ideas/IdeasPanel.js';
import { QuotesPanel } from '../quotes/QuotesPanel.js';
import { TimelinePanel } from '../timeline/TimelinePanel.js';
import { VendorsPanel } from '../vendors/VendorsPanel.js';
import type { PlanControls } from './controls.js';
import { Overview, type TabId } from './Overview.js';

interface PlanTabsProps {
  readonly controls: PlanControls;
  readonly state: PlanState;
  readonly dispatch: (action: PlanAction) => void;
}

const count = (value: number, word: string): string | undefined =>
  value > 0 ? `(${String(value)} ${word})` : undefined;

function tabsFor(controls: PlanControls, state: PlanState): TabSpec<TabId>[] {
  const { plan } = controls;
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'budget', label: 'Budget' },
    { id: 'timeline', label: 'Timeline', note: count(plan.schedule.lateCount, 'late') },
    { id: 'vendors', label: 'Vendors' },
    { id: 'quotes', label: 'Quotes', note: count(plan.quotes.length, 'saved') },
    { id: 'ideas', label: 'Ideas' },
    { id: 'history', label: 'History', note: count(state.versions.length, 'saved') },
  ];
}

export function PlanTabs({ controls, state, dispatch }: PlanTabsProps) {
  const [tab, setTab] = useState<TabId>('overview');
  const focusTab = useRef(false);
  useEffect(() => {
    if (!focusTab.current) return;
    focusTab.current = false;
    document.getElementById(`tab-${tab}`)?.focus();
  }, [tab]);
  const go = (id: TabId) => {
    focusTab.current = true;
    setTab(id);
  };
  return (
    <Tabs label="Plan sections" tabs={tabsFor(controls, state)} selected={tab} onSelect={setTab}>
      <Panel tab={tab} controls={controls} state={state} dispatch={dispatch} onGo={go} />
    </Tabs>
  );
}

function Panel(props: PlanTabsProps & { readonly tab: TabId; readonly onGo: (id: TabId) => void }) {
  const { tab, controls, state, dispatch } = props;
  switch (tab) {
    case 'overview':
      return <Overview controls={controls} onGo={props.onGo} />;
    case 'budget':
      return <BudgetPanel controls={controls} />;
    case 'timeline':
      return <TimelinePanel controls={controls} />;
    case 'vendors':
      return <VendorsPanel controls={controls} />;
    case 'quotes':
      return <QuotesPanel controls={controls} />;
    case 'ideas':
      return <IdeasPanel profile={controls.plan.input.profile} />;
    case 'history':
      return <HistoryPanel state={state} today={controls.today} dispatch={dispatch} />;
  }
}
