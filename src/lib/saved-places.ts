import { create } from "zustand"
import { z } from "zod"
import { isDesktop } from "./ipc"
import { parseSavedPlaces, type MapPlace } from "./places"
import { nativeSave, nativeDelete, readNativePlaces, type SavedCollection, type NativeWorkspace } from "./workspace-native"
import { invokeCommand } from "./ipc"

const collectionSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(120), placeIds: z.array(z.string()) })
interface SavedPlaceStore {
  places: MapPlace[]; collections: SavedCollection[]; ready: boolean; error: string | null
  hydrate: () => Promise<void>
  save: (place: MapPlace) => Promise<void>
  remove: (id: string) => Promise<void>
  saveCollection: (collection: SavedCollection) => Promise<void>
}
export const useSavedPlaces = create<SavedPlaceStore>((set, get) => ({
  places: [], collections: [], ready: false, error: null,
  hydrate: async () => {
    try {
      const places = await readNativePlaces()
      const collections = isDesktop ? (await invokeCommand<NativeWorkspace>("workspace_snapshot")).collections : JSON.parse(localStorage.getItem("friday-place-collections-v1") || "[]") as unknown
      set({ places, collections: z.array(collectionSchema).parse(collections), ready: true, error: null })
    } catch (failure) { set({ error: failure instanceof Error ? failure.message : String(failure) }) }
  },
  save: async place => {
    if (!get().ready || get().error) throw new Error(get().error || "Saved places are still opening")
    const parsed = parseSavedPlaces([place])[0]
    const next = [...get().places.filter(item => item.id !== parsed.id), parsed]
    if (isDesktop) await nativeSave("place", parsed)
    else localStorage.setItem("friday-saved-places", JSON.stringify(next))
    set({ places: next })
  },
  remove: async id => {
    if (!get().ready || get().error) throw new Error(get().error || "Saved places are still opening")
    const next = get().places.filter(place => place.id !== id)
    if (isDesktop) await nativeDelete("place", id)
    else localStorage.setItem("friday-saved-places", JSON.stringify(next))
    set({ places: next })
  },
  saveCollection: async collection => {
    const parsed = collectionSchema.parse(collection)
    parsed.placeIds = [...new Set(parsed.placeIds)]
    const next = [...get().collections.filter(item => item.id !== collection.id), parsed]
    if (isDesktop) await nativeSave("collection", parsed)
    else localStorage.setItem("friday-place-collections-v1", JSON.stringify(next))
    set({ collections: next })
  },
}))
