// Run: node matcher.test.js
const assert = require('node:assert');
const { build, scan, scanUrl } = require('./matcher.js');
const m = (value, sensitivity = 'normal', kind = 'name') => build([{ id: 'x', value, sensitivity, kind }]);
const hit = (mm, text, o) => scan(mm, text, o) === 'x';

// FR-04 acceptance: search containing a trigger
assert(hit(m('mira'), 'Mira rahardjo instagram'));
// Short name inside another word never fires
assert(!hit(m('ana'), 'a banana smoothie'));
assert(!hit(m('ana', 'loose'), 'a banana smoothie'));
// Diacritics, zero-width, case
assert(hit(m('mira'), 'Mirà'));
assert(hit(m('mira'), 'mi\u200bra'));
// Homoglyph (Cyrillic i)
assert(hit(m('mira'), 'm\u0456ra'));
// Hard negative: unrelated names
assert(!hit(m('mira'), 'miracle on 34th street'));
// Handles and compact variant (>= 5 chars, short signals only)
assert(hit(m('@mira_r'), 'instagram.com/mira_r'));
assert(hit(m('mira rahardjo'), 'MiraRahardjo', { compact: true }));
assert(!hit(m('mira rahardjo'), 'MiraRahardjo'));
assert(!hit(m('mira rahardjo', 'strict'), 'MiraRahardjo', { compact: true }));
// Strict needs word boundaries even for long triggers
assert(!hit(m('rahardjo', 'strict'), 'rahardjowati'));
assert(hit(m('rahardjo', 'normal'), 'rahardjowati'));
// Loose: leetspeak and repeats
assert(hit(m('mira', 'loose'), 'm1r4'));
assert(hit(m('mira', 'loose'), 'miiiira'));
assert(!hit(m('mira', 'normal'), 'm1r4'));
// URL globs
const u = build([{ id: 'x', kind: 'url', value: '*instagram.com/mira_r*' }]);
assert.equal(scanUrl(u, 'https://www.instagram.com/mira_r/?hl=en'), 'x');
assert.equal(scanUrl(u, 'https://www.instagram.com/someone/'), null);
// Fix 1: a pattern without stars still matches inside the address
const u2 = build([{ id: 'x', kind: 'url', value: 'instagram.com/mira_r' }]);
assert.equal(scanUrl(u2, 'https://www.instagram.com/mira_r/'), 'x');
assert.equal(scanUrl(u2, 'https://www.instagram.com/someone/'), null);
// Many stars stay fast
const t0 = Date.now();
scanUrl(build([{ id: 'x', kind: 'url', value: '*a*a*a*a*a*a*a*b' }]), 'a'.repeat(2000));
assert(Date.now() - t0 < 200);
// Fix 7: very short triggers still match a lone word
assert(hit(m('li'), 'Li'));
// Performance: 5 triggers over 20k chars of text
const big = build(['mira', 'rahardjo', 'budi', 'jl melati', 'smanda'].map((v, i) => ({ id: 'x' + i, value: v, kind: 'name' })));
const s0 = performance.now();
scan(big, 'lorem ipsum dolor sit amet '.repeat(800));
assert(performance.now() - s0 < 50, 'scan too slow');
// SAF-01 list is exported for content.js and the support page
const { isSafeHost, SAFE } = require('./matcher.js');
assert(SAFE.length >= 6 && isSafeHost('findahelpline.com'));
console.log('matcher ok');
