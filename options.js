const { t } = SAA;
const $ = (id) => document.getElementById(id);
const get = async (k, d) => (await chrome.storage.local.get(k))[k] ?? d;
const set = (o) => chrome.storage.local.set(o);
const say = (k) => ($('msg').textContent = t(k));
const FILES = ['matcher.js', 'i18n.js', 'content.js'];
const { clean, removalState, canRemoveNow, DELAY } = SAA.rules;
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
const span = (s, small) => {
  const e = document.createElement('span');
  e.textContent = s;
  if (small) { const m = document.createElement('small'); m.textContent = ' ' + small; e.append(m); }
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
    return li(span(x.value, `${t('k_' + x.kind)}, ${t('s_' + x.sensitivity)}, ${t('l' + x.level)}${note ? ', ' + note : ''}`), actions, x.value);
  }));
  fill($('pool'), pool.map((x) => {
    let c;
    if (x.type === 'image') { c = document.createElement('img'); c.src = x.value; c.alt = x.altText || t('pic'); } else c = span(x.value);
    return li(c, [['remove', async () => { await set({ pool: (await get('pool', [])).filter((y) => y.id !== x.id) }); render(); }]], x.type === 'image' ? x.altText || t('pic') : x.value);
  }));
  const scripts = (await chrome.scripting.getRegisteredContentScripts()).filter((x) => x.id.startsWith('saa-'));
  fill($('sites'), scripts.map((x) => {
    const h = x.id.slice(4);
    return li(span(h), [['remove', async () => {
      await chrome.scripting.unregisterContentScripts({ ids: [x.id] });
      await chrome.permissions.remove({ origins: origins(h) });
      render();
    }]], h);
  }));
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
  const data = { app: 'she-aint-allat', v: 1, triggers: await get('triggers', []), pool: await get('pool', []), events: await get('events', []), letters: await get('letters', []), reasons: await get('reasons', []), settings: await get('settings', {}) };
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
  await chrome.storage.local.clear();
  const ids = (await chrome.scripting.getRegisteredContentScripts()).filter((x) => x.id.startsWith('saa-')).map((x) => x.id);
  if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
  await chrome.permissions.remove({ origins: (await chrome.permissions.getAll()).origins || [] }).catch(() => {});
  render();
};

render();
