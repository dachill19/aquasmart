/**
 * Menyusun laporan akhir AQUASMART menjadi laporan.html, lalu build_pdf.cjs
 * mencetaknya ke PDF. Format mengikuti template dosen: A4, margin 2,5 cm,
 * Times New Roman 12 pt, spasi 1,15.
 *
 * Penomoran gambar dan tabel dihitung di sini, dan nomor halaman pada daftar
 * isi diisi dari hasil cetak sebelumnya (pages.json), jadi tidak ada angka
 * yang diketik tangan.
 *
 *   node laporan/diagram.cjs && node laporan/mockup.cjs   (sekali, bila gambar berubah)
 *   node laporan/build_pdf.cjs                            (membangun dan mencetak)
 */
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const ROOT = path.join(DIR, "..");
const IMG = path.join(DIR, "gambar");
const FOTO = path.join(ROOT, "foto");

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml" };
const dataUriBerkas = (file) => {
  const ext = path.extname(file).slice(1).toLowerCase();
  return `data:${MIME[ext]};base64,${fs.readFileSync(file).toString("base64")}`;
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Potongan berkas sumber, diambil langsung supaya kutipan kode tidak bisa melenceng. */
const sumber = (rel, ...rentang) =>
  rentang
    .map(([a, b]) =>
      fs
        .readFileSync(path.join(ROOT, rel), "utf8")
        .split(/\r?\n/)
        .slice(a - 1, b)
        .join("\n")
    )
    .join("\n...\n");

/** Bagian yang datanya belum diberikan. Disorot supaya tidak lolos ke kumpulan. */
const ISI = (t) => `<span class="isi">[${esc(t)}]</span>`;

function susun(peta, opsi = {}) {
  // Mode Google Docs: SVG diganti PNG karena Docs tidak menerima SVG saat ditempel.
  const dataUri = (file) =>
    opsi.docs
      ? dataUriBerkas(path.join(IMG, "docs", path.basename(file).replace(/\.[^.]+$/, ".jpg")))
      : dataUriBerkas(file);
  const ref = (id) => (peta.nomor[id] !== undefined ? peta.nomor[id] : "?");
  const toc = [];
  const daftarGambar = [];
  const daftarTabel = [];
  let bab = 0;
  let nGambar = 0;
  let nTabel = 0;
  const out = [];
  const push = (h) => out.push(h);

  const H1 = (judul) => {
    bab += 1;
    nGambar = 0;
    nTabel = 0;
    const id = `b${bab}`;
    toc.push({ lv: 1, id, teks: judul });
    push(`<h1 id="${id}">${judul}${bab === 1 && !opsi.docs ? '<span class="penanda">§§BODY§§</span>' : ""}</h1>`);
  };
  const H1Polos = (judul, kelas = "") => {
    const id = "h" + toc.length;
    toc.push({ lv: 1, id, teks: judul });
    push(`<h1 id="${id}" class="${kelas}">${judul}</h1>`);
  };
  const H2 = (judul) => {
    const id = "s" + judul.split(" ")[0].replace(/\./g, "_") + toc.length;
    toc.push({ lv: 2, id, teks: judul });
    push(`<h2 id="${id}">${judul}</h2>`);
  };
  const H3 = (judul) => {
    const id = "t" + toc.length;
    toc.push({ lv: 3, id, teks: judul });
    push(`<h3 id="${id}">${judul}</h3>`);
  };
  const P = (t, kelas = "") => push(`<p class="${kelas}">${t}</p>`);
  const UL = (items) => push(`<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`);
  const OL = (items) => push(`<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`);

  /** Gambar bernomor per bab. lebar dalam cm. */
  const GAMBAR = (id, berkas, keterangan, lebar, catatan = "") => {
    nGambar += 1;
    const no = `${bab}.${nGambar}`;
    peta.nomor[id] = no;
    daftarGambar.push({ id: "g-" + id, no, teks: keterangan });
    push(
      `<figure id="g-${id}"><img src="${dataUri(berkas)}" style="width:${lebar}cm"><figcaption><b>Gambar ${no}.</b> ${keterangan}${catatan ? `<br><span class="cat">${catatan}</span>` : ""}</figcaption></figure>`
    );
  };
  /** Dua foto berdampingan dalam satu gambar bernomor. */
  const GAMBAR2 = (id, a, b, keterangan, lebar) => {
    nGambar += 1;
    const no = `${bab}.${nGambar}`;
    peta.nomor[id] = no;
    daftarGambar.push({ id: "g-" + id, no, teks: keterangan });
    push(
      `<figure id="g-${id}"><div class="dua"><img src="${dataUri(a)}" style="width:${lebar}cm"><img src="${dataUri(b)}" style="width:${lebar}cm"></div><figcaption><b>Gambar ${no}.</b> ${keterangan}</figcaption></figure>`
    );
  };

  /** Tabel bernomor per bab. lebar: persen tiap kolom. */
  const TABEL = (id, keterangan, kepala, baris, lebar) => {
    nTabel += 1;
    const no = `${bab}.${nTabel}`;
    peta.nomor[id] = no;
    daftarTabel.push({ id: "t-" + id, no, teks: keterangan });
    push(
      `<div class="tabel" id="t-${id}"><p class="cap"><b>Tabel ${no}.</b> ${keterangan}</p><table><colgroup>${lebar
        .map((w) => `<col style="width:${w}%">`)
        .join("")}</colgroup><thead><tr>${kepala.map((k) => `<th>${k}</th>`).join("")}</tr></thead><tbody>${baris
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`
    );
  };
  const KODE = (judul, isi, kelas = "") =>
    push(`<div class="kode ${kelas}"><div class="kode-judul">${esc(judul)}</div><pre>${esc(isi)}</pre></div>`);

  /* ======================================================== SAMPUL */
  push(`<section class="sampul">
  <div class="sampul-atas">
    <div class="jenis">LAPORAN TUGAS BESAR</div>
    <div class="matkul">INTERNET OF THINGS (IoT)</div>
    <img class="logo-uns" src="${dataUri(path.join(IMG, "logo_uns_hitam.png"))}">
    <div class="judul">AQUASMART</div>
    <div class="subjudul">Akuarium Pintar dengan Pemberi Pakan Otomatis dan Pemantauan Kondisi Air Jarak Jauh</div>
  </div>
  <table class="identitas">
    <tr><td>Judul Proyek</td><td>:</td><td>AQUASMART: Akuarium Pintar dengan Pemberi Pakan Otomatis dan Pemantauan Kondisi Air Jarak Jauh</td></tr>
    <tr><td>Tema Solusi</td><td>:</td><td>Smart Home dan Akuakultur Skala Rumah Tangga</td></tr>
    <tr><td>Mata Kuliah</td><td>:</td><td>Internet of Things (IoT)</td></tr>
    <tr><td>Dosen Pengampu</td><td>:</td><td>${ISI("nama dosen pengampu")}</td></tr>
  </table>
  <div class="anggota">
    <p class="disusun">Disusun oleh Kelompok ${ISI("nomor kelompok")}:</p>
    <ol>
      <li>Daffa Hasanal Arkaan - L0123043</li>
      <li>${ISI("nama anggota 2")} - ${ISI("NIM")}</li>
      <li>${ISI("nama anggota 3")} - ${ISI("NIM")}</li>
      <li>${ISI("nama anggota 4")} - ${ISI("NIM")}</li>
      <li>${ISI("nama anggota 5")} - ${ISI("NIM")}</li>
    </ol>
  </div>
  <div class="institusi">
    <div>PROGRAM STUDI INFORMATIKA</div>
    <div>FAKULTAS TEKNOLOGI INFORMASI DAN SAINS DATA</div>
    <div>UNIVERSITAS SEBELAS MARET</div>
    <div>2026</div>
  </div>
</section>`);

  push("@@DAFTAR@@");

  /* ========================================================== BAB 1 */
    H1("BAB 1: IDENTIFIKASI MASALAH DAN LATAR BELAKANG");

  H2("1.1 Latar Belakang Permasalahan");
  P(
    "Ikan hias, termasuk ikan cupang yang dipakai sebagai acuan prototipe ini, sering mati karena kelalaian pemilik dan jarang karena penyakit. Pekerjaan perawatannya berulang setiap hari dan mudah terlewat: memberi pakan pada jam yang sama dan memastikan air tidak menyusut. Perawatan seperti ini hanya berjalan bila seseorang berada di tempat pada waktunya."
  );
  P(
    "Pada mahasiswa dan pekerja perantau yang menjadi target awal sistem ini, ketidakhadiran adalah keadaan biasa. Pulang kampung beberapa hari, menginap di luar kota, atau pulang larut membuat jadwal pakan terputus. Dari situ muncul empat pola masalah yang berulang."
  );
  UL([
    "Ikan tidak diberi pakan sama sekali selama pemiliknya bepergian beberapa hari.",
    "Pakan diberikan berlebihan, entah karena pemilik lupa sudah memberi atau karena akuarium dititipkan kepada orang lain tanpa takaran. Sisa pakan membusuk dan menaikkan kadar amonia, sehingga air menjadi racun bagi ikan.",
    "Permukaan air turun karena penguapan tanpa disadari. Pompa yang menyedot dari penampung berisiko menarik udara dan cepat rusak.",
    "Pemilik tidak punya catatan kapan ikan terakhir diberi pakan, sehingga tidak bisa membedakan antara belum diberi dan sudah diberi dua kali.",
  ]);
  P(
    "Keempat masalah ini terukur dan tidak membutuhkan peralatan mahal. Ketinggian air dapat dibaca oleh sensor sederhana, dan dua tindakan yang paling dibutuhkan, yaitu memberi pakan dan mengisi ulang air, dapat dikerjakan oleh dua aktuator kecil. Cakupan ini cukup sempit untuk dirakit dan diuji dalam satu semester, sehingga cocok dijadikan studi kasus Internet of Things."
  );

  H2("1.2 Rumusan Masalah");
  OL([
    "Bagaimana merancang sistem yang memberi pakan ikan secara terjadwal, sehingga pemberian tetap berjalan ketika pemilik tidak berada di tempat?",
    "Bagaimana memantau ketinggian air akuarium dari jarak jauh dan mengisinya kembali secara otomatis ketika air menyusut di bawah batas aman?",
    "Bagaimana memantau sisa stok pakan pada wadah penampung, agar pemberian terjadwal tidak gagal diam-diam karena wadahnya kosong?",
    "Bagaimana menyampaikan peringatan kepada pemilik ketika kondisi akuarium keluar dari batas aman, tanpa menunggu pemilik membuka aplikasi?",
    "Bagaimana menyimpan riwayat pembacaan sensor dan tindakan perangkat, sehingga pemilik dapat menelusuri apa yang terjadi selama ia tidak mengawasi?",
  ]);
  P(
    `Rumusan di atas sudah disesuaikan dengan sistem yang akhirnya terbangun. Dokumen ide awal kelompok memuat pemantauan suhu air sebagai rumusan masalah, tetapi sensor suhu tidak jadi dipasang. Sembilan pin GPIO NodeMCU sudah terpakai, dan satu pin yang tersisa ikut menentukan mode boot. Alasan lengkapnya ada pada Subbab ${ref("s64")}, dan dampaknya pada pengembangan berikutnya pada Subbab ${ref("s72")}.`
  );

  H2("1.3 Potensi Solusi IoT");
  P(
    "Inti masalah ini adalah jarak. Besaran yang dibaca sederhana dan tindakan yang diperlukan hanya dua, tetapi keduanya harus terjadi di tempat yang sedang tidak ditunggui. Menghubungkan perangkat ke internet memindahkan kehadiran pemilik yang hilang itu ke jaringan."
  );
  P(
    "Pendekatan terhubung memberi tiga hal yang tidak bisa diberikan rangkaian otomatis yang berdiri sendiri. Pertama, jadwal dan ambang batas dapat diubah tanpa menyentuh perangkat atau mengunggah ulang program, karena nilainya disimpan di layanan awan. Kedua, riwayat pembacaan dan tindakan tersimpan dan dapat ditelusuri kembali. Ketiga, peringatan dapat dikirim aktif ke ponsel pemilik."
  );
  P(
    "Hal ketiga paling menentukan. Lampu merah di sisi akuarium tidak berguna bagi pemilik yang sedang berada di kota lain, padahal keadaan itulah yang melatarbelakangi seluruh sistem ini."
  );

  /* ========================================================== BAB 2 */
  H1("BAB 2: RUMUSAN KONSEP SOLUSI IOT");

  H2("2.1 Deskripsi Konsep Solusi");
  P(
    "AQUASMART adalah sistem akuarium pintar yang menjaga dua hal yang paling sering menyebabkan kematian ikan hias ketika pemilik tidak di tempat, yaitu keteraturan pakan dan kondisi air. Sistem dibagi menjadi tiga lapis dengan tanggung jawab masing-masing."
  );
  UL([
    "Lapis perangkat. NodeMCU ESP8266 di akuarium membaca ketinggian air dan sisa stok pakan, menggerakkan servo penuang pakan dan pompa pengisi air, serta menjalankan jadwal pakan dari jam internalnya sendiri.",
    "Lapis awan. Sebuah Cloudflare Worker menerima telemetri, menyimpannya di basis data D1, menampung perintah yang menunggu, dan meneruskan peringatan ke Telegram.",
    "Lapis antarmuka. Dashboard web responsif dan bot Telegram memakai antrean perintah yang sama, sehingga tidak ada dua jalur kendali dengan aturan yang berbeda.",
  ]);
  P(
    "Jadwal pakan, ambang pompa, dan seluruh kalibrasi sensor disimpan di awan, bukan ditanam di program perangkat. Bila wadah pakan diganti atau sensor bergeser, pemilik cukup mengetik angka baru di dashboard tanpa menyentuh perangkat dan tanpa mengunggah ulang kode. Selama pengujian, kalibrasi sensor air dan sensor pakan diukur ulang beberapa kali dan tidak satu pun menuntut perangkat diprogram ulang."
  );
  P(
    "Sistem ini menggantikan platform IoT pihak ketiga yang dipakai pada modul praktikum. Backend dan dashboard dibangun sendiri di Cloudflare Workers, dan Blynk dihapus dari program perangkat sepenuhnya."
  );

  H2("2.2 Batasan Sistem dan Target Pengguna");
  P(
    "Target pengguna adalah pemelihara ikan hias skala rumah tangga, terutama mahasiswa atau pekerja yang memelihara satu akuarium kecil dan sering meninggalkannya beberapa hari. Pengguna diasumsikan punya ponsel dengan koneksi internet dan jaringan WiFi 2,4 GHz di lokasi akuarium. Pengetahuan elektronika atau pemrograman tidak diperlukan. Pengguna lain yang disasar adalah pemelihara ikan hias dan pemula yang belum terbiasa merawat ikan."
  );
  P("Ruang lingkup sistem dibatasi sebagai berikut.", "rapat");
  UL([
    "Sistem memantau ketinggian air dan sisa stok pakan. Suhu, pH, dan kekeruhan air berada di luar lingkup prototipe.",
    "Sistem bekerja pada satu akuarium dengan satu perangkat. Dukungan banyak perangkat tidak dirancang.",
    "Pengisian air mengambil dari penampung terpisah yang pengisiannya masih manual. Sistem tidak tersambung ke saluran air bertekanan.",
    "Jaringan yang didukung hanya WiFi 2,4 GHz, sesuai kemampuan ESP8266.",
    "Pemberian pakan terjadwal tetap berjalan tanpa internet karena jadwal disalin ke jam internal perangkat. Pemantauan, kendali jarak jauh, dan peringatan memerlukan koneksi.",
    "Dashboard dibuka tanpa login. Ini keputusan sadar untuk keperluan tugas dan demonstrasi. Perangkat tetap memakai kunci rahasia agar basis data tidak bisa dicemari oleh pihak lain.",
  ]);

  H2("2.3 Spesifikasi Fitur Utama");
  H3("2.3.1 Fitur Monitoring");
  TABEL(
    "monitoring",
    "Parameter yang dipantau dan sumber datanya",
    ["Parameter", "Sensor atau sumber", "Satuan", "Penyajian di dashboard"],
    [
      ["Ketinggian air", "Sensor level air resistif", "persen dan nilai ADC mentah", "Angka besar, gauge bersegmen, grafik riwayat"],
      ["Sisa stok pakan", "Ultrasonik HC-SR04", "persen dan milimeter", "Angka besar, gauge bersegmen, grafik riwayat"],
      ["Status pompa", "Keadaan relay di perangkat", "menyala, mati, terkunci", "Teks status dan pita latar pada grafik"],
      ["Keterhubungan alat", "Selisih waktu laporan terakhir", "detik, menit, jam", "Spanduk bila lebih dari 60 detik"],
      ["Kekuatan sinyal", "RSSI ESP8266", "dBm", "Angka"],
      ["Lama alat menyala", "Uptime perangkat", "jam dan menit", "Angka"],
      ["Riwayat kejadian", "Event dari perangkat dan antrean perintah", "waktu dan keterangan", "Tabel catatan dengan pengesahan perintah"],
    ],
    [20, 28, 22, 30]
  );
  H3("2.3.2 Fitur Kontrol");
  TABEL(
    "kontrol",
    "Aktuator beserta aksi otomatis dan manualnya",
    ["Fitur", "Aktuator", "Aksi otomatis", "Aksi manual"],
    [
      ["Pemberian pakan", "Servo SG90", "Dua jadwal harian dari jam internal perangkat", "Tombol dashboard dan perintah /pakan di Telegram"],
      ["Pengisian air", "Pompa DC melalui relay", "Menyala di bawah ambang, berhenti di target isi", "Tombol dashboard dan perintah /pompa di Telegram"],
      ["Buka kunci pompa", "Relay", "Terbuka sendiri saat air kembali di atas ambang", "Tombol dashboard dan perintah /buka di Telegram"],
      ["Jadwal dan durasi", "Servo dan pompa", "Tidak ada", "Dua jam pakan, durasi servo, durasi pompa maksimum"],
      ["Ambang", "Relay dan servo", "Tidak ada", "Ambang pompa, target isi, ambang pakan"],
      ["Kalibrasi sensor", "Tidak ada", "Tidak ada", "Dua titik per sensor, disetel dari dashboard"],
    ],
    [18, 18, 30, 34]
  );
  H3("2.3.3 Fitur Pengaman dan Notifikasi");
  UL([
    "Pengaman luapan. Pompa dihentikan dan permintaan manual ditolak bila ketinggian air mencapai 95 persen, agar air tidak melewati bagian sensor yang kabelnya tidak terlindungi.",
    "Konfirmasi berulang. Pompa baru menyala setelah tiga pembacaan rendah berturut-turut, sehingga satu pembacaan yang meleset tidak langsung menjalankannya.",
    "Jeda antar penyalaan. Pompa tidak menyala lagi dalam 30 detik setelah mati, supaya relay tidak berkedip di sekitar ambang.",
    "Kunci pompa. Bila air tidak naik setelah pompa menyala selama durasi maksimum, pompa dikunci agar tidak berputar kering.",
    "Peringatan Telegram. Air kritis, stok pakan kritis, dan pakan yang selesai diberikan dikirim sebagai pesan ke pemilik.",
    "Perintah kedaluwarsa. Perintah yang tidak diambil perangkat dalam 10 menit tidak lagi diserahkan, sehingga tombol pakan yang ditekan saat alat offline tidak menyala sendiri berjam-jam kemudian.",
  ]);

  /* ========================================================== BAB 3 */
  H1("BAB 3: STUDI LITERATUR DAN REFERENSI");

  H2("3.1 Tinjauan Pustaka");
  P(
    "Sepuluh pustaka berikut dipakai sebagai landasan dan pembanding. Seluruhnya terbitan akses terbuka, dan berkas aslinya disimpan di folder laporan/referensi pada repositori proyek."
  );
  H3("3.1.1 Sistem Akuarium Berbasis IoT");
  P(
    "Lin dan Tseng [1] membangun FishTalk, sistem akuarium mini berbasis IoT. Penelitian itu menunjukkan satu perangkat berdaya rendah mampu memantau dan mengendalikan akuarium sekaligus, pola yang dipakai juga pada AQUASMART."
  );
  P(
    "Abdurohman, Putrada, dan Deris [2] menambahkan algoritme Decision Tree Regression pada sistem kendali akuarium untuk menduga kondisi air. Penelitian itu menekankan bahwa keandalan sistem akuarium bergantung pada kualitas pembacaan sensor. Pengalaman pada prototipe ini sejalan: sebagian besar kendala berasal dari pembacaan sensor dan sangat sedikit dari logika kendali."
  );
  P(
    "Rachman dan Santoso [3] merancang kontrol suhu dan pakan otomatis pada akuarium aquascape dengan NodeMCU ESP8266, dengan susunan perangkat keras yang mirip proyek ini. Wijaya dan Wellem [4] memantau suhu dan ketinggian air akuarium ikan hias berbasis IoT, dan menjadi pembanding terdekat untuk fitur ketinggian air."
  );
  H3("3.1.2 Pemberi Pakan Otomatis");
  P(
    "Ratnasari, Mardhiyyah, dan Pramudwiatmoko [5] membuat prototipe pemberi pakan sekaligus penggantian air, yaitu kombinasi dua aktuator yang sama dengan AQUASMART. Susilawati dan rekan [6] merancang automatic fish feeder bertenaga sel surya. Pada penelitian itu efisiensi pakan naik dari 69,4 persen menjadi 86,8 persen setelah pemberian pakan diotomatiskan, yang memperkuat alasan menjadwalkan takaran pakan secara teratur."
  );
  P(
    "Haryansyah, Hadriansa, dan Andriansyah [7] memakai fitur Automations pada Blynk 2.0 untuk menjadwalkan pakan ikan hias. Penjadwalannya berada di platform pihak ketiga. AQUASMART menyalin jadwal ke jam internal perangkat, sehingga pakan tetap diberikan ketika koneksi terputus."
  );
  H3("3.1.3 Pemantauan Ketinggian Air dan Ketelitian Sensor");
  P(
    "Gunawan, Akbar, dan Ilham [8] memantau level air tandon dengan NodeMCU ESP8266 dan Blynk. Jan dan rekan [9] menyusun tinjauan solusi IoT untuk ketinggian air, kebocoran, dan kendali motor pada tangki air pintar, termasuk pilihan sensor beserta keterbatasannya."
  );
  P(
    "Sze, Hindarto, Wirayasa, dan Haryono [10] membandingkan ketelitian beberapa sensor ultrasonik dalam mengukur jarak. Keterbatasan ketelitian HC-SR04 yang mereka laporkan muncul lagi sebagai kendala nyata pada pengukuran stok pakan AQUASMART (Subbab " +
      ref("s64") +
      ")."
  );

  H2("3.2 Spesifikasi Komponen Perangkat Keras dan Perangkat Lunak");
  GAMBAR("alatbahan", path.join(FOTO, "alat-bahan.png"), "Alat dan bahan yang dipakai pada prototipe", 14.5);

  H3("3.2.1 Mikrokontroler");
  P(
    "NodeMCU ESP8266 versi Amica dipakai sebagai unit pemroses. Board ini memakai chip ESP-12E dengan WiFi 2,4 GHz bawaan, 13 pin GPIO, dan satu pin ADC 10 bit. Logikanya bekerja pada 3,3 volt dengan catu 5 volt dari port USB. Chip USB-to-serial yang dipakai adalah Silicon Labs CP2102, terbaca sebagai COM4 di komputer pengembang."
  );
  P(
    "Pemilihan board ini membawa batasan. Empat komponen sudah menghabiskan sembilan pin GPIO, dan memori ESP8266 menentukan beberapa keputusan rancangan pada Bab 4 dan Bab 6."
  );

  H3("3.2.2 Sensor dan Modul Waktu");
  TABEL(
    "sensor",
    "Spesifikasi sensor dan modul waktu",
    ["Komponen", "Besaran", "Prinsip kerja", "Keterbatasan"],
    [
      ["Sensor level air resistif", "Ketinggian air", "Deretan jalur tembaga membentuk pembagi tegangan. Makin banyak bagian strip yang tercelup, makin kecil hambatannya dan makin besar tegangan yang terbaca ADC.", "Mengukur bagian dirinya yang tercelup, bukan kedalaman tangki. Pembacaan ikut berubah mengikuti konduktivitas air."],
      ["Ultrasonik HC-SR04", "Jarak ke permukaan pakan", "Memancarkan pulsa 40 kHz lalu mengukur waktu pantulnya. Jarak dihitung dari waktu tempuh dan kecepatan suara.", "Berkas pancar melebar sekitar 15 derajat, jarak minimum sekitar 2 cm, dan permukaan tidak rata memantulkan gema ke arah lain."],
      ["RTC DS1302", "Waktu dan tanggal", "Jam dengan baterai cadangan yang dibaca lewat antarmuka tiga kabel (DAT, CLK, RST).", "Waktunya pernah terbaca meleset bertahun-tahun saat pompa berputar, sehingga diselaraskan dari server dan diperiksa kewajarannya."],
    ],
    [18, 14, 36, 32]
  );
  P(
    `Dokumen ide awal kelompok merencanakan sensor suhu DS18B20 sebagai sensor kedua. Pada prototipe akhir, sensor kedua adalah ultrasonik HC-SR04 untuk memantau stok pakan. Syarat minimal dua jenis sensor tetap terpenuhi, dan alasan pergantiannya dibahas pada Subbab ${ref("s64")}.`
  );

  H3("3.2.3 Aktuator");
  TABEL(
    "aktuator",
    "Spesifikasi aktuator",
    ["Aktuator", "Fungsi", "Mekanisme penggerak", "Kebutuhan daya"],
    [
      ["Servo SG90", "Membuka dan menutup gerbang wadah pakan", "Motor DC kecil dengan roda gigi dan potensiometer umpan balik, diposisikan oleh lebar pulsa pada pin sinyal.", "4,8 sampai 6 volt. Menarik 100 sampai 250 mA saat bergerak dan jauh lebih besar saat tertahan."],
      ["Pompa air DC melalui modul relay", "Mengisi ulang air dari penampung", "Relay Songle SRD-05VDC-SL-C memisahkan sisi kendali dari sisi daya secara mekanis, sehingga pompa dapat memakai jalur daya sendiri.", "Coil relay 5 volt, sekitar 70 mA. Pompa 3 sampai 6 volt DC, diumpan dari baterai 9 volt lewat modul step down."],
    ],
    [18, 20, 34, 28]
  );

  H3("3.2.4 Protokol dan Platform Awan");
  P(
    "Perangkat berkomunikasi dengan awan lewat HTTPS dan tidak memakai MQTT. Workers tidak dapat menahan koneksi TCP yang menetap, jadi MQTT memang tidak tersedia pada target peluncuran gratis yang dipilih. Pilihan ini juga menguntungkan: satu permintaan per siklus sudah cukup. Perangkat mengirim telemetri pada badan permintaan dan menerima perintah beserta seluruh setelan pada badan balasan. Pada ESP8266, membentuk sambungan TLS adalah pekerjaan termahal, jadi dua perjalanan yang dijadikan satu memberi penghematan nyata."
  );
  P(
    "Akibatnya, waktu tanggap kendali sama dengan selang telemetri. Perintah yang ditekan di dashboard baru dijalankan pada laporan berikutnya. Dashboard menyatakan hal ini lewat label menunggu alat dan tidak menyembunyikannya."
  );
  TABEL(
    "perangkat-lunak",
    "Komponen perangkat lunak dan layanan awan",
    ["Komponen", "Teknologi", "Peran"],
    [
      ["Program perangkat", "Arduino C++ untuk ESP8266 (781 baris)", "Membaca sensor, menjalankan kendali, berkomunikasi dengan awan"],
      ["Komputasi awan", "Cloudflare Workers dengan kerangka Hono", "Menerima telemetri, menampung perintah, meneruskan peringatan"],
      ["Basis data", "Cloudflare D1 (SQLite)", "Menyimpan pembacaan, kejadian, perintah, dan setelan"],
      ["Antarmuka web", "React 19, Vite, Tailwind CSS 4, Recharts", "Dashboard pemantauan dan kendali"],
      ["Antarmuka pesan", "Telegram Bot API", "Peringatan keluar dan perintah masuk"],
      ["Jam perangkat", "RTC DS1302, diselaraskan dari server", "Menjalankan jadwal pakan tanpa internet"],
    ],
    [22, 36, 42]
  );

  /* ========================================================== BAB 4 */
  H1("BAB 4: PERANCANGAN DETAIL SISTEM");

  H2("4.1 Diagram Proses Bisnis dan Alur Kerja Sistem");
  P(
    `Proses bisnis utama sistem adalah mengirim perintah. Dashboard dan bot Telegram sama-sama menulis ke tabel commands. Perangkat mengambilnya pada telemetri berikutnya, menjalankannya, lalu mengesahkan dengan menyebut id perintah pada laporan sesudahnya (Gambar ${ref("cmd")}).`
  );
  GAMBAR("cmd", path.join(IMG, "alur-perintah.svg"), "Alur sebuah perintah dari pengguna sampai dijalankan perangkat", 14);
  P(
    `Di sisi perangkat, program menjalankan satu putaran tetap tanpa penundaan yang memblokir. Setiap putaran membaca level air, memeriksa kendali pompa, membaca stok pakan, mencocokkan jam dengan jadwal, dan bila sudah lima detik sejak laporan terakhir, mengirim telemetri sambil menerima perintah (Gambar ${ref("flow")}).`
  );
  P(
    "Logika pompa sengaja dibuat lebih rumit dari membandingkan satu angka dengan satu ambang. Pompa baru menyala setelah tiga pembacaan rendah berturut-turut, berhenti di target isi yang berbeda dari ambang nyala, dan menolak menyala lagi sebelum jeda 30 detik berlalu. Alasan tiap aturan dijelaskan pada Bab 6."
  );
  GAMBAR("flow", path.join(IMG, "alur-kerja.svg"), "Diagram alur kerja program perangkat", 15);

  H2("4.2 Arsitektur Sistem IoT");
  GAMBAR("arsitektur", path.join(FOTO, "arsitektur.png"), "Arsitektur sistem AQUASMART", 15);
  TABEL(
    "lapisan",
    "Pemetaan lapisan arsitektur IoT",
    ["Lapisan", "Perwujudan pada AQUASMART"],
    [
      ["IoT Device", "NodeMCU ESP8266 dengan dua sensor, dua aktuator, dan RTC DS1302"],
      ["Local Network", "Jaringan WiFi 2,4 GHz di lokasi akuarium"],
      ["Gateway", "Router WiFi rumah. Tidak ada gateway khusus karena perangkat berbicara HTTPS langsung"],
      ["Global Network", "Internet, HTTPS port 443 menuju jaringan tepi Cloudflare"],
      ["Cloud Services", "Cloudflare Worker sebagai logika server, Cloudflare D1 sebagai basis data"],
      ["User Interface", "Dashboard web React dan bot Telegram"],
    ],
    [24, 76]
  );
  P(
    "Peringatan Telegram dikirim oleh Worker dan tidak oleh perangkat. Sambungan TLS pada ESP8266 membutuhkan sekitar 16 sampai 22 kilobyte heap, dan pada pengujian perangkat sudah gagal mengirim telemetri ketika sisa heap tercatat 16.440 byte. Sambungan TLS kedua ke Telegram dari dalam perangkat akan memperebutkan memori yang sudah tidak cukup. Dengan memindahkan jembatan Telegram satu lapis ke atas, beban pada perangkat nol dan fiturnya tetap ada."
  );

  H2("4.3 Topologi Jaringan dan Protokol Komunikasi");
  GAMBAR("topologi", path.join(FOTO, "topologi-jaringan.png"), "Topologi jaringan AQUASMART", 15);
  TABEL(
    "protokol",
    "Protokol pada tiap segmen komunikasi",
    ["Segmen", "Protokol", "Arah", "Keterangan"],
    [
      ["Perangkat ke router", "WiFi 802.11 b/g/n, 2,4 GHz", "dua arah", "Satu-satunya pita yang didukung ESP8266"],
      ["Perangkat ke Worker", "HTTPS, TLS, port 443", "dua arah dalam satu permintaan", "Telemetri naik pada badan permintaan, perintah turun pada balasan"],
      ["Dashboard ke Worker", "HTTPS, REST JSON", "dua arah", "Penarikan berkala untuk pembacaan terbaru dan riwayat"],
      ["Worker ke Telegram", "HTTPS ke api.telegram.org", "keluar", "Pengiriman peringatan"],
      ["Telegram ke Worker", "HTTPS webhook", "masuk", "Perintah pengguna, dijaga secret token dan daftar chat"],
    ],
    [20, 24, 20, 36]
  );
  TABEL(
    "api",
    "Titik akhir API pada Worker",
    ["Titik akhir", "Metode", "Pemanggil", "Fungsi"],
    [
      ["/api/telemetry", "POST", "Perangkat", "Menyimpan pembacaan dan event, mengesahkan perintah, membalas dengan perintah tertunda, setelan, dan waktu WIB. Wajib header x-device-key"],
      ["/api/command", "POST", "Dashboard", "Memvalidasi dan mengantrekan perintah feed, pump, unlock, atau settings"],
      ["/api/latest", "GET", "Dashboard", "Pembacaan terakhir, 8 event, 12 perintah, dan setelan"],
      ["/api/history", "GET", "Dashboard", "Riwayat level air, stok pakan, dan status pompa untuk grafik"],
      ["/api/telegram", "POST", "Telegram", "Webhook perintah bot. Wajib secret token dan chat yang diizinkan"],
    ],
    [20, 10, 16, 54]
  );
  P(
    "Perangkat mengautentikasi diri ke Worker dengan kunci rahasia pada header, sehingga alamat yang tersebar tidak dapat mencemari catatan telemetri. Webhook Telegram dijaga dua lapis, yaitu secret token yang dikembalikan Telegram pada tiap permintaan dan daftar chat yang diizinkan, karena alamat webhook bersifat publik."
  );

  H2("4.4 Skematik Rangkaian Elektronika");
  GAMBAR("wiring", path.join(FOTO, "rangkaian-fisik.png"), "Skematik rangkaian dan pemetaan pin", 15);
  TABEL(
    "pin",
    "Pemetaan pin NodeMCU sesuai program perangkat",
    ["Komponen", "Pin komponen", "Pin NodeMCU", "GPIO", "Keterangan"],
    [
      ["Modul relay pompa", "IN", "D1", "GPIO 5", "Aktif rendah"],
      ["Sensor level air", "VCC", "D0", "GPIO 16", "Diberi daya hanya saat mengukur, untuk memperlambat korosi"],
      ["Sensor level air", "Sinyal", "A0", "ADC0", "Pembacaan 10 bit"],
      ["HC-SR04", "TRIG", "D5", "GPIO 14", "Pemicu pulsa"],
      ["HC-SR04", "ECHO", "D6", "GPIO 12", "Penerima gema"],
      ["Servo SG90", "Sinyal", "D7", "GPIO 13", "Daya dari Vin, bukan 3V3"],
      ["RTC DS1302", "DAT", "D3", "GPIO 0", "Antarmuka tiga kabel"],
      ["RTC DS1302", "CLK", "D2", "GPIO 4", "Antarmuka tiga kabel"],
      ["RTC DS1302", "RST", "D8", "GPIO 15", "Antarmuka tiga kabel"],
    ],
    [22, 15, 15, 14, 34]
  );
  P(
    `Pada tabel pin di dalam gambar, baris relay tertulis D5 (GPIO 14). Pemetaan yang benar mengikuti program perangkat dan ditampilkan pada Tabel ${ref("pin")}: relay di D1 (GPIO 5), sedangkan D5 dipakai TRIG sensor ultrasonik. Gambar tetap berguna untuk melihat sambungan daya dan posisi tiap modul.`
  );
  P(
    "Sembilan pin GPIO terpakai dan hanya D4 yang tersisa. Keterbatasan ini ikut membuat sensor suhu tidak jadi ditambahkan."
  );
  P(
    "Pada gambar, baterai 9 volt diturunkan menjadi 5 volt oleh modul DC-DC step down, dan pompa air 3 sampai 6 volt DC dialiri lewat kontak relay. Sisi kendali relay memakai ground NodeMCU. Jalur ground bersama ini penting karena arus aktuator yang mengalir lewat ground yang juga menjadi acuan sensor air sempat mengacaukan pembacaan sensor, seperti dibahas pada Subbab " +
      ref("s64") +
      "."
  );

  H2("4.5 Desain Antarmuka Aplikasi Web");
  P(
    `Tata letak dashboard dirancang dengan satu aturan: angka yang menentukan keselamatan ikan harus terbaca dari jarak satu meter tanpa diklik. Ketinggian air dan stok pakan karena itu menjadi angka besar dengan gauge bersegmen yang menandai posisi ambang, sedangkan rincian seperti nilai ADC mentah dan jarak dalam milimeter ditaruh lebih kecil di bawahnya (Gambar ${ref("mockup")}).`
  );
  GAMBAR(
    "mockup",
    path.join(IMG, "mockup-dashboard.svg"),
    "Rancangan tata letak dashboard",
    15,
    "(1) Header dan waktu laporan terakhir, (2) angka besar air dan pakan, (3) panel tindakan, (4) baris status perangkat, (5) tabel catatan, (6) grafik riwayat, (7) panel setelan"
  );
  P(
    "Aturan kedua adalah jujur terhadap keadaan data. Ketika perangkat diam lebih dari 60 detik, dashboard menampilkan spanduk yang menyatakan bahwa angka di layar adalah pembacaan terakhir yang tersimpan dan bukan kondisi saat ini. Pembacaan yang gagal ditampilkan sebagai tidak terbaca, tidak sebagai nol persen, karena bagi pemilik ikan keduanya berarti sangat berbeda. Perintah yang belum diambil perangkat ditampilkan sebagai menunggu, dan yang melewati 10 menit ditampilkan sebagai kedaluwarsa."
  );

  /* ========================================================== BAB 5 */
  H1("BAB 5: IMPLEMENTASI PROTOTIPE");

  H2("5.1 Implementasi Perangkat Keras");
  P(
    `Perangkat dirakit pada papan kecil yang dipasang di atas wadah plastik. Wadah pakan dari botol dipasang tegak di atas wadah itu dengan servo sebagai penutup gerbang penuang, dan sensor ultrasonik di mulut wadah pakan menghadap ke dalam. Sensor level air digantung ke dalam akuarium, dan pompa diletakkan di penampung terpisah dengan selang menuju akuarium. Gambar ${ref("prototipe")} memperlihatkan rakitan pada tahap akhir perakitan. Foto penyusunan dan pengujian oleh kelompok ada pada Lampiran 2.`
  );
  GAMBAR("prototipe", path.join(FOTO, "proses-pembuatan-2.jpeg"), "Rakitan prototipe pada tahap akhir perakitan", 6);
  P(
    "Dua keputusan perakitan lahir dari kegagalan. Wadah pakan berbentuk kerucut pada rakitan awal diganti wadah berdinding lurus, karena dinding miring memantulkan gema ultrasonik ke arah yang tidak kembali ke sensor. Kabel daya servo dipindah dari 3V3 ke Vin, kemudian kabel VCC modul relay juga dipindah ke Vin, karena coil relay bertanda 5 volt tidak bekerja andal pada 3,3 volt."
  );

  H2("5.2 Implementasi Perangkat Lunak dan Konfigurasi Awan");
  H3("5.2.1 Struktur Program Perangkat");
  P(
    "Seluruh pekerjaan berkala dijadwalkan dengan membandingkan selisih millis, sehingga pembacaan sensor, pemeriksaan jadwal, pengendalian aktuator, dan pengiriman telemetri berjalan berdampingan dalam satu putaran."
  );
  KODE("AQUASMART.ino, fungsi loop()", sumber("firmware/AQUASMART/AQUASMART.ino", [769, 781]));
  P(
    "Pembacaan ultrasonik tidak dipakai mentah. Satu ping tunggal pada wadah yang sama sekali tidak bergerak pernah menghasilkan 0,07 cm lalu 87 cm. Setiap pengukuran karena itu mengambil lima ping, membuang hasil di luar rentang 2 sampai 100 cm, mengambil nilai tengahnya, lalu meratakannya dengan pembacaan sebelumnya (bobot 0,4). Nilai tengah dipilih karena satu pantulan liar sejauh 87 cm menarik rata-rata jauh, sedangkan nilai tengah mengabaikannya."
  );
  KODE("AQUASMART.ino, pingSekali() dan pingMedian()", sumber("firmware/AQUASMART/AQUASMART.ino", [375, 409]));

  H3("5.2.2 Logika Kendali Pompa");
  P(
    "Ambang nyala dan target isi adalah dua nilai berbeda. Pada rancangan awal keduanya sama, sehingga pompa berhenti pada detik air baru melewati garis yang menyalakannya dan akuarium tidak pernah benar-benar terisi. Pengaman luapan diperiksa lebih dulu dan berlaku juga untuk perintah manual dari dashboard."
  );
  KODE("AQUASMART.ino, pengaman luapan dan penyalaan otomatis", sumber("firmware/AQUASMART/AQUASMART.ino", [279, 284], [318, 331]));
  P(
    "Keputusan mengunci pompa diambil dari pembacaan pertama setelah pompa mati. Selama pompa berputar, nilai ADC melonjak dari sekitar 12 menjadi sekitar 36 persen, sehingga pembacaan terakhir saat pompa jalan tidak bisa dipercaya. Sebelum aturan ini, pompa kadang terkunci dan kadang tidak untuk keadaan air yang sama."
  );

  H3("5.2.3 Logika Server dan Basis Data");
  P(
    "Basis data D1 menyimpan empat tabel: readings untuk riwayat pembacaan, events untuk kejadian dari perangkat, commands untuk antrean perintah, dan settings untuk seluruh nilai yang bisa diubah pengguna. Pembacaan lebih dari tujuh hari dihapus setiap perangkat melapor, karena pada selang lima detik tabel bertambah sekitar 17.000 baris per hari."
  );
  P(
    "Pengiriman telemetri bersifat at-least-once. Bila permintaan sampai ke server tetapi balasannya hilang, perangkat mengira gagal dan mengirim ulang seluruh antrean kejadiannya. Tanpa penangkal, satu peringatan pakan pernah tersimpan 60 kali. Setiap kejadian karena itu diberi penanda unik dari perangkat, dan indeks unik pada kolom ext_id mengubah pengiriman ulang menjadi operasi tanpa efek."
  );
  KODE("schema.sql, tabel events dan indeks unik", sumber("schema.sql", [35, 49]));
  KODE("index.ts, penyimpanan event dan pengiriman peringatan", sumber("src/worker/index.ts", [174, 199]));
  P(
    "Setelan dan kalibrasi divalidasi di server sebelum disimpan. Pemeriksaan tidak berhenti pada rentang tiap nilai, tetapi juga pada hubungan antarnilai: target isi harus minimal 10 persen di atas ambang nyala, titik basah sensor air minimal 20 satuan ADC di atas titik keringnya, dan jarak wadah kosong minimal 10 mm lebih jauh dari wadah penuh. Pemeriksaan dilakukan terhadap gabungan nilai lama dan baru, karena mengubah satu sisi pasangan saja sudah bisa membalik skala."
  );

  H3("5.2.4 Jembatan Telegram");
  P(
    "Jembatan Telegram adalah modul tersendiri di dalam Worker. Peringatan hanya dikirim untuk baris kejadian yang benar-benar baru tertulis, sehingga pengiriman ulang dari perangkat tidak menghasilkan pesan ganda, dan pengirimannya dijadwalkan setelah perangkat dibalas. Webhook menolak permintaan tanpa secret token dan mengabaikan pesan dari chat yang tidak diizinkan."
  );
  KODE("telegram.ts, penjagaan webhook dua lapis", sumber("src/worker/telegram.ts", [176, 200]));

  H2("5.3 Implementasi Aplikasi Web");
  P(
    `Dashboard dibangun dengan React 19 dan Vite, ditata dengan Tailwind CSS, dengan grafik riwayat dari Recharts. Berkas statisnya dilayani oleh Worker yang sama dengan API-nya, jadi tidak ada layanan hosting terpisah. Gambar ${ref("dashboard")} adalah tangkapan layar dashboard yang berjalan di Cloudflare Workers.`
  );
  GAMBAR("dashboard", path.join(IMG, "dashboard.jpg"), "Dashboard AQUASMART yang berjalan di Cloudflare Workers", 11);
  P(
    "Spanduk di bagian atas tangkapan layar muncul karena perangkat sedang tidak terhubung saat gambar diambil. Tabel catatan di bawahnya menampilkan riwayat kejadian beserta pengesahan setiap perintah yang pernah dikirim, dan pita biru pada kolom durasi menunjukkan lamanya servo atau pompa bekerja."
  );
  P(
    "Grafik riwayat menggambar lebih dari dua garis. Rentang waktu pompa menyala diberi pita latar, sehingga pertanyaan apakah ketinggian air benar-benar menanggapi pompa dijawab dengan melihat. Garis ambang dan garis target isi digambar pada posisinya. Panel setelan menyimpan perubahan yang belum disimpan pengguna sehingga penarikan data berkala tidak menimpanya, dan tombol buka kunci pompa dinonaktifkan selama pompa tidak terkunci."
  );
  P(
    "Bot Telegram melayani lima perintah: /status untuk kondisi terkini, /pakan untuk memberi pakan, /pompa untuk menyalakan atau mematikan pompa, /buka untuk membuka kunci pompa, dan /help untuk daftar perintah. Perintah itu masuk ke antrean yang sama dengan perintah dari dashboard."
  );

  /* ========================================================== BAB 6 */
  H1("BAB 6: PENGUJIAN DAN ANALISIS HASIL");

  H2("6.1 Skenario Pengujian Sistem");
  P(
    "Pengujian dilakukan langsung pada prototipe yang sudah dirakit. Data dibaca dari Serial Monitor perangkat dan dari basis data D1 di sisi server. Sembilan skenario dijalankan."
  );
  OL([
    "Pengiriman telemetri: memastikan perangkat mengirim pembacaan secara berkala dan mengukur selang antar pengiriman yang berhasil.",
    "Kalibrasi sensor air: membaca nilai ADC pada kondisi kering dan pada ketinggian air aman tertinggi, lalu menyimpannya sebagai titik nol dan titik seratus persen.",
    "Kalibrasi sensor pakan: mengukur jarak sensor ke dasar wadah kosong dan ke permukaan pakan saat penuh.",
    "Pemberian pakan manual: menekan tombol di dashboard dan mengamati gerakan serta durasi servo.",
    "Pemberian pakan terjadwal: menyetel jadwal dari dashboard lalu menunggu perangkat menjalankannya dari jam internal.",
    "Kendali pompa: menjalankan pompa manual dan otomatis, termasuk pengaman luapan dan penguncian.",
    "Ketahanan terhadap pengiriman ulang: mengirim event yang sama dua kali dan memastikan hanya satu yang tersimpan.",
    "Jembatan Telegram: menguji peringatan keluar, perintah masuk, penolakan tanpa secret token, dan penolakan chat yang tidak diizinkan.",
    "Pengujian otomatis server (npm test) terhadap schema.sql di SQLite: kedaluwarsa perintah, penghapusan pembacaan lama, dan penolakan kalibrasi terbalik.",
  ]);

  H2("6.2 Hasil Pengujian Sensor dan Transmisi Data");
  TABEL(
    "kalibrasi",
    "Hasil kalibrasi dua titik pada kedua sensor",
    ["Sensor", "Titik 0 persen", "Titik 100 persen", "Cara memperoleh"],
    [
      ["Level air", "ADC 10 (strip kering, terukur 3 sampai 10)", "ADC 210 (ketinggian aman tertinggi)", "Dibaca dari alat pada dua ketinggian air"],
      ["Stok pakan", "82 mm (jarak ke dasar wadah kosong)", "35 mm (jarak ke permukaan saat penuh)", "Diukur sebagai jarak, dapat diperiksa dengan penggaris"],
    ],
    [14, 30, 28, 28]
  );
  P(
    "Sensor pakan menghasilkan besaran fisik yang bisa dicek dengan penggaris. Sensor air menghasilkan angka ADC yang tidak punya arti fisik sendiri dan hanya bermakna relatif terhadap dua titik acuan yang diukur pada alat itu sendiri."
  );
  TABEL(
    "adc",
    "Sepuluh pembacaan ADC berturut-turut pada ketinggian air aman tertinggi",
    ["Pembacaan ke", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    [["Nilai ADC", "235", "216", "226", "222", "194", "187", "209", "217", "217", "208"]],
    [18, 8.2, 8.2, 8.2, 8.2, 8.2, 8.2, 8.2, 8.2, 8.2, 8.2]
  );
  P(
    "Rentang pembacaan 187 sampai 235 dengan rata-rata 213,1, yaitu ayunan sekitar 12 persen tanpa tren naik atau turun. Titik 100 persen ditetapkan pada 210, nilai tipikal dan bukan puncaknya. Ini keputusan keselamatan: titik 100 persen yang terlalu tinggi membuat sistem mengira air lebih sedikit dari kenyataan lalu terus memompa melewati kabel sensor, sedangkan titik yang terlalu rendah hanya membuat pompa berhenti lebih awal."
  );
  TABEL(
    "pakan-uji",
    "Hasil pengujian terkendali sensor pakan pada berbagai permukaan",
    ["Permukaan", "Pembacaan berhasil", "Keterangan"],
    [
      ["Serpih oat", "2 dari 20", "Gema terhambur"],
      ["Serpih oat yang diratakan", "0 dari 8", "Gema tetap terhambur"],
      ["Kertas datar", "14 dari 14", "Permukaan pantul yang baik"],
    ],
    [34, 26, 40]
  );
  P(
    "Panjang gelombang 40 kHz di udara sekitar 8,6 mm, mendekati ukuran butir oat, sehingga gema terhambur. Pelet ikan yang lebih kecil dan keras diperkirakan terbaca jauh lebih baik, tetapi hal ini belum diuji. Sensor pakan juga hanya punya resolusi kasar: seluruh skala 0 sampai 100 persen berada dalam 1,5 cm jarak, sedangkan resolusi HC-SR04 sekitar 0,3 cm, sehingga satu langkah bacaan setara sekitar 20 persen stok."
  );
  TABEL(
    "tls",
    "Keandalan transmisi data sebelum dan sesudah perbaikan buffer TLS",
    ["Kondisi", "Selang antar laporan berhasil", "Tingkat kegagalan"],
    [
      ["Buffer terima TLS 512 byte", "sekitar 12,25 detik", "Sebagian besar pengiriman gagal dengan kode -5"],
      ["Buffer terima TLS 16.384 byte", "5,0 detik", "Tidak ada kegagalan selama pengamatan"],
    ],
    [30, 30, 40]
  );
  P(
    "Kegagalan awal disebabkan buffer terima TLS yang terlalu kecil. Buffer 512 byte hanya cukup bila server mau menegosiasikan Maximum Fragment Length, dan Cloudflare tidak mendukungnya, sehingga setiap pembentukan sambungan gagal. Setelah buffer dinaikkan, selang antar laporan turun menjadi 5 detik tanpa kegagalan selama pengamatan."
  );
  TABEL(
    "latensi",
    "Waktu tanggap sistem",
    ["Jalur", "Nilai", "Sumber"],
    [
      ["Selang telemetri perangkat ke server", "5,0 detik", "Terukur setelah perbaikan buffer TLS"],
      ["Perintah dashboard sampai dijalankan perangkat", "paling lama satu selang telemetri, hitungan detik", "Perintah pompa id 31 dijalankan dalam hitungan detik setelah dikirim"],
      ["Batas waktu satu permintaan HTTP perangkat", "6 detik", "http.setTimeout(6000) pada program perangkat"],
      ["Servo membuka pada pakan manual", "3,00 detik", "Penanda waktu Serial Monitor"],
      ["Perangkat dianggap offline oleh dashboard", "lebih dari 60 detik tanpa laporan", "OFFLINE_AFTER_MS pada kode dashboard"],
    ],
    [38, 28, 34]
  );

  H2("6.3 Hasil Pengujian Kontrol Aktuator dan Antarmuka");
  TABEL(
    "aktuator-uji",
    "Hasil pengujian aktuator dan antarmuka",
    ["Skenario", "Hasil", "Bukti"],
    [
      ["Pakan manual dari dashboard", "Berhasil", "Servo membuka tepat 3,00 detik, terukur dari penanda waktu Serial Monitor"],
      ["Pakan terjadwal", "Berhasil", "Servo bergerak sendiri pada pukul 16.52.02 dengan metode Otomatis Pagi, tepat satu kali"],
      ["Pompa manual dari dashboard", "Berhasil", "Perintah id 31 dijalankan dalam hitungan detik setelah dikirim"],
      ["Pompa otomatis", "Berhasil", "Menyala setelah tiga pembacaan rendah berturut-turut"],
      ["Pengaman luapan", "Berhasil", "Pompa dihentikan dan permintaan manual ditolak pada pembacaan 100 persen"],
      ["Penguncian pompa", "Berhasil", "Event critical_water tercatat setelah air tidak naik dalam durasi maksimum"],
      ["Penangkal pengiriman ulang", "Berhasil", "Tiga kiriman dengan dua penanda unik menghasilkan tepat dua baris event"],
      ["Telegram, peringatan keluar", "Berhasil", "Peringatan air kritis diterima satu kali walau dikirim dua kali"],
      ["Telegram, perintah masuk", "Berhasil", "Perintah /pakan masuk ke tabel commands dengan id 1"],
      ["Telegram, tanpa secret token", "Ditolak", "Dibalas HTTP 401"],
      ["Telegram, chat tidak diizinkan", "Ditolak", "Dibalas HTTP 200 tanpa memasukkan perintah apa pun ke antrean"],
      ["Perintah lebih dari 10 menit", "Tidak diserahkan", "Pengujian otomatis: hanya perintah yang masih baru yang diserahkan ke perangkat"],
      ["Pembacaan lebih dari 7 hari", "Dihapus", "Pengujian otomatis: baris berumur 8 hari terhapus saat perangkat melapor"],
      ["Kalibrasi terbalik", "Ditolak", "Pengujian otomatis: air_kering 300 dengan air_basah 250 dibalas HTTP 400"],
    ],
    [28, 14, 58]
  );
  P(
    "Keempat pengujian otomatis (npm test) lulus semuanya. Pengujian jembatan Telegram dilakukan tanpa melibatkan perangkat karena seluruh jembatan ada di sisi server. Perintah yang diantrekan dari Telegram diverifikasi langsung pada tabel commands, dan jalur dari antrean ke perangkat sudah terbukti pada pengujian kendali dashboard."
  );

  H2("6.4 Analisis dan Pembahasan Kendala");
  P(
    "Prototipe menjalankan seluruh fitur yang dirancang, tetapi perjalanannya tidak mulus. Kendala dicatat apa adanya beserta penyelesaiannya, karena sebagian besar hanya terungkap lewat pengukuran dan tidak lewat membaca kode."
  );
  H3("6.4.1 Kendala yang Berhasil Diselesaikan");
  TABEL(
    "kendala",
    "Kendala teknis dan penyelesaiannya",
    ["Kendala", "Sebab", "Penyelesaian"],
    [
      ["Sebagian besar pengiriman telemetri gagal dengan kode -5.", "Buffer terima TLS 512 byte hanya cukup bila server menegosiasikan Maximum Fragment Length, dan Cloudflare tidak mendukungnya.", "Buffer dinaikkan menjadi 16.384 byte. Selang laporan turun dari 12,25 detik menjadi 5,0 detik tanpa kegagalan."],
      ["Setelah pemeriksaan sertifikat server ditambahkan, setiap POST gagal dengan kode -1 sampai board di-reset.", "Daftar sertifikat akar memakan 4 sampai 7 KB heap, sehingga buffer TLS 16 KB tidak mendapat blok memori utuh. Pemeriksaan sertifikat juga butuh jam yang benar, sementara DS1302 sempat meleset bertahun-tahun.", "Pemeriksaan sertifikat dicabut dan perangkat kembali memakai setInsecure(). Kode gagal kini mencetak blok heap terbesar dan kode kesalahan TLS."],
      ["Satu peringatan tersimpan puluhan kali di basis data.", "Pengiriman bersifat at-least-once. Balasan yang hilang membuat perangkat mengirim ulang seluruh antrean event.", "Setiap event diberi penanda unik dari perangkat, dan indeks unik pada kolom itu mengubah pengiriman ulang menjadi tanpa efek."],
      ["Pompa berhenti pada detik air baru melewati ambang nyala.", "Ambang nyala dan ambang henti bernilai sama.", "Target isi dijadikan nilai terpisah, dengan validasi server yang menuntut jarak minimal 10 persen."],
      ["Pompa kadang terkunci dan kadang tidak untuk keadaan air yang sama.", "Keputusan kunci memakai pembacaan terakhir saat pompa masih berputar, ketika ADC melonjak.", "Keputusan kunci ditunda sampai pembacaan pertama setelah pompa mati."],
      ["Jam perangkat pernah terbaca tahun 2042 dan jadwal pakan ikut melenceng.", "Pemeriksaan bawaan pustaka RTC hanya memeriksa penanda berhenti, bukan kewajaran tanggalnya.", "Server mengirim waktu WIB tiap siklus untuk diselaraskan, dan program menolak menjalankan jadwal bila tahun di luar 2025 sampai 2035."],
      ["Pembacaan sensor pakan melonjak liar pada wadah yang tidak bergerak.", "Wadah berbentuk kerucut memantulkan gema dari dinding miring, bukan dari permukaan pakan.", "Wadah diganti yang berdinding lurus, dan pembacaan memakai median lima ping ditambah perataan antar siklus."],
      ["Servo dan relay mati bersamaan lalu hidup lagi tanpa sebab jelas.", "Residu lem pada ujung pin kabel pompa dan baterai menciptakan sambungan berhambatan tinggi, sekitar 4 sampai 9 ohm menurut pergeseran ADC saat relay aktif.", "Permukaan kontak dibersihkan. Pergeseran ADC turun dari 127 menjadi 38 satuan dan kedua aktuator kembali bekerja."],
      ["Pembacaan sensor air melonjak dari 4 menjadi lebih dari 120 setiap relay aktif.", "Arus aktuator mengalir lewat ground yang juga menjadi acuan nol sensor air, sehingga acuan itu bergeser.", "Berkurang sebagian setelah kontak dibersihkan. Pemisahan jalur ground menyeluruh dicatat sebagai saran."],
      ["Tombol pakan yang ditekan saat alat offline menyala sendiri berjam-jam kemudian.", "Perintah menunggu tanpa batas waktu di antrean.", "Perintah lebih dari 10 menit tidak lagi diserahkan, dan dashboard menandainya kedaluwarsa."],
      ["Isian setelan di dashboard terhapus tiap penarikan data.", "Formulir ditimpa oleh data terbaru setiap polling.", "Formulir mempertahankan perubahan yang belum disimpan."],
    ],
    [26, 38, 36]
  );

  H3("6.4.2 Keterbatasan yang Disadari");
  P("Beberapa keterbatasan tidak diselesaikan pada prototipe ini.", "rapat");
  UL([
    "Tidak ada sensor suhu. Dokumen ide awal merencanakan DS18B20, tetapi sembilan dari sepuluh pin GPIO sudah terpakai dan pin yang tersisa ikut menentukan mode boot. Sensor kedua akhirnya diisi ultrasonik untuk stok pakan, yang menjawab kebutuhan lain tetapi sama nyata.",
    "Sensor pakan gagal membaca permukaan serpih oat (Tabel " + ref("pakan-uji") + ") dan resolusinya kasar, sekitar 20 persen stok per langkah.",
    "Pembacaan sensor air saat pompa menyala belum sepenuhnya jujur. Pergeseran sisa sekitar 38 satuan ADC baru hilang bila jalur ground sensor dipisahkan dari jalur arus aktuator.",
    "Dashboard tidak memakai login. Siapa pun yang tahu alamatnya dapat mengirim perintah. Bot Telegram dijaga dua lapis.",
    "Perangkat tidak memeriksa sertifikat server (setInsecure). Orang di WiFi yang sama berpeluang memalsukan pembacaan. Kendali alat memang terbuka lewat dashboard, jadi risiko yang tersisa hanya pembacaan palsu.",
    "Jadwal pakan hanya dua kali sehari dengan durasi servo yang sama. Takaran tidak dikalibrasi terhadap berat pakan.",
  ]);

  /* ========================================================== BAB 7 */
  H1("BAB 7: KESIMPULAN DAN SARAN");

  H2("7.1 Kesimpulan");
  P(
    "Prototipe AQUASMART menjawab permasalahan pada Bab 1. Sistem memberi pakan terjadwal tanpa kehadiran pemilik, memantau ketinggian air dan mengisinya kembali otomatis, memantau sisa stok pakan, mengirim peringatan ke ponsel pemilik, dan menyimpan riwayat pembacaan serta tindakan yang dapat ditelusuri."
  );
  OL([
    "Pemberian pakan terjadwal berjalan dari jam internal perangkat. Pada pengujian servo bergerak sendiri pada waktu yang ditetapkan, dan jadwal tetap bekerja walau koneksi internet terputus.",
    "Pengisian air otomatis memakai ambang nyala dan target isi yang terpisah, dilengkapi konfirmasi tiga pembacaan, jeda antar penyalaan, kunci pompa, dan pengaman luapan. Semuanya terbukti aktif pada pengujian.",
    "Menyimpan kalibrasi dan setelan di server terbukti paling berguna. Kalibrasi diukur ulang berkali-kali selama pengujian tanpa sekali pun mengunggah ulang program.",
    "Peringatan Telegram menutup kelemahan dashboard, yang hanya berguna bagi pemilik yang sedang membukanya. Menempatkan jembatan Telegram di awan membuat fitur itu tersedia tanpa menambah beban memori ESP8266.",
    "Sebagian besar kendala berasal dari dunia fisik: pantulan gema, hambatan kontak, dan jalur ground bersama. Kendala semacam itu baru ditemukan lewat pengukuran pada alat yang sebenarnya.",
  ]);

  H2("7.2 Saran dan Pengembangan Selanjutnya");
  OL([
    "Memisahkan jalur ground sensor dari jalur arus aktuator secara menyeluruh, supaya pembacaan sensor air saat pompa menyala jujur dan pengaman luapan tidak terpicu angka palsu.",
    "Menambahkan sensor suhu air DS18B20 dengan ekspander pin, atau mengganti board dengan ESP32 yang punya lebih banyak GPIO dan memori sehingga pemeriksaan sertifikat server juga layak dipasang.",
    "Mengganti baterai 9 volt pada rangkaian pompa dengan adaptor atau sumber berhambatan dalam lebih rendah, karena baterai kotak tegangannya turun saat motor mulai berputar.",
    "Menambahkan login pada dashboard dengan pola dua lapis seperti webhook Telegram.",
    "Meringkas riwayat pembacaan yang lebih tua dari tujuh hari menjadi rata-rata per jam, alih-alih menghapusnya.",
    "Memperluas bot Telegram agar mendukung pengaturan jadwal dan ambang, sehingga semua fungsi dashboard tersedia dari aplikasi pesan.",
    "Menguji sensor pakan dengan pelet ikan sungguhan, dan mengkalibrasi takaran servo terhadap berat pakan.",
  ]);

  /* ===================================================== DAFTAR PUSTAKA */
  H1("DAFTAR PUSTAKA");
  const pustaka = [
    'Y.-B. Lin dan H.-C. Tseng, "FishTalk: An IoT-Based Mini Aquarium System," <i>IEEE Access</i>, vol. 7, hlm. 35457-35469, 2019. DOI: 10.1109/ACCESS.2019.2905017.',
    'M. Abdurohman, A. G. Putrada, dan M. M. Deris, "A Robust Internet of Things-Based Aquarium Control System Using Decision Tree Regression Algorithm," <i>IEEE Access</i>, vol. 10, hlm. 56937-56951, 2022. DOI: 10.1109/ACCESS.2022.3177225.',
    'F. P. Rachman dan H. Santoso, "Sistem Kontrol Suhu dan Pakan Otomatis dalam Aquarium Aquascape Menggunakan NodeMCU ESP8266," <i>JATISI</i>, vol. 9, no. 1, hlm. 352-364, 2022. DOI: 10.35957/jatisi.v9i1.1464.',
    'P. Wijaya dan T. Wellem, "Perancangan dan Implementasi Sistem Pemantauan Suhu dan Ketinggian Air pada Akuarium Ikan Hias berbasis IoT," <i>Jurnal Sistem Komputer dan Informatika (JSON)</i>, vol. 4, no. 1, hlm. 225-233, 2022. DOI: 10.30865/json.v4i1.4539.',
    'D. Ratnasari, R. Mardhiyyah, dan A. Pramudwiatmoko, "IoT Prototype Development of Automatic Fish Feeder and Water Replacement," <i>International Journal of Engineering, Technology and Natural Sciences</i>, vol. 2, no. 2, hlm. 51-55, 2020. DOI: 10.46923/ijets.v2i2.71.',
    'Susilawati, A. Nugraha, A. S. Buchori, S. Rahayu, F. Fathurohman, dan O. Yudiyanto, "Design and Implementation of Automatic Fish Feeder (AFF) Using Microcontroller Powered by Solar Cell," <i>Mechanical Engineering for Society and Industry</i>, vol. 3, no. 1, hlm. 47-53, 2023. DOI: 10.31603/mesi.8276.',
    'Haryansyah, Hadriansa, dan R. Andriansyah P., "Scheduling Uses the Blynk 2.0 Automations Feature for Effective Ornamental Fish Feeding," <i>APTISI Transactions on Management (ATM)</i>, vol. 7, no. 2, hlm. 163-171, 2023. DOI: 10.33050/atm.v7i2.2022.',
    'I. Gunawan, T. Akbar, dan M. G. Ilham, "Prototipe Penerapan Internet of Things (IoT) pada Monitoring Level Air Tandon Menggunakan NodeMCU ESP8266 dan Blynk," <i>Infotek: Jurnal Informatika dan Teknologi</i>, vol. 3, no. 1, hlm. 1-7, 2020. DOI: 10.29408/jit.v3i1.1789.',
    'F. Jan, N. Min-Allah, S. Saeed, S. Z. Iqbal, dan R. Ahmed, "IoT-Based Solutions to Monitor Water Level, Leakage, and Motor Control for Smart Water Tanks," <i>Water</i>, vol. 14, no. 3, art. 309, 2022. DOI: 10.3390/w14030309.',
    'E. Sze, D. Hindarto, I K. A. Wirayasa, dan Haryono, "Performance Comparison of Ultrasonic Sensor Accuracy in Measuring Distance," <i>SinkrOn: Jurnal dan Penelitian Teknik Informatika</i>, vol. 7, no. 4, hlm. 2556-2562, 2022. DOI: 10.33395/sinkron.v7i4.11883.',
  ];
  push(`<div class="pustaka">${pustaka.map((t, i) => `<p><span class="no">[${i + 1}]</span><span>${t}</span></p>`).join("")}</div>`);

  /* ========================================================= LAMPIRAN */
  H1Polos("LAMPIRAN", "lampiran");
  H2("Lampiran 1: Kode Program Utama (Source Code)");
  P(
    `Kode lengkap ada di repositori proyek: <b>https://github.com/dachill19/aquasmart</b>. Program perangkat ada di firmware/AQUASMART/AQUASMART.ino (781 baris), logika server di src/worker/index.ts dan src/worker/telegram.ts, skema basis data di schema.sql, dan antarmuka web di src/react-app. SSID, kata sandi WiFi, kunci perangkat, dan token bot tidak disertakan karena merupakan kunci akses.`
  );
  KODE("AQUASMART.ino, pemetaan pin dan kalibrasi awal", sumber("firmware/AQUASMART/AQUASMART.ino", [29, 41], [53, 71]), "panjang");
  KODE("AQUASMART.ino, pemrosesan perintah dari server", sumber("firmware/AQUASMART/AQUASMART.ino", [519, 551]), "panjang");
  KODE("AQUASMART.ino, pengiriman telemetri", sumber("firmware/AQUASMART/AQUASMART.ino", [613, 659]), "panjang");
  KODE("index.ts, penyerahan perintah tertunda ke perangkat", sumber("src/worker/index.ts", [214, 245]), "panjang");

  H2("Lampiran 2: Foto Dokumentasi Pembuatan dan Pengujian Prototipe");
  push(
    `<figure id="g-lamp2"><div class="dua"><img src="${dataUri(path.join(FOTO, "proses-pembuatan.jpeg"))}" style="width:6.8cm"><img src="${dataUri(path.join(FOTO, "proses-pembuatan-2.jpeg"))}" style="width:6.8cm"></div><figcaption><b>Gambar L2.1.</b> Dokumentasi proses pembuatan dan pengujian prototipe oleh kelompok</figcaption></figure>`
  );
  daftarGambar.push({ id: "g-lamp2", no: "L2.1", teks: "Dokumentasi proses pembuatan dan pengujian prototipe oleh kelompok" });
  H2("Lampiran 3: Tautan Video Demonstrasi Sistem");
  P(`Tautan video demonstrasi (YouTube atau Google Drive): ${ISI("tautan video demonstrasi")}`);

  /* ============================================ DAFTAR ISI DLL (sisip) */
  const hal = (id) => (peta.halaman[id] !== undefined ? peta.halaman[id] : "00");
  const baris = (cls, label, id) =>
    `<div class="baris ${cls}"><a href="#${id}"><span class="teks">${label}</span><span class="titik"></span><span class="hal">${hal(id)}</span></a></div>`;
  const daftar = opsi.docs ? daftarDocs() : daftarCetak();
  function daftarDocs() {
    const plain = (cls, label) => `<p class="dk ${cls}">${label}</p>`;
    return (
      `<h1 class="polos">DAFTAR ISI</h1><p>&nbsp;</p>` +
      `<h1 class="polos">DAFTAR GAMBAR</h1>${daftarGambar.map((g) => plain("lv2", `Gambar ${g.no}. ${g.teks}`)).join("")}` +
      `<h1 class="polos">DAFTAR TABEL</h1>${daftarTabel.map((g) => plain("lv2", `Tabel ${g.no}. ${g.teks}`)).join("")}`
    );
  }
  function daftarCetak() {
    return (
    `<section class="front"><h1 class="polos">DAFTAR ISI</h1>${toc.map((e) => baris("lv" + e.lv, e.teks, e.id)).join("")}</section>` +
    `<section class="front"><h1 class="polos">DAFTAR GAMBAR</h1>${daftarGambar
      .map((g) => baris("lv2", `Gambar ${g.no}. ${g.teks}`, g.id))
      .join("")}</section>` +
    `<section class="front"><h1 class="polos">DAFTAR TABEL</h1>${daftarTabel
      .map((g) => baris("lv2", `Tabel ${g.no}. ${g.teks}`, g.id))
      .join("")}</section>`
    );
  }

  const css =
    fs.readFileSync(path.join(DIR, "laporan.css"), "utf8") +
    (opsi.docs ? "\n.sampul{height:auto;display:block}.sampul .logo-uns{width:174px;height:174px;object-fit:fill;margin:10px auto 14px}.sampul>div,.sampul>table{margin-bottom:22pt}h1{break-before:auto}.dk{margin:0 0 3pt;text-align:left}" : "");
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Tugas Besar IoT - AQUASMART</title><style>${css}</style></head><body>${out
    .join("\n")
    .replace("@@DAFTAR@@", daftar)}</body></html>`;
  return { html, toc, daftarGambar, daftarTabel };
}

/** Dua lintasan: lintasan pertama mengisi nomor gambar dan tabel untuk rujukan silang. */
function bangun(halaman = {}, opsi = {}) {
  const peta = { nomor: {}, halaman };
  // Rujukan subbab diberi nomor tetap.
  peta.nomor.s64 = "6.4";
  peta.nomor.s72 = "7.2";
  susun(peta, opsi);
  return { ...susun(peta, opsi), peta };
}

module.exports = { bangun };
