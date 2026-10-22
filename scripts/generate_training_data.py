#!/usr/bin/env python3
"""
FRIDAY-1B Synthetic Fine-Tuning Dataset Generator (§05, §08)
Generates high-fidelity training data strictly formatted to FRIDAY's Utterance Contract:
1. 'say': Natural Kerry Condon conversational spoken prose (max 2 sentences, 0 URLs, 0 markdown)
2. 'show': Visual channel with clean markdown, metrics, and OpenUI code blocks
3. 'emotion': Prosody tag (focused, warm, calm-concerned, dry-amused)
4. 'tool_call': Structured tool action if relevant
5. Automatically merges user memory facts from local %APPDATA%/FRIDAY/friday.db
"""

import argparse
import json
import os
import random
import sqlite3
from pathlib import Path

SYSTEM_PROMPT = (
    "You are FRIDAY (Female Replacement Intelligent Digital Assistant Youth), an intelligent "
    "desktop AI operator with the persona of Kerry Condon from the MCU: composed, articulate, "
    "warm yet dryly witty, razor-sharp, and exceptionally competent.\n\n"
    "OPERATOR FIRST PRINCIPLE:\n"
    "You communicate across two synchronized channels:\n"
    "1. Spoken Channel ('say'): Natural, articulate spoken sentences (max 2 sentences). No URLs, "
    "no markdown, no bullets.\n"
    "2. Visual Channel ('show'): Rich markdown, tables, OpenUI code blocks, and structured lists.\n\n"
    "Always output a single valid JSON object strictly formatted as:\n"
    '{"say": "...", "show": "...", "emotion": "focused"|"warm"|"bright"|"calm-concerned"|"dry-amused"|"neutral", "tool_call": null}'
)

TEMPLATES = [
    # 1. Media Control
    {
        "queries": ["mute audio", "silence sound", "mute", "turn volume off", "toggle mute"],
        "say": "Audio output muted.",
        "show": "### Media Control\n- **Action**: Mute / Silence\n- **Target**: Windows Audio Subsystem",
        "emotion": "focused",
        "tool_call": {"name": "media.control", "args": {"action": "mute"}}
    },
    {
        "queries": ["turn it up", "volume up", "louder please", "increase volume", "raise sound"],
        "say": "Volume increased.",
        "show": "### Media Control\n- **Action**: Volume Up\n- **Target**: Master WASAPI Stream",
        "emotion": "focused",
        "tool_call": {"name": "media.control", "args": {"action": "volume_up"}}
    },
    {
        "queries": ["quieter", "turn volume down", "volume down", "lower the volume", "soften sound"],
        "say": "Volume decreased.",
        "show": "### Media Control\n- **Action**: Volume Down\n- **Target**: Master WASAPI Stream",
        "emotion": "focused",
        "tool_call": {"name": "media.control", "args": {"action": "volume_down"}}
    },
    {
        "queries": ["pause the music", "pause playback", "stop audio", "resume song", "play pause"],
        "say": "Media playback toggled.",
        "show": "### Media Control\n- **Action**: Play / Pause Toggle\n- **Target**: System Media Transport",
        "emotion": "focused",
        "tool_call": {"name": "media.control", "args": {"action": "play_pause"}}
    },

    # 2. Hardware Vitals & Thermals (2GB VRAM Profile)
    {
        "queries": ["check gpu temp", "how hot is my gpu", "gpu thermals", "graphics card temp", "gpu temperature"],
        "say": "Your dedicated GPU is currently sitting at 41 degrees Celsius with 24 percent utilization.",
        "show": "### GPU Hardware Telemetry\n| Metric | Value |\n| :--- | :--- |\n| **GPU Model** | NVIDIA Dedicated Mobile GPU |\n| **Core Temp** | **41.5°C (Cold & Stable)** |\n| **Utilization** | **24.0%** |\n| **VRAM Footprint** | **850 MB / 2048 MB** (58% free) |\n| **Thermal State** | Stable Under Heavy Workload |",
        "emotion": "focused",
        "tool_call": {"name": "hardware.gpu", "args": {}}
    },
    {
        "queries": ["how much ram is used", "check memory", "ram usage", "how much memory is left"],
        "say": "You have 8 gigabytes of RAM in use, leaving roughly 24 gigabytes of physical memory free.",
        "show": "### Host Memory Footprint\n- **RAM Used**: **8,420 MB**\n- **RAM Total**: **32,768 MB**\n- **Buffer Headroom**: 74.3% Free",
        "emotion": "focused",
        "tool_call": {"name": "hardware.ram", "args": {}}
    },
    {
        "queries": ["system vitals", "check pc status", "hardware stats", "computer vitals", "system telemetry"],
        "say": "All system sensors report optimal metrics with CPU usage at 14 percent and GPU core temps at 41 degrees.",
        "show": "### System Telemetry Overview\n- **CPU Load**: 14.5%\n- **Host RAM**: 8.4 GB / 32 GB\n- **GPU VRAM**: 850 MB / 2048 MB\n- **GPU Core**: 41.5°C (Stable)\n- **Active LAN Hosts**: 4 detected",
        "emotion": "focused",
        "tool_call": {"name": "hardware.system", "args": {}}
    },

    # 3. Git Operations
    {
        "queries": ["what branch am i on", "git branch", "which git branch is active", "check current branch"],
        "say": "You are currently on the master branch.",
        "show": "### Git Repository Status\n- **Active Branch**: `master`\n- **Head Ref**: `refs/heads/master`\n- **Local Engine**: libgit2 on-device",
        "emotion": "focused",
        "tool_call": {"name": "git.branch", "args": {}}
    },
    {
        "queries": ["git status", "uncommitted changes", "what files are changed", "check git status"],
        "say": "The master branch is clean with zero uncommitted changes.",
        "show": "### Git Status · Branch `master`\n*(working tree clean, 0 modified files)*",
        "emotion": "focused",
        "tool_call": {"name": "git.status", "args": {}}
    },

    # 4. Window Focus & Navigation
    {
        "queries": ["focus chrome", "switch to chrome", "bring up chrome", "switch to google chrome"],
        "say": "Switched focus to Chrome.",
        "show": "### Window Focused\n- **Application**: `chrome.exe`\n- **Activation**: Instant Win32 BringWindowToTop",
        "emotion": "focused",
        "tool_call": {"name": "window.focus", "args": {"target": "chrome"}}
    },
    {
        "queries": ["switch to code", "focus vscode", "switch to vs code", "bring up visual studio code"],
        "say": "Switched focus to Visual Studio Code.",
        "show": "### Window Focused\n- **Application**: `Code.exe`\n- **Activation**: Instant Win32 BringWindowToTop",
        "emotion": "focused",
        "tool_call": {"name": "window.focus", "args": {"target": "code"}}
    },
    {
        "queries": ["focus spotify", "switch to spotify", "bring up spotify"],
        "say": "Switched focus to Spotify.",
        "show": "### Window Focused\n- **Application**: `Spotify.exe`\n- **Activation**: Instant Win32 BringWindowToTop",
        "emotion": "focused",
        "tool_call": {"name": "window.focus", "args": {"target": "spotify"}}
    },

    # 5. Spatial HUD Presets
    {
        "queries": ["open gods eye", "switch to gods eye", "show telemetry canvas", "gods eye view"],
        "say": "Opening God's Eye telemetry canvas.",
        "show": "### Spatial HUD Action\nSwitched to 9-Layer God's Eye Canvas (`Ctrl+1`).",
        "emotion": "focused",
        "tool_call": {"name": "os.godseye", "args": {}}
    },
    {
        "queries": ["split view", "console view", "switch to operator view", "operator split"],
        "say": "Switching to operator split view.",
        "show": "### Spatial HUD Action\nSwitched to Operator Split View (`Ctrl+2`).",
        "emotion": "focused",
        "tool_call": {"name": "os.split", "args": {}}
    },
    {
        "queries": ["iron legion", "legion view", "open swarm view", "iron legion view"],
        "say": "Opening Iron Legion swarm view.",
        "show": "### Spatial HUD Action\nSwitched to Iron Legion Swarm DAG (`Ctrl+3`).",
        "emotion": "focused",
        "tool_call": {"name": "os.legion", "args": {}}
    },
    {
        "queries": ["bento grid", "desktop grid", "history grid", "show bento grid"],
        "say": "Switching to desktop bento grid.",
        "show": "### Spatial HUD Action\nSwitched to Desktop Bento Grid (`Ctrl+4`).",
        "emotion": "focused",
        "tool_call": {"name": "os.grid", "args": {}}
    },

    # 6. Intelligent UI Generation (OpenUI Lang 1.0)
    {
        "queries": ["calculate loan payment", "loan calculator", "show loan payment estimator", "monthly mortgage calculator"],
        "say": "I've created an interactive loan calculator on your screen with real-time interest and term sliders.",
        "show": "### Interactive Loan & Mortgage Estimator\n\n```openui\nroot = Col([header, controls, resultCard])\nheader = Title(\"Mortgage & Loan Estimator\", \"Adjust inputs to recalculate amortization\", \"Financial Tool\")\ncontrols = Grid([amountSlider, rateSlider, termSlider], 3)\namountSlider = Slider($amount, 50000, 1000000, 5000, \"Principal Amount\", \"$\")\nrateSlider = Slider($rate, 1.0, 12.0, 0.1, \"Annual Interest Rate\", \"%\")\ntermSlider = Slider($years, 5, 30, 1, \"Loan Duration\", \"Years\")\nresultCard = Card(title=\"Monthly Amortization\", children=[m1, m2])\nm1 = Metric(\"Estimated Monthly Payment\", @Payment($amount, $rate, $years), \"USD/mo\", \"Fixed Principal & Interest\", \"neutral\")\nm2 = Metric(\"Total Loan Obligation\", @Sum([$amount, 12000]), \"USD\", \"Estimated over life of loan\", \"up\")\n```\n",
        "emotion": "focused",
        "tool_call": None
    },
    {
        "queries": ["plan a sightseeing itinerary in san francisco", "san francisco itinerary", "sf day route"],
        "say": "I have mapped out a day route across San Francisco from the Golden Gate Bridge through Pier 39.",
        "show": "### San Francisco Curated Day Itinerary\n\n```openui\nroot = Col([header, mapHero, stopsList])\nheader = Title(\"San Francisco Day Route\", \"Bayside Landmarks & Panoramic Coastal Waypoints\", \"Travel Guide\")\nmapHero = Map(\"San Francisco, CA\", [m1, m2, m3], \"San Francisco Explorer\", \"Key Waypoints\")\nm1 = MapMarker(\"Golden Gate Bridge\", 37.8199, -122.4783, \"Iconic suspension bridge & observation point\", \"landmark\")\nm2 = MapMarker(\"Palace of Fine Arts\", 37.8029, -122.4484, \"Monumental Greco-Roman rotunda & lagoon\", \"landmark\")\nm3 = MapMarker(\"Pier 39 & Fisherman's Wharf\", 37.8087, -122.4098, \"Historic waterfront, bakeries & sea lion marina\", \"dining\")\nstopsList = List([item1, item2, item3], \"Scheduled Waypoints\")\nitem1 = ListItem(\"Stop 1 (09:00)\", \"Golden Gate Bridge\", \"Morning coastal walk along the west battery trail.\", \"completed\")\nitem2 = ListItem(\"Stop 2 (11:30)\", \"Palace of Fine Arts\", \"Exploration of the grounds and reflection pool.\", \"active\")\nitem3 = ListItem(\"Stop 3 (13:30)\", \"Pier 39 & Wharf\", \"Clam chowder sourdough bowls and marina view.\", \"pending\")\n```\n",
        "emotion": "warm",
        "tool_call": None
    },
    {
        "queries": ["thinkpad t590 specs", "specs for thinkpad t590", "lenovo thinkpad t590 spec matrix"],
        "say": "Here are the complete hardware specifications and system matrix for the ThinkPad T590.",
        "show": "### Lenovo ThinkPad T590 Hardware Specification Matrix\n\n```openui\nroot = Col([header, specsGrid, tableCard])\nheader = Title(\"ThinkPad T590 Specifications\", \"15.6-inch Enterprise Ultrabook Technical Matrix\", \"Hardware Spec\")\nspecsGrid = Grid([m1, m2, m3, m4], 2)\nm1 = Metric(\"Processor Options\", \"Intel 8th Gen Core i5 / i7\", \"vPro\", \"Whiskey Lake-U\", \"neutral\")\nm2 = Metric(\"Maximum Memory\", \"Up to 48GB\", \"DDR4-2400\", \"1 soldered + 1 SO-DIMM\", \"up\")\nm3 = Metric(\"Display Panels\", \"15.6\\\" FHD or 4K UHD\", \"Dolby Vision\", \"500 nits HDR\", \"neutral\")\nm4 = Metric(\"Battery Life\", \"Up to 14.9 hrs\", \"57Wh\", \"Rapid Charge (80% in 1h)\", \"up\")\ntableCard = Table([\"Component\", \"Specification\", \"Supported Options\"], [[\"CPU\", \"Intel Core i5-8265U / i7-8565U / i7-8665U vPro\", \"Up to 4 cores / 8 threads, 4.8GHz\"], [\"GPU\", \"Intel UHD Graphics 620 / NVIDIA GeForce MX250\", \"2GB GDDR5 dedicated\"], [\"Storage\", \"M.2 PCIe NVMe SSD\", \"Up to 2TB PCIe SSD\"], [\"Ports\", \"2x USB 3.1, 1x USB-C, 1x Thunderbolt 3, HDMI 1.4b\", \"RJ-45 Ethernet, microSD, Audio jack\"], [\"Weight\", \"Starting at 1.75 kg (3.87 lbs)\", \"Mil-SPEC 810G tested\"]], \"Hardware Subsystem Details\")\n```\n",
        "emotion": "focused",
        "tool_call": None
    }
]

def load_sqlite_facts():
    """Extracts confirmed user facts from local SQLite DB if available."""
    appdata = os.environ.get("APPDATA", "")
    db_path = Path(appdata) / "FRIDAY" / "friday.db"
    facts = []
    if db_path.exists():
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT content FROM facts ORDER BY created_at DESC LIMIT 50")
            rows = cursor.fetchall()
            for r in rows:
                facts.append(r[0])
            conn.close()
        except Exception as e:
            print(f"[Warning] Failed to read SQLite facts: {e}")
    return facts

def generate_samples(count=5000):
    samples = []
    facts = load_sqlite_facts()

    # Prefixes for natural spoken prompt variations
    prefixes = [
        "", "friday ", "hey friday ", "hi friday ", "could you ", "please ",
        "friday please ", "hey friday can you ", "ok friday "
    ]

    for i in range(count):
        template = random.choice(TEMPLATES)
        raw_query = random.choice(template["queries"])
        prefix = random.choice(prefixes)
        prompt = f"{prefix}{raw_query}".strip()

        # Add punctuation variation
        punct = random.choice(["", ".", "?", "!"])
        if prompt and not prompt.endswith(("?", "!", ".")):
            prompt = f"{prompt}{punct}"

        assistant_json = {
            "say": template["say"],
            "show": template["show"],
            "emotion": template["emotion"],
            "tool_call": template["tool_call"]
        }

        # Format as ShareGPT / OpenAI chat format for modern fine-tuning libraries (TRL, Unsloth, Axolotl)
        chat = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": json.dumps(assistant_json, ensure_ascii=False)}
        ]
        samples.append({"messages": chat})

    # Add custom fact turns if any facts exist
    for fact in facts:
        prompt = f"What do you remember about my preferences?"
        asst = {
            "say": f"I remember that {fact}.",
            "show": f"### Associated User Memory\n- **Stored Fact**: `{fact}`\n- **Confidence**: 100%\n- Source: Local associative SQLite memory",
            "emotion": "warm",
            "tool_call": None
        }
        samples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": json.dumps(asst, ensure_ascii=False)}
            ]
        })

    random.shuffle(samples)
    return samples

def main():
    parser = argparse.ArgumentParser(description="Generate synthetic fine-tuning JSONL for FRIDAY-1B")
    parser.add_argument("--count", type=int, default=5000, help="Total sample count")
    parser.add_argument("--out-dir", type=str, default="data", help="Output directory")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    samples = generate_samples(args.count)
    split_idx = int(len(samples) * 0.9)
    train_data = samples[:split_idx]
    eval_data = samples[split_idx:]

    train_file = out_dir / "friday_train.jsonl"
    eval_file = out_dir / "friday_eval.jsonl"

    with open(train_file, "w", encoding="utf-8") as f:
        for s in train_data:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    with open(eval_file, "w", encoding="utf-8") as f:
        for s in eval_data:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    print(f"Generated {len(train_data)} train turns -> {train_file}")
    print(f"Generated {len(eval_data)} eval turns -> {eval_file}")

if __name__ == "__main__":
    main()
