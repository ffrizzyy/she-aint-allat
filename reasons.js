const { t } = SAA;
const { move, REASONS_CAP } = SAA.rules;
const $ = (id) => document.getElementById(id);
const apply = () => document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));
const get = async () => (await chrome.storage.local.get('reasons')).reasons || [];
const save = async (reasons) => { await chrome.storage.local.set({ reasons }); render(); };

async function render() {
  const list = await get();
  const rows = list.map((r, i) => {
    const text = Object.assign(document.createElement('p'), { textContent: r.text });
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: r.inPool });
    cb.onchange = async () => save((await get()).map((x) => (x.id === r.id ? { ...x, inPool: cb.checked } : x)));
    const check = document.createElement('label');
    check.className = 'check';
    check.append(cb, document.createTextNode(t('rea_show')));
    const left = document.createElement('div');
    left.append(text, check);

    const btn = (key, fn, disabled) => {
      const b = Object.assign(document.createElement('button'), { textContent: t(key), onclick: fn, disabled: !!disabled });
      b.setAttribute('aria-label', `${t(key)}: ${r.text}`.slice(0, 80));
      return b;
    };
    const row = document.createElement('div');
    row.className = 'row';
    row.append(
      btn('up', async () => save(move(await get(), r.id, -1)), i === 0),
      btn('down', async () => save(move(await get(), r.id, 1)), i === list.length - 1),
      btn('remove', async () => save((await get()).filter((x) => x.id !== r.id)))
    );
    const li = document.createElement('li');
    li.append(left, row);
    return li;
  });
  $('list').replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('li'), { textContent: t('rea_empty') })]));
}

$('rf').onsubmit = async (e) => {
  e.preventDefault();
  const text = $('text').value.trim();
  if (!text) return;
  const list = await get();
  if (list.length >= REASONS_CAP) { $('msg').textContent = t('rea_full'); return; }
  list.push({ id: crypto.randomUUID(), text, inPool: true });
  $('text').value = '';
  $('msg').textContent = '';
  save(list);
};

(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (settings && settings.locale) SAA.lang = settings.locale;
  document.documentElement.lang = SAA.lang;
  apply();
  render();
})();
