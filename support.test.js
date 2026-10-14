// Run: node support.test.js
const assert = require('node:assert');
const { isSafeHost } = require('./matcher.js');
const { regions, order } = require('./resources.js');

// isSafeHost: exact, subdomain, and lookalikes that must NOT pass
assert(isSafeHost('findahelpline.com'));
assert(isSafeHost('www.samaritans.org'));
assert(!isSafeHost('evil988lifeline.org'));
assert(!isSafeHost('988lifeline.org.evil.com'));
assert(!isSafeHost('example.com'));

// SAF-01 and FR-15 stay in sync: every support link is a site we never intercept.
for (const r of order) {
  assert(regions[r] && regions[r].length > 0, `${r} has entries`);
  for (const e of regions[r]) {
    assert(e.name && ['emergency', 'crisis', 'directory'].includes(e.kind), `${e.name} kind`);
    assert(e.tel || e.url, `${e.name} has a way to reach it`);
    if (e.url) assert(isSafeHost(new URL(e.url).hostname), `${e.url} must be on the never-intercept list`);
    if (e.tel) assert(/^\d{3,6}$/.test(e.tel), `${e.name} tel is digits only`);
  }
  if (r !== 'GLOBAL') assert(regions[r].some((e) => e.kind === 'emergency'), `${r} lists emergency services`);
}
console.log('support ok');
