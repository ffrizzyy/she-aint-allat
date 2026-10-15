// Run: node stats.test.js
const assert = require('node:assert');
const { summarize, toCsv } = require('./stats.js');

const at = (m, d, h, mi = 0) => new Date(2026, m, d, h, mi).getTime(); // local time, so the test is timezone independent
const now = at(9, 13, 22); // Tue 13 Oct 2026, 22:00
const ev = (time, response, domain = 'a.com') => ({ at: time, domain, level: 1, response });

// Empty
let s = summarize([], now);
assert.equal(s.total, 0);
assert.equal(s.days.length, 14);
assert.equal(s.trend, 'none');

// Counting
s = summarize([
  ev(at(9, 13, 21, 5), 'went_back'),
  ev(at(9, 13, 21, 50), 'continued'),
  ev(at(9, 12, 23), 'manual', 'b.com'),
  ev(at(8, 1, 3), 'went_back'),
  ev(now + 1e6, 'went_back'),
  null, { at: 'x' }
], now);
assert.equal(s.total, 4, 'future and junk events are skipped');
assert.equal(s.today, 1, 'only chosen pauses count as detours');
assert.equal(s.days[12].n, 1, 'yesterday, manual button');
assert.equal(s.days[13].n, 1);
assert.equal(s.heat[2][21], 2, 'Tuesday 21:00 holds both urges');
assert.equal(s.days.reduce((a, d) => a + d.n, 0), 2, '30 day old event is outside the 14 day window');

// A snooze is not an urge
assert.equal(summarize([ev(at(9, 13, 20), 'snoozed')], now).total, 0);

// Top sites: sorted, capped at 5
s = summarize(['f', 'e', 'd', 'c', 'b', 'a', 'a'].map((d) => ev(at(9, 10, 12), 'went_back', d + '.com')), now);
assert.equal(s.domains.length, 5);
assert.deepEqual(s.domains[0], ['a.com', 2]);

// Trend wording buckets
const many = (n, day) => Array.from({ length: n }, () => ev(at(9, day, 12), 'went_back'));
assert.equal(summarize([...many(10, 12), ...many(5, 3)], now).trend, 'busy');
assert.equal(summarize([...many(3, 12), ...many(10, 3)], now).trend, 'quiet');
assert.equal(summarize([...many(5, 12), ...many(5, 3)], now).trend, 'same');
assert.equal(summarize(many(5, 12), now).trend, 'none', 'no last week to compare');

// CSV: quoting and formula injection
const csv = toCsv([{ at: 0, domain: '=HYPERLINK("x")', level: 1, response: 'a,b' }, ev(at(9, 13, 21), null, 'c.com')]);
const lines = csv.split('\n');
assert.equal(lines[0], 'time,domain,level,response');
assert.equal(lines[1], '"","\'=HYPERLINK(""x"")","1","a,b"');
assert(lines[2].includes('"c.com"'));
console.log('stats ok');
