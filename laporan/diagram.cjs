/**
 * Menggambar diagram alur kerja dan alur perintah untuk laporan sebagai SVG,
 * lalu menyimpannya ke laporan/gambar. Dokumen laporan memakai SVG ini
 * langsung sebagai gambar vektor.
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "gambar");
const NAVY = "#054376";
const INK = "#33475B";
const FONT = "Arial, Helvetica, sans-serif";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const STYLE = {
  proses: { fill: "#EAF1F8", stroke: NAVY, text: "#0B2540" },
  mulai: { fill: NAVY, stroke: NAVY, text: "#FFFFFF" },
  tanya: { fill: "#FFF4D6", stroke: "#B7791F", text: "#3D2A06" },
  aksi: { fill: "#E6F4EA", stroke: "#2E7D4F", text: "#0F3A22" },
  waspada: { fill: "#FDECEC", stroke: "#B42318", text: "#521010" },
};

function teks(cx, cy, lines, color, size, weight = 400, anchor = "middle") {
  const lh = size * 1.3;
  const y0 = cy - ((lines.length - 1) * lh) / 2;
  return lines
    .map(
      (ln, i) =>
        `<text x="${cx}" y="${y0 + i * lh}" text-anchor="${anchor}" dominant-baseline="central" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(ln)}</text>`
    )
    .join("");
}

function kotak(cx, cy, w, h, lines, jenis, size = 12.5) {
  const s = STYLE[jenis];
  const rx = jenis === "mulai" ? h / 2 : 6;
  return (
    `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${rx}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.4"/>` +
    teks(cx, cy, lines, s.text, size, jenis === "mulai" ? 700 : 400)
  );
}

function belah(cx, cy, w, h, lines, size = 13.5) {
  const s = STYLE.tanya;
  const pts = `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
  return `<polygon points="${pts}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.4"/>` + teks(cx, cy, lines, s.text, size);
}

const panah = (d, putus = false) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.5" ${putus ? 'stroke-dasharray="6 4"' : ""} marker-end="url(#ujung)"/>`;

const garis = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;

const label = (x, y, t, anchor = "middle") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="14" font-weight="700" fill="${INK}">${esc(t)}</text>`;

function bungkus(w, h, isi) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><marker id="ujung" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker></defs>` +
    `<rect width="${w}" height="${h}" fill="#FFFFFF"/>` +
    isi +
    `</svg>`
  );
}

/* ------------------------------------------------- Diagram 1: alur kerja */
function alurPerangkat() {
  const W = 860;
  const X = 285; // sumbu utama
  const XR = 705; // kolom aksi
  const BW = 372; // lebar kotak proses dan belah ketupat
  const AW = 226; // lebar kotak aksi
  const GAP = 32;
  const LOOP_X = 66; // jalur kembali ke awal putaran

  const langkah = [
    { j: "proses", h: 62, t: ["Jaga WiFi, baca sensor level air", "(10 sampel ADC dirata-ratakan → level %)"] },
    { j: "tanya", h: 84, t: ["Pompa menyala dan", "level ≥ 95% ?"], a: { j: "waspada", h: 58, t: ["Matikan pompa, catat", "event critical_water"] } },
    { j: "tanya", h: 116, t: ["Level < ambang, tidak terkunci,", "3 bacaan rendah berturut-turut,", "dan jeda ≥ 30 detik lewat ?"], a: { j: "aksi", h: 58, t: ["Nyalakan pompa", "(relay aktif rendah)"] } },
    { j: "tanya", h: 116, t: ["Pompa nyala dan level ≥ target", "isi 3 kali berturut-turut atau", "durasi maksimum habis ?"], a: { j: "aksi", h: 78, t: ["Matikan pompa. Bila air masih", "di bawah ambang setelah durasi", "habis, kunci pompa"] } },
    { j: "proses", h: 80, t: ["Baca sensor pakan: 5 ping → median", "→ perataan → stok % (ditunda saat", "servo atau pompa aktif)"] },
    { j: "tanya", h: 76, t: ["Stok pakan < ambang ?"], a: { j: "waspada", h: 58, t: ["Catat event critical_food", "(sekali, histeresis 8%)"] } },
    { j: "tanya", h: 84, t: ["Jam RTC sama dengan", "jadwal pagi atau sore ?"], a: { j: "aksi", h: 78, t: ["Servo ke 90° selama durasi", "pakan, lalu kembali ke 0°;", "catat event feed_done"] } },
    { j: "tanya", h: 76, t: ["≥ 5 detik sejak laporan terakhir ?"], a: { j: "proses", h: 78, t: ["POST telemetri ke Worker", "(pembacaan, event, ack)", "lewat HTTPS"] }, akhir: true },
  ];

  let s = "";
  s += kotak(X, 38, 160, 40, ["MULAI"], "mulai", 15);
  s += panah(`M${X},58 L${X},90`);
  s += kotak(X, 134, BW, 64, ["Inisialisasi (setup): relay mati,", "servo 0°, RTC diperiksa, WiFi tersambung"], "proses", 15);
  const yBingkai = 196;
  s += panah(`M${X},166 L${X},${yBingkai + 54}`);

  const posisi = [];
  let kursor = yBingkai + 54; // tepi atas langkah pertama
  for (const st of langkah) {
    posisi.push({ st, cy: kursor + st.h / 2, atas: kursor, bawah: kursor + st.h });
    kursor += st.h + GAP;
  }

  posisi.forEach(({ st, cy, bawah }, i) => {
    s += st.j === "tanya" ? belah(X, cy, BW, st.h, st.t, 14) : kotak(X, cy, BW, st.h, st.t, st.j, 15);
    const berikut = posisi[i + 1];
    if (st.a) {
      const kiriAksi = XR - AW / 2;
      s += label(X + BW / 2 + 12, cy - 9, "Ya", "start");
      s += panah(`M${X + BW / 2},${cy} L${kiriAksi},${cy}`);
      s += kotak(XR, cy, AW, st.a.h, st.a.t, st.a.j, 14);
      if (!st.akhir && berikut) {
        const yTemu = bawah + GAP / 2;
        s += garis(`M${XR},${cy + st.a.h / 2} L${XR},${yTemu} L${X + 6},${yTemu}`);
      }
    }
    if (berikut) {
      if (st.j === "tanya") s += label(X + 12, bawah + 19, "Tidak", "start");
      s += panah(`M${X},${bawah} L${X},${berikut.atas}`);
    }
  });

  const akhir = posisi[posisi.length - 1];
  const hOlah = 84;
  const yOlah = akhir.bawah + GAP + hOlah / 2 + 8;
  s += panah(`M${XR},${akhir.cy + akhir.st.a.h / 2} L${XR},${yOlah - hOlah / 2}`);
  s += kotak(XR, yOlah, AW + 30, hOlah, ["Terima balasan 200: selaraskan", "RTC, terapkan setelan dan", "kalibrasi, jalankan perintah"], "proses", 14);
  const yPertama = posisi[0].cy;
  s += garis(`M${XR - (AW + 30) / 2},${yOlah} L${LOOP_X},${yOlah} L${LOOP_X},${yPertama}`);
  s += panah(`M${LOOP_X},${yPertama} L${X - BW / 2},${yPertama}`);
  const yTidak = akhir.cy;
  s += garis(`M${X - BW / 2},${yTidak} L${LOOP_X},${yTidak}`);
  s += label(X - BW / 2 - 8, yTidak - 9, "Tidak", "end");

  const yBawah = yOlah + hOlah / 2 + 24;
  s =
    `<rect x="30" y="${yBingkai}" width="${W - 60}" height="${yBawah - yBingkai}" rx="12" fill="none" stroke="${NAVY}" stroke-width="1.4" stroke-dasharray="8 6"/>` +
    `<text x="48" y="${yBingkai + 22}" font-family="${FONT}" font-size="14" font-weight="700" fill="${NAVY}">PUTARAN UTAMA (loop), DIULANG TANPA HENTI</text>` +
    s;
  return bungkus(W, yBawah + 18, s);
}

/* ------------------------------------------- Diagram 2: perintah dua arah */
function alurPerintah() {
  const W = 800;
  const kolom = [
    { x: 118, t: ["Pengguna", "Dashboard atau Telegram"] },
    { x: 400, t: ["Cloudflare Worker", "dan basis data D1"] },
    { x: 682, t: ["NodeMCU ESP8266", "di akuarium"] },
  ];
  const [A, B, C] = kolom.map((k) => k.x);
  const top = 26;
  const dasar = 760;
  let s = "";

  for (const k of kolom) {
    s += kotak(k.x, top + 28, 218, 56, k.t, "proses", 14.5);
    s += `<path d="M${k.x},${top + 56} L${k.x},${dasar}" stroke="#8AA0B5" stroke-width="1.4" stroke-dasharray="6 6" fill="none"/>`;
  }

  const pesan = (y, dari, ke, t, putus = false, sub = null) => {
    const arah = ke > dari ? 1 : -1;
    const mid = (dari + ke) / 2;
    let o = panah(`M${dari},${y} L${ke - arah * 2},${y}`, putus);
    o += teks(mid, y - 13, [t], "#0B2540", 14, 700);
    if (sub) o += teks(mid, y + 16, [sub], INK, 12.5);
    return o;
  };
  const catatan = (x, y, w, lines, jenis = "tanya") => kotak(x, y, w, 24 + lines.length * 18, lines, jenis, 13.5);

  s += pesan(150, A, B, "1. POST /api/command {type: feed}");
  s += catatan(B, 222, 330, ["2. Perintah disimpan di tabel commands", "(acked_at masih kosong)"]);
  s += pesan(310, C, B, "3. POST /api/telemetry", false, "pembacaan, event, ack (selang 5 detik)");
  s += pesan(388, B, C, "4. Balasan 200", true, "commands, settings, epoch_wib");
  s += catatan(C, 472, 270, ["5. Servo terbuka selama durasi", "pakan, lalu menutup; event", "feed_done dicatat"], "aksi");
  s += pesan(566, C, B, "6. POST /api/telemetry berikutnya", false, "ack berisi id perintah, event feed_done");
  s += catatan(B, 654, 330, ["7. acked_at diisi; event baru diteruskan", "ke Telegram oleh Worker"]);
  s += pesan(732, B, A, "8. Dashboard menarik /api/latest", true, "perintah tampil terkonfirmasi");

  return bungkus(W, dasar + 26, s);
}

fs.writeFileSync(path.join(OUT, "alur-kerja.svg"), alurPerangkat());
fs.writeFileSync(path.join(OUT, "alur-perintah.svg"), alurPerintah());
console.log("SVG ditulis ke", OUT);
