# ADR 005: Distribution, Code Signing, and Safe Auto-Updates

## Status
Accepted (Phase M10 Release Engineering)

## Context
FRIDAY operates as an elevated helper with hands on the user's desktop (filesystem modifications, clipboard read/write, window inspection, and shell tool execution).
1. Unsigned Windows installers trigger Windows SmartScreen warnings and third-party antivirus false positives, destroying professional trust.
2. In-place auto-updates must be cryptographically verified using public-key cryptography to prevent tampering or man-in-the-middle attacks.
3. System telemetry and crash reports must never expose user screen captures, raw audio buffers, or credential manager secrets.
4. Per-user installation is required to eliminate mandatory UAC administrator elevation during setup.

## Decision
1. **Packaging Formats**:
   - **WiX (MSI)**: Policy and corporate rollout installer targeting per-user directory trees.
   - **NSIS**: Human-friendly installer configured with `installMode: "currentUser"` to eliminate admin prompt requirements and integrate with user autostart.
2. **Code Signing**:
   - Primary: **Azure Trusted Signing** (Identity Verified) integrated into GitHub Actions CI / local release pipeline.
   - Fallback: Hardware Security Module (HSM) EV Code Signing certificate.
3. **Cryptographic Updates**:
   - Use `tauri-plugin-updater` referencing a CDN endpoint (`releases.friday.ai`).
   - Releases are signed with Minisign (`minisign -S -s friday.key -m latest.json`). Any payload failing signature verification is rejected before execution.
4. **Scrubbed Crash Reporting & Privacy**:
   - Opt-in Sentry telemetry with automated PII scrubbers: file paths, API tokens, clipboard snapshots, and audio frames are stripped before dispatch.
   - Clean uninstall provides an explicit "Purge all local databases & memory" toggle.

## Consequences
- **Positive**:
   - Zero SmartScreen warnings on clean Windows 10 & 11 installations.
   - Transparent, seamless auto-updates over standard HTTPS/CDN infrastructure.
   - Compliance with strict privacy and security laws (§08 of Constitution).
- **Negative**:
   - Requires maintaining code signing certificates and Minisign release secret keys.
