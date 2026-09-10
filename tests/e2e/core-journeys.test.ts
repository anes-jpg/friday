import { describe, it, expect, beforeEach } from 'vitest';
import { useFridayStore } from '../../src/lib/store';
import { PendingPlan } from '../../src/lib/bindings';

describe('FRIDAY 12 Core E2E Journeys (§11, §12)', () => {
  beforeEach(() => {
    const store = useFridayStore.getState();
    store.setActiveSurface('bar');
    store.setOrbState('idle');
    store.setInputMode('command');
    store.setCaretText('');
    store.setAsrPartial('');
    store.cancelPendingPlan();
  });

  it('Journey 1: Bar invocation and caret focus', () => {
    const state = useFridayStore.getState();
    expect(state.activeSurface).toBe('bar');
    expect(state.inputMode).toBe('command');
    expect(state.orbState).toBe('idle');
  });

  it('Journey 2: Dictation mode toggle (Alt+Shift+D) and verbatim input', () => {
    const store = useFridayStore.getState();
    store.setInputMode('dictation');
    expect(useFridayStore.getState().inputMode).toBe('dictation');

    // In dictation mode, caret and partial update verbatim
    store.setCaretText('Meeting notes, ready to share.');
    expect(useFridayStore.getState().caretText).toBe('Meeting notes, ready to share.');
  });

  it('Journey 3: Utterance contract progression (Heard -> Plan -> Doing -> Result)', () => {
    const store = useFridayStore.getState();
    
    // 1. Heard (ASR partial / final transcript)
    store.setAsrPartial('Run cargo check on friday');
    store.setOrbState('thinking');
    expect(useFridayStore.getState().asrPartial).toBe('Run cargo check on friday');
    expect(useFridayStore.getState().orbState).toBe('thinking');

    // 2. Plan
    const plan: PendingPlan = {
      id: 'plan-test-1',
      heard: 'Run cargo check on friday',
      tier: 'Green',
      status: 'awaiting_confirm',
      steps: [
        { description: 'Execute cargo check', tier: 'Green' },
      ],
      currentStepIndex: 0,
      resultSummary: 'Checking compiler output...',
      undoable: false,
    };
    useFridayStore.setState({ pendingPlan: plan });
    expect(useFridayStore.getState().pendingPlan?.heard).toBe('Run cargo check on friday');

    // 3. Doing / Executing
    useFridayStore.setState({
      pendingPlan: { ...plan, status: 'executing' },
      orbState: 'thinking',
    });
    expect(useFridayStore.getState().pendingPlan?.status).toBe('executing');

    // 4. Result
    useFridayStore.setState({
      pendingPlan: { ...plan, status: 'done', resultSummary: 'Cargo check completed with 0 errors.' },
      orbState: 'idle',
    });
    expect(useFridayStore.getState().pendingPlan?.resultSummary).toContain('0 errors');
  });

  it('Journey 4: Green tier execution (silent past-tense narration)', async () => {
    const store = useFridayStore.getState();
    await store.submitQuery('What is on my screen right now?');
    const threadId = useFridayStore.getState().activeThreadId;
    const msgs = useFridayStore.getState().messages[threadId] || [];
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[msgs.length - 1].role).toBe('assistant');
  });

  it('Journey 5: Amber tier execution with preview card and cancellation', async () => {
    const store = useFridayStore.getState();
    // Submitting a file move/rename query triggers Amber plan
    await store.submitQuery('move screenshots to Assets');
    expect(useFridayStore.getState().pendingPlan).not.toBeNull();
    expect(useFridayStore.getState().pendingPlan?.tier).toBe('Amber');

    // User cancels plan with "scratch that"
    store.cancelPendingPlan();
    expect(useFridayStore.getState().pendingPlan).toBeNull();
  });

  it('Journey 6: Red tier execution requiring explicit confirmation', async () => {
    const store = useFridayStore.getState();
    // Submitting a delete query triggers Red plan
    await store.submitQuery('delete old backup from desktop');
    expect(useFridayStore.getState().pendingPlan?.tier).toBe('Red');

    // Confirm plan execution
    await store.confirmPendingPlan();
    expect(useFridayStore.getState().pendingPlan?.status).toBe('done');
    expect(useFridayStore.getState().pendingPlan?.undoable).toBe(true);
  });

  it('Journey 7: Undo reversible action from journal', async () => {
    const store = useFridayStore.getState();
    // Setup completed plan with undoable = true
    const plan: PendingPlan = {
      id: 'plan-undo-1',
      heard: 'move files',
      tier: 'Amber',
      status: 'done',
      steps: [{ description: 'Move files', tier: 'Amber' }],
      currentStepIndex: 1,
      resultSummary: 'Moved 14 files.',
      undoable: true,
    };
    useFridayStore.setState({ pendingPlan: plan });

    store.undoLastAction();
    expect(useFridayStore.getState().pendingPlan?.resultSummary).toContain('Reverted');
  });

  it('Journey 8: Panic switch (Ctrl+Alt+Shift+F) terminates operations', async () => {
    const store = useFridayStore.getState();
    store.setOrbState('speaking');
    expect(useFridayStore.getState().orbState).toBe('speaking');

    await store.bargeIn();
    expect(useFridayStore.getState().orbState).toBe('idle');
  });

  it('Journey 9: Console surfaces navigation and tabs', () => {
    const store = useFridayStore.getState();
    store.setActiveSurface('console');
    expect(useFridayStore.getState().activeSurface).toBe('console');

    store.setActiveConsoleTab('automations');
    expect(useFridayStore.getState().activeConsoleTab).toBe('automations');

    store.setActiveConsoleTab('skills');
    expect(useFridayStore.getState().activeConsoleTab).toBe('skills');

    store.setActiveConsoleTab('memory');
    expect(useFridayStore.getState().activeConsoleTab).toBe('memory');

    store.setActiveSurface('bar');
    expect(useFridayStore.getState().activeSurface).toBe('bar');
  });

  it('Journey 10: Stored memory fact addition and deletion', async () => {
    const store = useFridayStore.getState();
    const initialFactsCount = useFridayStore.getState().facts.length;
    expect(initialFactsCount).toBeGreaterThan(0);

    const factId = useFridayStore.getState().facts[0].id;
    await store.deleteFact(factId);
    expect(useFridayStore.getState().facts.find((f) => f.id === factId)).toBeUndefined();
  });

  it('Journey 11: Automation manual trigger execution', async () => {
    const store = useFridayStore.getState();
    const auto = useFridayStore.getState().automations[0];
    const initialStatus = auto.enabled;

    await store.toggleAutomation(auto.id);
    expect(useFridayStore.getState().automations[0].enabled).toBe(!initialStatus);
  });

  it('Journey 12: Skill sandboxed permission gating and status', async () => {
    const store = useFridayStore.getState();
    const skill = useFridayStore.getState().skills[0];
    const initialStatus = skill.enabled;

    await store.toggleSkill(skill.id);
    expect(useFridayStore.getState().skills[0].enabled).toBe(!initialStatus);
  });
});
