/** FRIDAY Next-Gen Vector & Raster Cartography Style Engine (§04 & Blueprint §4)
 *
 * Implements high-performance editorial cartography styles:
 * - SATELLITE: Esri World Imagery (high-resolution Earth satellite imagery feed) + dark reference labels
 * - CARBON / TERRAIN: Neutral OpenFreeMap vector cartography with no API key
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

/** Satellite Imagery Style (Esri World Imagery + Esri World Boundaries & Places) */
export const FRIDAY_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: "FRIDAY Satellite Basemap",
  metadata: {
    "friday:designer": "FRIDAY Systems",
    "friday:theme": "orbital-satellite",
  },
  sources: {
    esri_satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "&copy; Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, and the GIS User Community",
      maxzoom: 19,
    },
    esri_labels: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
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
        "background-color": "#05070a",
      },
    },
    {
      id: "satellite-tiles",
      type: "raster",
      source: "esri_satellite",
      paint: {
        "raster-opacity": 0.95,
        "raster-contrast": 0.1,
        "raster-saturation": 0.05,
      },
    },
    {
      id: "satellite-labels",
      type: "raster",
      source: "esri_labels",
      paint: {
        "raster-opacity": 0.85,
      },
    },
  ],
}

/** Vector tiles keep streets crisp and avoid raster providers' API-key error images. */
function createNeutralMapStyle(terrain: boolean): StyleSpecification {
  return {
    version: 8,
    name: terrain ? "FRIDAY Terrain Basemap" : "FRIDAY Carbon Basemap",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    ...(terrain ? { terrain: { source: "elevation", exaggeration: 1 } } : {}),
    sources: {
      ...(terrain ? { elevation: { type: "raster-dem" as const, tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], tileSize: 256, encoding: "terrarium" as const, maxzoom: 14, attribution: "Elevation © Mapzen / AWS Open Data" } } : {}),
      openfreemap: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://openfreemap.org">OpenFreeMap</a> · OpenMapTiles',
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#171819" } },
      { id: "landcover", type: "fill", source: "openfreemap", "source-layer": "landcover", paint: { "fill-color": terrain ? "#292b2b" : "#1e2020", "fill-opacity": 0.8 } },
      { id: "landuse", type: "fill", source: "openfreemap", "source-layer": "landuse", paint: { "fill-color": terrain ? "#333535" : "#232525", "fill-opacity": 0.6 } },
      { id: "water", type: "fill", source: "openfreemap", "source-layer": "water", paint: { "fill-color": "#090b0c" } },
      { id: "waterways", type: "line", source: "openfreemap", "source-layer": "waterway", paint: { "line-color": "#090b0c", "line-width": 1 } },
      { id: "buildings", type: "fill", source: "openfreemap", "source-layer": "building", minzoom: 13, paint: { "fill-color": "#353737", "fill-outline-color": "#454747" } },
      ...(terrain ? [{ id: "building-depth", type: "fill-extrusion" as const, source: "openfreemap", "source-layer": "building", minzoom: 13,
        paint: { "fill-extrusion-color": "#777773", "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0] as maplibregl.ExpressionSpecification, "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0] as maplibregl.ExpressionSpecification, "fill-extrusion-opacity": 0.9 } }] : []),
      {
        id: "streets", type: "line", source: "openfreemap", "source-layer": "transportation",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["match", ["get", "class"], ["motorway", "trunk"], "#959795", ["primary", "secondary"], "#686b69", "#414443"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 12, 1.5, 16, 4],
        },
      },
      { id: "boundaries", type: "line", source: "openfreemap", "source-layer": "boundary", filter: ["<=", ["get", "admin_level"], 4], paint: { "line-color": "#646665", "line-width": 0.75, "line-dasharray": [3, 3] } },
      {
        id: "place-labels", type: "symbol", source: "openfreemap", "source-layer": "place",
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["match", ["get", "class"], "country", 14, ["city", "town"], 12, 10],
          "text-max-width": 8,
        },
        paint: { "text-color": "#cbccca", "text-halo-color": "#171819", "text-halo-width": 1.5 },
      },
      {
        id: "poi-labels", type: "symbol", source: "openfreemap", "source-layer": "poi", minzoom: 13,
        layout: { "text-field": ["coalesce", ["get", "name:fr"], ["get", "name"], ["get", "name:ar"]], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-max-width": 10, "text-padding": 8 },
        paint: { "text-color": "#e0e0dc", "text-halo-color": "#171819", "text-halo-width": 2 },
      },
      {
        id: "street-labels", type: "symbol", source: "openfreemap", "source-layer": "transportation_name", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 10 },
        paint: { "text-color": "#9c9e9b", "text-halo-color": "#171819", "text-halo-width": 1.5 },
      },
    ],
  }
}

export const FRIDAY_CARBON_STYLE = createNeutralMapStyle(false)
export const FRIDAY_TERRAIN_STYLE = createNeutralMapStyle(true)

/** Standard OpenStreetMap Raster Vector Style */
export const FRIDAY_VECTOR_STYLE: StyleSpecification = {
  version: 8,
  name: "FRIDAY Vector Basemap",
  sources: {
    openfreemap: {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
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
      id: "osm-layer",
      type: "raster",
      source: "openfreemap",
      paint: {
        "raster-opacity": 0.9,
        "raster-contrast": 0.1,
        "raster-saturation": -0.4,
      },
    },
  ],
}

export type FridayMapPreset = "satellite" | "carbon" | "terrain" | "vector"

export function getFridayMapStyle(mode: FridayMapPreset = "carbon"): StyleSpecification {
  switch (mode) {
    case "satellite":
      return FRIDAY_SATELLITE_STYLE
    case "terrain":
      return FRIDAY_TERRAIN_STYLE
    case "vector":
      return FRIDAY_VECTOR_STYLE
    case "carbon":
    default:
      return FRIDAY_CARBON_STYLE
  }
}
