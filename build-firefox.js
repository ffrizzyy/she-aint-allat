// Builds dist/firefox from the Chrome sources plus manifest.firefox.json. No dependencies.
// Run: node build-firefox.js
const fs = require('fs');
const out = 'dist/firefox';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const runtime = (f) => /\.(js|html|css)$/.test(f) && !/\.test\.js$/.test(f) && f !== 'build-firefox.js';
const files = fs.readdirSync('.').filter(runtime);
for (const f of files) fs.copyFileSync(f, `${out}/${f}`);
fs.copyFileSync('manifest.firefox.json', `${out}/manifest.json`);
console.log(`dist/firefox: ${files.length + 1} files`);
