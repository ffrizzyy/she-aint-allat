// Pure rules that guard safety: import validation and the escalation ladder. No DOM, no chrome.*.
// Loaded by the service worker (importScripts), the options page, and Node tests.
(function () {
  const KINDS = ['name', 'nick', 'handle', 'hashtag', 'place', 'text', 'url'];
  const SENS = ['strict', 'normal', 'loose'];
  const RESP = ['went_back', 'continued', 'dismissed', 'manual', 'looked', null];
  const WINDOW = 30 * 60e3;
  const DELAY = 24 * 3600e3; // FR-08: a removed trigger stays active this long
  const LETTER_MAX = 20000, LETTERS_CAP = 50;
  const DELAYS = { 1: 864e5, 3: 3 * 864e5, 7: 7 * 864e5, 30: 30 * 864e5 }; // FR-12: chosen delay, in days
  const GRACE = 15 * 60e3; // my addition: a trigger added by mistake can go at once
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const arr = (a) => (Array.isArray(a) ? a : []);
  const uid = () => globalThis.crypto.randomUUID();

  // Ladder (4.3, SAF-05): 3 fires of one trigger within 30 min -> next level, capped at 2.
  // `recent` holds timestamps of earlier fires of that trigger.
  function level(base, recent, now) {
    const n = recent.filter((x) => x > now - WINDOW).length;
    return Math.min(2, (base ?? 1) + (n >= 2 ? 1 : 0));
  }

  // Commitment device (FR-08). 'active' -> 'pending' (24 h) -> 'confirm' (asked once more).
  const removalState = (t, now) => (!t.removeRequestedAt ? 'active' : now - t.removeRequestedAt >= DELAY ? 'confirm' : 'pending');
  // Letters (FR-12). Open is derived from time, shredded means deleted. Locking hides the text from the user, it is not encryption.
  const letterState = (l, now) => (now >= l.unlockAt ? 'open' : 'locked');
  const canRemoveNow = (t, now) => now - (t.createdAt || 0) < GRACE;

  // Import is a trust boundary: validate and cap everything. Returns null for a file that is not ours.
  function clean(o) {
    if (!o || typeof o !== 'object' || o.app !== 'she-aint-allat') return null;
    return {
      triggers: arr(o.triggers).filter((x) => x && typeof x.value === 'string' && x.value.trim()).slice(0, 500).map((x) => ({
        id: str(x.id, 64) || uid(), kind: KINDS.includes(x.kind) ? x.kind : 'text', value: str(x.value, 200),
        sensitivity: SENS.includes(x.sensitivity) ? x.sensitivity : 'normal', level: [0, 1, 2].includes(x.level) ? x.level : 1, createdAt: +x.createdAt || Date.now(), ...(+x.removeRequestedAt ? { removeRequestedAt: +x.removeRequestedAt } : {}) })),
      pool: arr(o.pool).filter((x) => x && typeof x.value === 'string' && (x.type === 'text' || (x.type === 'image' && /^data:image\/(webp|png|jpeg);base64,/.test(x.value) && x.value.length < 3e6))).slice(0, 200).map((x) => ({
        id: str(x.id, 64) || uid(), type: x.type, value: str(x.value, x.type === 'text' ? 500 : 3e6), altText: str(x.altText, 300), category: 'general', favorite: !!x.favorite, pool: x.pool === 'night' ? 'night' : 'day' })),
      events: arr(o.events).slice(-5000).map((x) => ({
        id: str(x && x.id, 64) || uid(), at: +(x && x.at) || 0, domain: str(x && x.domain, 253), triggerId: x && x.triggerId ? str(x.triggerId, 64) : null,
        level: x && [0, 1, 2].includes(x.level) ? x.level : null, response: x && RESP.includes(x.response) ? x.response : null })),
      letters: arr(o.letters).filter((x) => x && typeof x.body === 'string' && x.body.trim() && +x.unlockAt > 0).slice(0, LETTERS_CAP).map((x) => ({
        id: str(x.id, 64) || uid(), body: str(x.body, LETTER_MAX), createdAt: +x.createdAt || Date.now(), unlockAt: +x.unlockAt })),
      locale: o.settings && o.settings.locale === 'id' ? 'id' : 'en'
    };
  }

  const api = { level, clean, removalState, canRemoveNow, letterState, WINDOW, DELAY, GRACE, DELAYS, LETTER_MAX, LETTERS_CAP };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.SAA = Object.assign(globalThis.SAA || {}, { rules: api });
})();
