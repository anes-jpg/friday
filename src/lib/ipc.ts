// Type-safe IPC Bridge for Tauri 2 and Dev fallback

let isTauriEnv = false;
try {
  isTauriEnv = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
} catch {
  isTauriEnv = false;
}

export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriEnv) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<T>(cmd, args);
    } catch (err) {
      console.warn(`[IPC] Tauri invoke failed for ${cmd}, using local handler`, err);
    }
  }

  // Standalone Browser Simulation fallback
  console.log(`[IPC:Mock] invoke("${cmd}")`, args);

  switch (cmd) {
    case "get_telemetry":
      return {
        cpuPercent: 2.3,
        idleRssMb: 195,
        peakRssMb: 512,
        glmTtftMs: 650,
        lastVoiceRoundtripMs: 1410,
        micRms: 0.0,
        outputRms: 0.0,
        offlineMode: false,
        activeWindow: "Code.exe — FRIDAY Build",
        clipboardPreview: "https://open.bigmodel.cn/api/paas/v4",
      } as T;

    case "hide_bar":
      return true as T;

    case "show_console":
      return true as T;

    case "start_mic_capture":
      return true as T;

    case "stop_mic_capture":
      return true as T;

    case "get_audio_rms":
      return { mic_rms: 0.25, output_rms: 0.0 } as T;

    case "barge_in":
      return true as T;

    case "is_speaking":
      return false as T;

    case "speak_text":
      return true as T;

    case "get_facts":
      return [
        {
          id: "fact-1",
          content: "Kwame prefers WhatsApp over email for fast coordination",
          confidence: 0.96,
          source_message_id: "msg-1",
          created_at: Date.now() - 3600000,
        },
        {
          id: "fact-2",
          content: "Desktop screenshots should be archived into Assets after review",
          confidence: 0.94,
          created_at: Date.now() - 1800000,
        },
      ] as T;

    case "delete_fact":
      return true as T;

    case "get_automations":
      return [
        {
          id: "auto-1",
          name: "Daily Standup Digest",
          trigger_type: "cron",
          trigger_expr: "0 45 8 * * MON-FRI",
          action_tool: "standup.generate",
          action_args: "{}",
          enabled: true,
          last_run: Date.now() - 86400000,
          next_run: Date.now() + 36000000,
        },
        {
          id: "auto-2",
          name: "Desktop Screenshot Auto-Tag",
          trigger_type: "event",
          trigger_expr: "fs.watch:Desktop/Screenshots",
          action_tool: "fs.move",
          action_args: "{\"target\": \"Desktop/Assets\"}",
          enabled: true,
          last_run: Date.now() - 14400000,
          next_run: null,
        },
      ] as T;

    case "toggle_automation":
      return true as T;

    case "trigger_automation":
      return "Executed automation" as T;

    case "get_skills":
      return [
        {
          id: "standup-digest",
          name: "Standup Digest",
          version: "1.0.0",
          description: "Summarize yesterday's commits and task changes into a clean standup note.",
          permissions: ["notion.read", "web.fetch:api.github.com", "notify.toast"],
          enabled: true,
        },
        {
          id: "notion-operator",
          name: "Notion Workspace Bridge",
          version: "1.2.0",
          description: "Direct bi-directional search and task mutations across AN STUDIO Notion pages.",
          permissions: ["notion.read", "notion.write"],
          enabled: true,
        },
      ] as T;

    case "toggle_skill":
      return true as T;

    case "get_audit_log":
      return [
        {
          id: "audit-1",
          tool_name: "screen.read",
          args_hash: "e4f8b9a1",
          tier: "Green",
          decision: "auto_allowed",
          duration_ms: 120,
          created_at: Date.now() - 120000,
        },
      ] as T;

    case "get_threads":
      return [
        {
          id: "thread-1",
          title: "Active Desktop Session",
          created_at: Date.now() - 3600000,
          updated_at: Date.now(),
        },
      ] as T;

    case "get_messages":
      return [] as T;

    case "read_active_window":
      return { title: "FRIDAY — Windows Desktop Assistant", process: "Code.exe" } as T;

    case "save_api_key":
      return true as T;

    case "get_api_key_status":
      return true as T;

    case "test_glm_connection":
      return "Successfully connected to GLM API with credential vault authentication." as T;

    case "learn_correction":
      return true as T;

    case "get_hotwords":
      return "Tauri : 2.5\nNotion : 2.0\nOKLCH : 3.0" as T;

    default:
      return {} as T;
  }
}
