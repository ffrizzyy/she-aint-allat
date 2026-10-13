// Run: node rules.test.js
const assert = require('node:assert');
const { level, clean } = require('./rules.js');

// Ladder
const now = 1e9, min = 60e3;
assert.equal(level(1, [], now), 1);
assert.equal(level(1, [now - min], now), 1);
assert.equal(level(1, [now - min, now - 2 * min], now), 2, 'third fire escalates');
assert.equal(level(2, [now - min, now - 2 * min], now), 2, 'capped at 2 (SAF-05)');
assert.equal(level(0, [now - min, now - 2 * min], now), 1);
assert.equal(level(1, [now - 40 * min, now - 50 * min], now), 1, 'old fires do not count');
assert.equal(level(undefined, [], now), 1, 'default level');

// Import validation
const ok = { app: 'she-aint-allat', triggers: [], pool: [], events: [], settings: {} };
assert.equal(clean(null), null);
assert.equal(clean({ ...ok, app: 'other' }), null);
assert.equal(clean([]), null);
let c = clean({ ...ok, triggers: [{ value: 'Mira', kind: 'bogus', sensitivity: 'x', level: 9 }, { value: '  ' }, null, { value: 5 }] });
assert.equal(c.triggers.length, 1);
assert.deepEqual([c.triggers[0].kind, c.triggers[0].sensitivity, c.triggers[0].level], ['text', 'normal', 1]);
c = clean({ ...ok, triggers: [{ value: 'x'.repeat(999) }] });
assert.equal(c.triggers[0].value.length, 200);
c = clean({ ...ok, pool: [
  { type: 'text', value: 'y'.repeat(5000) },
  { type: 'image', value: 'data:image/webp;base64,AAAA' },
  { type: 'image', value: 'data:image/svg+xml;base64,AAAA' },
  { type: 'image', value: 'https://evil.example/x.png' },
  { type: 'video', value: 'z' }] });
assert.equal(c.pool.length, 2, 'only text and raster data URLs');
assert.equal(c.pool[0].value.length, 500, 'text capped like the UI');
c = clean({ ...ok, pool: Array.from({ length: 300 }, () => ({ type: 'text', value: 'a' })) });
assert.equal(c.pool.length, 200);
c = clean({ ...ok, events: [{ response: 'hacked', level: 7, domain: 'a'.repeat(999) }, null, 3] });
assert.equal(c.events[0].response, null);
assert.equal(c.events[0].level, null);
assert.equal(c.events[0].domain.length, 253);
assert.equal(c.events.length, 3);
assert.equal(clean({ ...ok, settings: { locale: 'fr' } }).locale, 'en');
assert.equal(clean({ ...ok, settings: { locale: 'id' } }).locale, 'id');
console.log('rules ok');
