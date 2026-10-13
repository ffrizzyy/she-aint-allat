// Pure matcher (spec section 6.2, 6.3). No DOM. Loaded as a classic script and by Node tests.
// shortcut: plain substring scan, not Aho-Corasick. Fine for tens of triggers, upgrade past ~200.
// shortcut: confusables table covers common Cyrillic only (no full UTS #39), loose mode has no edit-distance-1.
(function () {
  const CONFUSABLE = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', і: 'i', ѕ: 's', ј: 'j', ԁ: 'd' };
  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

  function norm(s) {
    return String(s)
      .normalize('NFKC')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
      .replace(/[аеорсхіѕјԁ]/g, (c) => CONFUSABLE[c])
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  // Loose-only step. Runs on raw lowercase so "@" and "$" survive, then normalises.
  function loose(raw) {
    const mapped = String(raw).toLowerCase().replace(/[013457@$]/g, (c) => LEET[c] || c);
    return norm(mapped).replace(/(\p{L})\1{2,}/gu, '$1');
  }

  // Iterative glob (* only), O(n*m), no regex, no ReDoS.
  function glob(pattern, s) {
    const p = pattern.toLowerCase(), t = s.toLowerCase();
    let pi = 0, ti = 0, star = -1, mark = 0;
    while (ti < t.length) {
      if (pi < p.length && p[pi] === '*') { star = pi++; mark = ti; }
      else if (pi < p.length && p[pi] === t[ti]) { pi++; ti++; }
      else if (star >= 0) { pi = star + 1; ti = ++mark; }
      else return false;
    }
    while (pi < p.length && p[pi] === '*') pi++;
    return pi === p.length;
  }

  function build(triggers) {
    const text = [], url = [];
    for (const t of triggers) {
      if (t.kind === 'url') { url.push(t); continue; }
      const s = t.sensitivity || 'normal';
      const n = s === 'loose' ? loose(t.value) : norm(t.value);
      if (!n) continue;
      text.push({ id: t.id, n, c: n.replace(/ /g, ''), strict: s === 'strict', loose: s === 'loose', bound: s === 'strict' || n.length < 5 });
    }
    return { text, url };
  }

  // opts.compact: also match with separators removed ("m.i.r.a"). Only for short signals (url, search, links).
  function scan(m, raw, opts) {
    const n = norm(raw);
    if (!n) return null;
    const hay = ' ' + n + ' ';
    const compact = opts && opts.compact ? n.replace(/ /g, '') : null;
    let lh = null;
    for (const t of m.text) {
      const h = t.loose ? (lh = lh || ' ' + loose(raw) + ' ') : hay;
      if (t.bound ? h.includes(' ' + t.n + ' ') : h.includes(t.n)) return t.id;
      if (compact && !t.strict && t.c.length >= 5 && compact.includes(t.c)) return t.id;
    }
    return null;
  }

  function scanUrl(m, href) {
    for (const t of m.url) if (t.value.length <= 200 && glob('*' + t.value + '*', href)) return t.id;
    return null;
  }

  const api = { norm, loose, glob, build, scan, scanUrl };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.SAA = Object.assign(globalThis.SAA || {}, { matcher: api });
})();
