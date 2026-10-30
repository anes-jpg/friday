"""Render download covers with bundled fonts and unaltered product captures.

Run from any directory with an existing Pillow installation.
"""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs/images/releases"
SIZE = (1600, 900)
COLORS = {
    "void": "#0A0A0A", "plate": "#151716", "raised": "#1C1E1D",
    "ink": "#F4F3EF", "muted": "#A2A7A4", "line": "#343736",
}
FONTS = ROOT / "src/assets/fonts"
DESKTOP_VERSION = json.loads((ROOT / "package.json").read_text())["version"]
ANDROID_VERSION = re.search(r'versionName = "([^"]+)"',
    (ROOT / "android-client/app/build.gradle.kts").read_text()).group(1)


def font(size, display=False, weight="Medium"):
    face = "ArchivoBlack-Regular.ttf" if display else "Manrope-Variable.ttf"
    result = ImageFont.truetype(str(FONTS / face), size)
    if not display:
        result.set_variation_by_name(weight.encode())
    return result


def text(draw, xy, value, size=24, tone="ink", display=False, weight="Medium"):
    face = font(size, display, weight)
    bounds = draw.textbbox(xy, value, font=face)
    if bounds[2] > SIZE[0] - 48:
        raise ValueError(f"Text exceeds cover width: {value}")
    draw.text(xy, value, fill=COLORS[tone], font=face)


def base(platform, version):
    canvas = Image.new("RGB", SIZE, COLORS["void"])
    draw = ImageDraw.Draw(canvas)
    text(draw, (64, 40), "FRIDAY.", 32, display=True)
    text(draw, (256, 50), platform, 20, "muted")
    text(draw, (1296, 50), version, 20, "muted")
    draw.line((64, 104, 1536, 104), fill=COLORS["line"])
    # Halftone appears only along the edge, clear of all text and screenshots.
    for x in range(1456, 1600, 16):
        for y in range(128, 744, 16):
            draw.ellipse((x, y, x + 2, y + 2), fill=COLORS["line"])
    draw.line((64, 784, 1536, 784), fill=COLORS["line"])
    text(draw, (64, 816), "anes-jpg/friday", 20, "muted")
    text(draw, (1088, 816), "Development preview", 24)
    return canvas, draw


def capture(canvas, source, x, y, width):
    """Scale a complete screenshot; preserve the UI's original proportions."""
    image = Image.open(ROOT / source).convert("RGB")
    height = round(width * image.height / image.width)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=16, fill=255)
    canvas.paste(image, (x, y), mask)
    ImageDraw.Draw(canvas).rounded_rectangle((x, y, x + width - 1, y + height - 1),
        radius=16, outline=COLORS["line"])


def metadata(draw, items, y=528):
    for label, value in items:
        text(draw, (64, y), label, 18, "muted")
        text(draw, (64, y + 28), value, 25, weight="SemiBold")
        y += 88


def windows(kind, name, explanation, source, filename):
    canvas, draw = base("Windows desktop", f"v{DESKTOP_VERSION}")
    text(draw, (64, 168), kind, 112, display=True)
    text(draw, (64, 320), name, 40, weight="SemiBold")
    for index, line in enumerate(explanation):
        text(draw, (64, 392 + index * 36), line, 23, "muted")
    metadata(draw, [("SYSTEM", "Windows 10 / 11 · x64"), ("SIGNING", "Unsigned preview")])
    capture(canvas, source, 616, 128, 900)
    text(draw, (616, 744), "Desktop interface · browser preview capture", 18, "muted")
    canvas.save(OUTPUT / filename, optimize=True)


def android():
    canvas, draw = base("Android companion", f"v{ANDROID_VERSION}")
    text(draw, (64, 168), "APK", 112, display=True)
    text(draw, (64, 320), "Android companion", 40, weight="SemiBold")
    text(draw, (64, 392), "Send requests to Windows.", 23, "muted")
    text(draw, (64, 428), "Read results and approve actions.", 23, "muted")
    metadata(draw, [("SYSTEM", "Android 7+ · typed input"), ("SIGNING", "Android debug certificate")])
    # A connection diagram, with no invented phone interface or device capture.
    draw.rounded_rectangle((592, 144, 1520, 744), radius=16,
        fill=COLORS["plate"], outline=COLORS["line"])
    text(draw, (640, 184), "Android → Windows", 32, weight="SemiBold")
    text(draw, (640, 248), "Pair with the desktop address and code.", 22, "muted")
    text(draw, (640, 288), "FRIDAY must stay open on the laptop.", 22, "muted")
    capture(canvas, "docs/images/workspace.png", 640, 352, 512)
    draw = ImageDraw.Draw(canvas)
    text(draw, (1192, 392), "Connection", 20, "muted")
    text(draw, (1192, 432), "Private LAN", 24, weight="SemiBold")
    text(draw, (1192, 472), "or Tailscale", 24, weight="SemiBold")
    text(draw, (1192, 560), "Dictation", 20, "muted")
    text(draw, (1192, 600), "Android 12+", 24, weight="SemiBold")
    text(draw, (1192, 640), "Local service required", 17, "muted")
    canvas.save(OUTPUT / "friday-android-cover.png", optimize=True)


def overview():
    canvas, draw = base("Preview downloads", "30 Oct 2026")
    text(draw, (64, 152), "FRIDAY.", 76, display=True)
    text(draw, (64, 264), "Windows + Android", 35, weight="SemiBold")
    text(draw, (64, 344), "Choose a package for your device.", 23, "muted")
    metadata(draw, [(f"WINDOWS {DESKTOP_VERSION}", "EXE setup / MSI package"),
        (f"ANDROID {ANDROID_VERSION}", "Companion APK")], y=456)
    text(draw, (64, 672), "Checksums and setup guide included.", 21, "muted")
    capture(canvas, "docs/images/today.png", 616, 128, 900)
    text(draw, (616, 744), "Desktop interface · browser preview capture", 18, "muted")
    canvas.save(OUTPUT / "friday-release-cover.png", optimize=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    windows("EXE", "Windows setup", ["Install for your Windows account."],
        "docs/images/workspace.png", "friday-windows-exe-cover.png")
    windows("MSI", "Windows Installer", ["Install with Windows Installer."],
        "docs/images/providers.png", "friday-windows-msi-cover.png")
    android()
    overview()
    for path in sorted(OUTPUT.glob("*.png")):
        with Image.open(path) as image:
            if image.size != SIZE:
                raise ValueError(f"Unexpected image dimensions: {path}")
        print(f"Created {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
