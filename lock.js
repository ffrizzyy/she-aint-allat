// App lock (FR-18). A passphrase gate in front of the lists, not encryption: data stays readable in browser storage.
// Core (make, verify) is pure WebCrypto and runs in Node tests. gate() runs on extension pages only.
// The support page never loads this file, so help is never behind a lock (SAF-04).
(function () {
  const ITER = 200000;
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function derive(pass, salt, iter) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
  }
  async function make(pass, minutes) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { salt: b64(salt), hash: b64(await derive(pass, salt, ITER)), iter: ITER, minutes };
  }
  async function verify(pass, lock) {
    const got = await derive(pass, unb64(lock.salt), lock.iter), want = unb64(lock.hash);
    let diff = got.length ^ want.length;
    for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]; // constant time
    return diff === 0;
  }

  // Erase everything: used by "Delete everything" and by "Forgot my passphrase".
  async function wipe() {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    const ids = (await chrome.scripting.getRegisteredContentScripts()).filter((x) => x.id.startsWith('saa-')).map((x) => x.id);
    if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
    await chrome.permissions.remove({ origins: (await chrome.permissions.getAll()).origins || [] }).catch(() => {});
  }

  async function gate() {
    const main = document.querySelector('main');
    if (!main) return;
    main.hidden = true; // no flash of the lists while we check
    try {
      const { settings = {}, lock } = await chrome.storage.local.get(['settings', 'lock']); // lock lives apart from settings so content scripts never load the hash
      const { unlockedUntil = 0 } = await chrome.storage.session.get('unlockedUntil');
      if (!lock || unlockedUntil > Date.now()) { main.hidden = false; return; }
      if (settings.locale) SAA.lang = settings.locale;
      const { t } = SAA;
      const el = (tag, props, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
      const pass = el('input', { type: 'password', autocomplete: 'current-password', required: true, id: 'lock-pass' });
      const label = el('label', {}, el('span', { textContent: t('lock_pass') }), pass);
      const err = el('p', { id: 'lock-err' });
      err.setAttribute('role', 'alert');
      const form = el('form', {}, label, el('button', { className: 'primary', textContent: t('lock_unlock') }), err);
      const help = el('button', { className: 'link', type: 'button', textContent: t('support'), onclick: () => chrome.tabs.create({ url: chrome.runtime.getURL('support.html') }) });
      const forgot = el('button', { type: 'button', textContent: t('lock_forgot'), onclick: async () => { if (confirm(t('lock_forgot_confirm'))) { await wipe(); location.reload(); } } });
      const box = el('div', {}, el('h1', { textContent: t('lock_title') }), el('p', { className: 'muted', textContent: t('lock_prompt') }), form, el('p', {}, help), el('p', {}, forgot));
      box.style.cssText = 'max-width:420px;margin:0 auto;padding:48px 16px';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', t('lock_title'));
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (await verify(pass.value, lock)) {
          await chrome.storage.session.set({ unlockedUntil: Date.now() + lock.minutes * 60e3 });
          box.remove();
          main.hidden = false;
        } else { err.textContent = t('lock_wrong'); pass.select(); }
      };
      document.body.append(box);
      pass.focus();
    } catch (e) { main.hidden = false; console.error('lock gate failed, showing page', e); } // a broken lock must not brick the UI
  }

  const api = { make, verify, wipe, gate, ITER };
  if (typeof module !== 'undefined') module.exports = api;
  else {
    globalThis.SAA = Object.assign(globalThis.SAA || {}, { lock: api });
    gate();
  }
})();
