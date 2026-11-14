/* Affix lessons for Kamus (written for this project): what each affix does, how it changes the root, examples to practise with.
   ex lines are  word|root|English.   alt = naive wrong forms ({r} = the root) used as wrong answers in the exercises. */
(function () {
  const L = (id, title, form, lead, rules, ex, tip, alt) => ({ id, title, form, lead, rules, tip, alt,
    examples: ex.trim().split('\n').map(l => { const [word, root, gloss] = l.split('|'); return { word, root, gloss }; }) });

  window.KAMUS_AFFIXES = [
    L('ber', 'ber-', 'ber- / be- / bel-', 'Makes a verb meaning "to have", "to use", "to do", "to be in a state": the subject does it itself.',
      [['usually', 'ber- + root', 'jalan → berjalan'], ['root starts with r', 'ber- (one r)', 'renang → berenang'], ['first syllable of the root ends in -er', 'be-', 'kerja → bekerja, ternak → beternak'], ['one root only', 'bel-', 'ajar → belajar']],
      `berjalan|jalan|to walk
berlari|lari|to run
berbicara|bicara|to speak
bermain|main|to play
berdiri|diri|to stand
bersepeda|sepeda|to ride a bicycle
berambut|rambut|to have hair
berenang|renang|to swim
bekerja|kerja|to work
beternak|ternak|to raise livestock
belajar|ajar|to study`,
      'Start with this one: the root is almost always visible unchanged.', ['be{r}', 'bel{r}', 'ber{r}', 'ter{r}', 'me{r}']),
    L('men', 'meN-', 'me- / mem- / men- / meng- / meny- / menge-', 'Makes an active verb (the subject does the action). The N changes with the first sound of the root, and p, t, s, k disappear.',
      [['l m n r w y, ny ng', 'me-', 'lihat → melihat, masak → memasak, nyanyi → menyanyi'], ['b f v', 'mem-', 'baca → membaca'], ['p (it drops)', 'mem-', 'pukul → memukul'], ['c d j z sy', 'men-', 'cuci → mencuci, dengar → mendengar, jual → menjual'],
       ['t (it drops)', 'men-', 'tulis → menulis, tari → menari'], ['s (it drops)', 'meny-', 'sapu → menyapu'], ['g h kh, vowels', 'meng-', 'gambar → menggambar, ambil → mengambil'], ['k (it drops)', 'meng-', 'kirim → mengirim'], ['one-syllable roots', 'menge-', 'cat → mengecat']],
      `melihat|lihat|to see
membaca|baca|to read
memukul|pukul|to hit
mendengar|dengar|to hear
menulis|tulis|to write
menyapu|sapu|to sweep
mengambil|ambil|to take
mengirim|kirim|to send
menggambar|gambar|to draw
mengecat|cat|to paint
menjual|jual|to sell
memasak|masak|to cook
mencuci|cuci|to wash
menari|tari|to dance
membawa|bawa|to bring
memakai|pakai|to wear, to use`,
      'The dropped sound is the trick: menulis = men- + tulis, but the t is gone. The dictionary lists the root, so look for tulis, not menulis.', ['me{r}', 'mem{r}', 'men{r}', 'meng{r}', 'meny{r}', 'menge{r}']),
    L('di', 'di-', 'di-', 'Makes the passive: the thing is acted on ("is eaten", "is read"). It is part of the verb, written together; the place word di is written apart (di rumah).',
      [['always', 'di- + root', 'makan → dimakan'], ['with -nya or the doer', 'di- + root + -nya', 'dimakannya (eaten by him/her)']],
      `dimakan|makan|is eaten
ditulis|tulis|is written
dibaca|baca|is read
dibeli|beli|is bought
dilihat|lihat|is seen
diambil|ambil|is taken
dikirim|kirim|is sent
dipukul|pukul|is hit`,
      'Compare: Saya menulis surat (I write a letter) and Surat itu ditulis oleh saya (the letter is written by me).', ['ke{r}', 'ter{r}', 'me{r}', 'ber{r}']),
    L('ter', 'ter-', 'ter- / te-', 'Three jobs: something happened by accident or without control (terjatuh), a state that already holds (tertutup), and the superlative (terbaik = the best).',
      [['accident, ability', 'ter- + verb', 'jatuh → terjatuh'], ['finished state', 'ter- + root', 'tutup → tertutup'], ['superlative', 'ter- + adjective', 'baik → terbaik, besar → terbesar']],
      `terjatuh|jatuh|to fall (by accident)
terbaik|baik|best
tertutup|tutup|closed
terlambat|lambat|late
terbesar|besar|biggest
tertidur|tidur|to fall asleep
terbuka|buka|open
terkenal|kenal|famous`,
      'Superlative: add ter- to the adjective, no "more/most" word needed.', ['te{r}', 'ber{r}', 'me{r}', 'di{r}']),
    L('pen', 'peN-', 'pe- / pem- / pen- / peng- / peny- / penge-', 'Makes a noun for the person or thing that does the action: pembaca = reader. It follows the same sound changes as meN-.',
      [['same rules as meN-', 'pe + (m/n/ng/ny)', 'baca → pembaca, tulis → penulis, sapu → penyapu'], ['l m n r w y', 'pe-', 'lari → pelari, main → pemain']],
      `pelari|lari|runner
pembaca|baca|reader
pemukul|pukul|hitter, bat
pendengar|dengar|listener
penulis|tulis|writer
penyapu|sapu|sweeper, broom
pengambil|ambil|taker
pengirim|kirim|sender
penjual|jual|seller
penari|tari|dancer
pemain|main|player
pembeli|beli|buyer
pelukis|lukis|painter
penyanyi|nyanyi|singer`,
      'If you know the meN- verb, you know the peN- noun: menulis → penulis, membaca → pembaca.', ['pe{r}', 'pem{r}', 'pen{r}', 'peng{r}', 'peny{r}', 'penge{r}']),
    L('an', '-an', '-an', 'Makes a noun: the result or object of an action, or a thing of that kind.',
      [['always', 'root + -an', 'makan → makanan'], ['root ending in a vowel', 'root + -an', 'tari → tarian']],
      `makanan|makan|food
minuman|minum|drink
tulisan|tulis|writing
bacaan|baca|reading matter
mainan|main|toy
pakaian|pakai|clothing
masakan|masak|cooking, a dish
lukisan|lukis|painting
tarian|tari|dance
nyanyian|nyanyi|song`,
      'The stress does not move; the word simply grows. Compare makan (to eat) and makanan (food).', ['{r}i', '{r}kan', 'ke{r}an', 'pe{r}an', 'me{r}an']),
    L('kan', '-kan', 'meN- + root + -kan', 'Often with meN-: do something for someone, make something become, or move something somewhere.',
      [['cause', 'root + -kan', 'bersih → membersihkan (to make clean)'], ['for someone', 'root + -kan', 'kirim → mengirimkan (to send something to someone)'], ['to put', 'root + -kan', 'masuk → memasukkan (to put in)']],
      `membersihkan|bersih|to clean (make clean)
memasukkan|masuk|to put in
mengirimkan|kirim|to send (to someone)
menjatuhkan|jatuh|to drop
membesarkan|besar|to enlarge, to raise (a child)
menyelesaikan|selesai|to finish (something)
mengerjakan|kerja|to do, to work on
menjalankan|jalan|to run, to operate
menceritakan|cerita|to tell (a story)`,
      'Memasuk-kan has two k letters: the root masuk ends in k and -kan adds another.', ['me{r}', 'me{r}i', 'me{r}an', 'di{r}kan', '{r}an']),
    L('i', '-i', 'meN- + root + -i', 'Often with meN-: do something to or at a place or person, or do it repeatedly.',
      [['direction or place', 'root + -i', 'datang → mendatangi (to come to)'], ['feeling towards', 'root + -i', 'suka → menyukai (to like), cinta → mencintai']],
      `menyukai|suka|to like
mengunjungi|kunjung|to visit
mendatangi|datang|to come to
melempari|lempar|to pelt
menjauhi|jauh|to avoid, to keep away from
menemui|temu|to meet, to look for
mencintai|cinta|to love`,
      'Compare -kan and -i with the same root: menulis surat (to write a letter) vs menuliskan (to write something down for someone).', ['me{r}', 'me{r}kan', 'me{r}an', '{r}i', 'di{r}i']),
    L('keAn', 'ke-…-an', 'ke- + root + -an', 'Makes an abstract noun (a quality or state), and sometimes something bad that happens to you.',
      [['quality, state', 'ke- + root + -an', 'sehat → kesehatan (health)'], ['bad experience', 'ke- + root + -an', 'hujan → kehujanan (caught in the rain), hilang → kehilangan (to lose)']],
      `kebersihan|bersih|cleanliness
kesehatan|sehat|health
keadaan|ada|situation, condition
kebaikan|baik|goodness, kindness
kecantikan|cantik|beauty
keindahan|indah|beauty (of scenery)
kehilangan|hilang|loss, to lose
kehujanan|hujan|caught in the rain
kebahagiaan|bahagia|happiness
kemerdekaan|merdeka|independence`,
      'Add -an alone and you get a thing; add ke-…-an and you get an idea: makan → makanan (food) but sehat → kesehatan (health).', ['ke{r}', '{r}an', 'ke{r}kan', 'per{r}an', 'pe{r}an']),
    L('perAn', 'per-…-an / pe-…-an', 'per- + root + -an', 'Makes a noun for a process, an event or a relation: pertemuan = a meeting, perjalanan = a journey.',
      [['most roots', 'per- + root + -an', 'temu → pertemuan'], ['some roots', 'pe- + root + -an', 'kerja → pekerjaan (job)']],
      `pertemuan|temu|meeting
perkataan|kata|word, remark
pertanyaan|tanya|question
perjalanan|jalan|journey
persahabatan|sahabat|friendship
perbedaan|beda|difference
perubahan|ubah|change
pertandingan|tanding|match, contest
permainan|main|game
pekerjaan|kerja|job`,
      'It sits next to ke-…-an: perbedaan (a difference, as a fact) and kebaikan (goodness, as a quality).', ['pe{r}an', 'ke{r}an', 'ber{r}an', 'per{r}']),
    L('se', 'se-', 'se-', 'Means "one", "the same" or "as … as": sehari = one day, serumah = in the same house, seindah = as beautiful as.',
      [['one', 'se- + noun', 'hari → sehari (one day), orang → seorang'], ['same', 'se- + noun', 'rumah → serumah (in the same house)'], ['as … as', 'se- + adjective', 'indah → seindah (as beautiful as)']],
      `seindah|indah|as beautiful as
sebesar|besar|as big as
sehari|hari|one day, all day
serumah|rumah|in the same house
setahun|tahun|one year
sekelas|kelas|in the same class
seorang|orang|one (person)
sebaik|baik|as good as`,
      'Comparison: Rumah ini sebesar rumah itu (This house is as big as that house).', ['sa{r}', 'ke{r}', 'ber{r}', 'ter{r}']),
    L('redup', 'Reduplication', 'root-root', 'Repeating a word: plural, repeated or casual action, resembling something, or a fixed expression.',
      [['plural', 'root-root', 'buku → buku-buku (books)'], ['casual or repeated', 'root-root', 'jalan → jalan-jalan (to stroll)'], ['resembling', 'root-root-an', 'kuda → kuda-kudaan (a toy horse)']],
      `buku-buku|buku|books
anak-anak|anak|children
jalan-jalan|jalan|to stroll
makan-makan|makan|to feast, to eat together
berlari-lari|lari|to run about
kuda-kudaan|kuda|a toy horse
bolak-balik|balik|back and forth
tiba-tiba|tiba|suddenly
laki-laki|laki|men`,
      'Plurals are often just context: dua buku (two books), not dua buku-buku.', ['{r}{r}', '{r}-{r}an', 'ber{r}-{r}', 'se{r}-{r}']),
  ];
})();
