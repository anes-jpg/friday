# ADR 012: TanStack for map and project workspace state

Date: 2026-10-25
Status: Accepted

The map needs explicit place searches, cancellable requests, caching, and reliable loading/error states. Projects need configurable onboarding with validated forms and searchable task tables. The user requested TanStack rather than custom substitutes for these behaviors.

Add `@tanstack/react-query`, `@tanstack/react-form`, and `@tanstack/react-table`. Query manages remote place data and native project inspection; Form manages project onboarding and customization; Table manages task filtering and sorting. Keep the existing Vite/Tauri shell and navigation. These headless libraries do not supply or overwrite visual styling.

Use OpenStreetMap community data for business search and details, with manual search submission, bounded area requests, conservative caching, cancellation, source attribution, and explicit missing-data states. Do not fabricate business ratings, opening status, or contact information.

Nominatim handles submitted name/address searches. Nearby searches cover at most 500 metres, with Overpass as the primary source and a bounded OSM map API request when Overpass is unavailable. Suppress failed Overpass requests for five minutes; apply category and radius filters to the fallback. Read business details from the exact OSM record. Vector labels without a record ID may only be enriched by a matching name. Validate persisted places and reference URLs before displaying them, and preserve unreadable saved data instead of overwriting it.

Workspace preferences and task records stay local to the device. Attaching a folder requires native inspection; creating a planning workspace works without a folder. Saving a project does not execute shell commands or install packages. Agent instructions are staged for review before execution.
