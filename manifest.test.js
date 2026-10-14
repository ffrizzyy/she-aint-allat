// Run: node manifest.test.js
// Keeps the Chrome and Firefox manifests from drifting apart.
const assert = require('node:assert');
const fs = require('node:fs');
const c = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const f = JSON.parse(fs.readFileSync('manifest.firefox.json', 'utf8'));

for (const k of ['manifest_version', 'name', 'version', 'permissions', 'optional_host_permissions', 'action', 'options_ui', 'content_security_policy', 'incognito']) {
  assert.deepEqual(f[k], c[k], `${k} differs between manifests`);
}
assert.equal(c.background.service_worker, 'background.js');
assert.deepEqual(f.background.scripts, ['rules.js', 'background.js'], 'Firefox has no importScripts, so rules.js must load first');
assert(f.browser_specific_settings.gecko.id, 'Firefox needs an add-on id');

// Every file a manifest names exists.
for (const p of [c.action.default_popup, c.options_ui.page, c.background.service_worker, ...f.background.scripts]) assert(fs.existsSync(p), `missing ${p}`);

// Files that options.js injects into pages exist.
const list = fs.readFileSync('options.js', 'utf8').match(/const FILES = \[(.*?)\]/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
for (const n of list) assert(fs.existsSync(n), `missing ${n}`);

// background.js must guard importScripts, or it throws in a Firefox event page.
assert(/typeof importScripts === 'function'/.test(fs.readFileSync('background.js', 'utf8')));
console.log('manifest ok');
