# FRIDAY Android companion

The Android app sends reviewed text or locally dictated instructions to the Windows AgentCore. It shows actual desktop progress, approval previews, results and receipt-specific undo. It can also request an authenticated desktop screenshot. It connects while the app is in the foreground.

## Install and pair

1. Install **FRIDAY-Companion-1.1-android-debug.apk** from the [preview release](https://github.com/anes-jpg/friday/releases/tag/v1.0.0-preview.20261030), or build `app/build/outputs/apk/debug/app-debug.apk`. This is a debug-signed APK; allow installation from the app used to open it.
2. Install the companion Python runtime using the [setup guide](../docs/releases/INSTALL.md). Start the Windows preview from the same release. Open **Settings → Android companion → Enable companion**.
3. Connect through the laptop hotspot or local network, or connect Tailscale on both devices for remote access. Enter the displayed desktop address and six-digit pairing code in the Android app.
4. Send a typed instruction, or use **Dictate locally**, review the transcript and tap **Send**. On-device dictation requires Android 12+ and an installed on-device recognition service/language. Android 7+ can use typed input.
5. Review an amber preview and choose **Go ahead** within eight seconds. For a red preview, read the full details and type **confirm**. Use **Cancel** to stop an active request. **Undo** appears only when Windows recorded a valid inverse receipt.

Codes expire after five minutes and rotate after pairing. Phone credentials expire after 24 hours or when the gateway stops. Revoke phones in Windows settings, or choose **Unpair and revoke access** on Android. A lost connection never queues instructions for automatic replay; reconnect to retrieve the last desktop snapshot.

Windows Mobile Hotspot normally uses `http://192.168.137.1:18420`; the laptop's Wi-Fi address belongs to another adapter. The gateway now prefers the active hotspot address for local pairing. Windows Firewall may request access when the gateway starts; allow it on your private network.

For use outside the house, connect Tailscale on Windows and Android under the same account. Enable **HTTPS Certificates** in the Tailscale admin console, then run `scripts/configure_companion_tailscale.ps1` in PowerShell. It sets up private Tailscale Serve HTTPS to the local gateway and saves the address into a git-ignored config file. Reload the gateway once and pair with the displayed HTTPS address. The existing APK supports HTTPS; no replacement APK is required for Tailscale.

Keep the laptop awake, connected to the internet and running FRIDAY. The phone can then use mobile data or another Wi-Fi network with Tailscale switched on. The HTTPS address remains stable when the laptop switches local networks. This setup stays inside the private tailnet and has no public Funnel or background notification service.

Development checkouts can serve their locally built APK at `/download/app.apk`. Installed desktop packages do not bundle this build-output path; use the GitHub release download on your phone.

The managed gateway shuts down when FRIDAY exits. Restarting FRIDAY requires enabling the companion again and pairing with the new displayed code.

## Desktop runtime

The Windows installer bundles gateway scripts, but Python and its packages must be installed separately. Follow the [installation guide](../docs/releases/INSTALL.md) for a user-local environment and the `FRIDAY_PYTHON` setting.

For development, create a venv from the repository root with Python 3.12+:

```powershell
py -3.12 -m venv .companion-venv
.\.companion-venv\Scripts\python.exe -m pip install -r scripts/companion-requirements.txt
```

A Windows app built from the checkout uses this venv when it exists. Other installations discover the interpreter through `FRIDAY_PYTHON` or the installed Python paths. Use the managed gateway in Windows settings for desktop actions.

The desktop executable embeds its frontend. After changing companion settings, run `pnpm tauri build --no-bundle` and restart `src-tauri/target/release/friday.exe`. Running `pnpm build` alone does not update a running desktop executable.

## Build and verify

From `android-client`:

```powershell
.\gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest --console=plain
```

From the repository root:

```powershell
.\.companion-venv\Scripts\python.exe -m pip install -r scripts/companion-test-requirements.txt
.\.companion-venv\Scripts\python.exe -m unittest discover -s tests -p 'companion*_test.py' -v
cargo test --manifest-path src-tauri/Cargo.toml --lib companion -- --nocapture
pnpm check
pnpm build
```

The 30 October preview passed 8 Android unit tests, APK signature verification, and 18 Python companion tests. Android lint reported 0 errors and 33 warnings. The native companion ownership test passed. No phone or emulator was available to run instrumentation or verify dictation on hardware.
