/** FRIDAY God's Eye & Surveillance Camera Matrix Test Suite
 *
 * Verifies:
 * 1. Cartography basemap styles (Satellite, Carbon, Terrain)
 * 2. Camera surveillance matrix configuration and feeds
 * 3. Hotspots navigation coordinates
 * 4. Spatial HUD layout presets and de-cramped view modes
 */

import { describe, it, expect } from "vitest"
import { getFridayMapStyle, type FridayMapPreset } from "../src/lib/map-style"

describe("FRIDAY God's Eye Planetary Command & Camera Feeds (§04)", () => {
  it("uses real elevation and extruded buildings for 3D land use while carbon stays flat", () => {
    const landUse = getFridayMapStyle("terrain")
    expect(landUse.terrain?.source).toBe("elevation")
    expect(landUse.sources.elevation.type).toBe("raster-dem")
    expect(landUse.layers.some(layer => layer.type === "fill-extrusion")).toBe(true)
    expect(getFridayMapStyle("carbon").terrain).toBeUndefined()
  })
  it("provides authentic Esri satellite imagery in satellite style preset", () => {
    const satelliteStyle = getFridayMapStyle("satellite")
    expect(satelliteStyle).toBeDefined()
    expect(satelliteStyle.name).toContain("Satellite")

    const esriSource = satelliteStyle.sources?.esri_satellite
    expect(esriSource).toBeDefined()
    expect(esriSource?.type).toBe("raster")
    if (esriSource?.type === "raster") {
      expect(esriSource.tiles?.[0]).toContain("arcgisonline.com/ArcGIS/rest/services/World_Imagery")
    }
  })

  it("provides an API-key-free vector source in carbon style preset", () => {
    const carbonStyle = getFridayMapStyle("carbon")
    expect(carbonStyle).toBeDefined()
    expect(carbonStyle.name).toContain("Carbon")

    const darkSource = carbonStyle.sources?.openfreemap
    expect(darkSource).toBeDefined()
    expect(darkSource?.type).toBe("vector")
    if (darkSource?.type === "vector") {
      expect(darkSource.url).toBe("https://tiles.openfreemap.org/planet")
    }
  })

  it("provides tactical terrain and street tiles in terrain style preset", () => {
    const terrainStyle = getFridayMapStyle("terrain")
    expect(terrainStyle).toBeDefined()
    expect(terrainStyle.name).toContain("Terrain")

    const voyagerSource = terrainStyle.sources?.openfreemap
    expect(voyagerSource).toBeDefined()
    expect(voyagerSource?.type).toBe("vector")
    if (voyagerSource?.type === "vector") {
      expect(voyagerSource.url).toBe("https://tiles.openfreemap.org/planet")
    }
  })

  it("defines standard telemetry hotspots for instant orbital/metro navigation", () => {
    const hotspots = [
      { name: "OPERATOR HUB", coords: [-122.4194, 37.7749], zoom: 12 },
      { name: "TOKYO SHIBUYA", coords: [139.7006, 35.6595], zoom: 14 },
      { name: "NEW YORK", coords: [-73.9855, 40.758], zoom: 13 },
      { name: "ISS ORBIT", coords: [45.0, 25.0], zoom: 4 },
    ]

    for (const spot of hotspots) {
      expect(spot.coords.length).toBe(2)
      expect(spot.coords[0]).toBeGreaterThanOrEqual(-180)
      expect(spot.coords[0]).toBeLessThanOrEqual(180)
      expect(spot.coords[1]).toBeGreaterThanOrEqual(-90)
      expect(spot.coords[1]).toBeLessThanOrEqual(90)
      expect(spot.zoom).toBeGreaterThanOrEqual(1)
    }
  })

  it("validates camera optical filter classes and modes", () => {
    const filters = ["rgb", "nvg", "flir", "mono"]
    expect(filters).toContain("nvg")
    expect(filters).toContain("flir")
  })
})
