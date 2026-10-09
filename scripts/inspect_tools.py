import re
from pathlib import Path

content = Path("src-tauri/src/tools/mod.rs").read_text(encoding="utf-8")
matches = re.findall(r'name:\s*"([^"]+)"[\s\S]*?schema:\s*json!\((\{[\s\S]*?\})\)\s*,?\s*\}', content)

print(f"Total tools found: {len(matches)}")
missing = []
for name, schema in matches:
    if '"required"' not in schema:
        missing.append((name, schema))

print(f"Tools missing 'required' ({len(missing)}):")
for name, schema in missing:
    print(f"  - {name}: {schema.strip()}")
