/**
 * Rancangan tata letak dashboard (wireframe) untuk Bab 4.5.
 * Susunan mengikuti App.tsx: header, tiga kolom utama, baris status, catatan,
 * grafik riwayat, dan panel setelan.
 */
const fs = require("fs");
const path = require("path");

const NAVY = "#054376";
const INK = "#33475B";
const FONT = "Arial, Helvetica, sans-serif";

const t = (x, y, s, size = 11, w = 400, c = INK, a = "start") =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${w}" fill="${c}" text-anchor="${a}">${s}</text>`;
const r = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 4}" fill="${o.fill ?? "#FFFFFF"}" stroke="${o.stroke ?? "#9FB2C6"}" stroke-width="${o.sw ?? 1.2}"/>`;
const note = (x, y, n) =>
  `<circle cx="${x}" cy="${y}" r="10" fill="${NAVY}"/>` + t(x, y + 4, String(n), 11, 700, "#FFFFFF", "middle");

let s = "";
s += r(1, 1, 798, 598, { rx: 8, stroke: NAVY, sw: 1.6, fill: "#F7FAFD" });

// 1 header
s += r(14, 14, 772, 44, { fill: "#EAF1F8" });
s += `<circle cx="38" cy="36" r="11" fill="${NAVY}"/>`;
s += t(58, 33, "AQUASMART", 13, 700, NAVY) + t(58, 48, "Kartu kendali akuarium, unit 01", 10.5);
s += t(700, 33, "Terakhir melapor", 10.5, 400, INK, "end") + t(700, 48, "12 detik lalu", 11, 700, NAVY, "end");
s += r(716, 24, 56, 24, { fill: "#FFFFFF" }) + t(744, 40, "tema", 10.5, 400, INK, "middle");

s += note(14, 14, 1);
// 2 spanduk
s += r(14, 66, 772, 22, { fill: "#FFF4D6", stroke: "#B7791F" }) + t(24, 81, "Spanduk status: muncul bila alat diam lebih dari 60 detik atau belum pernah melapor", 10);

// 3 kolom
const kolom = (x, w, judul, nilai, sub, ambang) => {
  let o = r(x, 96, w, 170);
  o += t(x + 12, 116, judul, 10, 700, NAVY);
  o += t(x + 12, 168, nilai, 46, 700, "#0B2540");
  o += t(x + 12, 188, sub, 10.5);
  for (let i = 0; i < 10; i++) o += `<rect x="${x + 12 + i * ((w - 24) / 10)}" y="200" width="${(w - 24) / 10 - 3}" height="14" fill="${i < 6 ? "#9CC3E6" : "#E3ECF5"}"/>`;
  o += `<line x1="${x + 12 + (w - 24) * ambang}" y1="196" x2="${x + 12 + (w - 24) * ambang}" y2="218" stroke="#B42318" stroke-width="2"/>`;
  o += t(x + 12, 232, "Status", 10.5) + t(x + w - 12, 232, "Aman", 10.5, 700, "#0B2540", "end");
  o += t(x + 12, 248, "Rincian lain", 10.5) + t(x + w - 12, 248, "nilai kecil", 10.5, 700, "#0B2540", "end");
  return o;
};
s += kolom(14, 262, "KETINGGIAN AIR", "60%", "ADC 130", 0.3);
s += kolom(284, 262, "STOK PAKAN", "75%", "jarak 52 mm", 0.3);
s += r(554, 96, 232, 170);
s += t(566, 116, "TINDAKAN", 10, 700, NAVY);
s += r(566, 124, 208, 32, { fill: NAVY, stroke: NAVY }) + t(576, 144, "Beri pakan sekarang", 10, 700, "#FFFFFF");
s += r(566, 162, 208, 32, { fill: "#EAF1F8" }) + t(576, 182, "Nyalakan pompa", 10);
s += r(566, 200, 208, 32, { fill: "#EAF1F8" }) + t(576, 220, "Buka kunci pompa", 10);
s += t(566, 252, "Jadwal pakan 07:00 / 17:00", 10.5);
s += note(260, 106, 2) + note(530, 106, 2) + note(772, 106, 3);

// 4 baris status
s += r(14, 274, 772, 34, { fill: "#FFFFFF" });
s += t(28, 296, "Sinyal WiFi: -62 dBm", 10) + t(300, 296, "Alat menyala: 3 jam 12 menit", 10) + t(570, 296, "Perintah menunggu: tidak ada", 10);
s += note(30, 316, 4).replace(/cy="316"/, 'cy="316"');

// 5 catatan
s += r(14, 322, 772, 100);
s += t(28, 340, "CATATAN: waktu, keterangan, durasi, pengesahan perintah", 10, 700, NAVY);
for (let i = 0; i < 4; i++) {
  s += `<line x1="28" y1="${352 + i * 16}" x2="772" y2="${352 + i * 16}" stroke="#D5E0EB"/>`;
  s += `<rect x="28" y="${356 + i * 16}" width="${180 + ((i * 53) % 120)}" height="6" fill="#C9D8E7"/>`;
  s += `<rect x="560" y="${356 + i * 16}" width="${40 + ((i * 29) % 60)}" height="6" fill="#9CC3E6"/>`;
}
s += note(30, 416, 5);

// 6 grafik
s += r(14, 430, 772, 100);
s += t(28, 448, "GRAFIK RIWAYAT: level air, stok pakan, pita waktu pompa menyala, garis ambang dan target", 10, 700, NAVY);
s += `<polyline fill="none" stroke="${NAVY}" stroke-width="2" points="30,505 100,500 170,470 240,466 310,505 380,500 450,480 520,468 590,470 660,490 740,486"/>`;
s += `<polyline fill="none" stroke="#2E7D4F" stroke-width="2" points="30,478 120,478 210,486 300,486 390,492 480,492 570,498 660,498 740,500"/>`;
s += `<rect x="170" y="456" width="70" height="64" fill="#9CC3E6" opacity="0.35"/>`;
s += `<line x1="28" y1="496" x2="772" y2="496" stroke="#B42318" stroke-dasharray="5 4"/>`;
s += note(30, 524, 6);

// 7 setelan
s += r(14, 538, 772, 50);
s += t(28, 556, "SETELAN: jadwal pakan, durasi, ambang dan target air, ambang pakan, kalibrasi dua titik per sensor", 10, 700, NAVY);
for (let i = 0; i < 6; i++) s += r(28 + i * 124, 564, 108, 18, { fill: "#F7FAFD" });
s += note(30, 584, 7).replace(/cy="584"/, 'cy="598"');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#FFFFFF"/>${s}</svg>`;
fs.writeFileSync(path.join(__dirname, "gambar", "mockup-dashboard.svg"), svg);
console.log("mockup ditulis");
