import { describe, it, expect, beforeEach } from "vitest"
import { useFriday, sendChatMessage } from "../src/lib/store"
import type { Thread } from "../src/lib/types"

describe("Chat History & Thread Management System", () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useFriday.setState({
      threads: [
        {
          id: "test-thread-1",
          title: "First Conversation",
          pinned: false,
          message_count: 2,
          updated_at: new Date(Date.now() - 3600_000).toISOString(),
          messages: [
            {
              id: "m-1",
              role: "user",
              content: "Hello Friday",
              created_at: new Date(Date.now() - 3600_000).toISOString(),
            },
            {
              id: "m-2",
              role: "assistant",
              content: "Hello! How can I assist you?",
              created_at: new Date(Date.now() - 3500_000).toISOString(),
            },
          ],
        },
        {
          id: "test-thread-2",
          title: "Second Conversation",
          pinned: true,
          message_count: 1,
          updated_at: new Date(Date.now() - 86400_000).toISOString(),
          messages: [
            {
              id: "m-3",
              role: "user",
              content: "Show my calendar",
              created_at: new Date(Date.now() - 86400_000).toISOString(),
            },
          ],
        },
      ],
      activeThreadId: "test-thread-1",
      chatHistoryOpen: false,
    })
  })

  it("creates a new thread and sets it active", () => {
    const store = useFriday.getState()
    const newId = store.createThread()

    expect(newId).toBeDefined()
    expect(newId.startsWith("t-")).toBe(true)

    const updated = useFriday.getState()
    expect(updated.activeThreadId).toBe(newId)
    expect(updated.threads[0].id).toBe(newId)
    expect(updated.threads[0].title).toBe("New session")
    expect(updated.threads[0].messages).toEqual([])
    expect(updated.threads[0].pinned).toBe(false)
  })

  it("creates a new thread with a custom title", () => {
    const store = useFriday.getState()
    const newId = store.createThread("Custom Research Thread")

    const updated = useFriday.getState()
    expect(updated.activeThreadId).toBe(newId)
    expect(updated.threads[0].title).toBe("Custom Research Thread")
  })

  it("switches active thread cleanly", () => {
    const store = useFriday.getState()
    expect(store.activeThreadId).toBe("test-thread-1")

    store.setActiveThread("test-thread-2")
    expect(useFriday.getState().activeThreadId).toBe("test-thread-2")
  })

  it("renames an existing thread", () => {
    const store = useFriday.getState()
    store.renameThread("test-thread-1", "Renamed Project Discussion")

    const updated = useFriday.getState()
    const target = updated.threads.find((t) => t.id === "test-thread-1")
    expect(target).toBeDefined()
    expect(target?.title).toBe("Renamed Project Discussion")
  })

  it("ignores whitespace-only renames", () => {
    const store = useFriday.getState()
    store.renameThread("test-thread-1", "   ")

    const updated = useFriday.getState()
    const target = updated.threads.find((t) => t.id === "test-thread-1")
    expect(target?.title).toBe("First Conversation")
  })

  it("toggles thread pin status", () => {
    const store = useFriday.getState()
    const thread1 = store.threads.find((t) => t.id === "test-thread-1")
    expect(thread1?.pinned).toBe(false)

    store.toggleThreadPin("test-thread-1")
    expect(useFriday.getState().threads.find((t) => t.id === "test-thread-1")?.pinned).toBe(true)

    store.toggleThreadPin("test-thread-1")
    expect(useFriday.getState().threads.find((t) => t.id === "test-thread-1")?.pinned).toBe(false)
  })

  it("deletes a non-active thread without changing activeThreadId", () => {
    const store = useFriday.getState()
    expect(store.activeThreadId).toBe("test-thread-1")

    store.deleteThread("test-thread-2")
    const updated = useFriday.getState()
    expect(updated.threads.find((t) => t.id === "test-thread-2")).toBeUndefined()
    expect(updated.activeThreadId).toBe("test-thread-1")
    expect(updated.threads.length).toBe(1)
  })

  it("deletes the active thread and falls back to next remaining thread", () => {
    const store = useFriday.getState()
    expect(store.activeThreadId).toBe("test-thread-1")

    store.deleteThread("test-thread-1")
    const updated = useFriday.getState()
    expect(updated.threads.find((t) => t.id === "test-thread-1")).toBeUndefined()
    expect(updated.activeThreadId).toBe("test-thread-2")
    expect(updated.threads.length).toBe(1)
  })

  it("deleting the last remaining thread creates a fresh session automatically", () => {
    useFriday.setState({
      threads: [
        {
          id: "only-thread",
          title: "Solo Conversation",
          pinned: false,
          message_count: 0,
          messages: [],
        },
      ],
      activeThreadId: "only-thread",
    })

    const store = useFriday.getState()
    store.deleteThread("only-thread")

    const updated = useFriday.getState()
    expect(updated.threads.find((t) => t.id === "only-thread")).toBeUndefined()
    expect(updated.threads.length).toBe(1)
    expect(updated.threads[0].title).toBe("New session")
    expect(updated.activeThreadId).toBe(updated.threads[0].id)
  })

  it("toggles chat history panel state", () => {
    const store = useFriday.getState()
    expect(store.chatHistoryOpen).toBe(false)

    store.toggleChatHistory()
    expect(useFriday.getState().chatHistoryOpen).toBe(true)

    store.toggleChatHistory(false)
    expect(useFriday.getState().chatHistoryOpen).toBe(false)

    store.toggleChatHistory(true)
    expect(useFriday.getState().chatHistoryOpen).toBe(true)
  })

  it("auto-renames thread title on first message if title was 'New session'", async () => {
    const store = useFriday.getState()
    const freshId = store.createThread()
    expect(useFriday.getState().threads.find((t) => t.id === freshId)?.title).toBe("New session")

    // Send first prompt
    const prompt = "Summarize the Q4 sales forecast"
    await sendChatMessage(prompt)

    const updated = useFriday.getState()
    const current = updated.threads.find((t) => t.id === freshId)
    expect(current?.title).toBe("Summarize the Q4 sales forecast")
  })

  it("does not overwrite custom thread title on chat message", async () => {
    const store = useFriday.getState()
    const customId = store.createThread("Custom Title That Stays")

    await sendChatMessage("Some new question")

    const updated = useFriday.getState()
    const current = updated.threads.find((t) => t.id === customId)
    expect(current?.title).toBe("Custom Title That Stays")
  })

  it("hydrates threads from backend while preserving messages", async () => {
    const store = useFriday.getState()
    await store.hydrateThreadsFromBackend()

    const updated = useFriday.getState()
    // Should have retrieved threads from the mock
    expect(updated.threads.length).toBeGreaterThan(0)
    // Active thread should remain resolved
    expect(updated.activeThreadId).toBeTruthy()
  })

  it("handles pushMessage without NaN when message_count is undefined", () => {
    useFriday.setState({
      threads: [
        {
          id: "no-count-thread",
          title: "Session without count",
          pinned: false,
          messages: [],
        },
      ],
      activeThreadId: "no-count-thread",
    })

    const store = useFriday.getState()
    store.pushMessage("no-count-thread", {
      id: "m-new",
      role: "user",
      content: "Hello",
      created_at: new Date().toISOString(),
    })

    const updated = useFriday.getState()
    const target = updated.threads.find((t) => t.id === "no-count-thread")
    expect(target?.message_count).toBe(1)
    expect(Number.isNaN(target?.message_count)).toBe(false)
  })

  it("sanitizes multiline prompts when auto-naming threads", async () => {
    const store = useFriday.getState()
    const freshId = store.createThread()

    const multilinePrompt = "Line 1\n\nLine 2\twith tabs and trailing content"
    await sendChatMessage(multilinePrompt)

    const updated = useFriday.getState()
    const current = updated.threads.find((t) => t.id === freshId)
    expect(current?.title).toBeDefined()
    expect(current?.title).not.toContain("\n")
    expect(current?.title).not.toContain("\t")
    expect(current?.title.startsWith("Line 1 Line 2 with tabs")).toBe(true)
  })
})
