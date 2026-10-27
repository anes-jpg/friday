# ADR 013: Place photos, resilient search, and 3D land use

Date: 2026-10-25
Status: Accepted

The user requested richer place coverage, photos, and a genuinely three-dimensional Land Use mode. Keep the existing MapLibre, TanStack, and OpenStreetMap foundation; no new runtime dependency is required.

Use submitted Nominatim searches with Photon as an alternative when Nominatim is unavailable. Both provide real OSM identities. Preserve the Algeria country filter across services and suppress repeated requests to a failed Nominatim service for five minutes. Loaded vector POIs remain browsable while detailed listings are unavailable. Nearby searches cover configurable 500 m, 1.5 km, or 2 km areas; include amenities, offices, crafts, and attractions. Results and source labels distinguish unavailable details from missing fields. Never enrich a place with another business's record.

Photos use OSM-linked images, Commons files, or Wikidata P18 associations first. Otherwise show geotagged Wikimedia Commons neighbourhood photos, explicitly labelled as nearby, with source attribution and licence information. Do not imply that nearby photos depict the selected business. Fetch photos only for a selected place and cache results. No generated storefronts or fabricated photos.

Land Use uses the global Mapzen Terrarium elevation tiles hosted by AWS Open Data, plus OpenMapTiles building heights, with a pitched camera and a flatten/tilt control. Unspecified building heights stay flat. Map interaction and interface transitions remain finite and respect reduced motion. No idle camera rotation.

Sources: https://photon.komoot.io/, https://commons.wikimedia.org/w/api.php, https://www.wikidata.org/, https://registry.opendata.aws/terrain-tiles/, https://openmaptiles.org/schema/#building
