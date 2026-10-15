const { t } = SAA;
const $ = (id) => document.getElementById(id);
const apply = () => document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));

const { SNOOZE_MINUTES, tomorrowDue } = SAA.rules;
const open = (page) => chrome.tabs.create({ url: chrome.runtime.getURL(page) });

async function init() {
  const { settings = {}, tomorrow } = await chrome.storage.local.get(['settings', 'tomorrow']);
  if (settings.locale) SAA.lang = settings.locale;
  apply();
  renderSnooze(settings);
  // FR-14: the small thing you wrote last night comes back today
  if (tomorrow && tomorrowDue(tomorrow, Date.now())) {
    $('todayText').textContent = t('today_card', tomorrow.text);
    $('today').hidden = false;
  }
}
$('todayDone').onclick = async () => { await chrome.storage.local.remove('tomorrow'); $('today').hidden = true; };

// FR-08: snooze waits 5 seconds first. Resuming has no wait, because turning protection back on is always safe.
function renderSnooze(settings) {
  const until = settings.snoozeUntil || 0, on = until > Date.now();
  $('snzState').textContent = on ? t('snoozed_until', new Date(until).toLocaleTimeString(SAA.lang, { hour: '2-digit', minute: '2-digit' })) : '';
  $('resume').hidden = !on;
}
$('snzGo').onclick = () => {
  const b = $('snzGo');
  if (b.getAttribute('aria-disabled') === 'true') return; // aria-disabled, not disabled, so keyboard focus stays on the button
  let n = 5;
  b.setAttribute('aria-disabled', 'true');
  b.textContent = t('snooze_wait', n);
  const tick = setInterval(async () => {
    n--;
    if (n > 0) { b.textContent = t('snooze_wait', n); return; }
    clearInterval(tick);
    const v = +$('snz').value, minutes = SNOOZE_MINUTES.includes(v) ? v : SNOOZE_MINUTES[0];
    const settings = { ...((await chrome.storage.local.get('settings')).settings || {}), snoozeUntil: Date.now() + minutes * 60e3 };
    await chrome.storage.local.set({ settings });
    chrome.runtime.sendMessage({ type: 'manual', response: 'snoozed' });
    b.removeAttribute('aria-disabled');
    b.textContent = t('snooze');
    renderSnooze(settings);
  }, 1000);
};
$('resume').onclick = async () => {
  const { snoozeUntil, ...rest } = (await chrome.storage.local.get('settings')).settings || {};
  await chrome.storage.local.set({ settings: rest });
  renderSnooze(rest);
};
init();

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
  } else {
    const p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = (item && item.value) || t('fallback');
    if (item && item.category === 'reality') {
      const small = document.createElement('small');
      small.style.display = 'block';
      small.textContent = t('reason_label');
      d.append(small);
    }
    d.append(p);
  }
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
$('insights').onclick = () => open('insights.html');
$('letters').onclick = () => open('letters.html');
$('reasons').onclick = () => open('reasons.html');
$('night').onclick = () => open('night.html');
$('settings').onclick = () => chrome.runtime.openOptionsPage();
$('support').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('support.html') }); // SAF-04: two taps
