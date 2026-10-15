// Service worker: pool pick, ladder escalation, event log, badge. No network.
if (typeof importScripts === 'function') importScripts('rules.js'); // service worker (Chrome). Firefox loads rules.js from the manifest.
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

// FR-07: night pool by local hour, favorites weighted, no immediate repeat.
async function pick() {
  const { rules } = SAA;
  const pool = rules.poolFor(rules.withReasons(await get('pool', []), await get('reasons', [])), new Date().getHours());
  const { last } = await chrome.storage.session.get('last');
  const p = rules.choose(pool, last, Math.random);
  if (!p) return { type: 'text', value: null };
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
    const settings = await get('settings', {});
    if ((settings.snoozeUntil || 0) > Date.now()) return null; // FR-08: snoozed, the content script also checks
    const { fires = {} } = await chrome.storage.session.get('fires');
    const now = Date.now();
    let level = SAA.rules.level(trig.level, fires[trig.id] || [], now), url;
    fires[trig.id] = [...(fires[trig.id] || []).filter((x) => x > now - SAA.rules.WINDOW), now];
    await chrome.storage.session.set({ fires });
    if (level === 3) { // FR-05: opt-in redirect. Falls back to level 2 without a valid target, or if this tab was redirected in the last 30 s (no loops).
      const { redirected = {} } = await chrome.storage.session.get('redirected');
      const tab = sender.tab && sender.tab.id;
      const target = SAA.rules.validRedirect(settings.redirectUrl || '');
      if (!target || redirected[tab] > now - 30e3) level = 2;
      else { url = target; redirected[tab] = now; await chrome.storage.session.set({ redirected }); }
    }
    const id = crypto.randomUUID();
    await logEvent({ id, at: Date.now(), domain: msg.domain, triggerId: trig.id, level, response: null }); // never URL, query or text
    return { eventId: id, level, url, item: level === 3 ? null : await pick() };
  }
  if (msg.type === 'resp') {
    await locked(async () => {
      const events = await get('events', []);
      const e = events.find((x) => x.id === msg.eventId);
      if (e) { e.response = msg.response; await chrome.storage.local.set({ events }); }
    });
    return;
  }
  if (msg.type === 'support') { // SAF-04: one tap from the overlay
    await chrome.tabs.create({ url: chrome.runtime.getURL('support.html') });
    return;
  }
  if (msg.type === 'manual') { // popup: urge button (FR-03) and "I looked anyway" (FR-11)
    await logEvent({ id: crypto.randomUUID(), at: Date.now(), domain: '', triggerId: null, level: null, response: msg.response });
    return msg.response === 'manual' ? pick() : null;
  }
}
