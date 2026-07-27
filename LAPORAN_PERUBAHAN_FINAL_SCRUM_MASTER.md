# Laporan Perubahan Final FE_Pridata_Jaya & SMD-Pridata-BE

Dokumen ini merangkum perubahan final yang sudah diterapkan pada project **FE_Pridata_Jaya** yang terintegrasi dengan **SMD-Pridata-BE**. Catatan ini hanya menuliskan kondisi akhir/perubahan yang sudah difinalkan, bukan urutan percobaan awal, agar mudah dibaca oleh Scrum Master.

---

## 1. Dashboard Owner dan Akuntan

### Pada fitur apa yang diubah?

Dashboard analitik Owner dan Akuntan, terutama card:

- Tren Penjualan Bulanan
- Fokus Sales dan Toko Prioritas
- Kesehatan Piutang Jaringan
- Lifecycle Toko per Sales
- Target vs Realisasi Sales
- Tekanan Inventaris
- Kontribusi Kategori Produk
- Performa Brand
- KPI Ringkasan Akuntan

### Sebelum diubah kondisinya gimana?

- Beberapa chart masih terasa seperti menampilkan data mentah, belum sepenuhnya memakai relasi transaksi, invoice, pembayaran, toko, sales, produk, kategori, dan brand.
- Dashboard Akuntan masih terlalu mirip dashboard Owner dan menampilkan card yang tidak semuanya relevan dengan pekerjaan akuntan.
- Card Tren Penjualan Bulanan, Tagihan vs Kas Masuk, dan Prioritas Piutang terasa tumpang tindih serta membingungkan.
- Beberapa dropdown detail tidak konsisten dengan angka chart.
- Lifecycle Toko per Sales tidak konsisten antara toko baru, toko lama, repeat order, dan transaksi pertama.
- Fokus Sales dan Toko Prioritas masih bisa menampilkan toko/sales yang belum punya transaksi.
- Target vs Realisasi Sales masih bisa menunjukkan pencapaian tidak realistis, misalnya sampai sekitar 400%.
- Kata “snapshot” muncul di UI dan dianggap kurang profesional/terlalu teknis.

### Setelah diubah

- Dashboard menggunakan logika berbasis transaksi dan relasi database, bukan sekadar data mentah.
- Dashboard Akuntan difokuskan pada card yang berhubungan langsung dengan keuangan:
  - KPI Ringkasan
  - Tren Penjualan Bulanan
  - Fokus Sales dan Toko Prioritas
  - Kesehatan Piutang Jaringan dan Disiplin Pembayaran Toko
- Perhitungan omzet, pembayaran, dan piutang difokuskan berdasarkan cohort invoice:
  - Invoice Januari tetap dihitung sebagai omzet Januari.
  - Jika dibayar Maret, pembayaran aktual tetap tersimpan sebagai pembayaran Maret di database.
  - Untuk chart tren invoice, pembayaran tersebut tetap dapat dikaitkan ke invoice Januari agar sisa piutang Januari mudah dibaca.
- Lifecycle Toko per Sales diperbaiki agar:
  - Toko baru dihitung dari transaksi pertama.
  - Setelah bulan transaksi pertama, toko tersebut masuk sebagai toko lama pada bulan berikutnya.
  - Repeat order dihitung dari toko lama yang bertransaksi ulang.
  - Detail dropdown mengikuti angka chart.
- Fokus Sales dan Toko Prioritas hanya menampilkan sales/toko yang benar-benar punya transaksi/performa.
- Target vs Realisasi dibuat lebih realistis melalui data seed dan perhitungan target.
- Istilah “snapshot” dihilangkan dari UI.

### FE diubah di bagian apa?

- `FE_Pridata_Jaya/app/(dashboard)/owner/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/akuntan/dashboard-penjualan/page.tsx`
- `FE_Pridata_Jaya/components/dashboard/AdminOwnerAnalyticsView.tsx`
- `FE_Pridata_Jaya/components/dashboard/SalesTrendCard.tsx`
- `FE_Pridata_Jaya/components/dashboard/AccountantFinancialTrendCard.tsx`
- `FE_Pridata_Jaya/components/dashboard/CashInTrendCard.tsx`
- `FE_Pridata_Jaya/components/dashboard/ExecutiveMetricsStrip.tsx`
- `FE_Pridata_Jaya/components/dashboard/ExecutiveTargetActualChartCard.tsx`
- `FE_Pridata_Jaya/components/dashboard/SalesRankingChartCard.tsx`
- `FE_Pridata_Jaya/components/dashboard/ReceivableMonitoringSection.tsx`
- `FE_Pridata_Jaya/components/dashboard/TopCustomerDebtChartCard.tsx`
- `FE_Pridata_Jaya/components/dashboard/chart-utils.ts`
- `FE_Pridata_Jaya/services/dashboard.ts`

### BE diubah di bagian apa?

- `SMD-Pridata-BE/src/controllers/dashboard.controller.ts`
- `SMD-Pridata-BE/src/services/dashboard.service.ts`
- `SMD-Pridata-BE/src/repositories/dashboard.repository.ts`
- `SMD-Pridata-BE/src/routes/dashboard.routes.ts`
- `SMD-Pridata-BE/src/validators/dashboard.validator.ts`

---

## 2. Card Kontribusi Kategori Produk

### Pada fitur apa yang diubah?

Card **Kontribusi Kategori Produk** pada dashboard Owner/Admin.

### Sebelum diubah kondisinya gimana?

- Sub-card awal hanya menampilkan ranking Top 3 kategori.
- Informasi tersebut dirasa mengulang isi tooltip pada treemap.
- Belum menjawab pertanyaan bisnis seperti:
  - Kategori mana yang paling luas menjangkau toko?
  - Kategori mana yang punya peluang cross-sell?
  - Kategori mana yang repeat pembeliannya paling kuat?

### Setelah diubah

Sub-card diganti menjadi insight penetrasi toko per kategori:

1. **Jangkauan Terluas**
   - Menampilkan kategori dengan jumlah toko pembeli unik terbanyak.
   - Menghitung penetrasi terhadap seluruh toko yang bertransaksi dalam periode aktif.
   - Detail menampilkan toko pembeli, sales pengelola, omzet kategori, jumlah invoice, dan transaksi kategori terakhir.

2. **Peluang Cross-sell**
   - Menghitung peluang berdasarkan kontribusi omzet dan toko transaksi yang belum membeli kategori tersebut.
   - Disebut sebagai peluang untuk ditinjau, bukan rekomendasi otomatis.
   - Detail menampilkan calon toko cross-sell, sales pengelola, dan transaksi terakhir toko.

3. **Repeat Terkuat**
   - Toko dianggap repeat jika membeli kategori yang sama pada minimal dua invoice berbeda.
   - Detail menampilkan toko repeat, jumlah invoice, dan transaksi kategori terakhir.

Treemap tetap dipertahankan untuk komposisi omzet kategori.

### FE diubah di bagian apa?

- `FE_Pridata_Jaya/components/dashboard/CategoryTreemapCard.tsx`
- `FE_Pridata_Jaya/services/dashboard.ts`

### BE diubah di bagian apa?

- `SMD-Pridata-BE/src/controllers/dashboard.controller.ts`
- `SMD-Pridata-BE/src/services/dashboard.service.ts`
- `SMD-Pridata-BE/src/repositories/dashboard.repository.ts`
- `SMD-Pridata-BE/src/routes/dashboard.routes.ts`
- `SMD-Pridata-BE/src/validators/dashboard.validator.ts`

---

## 3. Card Performa Brand

### Pada fitur apa yang diubah?

Card **Performa Brand**.

### Sebelum diubah kondisinya gimana?

- Penggunaan card belum cukup jelas apakah laju pertumbuhan dihitung bulanan atau tahunan.
- Ada potensi pembacaan yang kurang konsisten terhadap filter periode.

### Setelah diubah

- Card diposisikan sebagai analisis performa brand berdasarkan filter periode aktif.
- Pertumbuhan brand dibaca berdasarkan perbandingan periode yang relevan terhadap filter dashboard.
- Data brand tetap berasal dari transaksi/invoice item yang terhubung ke produk dan brand, bukan data mentah statis.

### FE diubah di bagian apa?

- `FE_Pridata_Jaya/components/dashboard/BrandPerformanceHeatmapCard.tsx`
- `FE_Pridata_Jaya/services/dashboard.ts`

### BE diubah di bagian apa?

- `SMD-Pridata-BE/src/repositories/dashboard.repository.ts`
- `SMD-Pridata-BE/src/services/dashboard.service.ts`
- `SMD-Pridata-BE/src/controllers/dashboard.controller.ts`

---

## 4. Data Seed Bootstrap Dev

### Pada fitur apa yang diubah?

Seed/bootstrap data development untuk FE dan BE.

### Sebelum diubah kondisinya gimana?

- Data seed belum cukup realistis dan belum merata.
- Beberapa data tidak konsisten secara relasi bisnis:
  - Kelola User tidak menunjukkan akun toko, tetapi Kelola Toko punya akun toko.
  - Target sales tidak realistis dibanding transaksi.
  - Data lifecycle toko tidak merata.
  - Toko/sales/produk/transaksi belum terasa mengalir sesuai alur bisnis.
- Ada potensi data yang terlihat berdiri sendiri, padahal tabel di database saling terhubung lewat foreign key dan primary key.

### Setelah diubah

- Seed dibuat lebih realistis dan lebih bervariasi.
- Data user internal, sales, toko, assignment toko, produk, stok, transaksi, invoice, pembayaran, retur, target sales, dan dashboard dibuat lebih saling terhubung.
- Toko customer tetap punya akun untuk login toko, tetapi tidak diperlakukan sebagai member internal organisasi.
- Data target sales dibuat lebih masuk akal agar realisasi tidak ekstrem.
- Data lifecycle toko dibuat lebih merata antara toko lama, toko baru, dan repeat order.
- Database pernah di-reset dan seed dijalankan satu kali sesuai instruksi user.

### FE diubah di bagian apa?

- Tidak ada seed FE terpisah yang menjadi sumber utama dashboard.
- FE membaca data dari BE/API.
- Penyesuaian tampilan dilakukan di dashboard, members, roles, katalog, dan halaman terkait agar cocok dengan data seed BE.

### BE diubah di bagian apa?

- `SMD-Pridata-BE/src/scripts/bootstrapDevData.ts`
- `SMD-Pridata-BE/package.json`

---

## 5. Members dan Roles Owner

### Pada fitur apa yang diubah?

Fitur **Owner > Members** dan informasi **Roles**.

### Sebelum diubah kondisinya gimana?

- Fitur Members masih menampilkan atau berpotensi mencampur akun toko/customer.
- Role toko bisa terlihat seperti bagian dari member internal.
- Daftar role sempat kosong/kurang informatif.
- Role bisa terlalu banyak, ada duplikasi, dan tampilannya makan ruang.
- Aksi role dan hapus akses belum cukup aman.
- Ada bagian “Undangan Tertunda” yang membingungkan karena belum ada alur user menerima undangan yang jelas dari UI.
- Halaman Roles berdiri sendiri padahal sifatnya hanya read-only untuk membantu Owner menentukan akses member.

### Setelah diubah

- Members hanya untuk akun internal organisasi.
- Akun toko/customer tidak ditampilkan di Members karena toko adalah pihak eksternal/customer.
- Aksi utama di member menjadi **Edit**.
- Perubahan role dilakukan di dalam modal edit untuk mengurangi human error.
- Hapus akses berarti menghapus akses role/member organisasi, bukan menghapus akun login.
- Pending invitation UI dihapus dari tampilan.
- Logic invitation/accept dari BE tetap dipertahankan, tetapi UI difokuskan ke alur Owner mengatur akses internal.
- Informasi roles digabung ke halaman Members sebagai overview read-only.
- Tabel roles dibuat lebih informatif dengan kolom:
  - Role
  - Kegunaan
  - Pengguna
  - Sumber Akses
  - Detail
- Detail role menampilkan akses apa saja yang dimiliki role tersebut.
- Role customer/toko diberi keterangan sebagai akses eksternal dan bukan target undangan member internal.

### FE diubah di bagian apa?

- `FE_Pridata_Jaya/app/(dashboard)/owner/members/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/owner/roles/page.tsx`
- `FE_Pridata_Jaya/components/owner/RoleAccessOverview.tsx`
- `FE_Pridata_Jaya/components/layout/Sidebar.tsx`
- `FE_Pridata_Jaya/services/members.ts`
- `FE_Pridata_Jaya/services/roles.ts`
- `FE_Pridata_Jaya/constants/index.ts`

### BE diubah di bagian apa?

- `SMD-Pridata-BE/src/controllers/member.controller.ts`
- `SMD-Pridata-BE/src/controllers/role.controller.ts`
- `SMD-Pridata-BE/src/routes/member.routes.ts`
- `SMD-Pridata-BE/src/lib/permissions.ts`
- `SMD-Pridata-BE/src/lib/role-names.ts`
- `SMD-Pridata-BE/src/repositories/user.repository.ts`
- `SMD-Pridata-BE/src/validators/index.ts`

---

## 6. Kelola User

### Pada fitur apa yang diubah?

Fitur **Owner > Kelola User**.

### Sebelum diubah kondisinya gimana?

- Pilihan role pada tambah/edit user terlalu banyak dan ada duplikasi.
- Ada ketidaksesuaian antara akun internal dan akun toko.
- Data user belum menampilkan konteks tambahan secara konsisten.

### Setelah diubah

- Opsi role dibuat canonical agar tidak duplikat.
- Akun toko dipisahkan secara konsep dari user internal.
- User repository mendukung data tambahan seperti:
  - organizationRole
  - profile
  - storeName
  - storeVerificationStatus
- Hal ini membantu UI membedakan user internal, sales, dan akun toko/customer.

### FE diubah di bagian apa?

- `FE_Pridata_Jaya/app/(dashboard)/owner/kelola-user/page.tsx`
- `FE_Pridata_Jaya/components/owner/OwnerUserFormModal.tsx`
- `FE_Pridata_Jaya/components/owner/OwnerUserDetailModal.tsx`
- `FE_Pridata_Jaya/constants/index.ts`

### BE diubah di bagian apa?

- `SMD-Pridata-BE/src/repositories/user.repository.ts`
- `SMD-Pridata-BE/src/validators/index.ts`
- `SMD-Pridata-BE/src/lib/role-names.ts`

---

## 7. Kelola Katalog

### Pada fitur apa yang diubah?

Fitur **Owner > Kelola Katalog**, terutama publish katalog agar bisa terlihat oleh toko/sales.

### Sebelum diubah kondisinya gimana?

Saat mengubah status katalog menjadi publish, muncul error:

```text
name: Invalid input: expected string, received undefined
```

Penyebabnya:

- FE mengirim payload katalog seperti `productId`, `marketingName`, `sellingPrice`, `isPublished`.
- BE endpoint `/catalog-products` masih diarahkan ke logic produk mentah yang mengharuskan field `name`.
- BE belum punya model/table `CatalogProduct` khusus, sehingga perlu compatibility layer terhadap schema yang ada.

### Setelah diubah

- Endpoint `/catalog-products` menerima payload katalog.
- Data katalog disimpan secara kompatibel menggunakan:
  - `Product.isPublished`
  - `ProductDetail.description`
  - `ProductDetail.imageList`
  - `ProductDetail.spec.marketingName`
  - `ProductDetail.spec.sellingPrice`
- Endpoint `/products` tetap mempertahankan kontrak produk mentah agar tidak mengganggu fitur lain.
- FE menormalisasi produk menjadi bentuk `catalogProduct` virtual agar Kelola Katalog bisa membaca status publish/draft dengan konsisten.
- Publish/unpublish katalog tidak lagi memunculkan error `name undefined`.

### FE diubah di bagian apa?

- `FE_Pridata_Jaya/app/(dashboard)/owner/kelola-katalog/page.tsx`
- `FE_Pridata_Jaya/services/products.ts`

### BE diubah di bagian apa?

- `SMD-Pridata-BE/src/routes/catalogProduct.routes.ts`
- `SMD-Pridata-BE/src/controllers/product.controller.ts`
- `SMD-Pridata-BE/src/validators/index.ts`

---

## 8. Tombol/Fitur Refresh Manual

### Pada fitur apa yang diubah?

Semua tombol refresh manual di berbagai role.

### Sebelum diubah kondisinya gimana?

- Banyak halaman memiliki tombol refresh/manual reload.
- Tombol tersebut dinilai tidak perlu dan memakan ruang.
- Beberapa halaman sudah otomatis load data saat dibuka atau setelah action simpan/edit.

### Setelah diubah

- Tombol refresh manual dihapus dari semua role:
  - Owner
  - Akuntan
  - Gudang
  - Fakturis
  - Sales
  - Toko
- Fungsi refresh internal yang memang diperlukan setelah aksi penting tetap dipertahankan, misalnya reload data setelah confirm/cancel reconciliation.

### FE diubah di bagian apa?

Beberapa halaman yang dibersihkan dari refresh manual:

- `FE_Pridata_Jaya/app/(dashboard)/owner/kelola-toko/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/owner/kelola-katalog/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/owner/kelola-user/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/owner/members/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/akuntan/export-logs/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/akuntan/reports/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/akuntan/payment-requests/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/akuntan/store-credits/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/gudang/*`
- `FE_Pridata_Jaya/app/(dashboard)/fakturis/*`
- `FE_Pridata_Jaya/app/(dashboard)/sales/*`
- `FE_Pridata_Jaya/app/(dashboard)/toko/*`
- `FE_Pridata_Jaya/components/grade/StoreGradeWorkspace.tsx`
- `FE_Pridata_Jaya/components/grade/StoreGradeTransactionPage.tsx`
- `FE_Pridata_Jaya/components/toko/TokoTransactionHistoryWorkspace.tsx`
- `FE_Pridata_Jaya/components/owner/RoleAccessOverview.tsx`

### BE diubah di bagian apa?

- Tidak ada perubahan BE untuk penghapusan tombol refresh.

---

## 9. Grade Toko dan Riwayat Transaksi

### Pada fitur apa yang diubah?

Halaman grade toko dan transaksi toko/sales.

### Sebelum diubah kondisinya gimana?

- Beberapa halaman grade/riwayat masih punya refresh manual.
- Beberapa tampilan transaksi perlu tetap sinkron dengan data order, invoice, delivery order, dan payment.

### Setelah diubah

- Refresh manual dihapus.
- Data tetap dimuat otomatis.
- Status transaksi ditampilkan berdasarkan gabungan order, invoice, delivery order, dan pembayaran.

### FE diubah di bagian apa?

- `FE_Pridata_Jaya/app/(dashboard)/grade-toko/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/owner/grade-toko/page.tsx`
- `FE_Pridata_Jaya/app/(dashboard)/sales/grade-toko/page.tsx`
- `FE_Pridata_Jaya/components/grade/StoreGradeWorkspace.tsx`
- `FE_Pridata_Jaya/components/grade/StoreGradeTransactionPage.tsx`
- `FE_Pridata_Jaya/components/toko/TokoTransactionHistoryWorkspace.tsx`

### BE diubah di bagian apa?

- Tidak ada perubahan BE khusus pada tahap penghapusan refresh.
- Data grade tetap menggunakan endpoint/service yang sudah ada.

---

## 10. Sales Managed Stores / Pendaftaran Toko oleh Sales

### Pada fitur apa yang diubah?

Alur sales mendaftarkan toko baru.

### Sebelum diubah kondisinya gimana?

- Beberapa test/kontrak lama masih menganggap alur owner account untuk toko belum diimplementasi.
- Payload FE membutuhkan data legalitas seperti NIK owner, tetapi test lama belum menyesuaikan.

### Setelah diubah

- Sales dapat mendaftarkan toko dengan payload FE.
- BE membuat akun owner toko melalui Better Auth.
- Toko dibuat dengan status:
  - `PENDING`
  - `isActive: false`
- Toko otomatis di-assign ke sales yang mendaftarkan.
- Verifikasi tetap diperlukan sebelum toko aktif.

### FE diubah di bagian apa?

- `FE_Pridata_Jaya/app/(dashboard)/sales/toko-kelolaan/page.tsx`
- `FE_Pridata_Jaya/services/sales.ts`

### BE diubah di bagian apa?

- `SMD-Pridata-BE/src/services/store.service.ts`
- `SMD-Pridata-BE/src/routes/salesCompat.routes.ts`
- `SMD-Pridata-BE/src/validators/salesCompat.validator.ts`

---

## 11. Testing dan Validasi Project

### Pada fitur apa yang diubah?

Test suite dan validasi project.

### Sebelum diubah kondisinya gimana?

- Beberapa test gagal karena belum mengikuti perubahan fitur terbaru.
- Beberapa unit test gagal karena tidak mock dependency ESM Better Auth.
- Test roles, members, user repository, dashboard, sales compat, dan product controller masih mengacu kontrak lama.

### Setelah diubah

- Test disesuaikan dengan kontrak final.
- Mock Better Auth ditambahkan di unit test yang membutuhkan.
- Test katalog, dashboard, members, roles, user repository, sales compat, store controller, dan me controller sudah sesuai kondisi final.

### FE diubah di bagian apa?

- Tidak ada test FE khusus yang diubah.
- Validasi FE dilakukan melalui:
  - TypeScript
  - ESLint
  - Production build

### BE diubah di bagian apa?

- `SMD-Pridata-BE/src/__tests__/integration/dashboard.integration.test.ts`
- `SMD-Pridata-BE/src/__tests__/integration/feCompat.smoke.test.ts`
- `SMD-Pridata-BE/src/__tests__/integration/salesCompat.routes.test.ts`
- `SMD-Pridata-BE/src/__tests__/unit/member.controller.test.ts`
- `SMD-Pridata-BE/src/__tests__/unit/user.repository.test.ts`
- `SMD-Pridata-BE/src/__tests__/unit/store.service.test.ts`
- `SMD-Pridata-BE/src/__tests__/unit/store.controller.test.ts`
- `SMD-Pridata-BE/src/__tests__/unit/store.controller.edge.test.ts`
- `SMD-Pridata-BE/src/__tests__/unit/me.controller.test.ts`
- `SMD-Pridata-BE/src/__tests__/unit/role.controller.test.ts`
- `SMD-Pridata-BE/src/__tests__/unit/ownerCompat.controller.test.ts`

---

## 12. Hasil Validasi Akhir

Validasi terakhir yang sudah dijalankan:

### FE

- `npx tsc --noEmit` — lolos
- `npx eslint .` — lolos
- `npm run build` — lolos

### BE

- `npm run build` — lolos
- `npx jest --runInBand --silent` — lolos

Hasil test BE:

- 136 test suites passed
- 1.734 tests passed
- 0 failed

---

## Ringkasan Utama untuk Scrum Master

Secara garis besar, perubahan final berfokus pada:

1. Membuat dashboard Owner dan Akuntan lebih berbasis logika bisnis/transaksi.
2. Memperbaiki inkonsistensi data lifecycle toko, sales priority, piutang, pembayaran, dan target sales.
3. Mengubah card kategori menjadi insight penetrasi toko dan peluang cross-sell.
4. Members hanya untuk internal, sedangkan toko/customer dipisahkan sebagai pihak eksternal.
5. Roles digabung sebagai informasi read-only di halaman Members.
6. Menghapus tombol refresh manual di seluruh role.
7. Memperbaiki bug publish Kelola Katalog.
8. Menyesuaikan seed agar data lebih realistis dan saling terhubung.
9. Menyesuaikan test suite agar sesuai kontrak final.

