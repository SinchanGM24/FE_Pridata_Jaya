# Rencana Redesain Portal Toko & Sales — Keluar dari "AI Slop"

Branch: `feat/toko-sales-mobile-redesign`
Tanggal: 2026-09-06
Status: **Fase 0–7 dieksekusi 2026-09-06.** `tsc` bersih, `eslint` bersih, `next build` sukses, detector Impeccable nol temuan. Belum di-commit.

---

## 1. Diagnosis singkat

Branch ini **berhasil memperbaiki struktur** dan **gagal memilih identitas**.

Yang sudah benar: navigasi mobile (bottom tab + sheet), `ResponsiveTable` yang
memproyeksikan satu definisi kolom ke kartu (<md) dan tabel (>=md), lantai
sentuh 44px, cincin fokus global, `Modal` dengan focus trap + bottom sheet,
warna rose yang dipesan khusus untuk aksi komersial.

Yang belum: **tidak ada satu pun keputusan visual yang khas produk ini.** Ganti
string Indonesia jadi Inggris, dan UI ini bisa dipakai SaaS mana pun. Detector
mekanis mengembalikan **nol temuan** di scope toko/sales — ini bukan slop yang
norak, ini slop yang *bersih dan tanpa karakter*, yang lebih sulit dilihat dan
lebih sulit diperbaiki.

Bukti terkuat: wordmark portal toko secara harfiah adalah string
**`Online-Shop`** (`components/toko/TokoStorefrontShell.tsx:174`) — bahasa
Inggris, generik, di produk distribusi B2B milik CV. Pridata Jaya.

Sensus mekanis (toko + sales + shared):

| Sinyal | Angka | Arti |
|---|---|---|
| `slate-*` | 816 | vs `brand` 82, `accent` 10 — praktis monokrom abu |
| `text-xs` + `text-sm` | 81% dari semua ukuran | tidak ada hierarki ukuran |
| `font-semibold` | 76% dari semua bobot | tidak ada hierarki bobot |
| `tabular-nums` | 0 | produk penuh Rupiah, angka tidak pernah rata kolom |
| Radius aktif | 5 (`xl` 110, `lg` 64, `2xl` 58, `full` 26, `3xl` 3) | tanpa aturan |
| Tanda tangan kartu generik | 63 baris | `rounded + border-slate-200 + bg-white + shadow-sm` |
| Micro-label uppercase | 88 instance, 6 nilai tracking berbeda | satu ide diulang, tidak konsisten |
| Kebocoran token | `sky` mentah 16x, `red` 24x (padahal `rose` 51x), `indigo` 8x | `--color-brand-*` di-bypass |
| Montserrat (`font-brand`) | dipakai 1x di scope | webfont kedua untuk 11 karakter |

Adopsi setengah jalan adalah masalah struktural terbesarnya: dari 33 halaman
toko/sales, hanya ~13 memakai primitif `components/shared/*`. **Layar baca
dapat sistem baru; layar tulis (form, modal, profil) tidak.** Pengguna bertemu
desain baru saat menelusuri, dan desain lama begitu mencoba melakukan sesuatu.

---

## 2. Prinsip pengarah (POV)

Tiga kalimat yang harus memenangkan setiap keputusan desain berikutnya:

1. **Toko tidak sedang belanja, mereka sedang restock.** Pemilik toko memesan
   ~20 SKU yang sama tiap minggu. Katalog grid + pencarian + modal detail +
   lightbox adalah kosakata *penemuan*. Yang dibutuhkan adalah kosakata
   *pemesanan ulang*. `lib/order-insights.ts` (`buildRestockRecommendations`)
   sudah menghitung persis ini dan sekarang dibuang ke kartu read-only di dasar
   dashboard.

2. **Sales tidak sedang membaca laporan, mereka sedang kunjungan.** Hari
   seorang sales adalah rute, bukan dashboard. IA sekarang diorganisir per
   *laporan* (Dashboard / Toko / Piutang / Konfirmasi). Yang dibutuhkan
   diorganisir per *kunjungan*: satu toko, semuanya di satu layar.
   `sales/toko-kelolaan/[storeId]/page.tsx` sudah jadi sketsa itu — dan
   sekarang halaman paling tidak didesain di branch ini.

3. **Uang adalah pahlawan tipografinya.** Setiap layar penting di kedua portal
   berpusat pada satu angka Rupiah. Angka itu harus jadi hal terbesar,
   ter-tabular, dan satu langkah bobot di atas segalanya. Sekarang ia berukuran
   sama dengan label di sebelahnya.

---

## 3. Fase kerja

### Fase 0 — Perbaiki yang rusak  ✅ SELESAI

Dikerjakan 2026-09-06. `tsc --noEmit` bersih, `eslint` bersih, `next build`
sukses. Belum di-commit.

| # | Masalah | Lokasi | Perbaikan |
|---|---|---|---|
| 0.1 | **29 string class Tailwind rusak.** `rounded md:h-10 -lg` — `rounded-lg` terbelah oleh find-replace di commit `1c2cf2e` | `toko/profile/page.tsx` 16x, `sales/profile/page.tsx` 13x | `sed 's/rounded md:h-10 -lg/rounded-lg md:h-10/g'`, lalu ganti input mentah dengan `components/shared/FormInput.tsx` yang sudah ada tapi belum dipakai di scope ini |
| 0.2 | **Teks instruksi dikirim sebagai nilai.** `useState("Jelaskan alasan retur dari toko")` di-submit sebagai `reason` ke API | `TokoReturnsWorkspace.tsx:162` → `:363` | `useState("")`. `placeholder` yang benar sudah ada di `:652` |
| 0.3 | **Form registrasi toko bukan `<form>`.** 16 input `required`, submit `type="button" onClick` — validasi browser mati total | `sales/toko-kelolaan/page.tsx:626-698` | Bungkus `<form onSubmit>`, `type="submit"`, error per-field + `aria-invalid`, scroll ke field pertama yang invalid |
| 0.4 | **Toast menimpa bottom tab bar.** `PageFeedback` di `bottom-4` (16px); tab bar menempati 0→56px+safe-area | `PageFeedback.tsx:28` | `bottom-[calc(var(--spacing-tabbar-gap)+0.5rem)] md:bottom-4` — tokennya sudah ada di `globals.css:33` |
| 0.5 | **`Intl.NumberFormat` dikonstruksi ulang tiap panggilan** — per baris, per render, x2 karena `ResponsiveTable` render dua cabang | `lib/format.ts:6-41` | Hoist instance ke module scope |

Yang benar-benar diubah:

- `app/(dashboard)/toko/profile/page.tsx` (16x) dan
  `app/(dashboard)/sales/profile/page.tsx` (13x) — `rounded md:h-10 -lg`
  → `rounded-lg md:h-10`. Migrasi ke `FormInput` ditunda ke Fase 3; ini murni
  memperbaiki korupsi, bukan mendesain ulang.
- `components/toko/TokoReturnsWorkspace.tsx:162` — default kalimat instruksi
  dihapus, plus guard `!returnReason.trim()` di `handleSubmit` karena field itu
  jadi bisa kosong untuk pertama kalinya.
- `app/(dashboard)/sales/toko-kelolaan/page.tsx` — `<div>` pembungkus modal
  jadi `<form onSubmit>`, tombol jadi `type="submit"`, `handleSubmit` menerima
  `FormEvent` dan `preventDefault()`. Tidak ada state error per-field yang
  ditulis: 16 atribut `required`/`minLength`/`type="email"` yang selama ini mati
  sekarang hidup, dan validasi bawaan browser sudah menangani pesan per-field
  serta fokus ke field pertama yang salah.
- `components/shared/PageFeedback.tsx` — `bottom-4` →
  `bottom-[calc(var(--spacing-tabbar-gap)+0.5rem)] md:bottom-4`. Terverifikasi
  ter-compile di CSS hasil build. Halaman tanpa tab bar ikut kena offset;
  itu ruang kosong ekstra, tidak pernah menutupi apa pun.
- `lib/format.ts` — lima instance `Intl.NumberFormat` di-hoist ke module scope.

Belum dikerjakan di Fase 0 (sengaja, karena butuh keputusan desain):
input `py-2` (~34px) di modal registrasi masih di bawah lantai sentuh 44px —
ikut Fase 3 bersama migrasi `FormInput`.

### Fase 1 — Dunia visual  ✅ arah diputuskan

**Keputusan: identitas Pridata, palet diturunkan dari logo.**

`public/pridata-logo.png` disampel per-piksel. Logo hanya punya dua warna,
dan pembagiannya nyaris seimbang:

| | hex | HSL | share |
|---|---|---|---|
| Biru azure | `#0292C6` | hsl(196, 98%, 39%) | 46% |
| **Oranye** | `#FD9005` | hsl(34, 98%, 51%) | **54%** |

Dua temuan dari sampel ini yang mengubah rencana:

**1.a — Biru sekarang sudah nyaris tepat, secara kebetulan.** `sky-600`
(`#0084CC`, hsl 200) hanya berjarak 4° dari biru logo. Jadi keputusan "ganti
sky" ternyata salah sasaran: birunya boleh tinggal, cukup digeser 4° ke
hue logo dan diberi nama `brand` sungguhan.

**1.b — Oranye, separuh logo yang lebih besar dan lebih khas, tidak ada sama
sekali di UI.** Sebagai gantinya branch ini menciptakan aksen `rose` yang tidak
muncul di brand mana pun. Inilah sumber "slop" yang sebenarnya: palet produk
ini bukan diturunkan dari apa-apa, ia dipilih dari default. Menukar
`--color-accent-*` dari rose ke oranye logo sekaligus memberi pasangan
komplementer sungguhan (196° vs 34° ≈ berseberangan) dan warna aksi-uang yang
hangat — kombinasi yang tidak dipakai dashboard AI mana pun, yang hampir selalu
biru+ungu atau biru+merah muda.

**1.c — Kontras: tombol primary sekarang gagal WCAG AA.**
`Button.tsx:8` memakai `bg-brand-600 text-white`. `sky-600` (`#0084CC`) vs
putih = **4.06:1**, di bawah ambang 4.5:1 untuk teks normal. Branch ini
menambahkan cincin fokus global tapi label tombol utamanya sendiri tidak lolos.

Rasio terukur (vs teks putih / vs `slate-900`):

| warna | vs putih | vs slate-900 |
|---|---|---|
| biru logo `#0292C6` | 3.54 ✗ | 5.04 AA |
| `sky-600` `#0084CC` (dipakai sekarang) | **4.06 ✗** | 4.40 |
| oranye logo `#FD9005` | 2.29 ✗ | **7.79 AA** |
| `rose-600` `#E70044` (dipakai sekarang) | 4.69 AA | 3.81 |

Konsekuensi desain, bukan kompromi:

- **Oranye adalah warna permukaan dan penekanan, bukan latar tombol teks-putih.**
  Dengan teks gelap ia 7.79:1 — sangat kuat. Ini justru menghasilkan tombol
  komersial yang lebih khas daripada tombol putih-di-atas-warna yang generik.
- Untuk latar teks-putih, tiap hue butuh satu langkah lebih gelap dari nilai
  logo. Titik AA terkecil yang sudah dihitung:
  - `brand-700` = `hsl(196, 98%, 34%)` = `#027EAC` → 4.58:1 ✅
  - `accent-700` = `hsl(34, 97%, 34%)` = `#AB6203` → 4.69:1 ✅
- Nilai logo apa adanya (`#0292C6`, `#FD9005`) jadi step 500/600 untuk badge,
  border, ikon, dan permukaan bertinta — bukan untuk teks putih.

Sisa yang masih perlu diputuskan di fase ini:

- **1.d Netral.** `slate` (abu kebiruan) vs netral hangat. Oranye brand
  cenderung bentrok dengan abu kebiruan; netral hangat akan menyatu.
- **1.e Model pembeda kartu.** Sekarang ruang + garis + bayangan dipakai
  ketiganya sekaligus, jadi tidak ada yang membedakan apa pun. Pilih satu.
- **1.f Nasib Montserrat** (dipakai untuk satu wordmark).

Keluaran fase ini: `DESIGN.md` + token final di `app/globals.css`.

---

### Fase 1-lama — catatan pertanyaan awal (sudah terjawab sebagian)

Ini inti pekerjaan anti-slop. Tanpa ini, fase berikutnya cuma memoles kulit
yang sama.

Yang harus diputuskan:

- **1.1 Identitas & wordmark.** `Online-Shop` diganti apa? Ini menentukan
  seluruh palet, ikonografi, dan densitas di bawahnya.
- **1.2 Palet.** `sky-500` adalah biru paling sering muncul di UI hasil AI.
  Perlu diganti dengan warna yang punya alasan. Netral juga perlu dipilih ulang
  — `slate` (biru) vs netral hangat, karena permukaan portal ini akan dilihat
  di bawah lampu neon toko, bukan di monitor kantor.
- **1.3 Aksen komersial.** Rose sekarang bekerja dengan baik dan disiplin
  (`Button.tsx:9-10`). Kandidat kuat untuk dipertahankan apa pun keputusan
  brand-nya.
- **1.4 Tekstur/permukaan.** Sekarang semuanya `bg-white + shadow-sm` — model
  elevasi di mana semua mengambang 1px, artinya tidak ada yang mengambang.
  Perlu satu keputusan: kartu dibedakan dengan *ruang*, *garis*, atau
  *permukaan* — pilih satu, bukan ketiganya sekaligus seperti sekarang.

Keluaran fase ini: `DESIGN.md` di root FE + token final di `app/globals.css`.

### Fase 2 — Fondasi token & tipografi

Setelah 1.1–1.4 diputuskan.

- **2.1 Skala tipe jadi empat peran, tidak lebih.**
  `display` (angka penentu aksi, `tabular-nums`, bobot tertinggi) ·
  `title` · `body` (sekarang nyaris tidak dipakai — `font-normal` hanya 6x) ·
  `label` (satu nilai tracking, bukan enam).
  Turunkan 251 `font-semibold` jadi `font-medium` di semua tempat yang bukan
  title atau label.
- **2.2 `font-variant-numeric: tabular-nums`** pada `body` di `globals.css`
  (Plus Jakarta Sans mendukungnya), atau minimal pada sel `align: "right"` di
  `ResponsiveTable` dan nilai `StatCard`.
- **2.3 Radius jadi tiga nilai berjenjang**, bukan lima acak: kontainer luar >
  elemen dalam > kontrol.
- **2.4 Tutup kebocoran token.** `sky-*` mentah (16x) → `brand-*`. Hapus
  `red-*` dari scope, sisakan `rose-*` untuk danger. Ciutkan
  `constants/index.ts:21-37` `ROLE_COLORS` (9 hue dekoratif) ke lima
  `StatusTone` yang sudah didefinisikan di `lib/ui-labels.ts:65`.
- **2.5 Putuskan nasib Montserrat.** Dipakai untuk satu wordmark. Entah
  dipakai sungguhan sebagai suara display, atau dihapus.

### Fase 3 — Kosakata komponen

- **3.1 Selesaikan migrasi layar tulis.** Ganti `<button>` mentah dengan
  `<Button>`, kotak error `border-red-200 bg-red-50` (8 file) dengan
  `<PageFeedback>`, input `py-2` (~34px, di bawah lantai sentuh yang branch ini
  klaim) dengan `FormInput`.
- **3.2 Hapus tiga reimplementasi `ResponsiveTable`.**
  `sales/toko-kelolaan/page.tsx:325-380`, `toko/profile:327-343`,
  `[storeId]/page.tsx:227-241` menyalin struktur `<dl>` + baris aksi yang
  identik dengan `ResponsiveTable.tsx:156,168`.
- **3.3 Hentikan nesting kartu tiga tingkat.**
  `toko/dashboard:173 → :190 → :200` dan `sales/dashboard:109 → :146` memakai
  `slate-100`/`slate-200` di ketiga tingkat, jadi mata tidak dapat isyarat
  kedalaman apa pun.
- **3.4 `StatGrid` 4-up bukan default.** Baris KPI setara berkata "keempat
  angka ini sama pentingnya", yang tidak pernah benar. Satu angka utama +
  pendukung yang lebih kecil.

### Fase 4 — Portal Toko: dari katalog ke restock

- **4.1 Jadikan pemesanan ulang jalur utama.** Naikkan
  `buildRestockRecommendations` dari kartu read-only jadi aksi: "pesan lagi
  seperti minggu lalu", kuantitas terakhir per SKU sudah terisi.
- **4.2 Filter katalog.** Sekarang hanya `.filter()` teks bebas atas 4 field
  (`katalog:81-91`); tidak ada kategori/brand/sort, padahal `getCategoryLabel`
  (`:29`) sudah menghitung facet-nya.
- **4.3 Perbaiki bahasa transaksional.** "Invoice Sementara" untuk keranjang
  (`purchase-order:260`) membuat pemilik toko mengira sudah ditagih. "Ajukan ke
  Fakturis" menyebut jabatan internal yang tidak dikenal pelanggan.
- **4.4 Konfirmasi order yang tidak hilang.** Sekarang: toast, tunggu 1200ms,
  redirect ke `riwayat-transaksi` yang tidak menyorot order baru; nomor order
  tidak ikut terbawa (`purchase-order:143`).
- **4.5 Enum mentah masih bocor ke layar** meski `toUiLabel` ada dan dipakai
  26x: `toko/dashboard:124` menampilkan `Verifikasi: PENDING`. Juga
  `purchase-order:247`, `toko-kelolaan:484`, `[storeId]/grade-saya:78`.
- **4.6 Dua langkah terakhir alur uang tidak pernah didesain.**
  `toko/hutang-toko/page.tsx` dan `toko/pembayaran-online/page.tsx` masing-masing
  satu baris `export { default } from ...`.

### Fase 5 — Portal Sales: dari laporan ke kunjungan

- **5.1 Jadikan `[storeId]` hub layar utama**, bukan halaman paling terlantar.
  Satu toko, satu layar: utang, grade, order terakhir, aksi.
- **5.2 Tujuh destinasi terlalu banyak.** Strip pill desktop butuh
  `scrollIntoView` (`SalesPortalShell.tsx:107-111`) karena meluber — itu desain
  yang memberi tahu dirinya sendiri kelebaran.
- **5.3 "Skor 47" tanpa skala.** Kalau sales tidak bisa menjelaskan angkanya ke
  atasan, tiga status bernama yang sudah dihitung ("Siap follow up" / "Tagih
  dulu" / data belum cukup) mungkin sudah cukup jadi fiturnya.
- **5.4 Densitas desktop.** `ResponsiveTable.tsx:243` `px-4 py-3` = baris ~44px;
  triase 50 invoice jatuh tempo di laptop hanya menampilkan ~12. Mode Operate
  butuh baris padat di pointer, longgar di sentuh — mesin breakpoint-nya sudah
  ada.

### Fase 6 — Status, performa, aksesibilitas

- **6.1 Delapan halaman tanpa loading state sama sekali**, dan
  `[storeId]/page.tsx:239` merender literal `"..."` di tempat angka.
- **6.2 Satu tombol coba-lagi di seluruh scope.** Setiap kegagalan berakhir di
  toast yang bisa ditutup, lalu jalan buntu.
- **6.3 `sales/dashboard` memblokir `Promise.all` lima endpoint**, tiga di
  antaranya fetch koleksi penuh tanpa paginasi (`:32-41`). Satu endpoint lambat
  mengunci seluruh layar; `catch` hanya menyetel satu string dan halaman
  kosong selamanya.
- **6.4 `ResponsiveTable` merender setiap baris dua kali** (`:90` dan `:184`
  adalah sibling yang selalu ter-mount). Pada `pageSize=50` itu 100 subtree.
  `useIsMobile()` sudah ada di `hooks/useMediaQuery.ts:22` dengan fallback
  aman-SSR.
- **6.5a `public/pridata-logo.png` adalah PNG 1 MB, 1536x1024**, dimuat
  `loading="eager"` untuk ditampilkan 96x96 di footer desktop
  (`TokoStorefrontShell.tsx:286`) dan di `BrandIdentity.tsx:18`.
- **6.5 11 dari 12 `<Image>` memakai `unoptimized`** — kartu katalog memuat
  `width={640}` untuk ditampilkan setinggi ~40px, di koneksi berbayar.
- **6.6 `aria-live` hanya 2 di seluruh scope.** Tabel yang menukar skeleton
  jadi baris, filter yang mengubah jumlah hasil, paginasi — semua senyap.
- **6.7 Tidak ada skip link.** Dengan header sticky + nav 7 item + kartu filter,
  pengguna papan ketik menekan Tab ~15x untuk sampai ke konten di
  `aging-piutang`.
- **6.8 `StatCard` menyampaikan tone hanya lewat warna** — batang 4px yang
  `aria-hidden` (`StatCard.tsx:42`) dan warna teks. `Badge.tsx:18` sudah benar
  soal ini; `StatCard` belum.

### Fase 7 — Verifikasi

Satu putaran berbatas, bukan loop: build, screenshot desktop + mobile
bersamaan, jalankan `detect.mjs`, `npm run lint`, perbaiki semua temuan dalam
satu batch, konfirmasi sekali lagi, berhenti.

---

## 4. Urutan yang disarankan

Fase 0 sekarang (bug, tidak butuh keputusan) → Fase 1 (butuh keputusan kamu) →
2 → 3 → lalu 4 dan 5 bisa paralel → 6 → 7.

Fase 0 layak jadi commit/PR sendiri: isinya murni perbaikan cacat, tidak
bergantung pada arah visual apa pun, dan salah satunya (0.2 dan 0.3) sedang
mengirim data buruk ke backend hari ini.

---

## 5. Catatan yang tidak boleh hilang

Jangan bongkar saat redesain — ini bagian yang sudah benar:

- `components/shared/ResponsiveTable.tsx:17-34` — proyeksi kolom berbasis
  `role`. Satu definisi, dua render. Menggantikan 17 tabel yang kolom
  terakhirnya tidak terjangkau di 360px.
- `components/shared/Modal.tsx` — bottom sheet di bawah sm, focus trap, Esc,
  kunci gulir, kembalikan fokus, footer hormat safe-area.
- `components/shared/QuantityStepper.tsx` — mengganti `<input type="number">`
  yang di iOS tidak punya spinner sama sekali.
- `Button.tsx:9-10` — rose dipesan khusus untuk aksi uang, diterapkan konsisten
  di lima permukaan. Pemilik toko bisa menemukan aksi bayar dari warna saja.
- `globals.css:33` `--spacing-tabbar-gap` + `viewportFit: "cover"` di
  `layout.tsx:32` — bug home indicator iOS yang nyata dan sudah dihindari.
- Higiene konten: nol emoji, nol `alert()`, nol `href="#"`, nol gradient
  dekoratif, copy Indonesia sentence-case. Setengah tes slop ini sudah lulus.


---

## 6. Hasil eksekusi (2026-09-06)

64 berkas, +1111/−680. Verifikasi: `tsc --noEmit` bersih, `eslint` bersih,
`next build` sukses, `detect.mjs` nol temuan.

### Sensus sebelum → sesudah

| Sinyal | Sebelum | Sesudah |
|---|---|---|
| `sky-*` mentah (bypass token) | 16 | **0** |
| `red-*` (dobel dengan `rose-*`) | 24 | **0** |
| Gradien hex mentah | 1 | **0** |
| Hue dekoratif `ROLE_COLORS` | 9 | **2** (netral + brand, semantik) |
| `shadow-sm` di scope | 39 | **5** (hanya yang benar-benar melayang) |
| Varian micro-label | 6 tracking, 84 instance | **1 peran** (`type-label`, 95 pakai) |
| `font-semibold` | 251 | **174** |
| `tabular-nums` | 0 | global di `body` |
| Nilai radius aktif | 6, acak | 4 berjenjang (`2xl`>`xl`>`lg`>`full`) |
| Salinan lokal `formatRupiah` | 10 | **0** |
| Kontrol di bawah 44px | 41 | **0** |
| Tombol primary vs WCAG AA | 4.06:1 ✗ | **4.58:1** ✓ |
| Hero sales (teks putih) | 3.58:1 ✗ | **6.32:1** ✓ |
| `aria-live` di scope | 2 | 3 + skip link di kedua shell |
| Baris tabel ter-mount | ×2 | ×1 |

### Koreksi terhadap temuan audit

Dua temuan Assessment A tidak dieksekusi karena salah baca setelah diperiksa:

- **"Kartu toko di `toko-kelolaan` adalah reimplementasi `ResponsiveTable`."**
  Bukan. Itu kartu kunjungan, dan memaksanya jadi tabel di desktop justru
  melawan Fase 5. Yang memang duplikat adalah string micro-label-nya, dan itu
  yang diperbaiki.
- **"`toko/hutang-toko` dan `toko/pembayaran-online` tidak pernah didesain."**
  Keduanya alias rute satu baris ke `invoice-cash`, yang justru sudah memakai
  `ResponsiveTable` dan `StatCard`. Alias rute ke halaman yang sudah didesain
  bukan cacat.

### Sengaja tidak dikerjakan

- **`unoptimized` pada 11 dari 12 `<Image>`.** Itu bukan kecerobohan melainkan
  jalan pintas: `next.config.ts` hanya mengizinkan `remotePatterns` localhost,
  jadi gambar dari API produksi akan ditolak optimizer. Menghapusnya akan
  merusak gambar di produksi. **Perbaikannya ada di konfigurasi, bukan di JSX:**
  tambahkan host API produksi ke `remotePatterns`, baru cabut `unoptimized`.
  Yang dikerjakan: logo footer lokal (1 MB, desktop-only, `loading="eager"`)
  diturunkan ke `lazy` dan dilepas dari `unoptimized`.
- **Peran `type-title` / `type-body` / `type-display` baru dipakai di primitif.**
  Halaman masih memakai ukuran ad-hoc. Menyapunya butuh keputusan per-layar,
  bukan regex; `type-label` yang mengunci 95 tempat sudah menutup celah terbesar.
