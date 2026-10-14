const { t } = SAA;
const $ = (id) => document.getElementById(id);
const apply = () => document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));
const { regions, order } = SAA.resources;
const link = (text, href, label, blank) => {
  const a = Object.assign(document.createElement('a'), { className: 'btn', textContent: text, href });
  if (blank) { a.target = '_blank'; a.rel = 'noopener'; }
  a.setAttribute('aria-label', `${text}: ${label}`);
  return a;
};

function render(region) {
  const seen = new Set();
  const items = [...regions[region], ...regions.GLOBAL].filter((e) => !seen.has(e.name) && seen.add(e.name));
  $('list').replaceChildren(...items.map((e) => {
    const left = document.createElement('div');
    const name = Object.assign(document.createElement('strong'), { textContent: e.name });
    const kind = Object.assign(document.createElement('small'), { className: 'muted', textContent: ' ' + t('sup_k_' + e.kind) });
    left.append(name, kind);
    const row = document.createElement('div');
    row.className = 'row';
    if (e.tel) row.append(link(t('sup_call'), 'tel:' + e.tel, e.name));
    if (e.url) row.append(link(t('sup_site'), e.url, e.name, true));
    const li = document.createElement('li');
    li.append(left, row);
    return li;
  }));
}

// Only what is typed here is sent. Nothing about browsing is ever added (FR-15).
function updateLinks() {
  const v = encodeURIComponent($('msg').value);
  $('wa').href = 'https://wa.me/?text=' + v;
  $('sms').href = 'sms:?body=' + v;
}

(async () => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  if (settings.locale) SAA.lang = settings.locale;
  document.documentElement.lang = SAA.lang;
  apply();
  $('region').replaceChildren(...order.map((r) => Object.assign(document.createElement('option'), { value: r, textContent: t('reg_' + r) })));
  const region = settings.region && regions[settings.region] ? settings.region : SAA.lang === 'id' ? 'ID' : 'GLOBAL';
  $('region').value = region;
  render(region);
  $('region').onchange = async () => {
    render($('region').value);
    const cur = (await chrome.storage.local.get('settings')).settings || {};
    await chrome.storage.local.set({ settings: { ...cur, region: $('region').value } });
  };
  $('msg').value = t('sup_msg_default');
  updateLinks();
  $('msg').oninput = updateLinks;
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('msg').value); $('status').textContent = t('sup_copied'); } catch { $('msg').select(); }
  };
})();
