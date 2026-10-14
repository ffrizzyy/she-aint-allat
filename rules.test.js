// Run: node rules.test.js
const assert = require('node:assert');
const { level, clean, removalState, canRemoveNow, letterState, withReasons, move, REASON_MAX, REASONS_CAP, DELAYS, LETTER_MAX, LETTERS_CAP, DELAY, GRACE } = require('./rules.js');

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
// FR-08: commitment device
const h = 3600e3;
assert.equal(removalState({}, now), 'active');
assert.equal(removalState({ removeRequestedAt: now - h }, now), 'pending');
assert.equal(removalState({ removeRequestedAt: now - DELAY + 1 }, now), 'pending', 'still active just before 24 h');
assert.equal(removalState({ removeRequestedAt: now - DELAY }, now), 'confirm', 'asked once more at 24 h');
assert.equal(canRemoveNow({ createdAt: now - 5 * min }, now), true, 'added by mistake');
assert.equal(canRemoveNow({ createdAt: now - GRACE }, now), false);
assert.equal(canRemoveNow({}, now), false, 'unknown age is not a free pass');
assert.equal(clean({ ...ok, triggers: [{ value: 'a', removeRequestedAt: 123456 }] }).triggers[0].removeRequestedAt, 123456);
assert.equal('removeRequestedAt' in clean({ ...ok, triggers: [{ value: 'a', removeRequestedAt: 'nope' }] }).triggers[0], false);
// FR-12: letters
assert.equal(letterState({ unlockAt: now + 1 }, now), 'locked');
assert.equal(letterState({ unlockAt: now }, now), 'open');
assert.deepEqual(Object.keys(DELAYS), ['1', '3', '7', '30']);
c = clean({ ...ok, letters: [
  { body: 'dear you', unlockAt: now + 1 },
  { body: '   ', unlockAt: now + 1 },
  { body: 'no date' },
  { body: 'bad date', unlockAt: 'soon' },
  { body: 5, unlockAt: now },
  null,
  { body: 'x'.repeat(LETTER_MAX + 500), unlockAt: now }] });
assert.equal(c.letters.length, 2);
assert.equal(c.letters[1].body.length, LETTER_MAX);
assert.equal(clean({ ...ok, letters: Array.from({ length: 99 }, () => ({ body: 'a', unlockAt: now })) }).letters.length, LETTERS_CAP);
assert.deepEqual(clean(ok).letters, []);
// FR-13: reality check
const R = [{ id: 'a', text: 'one', inPool: true }, { id: 'b', text: 'two', inPool: false }, { id: 'c', text: 'three', inPool: true }];
const merged = withReasons([{ id: 'p1', type: 'text', value: 'hi' }], R);
assert.deepEqual(merged.map((x) => x.value), ['hi', 'one', 'three'], 'only opted-in reasons join the pool');
assert.equal(merged[1].category, 'reality');
assert.equal(merged[1].id, 'reason-a');
assert.deepEqual(withReasons([], []), []);
assert.deepEqual(move(R, 'b', -1).map((x) => x.id), ['b', 'a', 'c']);
assert.deepEqual(move(R, 'b', 1).map((x) => x.id), ['a', 'c', 'b']);
assert.deepEqual(move(R, 'a', -1), R, 'top stays put');
assert.deepEqual(move(R, 'c', 1), R, 'bottom stays put');
assert.deepEqual(move(R, 'zzz', 1), R, 'unknown id is a no-op');
assert.equal(R[0].id, 'a', 'move does not mutate');
c = clean({ ...ok, reasons: [{ text: 'kept', inPool: 1 }, { text: '  ' }, { text: 5 }, null, { text: 'y'.repeat(999) }] });
assert.equal(c.reasons.length, 2);
assert.equal(c.reasons[0].inPool, true);
assert.equal(c.reasons[1].text.length, REASON_MAX);
assert.equal(clean({ ...ok, reasons: Array.from({ length: 80 }, () => ({ text: 'a' })) }).reasons.length, REASONS_CAP);
console.log('rules ok');
