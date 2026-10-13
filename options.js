const { t } = SAA;
const $ = (id) => document.getElementById(id);
const get = async (k, d) => (await chrome.storage.local.get(k))[k] ?? d;
const set = (o) => chrome.storage.local.set(o);
const say = (k) => ($('msg').textContent = t(k));
const FILES = ['matcher.js', 'i18n.js', 'content.js'];
const { clean } = SAA.rules;
const origins = (h) => [`*://${h}/*`, `*://*.${h}/*`];
const apply = () => document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));

function li(content, onRemove, label) {
  const b = Object.assign(document.createElement('button'), { textContent: t('remove'), onclick: onRemove });
  b.setAttribute('aria-label', `${t('remove')}: ${label}`.slice(0, 80));
  const e = document.createElement('li');
  e.append(content, b);
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
  fill($('triggers'), triggers.map((x) => li(span(x.value, `${t('k_' + x.kind)}, ${t('s_' + x.sensitivity)}, ${t('l' + x.level)}`), async () => {
    await set({ triggers: (await get('triggers', [])).filter((y) => y.id !== x.id) });
    render();
  }, x.value)));
  fill($('pool'), pool.map((x) => {
    let c;
    if (x.type === 'image') { c = document.createElement('img'); c.src = x.value; c.alt = x.altText || t('pic'); } else c = span(x.value);
    return li(c, async () => { await set({ pool: (await get('pool', [])).filter((y) => y.id !== x.id) }); render(); }, x.type === 'image' ? x.altText || t('pic') : x.value);
  }));
  const scripts = (await chrome.scripting.getRegisteredContentScripts()).filter((x) => x.id.startsWith('saa-'));
  fill($('sites'), scripts.map((x) => {
    const h = x.id.slice(4);
    return li(span(h), async () => {
      await chrome.scripting.unregisterContentScripts({ ids: [x.id] });
      await chrome.permissions.remove({ origins: origins(h) });
      render();
    }, h);
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
  for (const q of [0.85, 0.7, 0.5]) {
    const b = await new Promise((r) => c.toBlob(r, 'image/webp', q));
    if (b && b.type === 'image/webp' && b.size <= 2 * 1024 * 1024) {
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
  const data = { app: 'she-aint-allat', v: 1, triggers: await get('triggers', []), pool: await get('pool', []), events: await get('events', []), settings: await get('settings', {}) };
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
      events: union(await get('events', []), c.events), settings: { ...(await get('settings', {})), locale: c.locale }
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
