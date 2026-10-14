const { t } = SAA;
const { letterState, DELAYS, LETTERS_CAP } = SAA.rules;
const $ = (id) => document.getElementById(id);
const apply = () => document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));
const get = async () => (await chrome.storage.local.get('letters')).letters || [];
const day = (ms) => new Intl.DateTimeFormat(SAA.lang, { dateStyle: 'medium' }).format(ms);
const node = (tag, text, cls) => Object.assign(document.createElement(tag), { textContent: text ?? '', className: cls || '' });

// Letter text is only rendered once it is open. Nothing else (logs, badges, notifications) ever sees it.
async function render() {
  const letters = (await get()).sort((a, b) => b.createdAt - a.createdAt);
  const now = Date.now();
  const rows = letters.map((l) => {
    const left = document.createElement('div');
    let label = t('let_from', day(l.createdAt));
    if (letterState(l, now) === 'locked') {
      left.append(node('span', t('let_locked', day(l.unlockAt))), node('br'), node('small', label, 'muted'));
    } else {
      const d = document.createElement('details');
      d.append(node('summary', t('let_open', day(l.unlockAt)) + ' ' + t('let_read')), node('p', l.body, 'letter'));
      left.append(d);
    }
    const shred = node('button', t('let_shred'));
    shred.setAttribute('aria-label', `${t('let_shred')}: ${label}`);
    shred.onclick = async () => {
      if (!confirm(t('let_shred_confirm'))) return;
      await chrome.storage.local.set({ letters: (await get()).filter((x) => x.id !== l.id) });
      render();
    };
    const li = document.createElement('li');
    li.append(left, shred);
    return li;
  });
  $('list').replaceChildren(...(rows.length ? rows : [node('li', t('let_empty'))]));
}

$('lf').onsubmit = async (e) => {
  e.preventDefault();
  const body = $('body').value;
  if (!body.trim()) return;
  const letters = await get();
  if (letters.length >= LETTERS_CAP) { $('msg').textContent = t('let_full'); return; }
  const now = Date.now(), unlockAt = now + DELAYS[$('delay').value];
  letters.push({ id: crypto.randomUUID(), body, createdAt: now, unlockAt });
  await chrome.storage.local.set({ letters });
  $('body').value = '';
  $('msg').textContent = t('let_saved', day(unlockAt));
  render();
};

(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (settings && settings.locale) SAA.lang = settings.locale;
  document.documentElement.lang = SAA.lang;
  apply();
  render();
})();
