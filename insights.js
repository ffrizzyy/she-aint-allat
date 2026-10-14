const { t } = SAA;
const $ = (id) => document.getElementById(id);
const apply = () => document.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));
const node = (tag, text, cls) => Object.assign(document.createElement(tag), { textContent: text ?? '', className: cls || '' });

function table(el, caption, head, rows, capId) {
  const cap = node('caption', caption);
  if (capId) cap.id = capId;
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  head.forEach((h) => { const th = node('th', h); th.scope = 'col'; hr.append(th); });
  thead.append(hr);
  const tbody = document.createElement('tbody');
  tbody.append(...rows);
  el.replaceChildren(cap, thead, tbody);
}

async function main() {
  const { settings, events = [] } = await chrome.storage.local.get(['settings', 'events']);
  if (settings && settings.locale) SAA.lang = settings.locale;
  document.documentElement.lang = SAA.lang;
  apply();
  const s = SAA.stats.summarize(events, Date.now());
  if (!s.total) { $('empty').hidden = false; return; }
  $('data').hidden = false;

  $('today').textContent = t('ins_today', s.today);
  $('trend').textContent = t('ins_trend') + ': ' + t('tr_' + s.trend);

  // Detours per day. The table is the chart; bars are decoration.
  const dayFmt = new Intl.DateTimeFormat(SAA.lang, { weekday: 'short', day: 'numeric' });
  const max = Math.max(1, ...s.days.map((d) => d.n));
  table($('days'), t('ins_days'), [t('col_day'), '', t('col_n')], s.days.map((d) => {
    const tr = document.createElement('tr');
    const th = node('th', dayFmt.format(d.date));
    th.scope = 'row';
    const bar = node('div', '', 'bar');
    bar.style.width = (d.n / max) * 100 + '%';
    bar.setAttribute('aria-hidden', 'true');
    const barCell = document.createElement('td');
    barCell.append(bar);
    tr.append(th, barCell, node('td', String(d.n), 'num'));
    return tr;
  }));

  // Hour by weekday, Monday first. Counts are in the cells, shade is decoration.
  const wk = new Intl.DateTimeFormat(SAA.lang, { weekday: 'short' });
  const peak = Math.max(1, ...s.heat.flat());
  const rows = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const tr = document.createElement('tr');
    const th = node('th', wk.format(new Date(2024, 0, 7 + wd)));
    th.scope = 'row';
    tr.append(th);
    s.heat[wd].forEach((n, h) => {
      const td = node('td', n ? String(n) : '');
      td.title = `${h}:00, ${n}`;
      if (n) td.style.background = `color-mix(in srgb, var(--fg) ${Math.round(10 + (n / peak) * 30)}%, transparent)`;
      tr.append(td);
    });
    return tr;
  });
  table($('heat'), t('ins_heat'), ['', ...Array.from({ length: 24 }, (_, h) => String(h))], rows, 'heatcap');

  if (s.domains.length) {
    table($('sites'), t('ins_domains'), [t('col_site'), t('col_urges')], s.domains.map(([d, n]) => {
      const tr = document.createElement('tr');
      tr.append(node('td', d), node('td', String(n), 'num'));
      return tr;
    }));
  }

  $('csv').onclick = () => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([SAA.stats.toCsv(events)], { type: 'text/csv' })), download: 'she-aint-allat-log.csv'
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };
}
main();
