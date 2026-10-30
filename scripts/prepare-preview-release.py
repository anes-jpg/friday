"""Prepare FRIDAY's checked preview artifacts; performs no upload or Git mutation."""
import hashlib
import json
import re
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "scratch/release-upload"
TAG = "v1.0.0-preview.20261030"
SOURCE_NAME = "FRIDAY-preview-2026-10-30-source.zip"
DOC_PATHS = [
    "README.md", "android-client/README.md", "docs/plans/release-downloads.md",
    "docs/releases/INSTALL.md", "docs/releases/preview-2026-10-30.md",
    "scripts/create-release-covers.py", "scripts/prepare-preview-release.py",
    "scripts/publish-preview-release.ps1", "scripts/verify-release-readme.mjs",
    "docs/images/releases/friday-windows-exe-cover.png",
    "docs/images/releases/friday-windows-msi-cover.png",
    "docs/images/releases/friday-android-cover.png",
    "docs/images/releases/friday-release-cover.png",
]
SOURCE_ROOTS = [
    "src", "src-tauri/src", "src-tauri/capabilities", "src-tauri/icons", "core",
    "android-client/app/src", "android-client/gradle", "tests", "public",
    "docs/adr", "docs/images", "docs/architecture",
]
SOURCE_FILES = [
    ".gitignore", "AGENTS.md", "DESIGN.md", "package.json", "pnpm-lock.yaml",
    "index.html", "tsconfig.json", "tsconfig.node.json", "vite.config.ts",
    "components.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock",
    "src-tauri/build.rs", "src-tauri/tauri.conf.json", "src-tauri/windows.manifest",
    "android-client/build.gradle.kts", "android-client/settings.gradle.kts",
    "android-client/gradle.properties", "android-client/gradlew",
    "android-client/gradlew.bat", "android-client/app/build.gradle.kts",
    "scripts/remote_gateway.py",
    "scripts/companion_gateway.py", "scripts/companion_protocol.py",
    "scripts/companion-requirements.txt", "scripts/companion-test-requirements.txt",
    "scripts/configure_companion_tailscale.ps1", "scripts/piper_server.py",
    "scripts/speech_service.ps1", "scripts/ocr_service.ps1",
    "scripts/verify-workspace-ui.mjs", "scripts/capture-repository-ui.mjs",
]
EXCLUDED_PARTS = {
    ".git", ".agents", ".codex", "node_modules", ".venv", ".companion-venv",
    "__pycache__", "target", "build", ".gradle", ".kotlin", "models",
}
EXCLUDED_SUFFIXES = {
    ".apk", ".exe", ".dll", ".msi", ".onnx", ".bin", ".db", ".sqlite",
    ".sqlite3", ".log", ".pyc", ".pyd", ".wav", ".mp4", ".zip", ".jks",
    ".keystore", ".pfx", ".p12", ".pem", ".key",
}
SECRET_PATTERN = re.compile(rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-proj-[A-Za-z0-9_-]{30,}|AIza[A-Za-z0-9_-]{35})")


def git(*args):
    return subprocess.run(["git", "-C", str(ROOT), *args], check=True,
        capture_output=True).stdout


def file_record(path, name=None):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"name": name or path.name, "size": path.stat().st_size, "sha256": digest.hexdigest()}


def source_candidates():
    names = git("ls-files", "-z", "--cached", "--others", "--exclude-standard",
        "--", *SOURCE_ROOTS).decode().split("\0")
    paths = {ROOT / name for name in names if name}
    paths.update(ROOT / name for name in SOURCE_FILES + DOC_PATHS)
    vendor = ROOT / "vendor/sherpa-onnx"
    paths.add(vendor / "LICENSE")
    paths.add(vendor / "sherpa-onnx/rust/Cargo.toml")
    for crate in ("sherpa-onnx", "sherpa-onnx-sys"):
        paths.update((vendor / "sherpa-onnx/rust" / crate).rglob("*"))
    selected = []
    for path in sorted(paths):
        relative = path.relative_to(ROOT)
        if set(relative.parts) & EXCLUDED_PARTS or path.suffix.lower() in EXCLUDED_SUFFIXES:
            continue
        if path.name.startswith(".env") or path.name in {"local.properties", "companion-local.json"}:
            continue
        if path.is_symlink() or not path.is_file():
            continue
        if not path.resolve().is_relative_to(ROOT.resolve()):
            raise ValueError(f"Source path leaves workspace: {relative}")
        if path.stat().st_size > 32 * 1024 * 1024:
            raise ValueError(f"Review oversized source file before packaging: {relative}")
        if SECRET_PATTERN.search(path.read_bytes()):
            raise ValueError(f"Possible credential in source file; review before packaging: {relative}")
        selected.append(path)
    required = ["src-tauri/src/companion.rs", "src-tauri/src/tools/web_content.rs",
        "android-client/app/src/main/java/com/example/fridaymobile/network/CompanionEndpoint.kt",
        "vendor/sherpa-onnx/sherpa-onnx/rust/sherpa-onnx-sys/build.rs"]
    included = {path.relative_to(ROOT).as_posix() for path in selected}
    if not set(required).issubset(included):
        raise ValueError("Required development source is missing")
    for name in SOURCE_FILES + DOC_PATHS:
        if not (ROOT / name).is_file():
            raise ValueError(f"Required source file is missing: {name}")
    return selected


def source_archive(base_commit, generated_at):
    paths = source_candidates()
    records = [file_record(path, path.relative_to(ROOT).as_posix()) for path in paths]
    resources = [file_record(path, path.relative_to(ROOT).as_posix())
        for path in sorted((ROOT / "models").rglob("*")) if path.is_file() and not path.is_symlink()]
    resources.append(file_record(ROOT / "public/friday-mobile.apk", "public/friday-mobile.apk"))
    manifest = {
        "repository": "https://github.com/anes-jpg/friday",
        "repositoryBaseCommit": base_commit, "generatedAtUtc": generated_at,
        "includesUncommittedDevelopmentSource": True,
        "scope": "Desktop, Android, helpers, tests, docs, and local Rust speech-wrapper crates",
        "excluded": "Models, environments, credentials, local settings, builds, user records",
        "externalBuildResources": resources, "files": records,
    }
    prefix = "FRIDAY-preview-2026-10-30/"
    destination = OUTPUT / SOURCE_NAME
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path, record in zip(paths, records):
            if file_record(path)["sha256"] != record["sha256"]:
                raise ValueError(f"Source changed during packaging: {record['name']}")
            archive.write(path, prefix + record["name"])
        archive.writestr(prefix + "SOURCE-MANIFEST.json", json.dumps(manifest, indent=2) + "\n")
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise ValueError("Source archive integrity check failed")
        for record in records:
            content = archive.read(prefix + record["name"])
            if hashlib.sha256(content).hexdigest() != record["sha256"]:
                raise ValueError(f"Archived source hash mismatch: {record['name']}")
    return len(records)


def main():
    desktop = json.loads((ROOT / "package.json").read_text())["version"]
    apk = ROOT / "android-client/app/build/outputs/apk/debug/app-debug.apk"
    metadata = json.loads((apk.parent / "output-metadata.json").read_text())
    android = metadata["elements"][0]
    if desktop != "1.0.0" or android["versionName"] != "1.1" or android["versionCode"] != 2:
        raise ValueError("Package versions changed; update the preview release definition")
    if metadata["applicationId"] != "com.friday.mobile":
        raise ValueError("Unexpected Android application ID")
    base_commit = git("rev-parse", "HEAD").decode().strip()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat()
    packages = [
        (ROOT / "src-tauri/target/release/bundle/nsis/friday_1.0.0_x64-setup.exe", "FRIDAY-1.0.0-windows-x64-setup.exe"),
        (ROOT / "src-tauri/target/release/bundle/msi/friday_1.0.0_x64_en-US.msi", "FRIDAY-1.0.0-windows-x64.msi"),
        (apk, "FRIDAY-Companion-1.1-android-debug.apk"),
    ]
    for path, name in packages:
        if not path.is_file():
            raise ValueError(f"Missing package: {path.relative_to(ROOT)}")
        with path.open("rb") as source:
            header = source.read(8)
        if name.endswith(".exe") and not header.startswith(b"MZ"):
            raise ValueError("Invalid EXE header")
        if name.endswith(".msi") and header != bytes.fromhex("D0CF11E0A1B11AE1"):
            raise ValueError("Invalid MSI header")
        if name.endswith(".apk") and not zipfile.is_zipfile(path):
            raise ValueError("Invalid APK archive")
        shutil.copyfile(path, OUTPUT / name)
        if file_record(path)["sha256"] != file_record(OUTPUT / name)["sha256"]:
            raise ValueError(f"Package copy hash mismatch: {name}")
    for path in sorted((ROOT / "docs/images/releases").glob("*.png")):
        shutil.copyfile(path, OUTPUT / path.name)
    shutil.copyfile(ROOT / "scripts/companion-requirements.txt", OUTPUT / "companion-requirements.txt")
    shutil.copyfile(ROOT / "docs/releases/INSTALL.md", OUTPUT / "INSTALL.md")
    shutil.copyfile(ROOT / "docs/releases/preview-2026-10-30.md", OUTPUT / "RELEASE-NOTES.md")
    source_count = source_archive(base_commit, generated_at)
    names = [name for _, name in packages] + [SOURCE_NAME, "INSTALL.md", "companion-requirements.txt"]
    names += [path.name for path in sorted((ROOT / "docs/images/releases").glob("*.png"))]
    assets = [file_record(OUTPUT / name) for name in names]
    docs = [file_record(ROOT / name, name) for name in DOC_PATHS]
    manifest = {
        "schemaVersion": 1, "repository": "anes-jpg/friday", "tag": TAG,
        "title": "FRIDAY preview — Windows 1.0.0 + Android 1.1",
        "repositoryBaseCommit": base_commit, "createdAtUtc": generated_at,
        "sourceArchive": SOURCE_NAME, "sourceFileCount": source_count,
        "sourceIncludesDevelopmentChanges": True,
        "versions": {"windows": desktop, "android": android["versionName"], "androidVersionCode": android["versionCode"]},
        "signing": {"windows": "NotSigned", "android": "Android Debug / APK v2",
            "androidCertificateSha256": "dd4ad2336e2afe01985ed58d93935c915a6408e221e687ec0563600a0473b98d"},
        "verification": {"frontendTestsPassed": 203, "frontendBuild": "passed",
            "windowsBundleBuild": "passed", "androidUnitTestsPassed": 8,
            "androidLintErrors": 0, "androidLintWarnings": 33, "androidSignature": "passed",
            "pythonCompanionTestsPassed": 18, "nativeCompanionTestsPassed": 1,
            "nativeWebResearchTestsPassed": 6,
            "publisherChecks": "Passed in PowerShell 7 and Windows PowerShell 5.1: auth failure, interrupted upload, resume, existing release, digest conflict, exact staging scope",
            "pending": ["Clean-machine Windows installation", "Physical Android and instrumentation",
                "Native speech and latency", "Remote network and Tailscale end-to-end"]},
        "documentsToPublish": docs, "assets": assets,
    }
    manifest_path = OUTPUT / "release-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    checksums = assets + [file_record(manifest_path)]
    (OUTPUT / "SHA256SUMS.txt").write_text("".join(
        f"{record['sha256']}  {record['name']}\n" for record in checksums), encoding="ascii")
    print(f"Prepared {len(checksums) + 1} upload assets and {source_count} source files in {OUTPUT}")
    for record in assets[:3]:
        print(f"{record['name']}: {record['size']:,} bytes / SHA256 {record['sha256']}")


if __name__ == "__main__":
    main()
