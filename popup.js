const { t } = SAA;
const $ = (id) => document.getElementById(id);
const apply = () => document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));

chrome.storage.local.get('settings').then(({ settings }) => {
  if (settings && settings.locale) SAA.lang = settings.locale;
  apply();
});

function tile(item) {
  const d = document.createElement('div');
  d.className = 'tile';
  d.style.background = '#FFD43B';
  d.style.color = '#2B2200';
  if (item && item.type === 'image') {
    const i = document.createElement('img');
    i.src = item.value;
    i.alt = item.altText || t('pic');
    d.append(i);
  } else d.textContent = (item && item.value) || t('fallback');
  return d;
}

// FR-03: manual urge button. Shows a pool item here and logs it (no URL, no domain).
$('urge').onclick = async () => $('shown').replaceChildren(tile(await chrome.runtime.sendMessage({ type: 'manual', response: 'manual' })));
// FR-11: slip-friendly. Logs without penalty, replies kindly.
$('looked').onclick = async () => {
  await chrome.runtime.sendMessage({ type: 'manual', response: 'looked' });
  const d = document.createElement('div');
  d.className = 'tile';
  d.style.background = 'var(--surface-2)';
  d.textContent = t('looked_ok');
  $('shown').replaceChildren(d);
};
$('insights').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('insights.html') });
$('settings').onclick = () => chrome.runtime.openOptionsPage();
$('support').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('options.html#support') }); // SAF-04: two taps
