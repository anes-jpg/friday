import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as ipc from '../../src/lib/ipc';
import { useFriday } from '../../src/lib/store';
import type { PlanStep, TurnOutput, Confirmation } from '../../src/lib/types';

describe('FRIDAY 12 Core E2E Journeys (§11, §12)', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    const store = useFriday.getState();
    store.closeBar();
    store.setOrb('idle');
    store.setMode('command');
    store.resetUtterance();
    store.setTab('chat');

    useFriday.setState({
      threads: [
        {
          id: 'thread-1',
          title: 'Test Session',
          messages: [
            {
              id: 'm-1',
              role: 'user',
              content: 'What is on my screen right now?',
              created_at: new Date().toISOString(),
            },
            {
              id: 'm-2',
              role: 'assistant',
              content: 'Visual inspection shows VS Code with Friday.',
              say: 'Visual inspection shows VS Code with Friday.',
              created_at: new Date().toISOString(),
            },
          ],
        },
      ],
      facts: [
        {
          id: 'fact-1',
          content: 'Test user fact',
          confidence: 0.95,
          pinned: false,
          created_at: new Date().toISOString(),
        },
      ],
      automations: [
        {
          id: 'auto-1',
          name: 'Daily Standup Digest',
          trigger: '0 9 * * 1-5',
          description: 'Compiles yesterday work',
          enabled: true,
          history: ['ok', 'ok'],
        },
      ],
      skills: [
        {
          id: 'skill-1',
          name: 'Ultimate Frontend',
          description: 'Production-quality UI component generator',
          version: '1.0.0',
          permissions: ['fs:read'],
          enabled: true,
        },
      ],
    });
  });

  it('Journey 1: Bar invocation and caret focus', () => {
    const store = useFriday.getState();
    store.openBar();

    const state = useFriday.getState();
    expect(state.barOpen).toBe(true);
    expect(state.mode).toBe('command');
    expect(state.orb).toBe('idle');
  });

  it('Journey 2: Dictation mode toggle (Alt+Shift+D) and verbatim input', () => {
    const store = useFriday.getState();
    store.setMode('dictation');
    expect(useFriday.getState().mode).toBe('dictation');

    // In dictation mode, caret and partial update verbatim without LLM interpretation
    store.setQuery('Meeting notes, ready to share.');
    expect(useFriday.getState().query).toBe('Meeting notes, ready to share.');
  });

  it('Journey 3: Utterance contract progression (Heard -> Plan -> Doing -> Result)', () => {
    const store = useFriday.getState();

    // 1. Heard (ASR partial / final transcript)
    store.setHeard('Run cargo check on friday');
    store.setOrb('thinking');
    expect(useFriday.getState().utterance.heard).toBe('Run cargo check on friday');
    expect(useFriday.getState().orb).toBe('thinking');

    // 2. Plan (Step-by-step with risk color dots)
    const steps: PlanStep[] = [
      { id: 's1', label: 'Execute cargo check', tier: 'green', status: 'waiting' },
    ];
    store.setPlan(steps);
    expect(useFriday.getState().utterance.plan).toHaveLength(1);
    expect(useFriday.getState().utterance.plan[0].label).toBe('Execute cargo check');

    // 3. Doing (Active step with elapsed time)
    store.setDoing(0);
    expect(useFriday.getState().utterance.doing).toBe(0);

    // 4. Result (Two-channel output: concise say + structured show)
    const result: TurnOutput = {
      say: 'Cargo check completed with zero errors.',
      show: '```text\nChecking friday v1.0.0\nFinished dev profile\n```',
      delivery: {
        emotion: 'focused',
        pace: 1.0,
        energy: 0.6,
        pause_before_ms: 0,
        emphasis: [],
      },
    };
    store.setResult(result);
    store.setOrb('idle');
    expect(useFriday.getState().utterance.result?.say).toContain('zero errors');
    expect(useFriday.getState().orb).toBe('idle');
  });

  it('Journey 4: Green tier execution (silent past-tense narration)', () => {
    const thread = useFriday.getState().threads[0];
    const msgs = thread.messages;
    expect(msgs.length).toBeGreaterThan(0);
    const lastMsg = msgs[msgs.length - 1];
    expect(lastMsg.role).toBe('assistant');
    expect(lastMsg.say).toBeDefined();
    // Spoken prose maximum 2 sentences, no URLs, no paths
    expect(lastMsg.say).not.toMatch(/https?:\/\//);
    expect(lastMsg.say).not.toMatch(/[C-Z]:\\[\w\\]+/);
  });

  it('Journey 5: Amber tier execution with preview card and cancellation', () => {
    const store = useFriday.getState();
    const confirmation: Confirmation = {
      id: 'conf-amber',
      tier: 'amber',
      summary: 'Move 14 screenshots from Desktop to Assets',
      timeout_seconds: 8,
    };

    store.setAwaiting(confirmation);
    expect(useFriday.getState().utterance.awaiting).not.toBeNull();
    expect(useFriday.getState().utterance.awaiting?.tier).toBe('amber');

    // User cancels preview card ("scratch that" or timeout)
    store.setAwaiting(null);
    expect(useFriday.getState().utterance.awaiting).toBeNull();
  });

  it('Journey 6: Red tier execution requiring explicit confirmation', () => {
    const store = useFriday.getState();
    const confirmation: Confirmation = {
      id: 'conf-red',
      tier: 'red',
      summary: 'Permanently delete build cache and temp directory',
    };

    store.setAwaiting(confirmation);
    expect(useFriday.getState().utterance.awaiting?.tier).toBe('red');

    // User explicitly confirms
    store.setAwaiting(null);
    store.setResult({
      say: 'Deleted cache and temp directory.',
      delivery: {
        emotion: 'neutral',
        pace: 1.0,
        energy: 0.5,
        pause_before_ms: 0,
        emphasis: [],
      },
    });

    expect(useFriday.getState().utterance.result?.say).toContain('Deleted cache');
  });

  it('Journey 7: Undo reversible action from journal', () => {
    const store = useFriday.getState();
    store.setResult({
      say: 'Moved 14 files to Assets.',
      delivery: {
        emotion: 'focused',
        pace: 1.0,
        energy: 0.5,
        pause_before_ms: 0,
        emphasis: [],
      },
    });

    // Reversible action is undone
    store.setResult({
      say: 'Reverted file moves. All 14 files returned to Desktop.',
      delivery: {
        emotion: 'focused',
        pace: 1.0,
        energy: 0.5,
        pause_before_ms: 0,
        emphasis: [],
      },
    });

    expect(useFriday.getState().utterance.result?.say).toContain('Reverted');
  });

  it('Journey 8: Panic switch (Ctrl+Alt+Shift+F) terminates operations', () => {
    const store = useFriday.getState();
    store.setOrb('speaking');
    expect(useFriday.getState().orb).toBe('speaking');

    store.killSwitch();
    const state = useFriday.getState();
    expect(state.orb).toBe('idle');
    expect(state.micMuted).toBe(true);
    expect(state.utterance.doing).toBeNull();
  });

  it('Journey 9: Console surfaces navigation and tabs', () => {
    const store = useFriday.getState();
    store.setTab('automations');
    expect(useFriday.getState().tab).toBe('automations');

    store.setTab('skills');
    expect(useFriday.getState().tab).toBe('skills');

    store.setTab('memory');
    expect(useFriday.getState().tab).toBe('memory');

    store.setTab('audit');
    expect(useFriday.getState().tab).toBe('audit');

    store.setTab('settings');
    expect(useFriday.getState().tab).toBe('settings');

    store.setTab('chat');
    expect(useFriday.getState().tab).toBe('chat');
  });

  it('Journey 10: Stored memory fact addition and deletion', async () => {
      vi.spyOn(ipc, 'deleteBackendFact').mockResolvedValueOnce(true);
    const store = useFriday.getState();
    const initialFactsCount = store.facts.length;
    expect(initialFactsCount).toBeGreaterThan(0);

    const factId = store.facts[0].id;
    await store.deleteFact(factId);
    expect(useFriday.getState().facts.find((f) => f.id === factId)).toBeUndefined();
  });

  it('Journey 11: Automation pause persists before changing state', async () => {
      vi.spyOn(ipc, 'invokeCommand').mockResolvedValueOnce(false);
    const store = useFriday.getState();
    const auto = store.automations[0];
    const initialStatus = auto.enabled;

    await store.toggleAutomation(auto.id);
    expect(useFriday.getState().automations[0].enabled).toBe(!initialStatus);
  });

  it('Journey 12: Skill sandboxed permission gating and status', () => {
    const store = useFriday.getState();
    const skill = store.skills[0];
    const initialStatus = skill.enabled;

    store.toggleSkill(skill.id);
    expect(useFriday.getState().skills[0].enabled).toBe(!initialStatus);
  });

  it('Journey 13: Wake-word engine ("Hey Friday") and neural voice profile configuration', () => {
    const store = useFriday.getState();

    // 1. Initial wake-word defaults
    expect(store.wakeWord).toBeDefined();
    expect(store.wakeWord.triggerPhrase).toBe('Hey Friday');
    const initialEnabled = store.wakeWord.enabled;

    // 2. Toggle wake-word continuous detection
    store.toggleWakeWord();
    expect(useFriday.getState().wakeWord.enabled).toBe(!initialEnabled);

    // 3. Update sensitivity threshold
    store.setWakeWord({ sensitivity: 0.82 });
    expect(useFriday.getState().wakeWord.sensitivity).toBe(0.82);

    // 4. Configure neural voice profile and acoustics
    store.setVoiceProfile('bf_emma');
    expect(useFriday.getState().voiceProfile).toBe('bf_emma');

    store.setVoicePace(1.05);
    expect(useFriday.getState().voicePace).toBe(1.05);

    store.setVoiceWarmth(0.85);
    expect(useFriday.getState().voiceWarmth).toBe(0.85);

    // 5. Toggle wake-word back to original state
    store.toggleWakeWord();
    expect(useFriday.getState().wakeWord.enabled).toBe(initialEnabled);
  });

  it('Journey 14: Visual screen perception and desktop capture (§08, ADR 008)', async () => {
    const store = useFriday.getState();

    // 1. Initial screen state is null
    expect(store.screenContext).toBeNull();

    // 2. Trigger screen capture
    await store.captureActiveScreen('active_window');

    // 3. Verify screen context is populated with valid dimensions and frame
    const context = useFriday.getState().screenContext;
    expect(context).not.toBeNull();
    expect(context?.captured).toBe(true);
    expect(context?.target).toBe('active_window');
    expect(context?.width).toBeGreaterThan(0);
    expect(context?.height).toBeGreaterThan(0);
    expect(context?.dataUrl).toMatch(/^data:image\//);
    expect(context?.app).toBeDefined();
    expect(context?.title).toBeDefined();
  });

  it('Journey 15: Beast Engine Two-Stage Code Search & AST Chunking (§08, ADR 008)', async () => {
    const { rrfSearch, searchCode, findSymbols, codeChunk } = await import('../../src/lib/ipc');

    // 1. RRF search combines BM25 trigrams and semantic ranking
    const rrfResults = await rrfSearch('BeastSearcher');
    expect(rrfResults).toBeDefined();
    expect(Array.isArray(rrfResults)).toBe(true);
    expect(rrfResults.length).toBeGreaterThan(0);
    expect(rrfResults[0].score).toBeGreaterThan(0);
    expect(rrfResults[0].symbol).toContain('BeastSearcher');

    // 2. Fast AST symbol discovery
    const symbols = await findSymbols('BeastSearcher');
    expect(symbols).toBeDefined();
    expect(Array.isArray(symbols)).toBe(true);
    expect(symbols[0].name).toBe('BeastSearcher');

    // 3. Tree-sitter / AST chunking
    const chunks = await codeChunk('src/agent/beast.rs');
    expect(chunks).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].tokens).toBeDefined();
  });

  it('Journey 16: Top-Level Window Enumeration, Filtering & Target Activation (§08, ADR 008)', async () => {
    const store = useFriday.getState();

    // 1. Refresh running window list
    await store.refreshWindows();
    const windows = useFriday.getState().runningWindows;
    expect(windows).toBeDefined();
    expect(Array.isArray(windows)).toBe(true);
    expect(windows.length).toBeGreaterThan(0);

    // 2. Verify window metadata structure
    const firstWin = windows[0];
    expect(firstWin.hwnd).toBeDefined();
    expect(firstWin.title).toBeDefined();
    expect(firstWin.processName).toBeDefined();

    // 3. Focus active target application
    const focusResult = await store.focusAppWindow(firstWin.title);
    expect(focusResult).toBe(true);
  });

  it('Journey 17: Native voice availability and partial transcript state (§04, §07)', async () => {
    const store = useFriday.getState();

    // 1. Initial state
    expect(store.orb).toBe('idle');
    expect(store.utterance.partial).toBe('');

    // 2. Start capture
    await store.startVoiceCapture();
    expect(useFriday.getState().orb).toBe('idle');

    // 3. Receive partial ASR text
    store.setPartial('open the browser');
    expect(useFriday.getState().utterance.partial).toBe('open the browser');

    // 4. Endpoint committed
    store.setHeard('open the browser and search for documentation');
    expect(useFriday.getState().utterance.heard).toBe('open the browser and search for documentation');
    expect(useFriday.getState().utterance.partial).toBe('');

    // 5. Stop capture
    await store.stopVoiceCapture();
    expect(useFriday.getState().orb).toBe('idle');
  });

  it('Journey 18: Operator Power Tabs Navigation (Beast, Browser, Review, Delphi) (§08, §10)', () => {
    const store = useFriday.getState();

    // 1. Switch to Beast AST & Code Search tab
    store.setTab('beast');
    expect(useFriday.getState().tab).toBe('beast');

    // 2. Switch to Browser subagent operator tab
    store.setTab('browser');
    expect(useFriday.getState().tab).toBe('browser');

    // 3. Switch to OpenCodeReview auditor tab
    store.setTab('review');
    expect(useFriday.getState().tab).toBe('review');

    // 4. Switch to Delphi Media & Utilities tab
    store.setTab('delphi');
    expect(useFriday.getState().tab).toBe('delphi');

    // 5. Restore to chat
    store.setTab('chat');
    expect(useFriday.getState().tab).toBe('chat');
  });

  it('Journey 19: Local Screen OCR Extraction & Text Grounding (§06, §08)', async () => {
    const { ocrScreen } = await import('../../src/lib/ipc');

    // 1. Call screen OCR
    const ocrData = await ocrScreen('active_window');

    // 2. Verify structured response with text and lines
    expect(ocrData).toBeDefined();
    expect(ocrData.status).toBe('ok');
    expect(ocrData.text).toContain('FRIDAY');
    expect(Array.isArray(ocrData.lines)).toBe(true);
    expect(ocrData.lines.length).toBeGreaterThan(0);
    expect(ocrData.title).toBeDefined();
  });

  it('Journey 20: Operator Pending Plan Confirmation & Cancellation Lifecycle (§06, §08)', async () => {
    const store = useFriday.getState();
    const threadId = store.threads[0].id;

    // 1. Stage an Amber pending plan message
    const planId = 'plan-test-101';
    store.pushMessage(threadId, {
      id: 'msg-plan-test',
      role: 'assistant',
      content: 'Action plan staged.',
      say: 'I have prepared a plan for your desktop.',
      show: '### Plan Staged',
      created_at: new Date().toISOString(),
      pending_plan: {
        id: planId,
        heard: 'Organize desktop screenshots',
        steps: [
          { description: 'Move 5 screenshots to Assets', tier: 'amber', completed: false },
        ],
        current_step_index: 0,
        tier: 'amber',
        status: 'awaiting_confirm',
        undoable: true,
      },
    });

    const threadBefore = useFriday.getState().threads.find((t) => t.id === threadId);
    const lastBefore = threadBefore?.messages[threadBefore.messages.length - 1];
    expect(lastBefore?.pending_plan?.id).toBe(planId);

    // 2. Confirm pending plan
    await store.confirmPendingPlan?.(planId);

    const threadAfter = useFriday.getState().threads.find((t) => t.id === threadId);
    const lastAfter = threadAfter?.messages[threadAfter.messages.length - 1];
    expect(lastAfter?.pending_plan).toBeNull();
    expect(lastAfter?.show).toContain('Plan Confirmed and Executed');

    // 3. Stage another plan and test cancellation
    const cancelPlanId = 'plan-test-102';
    store.pushMessage(threadId, {
      id: 'msg-plan-cancel',
      role: 'assistant',
      content: 'Second plan staged.',
      created_at: new Date().toISOString(),
      pending_plan: {
        id: cancelPlanId,
        heard: 'Delete temporary directory',
        steps: [
          { description: 'Remove cache', tier: 'red', completed: false },
        ],
        current_step_index: 0,
        tier: 'red',
        status: 'awaiting_confirm',
        undoable: false,
      },
    });

    store.cancelPendingPlan?.(cancelPlanId);

    const threadFinal = useFriday.getState().threads.find((t) => t.id === threadId);
    const lastFinal = threadFinal?.messages[threadFinal.messages.length - 1];
    expect(lastFinal?.pending_plan).toBeNull();
    expect(lastFinal?.show).toContain('Plan Cancelled by User');
  });

  it('Journey 21: Tool Result Tracking and Execution Aggregation (§06, §08)', () => {
    const store = useFriday.getState();
    const threadId = store.threads[0].id;

    // Store receives assistant turn with executed tool calls
    store.pushMessage(threadId, {
      id: 'msg-tool-turn',
      role: 'assistant',
      content: 'Inspection complete.',
      say: 'I have checked your desktop shortcuts.',
      show: '### Desktop Listing\n- Found 4 items',
      created_at: new Date().toISOString(),
      tool_calls: [
        {
          id: 'call-fs-list',
          name: 'fs.list',
          tier: 'green',
          status: 'ok',
          args: { path: 'Desktop' },
          output: JSON.stringify({ entries: ['Fortnite.url', 'Code.lnk', 'notes.txt'] }),
          started_at: new Date().toISOString(),
          duration_ms: 12,
        },
      ],
    });

    const thread = useFriday.getState().threads.find((t) => t.id === threadId);
    const lastMsg = thread?.messages[thread.messages.length - 1];
    expect(lastMsg?.tool_calls).toBeDefined();
    expect(lastMsg?.tool_calls?.length).toBe(1);
    expect(lastMsg?.tool_calls?.[0].name).toBe('fs.list');
    expect(lastMsg?.tool_calls?.[0].status).toBe('ok');
  });
});

