const fs = require('fs');
const { execSync } = require('child_process');

const zips = fs.readdirSync('resources').filter(f => f.endsWith('.zip'));
console.log('Resource zips count:', zips.length);

for (const z of zips) {
  try {
    const out = execSync(`tar -tf "resources/${z}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const lines = out.trim().split('\n').filter(Boolean);
    console.log(`\n=== ${z} (${lines.length} items) ===`);
    console.log(lines.slice(0, 10).join('\n'));
  } catch (e) {
    console.log(`Failed to list ${z}:`, e.message);
  }
}
