# Laporan Tugas Besar IoT

Isi laporan ditulis di `build_laporan.cjs` (HTML), gaya cetak di `laporan.css`.
Potongan kode di Lampiran 1 dibaca langsung dari firmware dan sumber server menurut nomor baris.

```bash
node laporan/diagram.cjs        # gambar/alur-kerja.svg, alur-perintah.svg
node laporan/mockup.cjs         # gambar/mockup-dashboard.svg
node laporan/build_pdf.cjs      # laporan.html + Laporan_Tubes_IoT_AQUASMART.pdf (perlu Chrome via puppeteer)
node laporan/build_docs_html.cjs  # laporan-docs.html untuk ditempel ke Google Docs
```

`build_pdf.cjs` merender ulang sampai nomor halaman di Daftar Isi, Daftar Gambar, dan Daftar Tabel stabil.
Bagian yang belum diketahui (nama dosen, nomor kelompok, anggota 2 sampai 5, tautan video) tampil sebagai `[isi ...]` berlatar kuning dan harus diisi manual.
Gambar SVG di `gambar/` diubah ke PNG untuk PDF; versi JPEG untuk Docs ada di `gambar/docs/`.
