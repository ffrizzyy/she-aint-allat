// Builds the store packages. No dependencies. Run: node build.js
// Output: dist/chrome and dist/firefox (load these unpacked) plus one zip per store, ready to upload.
const fs = require('fs');
const zlib = require('zlib');

const version = JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version;
const isRuntime = (f) => /\.(js|html|css)$/.test(f) && !/\.test\.js$/.test(f) && !/^build/.test(f);
const rootFiles = fs.readdirSync('.').filter(isRuntime);
const iconFiles = fs.readdirSync('icons').filter((f) => f.endsWith('.png')).map((f) => `icons/${f}`);

function stage(target, manifest) {
  const out = `dist/${target}`;
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(`${out}/icons`, { recursive: true });
  for (const f of [...rootFiles, ...iconFiles]) fs.copyFileSync(f, `${out}/${f}`);
  fs.copyFileSync(manifest, `${out}/manifest.json`);
  return out;
}

// Minimal zip writer (deflate). Fixed timestamps so the same input gives the same file.
const TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(dir, file) {
  const names = [];
  const walk = (d) => { for (const e of fs.readdirSync(`${dir}/${d}`, { withFileTypes: true })) { const p = d ? `${d}/${e.name}` : e.name; e.isDirectory() ? walk(p) : names.push(p); } };
  walk('');
  names.sort((a, b) => (a === 'manifest.json' ? -1 : b === 'manifest.json' ? 1 : a.localeCompare(b)));
  const date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const parts = [], central = [];
  let offset = 0;
  for (const name of names) {
    const data = fs.readFileSync(`${dir}/${name}`), comp = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data), nm = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(offset, 42);
    parts.push(lh, nm, comp);
    central.push(ch, nm);
    offset += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(file, Buffer.concat([...parts, cd, end]));
  return names.length;
}

fs.mkdirSync('dist', { recursive: true });
for (const [target, manifest] of [['chrome', 'manifest.json'], ['firefox', 'manifest.firefox.json']]) {
  const out = stage(target, manifest);
  const file = `dist/she-aint-allat-${target}-${version}.zip`;
  const n = zip(out, file);
  console.log(`${file}: ${n} files, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
