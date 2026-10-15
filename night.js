const { t } = SAA;
const $ = (id) => document.getElementById(id);
const apply = () => document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));

// Sleep sounds are made here with Web Audio, so they work offline and need no files or network (FR-14).
let ctx = null, src = null, timer = 0;
function stop() {
  clearTimeout(timer);
  if (src) { try { src.stop(); } catch { /* already stopped */ } src.disconnect(); src = null; }
  $('snd').textContent = '';
}
async function play(kind) {
  stop();
  ctx = ctx || new AudioContext();
  await ctx.resume(); // allowed because a button was just clicked
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = +$('vol').value;
  $('vol').oninput = () => { gain.gain.value = +$('vol').value; };
  if (kind === 'rain') { // white noise, bandpassed so it sounds like rain
    const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 900;
    lp.type = 'lowpass'; lp.frequency.value = 7000;
    src.connect(hp); hp.connect(lp); lp.connect(gain);
  } else src.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  const minutes = +$('tm').value;
  timer = setTimeout(stop, minutes * 60e3);
  $('snd').textContent = t('snd_playing', minutes);
}
$('brown').onclick = () => play('brown');
$('rain').onclick = () => play('rain');
$('stop').onclick = stop;

// One small thing for tomorrow. It comes back in the popup the next day.
async function showTomorrow() {
  const { tomorrow } = await chrome.storage.local.get('tomorrow');
  $('tstate').textContent = tomorrow ? `${t('tom_saved')} ${tomorrow.text}` : '';
}
$('tf').onsubmit = async (e) => {
  e.preventDefault();
  const text = $('tom').value.trim();
  if (!text) return;
  await chrome.storage.local.set({ tomorrow: { text, at: Date.now() } });
  $('tom').value = '';
  showTomorrow();
};
$('clear').onclick = async () => { await chrome.storage.local.remove('tomorrow'); showTomorrow(); };

(async () => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  if (settings.locale) SAA.lang = settings.locale;
  document.documentElement.lang = SAA.lang;
  apply();
  // Wind-down steps. Ticks are not saved: this is a gentle list, not a tracker.
  $('steps').replaceChildren(...[1, 2, 3, 4, 5].map((n) => {
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', id: 'step' + n });
    const label = Object.assign(document.createElement('label'), { className: 'check', htmlFor: 'step' + n });
    label.append(cb, document.createTextNode(t('ns_' + n)));
    const li = document.createElement('li');
    li.append(label);
    return li;
  }));
  showTomorrow();
})();
