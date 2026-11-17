/**
 * Menulis laporan-docs.html: isi yang sama dengan PDF, tanpa tata letak
 * cetak, untuk ditempel ke Google Docs. Daftar isi diisi oleh Docs sendiri.
 */
const fs = require("fs");
const path = require("path");
const { bangun } = require("./build_laporan.cjs");
const hasil = bangun({}, { docs: true });
fs.writeFileSync(path.join(__dirname, "laporan-docs.html"), hasil.html);
console.log("laporan-docs.html", Math.round(hasil.html.length / 1024), "KB");
