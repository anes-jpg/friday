# FRIDAY architecture map

The [self-contained Floorplan](index.html) and its screenshots were refreshed on 30 October 2026 from the development workspace. The snapshot includes ongoing research and Android companion work alongside the completed project-switching and onboarding changes. It is an architectural view, not a release or security certification.

Every scanned code file and HTTP route has a plain-language name and description. Start with the overview, open a subsystem, or follow the voice, daily-work and business-research flows. The recent-work highlights identify the project and onboarding changes.

Save `index.html` and open it in a browser. Layout, fonts and graph data are embedded; navigating the map works offline. The published export omits the local workspace root. The Ask integration requires a separate compatible environment and is not hosted by this repository.

The automatic health scan found no high- or medium-severity items. Its five low-severity findings concern local development URLs and apparently unused files. These are leads to review, not a complete security audit.

The working map's editable `architecture.json` and `descriptions/` stay under the ignored `floorplan/` directory. Ask to update the Floorplan after code changes, then regenerate the sanitized export and screenshots.

Generated with Floorplan 0.3.0. This export embeds ELK.js, Inter and JetBrains Mono; their [ELK.js](elkjs-LICENSE.md), [Inter](inter-LICENSE.txt) and [JetBrains Mono](jetbrains-mono-LICENSE.txt) notices are included alongside it.
