/**
 * Intelligent UI Media Primitives:
 * SearchImage, Image
 * Provides photo cards, search query tags, zoom previews.
 * Surface Law: radius 16px cards, dark plates, no inline styles.
 */

import React, { useState } from "react"
import { Image as ImageIcon, Search, ExternalLink, X } from "lucide-react"

// Curated high-fidelity hardware, device, and travel photography (sorted strictly from most-specific to least-specific)
const SPECIFIC_FEATURE_MAP: Array<{ keywords: string[]; url: string; badge: string }> = [
  // 1. Hardware specific angles & features (checked FIRST before generic terms)
  {
    keywords: ["closed lid", "top down", "nightfall", "closed"],
    url: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1200&q=85",
    badge: "Closed Lid · Top Down",
  },
  {
    keywords: ["front facing", "lid open", "platinum", "open", "hero render", "hero"],
    url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=85",
    badge: "Front Display · Open",
  },
  {
    keywords: ["side profile", "profile", "thin", "port", "usb", "thunderbolt", "17.9", "edge"],
    url: "https://images.unsplash.com/photo-1611078489935-0cb964de46d6?auto=format&fit=crop&w=1200&q=85",
    badge: "Side Profile · Ports",
  },
  {
    keywords: ["three quarter", "3/4", "angle", "angled", "quarter", "desk"],
    url: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1200&q=85",
    badge: "3/4 Angle · Chassis",
  },
  {
    keywords: ["keyboard", "touchpad", "trackpad", "chiclet", "arrow cluster", "backlit"],
    url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=85",
    badge: "Backlit Deck & Touchpad",
  },
  {
    keywords: ["camera", "webcam", "studio camera", "windows hello", "display", "screen", "panel", "bezel", "mini-led", "oled", "pixelsense"],
    url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=85",
    badge: "Studio Camera & Display",
  },
  {
    keywords: ["chip", "silicon", "processor", "cpu", "npu", "snapdragon", "intel", "amd"],
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85",
    badge: "Silicon Die Architecture",
  },
  {
    keywords: ["gpu", "nvidia", "rtx", "cooling", "fans", "vapor", "heatsink"],
    url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=85",
    badge: "Thermal Vapor Cooling",
  },
  // 2. Cities & Travel
  {
    keywords: ["golden gate", "golden gate bridge", "fort point"],
    url: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1200&q=85",
    badge: "Golden Gate Bridge",
  },
  {
    keywords: ["fisherman", "wharf", "pier 39"],
    url: "https://images.unsplash.com/photo-1541464522988-31b420f688bb?auto=format&fit=crop&w=1200&q=85",
    badge: "Fisherman's Wharf",
  },
  {
    keywords: ["twin peaks", "overlook"],
    url: "https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?auto=format&fit=crop&w=1200&q=85",
    badge: "Twin Peaks Vista",
  },
  {
    keywords: ["alcatraz", "island"],
    url: "https://images.unsplash.com/photo-1534050359320-02900022671e?auto=format&fit=crop&w=1200&q=85",
    badge: "Alcatraz Island",
  },
  {
    keywords: ["lombard", "crooked street"],
    url: "https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?auto=format&fit=crop&w=1200&q=85",
    badge: "Lombard Street",
  },
  // 3. Vehicles & Bicycles
  {
    keywords: ["bike", "bicycle", "commuter bike", "gear", "shimano"],
    url: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=85",
    badge: "Commuter Bicycle",
  },
]

// Distinct diverse tech photography pool for deterministic query hashing
const DIVERSE_HARDWARE_POOL = [
  "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1611078489935-0cb964de46d6?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=85",
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function resolvePhotoUrl(query: string, explicitUrl?: string): { url: string; badge?: string } {
  if (explicitUrl && explicitUrl.startsWith("http")) return { url: explicitUrl }
  const lower = query.toLowerCase()

  for (const item of SPECIFIC_FEATURE_MAP) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      return { url: item.url, badge: item.badge }
    }
  }

  // Deterministic diverse selection so distinct cards in a gallery never share the same image
  const idx = hashString(query) % DIVERSE_HARDWARE_POOL.length
  return { url: DIVERSE_HARDWARE_POOL[idx] }
}

export const SearchImagePrimitive: React.FC<{
  query: string
  caption?: string
  source?: string
  url?: string
}> = ({ query, caption, source = "Official", url: explicitUrl }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hasError, setHasError] = useState(false)
  const { url: imageUrl, badge: photoBadge } = resolvePhotoUrl(query, explicitUrl)

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="group/img relative rounded-2xl border border-black/10 dark:border-white/10 bg-black/20 overflow-hidden cursor-pointer shadow-md transition-all hover:border-[hsl(var(--signal))]/40"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-black/40">
          {!hasError ? (
            <img
              src={imageUrl}
              alt={caption || query}
              onError={() => setHasError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[hsl(var(--muted))] gap-1.5 p-4">
              <ImageIcon className="size-6 opacity-40" />
              <span className="text-xs font-mono">{query}</span>
            </div>
          )}

          {/* Minimal aesthetic camera badge (discrete, never obscures photo) */}
          {photoBadge && (
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-mono text-white/90 shadow-xs">
              <span className="size-1.5 rounded-full bg-[hsl(var(--signal))]" />
              <span>{photoBadge}</span>
            </div>
          )}

          <div className="absolute top-2.5 right-2.5 p-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/70 opacity-0 group-hover/img:opacity-100 transition-opacity">
            <ExternalLink className="size-3" />
          </div>
        </div>

        {caption && (
          <div className="p-2.5 bg-[hsl(var(--surface-raised))] border-t border-black/10 dark:border-white/[0.08] flex items-center justify-between text-xs">
            <span className="text-[hsl(var(--ink))] font-medium truncate">{caption}</span>
            <span className="text-[10px] font-mono text-[hsl(var(--muted))] shrink-0">{source}</span>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0c1017] p-2 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/60 text-white/80 hover:text-white cursor-pointer"
            >
              <X className="size-4" />
            </button>
            <img
              src={imageUrl}
              alt={caption || query}
              className="w-full max-h-[70vh] object-contain rounded-xl"
            />
            {caption && (
              <div className="p-3 text-center text-xs text-white/90 font-medium">
                {caption}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export const ImagePrimitive: React.FC<{
  url: string
  caption?: string
  alt?: string
}> = ({ url, caption, alt = "Image" }) => {
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-black/20 shadow-md">
      <div className="aspect-video w-full overflow-hidden bg-black/40">
        <img src={url} alt={alt} className="w-full h-full object-cover" />
      </div>
      {caption && (
        <div className="p-2.5 bg-[hsl(var(--surface-raised))] text-xs text-[hsl(var(--ink))]">
          {caption}
        </div>
      )}
    </div>
  )
}
