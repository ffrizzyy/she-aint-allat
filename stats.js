// Pure aggregation for Insights (FR-10) and CSV export. No DOM, no chrome.*.
// A "detour" is a pause the user chose (went back, or pressed "I'm about to look").
// An "urge" is any logged moment. Slips and continues are never shown as numbers against the user (SAF-03).
(function () {
  const DAYS = 14;
  const isDetour = (e) => e.response === 'went_back' || e.response === 'manual' || e.response === 'redirected';
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  function summarize(events, now) {
    const t = new Date(now);
    const dayStart = (back) => new Date(t.getFullYear(), t.getMonth(), t.getDate() - back);
    const days = [];
    for (let i = DAYS - 1; i >= 0; i--) days.push({ date: dayStart(i), n: 0 });
    const index = new Map(days.map((d, i) => [key(d.date), i]));
    const heat = Array.from({ length: 7 }, () => Array(24).fill(0)); // [weekday Sun..Sat][hour]
    const sites = new Map();
    const thisFrom = dayStart(6).getTime(), lastFrom = dayStart(13).getTime();
    let total = 0, thisWeek = 0, lastWeek = 0;

    for (const e of events) {
      if (!e || !(e.at > 0) || e.at > now || e.response === 'snoozed') continue; // a snooze is not an urge
      const d = new Date(e.at);
      total++;
      heat[d.getDay()][d.getHours()]++;
      if (e.domain) sites.set(e.domain, (sites.get(e.domain) || 0) + 1);
      const i = index.get(key(d));
      if (i !== undefined && isDetour(e)) days[i].n++;
      if (e.at >= thisFrom) thisWeek++;
      else if (e.at >= lastFrom) lastWeek++;
    }

    // Kind wording only. Not enough data to compare means we say nothing alarming.
    const trend = !lastWeek ? 'none' : thisWeek < lastWeek * 0.8 ? 'quiet' : thisWeek > lastWeek * 1.2 ? 'busy' : 'same';
    const domains = [...sites].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    return { total, today: days[DAYS - 1].n, days, heat, domains, trend };
  }

  // Spreadsheet formula injection: imported domains are untrusted, so prefix risky starts.
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  function toCsv(events) {
    const rows = events.map((e) => [e.at > 0 ? new Date(e.at).toISOString() : '', e.domain, e.level, e.response].map(cell).join(','));
    return ['time,domain,level,response', ...rows].join('\n');
  }

  const api = { summarize, toCsv, isDetour, DAYS };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.SAA = Object.assign(globalThis.SAA || {}, { stats: api });
})();
