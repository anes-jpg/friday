# ADR 019: Block-level ASCII content reveal

The user requested the actual ASCII Reveal loading behavior, where blocks decode into their loaded content. The existing standalone purple glyph loader does not communicate which content is arriving.

Adopt `ascii-reveal` (MIT, https://github.com/quanhoangindex/ascii-reveal), pinned to its verified published version. It has React peer dependencies and no new runtime dependencies. Wrap bounded data blocks, keep cached content readable, use neutral glyphs, disable perpetual shimmer, shorten playback, and honor both operating-system and FRIDAY reduced-motion settings. Library fallback must remain enabled. Do not add its animated mascots or put its renderer into the idle voice core.

Dioramas is an optional generated-website recipe, not a new desktop rendering dependency. Its image/model generation scripts and paid providers are excluded. HorizonX requires a subscription and was removed at the user's direction. Its public preview → source → project workflow is adapted with free shadcn and Watermelon source references and inspectable starter blocks; no subscriber assets are accessed.
