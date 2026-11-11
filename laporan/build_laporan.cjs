/**
 * Builds the AQUASMART final report (.docx) from the lecturer's template.
 *
 * The docx library is not a dependency of the app, so it is resolved from
 * wherever it already exists. Run `npm i -D docx` in this folder if none of
 * the candidates are present.
 */
const fs = require("fs");
const path = require("path");

function muatDocx() {
  const kandidat = [
    "docx",
    "C:/Users/ACER/.claude/skills/laporan-praktikum-iot/node_modules/docx",
    path.join(__dirname, "node_modules/docx"),
  ];
  for (const c of kandidat) {
    try {
      return require(c);
    } catch {
      /* coba kandidat berikutnya */
    }
  }
  throw new Error("Pustaka docx tidak ditemukan. Jalankan: npm i -D docx");
}

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, PageBreak,
  LevelFormat, ImageRun, Footer, PageNumber, TableOfContents, SequentialIdentifier,
} = muatDocx();

const DIR = __dirname;
const IMG = path.join(DIR, "gambar");
const OUT = process.env.OUT || path.join(DIR, "Laporan_Tubes_IoT_AQUASMART_DRAFT.docx");

// Template dosen: A4, margin 2,5 cm, Times New Roman 12pt, spasi 1,15.
const CM = 567;                 // twip per sentimeter
const MARGIN = Math.round(2.5 * CM);
const SPASI = Math.round(240 * 1.15);
const TW = 9026;                // lebar isi A4 dikurangi margin kiri-kanan

let instansiNomor = 0;
let nomorGambar = 0;
let nomorTabel = 0;

const img = (file, w, h) =>
  new ImageRun({
    type: file.endsWith(".png") ? "png" : "jpg",
    data: fs.readFileSync(path.join(IMG, file)),
    transformation: { width: w, height: h },
  });

const P = (text, o = {}) =>
  new Paragraph({
    alignment: o.align || AlignmentType.JUSTIFIED,
    spacing: { after: o.after === undefined ? 120 : o.after, line: SPASI },
    indent: o.indent,
    children: [new TextRun({ text, bold: !!o.bold, italics: !!o.italics, size: o.size || 24 })],
  });

const Center = (t, o = {}) => P(t, Object.assign({ align: AlignmentType.CENTER }, o));

// keepNext menahan judul agar tidak tertinggal sendirian di dasar halaman.
const H1 = (text) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 300, after: 160 } });
const H2 = (text) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 120 } });
const H3 = (text) =>
  new Paragraph({ text, heading: HeadingLevel.HEADING_3, keepNext: true, spacing: { before: 200, after: 100 } });

/** Judul tanpa nomor yang tetap masuk daftar isi, misalnya DAFTAR PUSTAKA. */
const H1Polos = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 200 },
    children: [new TextRun({ text, bold: true, size: 28 })],
  });

const Gambar = (file, keterangan, w, h) => {
  nomorGambar += 1;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      // Gambar menempel pada keterangannya.
      keepNext: true,
      spacing: { before: 140, after: 60, line: SPASI },
      children: [img(file, w, h)],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200, line: SPASI },
      style: "Caption",
      // Nomor memakai field SEQ, bukan angka yang diketik. Tanpa itu Word
      // tidak dapat menyusun Daftar Gambar dan hasilnya kosong.
      children: [
        new TextRun({ text: "Gambar ", size: 20 }),
        new SequentialIdentifier("Gambar"),
        new TextRun({ text: `. ${keterangan}`, size: 20 }),
      ],
    }),
  ];
};

const JudulTabel = (keterangan) => {
  nomorTabel += 1;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    // Judul tabel harus menempel pada tabelnya.
    keepNext: true,
    spacing: { before: 160, after: 80, line: SPASI },
    style: "Caption",
    children: [
      new TextRun({ text: "Tabel ", size: 20 }),
      new SequentialIdentifier("Tabel"),
      new TextRun({ text: `. ${keterangan}`, size: 20 }),
    ],
  });
};

const TBL = (rows, widths) =>
  new Table({
    columnWidths: widths,
    width: { size: TW, type: WidthType.DXA },
    rows: rows.map((row, r) =>
      new TableRow({
        tableHeader: r === 0,
        cantSplit: true,
        children: row.map((cell, c) =>
          new TableCell({
            width: { size: widths[c], type: WidthType.DXA },
            shading: r === 0 ? { type: ShadingType.CLEAR, fill: "EDEDED" } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                spacing: { after: 0, line: 240 },
                children: [new TextRun({ text: String(cell), bold: r === 0, size: 20 })],
              }),
            ],
          })
        ),
      })
    ),
  });

const NUM = (items) => {
  instansiNomor += 1;
  const inst = instansiNomor;
  return items.map(
    (t) =>
      new Paragraph({
        numbering: { reference: "angka", level: 0, instance: inst },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80, line: SPASI },
        children: [new TextRun({ text: t, size: 24 })],
      })
  );
};

const BULLET = (items) => {
  instansiNomor += 1;
  const inst = instansiNomor;
  return items.map(
    (t) =>
      new Paragraph({
        numbering: { reference: "bulat", level: 0, instance: inst },
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80, line: SPASI },
        children: [new TextRun({ text: t, size: 24 })],
      })
  );
};

const CODE = (lines) =>
  lines.map(
    (ln, i) =>
      new Paragraph({
        spacing: { after: i === lines.length - 1 ? 160 : 0, line: 240 },
        indent: { left: 300 },
        shading: { type: ShadingType.CLEAR, fill: "F4F4F4" },
        children: [new TextRun({ text: ln || " ", font: "Consolas", size: 17 })],
      })
  );

const Kosong = () => new Paragraph({ text: "", spacing: { after: 100 } });

// Penanda yang harus diisi sebelum dikumpulkan.
const ISI = (t) => `[ISI: ${t}]`;

const body = [];

/* ============================================================ SAMPUL */
body.push(Kosong(), Kosong());
body.push(Center("LAPORAN TUGAS BESAR", { bold: true, size: 32 }));
body.push(Center("TEKNOLOGI INTERNET OF THINGS", { bold: true, size: 32, after: 300 }));
body.push(
  Center("AQUASMART: Akuarium Pintar dengan Pemberi Pakan Otomatis dan Pemantauan Kondisi Air Jarak Jauh", {
    bold: true,
    after: 360,
  })
);
body.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 },
    children: [img("logo_uns.png", 210, 210)],
  })
);

body.push(
  TBL(
    [
      ["Judul Proyek", "AQUASMART: Akuarium Pintar dengan Pemberi Pakan Otomatis dan Pemantauan Kondisi Air Jarak Jauh"],
      ["Tema Solusi", "Smart Home dan Akuakultur Skala Rumah Tangga"],
      ["Mata Kuliah", "Teknologi Internet of Things"],
      ["Dosen Pengampu", ISI("nama dosen pengampu")],
    ],
    [2300, 6726]
  )
);
body.push(Kosong());
body.push(Center(`Disusun oleh Kelompok ${ISI("nomor")}:`, { bold: true, after: 100 }));
body.push(Center("1. Daffa Hasanal Arkaan - L0123043"));
body.push(Center(`2. ${ISI("nama anggota 2")} - ${ISI("NIM")}`));
body.push(Center(`3. ${ISI("nama anggota 3")} - ${ISI("NIM")}`));
body.push(Center(`4. ${ISI("nama anggota 4")} - ${ISI("NIM")}`));
// Jarak ini menentukan blok prodi duduk di dasar sampul. Terlalu besar dan
// spasi ekornya meluber sehingga PageBreak menyisakan satu halaman kosong.
body.push(Center(`5. ${ISI("nama anggota 5")} - ${ISI("NIM")}`, { after: 420 }));
body.push(Center("PROGRAM STUDI INFORMATIKA", { bold: true }));
body.push(Center("FAKULTAS TEKNOLOGI INFORMASI DAN SAINS DATA", { bold: true }));
body.push(Center("UNIVERSITAS SEBELAS MARET", { bold: true }));
body.push(Center("2026", { bold: true }));
body.push(new Paragraph({ children: [new PageBreak()] }));

/* ====================================================== DAFTAR-DAFTAR */
body.push(H1Polos("DAFTAR ISI"));
body.push(new TableOfContents("Daftar Isi", { hyperlink: true, headingStyleRange: "1-3" }));
body.push(new Paragraph({ children: [new PageBreak()] }));

body.push(H1Polos("DAFTAR GAMBAR"));
body.push(new TableOfContents("Daftar Gambar", { hyperlink: true, captionLabel: "Gambar" }));
body.push(Kosong());
body.push(H1Polos("DAFTAR TABEL"));
body.push(new TableOfContents("Daftar Tabel", { hyperlink: true, captionLabel: "Tabel" }));
body.push(
  P(
    "Catatan: daftar isi, daftar gambar, dan daftar tabel di atas dibangkitkan otomatis oleh Microsoft Word. Tekan Ctrl+A lalu F9, pilih Update entire table, untuk mengisinya.",
    { italics: true, size: 20 }
  )
);
body.push(new Paragraph({ children: [new PageBreak()] }));

/* ============================================================== BAB 1 */
body.push(H1("BAB 1: IDENTIFIKASI MASALAH DAN LATAR BELAKANG"));

body.push(H2("1.1 Latar Belakang Permasalahan"));
body.push(
  P(
    "Memelihara ikan hias terlihat sederhana, tetapi penyebab kematian ikan pada pemelihara pemula justru berasal dari pekerjaan yang berulang setiap hari dan mudah terlewat. Masalahnya bukan terletak pada pengetahuan yang rumit, melainkan pada kehadiran: seseorang harus ada di tempat pada waktu tertentu untuk memberi pakan dan memeriksa kondisi air."
  )
);
body.push(
  P(
    "Pada mahasiswa yang menjadi target awal sistem ini, ketidakhadiran itu bukan pengecualian melainkan kebiasaan. Pulang kampung beberapa hari, menginap di luar kota, atau sekadar pulang larut membuat jadwal pemberian pakan terputus. Akibatnya terbagi menjadi empat pola yang berulang."
  )
);
body.push(
  ...BULLET([
    "Ikan tidak diberi pakan sama sekali ketika pemiliknya bepergian beberapa hari.",
    "Pakan diberikan berlebihan, baik karena lupa sudah memberi maupun karena dititipkan kepada orang lain tanpa takaran. Sisa pakan membusuk, kadar amonia naik, dan air berubah menjadi racun bagi ikan yang seharusnya dilindungi.",
    "Ketinggian air menyusut oleh penguapan tanpa disadari, sehingga pompa berisiko menyedot udara dan cepat rusak.",
    "Pemilik tidak memiliki catatan apa pun tentang kapan terakhir ikan diberi pakan, sehingga tidak dapat membedakan antara belum diberi dan sudah diberi dua kali.",
  ])
);
body.push(
  P(
    "Keempat persoalan ini nyata, terukur, dan tidak menuntut peralatan mahal untuk diselesaikan. Kondisi air dapat dibaca oleh sensor sederhana, dan dua tindakan yang paling dibutuhkan, yaitu memberi pakan serta mengisi ulang air, dapat dilakukan oleh dua aktuator kecil. Karena itu masalah ini cocok dijadikan studi kasus prototipe Internet of Things dalam rentang waktu satu semester."
  )
);

body.push(H2("1.2 Rumusan Masalah"));
body.push(
  ...NUM([
    "Bagaimana merancang sistem yang memberi pakan ikan secara terjadwal sehingga pemberian tetap berjalan ketika pemilik tidak berada di tempat?",
    "Bagaimana memantau ketinggian air akuarium dari jarak jauh dan mengisinya kembali secara otomatis ketika air menyusut di bawah batas aman?",
    "Bagaimana memantau sisa stok pakan pada wadah penampung agar pemberian terjadwal tidak gagal diam-diam karena wadahnya kosong?",
    "Bagaimana menyampaikan peringatan kepada pemilik ketika kondisi akuarium keluar dari batas aman, tanpa menuntut pemilik membuka aplikasi lebih dahulu?",
    "Bagaimana menyimpan riwayat pembacaan sensor dan riwayat tindakan sehingga pemilik dapat menelusuri apa yang terjadi selama ia tidak mengawasi?",
  ])
);
body.push(
  P(
    "Rumusan masalah ini sudah disesuaikan dengan sistem yang benar-benar terbangun. Dokumen ide awal kelompok mencantumkan pemantauan suhu air sebagai salah satu rumusan masalah, namun sensor suhu tidak jadi dipasang pada prototipe akhir. Alasan dan konsekuensinya dibahas terbuka pada Subbab 6.4 dan Subbab 7.2, dan tidak disembunyikan dengan cara membiarkan rumusan masalah menjanjikan sesuatu yang tidak dikerjakan."
  )
);

body.push(H2("1.3 Potensi Solusi IoT"));
body.push(
  P(
    "Pendekatan Internet of Things tepat untuk persoalan ini karena inti masalahnya adalah jarak, bukan kerumitan pengukuran. Besaran yang perlu dibaca sederhana dan tindakan yang perlu diambil hanya dua, tetapi keduanya harus terjadi di tempat yang sedang tidak ditunggui. Menghubungkan perangkat ke internet memindahkan kehadiran yang hilang itu ke jaringan."
  )
);
body.push(
  P(
    "Ada tiga hal yang hanya dapat diperoleh melalui pendekatan terhubung, dan bukan melalui rangkaian otomatis yang berdiri sendiri. Pertama, jadwal dan ambang batas dapat diubah tanpa menyentuh perangkat maupun mengunggah ulang programnya, karena nilainya disimpan di layanan awan. Kedua, riwayat pembacaan dan tindakan tersimpan sehingga dapat ditelusuri kembali, sesuatu yang tidak dapat dilakukan rangkaian tanpa penyimpanan. Ketiga, peringatan dapat dikirim aktif kepada pemilik, bukan menunggu pemilik datang memeriksa."
  )
);
body.push(
  P(
    "Yang ketiga ini menjadi pembeda yang paling menentukan. Sebuah alat yang hanya menyalakan lampu merah di sisi akuarium tetap tidak berguna bagi pemilik yang sedang berada di kota lain, dan justru keadaan itulah yang melatarbelakangi seluruh sistem ini."
  )
);

/* ============================================================== BAB 2 */
body.push(H1("BAB 2: RUMUSAN KONSEP SOLUSI IOT"));

body.push(H2("2.1 Deskripsi Konsep Solusi"));
body.push(
  P(
    "AQUASMART adalah sistem akuarium pintar yang menjaga dua hal paling sering menyebabkan kematian ikan hias ketika pemiliknya tidak di tempat, yaitu keteraturan pemberian pakan dan kondisi air. Sistem dibagi menjadi tiga lapis yang masing-masing memiliki tanggung jawab yang jelas."
  )
);
body.push(
  ...BULLET([
    "Lapis perangkat. NodeMCU ESP8266 di akuarium membaca ketinggian air dan sisa stok pakan, menggerakkan servo penuang pakan serta pompa pengisi air, dan menjalankan jadwal pakan dari jam internalnya sendiri.",
    "Lapis awan. Sebuah Cloudflare Worker menerima telemetri, menyimpannya di basis data D1, menampung perintah yang menunggu, dan meneruskan peringatan ke Telegram.",
    "Lapis antarmuka. Dashboard web responsif dan bot Telegram, keduanya memakai antrean perintah yang sama sehingga tidak ada jalur kendali yang berperilaku berbeda.",
  ])
);
body.push(
  P(
    "Manfaat utama sistem ini bukan sekadar otomatisasi, melainkan letak keputusannya. Jadwal pakan, ambang pompa, dan seluruh kalibrasi sensor disimpan di awan, bukan ditanam di dalam program perangkat. Menyetel ulang sistem karena wadah pakan diganti atau sensor bergeser cukup dilakukan dengan mengetik angka baru di dashboard, tanpa menyentuh perangkat dan tanpa mengunggah ulang kode."
  )
);
body.push(
  P(
    "Pilihan ini terbukti berharga selama pengembangan. Seluruh kalibrasi sensor air dan sensor pakan pada prototipe ini diukur ulang beberapa kali pada malam pengujian, dan tidak satu pun menuntut perangkat diprogram ulang."
  )
);

body.push(H2("2.2 Batasan Sistem dan Target Pengguna"));
body.push(
  P(
    "Target pengguna sistem ini adalah pemelihara ikan hias skala rumah tangga, khususnya mahasiswa atau pekerja yang memelihara satu akuarium kecil dan kerap meninggalkannya selama beberapa hari. Pengguna diasumsikan memiliki ponsel dengan koneksi internet dan jaringan WiFi 2,4 GHz di lokasi akuarium, tetapi tidak diasumsikan memahami elektronika maupun pemrograman."
  )
);
body.push(P("Ruang lingkup kerja sistem dibatasi sebagai berikut:", { after: 80 }));
body.push(
  ...BULLET([
    "Sistem memantau ketinggian air dan sisa stok pakan. Suhu air, pH, dan kekeruhan berada di luar lingkup prototipe ini.",
    "Sistem bekerja pada satu akuarium dengan satu perangkat. Dukungan banyak perangkat tidak dirancang.",
    "Pengisian air mengambil dari penampung terpisah yang pengisiannya masih manual. Sistem tidak tersambung ke saluran air bertekanan.",
    "Jaringan yang didukung hanya WiFi 2,4 GHz, mengikuti kemampuan ESP8266.",
    "Pemberian pakan terjadwal tetap berjalan tanpa internet karena jadwal disalin ke jam internal perangkat, tetapi pemantauan, kendali jarak jauh, dan peringatan memerlukan koneksi.",
  ])
);

body.push(H2("2.3 Spesifikasi Fitur Utama"));
body.push(H3("2.3.1 Fitur Monitoring"));
body.push(JudulTabel("Parameter yang dipantau beserta sumber datanya"));
body.push(
  TBL(
    [
      ["Parameter", "Sensor", "Satuan tampilan", "Penyajian"],
      ["Ketinggian air", "Sensor level air resistif", "persen dan nilai ADC mentah", "Angka besar, gauge bersegmen, dan grafik riwayat"],
      ["Sisa stok pakan", "Ultrasonik HC-SR04", "persen dan milimeter", "Angka besar, gauge bersegmen, dan grafik riwayat"],
      ["Status pompa", "Keadaan relay di perangkat", "menyala, mati, terkunci", "Teks status dan pita penanda pada grafik"],
      ["Keterhubungan alat", "Selisih waktu laporan terakhir", "detik, menit, jam", "Spanduk peringatan bila lebih dari 60 detik"],
      ["Kekuatan sinyal WiFi", "RSSI dari ESP8266", "dBm", "Angka"],
      ["Lama alat menyala", "Uptime perangkat", "jam dan menit", "Angka"],
      ["Riwayat kejadian", "Event dari perangkat", "waktu dan keterangan", "Tabel catatan beserta pengesahan perintah"],
    ],
    [1900, 2000, 2126, 3000]
  )
);
body.push(Kosong());

body.push(H3("2.3.2 Fitur Kontrol"));
body.push(JudulTabel("Aktuator beserta aksi otomatis dan manualnya"));
body.push(
  TBL(
    [
      ["Fitur", "Aktuator", "Aksi otomatis", "Aksi manual"],
      ["Pemberian pakan", "Servo SG90", "Dua jadwal harian dari jam internal perangkat", "Tombol dashboard dan perintah /pakan di Telegram"],
      ["Pengisian air", "Pompa celup melalui relay", "Menyala di bawah ambang, berhenti di target isi", "Tombol dashboard dan perintah /pompa di Telegram"],
      ["Buka kunci pompa", "Relay", "Terbuka sendiri saat air kembali di atas ambang", "Tombol dashboard dan perintah /buka di Telegram"],
      ["Pengaturan jadwal", "Servo", "—", "Dua jam pakan disetel dari dashboard"],
      ["Pengaturan ambang", "Relay dan servo", "—", "Ambang pompa, target isi, ambang pakan, dan durasi"],
      ["Kalibrasi sensor", "—", "—", "Dua titik per sensor, disetel dari dashboard"],
    ],
    [1900, 1800, 2626, 2700]
  )
);
body.push(Kosong());

body.push(H3("2.3.3 Fitur Pengaman dan Notifikasi"));
body.push(
  ...BULLET([
    "Pengaman luapan. Pompa dihentikan dan permintaan manual ditolak ketika ketinggian air mencapai 95 persen, agar air tidak melewati bagian sensor yang kabelnya tidak terlindungi.",
    "Konfirmasi berulang. Pompa baru menyala setelah tiga pembacaan rendah berturut-turut, sehingga satu pembacaan meleset tidak langsung menjalankan pompa.",
    "Jeda antar penyalaan. Pompa tidak boleh menyala lagi dalam 30 detik setelah mati, agar relay tidak berkedip di sekitar nilai ambang.",
    "Kunci pompa. Apabila air tidak kunjung naik setelah pompa menyala selama durasi maksimum, pompa dikunci agar tidak berputar kering terus-menerus.",
    "Peringatan Telegram. Air kritis, stok pakan kritis, dan pemberian pakan yang selesai dikirim sebagai pesan ke pemilik tanpa pemilik perlu membuka dashboard.",
  ])
);

/* ============================================================== BAB 3 */
body.push(H1("BAB 3: STUDI LITERATUR DAN REFERENSI"));

body.push(H2("3.1 Tinjauan Pustaka"));
body.push(
  P(
    "Sepuluh pustaka berikut dipakai sebagai landasan dan pembanding. Seluruhnya merupakan terbitan akses terbuka, dan berkas aslinya disertakan dalam repositori proyek sehingga setiap pernyataan pada subbab ini dapat diperiksa langsung terhadap sumbernya."
  )
);
body.push(H3("3.1.1 Sistem Akuarium Berbasis IoT"));
body.push(
  P(
    "Lin dan Tseng [1] membangun FishTalk, sistem akuarium mini berbasis IoT yang memantau suhu, kekeruhan, dan ketinggian air sekaligus mengendalikan pemberian pakan. Penelitian ini menunjukkan bahwa satu perangkat berdaya rendah mampu menangani pemantauan dan kendali sekaligus, pola yang juga dipakai pada AQUASMART."
  )
);
body.push(
  P(
    "Abdurohman, Putrada, dan Deris [2] mengembangkan sistem kendali akuarium yang menambahkan algoritme Decision Tree Regression untuk menduga kondisi air. Penelitian tersebut menegaskan bahwa keandalan sistem akuarium bergantung pada kualitas pembacaan sensornya, bukan pada kecanggihan kendalinya. Temuan ini sejalan dengan pengalaman pada prototipe AQUASMART, di mana sebagian besar kendala justru berasal dari pembacaan sensor dan bukan dari logika kendali."
  )
);
body.push(
  P(
    "Rachman dan Santoso [3] merancang sistem kontrol suhu dan pakan otomatis pada akuarium aquascape menggunakan NodeMCU ESP8266, dengan susunan perangkat keras yang sangat mirip dengan proyek ini. Wijaya dan Wellem [4] memantau suhu dan ketinggian air akuarium ikan hias berbasis IoT, dan menjadi pembanding terdekat untuk fitur pemantauan ketinggian air pada AQUASMART."
  )
);

body.push(H3("3.1.2 Pemberi Pakan Otomatis"));
body.push(
  P(
    "Ratnasari, Mardhiyyah, dan Pramudwiatmoko [5] membuat prototipe pemberi pakan otomatis sekaligus penggantian air, yaitu kombinasi dua aktuator yang sama dengan AQUASMART. Susilawati dan rekan [6] merancang automatic fish feeder bertenaga sel surya untuk pembudidaya ikan, dan melaporkan peningkatan efisiensi pakan dari 69,4 persen menjadi 86,8 persen. Angka tersebut memperkuat alasan mengapa takaran pakan yang teratur layak diotomatiskan."
  )
);
body.push(
  P(
    "Haryansyah, Hadriansa, dan Ardiansyah [7] memanfaatkan fitur Automations pada Blynk 2.0 untuk penjadwalan pemberian pakan ikan hias. Penelitian ini relevan sebagai pembanding arsitektur: penjadwalan diletakkan pada platform pihak ketiga, sedangkan AQUASMART menyalin jadwal ke jam internal perangkat agar pemberian pakan tetap berjalan ketika koneksi terputus."
  )
);

body.push(H3("3.1.3 Pemantauan Ketinggian Air dan Ketelitian Sensor"));
body.push(
  P(
    "Gunawan, Akbar, dan Ilham [8] menerapkan IoT untuk memantau level air tandon menggunakan NodeMCU ESP8266 dan Blynk, sedangkan Jan dan rekan [9] menyusun tinjauan menyeluruh atas solusi IoT untuk pemantauan ketinggian air, kebocoran, dan kendali motor pada tangki air pintar. Tinjauan tersebut memetakan pilihan sensor beserta keterbatasannya masing-masing, dan menjadi dasar pertimbangan dalam memilih sensor pada proyek ini."
  )
);
body.push(
  P(
    "Sze, Hindarto, Wirayasa, dan Haryono [10] membandingkan ketelitian beberapa sensor ultrasonik dalam mengukur jarak. Pustaka ini menjadi rujukan penting pada Bab 6, karena keterbatasan ketelitian HC-SR04 yang dilaporkan di sana muncul kembali sebagai kendala nyata pada pengukuran stok pakan AQUASMART."
  )
);

body.push(H2("3.2 Spesifikasi Komponen Perangkat Keras dan Perangkat Lunak"));
body.push(H3("3.2.1 Mikrokontroler"));
body.push(
  P(
    "NodeMCU ESP8266 versi Amica dipakai sebagai unit pemroses. Board ini berbasis chip ESP8266 tipe ESP-12E dengan WiFi 2,4 GHz yang sudah menyatu, memiliki 13 pin GPIO dan satu pin ADC 10 bit, serta bekerja pada logika 3,3 volt dengan catu daya 5 volt melalui port USB. Chip USB-to-serial yang dipakai adalah Silicon Labs CP2102 dan terbaca sebagai COM4 pada komputer pengembang."
  )
);
body.push(
  P(
    "Pemilihan board ini bukan tanpa konsekuensi. Sembilan pin GPIO terpakai habis oleh empat komponen, dan batas memori ESP8266 menjadi penentu beberapa keputusan rancangan yang dibahas pada Bab 4 dan Bab 6."
  )
);

body.push(H3("3.2.2 Sensor"));
body.push(JudulTabel("Spesifikasi sensor yang digunakan"));
body.push(
  TBL(
    [
      ["Sensor", "Besaran", "Prinsip kerja", "Keterbatasan"],
      [
        "Sensor level air resistif",
        "Ketinggian air",
        "Deretan jalur tembaga membentuk pembagi tegangan. Makin banyak bagian strip yang tercelup, makin kecil hambatannya, dan makin besar tegangan yang terbaca ADC.",
        "Mengukur bagian dirinya yang tercelup, bukan kedalaman tangki. Pembacaan ikut berubah mengikuti konduktivitas air.",
      ],
      [
        "Ultrasonik HC-SR04",
        "Jarak ke permukaan pakan",
        "Memancarkan pulsa 40 kHz lalu mengukur waktu pantulnya. Jarak dihitung dari waktu tempuh dan kecepatan suara.",
        "Berkas pancarnya melebar sekitar 15 derajat, jarak minimum sekitar 2 cm, dan permukaan tidak rata memantulkan gema ke arah yang tidak kembali.",
      ],
    ],
    [1900, 1600, 3026, 2500]
  )
);
body.push(Kosong());
body.push(
  P(
    "Perlu dicatat bahwa dokumen ide awal kelompok merencanakan sensor suhu DS18B20 sebagai sensor kedua. Pada prototipe akhir, sensor kedua yang terpasang adalah ultrasonik HC-SR04 untuk memantau stok pakan. Ketentuan minimal dua jenis sensor tetap terpenuhi, dan alasan pergantian ini dijelaskan pada Subbab 6.4."
  )
);

body.push(H3("3.2.3 Aktuator"));
body.push(JudulTabel("Spesifikasi aktuator yang digunakan"));
body.push(
  TBL(
    [
      ["Aktuator", "Fungsi", "Mekanisme penggerak", "Kebutuhan daya"],
      [
        "Servo SG90",
        "Membuka dan menutup gerbang wadah pakan",
        "Motor DC kecil dengan roda gigi dan potensiometer umpan balik, diposisikan oleh lebar pulsa pada pin sinyal.",
        "4,8 sampai 6 volt. Menarik 100 sampai 250 mA saat bergerak dan jauh lebih besar saat tertahan.",
      ],
      [
        "Pompa celup DC melalui modul relay",
        "Mengisi ulang air dari penampung",
        "Relay Songle SRD-05VDC-SL-C memisahkan sisi kendali dari sisi daya secara mekanis, sehingga pompa dapat memakai catu daya sendiri.",
        "Coil relay 5 volt sekitar 70 mA. Pompa memakai baterai terpisah 9 volt.",
      ],
    ],
    [2000, 1900, 2826, 2300]
  )
);
body.push(Kosong());

body.push(H3("3.2.4 Protokol dan Platform Awan"));
body.push(
  P(
    "Komunikasi perangkat ke awan memakai HTTPS, bukan MQTT. Pilihan ini diambil karena seluruh pertukaran data dapat diselesaikan dalam satu permintaan per siklus: perangkat mengirim telemetri pada badan permintaan, dan menerima perintah yang menunggu beserta seluruh setelan pada badan balasannya. Pada ESP8266, pembentukan sambungan TLS adalah operasi termahal yang dilakukan perangkat, sehingga menukar dua perjalanan menjadi satu memberi penghematan yang nyata."
  )
);
body.push(
  P(
    "Konsekuensi dari pilihan ini adalah waktu tanggap kendali menjadi sama dengan selang pengiriman telemetri. Perintah yang ditekan di dashboard baru dijalankan pada laporan berikutnya. Dashboard menyatakan hal ini secara terbuka kepada pengguna melalui label menunggu alat, alih-alih menyembunyikannya."
  )
);
body.push(JudulTabel("Komponen perangkat lunak dan layanan awan"));
body.push(
  TBL(
    [
      ["Komponen", "Teknologi", "Peran"],
      ["Program perangkat", "Arduino C++ untuk ESP8266", "Membaca sensor, menjalankan kendali, dan berbicara ke awan"],
      ["Komputasi awan", "Cloudflare Workers dengan kerangka Hono", "Menerima telemetri, menampung perintah, dan meneruskan peringatan"],
      ["Basis data", "Cloudflare D1 (SQLite)", "Menyimpan pembacaan, kejadian, perintah, dan setelan"],
      ["Antarmuka web", "React 19, Vite, Tailwind CSS, Recharts", "Dashboard pemantauan dan kendali"],
      ["Antarmuka pesan", "Telegram Bot API", "Peringatan keluar dan perintah masuk"],
      ["Jam perangkat", "RTC DS1302 diselaraskan dari server", "Menjalankan jadwal pakan tanpa internet"],
    ],
    [2200, 3000, 3826]
  )
);

/* ============================================================== BAB 4 */
body.push(H1("BAB 4: PERANCANGAN DETAIL SISTEM"));

body.push(H2("4.1 Diagram Alur Kerja Sistem"));
body.push(
  P(
    "Perangkat menjalankan satu putaran tetap. Pada setiap putaran, perangkat membaca kedua sensor, memeriksa jadwal pakan terhadap jam internalnya, menjalankan logika kendali pompa, lalu mengirim telemetri dan menerima perintah yang menunggu dalam satu perjalanan ke server."
  )
);
body.push(...Gambar("ph_flowchart.png", "Diagram alur kerja sistem AQUASMART", 420, 289));
body.push(
  P(
    "Logika kendali pompa sengaja tidak dibuat sesederhana membandingkan satu angka terhadap satu ambang. Pompa baru menyala setelah tiga pembacaan rendah berturut-turut, berhenti ketika mencapai target isi yang berbeda dari ambang penyalaan, dan menolak menyala lagi sebelum jeda 30 detik terlewati. Ketiga aturan ini ada karena alasan yang dibahas pada Bab 6."
  )
);

body.push(H2("4.2 Arsitektur Sistem IoT"));
body.push(...Gambar("ph_arsitektur.png", "Pemetaan arsitektur IoT pada sistem AQUASMART", 430, 248));
body.push(JudulTabel("Pemetaan lapisan arsitektur IoT"));
body.push(
  TBL(
    [
      ["Lapisan", "Perwujudan pada AQUASMART"],
      ["IoT Device", "NodeMCU ESP8266 dengan dua sensor, dua aktuator, dan RTC DS1302"],
      ["Local Network", "Jaringan WiFi 2,4 GHz di lokasi akuarium"],
      ["Gateway", "Router WiFi rumah. Tidak ada gateway khusus karena perangkat berbicara HTTPS langsung"],
      ["Global Network", "Internet, dengan HTTPS pada port 443 menuju jaringan tepi Cloudflare"],
      ["Cloud Services", "Cloudflare Worker sebagai logika server dan Cloudflare D1 sebagai basis data"],
      ["User Interface", "Dashboard web React dan bot Telegram"],
    ],
    [2200, 6826]
  )
);
body.push(Kosong());
body.push(
  P(
    "Satu keputusan arsitektur layak disorot. Peringatan ke Telegram dikirim oleh Worker, bukan oleh perangkat. Alasannya teknis dan terukur: sambungan TLS pada ESP8266 membutuhkan sekitar 16 sampai 22 kilobyte heap, sedangkan pada pengujian perangkat sudah gagal mengirim telemetri ketika sisa heap tercatat 16.440 byte. Menambahkan sambungan TLS kedua ke Telegram di dalam perangkat berarti memperebutkan memori yang sudah tidak cukup. Dengan memindahkan jembatan Telegram satu lapis ke atas, beban pada perangkat menjadi nol dan fiturnya tetap diperoleh."
  )
);

body.push(H2("4.3 Topologi Jaringan dan Protokol Komunikasi"));
body.push(...Gambar("ph_topologi.png", "Topologi jaringan dan protokol yang dipakai tiap segmen", 430, 220));
body.push(JudulTabel("Protokol pada tiap segmen komunikasi"));
body.push(
  TBL(
    [
      ["Segmen", "Protokol", "Arah", "Keterangan"],
      ["Perangkat ke router", "WiFi 802.11 b/g/n 2,4 GHz", "dua arah", "Satu-satunya pita yang didukung ESP8266"],
      ["Perangkat ke Worker", "HTTPS, TLS 1.2, port 443", "dua arah dalam satu permintaan", "Telemetri naik pada badan permintaan, perintah turun pada balasan"],
      ["Dashboard ke Worker", "HTTPS, REST JSON", "dua arah", "Penarikan berkala untuk pembacaan terbaru dan riwayat"],
      ["Worker ke Telegram", "HTTPS ke api.telegram.org", "keluar", "Pengiriman peringatan"],
      ["Telegram ke Worker", "HTTPS webhook", "masuk", "Perintah pengguna, dijaga secret token dan daftar chat"],
    ],
    [2000, 2300, 1900, 2826]
  )
);
body.push(Kosong());
body.push(
  P(
    "Perangkat mengautentikasi dirinya ke Worker memakai kunci rahasia pada header permintaan, sehingga alamat yang tidak sengaja tersebar tidak dapat mencemari catatan telemetri. Webhook Telegram dijaga dua lapis sekaligus, yaitu secret token yang dikembalikan Telegram pada setiap permintaan dan daftar chat yang diizinkan, karena alamat webhook bersifat publik."
  )
);

body.push(H2("4.4 Skematik Rangkaian Elektronika"));
body.push(...Gambar("ph_skematik.png", "Skematik rangkaian dan pemetaan pin", 430, 287));
body.push(JudulTabel("Pemetaan pin NodeMCU terhadap sensor dan aktuator"));
body.push(
  TBL(
    [
      ["Komponen", "Pin komponen", "Pin NodeMCU", "GPIO", "Keterangan"],
      ["Modul relay pompa", "IN", "D1", "GPIO 5", "Aktif rendah"],
      ["Sensor level air", "VCC", "D0", "GPIO 16", "Diberi daya hanya saat mengukur, untuk memperlambat korosi"],
      ["Sensor level air", "Sinyal", "A0", "ADC0", "Pembacaan 10 bit"],
      ["HC-SR04", "TRIG", "D5", "GPIO 14", "Pemicu pulsa"],
      ["HC-SR04", "ECHO", "D6", "GPIO 12", "Penerima gema"],
      ["Servo SG90", "Sinyal", "D7", "GPIO 13", "Daya diambil dari Vin, bukan 3V3"],
      ["RTC DS1302", "DAT", "D3", "GPIO 0", "Antarmuka tiga kabel"],
      ["RTC DS1302", "CLK", "D2", "GPIO 4", "Antarmuka tiga kabel"],
      ["RTC DS1302", "RST", "D8", "GPIO 15", "Antarmuka tiga kabel"],
    ],
    [2000, 1600, 1600, 1300, 2526]
  )
);
body.push(Kosong());
body.push(
  P(
    "Sembilan pin GPIO terpakai dan hanya D4 yang tersisa. Keterbatasan ini menjadi salah satu pertimbangan mengapa sensor suhu tidak jadi ditambahkan, sebagaimana dibahas pada Subbab 6.4."
  )
);
body.push(
  P(
    "Rangkaian pompa berdiri sendiri. Kutub positif baterai masuk ke terminal relay, keluarannya menuju pompa, dan kutub negatif pompa kembali ke baterai. Sisi kendali relay tetap memakai ground NodeMCU. Pemisahan ini penting karena arus pompa yang mengalir melalui jalur ground bersama sempat mengacaukan pembacaan sensor air, sebagaimana diuraikan pada Subbab 6.4."
  )
);

body.push(H2("4.5 Desain Antarmuka Aplikasi Web"));
body.push(...Gambar("ph_mockup.png", "Rancangan antarmuka dashboard web", 430, 268));
body.push(
  P(
    "Dashboard dirancang dengan satu aturan utama: angka yang paling menentukan keselamatan ikan harus terbaca dari jarak satu meter tanpa diklik. Karena itu ketinggian air dan stok pakan ditampilkan sebagai angka besar beserta gauge bersegmen yang menandai posisi ambang, sedangkan perincian seperti nilai ADC mentah dan jarak dalam milimeter diletakkan lebih kecil di bawahnya."
  )
);
body.push(
  P(
    "Aturan kedua adalah kejujuran terhadap keadaan data. Ketika perangkat tidak melapor lebih dari 60 detik, dashboard menampilkan spanduk yang menyatakan bahwa angka di layar adalah pembacaan terakhir yang tersimpan dan bukan kondisi saat ini. Pembacaan sensor yang gagal ditampilkan sebagai tidak terbaca, bukan sebagai nol persen, karena keduanya memiliki arti yang sangat berbeda bagi pemilik ikan."
  )
);

/* ============================================================== BAB 5 */
body.push(H1("BAB 5: IMPLEMENTASI PROTOTIPE"));

body.push(H2("5.1 Implementasi Perangkat Keras"));
body.push(...Gambar("ph_prototipe.png", "Prototipe AQUASMART yang telah dirakit", 360, 270));
body.push(...Gambar("ph_wiring.png", "Tata letak pengkabelan pada breadboard", 360, 270));
body.push(
  P(
    "Perangkat dirakit di atas breadboard yang dipasang pada dudukan di atas wadah akuarium. Sensor ultrasonik dipasang menghadap ke bawah pada mulut wadah pakan, servo memegang gerbang penuang di bawahnya, dan sensor level air digantung di dalam akuarium. Pompa diletakkan pada penampung terpisah dengan selang menuju akuarium."
  )
);
body.push(
  P(
    "Dua keputusan perakitan layak dicatat karena keduanya lahir dari kegagalan. Pertama, wadah pakan berbentuk kerucut pada rakitan awal diganti dengan wadah berdinding lurus, karena dinding miring memantulkan gema ultrasonik ke arah yang tidak kembali ke sensor. Kedua, kabel daya servo dipindahkan dari pin 3V3 ke Vin, dan kemudian kabel VCC modul relay juga dipindahkan ke Vin, karena coil relay bertanda 05VDC tidak bekerja andal pada 3,3 volt."
  )
);

body.push(H2("5.2 Implementasi Perangkat Lunak dan Konfigurasi Awan"));
body.push(H3("5.2.1 Struktur Program Perangkat"));
body.push(
  P(
    "Program perangkat berjalan tanpa penundaan yang memblokir. Seluruh pekerjaan berkala dijadwalkan dengan membandingkan selisih millis, sehingga pembacaan sensor, pemeriksaan jadwal, pengendalian aktuator, dan pengiriman telemetri dapat berjalan berdampingan dalam satu putaran."
  )
);
body.push(
  ...CODE([
    "void loop() {",
    "  monitoringAir();        // baca level air, jalankan logika pompa",
    "  monitoringPakan();      // baca stok pakan dengan median dan perataan",
    "  cekJadwalRTC();         // bandingkan jam internal dengan jadwal",
    "  prosesPakan();          // tutup servo setelah durasi terpenuhi",
    "  kontrolPompa();         // batas waktu dan penguncian pompa",
    "  kirimTelemetri();       // satu perjalanan: telemetri naik, perintah turun",
    "}",
  ])
);
body.push(
  P(
    "Pembacaan sensor ultrasonik tidak dipakai mentah. Satu ping tunggal pada wadah yang sama sekali tidak bergerak pernah menghasilkan 0,07 cm lalu 87 cm secara berurutan. Karena itu setiap pengukuran mengambil lima ping, membuang hasil di luar rentang masuk akal, mengambil nilai tengahnya, lalu meratakannya terhadap pembacaan sebelumnya."
  )
);
body.push(
  ...CODE([
    "float pingMedian() {",
    "  float v[SAMPEL_PAKAN]; int n = 0;",
    "  for (int i = 0; i < SAMPEL_PAKAN; i++) {",
    "    float cm = pingSekali();",
    "    if (cm > 0) v[n++] = cm;   // ping gagal dibuang, bukan dihitung nol",
    "    delay(60);",
    "  }",
    "  if (n == 0) return -1.0f;",
    "  // urutkan lalu ambil nilai tengah: satu gema liar tidak menggeser median",
    "  return v[n / 2];",
    "}",
  ])
);
body.push(
  P(
    "Nilai tengah dipilih dan bukan rata-rata, karena satu pantulan liar sejauh 87 cm akan menarik rata-rata secara signifikan sedangkan nilai tengah mengabaikannya sama sekali."
  )
);

body.push(H3("5.2.2 Logika Kendali Pompa"));
body.push(
  P(
    "Ambang penyalaan dan target pengisian dibuat sebagai dua nilai yang berbeda. Pada rancangan awal keduanya bernilai sama, dan akibatnya pompa berhenti pada detik yang sama ketika air baru saja melewati garis yang menyalakannya, sehingga akuarium tidak pernah benar-benar terisi."
  )
);
body.push(
  ...CODE([
    "// pengaman luapan diperiksa lebih dulu, mendahului logika lain",
    "if (pompaNyala && levelAir >= BATAS_LUAP) {",
    "  setPompa(false, false);",
    '  catatEvent("critical_water", "Pompa dihentikan oleh pengaman.");',
    "}",
    "",
    "if (levelAir >= batasAir) { jumlahBacaanRendah = 0; pompaTerkunci = false; }",
    "else if (!pompaTerkunci && !pompaNyala) {",
    "  jumlahBacaanRendah++;",
    "  bool cooldownSelesai = !pernahMati ||",
    "                         (millis() - waktuPompaMati >= COOLDOWN_POMPA);",
    "  if (jumlahBacaanRendah >= KONFIRMASI_MULAI && cooldownSelesai)",
    "    setPompa(true, false);",
    "}",
    "",
    "if (pompaNyala && !pompaManual && levelAir >= targetAir) setPompa(false, false);",
  ])
);

body.push(H3("5.2.3 Logika Server dan Basis Data"));
body.push(
  P(
    "Basis data D1 menyimpan empat tabel: readings untuk riwayat pembacaan, events untuk kejadian yang dibangkitkan perangkat, commands untuk antrean perintah, dan settings untuk seluruh nilai yang dapat diubah pengguna."
  )
);
body.push(
  P(
    "Pengiriman telemetri bersifat at-least-once. Ketika permintaan sampai ke server tetapi balasannya hilang di perjalanan pulang, perangkat menganggapnya gagal dan mengirim ulang seluruh antrean kejadiannya. Tanpa penangkal, satu peringatan pernah tersimpan puluhan kali. Penyelesaiannya adalah memberi setiap kejadian penanda unik dari perangkat dan memasang indeks unik pada kolomnya."
  )
);
body.push(
  ...CODE([
    "-- penanda milik perangkat, berbentuk <penanda boot>-<nomor urut>",
    "ext_id  TEXT,",
    "CREATE UNIQUE INDEX idx_events_ext ON events (ext_id);",
    "",
    "-- pengiriman ulang berubah menjadi operasi tanpa efek",
    "INSERT OR IGNORE INTO events (ts, kind, message, ext_id) VALUES (?,?,?,?)",
  ])
);
body.push(
  P(
    "Seluruh setelan dan kalibrasi divalidasi di server sebelum disimpan. Validasinya tidak berhenti pada rentang tiap nilai, tetapi juga memeriksa hubungan antarnilai: target pengisian harus setidaknya 10 persen di atas ambang penyalaan, titik basah sensor air harus setidaknya 20 satuan ADC di atas titik keringnya, dan jarak wadah kosong harus lebih jauh daripada jarak wadah penuh. Pemeriksaan berpasangan ini dilakukan terhadap gabungan nilai lama dan nilai baru, karena mengubah satu sisi pasangan saja sudah cukup untuk membalik skalanya."
  )
);

body.push(H3("5.2.4 Jembatan Telegram"));
body.push(
  P(
    "Jembatan Telegram diimplementasikan sebagai modul tersendiri di dalam Worker. Peringatan hanya dikirim untuk baris kejadian yang benar-benar baru tertulis ke basis data, sehingga pengiriman ulang dari perangkat tidak menghasilkan pesan ganda. Pengirimannya dijadwalkan setelah perangkat menerima balasan, karena waktu sambungan TLS adalah sumber daya perangkat yang paling mahal."
  )
);
body.push(
  ...CODE([
    "if (res.meta.changes > 0) {              // hanya baris yang benar-benar baru",
    "  const teks = pesanEvent(kind, message);",
    "  if (teks) baru.push(teks);",
    "}",
    "",
    "// dikirim setelah perangkat dibalas, bukan sebelum",
    "if (baru.length) c.executionCtx.waitUntil(kirimSemua(c.env, baru));",
  ])
);

body.push(H2("5.3 Implementasi Aplikasi Web"));
body.push(
  ...Gambar(
    "dashboard.jpg",
    "Dashboard AQUASMART yang berjalan di Cloudflare Workers",
    400,
    445
  )
);
body.push(
  P(
    "Spanduk merah di bagian atas tangkapan layar muncul karena perangkat sedang tidak terhubung saat gambar diambil, dan tabel catatan di bawahnya menampilkan riwayat kejadian beserta pengesahan setiap perintah yang pernah dikirim."
  )
);
body.push(
  P(
    "Dashboard dibangun dengan React 19 dan Vite, ditata dengan Tailwind CSS, dan grafik riwayatnya digambar memakai Recharts. Seluruh berkas statisnya dilayani oleh Worker yang sama dengan API-nya, sehingga tidak ada layanan hosting terpisah yang perlu dikelola."
  )
);
body.push(
  P(
    "Grafik riwayat tidak hanya menggambar dua garis. Rentang waktu ketika pompa menyala diberi pita latar, sehingga pertanyaan apakah ketinggian air benar-benar menanggapi pompa dapat dijawab dengan melihat, bukan dengan menduga. Garis ambang dan garis target isi juga digambar pada posisinya masing-masing."
  )
);
body.push(...Gambar("ph_telegram.png", "Antarmuka bot Telegram untuk peringatan dan kendali", 200, 375));
body.push(
  P(
    "Bot Telegram melayani lima perintah, yaitu /status untuk membaca kondisi terkini, /pakan untuk memberi pakan, /pompa untuk menyalakan atau mematikan pompa, /buka untuk membuka kunci pompa, dan /help untuk menampilkan daftar perintah. Perintah yang masuk diletakkan pada antrean yang sama dengan perintah dari dashboard, sehingga keduanya bukan dua jalur kendali yang berbeda melainkan dua pintu menuju satu jalur."
  )
);

/* ============================================================== BAB 6 */
body.push(H1("BAB 6: PENGUJIAN DAN ANALISIS HASIL"));

body.push(H2("6.1 Skenario Pengujian Sistem"));
body.push(
  P(
    "Pengujian dilakukan langsung pada prototipe yang telah dirakit, dengan data dibaca dari Serial Monitor perangkat serta dari basis data D1 di sisi server. Delapan skenario berikut dijalankan."
  )
);
body.push(
  ...NUM([
    "Pengiriman telemetri. Memastikan perangkat berhasil mengirim pembacaan ke server secara berkala, dan mengukur selang waktu antar pengiriman yang berhasil.",
    "Kalibrasi sensor air. Membaca nilai ADC pada kondisi kering dan pada ketinggian air aman tertinggi, lalu menyimpan keduanya sebagai titik nol dan titik seratus persen.",
    "Kalibrasi sensor pakan. Mengukur jarak sensor ke dasar wadah kosong dan ke permukaan pakan saat penuh.",
    "Pemberian pakan manual. Menekan tombol pada dashboard dan mengamati gerakan servo beserta durasinya.",
    "Pemberian pakan terjadwal. Menyetel jadwal melalui dashboard lalu menunggu perangkat menjalankannya sendiri dari jam internalnya.",
    "Kendali pompa. Menjalankan pompa secara manual maupun otomatis, serta menguji pengaman luapan dan penguncian pompa.",
    "Ketahanan terhadap pengiriman ulang. Mengirim kejadian yang sama dua kali untuk memastikan hanya satu yang tersimpan.",
    "Jembatan Telegram. Menguji peringatan keluar, perintah masuk, penolakan permintaan tanpa secret token, dan penolakan perintah dari chat yang tidak diizinkan.",
  ])
);

body.push(H2("6.2 Hasil Pengujian Sensor dan Transmisi Data"));
body.push(JudulTabel("Hasil kalibrasi dua titik pada kedua sensor"));
body.push(
  TBL(
    [
      ["Sensor", "Titik nol persen", "Titik seratus persen", "Cara memperoleh"],
      ["Level air", "ADC 10 (strip kering, terukur 3 sampai 10)", "ADC 210 (ketinggian aman tertinggi)", "Dibaca dari alat pada dua ketinggian air"],
      ["Stok pakan", "82 mm (jarak ke dasar wadah kosong)", "35 mm (jarak ke permukaan saat penuh)", "Diukur sebagai jarak, dapat diperiksa dengan penggaris"],
    ],
    [1700, 2700, 2300, 2326]
  )
);
body.push(Kosong());
body.push(
  P(
    "Perbedaan sifat kedua sensor terlihat jelas pada cara kalibrasinya. Sensor pakan menghasilkan besaran fisik yang dapat diverifikasi dengan penggaris, sedangkan sensor air menghasilkan angka ADC yang tidak memiliki arti fisik sendiri dan hanya bermakna relatif terhadap dua titik acuan yang diukur pada alat itu sendiri."
  )
);
body.push(
  P(
    "Pada ketinggian air aman tertinggi, sepuluh pembacaan berturut-turut menghasilkan nilai 235, 216, 226, 222, 194, 187, 209, 217, 217, dan 208. Rentangnya 187 sampai 235 dengan rata-rata sekitar 213, yaitu ayunan sekitar 12 persen tanpa tren naik maupun turun. Nilai kalibrasi ditetapkan pada 210, yaitu nilai tipikal dan bukan nilai puncaknya."
  )
);
body.push(
  P(
    "Pemilihan nilai tipikal ini merupakan keputusan keselamatan, bukan keputusan ketelitian. Kesalahan ke dua arah tidak setara: titik seratus persen yang dipasang terlalu tinggi membuat sistem menganggap air lebih sedikit daripada kenyataannya lalu terus memompa sampai melewati kabel sensor, sedangkan titik yang terlalu rendah hanya membuat pompa berhenti lebih awal."
  )
);
body.push(JudulTabel("Keandalan transmisi data sebelum dan sesudah perbaikan buffer TLS"));
body.push(
  TBL(
    [
      ["Kondisi", "Selang antar laporan berhasil", "Tingkat kegagalan"],
      ["Buffer TLS 512 byte", "sekitar 12,25 detik", "Sebagian besar pengiriman gagal dengan kode -5"],
      ["Buffer TLS 16.384 byte", "5,0 detik", "Tidak ada kegagalan selama pengamatan"],
    ],
    [2400, 3400, 3226]
  )
);
body.push(Kosong());
body.push(
  P(
    "Kegagalan awal disebabkan oleh ukuran buffer penerimaan TLS yang terlalu kecil. Buffer 512 byte hanya dapat dipakai apabila server bersedia menegosiasikan Maximum Fragment Length, dan Cloudflare tidak mendukungnya, sehingga setiap pembentukan sambungan gagal. Setelah buffer dinaikkan, selang antar laporan turun menjadi 5 detik tanpa satu pun kegagalan selama pengamatan."
  )
);

body.push(H2("6.3 Hasil Pengujian Aktuator dan Antarmuka"));
body.push(JudulTabel("Hasil pengujian aktuator dan antarmuka"));
body.push(
  TBL(
    [
      ["Skenario", "Hasil", "Bukti"],
      ["Pakan manual dari dashboard", "Berhasil", "Servo membuka tepat 3,00 detik, terukur dari penanda waktu Serial Monitor"],
      ["Pakan terjadwal", "Berhasil", "Servo bergerak sendiri pada pukul 16.52.02 dengan metode Otomatis Pagi, tepat satu kali"],
      ["Pompa manual dari dashboard", "Berhasil", "Perintah id 31 dijalankan dalam hitungan detik setelah dikirim"],
      ["Pompa otomatis", "Berhasil", "Menyala setelah tiga pembacaan rendah berturut-turut"],
      ["Pengaman luapan", "Berhasil", "Pompa dihentikan dan permintaan manual ditolak pada pembacaan 100 persen"],
      ["Penguncian pompa", "Berhasil", "Kejadian critical_water tercatat setelah air tidak naik dalam durasi maksimum"],
      ["Penangkal pengiriman ulang", "Berhasil", "Tiga kiriman dengan dua penanda unik menghasilkan tepat dua baris kejadian"],
      ["Telegram, peringatan keluar", "Berhasil", "Peringatan air kritis diterima satu kali walau dikirim dua kali"],
      ["Telegram, perintah masuk", "Berhasil", "Perintah /pakan masuk ke tabel commands dengan id 1"],
      ["Telegram, tanpa secret token", "Ditolak", "Dibalas HTTP 401"],
      ["Telegram, chat tidak diizinkan", "Ditolak", "Dibalas HTTP 200 tanpa memasukkan perintah apa pun ke antrean"],
    ],
    [2600, 1500, 4926]
  )
);
body.push(Kosong());
body.push(
  P(
    "Pengujian jembatan Telegram dilakukan tanpa melibatkan perangkat sama sekali, karena seluruh jembatan berada di sisi server. Perintah yang diantrekan dari Telegram diverifikasi langsung pada tabel commands di basis data, dan jalur dari antrean menuju perangkat sudah terbukti pada pengujian kendali dashboard."
  )
);

body.push(H2("6.4 Analisis dan Pembahasan Kendala"));
body.push(
  P(
    "Prototipe berhasil menjalankan seluruh fitur yang dirancang, tetapi perjalanannya tidak mulus. Kendala berikut dicatat apa adanya beserta cara penyelesaiannya, karena sebagian besar di antaranya hanya dapat ditemukan melalui pengukuran dan bukan melalui pembacaan kode."
  )
);
body.push(H3("6.4.1 Kendala yang Berhasil Diselesaikan"));
body.push(JudulTabel("Kendala teknis beserta penyelesaiannya"));
body.push(
  TBL(
    [
      ["Kendala", "Sebab", "Penyelesaian"],
      [
        "Sebagian besar pengiriman telemetri gagal dengan kode -5.",
        "Buffer penerimaan TLS 512 byte hanya cukup apabila server menegosiasikan Maximum Fragment Length, dan Cloudflare tidak mendukungnya.",
        "Buffer dinaikkan menjadi 16.384 byte. Selang laporan turun dari 12,25 detik menjadi 5,0 detik tanpa kegagalan.",
      ],
      [
        "Satu peringatan tersimpan puluhan kali di basis data.",
        "Pengiriman bersifat at-least-once. Balasan yang hilang membuat perangkat mengirim ulang seluruh antrean kejadiannya.",
        "Setiap kejadian diberi penanda unik dari perangkat, dan indeks unik pada kolom tersebut mengubah pengiriman ulang menjadi operasi tanpa efek.",
      ],
      [
        "Pompa berhenti pada detik yang sama ketika air baru melewati ambang penyalaan.",
        "Ambang penyalaan dan ambang penghentian bernilai sama, sehingga pompa mati tepat saat melewati garis yang menyalakannya.",
        "Ditambahkan target pengisian sebagai nilai terpisah, dengan validasi server yang menuntut jaraknya setidaknya 10 persen.",
      ],
      [
        "Jam perangkat pernah terbaca tahun 2042 dan jadwal pakan ikut melenceng.",
        "Fungsi pemeriksaan bawaan pustaka RTC hanya memeriksa penanda berhenti, bukan kewajaran nilainya.",
        "Server mengirim waktu WIB pada setiap siklus untuk diselaraskan, dan firmware menolak menjalankan jadwal apabila tahunnya di luar rentang wajar.",
      ],
      [
        "Pembacaan sensor pakan melonjak liar pada wadah yang tidak bergerak.",
        "Wadah berbentuk kerucut memantulkan gema dari dinding miring, bukan dari permukaan pakan.",
        "Wadah diganti dengan yang berdinding lurus, dan pembacaan memakai nilai tengah dari lima ping ditambah perataan antar siklus.",
      ],
      [
        "Servo dan relay mati bersamaan, lalu hidup kembali tanpa sebab yang jelas.",
        "Residu lem pada ujung pin kabel pompa dan baterai menciptakan sambungan berhambatan tinggi. Pergeseran ADC saat relay aktif menunjukkan hambatan sekitar 4 sampai 9 ohm.",
        "Permukaan kontak dibersihkan. Pergeseran ADC turun dari 127 satuan menjadi 38 satuan, dan kedua aktuator kembali bekerja.",
      ],
      [
        "Pembacaan sensor air melonjak dari 4 menjadi lebih dari 120 setiap kali relay aktif.",
        "Arus aktuator mengalir melalui jalur ground yang juga dipakai sensor air sebagai acuan nol, sehingga acuan itu ikut bergeser.",
        "Sebagian berkurang setelah kontak dibersihkan. Pemisahan jalur ground secara menyeluruh dicatat sebagai saran pengembangan.",
      ],
    ],
    [2300, 3200, 3526]
  )
);
body.push(Kosong());

body.push(H3("6.4.2 Keterbatasan yang Disadari"));
body.push(
  P(
    "Beberapa keterbatasan tidak diselesaikan dalam prototipe ini. Keterbatasan tersebut dicatat terbuka agar tidak disalahpahami sebagai fitur yang bekerja."
  )
);
body.push(
  ...BULLET([
    "Tidak ada sensor suhu. Dokumen ide awal merencanakan DS18B20, tetapi sembilan dari sepuluh pin GPIO sudah terpakai dan satu-satunya pin tersisa juga menentukan mode boot. Sensor kedua akhirnya diisi oleh ultrasonik untuk stok pakan, yang menjawab kebutuhan berbeda namun sama nyatanya.",
    "Sensor pakan gagal membaca permukaan serpih oat. Pengujian terkendali menunjukkan 2 dari 20 pembacaan berhasil pada permukaan oat, 0 dari 8 pada oat yang diratakan, dan 14 dari 14 pada permukaan kertas datar. Panjang gelombang 40 kHz di udara sekitar 8,6 mm, mendekati ukuran butir oat, sehingga gema terhambur. Pelet ikan yang lebih kecil dan keras diperkirakan terbaca jauh lebih baik.",
    "Pembacaan sensor air selama pompa menyala belum sepenuhnya jujur. Pergeseran sisa sekitar 38 satuan ADC masih ada, dan baru hilang seluruhnya apabila jalur ground sensor dipisahkan dari jalur arus aktuator.",
    "Antarmuka tidak memiliki autentikasi pengguna. Ini keputusan yang disengaja agar dashboard dapat langsung dipakai saat demonstrasi, tetapi berarti siapa pun yang mengetahui alamatnya dapat mengirim perintah. Bot Telegram sebaliknya dijaga dua lapis.",
    "Riwayat pembacaan tidak pernah dipangkas. Pada selang 5 detik, basis data bertambah sekitar 17.000 baris per hari dan akan menuntut pemangkasan berkala pada pemakaian jangka panjang.",
  ])
);

/* ============================================================== BAB 7 */
body.push(H1("BAB 7: KESIMPULAN DAN SARAN"));

body.push(H2("7.1 Kesimpulan"));
body.push(
  P(
    "Prototipe AQUASMART berhasil menjawab permasalahan yang dirumuskan pada Bab 1. Sistem memberi pakan secara terjadwal tanpa kehadiran pemilik, memantau ketinggian air dan mengisinya kembali secara otomatis, memantau sisa stok pakan, menyampaikan peringatan langsung ke ponsel pemilik, serta menyimpan riwayat pembacaan dan tindakan yang dapat ditelusuri kembali."
  )
);
body.push(
  ...NUM([
    "Pemberian pakan terjadwal berjalan dari jam internal perangkat dan terbukti menyala sendiri pada waktu yang ditetapkan, sehingga tetap bekerja walaupun koneksi internet terputus.",
    "Pengisian air otomatis bekerja dengan ambang penyalaan dan target pengisian yang terpisah, dilengkapi konfirmasi tiga pembacaan, jeda antar penyalaan, penguncian pompa, dan pengaman luapan yang seluruhnya terbukti aktif pada pengujian.",
    "Menyimpan kalibrasi dan setelan di server, bukan di dalam program perangkat, terbukti menjadi keputusan rancangan yang paling berguna. Seluruh kalibrasi diukur ulang berkali-kali selama pengujian tanpa satu kali pun mengunggah ulang program.",
    "Peringatan melalui Telegram melengkapi kekurangan mendasar dashboard, yaitu bahwa dashboard hanya berguna bagi pemilik yang sedang membukanya, sedangkan seluruh premis sistem ini justru keadaan ketika pemilik tidak mengawasi.",
    "Menempatkan jembatan Telegram di layanan awan dan bukan di perangkat membuat fitur tersebut diperoleh tanpa menambah beban memori pada ESP8266 yang sudah terbatas.",
    "Sebagian besar kendala yang ditemukan berasal dari dunia fisik, yaitu pantulan gema, hambatan kontak, dan jalur ground bersama, bukan dari kesalahan logika program. Kendala semacam itu hanya dapat ditemukan melalui pengukuran pada alat yang sebenarnya.",
  ])
);

body.push(H2("7.2 Saran dan Pengembangan Selanjutnya"));
body.push(
  ...NUM([
    "Memisahkan jalur ground sensor dari jalur arus aktuator secara menyeluruh, sehingga pembacaan sensor air selama pompa menyala menjadi sepenuhnya jujur dan pengaman luapan tidak lagi terpicu oleh angka palsu.",
    "Menambahkan sensor suhu air DS18B20 dengan memindahkan sebagian komponen ke ekspander pin, atau mengganti board dengan ESP32 yang memiliki lebih banyak GPIO sekaligus memori lebih besar.",
    "Mengganti baterai 9 volt pada rangkaian pompa dengan adaptor atau rangkaian baterai berhambatan dalam lebih rendah, karena baterai kotak memiliki hambatan dalam tinggi dan tegangannya ambruk saat motor mulai berputar.",
    "Menambahkan autentikasi pengguna pada dashboard, mengikuti pola dua lapis yang sudah diterapkan pada webhook Telegram.",
    "Memangkas riwayat pembacaan secara berkala, misalnya meringkas data lebih lama dari tujuh hari menjadi rata-rata per jam.",
    "Memperluas bot Telegram agar mendukung pengaturan jadwal dan ambang, sehingga seluruh fungsi dashboard tersedia pula dari aplikasi pesan.",
    "Menguji sensor pakan dengan pelet ikan sungguhan, karena butiran yang lebih kecil dan keras diperkirakan memantulkan gema jauh lebih baik daripada serpih oat yang dipakai saat pengujian.",
  ])
);

/* ====================================================== DAFTAR PUSTAKA */
body.push(new Paragraph({ children: [new PageBreak()] }));
body.push(H1Polos("DAFTAR PUSTAKA"));
body.push(
  P(
    "Seluruh pustaka berikut merupakan terbitan akses terbuka dan berkas aslinya disertakan pada folder laporan/referensi di repositori proyek.",
    { italics: true, size: 20, after: 180 }
  )
);
const pustaka = [
  "Y.-B. Lin dan H.-C. Tseng, \u201CFishTalk: An IoT-Based Mini Aquarium System,\u201D IEEE Access, vol. 7, hlm. 35457\u201335469, 2019. DOI: 10.1109/ACCESS.2019.2905017.",
  "M. Abdurohman, A. G. Putrada, dan M. M. Deris, \u201CA Robust Internet of Things-Based Aquarium Control System Using Decision Tree Regression Algorithm,\u201D IEEE Access, vol. 10, hlm. 56937\u201356951, 2022. DOI: 10.1109/ACCESS.2022.3177225.",
  "F. P. Rachman dan H. Santoso, \u201CSistem Kontrol Suhu dan Pakan Otomatis dalam Aquarium Aquascape Menggunakan NodeMCU ESP8266,\u201D JATISI, vol. 9, no. 1, hlm. 352\u2013364, 2022. DOI: 10.35957/jatisi.v9i1.1464.",
  "P. Wijaya dan T. Wellem, \u201CPerancangan dan Implementasi Sistem Pemantauan Suhu dan Ketinggian Air pada Akuarium Ikan Hias berbasis IoT,\u201D Jurnal Sistem Komputer dan Informatika (JSON), vol. 4, no. 1, hlm. 225\u2013233, 2022. DOI: 10.30865/json.v4i1.4539.",
  "D. Ratnasari, R. Mardhiyyah, dan A. Pramudwiatmoko, \u201CIoT Prototype Development of Automatic Fish Feeder and Water Replacement,\u201D International Journal of Engineering, Technology and Natural Sciences, vol. 2, no. 2, hlm. 51\u201355, 2021. DOI: 10.46923/ijets.v2i2.71.",
  "Susilawati, A. Nugraha, A. S. Buchori, S. Rahayu, F. Fathurohman, dan O. Yudiyanto, \u201CDesign and Implementation of Automatic Fish Feeder (AFF) Using Microcontroller Powered by Solar Cell,\u201D Mechanical Engineering for Society and Industry, vol. 3, no. 1, hlm. 47\u201353, 2023. DOI: 10.31603/mesi.8276.",
  "Haryansyah, Hadriansa, dan R. A. P., \u201CScheduling Uses the Blynk 2.0 Automations Feature for Effective Ornamental Fish Feeding,\u201D APTISI Transactions on Management (ATM), vol. 7, no. 2, hlm. 163\u2013171, 2023. DOI: 10.33050/atm.v7i2.2022.",
  "I. Gunawan, T. Akbar, dan M. G. Ilham, \u201CPrototipe Penerapan Internet of Things (IoT) pada Monitoring Level Air Tandon Menggunakan NodeMCU ESP8266 dan Blynk,\u201D Infotek: Jurnal Informatika dan Teknologi, vol. 3, no. 1, hlm. 1\u20137, 2020. DOI: 10.29408/jit.v3i1.1789.",
  "F. Jan, N. Min-Allah, S. Saeed, S. Z. Iqbal, dan R. Ahmed, \u201CIoT-Based Solutions to Monitor Water Level, Leakage, and Motor Control for Smart Water Tanks,\u201D Water, vol. 14, no. 3, art. 309, 2022. DOI: 10.3390/w14030309.",
  "E. Sze, D. Hindarto, I K. A. Wirayasa, dan Haryono, \u201CPerformance Comparison of Ultrasonic Sensor Accuracy in Measuring Distance,\u201D SinkrOn: Jurnal dan Penelitian Teknik Informatika, vol. 7, no. 4, hlm. 2556\u20132562, 2022. DOI: 10.33395/sinkron.v7i4.11883.",
];
pustaka.forEach((t, i) => {
  body.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120, line: SPASI },
      indent: { left: 640, hanging: 640 },
      children: [new TextRun({ text: `[${i + 1}] ${t}`, size: 24 })],
    })
  );
});

/* ============================================================ LAMPIRAN */
body.push(new Paragraph({ children: [new PageBreak()] }));
body.push(H1Polos("LAMPIRAN"));

body.push(H2("Lampiran 1: Kode Program Utama"));
body.push(
  P(
    "Kode lengkap tersedia pada repositori proyek. Program perangkat berada di firmware/AQUASMART/AQUASMART.ino sepanjang 755 baris, logika server di src/worker/index.ts, jembatan Telegram di src/worker/telegram.ts, skema basis data di schema.sql, dan antarmuka web di src/react-app. Nilai SSID, kata sandi WiFi, kunci perangkat, dan token bot tidak disertakan pada repositori maupun pada laporan ini karena merupakan kunci akses."
  )
);
body.push(P(`Tautan repositori: ${ISI("tautan repositori GitHub")}`, { after: 160 }));
body.push(P("Potongan bagian terpenting program perangkat:", { after: 80 }));
body.push(
  ...CODE([
    "// Pemetaan pin",
    "const int RELAY_PIN    = 5;   // D1 -> IN relay pompa",
    "const int WATER_POWER  = 16;  // D0 -> VCC sensor level air",
    "const int WATER_ANALOG = A0;  // sinyal analog sensor air",
    "const int TRIG_PIN     = 14;  // D5 -> TRIG HC-SR04",
    "const int ECHO_PIN     = 12;  // D6 -> ECHO HC-SR04",
    "const int SERVO_PIN    = 13;  // D7 -> sinyal servo SG90",
    "const int RTC_DAT_PIN  = 0;   // D3 -> DAT DS1302",
    "const int RTC_CLK_PIN  = 4;   // D2 -> CLK DS1302",
    "const int RTC_RST_PIN  = 15;  // D8 -> RST DS1302",
    "",
    "// Buffer TLS. Nilai 512 hanya cukup bila server menegosiasikan Maximum",
    "// Fragment Length, dan Cloudflare tidak mendukungnya.",
    "client.setBufferSizes(16384, 512);",
  ])
);

body.push(H2("Lampiran 2: Foto Dokumentasi Pembuatan dan Pengujian"));
body.push(...Gambar("ph_dokumentasi.png", "Dokumentasi proses pembuatan dan pengujian prototipe", 400, 280));
body.push(P(ISI("tambahkan foto dokumentasi proses perakitan dan pengujian"), { italics: true }));

body.push(H2("Lampiran 3: Tautan Video Demonstrasi Sistem"));
body.push(P(ISI("tautan video demonstrasi di YouTube atau Google Drive")));

/* ============================================================ DOKUMEN */
const doc = new Document({
  creator: "Kelompok AQUASMART",
  title: "Laporan Tugas Besar Teknologi IoT - AQUASMART",
  numbering: {
    config: [
      {
        reference: "angka",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 640, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "bulat",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 640, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Times New Roman", size: 24 }, paragraph: { spacing: { line: SPASI } } },
      heading1: { run: { font: "Times New Roman", size: 28, bold: true, color: "000000" } },
      heading2: { run: { font: "Times New Roman", size: 26, bold: true, color: "000000" } },
      heading3: { run: { font: "Times New Roman", size: 24, bold: true, color: "000000" } },
    },
    paragraphStyles: [
      {
        id: "Caption",
        name: "Caption",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Times New Roman", size: 20, italics: true },
      },
    ],
  },
  sections: [
    {
      properties: { page: { margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })],
            }),
          ],
        }),
      },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("SAVED:", OUT, "(" + buf.length + " bytes)");
  console.log("gambar:", nomorGambar, "| tabel:", nomorTabel);
});
