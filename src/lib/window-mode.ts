import { create } from "zustand"
import { invokeCommand, isDesktop } from "./ipc"

interface WindowMode {
  fullscreen: boolean
  spatial: boolean
  busy: boolean
  error: string | null
  previousFullscreen: boolean
  sync: (fullscreen: boolean) => void
  toggleFullscreen: () => Promise<void>
  enterSpatial: () => Promise<boolean>
  exitSpatial: () => Promise<void>
}

async function setFullscreen(target: boolean, spatial = false): Promise<boolean> {
  if (isDesktop) return invokeCommand<boolean>("set_app_fullscreen", { target, spatial })
  if (target && !document.fullscreenElement) await document.documentElement.requestFullscreen()
  if (!target && document.fullscreenElement) await document.exitFullscreen()
  return Boolean(document.fullscreenElement)
}

export const useWindowMode = create<WindowMode>((set, get) => ({
  fullscreen: false, spatial: false, busy: false, error: null, previousFullscreen: false,
  sync: (fullscreen) => set({ fullscreen }),
  toggleFullscreen: async () => {
    if (get().busy) return
    if (get().spatial) { await get().exitSpatial(); return }
    set({ busy: true, error: null })
    try {
      const entering = !get().fullscreen
      const fullscreen = await setFullscreen(entering)
      set({ fullscreen })
      if (entering && fullscreen && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("friday:fullscreen-ready"))
    }
    catch (error) { set({ error: String(error) }) }
    finally { set({ busy: false }) }
  },
  enterSpatial: async () => {
    if (get().busy || get().spatial) return false
    const previousFullscreen = get().fullscreen
    set({ busy: true, error: null })
    try {
      const fullscreen = await setFullscreen(true, true)
      set({ fullscreen, spatial: true, previousFullscreen })
      return true
    } catch (error) { set({ error: String(error) }); return false }
    finally { set({ busy: false }) }
  },
  exitSpatial: async () => {
    if (get().busy || !get().spatial) return
    set({ busy: true, error: null })
    try {
      const fullscreen = await setFullscreen(get().previousFullscreen)
      set({ fullscreen, spatial: false })
    } catch (error) { set({ error: String(error) }) }
    finally { set({ busy: false }) }
  },
}))
