// Service worker: pool pick, ladder escalation, event log, badge. No network.
importScripts('rules.js');
const DAY = 864e5;
// One writer at a time: read-modify-write on `events` must not interleave.
let chain = Promise.resolve();
const locked = (fn) => (chain = chain.catch(() => {}).then(fn));

async function get(k, d) { return (await chrome.storage.local.get(k))[k] ?? d; }

chrome.webNavigation.onHistoryStateUpdated.addListener((d) => {
  chrome.tabs.sendMessage(d.tabId, { type: 'url' }, { frameId: d.frameId }).catch(() => {}); // tab may have no content script
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  handle(msg, sender).then(reply, (e) => reply({ error: String(e) }));
  return true;
});

async function pick() {
  const pool = await get('pool', []);
  if (!pool.length) return { type: 'text', value: null };
  const { last } = await chrome.storage.session.get('last');
  const options = pool.length > 1 ? pool.filter((p) => p.id !== last) : pool; // no immediate repeat
  const p = options[Math.floor(Math.random() * options.length)];
  await chrome.storage.session.set({ last: p.id });
  return p;
}

const logEvent = (e) => locked(async () => {
  const events = (await get('events', [])).filter((x) => x.at > Date.now() - 365 * DAY).slice(-4999); // default retention 12 months
  events.push(e);
  await chrome.storage.local.set({ events });
});

async function handle(msg, sender) {
  if (msg.type === 'badge') {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) return;
    const ok = msg.state === 'ok';
    await chrome.action.setBadgeText({ tabId, text: ok ? '•' : '!' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: ok ? '#1B7A46' : '#B42318' });
    return;
  }
  if (msg.type === 'hit') {
    const triggers = await get('triggers', []);
    const trig = triggers.find((t) => t.id === msg.triggerId);
    if (!trig) return null;
    const { fires = {} } = await chrome.storage.session.get('fires');
    const now = Date.now();
    const level = SAA.rules.level(trig.level, fires[trig.id] || [], now);
    fires[trig.id] = [...(fires[trig.id] || []).filter((x) => x > now - SAA.rules.WINDOW), now];
    await chrome.storage.session.set({ fires });
    const id = crypto.randomUUID();
    await logEvent({ id, at: Date.now(), domain: msg.domain, triggerId: trig.id, level, response: null }); // never URL, query or text
    return { eventId: id, level, item: await pick() };
  }
  if (msg.type === 'resp') {
    await locked(async () => {
      const events = await get('events', []);
      const e = events.find((x) => x.id === msg.eventId);
      if (e) { e.response = msg.response; await chrome.storage.local.set({ events }); }
    });
    return;
  }
  if (msg.type === 'manual') { // popup: urge button (FR-03) and "I looked anyway" (FR-11)
    await logEvent({ id: crypto.randomUUID(), at: Date.now(), domain: '', triggerId: null, level: null, response: msg.response });
    return msg.response === 'manual' ? pick() : null;
  }
}
