// Content script. Runs only on origins the user granted (registered at runtime by options.js).
// Matches the user's own browsing against the user's own list, in memory. Never stores page content.
// shortcut: hidden nodes are scanned too, top frame only (spec S7 cross-origin frames deferred).
(() => {
  if (window.__saa) return;
  window.__saa = true;
  const { matcher: M, t } = SAA;

  // SAF-01: never intercept crisis and support sites. Non-removable. Advisor curates per locale.
  const SAFE = ['findahelpline.com', 'befrienders.org', '988lifeline.org', 'intothelightid.org', 'samaritans.org', 'iasp.info'];
  const h = location.hostname;
  if (SAFE.some((d) => h === d || h.endsWith('.' + d))) return;

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const ATTRS = ['alt', 'title', 'aria-label', 'href', 'src'];
  const quiet = new Map(); // triggerId -> ms until quiet (10 min after continue)
  let m = M.build([]), seen = new WeakSet(), active = false, hostEl = null, rootEl = null, vt = 0, trigs = new Map();
  const FULL = 'all:initial;position:fixed;inset:0;z-index:2147483647';

  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => {});
  const fail = () => send({ type: 'badge', state: 'err' }); // fail open: never break the page
  const guard = (fn) => (...a) => { try { return fn(...a); } catch { fail(); } };
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

  async function load() {
    const s = await chrome.storage.local.get(['triggers', 'settings']);
    m = M.build(s.triggers || []);
    trigs = new Map((s.triggers || []).map((x) => [x.id, x]));
    if (s.settings && s.settings.locale) SAA.lang = s.settings.locale;
    seen = new WeakSet();
  }

  // FR-06: blur at once, before the background round trip. Fails open after 1.5 s so the page is never trapped.
  function veil() {
    const host = (hostEl = document.createElement('div'));
    host.style.cssText = FULL;
    rootEl = host.attachShadow({ mode: 'closed' });
    rootEl.adoptedStyleSheets = [sheet];
    rootEl.append(el('div', { className: 'wrap lv1' }));
    document.documentElement.append(host);
    vt = setTimeout(() => { unveil(); fail(); }, 1500);
  }
  function unveil() {
    clearTimeout(vt);
    if (hostEl) hostEl.remove();
    hostEl = rootEl = null;
    active = false;
  }

  // signal: url | title | search | text | attr | link | img. Only the signal name is kept, never page content (FR-22).
  function check(id, signal) {
    if (!id || active || (quiet.get(id) || 0) > Date.now()) return;
    active = true;
    if ((trigs.get(id) || {}).level !== 0) veil();
    chrome.runtime.sendMessage({ type: 'hit', triggerId: id, domain: location.hostname })
      .then((r) => (r && !r.error ? show(id, r, signal) : unveil()))
      .catch(unveil);
  }

  // S1, S2: URL and title
  const scanMeta = guard(() => {
    const u = location.href;
    check(M.scanUrl(m, u) || M.scan(m, dec(u), { compact: true }), 'url');
    check(M.scan(m, document.title, { compact: true }), 'title');
  });

  // S4 to S6: text, attributes, links
  const text = guard((n) => {
    if (seen.has(n) || n.data.length < 2) return;
    seen.add(n);
    check(M.scan(m, n.data.slice(0, 20000)), n.parentNode && n.parentNode.nodeName === 'TITLE' ? 'title' : 'text');
  });
  const attrs = guard((el) => {
    if (seen.has(el)) return;
    seen.add(el);
    for (const a of ['alt', 'title', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v) check(M.scan(m, v, { compact: true }), 'attr');
    }
    if (el.tagName === 'IMG' && el.getAttribute('src')) {
      try { check(M.scan(m, dec(new URL(el.src).pathname.split('/').pop()), { compact: true }), 'img'); } catch { /* bad src */ }
    }
    if (el.tagName === 'A' && el.getAttribute('href')) check(M.scanUrl(m, el.href) || M.scan(m, dec(el.href), { compact: true }), 'link');
  });

  // Idle-slice queue: <= 200 nodes per slice, remainder deferred (6.4).
  const queue = [];
  let walker = null, scheduled = false;
  const filter = { acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.tagName) || n === hostEl) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) };
  const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1000 }) : setTimeout(f, 50)); // timeout: busy pages never go idle
  const schedule = () => { if (!scheduled) { scheduled = true; idle(slice); } };
  // shortcut: queue capped at 5000, oldest dropped on pages that change faster than we scan. Upgrade: queue roots, not every added node.
  const enqueue = (n) => { if (n !== hostEl) { if (queue.length >= 5000) queue.shift(); queue.push(n); schedule(); } };

  const slice = guard(() => {
    scheduled = false;
    if (document.hidden) return;
    const t0 = performance.now(); // 8 ms idle budget (6.4)
    for (let n = 0; n < 200 && performance.now() - t0 < 8; ) {
      if (!walker) {
        const r = queue.shift();
        if (!r) break;
        if (!r.isConnected) continue;
        if (r.nodeType === 3) { text(r); n++; continue; }
        if (r.nodeType === 1) { attrs(r); n++; }
        walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, filter);
      }
      const x = walker.nextNode();
      n++;
      if (!x) { walker = null; continue; }
      if (x.nodeType === 3) text(x);
      else {
        attrs(x);
        if (x.shadowRoot) { observe(x.shadowRoot); enqueue(x.shadowRoot); } // S8: open roots only
      }
    }
    if (queue.length || walker) schedule();
  });

  const mo = new MutationObserver(guard((recs) => {
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(enqueue);
      else { seen.delete(r.target); enqueue(r.target); }
    }
  }));
  const observe = (root) => mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  const fullScan = () => { scanMeta(); enqueue(document.documentElement); };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) mo.disconnect(); // observers paused when tab hidden
    else { observe(document); fullScan(); }
  });

  // S3: search boxes, never password, payment or one-time-code fields
  const isSearch = (el) => {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
    if (el.type === 'password' || /cc-|one-time-code|password/.test(el.autocomplete || '')) return false;
    return el.type === 'search' || el.getAttribute('role') === 'searchbox' || /^(q|query|p|text|search|search_query|k)$/.test(el.name || '') ||
      /search|cari/i.test(el.getAttribute('aria-label') || el.placeholder || '');
  };
  let deb;
  document.addEventListener('input', (e) => {
    if (!isSearch(e.target)) return;
    clearTimeout(deb);
    deb = setTimeout(guard(() => check(M.scan(m, e.target.value, { compact: true }), 'search')), 150);
  }, true);

  chrome.runtime.onMessage.addListener((msg) => { if (msg.type === 'url') scanMeta(); }); // SPA navigation
  chrome.storage.onChanged.addListener((c) => { if (c.triggers || c.settings) load().then(fullScan); });

  // Overlay: closed shadow root, constructable stylesheet (page CSP cannot block it).
  const CSS = `
  *{box-sizing:border-box}
  .wrap{--bg:#EDF2F6;--surface:#F6F9FB;--fg:#16212C;--muted:#566878;--line:#CFD9E2;--accent:#C2410C;--on:#fff;
    font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg)}
  @media (prefers-color-scheme:dark){.wrap{--bg:#0E161E;--surface:#16212C;--fg:#E9F0F6;--muted:#9AAEBF;--line:#2A3947;--accent:#FF8A4C;--on:#1A0B02}}
  .lv1,.lv2{position:fixed;inset:0;display:grid;place-items:center;padding:16px}
  .lv1{background:rgb(14 22 30/.45);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}
  .lv2{background:var(--bg)}
  .lv0{width:min(360px,calc(100vw - 32px))}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:28px;padding:20px;width:min(480px,100%);
    box-shadow:0 24px 60px rgb(8 14 20/.35);animation:in 320ms cubic-bezier(.16,1,.3,1)}
  .tile{border-radius:16px;padding:20px;margin-bottom:16px;display:grid;place-items:center;text-align:center;min-height:96px;font-size:1.125rem;line-height:1.6}
  .tile img{max-width:100%;max-height:50vh;border-radius:12px;display:block}
  .tile p{margin:0;overflow-wrap:anywhere}
  .tile small{display:block;font-size:.8rem;opacity:.8;margin-bottom:6px}
  .timer{margin:0 0 12px;color:var(--muted);font-size:.875rem;text-align:center}
  .row{display:flex;gap:8px;flex-wrap:wrap}
  button{font:inherit;font-weight:600;min-height:44px;padding:0 16px;border-radius:12px;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--fg);flex:1}
  button.primary{background:var(--accent);border-color:var(--accent);color:var(--on)}
  button:disabled{opacity:.5;cursor:not-allowed}
  button:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
  button.link{display:block;flex:none;margin:8px auto 0;border:0;text-decoration:underline;color:var(--muted)}
  .why{margin:8px 0 0;color:var(--muted);font-size:.875rem;text-align:center;overflow-wrap:anywhere}
  @keyframes in{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  @media (prefers-reduced-motion:reduce){.card{animation:fade 120ms linear}}`;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  const PASTEL = [['#FFD43B', '#2B2200'], ['#74C0FC', '#0B2540'], ['#B2F2BB', '#0B2E13'], ['#FFA8C5', '#3A0A1E'], ['#D0BFFF', '#20123F']];

  function el(tag, props, ...kids) {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
  }

  function show(id, { eventId, level, item }, signal) {
    const prev = document.activeElement;
    clearTimeout(vt);
    if (!hostEl) { // no veil (level 0, or escalated from 0): build the host now
      hostEl = document.createElement('div');
      rootEl = hostEl.attachShadow({ mode: 'closed' });
      rootEl.adoptedStyleSheets = [sheet];
    }
    const host = hostEl, root = rootEl;
    host.style.cssText = level === 0 ? 'all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647' : FULL;
    root.replaceChildren(); // drops the veil, same host so there is no flicker

    const [bg, ink] = PASTEL[Math.floor(Math.random() * PASTEL.length)];
    const tile = el('div', { className: 'tile' });
    tile.style.background = bg;
    tile.style.color = ink;
    if (item.type === 'image') tile.append(el('img', { src: item.value, alt: item.altText || t('pic') }));
    else tile.append(el('p', { textContent: item.value || t('fallback') }));
    if (item.category === 'reality') tile.prepend(el('small', { textContent: t('reason_label') }));

    let tick, auto, left = 30;
    const back = el('button', { className: 'primary', textContent: level === 0 ? t('close') : t('back') });
    const cont = level === 0 ? null : el('button', { textContent: t('cont'), disabled: level === 2 });
    const timer = level === 2 ? el('p', { className: 'timer', textContent: t('wait', left) }) : null;
    timer && timer.setAttribute('aria-hidden', 'true');
    // FR-22: names the trigger and the signal, never the page content.
    const why = el('button', { className: 'link', textContent: t('why') });
    const whyText = el('p', { className: 'why' });
    why.setAttribute('aria-expanded', 'false');
    whyText.setAttribute('role', 'status');
    why.onclick = () => {
      const open = why.getAttribute('aria-expanded') === 'true';
      why.setAttribute('aria-expanded', String(!open));
      whyText.textContent = open ? '' : t('why_text', (trigs.get(id) || {}).value || '', t('sig_' + signal));
    };
    const card = el('div', { className: 'card' }, tile, ...(timer ? [timer] : []), el('div', { className: 'row' }, back, ...(cont ? [cont] : [])), ...(level > 0 ? [why, whyText] : []));
    const wrap = el('div', { className: 'wrap lv' + level }, card);
    wrap.setAttribute('role', level === 0 ? 'status' : 'alertdialog');
    wrap.setAttribute('aria-label', t('label'));
    if (level > 0) wrap.setAttribute('aria-modal', 'true');
    root.append(wrap);

    // No page-visible state (no `inert` on body): a site could watch it to learn which words match. Focus trap instead.
    const trap = (e) => { if (e.target !== host) back.focus(); };
    const done = (response) => {
      clearInterval(tick); clearTimeout(auto);
      removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', trap, true);
      host.remove(); hostEl = rootEl = null; active = false;
      if (prev && prev.focus) prev.focus();
      send({ type: 'resp', eventId, response });
      if (response !== 'went_back') quiet.set(id, Date.now() + 10 * 60e3);
    };
    // SAF-02: Escape always works on levels 0 and 1. "Take me back" is live from second 0 on level 2.
    const onKey = (e) => { if (e.key === 'Escape' && level < 2) done(level === 0 ? 'dismissed' : 'continued'); };
    addEventListener('keydown', onKey, true);

    back.onclick = () => {
      if (level === 0) return done('dismissed');
      done('went_back');
      if (history.length > 1) history.back(); else location.replace('about:blank');
    };
    if (cont) cont.onclick = () => done('continued');
    if (level === 0) auto = setTimeout(() => done('dismissed'), 10000);
    if (level === 2) {
      tick = setInterval(() => {
        left--;
        timer.textContent = left > 0 ? t('wait', left) : '';
        if (left <= 0) { cont.disabled = false; clearInterval(tick); }
      }, 1000);
    }

    if (!host.isConnected) document.documentElement.append(host);
    if (level > 0) { document.addEventListener('focusin', trap, true); back.focus(); }
  }

  (async () => {
    try {
      await load();
      send({ type: 'badge', state: 'ok' });
      observe(document);
      fullScan();
    } catch { fail(); }
  })();
})();
