import { describe, it, expect, beforeEach } from "vitest";
import { useFridayStore } from "./store";

describe("FRIDAY Zustand Store Suite", () => {
  beforeEach(() => {
    const store = useFridayStore.getState();
    store.setActiveSurface("bar");
    store.setPaletteOpen(false);
    store.setOrbState("idle");
    store.setInputMode("command");
    store.setCaretText("");
    store.setAsrPartial("");
    store.cancelPendingPlan();
  });

  it("initializes with the correct defaults", () => {
    const state = useFridayStore.getState();
    expect(state.activeSurface).toBe("bar");
    expect(state.paletteOpen).toBe(false);
    expect(state.orbState).toBe("idle");
    expect(state.inputMode).toBe("command");
    expect(state.threads.length).toBeGreaterThan(0);
  });

  it("transitions surfaces properly between Bar and Console", () => {
    const store = useFridayStore.getState();
    store.setActiveSurface("console");
    expect(useFridayStore.getState().activeSurface).toBe("console");

    store.setActiveSurface("bar");
    expect(useFridayStore.getState().activeSurface).toBe("bar");
  });

  it("updates orb states correctly", () => {
    const store = useFridayStore.getState();
    store.setOrbState("listening");
    expect(useFridayStore.getState().orbState).toBe("listening");

    store.setOrbState("thinking");
    expect(useFridayStore.getState().orbState).toBe("thinking");

    store.setOrbState("speaking");
    expect(useFridayStore.getState().orbState).toBe("speaking");

    store.setOrbState("idle");
    expect(useFridayStore.getState().orbState).toBe("idle");
  });

  it("cycles input modes properly", () => {
    const store = useFridayStore.getState();
    store.setInputMode("dictation");
    expect(useFridayStore.getState().inputMode).toBe("dictation");

    store.setInputMode("conversation");
    expect(useFridayStore.getState().inputMode).toBe("conversation");

    store.setInputMode("command");
    expect(useFridayStore.getState().inputMode).toBe("command");
  });

  it("handles fact deletion from memory", async () => {
    const store = useFridayStore.getState();
    const initialCount = store.facts.length;
    const targetFact = store.facts[0];
    expect(targetFact).toBeDefined();

    await store.deleteFact(targetFact.id);
    const updated = useFridayStore.getState().facts;
    expect(updated.length).toBe(initialCount - 1);
    expect(updated.find((f) => f.id === targetFact.id)).toBeUndefined();
  });

  it("toggles automations and skills", async () => {
    const store = useFridayStore.getState();
    const targetAuto = store.automations[0];
    const initialEnabled = targetAuto.enabled;

    await store.toggleAutomation(targetAuto.id);
    expect(useFridayStore.getState().automations.find((a) => a.id === targetAuto.id)?.enabled).toBe(!initialEnabled);

    const targetSkill = store.skills[0];
    const initialSkillEnabled = targetSkill.enabled;
    await store.toggleSkill(targetSkill.id);
    expect(useFridayStore.getState().skills.find((s) => s.id === targetSkill.id)?.enabled).toBe(!initialSkillEnabled);
  });

  it("loads backend data from IPC into store", async () => {
    const store = useFridayStore.getState();
    await store.loadBackendData();
    expect(useFridayStore.getState().facts.length).toBeGreaterThan(0);
    expect(useFridayStore.getState().automations.length).toBeGreaterThan(0);
    expect(useFridayStore.getState().skills.length).toBeGreaterThan(0);
  });

  it("updates GLM configurations", () => {
    const store = useFridayStore.getState();
    store.updateGlmSettings({
      heavyModel: "glm-4-custom",
      dailySpendCapUsd: 25.0,
      baseUrl: "https://custom-glm.internal/api/v4",
    });

    const settings = useFridayStore.getState().glmSettings;
    expect(settings.heavyModel).toBe("glm-4-custom");
    expect(settings.dailySpendCapUsd).toBe(25.0);
    expect(settings.baseUrl).toBe("https://custom-glm.internal/api/v4");
  });

  it("handles Amber plan confirmation and undo cycle", async () => {
    const store = useFridayStore.getState();
    await store.submitQuery("rename every screenshot on my desktop to its date and move them to Assets");

    const pending = useFridayStore.getState().pendingPlan;
    expect(pending).not.toBeNull();
    expect(pending?.tier).toBe("Amber");
    expect(pending?.status).toBe("awaiting_confirm");

    await store.confirmPendingPlan();
    const confirmed = useFridayStore.getState().pendingPlan;
    expect(confirmed?.status).toBe("done");

    // Perform undo
    store.undoLastAction();
    const afterUndo = useFridayStore.getState().pendingPlan;
    expect(afterUndo?.undoable).toBe(false);
    expect(afterUndo?.resultSummary).toContain("Reverted");
  });

  it("handles barge-in and audio RMS updates cleanly", async () => {
    const store = useFridayStore.getState();
    store.setOrbState("speaking");
    expect(useFridayStore.getState().orbState).toBe("speaking");

    await store.updateAudioRms();
    expect(useFridayStore.getState().telemetry.micRms).toBeGreaterThanOrEqual(0);

    await store.bargeIn();
    expect(useFridayStore.getState().orbState).toBe("idle");
  });
});
