# Design — Portal Toko & Sales, CV. Pridata Jaya

Sistem desain yang dikunci untuk kedua portal eksternal (`/toko` dan `/sales`).
Setiap redesain halaman membaca berkas ini lebih dulu. Jangan buat sistem baru per
halaman — perluas atau ubah berkas ini kalau sistemnya memang perlu tumbuh.

Nilai yang mengikat hidup di `app/globals.css`. Berkas ini menjelaskan **kenapa** dan
**kapan**; `globals.css` adalah **apa**-nya. Kalau keduanya berselisih, kode yang menang —
lalu perbaiki berkas ini di sesi yang sama.

Cakupan: 33 halaman di `app/(dashboard)/toko/**` dan `app/(dashboard)/sales/**`, halaman
login (`app/(auth)/login`) yang jadi pintu masuk keduanya, plus primitif bersama di
`components/shared/**`. Peran internal (owner, admin, akuntan,
fakturis, gudang, digital-marketing) memakai shell sidebar dan **tidak** diatur berkas ini
— tetapi mereka ikut memakai `components/shared/**`, jadi perubahan primitif punya jangkauan
lebih luas dari portal.

---

## Genre

**modern-minimal.** Ini alat operasional B2B, bukan halaman pemasaran. Tidak ada hero
naratif, tidak ada bukti sosial, tidak ada enrichment. Fungsi yang membawa halaman.

Tiga kalimat yang memenangkan setiap keputusan desain berikutnya:

1. **Toko tidak sedang belanja, mereka sedang restock.** Pemilik toko memesan ~20 SKU yang
   sama tiap minggu. Kosakatanya pemesanan ulang, bukan penemuan.
2. **Sales tidak sedang membaca laporan, mereka sedang kunjungan.** Hari seorang sales
   adalah rute, bukan dashboard.
3. **Uang adalah pahlawan tipografinya.** Setiap layar penting berpusat pada satu angka
   Rupiah. Angka itu harus jadi hal terbesar dan ter-tabular di layarnya.

---

## Keluarga makrostruktur

Hanya ada satu jenis halaman di sini, jadi hanya ada satu keluarga.

- **Halaman aplikasi → Workbench.** Konten adalah alat, bukan cerita. Bentuknya:
  bar konteks/aksi di atas → satu baris KPI (opsional) → satu atau beberapa `Card` yang
  masing-masing memuat satu pekerjaan → tabel/daftar sebagai isi utama.
  Ritme seksi tunggal: `space-y-4` di `<main>` shell. Anak-anaknya adalah saudara
  langsung — tidak ada pembungkus tambahan.
- **Tidak ada halaman marketing.** Kalau suatu saat ada, ia butuh keluarga sendiri di
  berkas ini sebelum ditulis.

Yang boleh berbeda antar halaman: arketipe komponen di dalam keluarga (ada/tidaknya baris
KPI, tabel vs kartu, ada/tidaknya bar filter). Yang **tidak** boleh berbeda: palet,
tipografi, radius, suara tombol, ritme seksi.

## Arketipe shell

Dicatat, bukan dirotasi. Kedua shell sudah jadi sidik jari portalnya masing-masing.

| | Portal Toko | Portal Sales |
|---|---|---|
| Berkas | `components/toko/TokoStorefrontShell.tsx` | `components/sales/SalesPortalShell.tsx` |
| Nav desktop | masthead lengket — wordmark kiri, katalog + keranjang + avatar kanan | header hero `brand-800` + strip pill 4 tujuan di bawahnya |
| Nav mobile | `BottomTabBar` 4 tab + "Lainnya" (bottom sheet) | sama |
| Footer | 3 kolom, `md:block` saja | baris logout, `md:flex` saja |
| Varian | `TokoFeatureLayout` menambah sidebar kiri 240px di `lg` | — |

`sales/toko-kelolaan/[storeId]/**` sengaja memakai shell **toko**, karena di sana sales
memang sedang bertindak sebagai toko. Strip konteks "Sedang sebagai toko: X" tidak boleh
tergulir hilang.

Judul halaman (`h1`) adalah milik shell, bukan halaman. Halaman mengirimkan `title` sebagai
prop. Ini satu-satunya teks di sistem yang tidak memakai peran `type-*`.

**Login tidak punya shell.** `app/(auth)/login` berdiri sendiri di atas ground `slate-50`
dengan satu kartu `max-w-md`, dan ia memegang `h1`-nya sendiri (`type-title`). Semuanya rata
kiri — lockup, judul, label — karena ini alat kerja, bukan halaman pemasaran yang
ditengahkan. Sisanya mengikuti sistem apa adanya: `fieldClasses`, `Button`, `InlineAlert`.

---

## Tema

Palet diturunkan per-piksel dari `public/pridata-logo.png`, bukan dipilih dari default.
Logo hanya punya dua warna dan pembagiannya nyaris seimbang: biru azure `#0292C6` (46%)
dan oranye `#FD9005` (54%).

Sumbernya: blok `@theme` di `app/globals.css`.

### Brand — azure

```
brand-50  #ecf9fe   brand-300 #59cef8   brand-600 #0291c5  ← nilai logo persis
brand-100 #cff0fc   brand-400 #0fbbfa   brand-700 #027eac  ← latar teks-putih
brand-200 #9fe1f9   brand-500 #02a4de   brand-800 #03678c  ← panel penuh teks-putih
                                        brand-900 #04506c
```

### Accent — oranye

```
accent-50  #fef6eb   accent-300 #fcbc69   accent-600 #d37903
accent-100 #fee9cd   accent-400 #fca636   accent-700 #ab6203  ← latar teks-putih
accent-200 #fdd7a5   accent-500 #fd9208  ← nilai logo persis, teks gelap
                                          accent-800 #8b5004  accent-900 #6c3f04
```

### Aturan pemakaian — ini bagian yang mengikat

Kontras sudah dihitung, bukan dikira:

| Warna | vs teks putih | vs `slate-900` | Boleh dipakai untuk |
|---|---|---|---|
| `brand-600` `#0291c5` | 3.58 ✗ | 5.04 ✓ | ikon, garis, permukaan bertinta, cincin fokus input. **Tidak pernah** jadi latar teks putih. |
| `brand-700` `#027eac` | **4.58 ✓** | — | latar tombol primary, cincin fokus global, latar skip link |
| `brand-800` `#03678c` | 6.32 ✓ | — | panel penuh berteks putih (header hero sales) |
| `accent-500` `#fd9208` | 2.29 ✗ | **7.90 ✓** | latar tombol `commerce` **dengan teks gelap**. Tombol beli yang hangat, bukan putih-di-atas-warna yang generik. |
| `accent-700` `#ab6203` | **4.69 ✓** | — | kalau memang butuh teks putih di atas oranye |

Tombol primary lama memakai `sky-600` (4.06:1) dan gagal WCAG AA. Jangan mundur ke sana.

**Oranye dipesan khusus untuk uang.** Keranjang, checkout, bayar, ajukan pembayaran,
pesan-lagi. Tidak pernah untuk border netral, tidak pernah untuk dekorasi. Pemilik toko
harus bisa menemukan aksi bayar dari warna saja. Diterapkan lewat
`<Button variant="commerce">`, bukan class `accent-*` mentah.

### Netral — tetap `slate`

Keputusan sadar, bukan kelalaian. Rencana redesain sempat mempertanyakan slate (abu
kebiruan) vs netral hangat, dengan alasan oranye brand bisa bentrok dengannya. Slate tetap
dipakai karena:

1. ~760 instance-nya tersebar di `components/shared/**` yang juga dipakai enam area peran
   internal. Menggantinya menyeret owner, admin, akuntan, fakturis, gudang, dan
   digital-marketing ke luar cakupan berkas ini.
2. Oranye hanya muncul di permukaan komersial dan tidak pernah bersebelahan dengan bidang
   abu besar dalam satu viewport, jadi bentrokan yang dikhawatirkan tidak pernah terjadi.

Kalau suatu saat netral hangat memang mau diambil, itu pekerjaan seluruh aplikasi dan
perlu keputusan tersendiri — bukan sapuan diam-diam di portal.

### Status — lima tone, bukan sembilan hue dekoratif

`StatusTone` di `lib/ui-labels.ts:65`: `neutral` · `brand` · `success` (emerald) ·
`warning` (amber) · `danger` (rose). `Badge` dan `StatCard` keduanya memetakan dari sini.

**Status selalu membawa teks.** Warna tidak pernah jadi satu-satunya penanda —
`Badge.tsx` benar soal ini, dan `StatCard` menambahkan padanan `sr-only` untuk batang
tone-nya.

### Mode gelap

Tidak ada, dan itu disengaja. `:root` mengunci `color-scheme: light` karena setiap
komponen hardcode permukaan putih. Nol class `dark:` di seluruh repo. Jangan tambahkan
satu halaman saja — itu menghasilkan portal yang setengah gelap.

---

## Tipografi

Satu huruf: **Plus Jakarta Sans** via `next/font/google`, `variable: --font-app-sans`
(`app/layout.tsx:6-10`). Montserrat dihapus — ia webfont kedua yang diunduh dengan tiga
bobot untuk satu wordmark 11 karakter.

`font-variant-numeric: tabular-nums` berlaku global di `body`. Setiap layar penting
berpusat pada angka Rupiah, dan tabel aging dipindai vertikal untuk mencari tunggakan
terbesar — angka proporsional membuat tugas itu jadi membaca, bukan melirik.

### Empat peran, tidak lebih

Didefinisikan sebagai `@utility` di `app/globals.css:83-115`.

| Peran | Nilai | Untuk apa | Kuota per layar |
|---|---|---|---|
| `type-display` | `text-2xl` / 1.1 / 700 / −0.02em | angka Rupiah yang menentukan tindakan berikutnya | **tepat satu** — dan ada layar yang memang nol |
| `type-title` | `text-base` / 1.35 / 600 / −0.01em | judul kartu dan seksi | bebas, lewat `<CardHeader>` |
| `type-body` | `text-sm` / 1.55 / 400 | teks berjalan, deskripsi, sel meta | bebas |
| `type-label` | `0.6875rem` / 1.2 / 600 / 0.08em / uppercase | micro-label di atas sebuah nilai | satu nilai tracking, bukan enam |

Peran ini ada karena sebelumnya 81% tipe adalah `text-xs`/`text-sm` dan 76% bobot adalah
`font-semibold` — tiga perempat teks pada bidang yang sama, jadi bobot tidak membawa
hierarki apa pun.

### Cara menerapkannya di halaman

- Tandai **satu** angka penentu tindakan per layar dengan `<StatCard lead>`. Ia yang dapat
  `type-display`. Baris KPI empat kartu berbobot sama berkata keempatnya sama penting, dan
  itu tidak pernah benar.
- Judul kartu selalu lewat `<CardHeader title=… description=… />`, jangan `<h2>` mentah.
- Teks apa pun yang **bukan** judul dan **bukan** micro-label turun ke `type-body`. Kalau
  ia perlu sedikit lebih menonjol, naikkan bobot ke `font-medium` — bukan ukurannya.
- `font-semibold` dipakai hanya untuk judul, label tombol, dan label uppercase.
- Label field form adalah pengecualian: sentence case `text-sm font-medium`, bukan
  `type-label` yang uppercase (`FormInput.tsx:27`).

---

## Ruang dan radius

Skala 4pt bawaan Tailwind, tanpa token khusus. Yang dikunci adalah ritmenya:

- `<main>` shell: `space-y-4` — satu-satunya ritme seksi.
- Padding kartu: `p-4 sm:p-5`.
- Grid di dalam kartu: `gap-3`.
- Padding halaman: `px-4 md:px-6`, dan `pb-tabbar-gap` di mobile.

Dua token spacing khusus, dan keduanya wajib:

```css
--spacing-safe-b:    max(0.5rem, env(safe-area-inset-bottom));
--spacing-tabbar-gap: calc(3.5rem + max(0.5rem, env(safe-area-inset-bottom)));
```

Dipakai sebagai `pb-tabbar-gap`, `pb-safe-b`, `bottom-tabbar-gap`. Tanpa
`viewportFit: "cover"` di `app/layout.tsx` nilai `env()` selalu 0 dan bottom tab bar
tertutup home indicator iOS.

### Radius berjenjang, bukan lima nilai acak

```
kontainer  rounded-2xl   Card, StatCard, panel, header hero
elemen     rounded-xl    tile di dalam kartu, chip avatar
kontrol    rounded-lg    Button, input, select, link nav
penanda    rounded-md    Badge — penanda sebaris, paling rapat
lingkaran  rounded-full  hanya avatar dan hitungan angka
```

Badge sengaja **bukan** pil. Pil adalah bentuk badge paling generik yang ada, dan di sini
ia juga menabrak jenjang di atas.

### Kedalaman: garis + permukaan, tanpa bayangan

Satu model, bukan tiga sekaligus. Kartu dibedakan oleh `border border-slate-200` di atas
`bg-white`. Sebelumnya ruang + garis + `shadow-sm` dipakai bersamaan di setiap kartu, jadi
tidak ada yang membedakan apa pun — kalau semua mengambang 1px, tidak ada yang mengambang.

Bayangan disimpan untuk yang benar-benar di atas halaman: `Modal`, bar lengket, toast.

Nesting kartu maksimal **dua tingkat**: `Card` (`rounded-2xl` putih) memuat tile
`rounded-xl` bertinta (`bg-brand-50`, `bg-amber-50`, `bg-slate-50`). Tiga tingkat dengan
netral yang sama di ketiganya tidak memberi mata isyarat kedalaman apa pun.

---

## Motion

Tidak ada pustaka motion, dan tidak akan ditambahkan. Tiga primitif saja:

- `transition` pada warna latar/teks, `duration-150`.
- `active:translate-y-px` sebagai umpan balik tekan — di layar sentuh hover tidak pernah
  terjadi, jadi tanpa ini tombol tidak pernah memberi tahu bahwa ia ditekan.
- `.hover-lift` di-nolkan di bawah `@media (hover: none)`. Hover melekat di layar sentuh;
  jangan pernah menyandarkan makna padanya.

`prefers-reduced-motion: reduce` sudah dinolkan global di `globals.css:129-137`.

Yang tidak dianimasikan: cincin fokus (harus muncul seketika), properti layout (hanya
`transform` dan `opacity`).

---

## Fokus dan target sentuh

Cincin fokus dasar berlaku untuk seluruh aplikasi:

```css
:focus-visible { outline: 2px solid var(--color-brand-700); outline-offset: 2px; }
```

Komponen yang menetapkan `focus-visible:outline-*` sendiri tetap menang.

**Lantai sentuh 44px** (`min-h-11`) di layar kecil, dipadatkan ke `md:min-h-10` begitu ada
pointer presisi. Berlaku untuk tombol, input, select, dan link nav. Kedua shell juga
menyediakan skip link `#konten-utama` — dengan header lengket, nav, dan kartu filter
sebelum konten, pengguna papan ketik menekan Tab belasan kali tanpanya.

---

## Responsif

Setiap layar wajib benar di **320 / 375 / 414 / 768 / 1280 px**.

- `html, body { overflow-x: clip }` di `globals.css` adalah jaring pengaman, bukan izin
  untuk menaruh konten yang meluber. `clip`, bukan `hidden` — `hidden` pada root mematikan
  `position: sticky`, dan header portal toko lengket.
- Tabel tidak pernah menggulir horizontal: `ResponsiveTable` memproyeksikannya jadi kartu
  **di bawah `lg`**, bukan `md` — di 768px tabel tujuh kolom hanya menyisakan ~110px per
  kolom, jadi nomor dokumen membungkus tiga baris dan barisnya tidak bisa dipindai. Tabel buatan tangan tidak diperbolehkan, termasuk di dalam modal —
  modal jadi bottom sheet di bawah `sm`, dan tabel enam kolom di 360px berarti kolom
  terakhirnya tidak pernah terjangkau.
- Teks tombol tidak boleh membungkus jadi dua baris.
- Kolom grid yang memuat gambar memakai `minmax(0, 1fr)`, bukan `1fr` telanjang.
- **Nilai jangan pernah dipotong diam-diam.** Kartu ber-`overflow-hidden` tidak memberi
  tanda apa pun saat angka terpenggal — "Rp 106.730.166" terbaca "Rp 106.730.1". Kalau
  nilai bisa panjang, beri ruang (kartu `lead` selalu dua kolom) atau turunkan ukurannya;
  `truncate` hanya untuk teks yang boleh hilang, tidak untuk nomor referensi atau Rupiah.
- **Kartu berisi sedikit jangan diregangkan** setinggi tetangganya: `items-start` pada
  grid dua kolom. Ruang putih 700px bukan hierarki.

---

## Suara CTA

Lima varian di `components/shared/Button.tsx`, dan hanya lima.

| Varian | Rupa | Kapan |
|---|---|---|
| `primary` | `bg-brand-700 text-white` | aksi utama non-uang: simpan, kirim, konfirmasi |
| `commerce` | `bg-accent-500 text-slate-900` | **hanya uang**: tambah ke keranjang, checkout, bayar, ajukan pembayaran, pesan lagi |
| `secondary` | garis `slate-300` di atas putih | aksi pendamping: batal, kembali, unduh |
| `ghost` | tanpa bidang | aksi tersier di dalam baris/kartu |
| `danger` | garis `rose-300`, teks `rose-700` | hapus, batalkan pesanan |

Bentuk: `rounded-lg`, `font-semibold`, `gap-2` untuk ikon+label. Ukuran `sm` dan `md`;
keduanya menghormati lantai sentuh. `href` mengubahnya jadi `<Link>` tanpa mengubah rupa.

Salinan class tombol di halaman tidak diperbolehkan — kalau butuh bentuk tombol pada
elemen lain, pakai `buttonClasses()` yang diekspor dari berkas yang sama.

### Bahasa

Bahasa Indonesia, sentence case. Nol emoji, nol `alert()`, nol `href="#"`.
Enum backend tidak pernah bocor ke layar — lewatkan `toUiLabel()` dari `lib/ui-labels.ts`.
**Pesan galat server juga.** Better Auth menjawab dalam bahasa Inggris; "Invalid email or
password" pernah tampil apa adanya di halaman login. Petakan yang terverifikasi, teruskan
sisanya — pesan tak terduga lebih baik apa adanya daripada diterjemahkan salah.
Jangan sebut jabatan internal ke pelanggan ("Ajukan ke Fakturis"), dan jangan sebut
sesuatu "Invoice" sebelum ia benar-benar menagih.

---

## Primitif — pakai ini, jangan tulis ulang

Semuanya di `components/shared/`. Halaman **tidak** boleh menyalin tanda tangan kartu,
kotak error, tombol, atau kontrol form dengan tangan.

| Primitif | Untuk |
|---|---|
| `Card` + `CardHeader` | setiap permukaan berbingkai |
| `StatCard` + `StatGrid` | baris KPI; tandai tepat satu `lead` |
| `ResponsiveTable` | setiap tabel — satu definisi kolom, dua render |
| `Modal` | setiap dialog; bottom sheet di bawah `sm` |
| `ConfirmDialog` | konfirmasi destruktif |
| `FormInput` + `fieldClasses` | setiap input, select, textarea |
| `Button` + `buttonClasses` | setiap tombol dan link-yang-terlihat-tombol |
| `Badge` | setiap status |
| `PageFeedback` | pesan sukses/gagal tingkat halaman (toast) |
| `InlineAlert` | padanannya di dalam modal |
| `EmptyState` | setiap daftar kosong |
| `Skeleton` + `SkeletonList` | setiap keadaan memuat |
| `QuantityStepper` | setiap kuantitas |
| `PaginationControls`, `SearchCombobox`, `AvatarCropModal` | sesuai namanya |

### Jangan dibongkar

Bagian ini sudah benar dan mahal untuk ditemukan ulang:

- **`ResponsiveTable.tsx:17-34`** — proyeksi kolom berbasis `role`
  (`title`/`status`/`amount`/`meta`/`action`). Satu definisi, dua render. Menggantikan 17
  tabel yang kolom terakhirnya tidak terjangkau di 360px. Hanya satu cabang yang
  ter-mount, lewat `useIsMobile()`.
- **`Modal.tsx`** — bottom sheet di bawah `sm`, focus trap, Esc, kunci gulir, kembalikan
  fokus, footer menghormati safe area.
- **`QuantityStepper.tsx`** — menggantikan `<input type="number">` yang di iOS tidak punya
  spinner sama sekali.
- **`Button.tsx`** varian `commerce` — disiplin warna uang yang dijelaskan di atas.
- **`--spacing-tabbar-gap` + `viewportFit: "cover"`** — bug home indicator iOS yang nyata
  dan sudah dihindari.
- **`lib/format.ts`** — instance `Intl.NumberFormat` di-hoist ke module scope. Jangan
  bikin salinan `formatRupiah` lokal; dulu ada sepuluh.

---

## Yang wajib sama di semua halaman

- Palet dan aturan pemakaiannya, termasuk oranye yang dipesan untuk uang.
- Empat peran tipografi dan kuota satu `type-display` per layar.
- Jenjang radius dan model kedalaman garis+permukaan.
- Suara tombol: bentuk, bobot, varian.
- Ritme seksi `space-y-4` dan padding kartu `p-4 sm:p-5`.
- Lantai sentuh dan cincin fokus.
- Shell portalnya — halaman tidak menggambar navigasinya sendiri.

## Yang boleh berbeda

- Ada/tidaknya baris KPI, dan berapa kolomnya (`StatGrid columns={2|3|4}`).
- Tabel vs daftar kartu vs grid produk, sesuai isi.
- Ada/tidaknya bar filter.
- Sidebar `lg` lewat `TokoFeatureLayout` — hanya untuk layar non-komersial.

---

## Exports

Format siap-pakai untuk memindahkan sistem ini ke proyek lain. Sumbernya tetap
`app/globals.css`; blok di bawah adalah cerminannya.

### Tailwind v4 `@theme` (format asli proyek ini)

```css
@theme {
	--font-sans: var(--font-app-sans), ui-sans-serif, system-ui, sans-serif;

	--color-brand-50: #ecf9fe;  --color-brand-500: #02a4de;
	--color-brand-100: #cff0fc; --color-brand-600: #0291c5;
	--color-brand-200: #9fe1f9; --color-brand-700: #027eac;
	--color-brand-300: #59cef8; --color-brand-800: #03678c;
	--color-brand-400: #0fbbfa; --color-brand-900: #04506c;

	--color-accent-50: #fef6eb;  --color-accent-500: #fd9208;
	--color-accent-100: #fee9cd; --color-accent-600: #d37903;
	--color-accent-200: #fdd7a5; --color-accent-700: #ab6203;
	--color-accent-300: #fcbc69; --color-accent-800: #8b5004;
	--color-accent-400: #fca636; --color-accent-900: #6c3f04;

	--spacing-safe-b: max(0.5rem, env(safe-area-inset-bottom));
	--spacing-tabbar-gap: calc(3.5rem + max(0.5rem, env(safe-area-inset-bottom)));
}
```

### `tokens.css` (CSS polos, tanpa Tailwind)

```css
:root {
	--color-brand-50: #ecf9fe;   --color-brand-500: #02a4de;
	--color-brand-100: #cff0fc;  --color-brand-600: #0291c5;
	--color-brand-200: #9fe1f9;  --color-brand-700: #027eac;
	--color-brand-300: #59cef8;  --color-brand-800: #03678c;
	--color-brand-400: #0fbbfa;  --color-brand-900: #04506c;

	--color-accent-50: #fef6eb;  --color-accent-500: #fd9208;
	--color-accent-100: #fee9cd; --color-accent-600: #d37903;
	--color-accent-200: #fdd7a5; --color-accent-700: #ab6203;
	--color-accent-300: #fcbc69; --color-accent-800: #8b5004;
	--color-accent-400: #fca636; --color-accent-900: #6c3f04;

	--color-paper: #ffffff;
	--color-ink: #171717;
	--color-focus: var(--color-brand-700);

	--font-body: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;

	--radius-container: 1rem;    /* 2xl */
	--radius-element: 0.75rem;   /* xl  */
	--radius-control: 0.5rem;    /* lg  */
	--radius-marker: 0.375rem;   /* md  */

	--dur-short: 150ms;
	--spacing-safe-b: max(0.5rem, env(safe-area-inset-bottom));
	--spacing-tabbar-gap: calc(3.5rem + max(0.5rem, env(safe-area-inset-bottom)));
}
```

### DTCG `tokens.json`

```json
{
  "color": {
    "brand": {
      "600": { "$value": "#0291c5", "$type": "color" },
      "700": { "$value": "#027eac", "$type": "color" },
      "800": { "$value": "#03678c", "$type": "color" }
    },
    "accent": {
      "500": { "$value": "#fd9208", "$type": "color" },
      "700": { "$value": "#ab6203", "$type": "color" }
    },
    "paper": { "$value": "#ffffff", "$type": "color" },
    "ink":   { "$value": "#171717", "$type": "color" }
  },
  "font": {
    "body": { "$value": "Plus Jakarta Sans", "$type": "fontFamily" }
  },
  "radius": {
    "container": { "$value": "1rem",     "$type": "dimension" },
    "element":   { "$value": "0.75rem",  "$type": "dimension" },
    "control":   { "$value": "0.5rem",   "$type": "dimension" },
    "marker":    { "$value": "0.375rem", "$type": "dimension" }
  }
}
```
