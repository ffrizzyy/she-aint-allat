// Pure rules that guard safety: import validation and the escalation ladder. No DOM, no chrome.*.
// Loaded by the service worker (importScripts), the options page, and Node tests.
(function () {
  const KINDS = ['name', 'nick', 'handle', 'hashtag', 'place', 'text', 'url'];
  const SENS = ['strict', 'normal', 'loose'];
  const RESP = ['went_back', 'continued', 'dismissed', 'manual', 'looked', null];
  const WINDOW = 30 * 60e3;
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const arr = (a) => (Array.isArray(a) ? a : []);
  const uid = () => globalThis.crypto.randomUUID();

  // Ladder (4.3, SAF-05): 3 fires of one trigger within 30 min -> next level, capped at 2.
  // `recent` holds timestamps of earlier fires of that trigger.
  function level(base, recent, now) {
    const n = recent.filter((x) => x > now - WINDOW).length;
    return Math.min(2, (base ?? 1) + (n >= 2 ? 1 : 0));
  }

  // Import is a trust boundary: validate and cap everything. Returns null for a file that is not ours.
  function clean(o) {
    if (!o || typeof o !== 'object' || o.app !== 'she-aint-allat') return null;
    return {
      triggers: arr(o.triggers).filter((x) => x && typeof x.value === 'string' && x.value.trim()).slice(0, 500).map((x) => ({
        id: str(x.id, 64) || uid(), kind: KINDS.includes(x.kind) ? x.kind : 'text', value: str(x.value, 200),
        sensitivity: SENS.includes(x.sensitivity) ? x.sensitivity : 'normal', level: [0, 1, 2].includes(x.level) ? x.level : 1, createdAt: +x.createdAt || Date.now() })),
      pool: arr(o.pool).filter((x) => x && typeof x.value === 'string' && (x.type === 'text' || (x.type === 'image' && /^data:image\/(webp|png|jpeg);base64,/.test(x.value) && x.value.length < 3e6))).slice(0, 200).map((x) => ({
        id: str(x.id, 64) || uid(), type: x.type, value: str(x.value, x.type === 'text' ? 500 : 3e6), altText: str(x.altText, 300), category: 'general', favorite: !!x.favorite, pool: x.pool === 'night' ? 'night' : 'day' })),
      events: arr(o.events).slice(-5000).map((x) => ({
        id: str(x && x.id, 64) || uid(), at: +(x && x.at) || 0, domain: str(x && x.domain, 253), triggerId: x && x.triggerId ? str(x.triggerId, 64) : null,
        level: x && [0, 1, 2].includes(x.level) ? x.level : null, response: x && RESP.includes(x.response) ? x.response : null })),
      locale: o.settings && o.settings.locale === 'id' ? 'id' : 'en'
    };
  }

  const api = { level, clean, WINDOW };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.SAA = Object.assign(globalThis.SAA || {}, { rules: api });
})();
