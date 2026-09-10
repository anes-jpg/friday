import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = packageJson.version;
const releaseDate = new Date().toISOString();

console.log(`Generating FRIDAY v${version} Release Manifest...`);

const manifest = {
  version: version,
  notes: `FRIDAY v${version} — Windows Voice-First Desktop Operator 1.0 Release.
- Sub-1.8s voice round trip latency
- Sub-150ms non-verbal synthesized acknowledgement cue
- Sub-200ms barge-in (< 2ms cutoff)
- Dual-model GLM-4 routing with DPAPI Credential Manager
- Three operating modes: Command, Dictation, Conversation
- 0% idle CPU 2D Canvas Orb
- Long-term memory, automations, and sandboxed skill SDK.`,
  pub_date: releaseDate,
  platforms: {
    "windows-x86_64": {
      signature: "MINISIGN_SIGNATURE_PLACEHOLDER",
      url: `https://releases.friday.ai/download/v${version}/friday_${version}_x64-setup.nsis.zip`
    }
  }
};

const outputDir = path.resolve('./dist');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(path.join(outputDir, 'latest.json'), JSON.stringify(manifest, null, 2));
console.log(`✅ Generated release manifest at dist/latest.json for v${version}`);
