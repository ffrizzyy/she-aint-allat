const { t } = SAA;
const $ = (id) => document.getElementById(id);
const get = async (k, d) => (await chrome.storage.local.get(k))[k] ?? d;
const set = (o) => chrome.storage.local.set(o);
let sayTimer = 0;
const say = (k) => { $('msg').textContent = t(k); clearTimeout(sayTimer); sayTimer = setTimeout(() => ($('msg').textContent = ''), 5000); };
const FILES = ['matcher.js', 'i18n.js', 'content.js'];
const { clean, removalState, canRemoveNow, validRedirect, DELAY } = SAA.rules;
const M = SAA.matcher;
const origins = (h) => [`*://${h}/*`, `*://*.${h}/*`];
const apply = () => document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));

function li(content, actions, label) {
  const row = document.createElement('div');
  row.className = 'row';
  for (const [key, fn] of actions) {
    const b = Object.assign(document.createElement('button'), { textContent: t(key), onclick: fn });
    b.setAttribute('aria-label', `${t(key)}: ${label}`.slice(0, 80));
    row.append(b);
  }
  const e = document.createElement('li');
  e.append(content, row);
  return e;
}
const span = (name, chips = [], note = '') => {
  const e = document.createElement('div');
  e.className = 'item';
  e.append(Object.assign(document.createElement('strong'), { textContent: name }));
  if (chips.length || note) {
    const c = document.createElement('div');
    c.className = 'chips';
    for (const x of chips) c.append(Object.assign(document.createElement('span'), { className: 'chip', textContent: x }));
    if (note) c.append(Object.assign(document.createElement('span'), { className: 'chip note', textContent: note }));
    e.append(c);
  }
  return e;
};
const fill = (ul, rows) => ul.replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('li'), { textContent: t('empty') })]));

async function render() {
  apply();
  const s = (await get('settings', {})).locale;
  $('lang').value = SAA.lang = s || SAA.lang;
  apply();
  const triggers = await get('triggers', []), pool = await get('pool', []);
  fill($('triggers'), triggers.map((x) => {
    const now = Date.now(), st = removalState(x, now);
    const note = st === 'pending' ? t('rm_pending', Math.ceil((x.removeRequestedAt + DELAY - now) / 3.6e6)) : st === 'confirm' ? t('rm_confirm') : '';
    const save = async (fn) => { await set({ triggers: fn(await get('triggers', [])) }); render(); };
    const drop = () => save((all) => all.filter((y) => y.id !== x.id));
    const schedule = () => { say('rm_note'); return save((all) => all.map((y) => (y.id === x.id ? { ...y, removeRequestedAt: Date.now() } : y))); };
    const keep = () => save((all) => all.map((y) => { if (y.id !== x.id) return y; const { removeRequestedAt, ...rest } = y; return rest; }));
    // FR-08: removal waits 24 h and is confirmed once more. A trigger added in the last 15 minutes can go at once.
    const actions = st === 'active' ? [['remove', canRemoveNow(x, now) ? drop : schedule]] : st === 'pending' ? [['keep', keep]] : [['rm_final', drop], ['keep', keep]];
    return li(span(x.value, [t('k_' + x.kind), t('s_' + x.sensitivity), t('l' + x.level)], note), actions, x.value);
  }));
  fill($('pool'), pool.map((x) => {
    let c;
    if (x.type === 'image') { c = document.createElement('img'); c.src = x.value; c.alt = x.altText || t('pic'); } else c = Object.assign(document.createElement('p'), { className: 'quote', textContent: x.value });
    // FR-07: favorites show up more often, night-only items wait for the night hours.
    const patch = async (fn) => { await set({ pool: (await get('pool', [])).map((y) => (y.id === x.id ? fn(y) : y)) }); render(); };
    const flag = (key, checked, fn) => {
      const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked });
      cb.onchange = () => patch((y) => fn(y, cb.checked));
      const l = document.createElement('label');
      l.className = 'check';
      l.append(cb, document.createTextNode(t(key)));
      return l;
    };
    const box = document.createElement('div');
    box.append(c, flag('fav', !!x.favorite, (y, v) => ({ ...y, favorite: v })), flag('night_only', x.pool === 'night', (y, v) => ({ ...y, pool: v ? 'night' : 'day' })));
    return li(box, [['remove', async () => { await set({ pool: (await get('pool', [])).filter((y) => y.id !== x.id) }); render(); }]], x.type === 'image' ? x.altText || t('pic') : x.value);
  }));
  const scripts = (await chrome.scripting.getRegisteredContentScripts()).filter((x) => x.id.startsWith('saa-'));
  fill($('sites'), scripts.map((x) => {
    const h = x.id.slice(4);
    let armed = false;
    const remove = async (e) => {
      if (e.currentTarget.getAttribute('aria-disabled') === 'true') return; // aria-disabled keeps keyboard focus on the button
      if (armed) {
        await chrome.scripting.unregisterContentScripts({ ids: [x.id] });
        await chrome.permissions.remove({ origins: origins(h) });
        return render();
      }
      // FR-08: stopping protection takes a 5 second wait, then a second click.
      const b = e.currentTarget;
      let n = 5;
      b.setAttribute('aria-disabled', 'true');
      b.textContent = t('wait_n', n);
      const tick = setInterval(() => {
        n--;
        if (n > 0) { b.textContent = t('wait_n', n); return; }
        clearInterval(tick);
        armed = true;
        b.removeAttribute('aria-disabled');
        b.textContent = t('rm_final');
      }, 1000);
    };
    return li(span(h), [['remove', remove]], h);
  }));
  const st = await get('settings', {});
  $('redir').value = st.redirectUrl || '';
  $('tl').querySelector('option[value="3"]').disabled = !st.redirectUrl; // level 3 is opt-in: needs a page you chose
  renderLock(await get('lock', null));
  $('count').textContent = `${t('locale_note')} ${(await get('events', [])).length}`;
}

$('lang').onchange = async () => {
  const settings = { ...(await get('settings', {})), locale: $('lang').value };
  await set({ settings });
  render();
};

$('tf').onsubmit = async (e) => {
  e.preventDefault();
  const value = $('tv').value.trim();
  if (!value) return;
  const triggers = await get('triggers', []);
  triggers.push({ id: crypto.randomUUID(), kind: $('tk').value, value, sensitivity: $('ts').value, level: +$('tl').value, createdAt: Date.now() });
  await set({ triggers });
  $('tv').value = '';
  render();
};

// FR-20: one site at a time. request() needs the click gesture, so it runs first.
$('sf').onsubmit = async (e) => {
  e.preventDefault();
  const h = $('sv').value.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return;
  if (!(await chrome.permissions.request({ origins: origins(h) }))) return;
  const id = 'saa-' + h;
  const have = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (!have.length) {
    await chrome.scripting.registerContentScripts([{ id, matches: origins(h), js: FILES, runAt: 'document_idle', persistAcrossSessions: true }]);
  }
  // Registering only affects pages loaded later, so start watching tabs that are already open.
  for (const tab of await chrome.tabs.query({ url: origins(h) })) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: FILES }).catch(() => {}); // tab may be gone or protected
  }
  $('sv').value = '';
  render();
};

async function addPool(item) {
  const pool = await get('pool', []);
  if (pool.length >= 200) return say('pool_full');
  pool.push({ id: crypto.randomUUID(), category: 'general', favorite: false, pool: 'day', ...item });
  await set({ pool });
  render();
}
$('pf').onsubmit = (e) => {
  e.preventDefault();
  const value = $('pt').value.trim();
  if (value) { addPool({ type: 'text', value }); $('pt').value = ''; }
};

// FR-02: <= 1280 px, WebP, <= 2 MB. Re-encoding through canvas strips EXIF.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  // Firefox may not encode WebP, so fall back to JPEG. Either way the canvas re-encode strips EXIF.
  for (const [fmt, q] of [['image/webp', 0.85], ['image/webp', 0.7], ['image/webp', 0.5], ['image/jpeg', 0.8], ['image/jpeg', 0.6]]) {
    const b = await new Promise((r) => c.toBlob(r, fmt, q));
    if (b && b.type === fmt && b.size <= 2 * 1024 * 1024) {
      return new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
    }
  }
  return null;
}
$('pi').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const value = await shrink($('pfile').files[0]);
    if (!value) return say('too_big');
    await addPool({ type: 'image', value, altText: $('palt').value.trim() });
    $('pi').reset();
  } catch { say('bad_file'); }
};

// FR-17. shortcut: images ride inside the JSON as data URLs, no zip. Add a zip when exports get big.
$('exp').onclick = async () => {
  const { snoozeUntil, ...shared } = await get('settings', {}); // a snooze is not exported. The lock lives under its own key, so it never is.
  const data = { app: 'she-aint-allat', v: 1, triggers: await get('triggers', []), pool: await get('pool', []), events: await get('events', []), letters: await get('letters', []), reasons: await get('reasons', []), settings: shared };
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })), download: 'she-aint-allat-export.json' });
  a.click();
  URL.revokeObjectURL(a.href);
};

const union = (a, b) => [...new Map([...a, ...b].map((x) => [x.id, x])).values()];
$('imp').onclick = () => $('ifile').click();
$('ifile').onchange = async () => {
  try {
    const c = clean(JSON.parse(await $('ifile').files[0].text()));
    if (!c) throw new Error('bad');
    await set({
      triggers: union(await get('triggers', []), c.triggers), pool: union(await get('pool', []), c.pool).slice(0, 200),
      events: union(await get('events', []), c.events), letters: union(await get('letters', []), c.letters).slice(0, 50), reasons: union(await get('reasons', []), c.reasons).slice(0, 30), settings: { ...(await get('settings', {})), locale: c.locale }
    });
    say('imported');
    render();
  } catch { say('bad_file'); }
  $('ifile').value = '';
};

$('wipe').onclick = async () => {
  if (!confirm(t('del_confirm'))) return;
  await SAA.lock.wipe();
  render();
};

// FR-05: level 3 target. It must be https and must not match one of your own triggers, or it would send you in circles.
$('rdf').onsubmit = async (e) => {
  e.preventDefault();
  const u = validRedirect($('redir').value);
  if (!u) return say('redirect_bad');
  let dec = u;
  try { dec = decodeURIComponent(u); } catch { /* keep raw */ }
  const m = M.build(await get('triggers', []));
  if (M.scanUrl(m, u) || M.scan(m, dec, { compact: true })) return say('redirect_loop');
  await set({ settings: { ...(await get('settings', {})), redirectUrl: u } });
  say('redirect_saved');
  render();
};
$('redirClear').onclick = async () => {
  const { redirectUrl, ...rest } = await get('settings', {});
  await set({ settings: rest });
  render();
};

// FR-18: passphrase gate. Not encryption, see lock.js.
function renderLock(lock) {
  $('lockf').hidden = !!lock;
  $('lockoff').hidden = !lock;
  $('lockstate').textContent = t(lock ? 'lock_is_on' : 'lock_is_off');
  $('lockstate').classList.toggle('on', !!lock);
}
$('lockf').onsubmit = async (e) => {
  e.preventDefault();
  const p = $('lp').value;
  if (p.length < 8) return say('lock_short');
  const minutes = +$('lm').value;
  const lock = await SAA.lock.make(p, minutes);
  await set({ lock });
  await chrome.storage.session.set({ unlockedUntil: Date.now() + minutes * 60e3 }); // do not lock yourself out of the page you are on
  $('lp').value = '';
  render();
};
$('lockoff').onsubmit = async (e) => {
  e.preventDefault();
  const lock = await get('lock', null);
  if (!lock) return;
  if (!(await SAA.lock.verify($('lc').value, lock))) return say('lock_wrong');
  await chrome.storage.local.remove('lock');
  $('lc').value = '';
  render();
};

render();

// Highlight the settings section you are looking at.
if ('IntersectionObserver' in window) {
  const links = new Map([...document.querySelectorAll('.side a[href^="#"]')].map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { links.forEach((a) => a.removeAttribute('aria-current')); links.get(e.target.id).setAttribute('aria-current', 'true'); }
  }, { rootMargin: '-20% 0px -70% 0px' });
  links.forEach((_, id) => io.observe($(id)));
}
