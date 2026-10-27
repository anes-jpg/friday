# Compact map and workspace refinement

Preserve the Atmospheric Halftone OS typography and contour globe. Reduce the working chrome to a 56 px rail, 40 px header, 24 px page titles, and 16–24 px content padding. Use neutral black/graphite surfaces; violet remains an activity signal. Projects use a compact brief and a single divided context inspector instead of three large cards.

Place discovery supports wider neighbourhoods, source-backed photos, photo attribution, and browsable vector POIs. Public search and detail services have fallbacks and explicit missing-data states. Land Use renders elevation and building depth with a pitched camera; flattening is an explicit view control.

Navigation, project views, dialogs, photo changes, and fullscreen entry use finite transform/opacity sequences. Each animated segment lasts 120–220 ms. Idle components do not gain animation loops. Windows reduced motion still collapses the sequences. The fullscreen intro plays when entering ordinary fullscreen; the control-room readiness screen has its own staged entrance.

The current Windows client-animation preference is disabled, confirmed through `SPI_GETCLIENTAREAANIMATION`. Enable Animation effects in Windows to view full motion. Browser verification explicitly exercises both motion preferences.

Data-source decisions are recorded in [ADR 013](adr/013-map-photos-and-depth.md).
