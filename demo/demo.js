// Try-it page (FR-23). Uses the same matcher as the extension. No network, no storage, nothing leaves this page.
const M = SAA.matcher;
const $ = (id) => document.getElementById(id);
const D = {
  en: {
    title: 'Try she aint allat, no install', intro: 'This is a demo of the pop-up. Type a word from your list into the search box and see what happens. The real extension watches the sites you allow.',
    privacy: 'Nothing you type here leaves this page. No network, no storage, no analytics.', words: 'Words that should interrupt you (separate with commas)', level: 'What happens',
    lv0: 'Level 0: small nudge', lv1: 'Level 1: blur and card', lv2: 'Level 2: pause with timer (5 seconds here, 30 in the extension)', box: 'Pretend this is a search box', hint: 'Try typing: Alex',
    disc: 'This is a self-help tool, not therapy or medical care.', lang: 'Language', back: 'Take me back', cont: 'Continue anyway', close: 'Close', wait: 'You can continue in {n}s', label: 'A pause you set up for yourself',
    lines: ['You set this pause up on purpose. Take one slow breath first.', 'You are allowed to close this tab.', 'Future you says thanks.']
  },
  id: {
    title: 'Coba she aint allat, tanpa instal', intro: 'Ini demo pop-up-nya. Ketik kata dari daftarmu di kotak pencarian dan lihat yang terjadi. Ekstensi aslinya memantau situs yang kamu izinkan.',
    privacy: 'Yang kamu ketik di sini tidak keluar dari halaman ini. Tanpa jaringan, tanpa penyimpanan, tanpa analitik.', words: 'Kata yang harus menghentikanmu (pisahkan dengan koma)', level: 'Yang terjadi',
    lv0: 'Tingkat 0: colekan kecil', lv1: 'Tingkat 1: blur dan kartu', lv2: 'Tingkat 2: jeda dengan timer (5 detik di sini, 30 di ekstensi)', box: 'Anggap ini kotak pencarian', hint: 'Coba ketik: Alex',
    disc: 'Ini alat bantu mandiri, bukan terapi atau perawatan medis.', lang: 'Bahasa', back: 'Bawa aku kembali', cont: 'Tetap lanjut', close: 'Tutup', wait: 'Kamu bisa lanjut dalam {n} dtk', label: 'Jeda yang kamu siapkan sendiri',
    lines: ['Kamu menyiapkan jeda ini dengan sengaja. Tarik napas pelan dulu.', 'Kamu boleh menutup tab ini.', 'Dirimu di masa depan bilang terima kasih.']
  }
};
let lang = (navigator.language || 'en').toLowerCase().startsWith('id') ? 'id' : 'en';
const t = (k) => D[lang][k];

function labels() {
  document.documentElement.lang = lang;
  $('lang').value = lang;
  const map = { 't-title': 'title', 't-intro': 'intro', 't-privacy': 'privacy', 'l-words': 'words', 'l-level': 'level', lv0: 'lv0', lv1: 'lv1', lv2: 'lv2', 'l-box': 'box', 't-hint': 'hint', 't-disc': 'disc', 'l-lang': 'lang' };
  for (const [id, key] of Object.entries(map)) $(id).textContent = t(key);
}

const el = (tag, props, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
let open = false;

function show(level) {
  open = true;
  const prev = document.activeElement;
  const text = t('lines')[Math.floor(Math.random() * t('lines').length)];
  const back = el('button', { className: 'primary', textContent: level === 0 ? t('close') : t('back') });
  const cont = level === 0 ? null : el('button', { textContent: t('cont'), disabled: level === 2 });
  const timer = level === 2 ? el('p', { className: 'timer', textContent: t('wait').replace('{n}', 5) }) : null;
  const card = el('div', { className: 'card' }, el('div', { className: 'demo-tile', textContent: text }), ...(timer ? [timer] : []), el('div', { className: 'row' }, back, ...(cont ? [cont] : [])));
  const wrap = el('div', { className: 'demo-overlay lv' + level }, card);
  wrap.setAttribute('role', level === 0 ? 'status' : 'alertdialog');
  wrap.setAttribute('aria-label', t('label'));
  if (level > 0) wrap.setAttribute('aria-modal', 'true');

  let tick = 0, auto = 0, left = 5;
  const done = (clear) => {
    clearInterval(tick); clearTimeout(auto);
    removeEventListener('keydown', onKey, true);
    wrap.remove();
    $('page').inert = false;
    open = false;
    if (clear) $('box').value = '';
    prev && prev.focus && prev.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape' && level < 2) done(false); }; // Escape always works on levels 0 and 1
  addEventListener('keydown', onKey, true);
  back.onclick = () => done(true); // "Take me back" works from second 0
  if (cont) cont.onclick = () => done(false);
  if (level === 0) auto = setTimeout(() => done(false), 10000);
  if (level === 2) {
    tick = setInterval(() => {
      left--;
      timer.textContent = left > 0 ? t('wait').replace('{n}', left) : '';
      if (left <= 0) { cont.disabled = false; clearInterval(tick); }
    }, 1000);
  }
  document.body.append(wrap);
  if (level > 0) { $('page').inert = true; back.focus(); }
}

function matcher() {
  const words = $('words').value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
  return M.build(words.map((value, i) => ({ id: String(i), value, kind: 'text', sensitivity: 'normal' })));
}
let deb = 0;
$('box').addEventListener('input', () => {
  clearTimeout(deb);
  deb = setTimeout(() => {
    if (!open && M.scan(matcher(), $('box').value, { compact: true }) !== null) show(+document.querySelector('input[name=lv]:checked').value);
  }, 150);
});
$('lang').onchange = () => { lang = $('lang').value; labels(); };
labels();
