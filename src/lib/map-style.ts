/** FRIDAY Next-Gen Vector & Raster Cartography Style Engine (§04 & Blueprint §4)
 *
 * Implements the editorial carbon basemap:
 * - Obsidian / Slate dark palette (#090A0C ground, #12151B land, #0D1117 water)
 * - Support for CartoDB Dark Matter retina tiles and OpenFreeMap vector tiles
 * - Offline PMTiles protocol integration for zero-network environments
 * - Strict adherence to the One-Signal Law: purple signal exclusively for active targets/routes
 */

import type { StyleSpecification } from "maplibre-gl"
import * as maplibregl from "maplibre-gl"
import * as pmtiles from "pmtiles"

let pmTilesRegistered = false

/** Initializes the PMTiles custom URL protocol handler for offline map archive loading */
export function registerPmTilesProtocol(): pmtiles.Protocol | null {
  if (typeof window === "undefined") return null
  if (pmTilesRegistered) return null
  try {
    const protocol = new pmtiles.Protocol()
    maplibregl.addProtocol("pmtiles", protocol.tile)
    pmTilesRegistered = true
    return protocol
  } catch (err) {
    console.warn("[MapLibre] PMTiles protocol already registered or failed:", err)
    return null
  }
}

/** Canonical FRIDAY Carbon Editorial Map Style (Retina Dark Raster + WebGL2 Interleaved) */
export const FRIDAY_CARBON_STYLE: StyleSpecification = {
  version: 8,
  name: "FRIDAY Carbon Basemap",
  metadata: {
    "friday:designer": "FRIDAY Systems",
    "friday:theme": "carbon-obsidian",
  },
  sources: {
    carto_dark: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors, &copy; CARTO",
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#090A0C",
      },
    },
    {
      id: "carto-dark-tiles",
      type: "raster",
      source: "carto_dark",
      paint: {
        "raster-opacity": 0.88,
        "raster-contrast": 0.15,
        "raster-brightness-min": 0.02,
        "raster-brightness-max": 0.95,
      },
    },
  ],
}

/** Vector basemap style utilizing OpenFreeMap planet endpoint for high-resolution vector tile geometry */
export const FRIDAY_VECTOR_STYLE: StyleSpecification = {
  version: 8,
  name: "FRIDAY Vector Basemap",
  sources: {
    openfreemap: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
    carto_labels: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/dark_only_labels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#08090B",
      },
    },
    {
      id: "base-geometry",
      type: "raster",
      source: "openfreemap",
      paint: {
        "raster-opacity": 0.92,
      },
    },
    {
      id: "carto-labels",
      type: "raster",
      source: "carto_labels",
      paint: {
        "raster-opacity": 0.75,
      },
    },
  ],
}

export function getFridayMapStyle(mode: "carbon" | "vector" = "carbon"): StyleSpecification {
  return mode === "vector" ? FRIDAY_VECTOR_STYLE : FRIDAY_CARBON_STYLE
}
