// node --test tests/        (no network: a small word list stands in for the Wiktionary list)
const test = require('node:test'), assert = require('node:assert');
global.window = {};
const S = require('../static/stemmer.js');

const ROOTS = ['lari', 'sapu', 'pukul', 'tulis', 'baca', 'ambil', 'ikat', 'masak', 'pasak', 'tari', 'nyanyi', 'ajar', 'kerja', 'kata', 'makan', 'buku', 'rumah',
  'bersih', 'sehat', 'ada', 'baik', 'lihat', 'temu', 'malas', 'indah', 'panjang', 'jual', 'dengar', 'beri', 'bangun', 'tiga', 'kain', 'laut', 'latih', 'minum', 'main', 'ternak', 'lajar', 'lari'];
S.setWordlist(new Set(ROOTS));

const CASES = {
  berlari: 'lari', menyapu: 'sapu', memukul: 'pukul', menulis: 'tulis', membaca: 'baca', mengambil: 'ambil', mengikat: 'ikat', memasak: 'masak', menari: 'tari',
  menyanyi: 'nyanyi', pelajar: 'ajar', pelajaran: 'ajar', belajar: 'ajar', bekerja: 'kerja', pekerja: 'kerja', pekerjaan: 'kerja', penulis: 'tulis', pembaca: 'baca',
  pemukul: 'pukul', penyanyi: 'nyanyi', perkataan: 'kata', dimakan: 'makan', dimakannya: 'makan', makanlah: 'makan', bukuku: 'buku', rumahmu: 'rumah',
  kebersihan: 'bersih', kesehatan: 'sehat', keadaan: 'ada', memperbaiki: 'baik', memperlihatkan: 'lihat', diperbaiki: 'baik', terbaik: 'baik', terpukul: 'pukul',
  bertemu: 'temu', mempelajari: 'ajar', dipelajari: 'ajar', sebaiknya: 'baik', seindah: 'indah', sepanjang: 'panjang', penjual: 'jual', penjualan: 'jual',
  pendengar: 'dengar', mendengar: 'dengar', memberikan: 'beri', berikan: 'beri', pembangunan: 'bangun', bangunan: 'bangun', peminum: 'minum', pemain: 'main',
  permainan: 'main', beternak: 'ternak', peternak: 'ternak', 'buku-buku': 'buku', 'bermalas-malasan': 'malas', 'rumah-rumah': 'rumah', melatih: 'latih', pelatih: 'latih',
};
for (const [word, stem] of Object.entries(CASES)) test(`${word} -> ${stem}`, () => assert.strictEqual((S.analyze(word) || {}).stem, stem));

// words that must NOT be cut: no known base, or the base is too short to be a root
for (const word of ['makan', 'terbang', 'berita', 'terang', 'menang', 'xyz', 'a', '']) test(`${word || '(empty)'} stays whole`, () => assert.strictEqual(S.analyze(word), null));

test('without a word list nothing is claimed', () => { S.setWordlist(null); assert.strictEqual(S.analyze('berlari'), null); S.setWordlist(new Set(ROOTS)); });
test('breakdown text', () => {
  assert.strictEqual(S.describe(S.analyze('berlari')), 'ber- + lari');
  assert.strictEqual(S.describe(S.analyze('dimakannya')), 'di- + makan + -nya');
  assert.strictEqual(S.describe(S.analyze('buku-buku')), 'buku (repeated)');
});
test('the shortest path is reported, not a longer one to the same base', () => assert.strictEqual(S.analyze('memperbaiki').steps.length, 2));
