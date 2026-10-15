// Run: node background.test.js
// Drives background.js with a fake chrome API: ladder, snooze, level 3, event log, pool.
const assert = require('node:assert');

const store = { local: {}, session: {} };
const area = (o) => ({
  get: async (k) => (typeof k === 'string' ? (k in o ? { [k]: structuredClone(o[k]) } : {}) : Object.fromEntries(k.filter((x) => x in o).map((x) => [x, structuredClone(o[x])]))),
  set: async (v) => { await Promise.resolve(); Object.assign(o, structuredClone(v)); }, // a tick of latency makes races visible
  remove: async (k) => { delete o[k]; },
  clear: async () => { for (const k of Object.keys(o)) delete o[k]; }
});
let listener = null;
const created = [], badges = [];
global.chrome = {
  storage: { local: area(store.local), session: area(store.session) },
  runtime: { onMessage: { addListener: (f) => (listener = f) }, getURL: (p) => 'chrome-extension://x/' + p },
  webNavigation: { onHistoryStateUpdated: { addListener() {} } },
  tabs: { sendMessage: async () => {}, create: async (o) => { created.push(o); } },
  action: { setBadgeText: async (o) => { badges.push(o); }, setBadgeBackgroundColor: async () => {} }
};
global.SAA = { rules: require('./rules.js') };
require('./background.js');

const send = (msg, tab = 1) => new Promise((r) => listener(msg, { tab: { id: tab } }, r));
const reset = () => { for (const a of [store.local, store.session]) for (const k of Object.keys(a)) delete a[k]; };
const trig = (o = {}) => ({ id: 't1', kind: 'name', value: 'x', sensitivity: 'normal', level: 1, ...o });

(async () => {
  // unknown trigger
  reset();
  assert.equal(await send({ type: 'hit', triggerId: 'nope', domain: 'a.com' }), null);

  // normal hit: level, item, event logged without anything but domain
  reset();
  store.local.triggers = [trig()];
  store.local.pool = [{ id: 'p1', type: 'text', value: 'breathe' }];
  let r = await send({ type: 'hit', triggerId: 't1', domain: 'a.com' });
  assert.equal(r.level, 1);
  assert.equal(r.item.value, 'breathe');
  assert.equal(r.url, undefined);
  assert.deepEqual(Object.keys(store.local.events[0]).sort(), ['at', 'domain', 'id', 'level', 'response', 'triggerId']);
  assert.equal(store.local.events[0].domain, 'a.com');
  assert.equal(store.local.events[0].response, null);

  // ladder: third fire in 30 min goes to level 2, and stops there
  await send({ type: 'hit', triggerId: 't1', domain: 'a.com' });
  r = await send({ type: 'hit', triggerId: 't1', domain: 'a.com' });
  assert.equal(r.level, 2);
  r = await send({ type: 'hit', triggerId: 't1', domain: 'a.com' });
  assert.equal(r.level, 2, 'never above 2 by escalation');

  // response patches the right event
  await send({ type: 'resp', eventId: r.eventId, response: 'went_back' });
  assert.equal(store.local.events.find((e) => e.id === r.eventId).response, 'went_back');

  // concurrent writes do not lose events (the read-modify-write race)
  reset();
  store.local.triggers = [trig()];
  await Promise.all(Array.from({ length: 25 }, () => send({ type: 'hit', triggerId: 't1', domain: 'a.com' })));
  assert.equal(store.local.events.length, 25, 'no event lost');

  // snooze: nothing happens and nothing is logged
  reset();
  store.local.triggers = [trig()];
  store.local.settings = { snoozeUntil: Date.now() + 60e3 };
  assert.equal(await send({ type: 'hit', triggerId: 't1', domain: 'a.com' }), null);
  assert.equal(store.local.events, undefined);
  store.local.settings = { snoozeUntil: Date.now() - 1 };
  assert.equal((await send({ type: 'hit', triggerId: 't1', domain: 'a.com' })).level, 1, 'expired snooze is over');

  // level 3: needs a valid page, redirects once per tab per 30 s, never from escalation
  reset();
  store.local.triggers = [trig({ level: 3 })];
  r = await send({ type: 'hit', triggerId: 't1', domain: 'a.com' }, 7);
  assert.equal(r.level, 2, 'no page set, falls back to level 2');
  assert.notEqual(r.item, null);
  store.local.settings = { redirectUrl: 'https://example.com/me' };
  r = await send({ type: 'hit', triggerId: 't1', domain: 'a.com' }, 7);
  assert.equal(r.level, 3);
  assert.equal(r.url, 'https://example.com/me');
  assert.equal(r.item, null);
  r = await send({ type: 'hit', triggerId: 't1', domain: 'a.com' }, 7);
  assert.equal(r.level, 2, 'same tab again within 30 s: no redirect loop');
  r = await send({ type: 'hit', triggerId: 't1', domain: 'a.com' }, 8);
  assert.equal(r.level, 3, 'another tab is fine');
  store.local.settings = { redirectUrl: 'http://example.com/insecure' };
  assert.equal((await send({ type: 'hit', triggerId: 't1', domain: 'a.com' }, 9)).level, 2, 'tampered non-https target is refused');
  store.local.triggers = [trig({ level: 1 })];
  store.local.settings = { redirectUrl: 'https://example.com/me' };
  await send({ type: 'hit', triggerId: 't1', domain: 'a.com' }, 10);
  await send({ type: 'hit', triggerId: 't1', domain: 'a.com' }, 10);
  assert.equal((await send({ type: 'hit', triggerId: 't1', domain: 'a.com' }, 10)).level, 2, 'escalation never reaches 3');

  // pool: reasons that opted in are shown, others are not
  reset();
  store.local.triggers = [trig()];
  store.local.reasons = [{ id: 'r1', text: 'reason one', inPool: true }, { id: 'r2', text: 'hidden', inPool: false }];
  r = await send({ type: 'hit', triggerId: 't1', domain: 'a.com' });
  assert.equal(r.item.value, 'reason one');
  assert.equal(r.item.category, 'reality');
  reset();
  store.local.triggers = [trig()];
  r = await send({ type: 'hit', triggerId: 't1', domain: 'a.com' });
  assert.equal(r.item.value, null, 'empty pool: content script shows the built-in line');

  // popup messages: manual shows an item, looked and snoozed only log
  reset();
  store.local.pool = [{ id: 'p1', type: 'text', value: 'hi' }];
  assert.equal((await send({ type: 'manual', response: 'manual' })).value, 'hi');
  assert.equal(await send({ type: 'manual', response: 'looked' }), null);
  await send({ type: 'manual', response: 'snoozed' });
  assert.deepEqual(store.local.events.map((e) => e.response), ['manual', 'looked', 'snoozed']);
  assert(store.local.events.every((e) => e.domain === '' && e.triggerId === null));

  // support link and badge
  await send({ type: 'support' });
  assert.deepEqual(created, [{ url: 'chrome-extension://x/support.html' }]);
  await send({ type: 'badge', state: 'err' }, 5);
  assert.deepEqual(badges.pop(), { tabId: 5, text: '!' });
  console.log('background ok');
})().catch((e) => { console.error(e); process.exit(1); });
