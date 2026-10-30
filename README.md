<div align="center">

# FRIDAY.

### Your work. Your model. One desktop.

A voice-first Windows operator for conversations, research, projects, and everyday work.

**Windows 10 / 11** · **Tauri 2 + React 19 + Rust** · **Local speech** · **Development preview**

[Explore the interface](#a-look-inside) · [Get started](#get-started) · [Architecture](#how-it-fits-together) · [2026 roadmap](#2026-rollout-roadmap)

![FRIDAY project workspace with tasks, saved context, and checkpoints](docs/images/workspace.png)

</div>

FRIDAY brings the request, its context, and the next action into the same workspace. Start with a conversation or a goal. Keep notes and tasks together, attach an existing folder when you need local tools, and choose the model provider that fits the work.

The interface follows the **Atmospheric Halftone OS** design: quiet dark surfaces, clear typography, compact instruments, and violet reserved for active work and focus. See [the design system](DESIGN.md) and [the project constitution](AGENTS.md).

## A look inside

These are real captures of the browser preview using disposable example projects and provider profiles. They contain no personal workspace records or credentials. Native Windows tools and speech require the desktop app.

### A useful place to start

The optional guide starts from software, research, or everyday goals. Leave for Settings or a workspace and return to your saved place. Finishing the guide is a separate action.

![Resumable first-use guide with software, research, and everyday-work entry points](docs/images/onboarding.png)

<table>
<tr>
<td width="50%"><strong>Make the workspace yours</strong><br />Custom goals, optional folders and presets, any saved provider, and your response language.</td>
<td width="50%"><strong>Keep the next steps visible</strong><br />Searchable tasks, priorities, status, and actions tied to the selected project.</td>
</tr>
<tr>
<td><img src="docs/images/project-setup.png" alt="Flexible project setup with an optional folder and editable goal" /></td>
<td><img src="docs/images/project-tasks.png" alt="Project task table with priorities and contextual actions" /></td>
</tr>
<tr>
<td><strong>Pick up the day</strong><br />A task queue, captures, saved checkpoints, and the next piece of work.</td>
<td><strong>Bring your own model</strong><br />Local or remote OpenAI-compatible endpoints, exact model names, API mode, and isolated credentials.</td>
</tr>
<tr>
<td><img src="docs/images/today.png" alt="Daily work dashboard showing a task queue and saved context" /></td>
<td><img src="docs/images/providers.png" alt="Provider settings with local and remote example profiles" /></td>
</tr>
</table>

## What you can do today

| Area | Available in the codebase |
| --- | --- |
| Conversations | Typed requests, streaming answers, conversation history, source context, and structured answer views. |
| Voice | Local recognition and speech components, push-to-talk controls, readiness reporting, and interruption. Requires a provisioned speech runtime and models. |
| Projects | Custom goals, optional folders and presets, per-project providers, response languages, references, tasks, notes, and checkpoints. |
| Daily work | Quick capture, a task queue, saved sources, routines, reminders, and resuming work with its context. |
| Developer tools | Native project file browsing and editing, terminal commands, Git views, and website previews. |
| Maps and research | Map browsing, place details, selected-business research, source links, and a business-to-website workflow. External sources can be unavailable. |
| Control and recovery | Plans, tiered confirmation, execution history, and undo receipts for supported reversible actions. |

**This is a development preview.** The spatial control room, multi-agent visualizer, some world telemetry layers, and parts of browser automation contain demonstration or placeholder behavior. Wake-word activation is unavailable. Android companion integration and private remote access are under development. Their presence in the architecture map does not mean they are released or verified end to end.

## How it fits together

The React interface presents work and context. Tauri connects it to the Rust runtime, which owns execution, approval, recovery, and local records. Local speech helpers provide recognition and playback. The model endpoint comes from the selected provider profile; optional Python tools extend the desktop runtime.

![FRIDAY Floorplan overview connecting the desktop, Windows runtime, local records, helpers, and outside services](docs/images/floorplan-overview.png)

<details>
<summary><strong>Open the desktop subsystem view</strong></summary>

![Floorplan detail showing FRIDAY's desktop navigation, conversation, project, daily-work, and map modules](docs/images/floorplan-desktop.png)

</details>

[Download the interactive Floorplan](https://raw.githubusercontent.com/anes-jpg/friday/master/docs/architecture/index.html) and open the saved HTML in a browser. It includes file descriptions, connections, and guided flows in one offline file. GitHub displays HTML as source; the downloaded map supports navigation without a hosted service. See [map notes](docs/architecture/README.md) for scope and attribution.

| Directory | Responsibility |
| --- | --- |
| [`src/`](src) | React screens, state, UI components, and the desktop command bridge. |
| [`src-tauri/`](src-tauri) | Native Windows integration, task execution, providers, speech, tools, and SQLite persistence. |
| [`core/`](core) | Local speech adapter and optional Python tools. |
| [`scripts/`](scripts) | Local services, maintenance, and browser verification. |
| [`android-client/`](android-client) | Android companion development. |
| [`tests/`](tests) | Frontend logic, component, and helper regressions. |
| [`docs/`](docs) | Architecture decisions, engineering reviews, plans, and screenshots. |

## Get started

### Explore the interface

Use Node.js, pnpm, and Git. From the repository root:

```powershell
git clone https://github.com/anes-jpg/friday.git
cd friday
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:1420/?surface=console`. The browser preview supports planning and UI exploration. Windows commands, protected credentials, folder picking, and native speech are available in the desktop app.

### Run the Windows app

Install the Rust toolchain, Microsoft C++ Build Tools with a Windows SDK, and WebView2. Provision the local assets listed in [`tauri.conf.json`](src-tauri/tauri.conf.json), then run:

```powershell
pnpm tauri dev
```

Model weights under `models/` are intentionally excluded from Git. Native build and packaging need the configured resources on disk. Local recognition also needs an external Python runtime with the speech packages used by [`stt_daemon.py`](core/stt_daemon.py): `needle`, `sounddevice`, and `numpy`. [`discovery.rs`](src-tauri/src/voice/discovery.rs) documents runtime discovery and the `FRIDAY_PYTHON` override. Piper requires compatible local voice files; the Python playback helper additionally uses `piper-tts`.

In **Settings → Providers**, save the base URL, exact model name, API mode, and credentials for your provider. Test the connection before sending work. You can save several profiles and select a different one in each project.

### Build Windows installers

The current package version is **1.0.0**. With native prerequisites and local resources available:

```powershell
pnpm tauri build --bundles 'nsis,msi'
```

Outputs are written under `src-tauri/target/release/bundle/`: NSIS EXE and WiX MSI. Release signing, update delivery, and clean-machine installation are separate rollout gates.

## Controls

| Shortcut | Action |
| --- | --- |
| `Alt+Shift` | Hold to speak and release to submit; tap to toggle listening. |
| `Escape` | Interrupt the active turn or dismiss the current overlay. |
| `Ctrl+K` | Open the command palette. |
| `F11` | Toggle fullscreen. |
| `Ctrl+Shift+F11` | Open the spatial control room. |
| `Ctrl+Alt+Space` | Default quick capture shortcut; configurable in daily workflow settings. |

## Verification

```powershell
pnpm check
pnpm test run
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

The onboarding review covers repeated project switching, custom setup, field errors and focus, draft protection, saved guide progress, small windows, long content, and reduced motion. Read the [verification notes](docs/onboarding-review-2026-10-30.md). Browser regression and screenshot scripts reuse an existing Playwright installation and Chromium; they add no project dependency.

Voice latency budgets are engineering targets. The UI review does not establish microphone accuracy, audible playback, or native voice performance. Production bundling currently reports large-chunk and mixed-import warnings.

## Data and control

- Speech recognition and synthesis are designed to run locally. Model requests go to the local or remote provider you choose.
- Desktop workspace records live locally in SQLite. Browser-preview records use browser storage.
- Native provider credentials are isolated in Windows Credential Manager and are not returned to the settings UI.
- Attached files, captured sources, and selected context can be included in model requests. Map, research, and optional cloud tools contact their configured services.
- Undo applies to supported actions with receipts. Confirmations and results should be assessed against the actual run history.

## Contributing

Start with [AGENTS.md](AGENTS.md), [DESIGN.md](DESIGN.md), and the [architecture decisions](docs/adr). Preserve the design laws, keep provider choices flexible, and verify behavior before claiming success. New dependencies require an ADR.

The repository does not currently include a root project license. Bundled assets and the Floorplan export retain their own license notices.

## 2026 rollout roadmap

Updated **30 October 2026**. The remaining-year targets below are development priorities for **November–December**, subject to verification and release readiness; they are not guaranteed shipment dates.

| Feature or improvement | 2026 status / target |
| --- | --- |
| Project switching and flexible setup | Completed in October: one selected-project identity, custom goals and languages, optional folders and presets, provider choice, and draft protection. |
| Resumable onboarding | Completed in October: goal-based entry points, separate progress and completion, reachable actions, keyboard focus, and reduced-motion checks. |
| Research reliability | November–December target: source-backed answers, faithful response rendering, retrieved images, and clear unavailable-source states. |
| Business research controls | November–December target: clearer selected-branch extraction, cancellation, and protection against late results. |
| Android companion | November–December target: readable answer history, on-device dictation where supported, paired desktop requests, and approvals tied to the originating session. |
| Private remote companion access | November–December target: hotspot pairing, private Tailscale HTTPS, revocation, reconnection, and gateway lifecycle checks. |
| Voice readiness and performance | November–December target: simpler runtime provisioning and measured microphone, playback, interruption, and latency checks on Windows hardware. |
| Distribution and updates | November–December target: reproducible packaging, signing, update verification, and clean-machine install checks before a public release. |
| Architecture and product clarity | Ongoing through year end: refreshed Floorplan snapshots, verified screenshots, and clear separation of working, experimental, and planned features. |
