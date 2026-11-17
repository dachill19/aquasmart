/**
 * Membangun laporan.html dan mencetaknya ke PDF dengan Chrome tanpa kepala.
 * Nomor halaman pada daftar isi diambil dari cetakan sebelumnya: cetak,
 * baca teks tiap halaman, isi nomor, cetak lagi sampai nomor tidak berubah.
 *
 *   node laporan/build_pdf.cjs
 *
 * Butuh Chrome (CHROME=jalur\chrome.exe bila tidak berada di lokasi bawaan
 * cache puppeteer) dan pdftotext (ikut Git for Windows).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { bangun } = require("./build_laporan.cjs");

const DIR = __dirname;
const HTML = path.join(DIR, "laporan.html");
const PDF = path.join(DIR, "Laporan_Tubes_IoT_AQUASMART.pdf");

function cariChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const akar = path.join(os.homedir(), ".cache", "puppeteer", "chrome");
  const versi = fs.readdirSync(akar).sort().reverse()[0];
  return path.join(akar, versi, "chrome-win64", "chrome.exe");
}

function cetak() {
  execFileSync(
    cariChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${PDF}`,
      "file:///" + HTML.replace(/\\/g, "/"),
    ],
    { stdio: "ignore", timeout: 120000 }
  );
}

const norm = (s) => s.replace(/\s+/g, " ").trim();

function bacaHalaman() {
  const teks = execFileSync("pdftotext", ["-enc", "UTF-8", PDF, "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  return teks.split("\f").map(norm);
}

/** Halaman tempat tiap judul, gambar, dan tabel jatuh, dicari setelah penanda isi laporan. */
function petakanHalaman(hasil) {
  const halaman = bacaHalaman();
  const awal = halaman.findIndex((h) => h.includes("§§BODY§§"));
  if (awal < 0) throw new Error("Penanda awal isi tidak ditemukan pada PDF");
  const cari = (kunci) => {
    const k = norm(kunci);
    for (let i = awal; i < halaman.length; i++) if (halaman[i].includes(k)) return i + 1;
    return undefined;
  };
  const peta = {};
  for (const e of hasil.toc) peta[e.id] = cari(e.teks);
  for (const g of hasil.daftarGambar) peta[g.id] = cari(`Gambar ${g.no}. ${g.teks}`);
  for (const t of hasil.daftarTabel) peta[t.id] = cari(`Tabel ${t.no}. ${t.teks}`);
  const hilang = Object.entries(peta).filter(([, v]) => v === undefined).map(([k]) => k);
  return { peta, hilang, total: halaman.length };
}

let halaman = {};
for (let putaran = 1; putaran <= 4; putaran++) {
  const hasil = bangun(halaman);
  fs.writeFileSync(HTML, hasil.html);
  cetak();
  const { peta, hilang, total } = petakanHalaman(hasil);
  if (hilang.length) console.warn("Tidak ditemukan di PDF:", hilang.join(", "));
  const sama = JSON.stringify(peta) === JSON.stringify(halaman);
  console.log(`Putaran ${putaran}: ${total} halaman, nomor ${sama ? "stabil" : "berubah"}`);
  halaman = peta;
  if (sama) break;
}
fs.writeFileSync(path.join(DIR, "halaman.json"), JSON.stringify(halaman, null, 1));
console.log("PDF:", PDF);
