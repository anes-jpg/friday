# Install the FRIDAY preview

Windows desktop **1.0.0**, Android companion **1.1**. Preview dated **30 October 2026**.

## Choose a download

| File | Use |
| --- | --- |
| `FRIDAY-1.0.0-windows-x64-setup.exe` | Windows 10 / 11 x64; installs for your account. |
| `FRIDAY-1.0.0-windows-x64.msi` | The same desktop app, packaged for Windows Installer. |
| `FRIDAY-Companion-1.1-android-debug.apk` | Android 7+ companion. Needs the Windows app. |
| `companion-requirements.txt` | Python packages needed by the desktop companion gateway. |
| `FRIDAY-preview-2026-10-30-source.zip` | Development source used for the packages, with a per-file manifest. |
| `SHA256SUMS.txt` | SHA-256 hashes for the uploaded files. |

Download from the [preview release](https://github.com/anes-jpg/friday/releases/tag/v1.0.0-preview.20261030). Use either EXE or MSI. Windows packages are unsigned; Android uses a debug signing certificate. These packages have build and automated test coverage, but clean-machine installation and phone hardware use have not been tested.

To compare a downloaded file with `SHA256SUMS.txt`:

```powershell
Get-FileHash -Algorithm SHA256 .\FRIDAY-1.0.0-windows-x64-setup.exe
```

## Set up Windows

Install the selected Windows package and open FRIDAY. In **Settings → Providers**, enter your provider's base URL, exact model name, API mode, and credentials. Test the connection. Local and remote OpenAI-compatible providers are supported.

Start with a typed request. Local speech needs an external Python interpreter with `needle`, `sounddevice`, and `numpy`, plus compatible local recognition and Piper models. The installer contains the configured speech resource files, but it does not install the Python interpreter or packages. See [voice prerequisites](../../README.md#run-the-windows-app). Wake-word activation is unavailable in this preview.

## Set up the Android companion runtime

Install Python **3.12+** on Windows. Download `companion-requirements.txt` from the same release, open PowerShell in its download folder, and run:

```powershell
$fridayEnvironment = Join-Path $env:LOCALAPPDATA 'FRIDAY\companion-python'
py -3.12 -m venv $fridayEnvironment
$fridayPython = Join-Path $fridayEnvironment 'Scripts\python.exe'
& $fridayPython -m pip install -r .\companion-requirements.txt
[Environment]::SetEnvironmentVariable('FRIDAY_PYTHON', $fridayPython, 'User')
```

Exit FRIDAY and launch it again so it receives the interpreter setting. If you also want desktop speech, install its Python packages in this environment. `FRIDAY_PYTHON` selects the interpreter for both features.

## Install and pair Android

1. Open the APK on your phone and allow installation from the app that opened it.
2. On Windows, open **Settings → Android companion → Enable companion**.
3. Put both devices on a private LAN or the laptop hotspot. Enter the desktop address and six-digit code shown in FRIDAY.
4. Type a request and tap **Send**. On Android 12+, **Dictate locally** also works when an on-device recognition service and language are available. Review the transcript before sending.
5. Review approval details on the phone. Amber actions use **Go ahead**; red actions require typed **confirm**. **Cancel** stops a request. **Undo** is available only for a recorded reversible action.

Keep FRIDAY open and the laptop awake. Codes expire after five minutes. Restarting the gateway requires pairing again; phone credentials expire after 24 hours or gateway shutdown. Revoke a phone from Windows settings or unpair it on Android.

Private remote access uses Tailscale on both devices and the laptop's HTTPS address. See the [companion guide](../../android-client/README.md) for hotspot addresses and Tailscale setup. Keep the gateway on a private network.

## Source and verification

The attached source ZIP contains the development companion and research changes present in these builds. GitHub's automatic source downloads reflect the tagged repository commit, which contains the release documentation; use the named source ZIP for the package source. `SOURCE-MANIFEST.json` inside records file hashes and the repository base commit.

The archive excludes model weights, environments, credentials, local settings, build outputs, and user records. Local Rust speech-wrapper crates and their license notices are included. Rebuilding needs the toolchains and speech resources described in the root README; the archive is not a preconfigured build environment.

Android unit tests, lint, and signature checks do not establish microphone accuracy, networking on a physical phone, or clean-machine Windows behavior. See `release-manifest.json` for the checks performed and their results.
