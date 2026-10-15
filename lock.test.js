// Run: node lock.test.js
const assert = require('node:assert');
const { make, verify, ITER } = require('./lock.js');

(async () => {
  const a = await make('correct horse battery', 5);
  assert.equal(a.minutes, 5);
  assert.equal(a.iter, ITER);
  assert(ITER >= 200000, 'slow enough to resist guessing');
  assert(!JSON.stringify(a).includes('correct horse'), 'passphrase is never stored');
  assert.equal(await verify('correct horse battery', a), true);
  assert.equal(await verify('correct horse batterz', a), false);
  assert.equal(await verify('', a), false);
  assert.equal(await verify('Correct horse battery', a), false, 'case matters');
  const b = await make('correct horse battery', 5);
  assert.notEqual(a.salt, b.salt, 'fresh salt each time');
  assert.notEqual(a.hash, b.hash, 'same passphrase, different hash');
  const tampered = { ...a, hash: b.hash }; // another user's hash with our salt must not verify
  assert.equal(await verify('correct horse battery', tampered), false);
  console.log('lock ok');
})();
