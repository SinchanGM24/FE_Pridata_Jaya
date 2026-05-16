# FE1 to FE2 Frontend Alignment Plan

Dokumen ini dipakai untuk menyelaraskan FE2 dengan pola frontend FE1, sambil tetap mempertahankan struktur data, validasi, dan keamanan dari BE2.

## Tujuan Utama

1. Menjadikan FE2 terasa seringan dan serapi FE1 dari sisi display dan flow.
2. Tetap memakai API BE2 sebagai source of truth.
3. Menghindari request berat yang tidak perlu di halaman awal.
4. Menjaga semua batasan backend BE2 seperti `limit <= 100`.

## Prinsip Implementasi

1. Halaman utama hanya memuat data inti yang benar-benar dibutuhkan untuk render awal.
2. Detail, histori, dan data besar dimuat saat user membuka modal atau aksi tertentu.
3. Jika dataset bisa lebih dari 100, frontend wajib ambil bertahap per page, bukan menaikkan limit.
4. FE2 boleh meniru pola FE1 untuk UX, filter, urutan tampilan, dan flow interaksi.
5. Logic bisnis tetap mengikuti BE2, bukan memaksakan model data BE1.

## Helper yang Sudah Disiapkan

File pendukung yang sudah dibuat untuk pola fetch bertahap:

- [services/pagination.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/pagination.ts:1)
- [services/stock-adjustments.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/stock-adjustments.ts:1)
- [services/warehouse-inventory.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/warehouse-inventory.ts:1)
- [services/receivable.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/receivable.ts:1)
- [services/products.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/products.ts:1)
- [services/warehouses.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/warehouses.ts:1)

Catatan:

- Gunakan `listAll()` hanya jika data memang perlu dikumpulkan penuh.
- Kalau cukup untuk daftar ringkas atau halaman tabel, prioritaskan `list()` plus pagination UI.

## Status Pekerjaan Saat Ini

### Sudah Disesuaikan

Status legend:

- `DONE` = sudah dieksekusi di kode
- `TODO` = belum dikerjakan

1. `DONE` `Gudang > Stok Barang`
   - Sudah diubah ke pola FE1.
   - Load awal hanya inventory dan daftar gudang.
   - Histori stok diambil saat modal dibuka, bukan di-load massal di awal.
   - File: [app/(dashboard)/gudang/stok-gudang/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/stok-gudang/page.tsx:1)

2. `DONE` `Gudang > Penerimaan Barang`
   - Error `limit must not exceed 100` sudah diperbaiki.
   - Header action sudah lebih dekat ke FE1.
   - File: [app/(dashboard)/gudang/penerimaan-barang/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/penerimaan-barang/page.tsx:1)

3. `DONE` `Gudang > Input Penerimaan Barang`
   - Dropdown gudang dan produk sudah pakai fetch bertahap.
   - Tidak lagi memakai `limit: 200`.
   - File: [app/(dashboard)/gudang/penerimaan-barang/input/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/penerimaan-barang/input/page.tsx:1)

4. `DONE` `Gudang > Retur Barang`
   - Error limit untuk data retur sudah diperbaiki.
   - File: [app/(dashboard)/gudang/retur-barang/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/retur-barang/page.tsx:1)

5. `DONE` `Gudang > Barang Rusak`
   - Sudah diubah ke monitor otomatis, bukan form manual utama.
   - Sumber dibedakan antara `Penerimaan Barang` dan `Retur Barang`.
   - File:
     - [app/(dashboard)/gudang/barang-rusak/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/barang-rusak/page.tsx:1)
     - [services/damaged-goods.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/damaged-goods.ts:1)

6. `DONE` `Sales > Aging Piutang`
   - Sudah diperbaiki agar mengikuti pola FE1.
   - Data di-scope ke sales dan dihitung ulang untuk display aging/risk.
   - File: [app/(dashboard)/sales/aging-piutang/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/aging-piutang/page.tsx:1)

## Area Lanjutan yang Disarankan

### Prioritas Tinggi

1. `DONE` `Gudang > Pengiriman`
   - Sudah diubah agar tidak melakukan N+1 `getByInvoiceId` per invoice.
   - Mapping delivery order sekarang dibentuk dari hasil list delivery order yang sudah dimuat sekali.
   - Service paginated juga sudah disiapkan untuk skenario data lebih dari 100.
   - File:
     - [app/(dashboard)/gudang/pengiriman/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/pengiriman/page.tsx:1)
     - [services/delivery-orders.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/delivery-orders.ts:1)
     - [services/invoices.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/invoices.ts:1)

2. `DONE` `Gudang > Transfer Gudang`
   - Load awal sekarang difokuskan ke transfer dan gudang.
   - Inventory baru dimuat saat modal create transfer dibuka.
   - Kota baru dimuat saat modal tambah gudang dibuka.
   - Service paginated juga sudah disiapkan untuk transfer jika data lebih dari 100.
   - File:
     - [app/(dashboard)/gudang/transfer-gudang/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/transfer-gudang/page.tsx:1)
     - [services/warehouse-transfers.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/warehouse-transfers.ts:1)

3. `DONE` `Sales > Riwayat Transaksi`
   - Order dan invoice tidak lagi dimuat bersamaan saat initial load.
   - Tab aktif dimuat lebih dulu, tab lain baru dimuat saat user berpindah tab atau refresh tab tersebut.
   - Berlaku untuk halaman sales utama dan halaman toko-kelolaan per store.
   - File:
     - [app/(dashboard)/sales/riwayat-transaksi/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/riwayat-transaksi/page.tsx:1)
     - [app/(dashboard)/sales/toko-kelolaan/[storeId]/riwayat-transaksi/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/toko-kelolaan/[storeId]/riwayat-transaksi/page.tsx:1)

4. `DONE` `Akuntan > Dashboard Penjualan`
   - Summary dipisah dari tabel.
   - Ringkasan memakai endpoint dashboard yang lebih ringan, tabel invoice tetap memakai report paginated.
   - Filter tetap dipakai bersama agar angka summary, tabel, dan export tetap konsisten.
   - File:
     - [app/(dashboard)/akuntan/dashboard-penjualan/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/akuntan/dashboard-penjualan/page.tsx:1)
     - [services/dashboard.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/dashboard.ts:1)

### Prioritas Menengah

1. `DONE` `Owner > Kelola Katalog`
   - Load awal difokuskan ke produk dan inventory yang memang dipakai tabel utama.
   - Division dan subdivision dipindahkan ke lazy load saat modal form dibuka.
   - Service master data juga sudah aman untuk data lebih dari 100 lewat helper paginated.
   - File:
     - [app/(dashboard)/owner/kelola-katalog/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/owner/kelola-katalog/page.tsx:1)
     - [services/divisions.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/divisions.ts:1)
     - [services/subdivisions.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/subdivisions.ts:1)

2. `DONE` `Gudang > Kelola Item`
   - Load awal sekarang fokus ke daftar item gudang.
   - Kategori, brand, divisi, dan subdivisi dipindahkan ke lazy load saat modal form dibuka.
   - Refetch master reference setelah create juga sudah aman untuk data lebih dari 100.
   - File:
     - [app/(dashboard)/gudang/kelola-item/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/kelola-item/page.tsx:1)
     - [services/category.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/category.ts:1)
     - [services/brand.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/brand.ts:1)

3. `DONE` `Toko/Sales > Katalog / Purchase Order`
   - Katalog toko dan sales sekarang mengambil produk publish secara paginated penuh, tidak berhenti di 100 item pertama.
   - Master gudang di halaman purchase order dipindahkan ke lazy load saat checkout memang dibutuhkan.
   - Empty state katalog juga diperjelas saat hasil pencarian kosong.
   - File:
     - [app/(dashboard)/toko/katalog/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/toko/katalog/page.tsx:1)
     - [app/(dashboard)/toko/purchase-order/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/toko/purchase-order/page.tsx:1)
     - [app/(dashboard)/sales/toko-kelolaan/[storeId]/katalog/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/toko-kelolaan/[storeId]/katalog/page.tsx:1)
     - [app/(dashboard)/sales/toko-kelolaan/[storeId]/purchase-order/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/toko-kelolaan/[storeId]/purchase-order/page.tsx:1)
     - [services/catalog-products.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/catalog-products.ts:1)

## Pola Review Halaman Berikutnya

Untuk setiap halaman FE2 yang ingin diselaraskan ke FE1, gunakan urutan kerja ini:

1. Buka halaman FE1 yang setara.
2. Catat:
   - data apa saja yang dimuat saat initial load
   - data mana yang baru dipanggil saat modal/detail
   - susunan filter
   - susunan tombol aksi
   - bentuk tabel
3. Buka halaman FE2.
4. Tandai perbedaan:
   - terlalu banyak fetch awal
   - limit melebihi 100
   - tabel terlalu berat
   - tombol tidak sejalan dengan FE1
   - detail/histori belum lazy load
5. Refactor FE2 tanpa mengubah kontrak bisnis BE2.

## Checklist Teknis Saat Melanjutkan

Setelah mengubah satu halaman:

1. Jalankan lint untuk file yang disentuh.
2. Jalankan build FE2.
3. Pastikan tidak ada request dengan `limit > 100`.
4. Pastikan halaman tetap jalan jika data kosong.
5. Pastikan error message user-friendly.

Contoh command:

```powershell
npm run lint -- app/'(dashboard)'/gudang/stok-gudang/page.tsx
npm run build
```

## Red Flags yang Harus Dihindari

1. Mengambil semua histori global di load awal halaman.
2. Mengambil beberapa resource besar sekaligus padahal hanya satu tab yang aktif.
3. Menggunakan `limit` di atas `100`.
4. Mengandalkan fallback FE1 lama yang tidak cocok dengan model data BE2.
5. Menambah kompleksitas UI FE2 tanpa manfaat nyata untuk user.

## Strategi Akhir yang Direkomendasikan

Strategi terbaik bukan menyalin FE1 mentah-mentah, tetapi:

1. pakai FE1 sebagai referensi UX dan efisiensi fetch
2. pakai BE2 sebagai referensi business rule dan keamanan data
3. bentuk FE2 sebagai gabungan:
   - FE1 untuk rasa penggunaan
   - BE2 untuk integritas sistem

## Catatan Lanjutan

Jika nanti melanjutkan sendiri, mulai dari halaman yang:

1. paling sering dipakai user
2. paling banyak error validasi `limit`
3. paling terasa lambat di load awal

Urutan saran:

1. `owner/kelola-katalog`
2. `gudang/kelola-item`
3. `toko/sales katalog atau purchase-order`

## Audit Lanjutan FE1 -> FE2

Audit lanjutan difokuskan pada kesinambungan flow antar role FE1:
`Owner -> Sales/Toko -> Fakturis -> Gudang -> Akuntan`

### Sudah Diamankan

1. Registrasi toko dan master gudang tidak lagi terpotong 100 kota pertama.
   - File:
     - [services/cities.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/cities.ts:1)
     - [app/(dashboard)/sales/toko-kelolaan/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/toko-kelolaan/page.tsx:1)
     - [app/(dashboard)/owner/kelola-toko/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/owner/kelola-toko/page.tsx:1)
     - [app/(dashboard)/owner/master-data/warehouses/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/owner/master-data/warehouses/page.tsx:1)
     - [app/(dashboard)/gudang/transfer-gudang/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/transfer-gudang/page.tsx:1)

2. Flow toko/sales untuk invoice, tagihan, riwayat, dan retur tidak lagi berhenti di page pertama data.
   - File:
     - [services/orders.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/orders.ts:1)
     - [services/invoices.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/invoices.ts:1)
     - [services/payments.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/payments.ts:1)
     - [services/receivable.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/receivable.ts:1)
     - [components/toko/TokoReturnsWorkspace.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/components/toko/TokoReturnsWorkspace.tsx:1)
     - [app/(dashboard)/toko/invoice-cash/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/toko/invoice-cash/page.tsx:1)
     - [app/(dashboard)/toko/riwayat-transaksi/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/toko/riwayat-transaksi/page.tsx:1)
     - [app/(dashboard)/toko/hutang-toko/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/toko/hutang-toko/page.tsx:1)
     - [app/(dashboard)/sales/toko-kelolaan/[storeId]/invoice-cash/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/toko-kelolaan/[storeId]/invoice-cash/page.tsx:1)
     - [app/(dashboard)/sales/toko-kelolaan/[storeId]/riwayat-transaksi/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/toko-kelolaan/[storeId]/riwayat-transaksi/page.tsx:1)
     - [app/(dashboard)/sales/toko-kelolaan/[storeId]/hutang-toko/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/toko-kelolaan/[storeId]/hutang-toko/page.tsx:1)

3. Menu akuntan sekarang langsung menunjuk ke route utama `invoice-pembayaran`, bukan alias lama yang membingungkan.
   - File:
     - [components/layout/Sidebar.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/components/layout/Sidebar.tsx:1)

4. Master data owner dan dashboard internal yang paling sering dipakai sudah ditarik ke data penuh, bukan lagi first-page summary.
   - File:
     - [app/(dashboard)/owner/master-data/divisions/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/owner/master-data/divisions/page.tsx:1)
     - [app/(dashboard)/owner/master-data/subdivisions/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/owner/master-data/subdivisions/page.tsx:1)
     - [app/(dashboard)/owner/kelola-user/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/owner/kelola-user/page.tsx:1)
     - [app/(dashboard)/gudang/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/page.tsx:1)
     - [app/(dashboard)/fakturis/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/fakturis/page.tsx:1)
     - [services/users.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/users.ts:1)
     - [services/invoice-drafts.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/invoice-drafts.ts:1)
     - [services/orders.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/orders.ts:1)

5. Batch lint lintas role prioritas sudah dibereskan untuk area yang paling mempengaruhi alur antar role.
   - `accountant/aging` tidak lagi memakai `any` dan loader/error awal sudah aman dari `set-state-in-effect`.
   - `akuntan/export-logs` sekarang aman untuk filter, pagination, refresh, dan error handling tanpa pola effect yang rapuh.
   - `fakturis/verifikasi-pelanggan` sudah dibersihkan dari `any` dan initial fetch sekarang mengikuti pola async yang aman.
   - `gudang/reconciliation/*` sudah diamankan termasuk halaman list, detail, warehouse page, dan komponen snapshot/sessions.
   - `owner/master-data/categories` serta `admin/master-data/categories|brands|products` sudah bebas lint untuk batch ini.
   - File:
     - [app/(dashboard)/accountant/aging/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/accountant/aging/page.tsx:1)
     - [app/(dashboard)/akuntan/export-logs/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/akuntan/export-logs/page.tsx:1)
     - [app/(dashboard)/fakturis/verifikasi-pelanggan/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/fakturis/verifikasi-pelanggan/page.tsx:1)
     - [app/(dashboard)/gudang/reconciliation/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/reconciliation/page.tsx:1)
     - [app/(dashboard)/gudang/reconciliation/[sessionId]/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/reconciliation/[sessionId]/page.tsx:1)
     - [app/(dashboard)/gudang/reconciliation/warehouse/[warehouseId]/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/gudang/reconciliation/warehouse/[warehouseId]/page.tsx:1)
     - [components/gudang/ReconciliationSnapshotEditor.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/components/gudang/ReconciliationSnapshotEditor.tsx:1)
     - [components/gudang/ReconciliationSessionsList.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/components/gudang/ReconciliationSessionsList.tsx:1)
     - [app/(dashboard)/owner/master-data/categories/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/owner/master-data/categories/page.tsx:1)
     - [app/(dashboard)/admin/master-data/categories/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/admin/master-data/categories/page.tsx:1)
     - [app/(dashboard)/admin/master-data/brands/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/admin/master-data/brands/page.tsx:1)
     - [app/(dashboard)/admin/master-data/products/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/admin/master-data/products/page.tsx:1)

6. Flow profil toko dan sales-mewakili-toko sekarang sudah aman dari error route serta sudah punya jalur edit self-service yang sesuai model data `BE2`.
   - Profil saat sales masuk sebagai perwakilan toko tidak lagi melempar error route.
   - Riwayat toko sudah disederhanakan menjadi satu workspace `Riwayat Transaksi` dengan label status Bahasa Indonesia.
   - Edit profil toko sekarang memakai `PATCH /me/profile` dengan payload `store`, jadi tidak lagi bergantung ke endpoint `PUT /stores/:id` yang aksesnya terbatas untuk role internal tertentu.
   - Response `me/profile` juga sudah diperkaya dengan detail toko yang memang dibutuhkan UI: alamat, kota, sales penanggung jawab, tipe toko, dan kredit limit.
   - File:
     - [app/(dashboard)/sales/toko-kelolaan/[storeId]/profile/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/toko-kelolaan/[storeId]/profile/page.tsx:1)
     - [app/(dashboard)/toko/profile/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/toko/profile/page.tsx:1)
     - [app/(dashboard)/toko/riwayat-transaksi/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/toko/riwayat-transaksi/page.tsx:1)
     - [app/(dashboard)/sales/toko-kelolaan/[storeId]/riwayat-transaksi/page.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/app/(dashboard)/sales/toko-kelolaan/[storeId]/riwayat-transaksi/page.tsx:1)
     - [components/toko/TokoTransactionHistoryWorkspace.tsx](/d:/Data%20Pridata%20Jaya/test3/FE2/components/toko/TokoTransactionHistoryWorkspace.tsx:1)
     - [services/me.ts](/d:/Data%20Pridata%20Jaya/test3/FE2/services/me.ts:1)
     - [BE2/src/services/me.service.ts](/d:/Data%20Pridata%20Jaya/test3/BE2/src/services/me.service.ts:1)
     - [BE2/src/validators/me.validator.ts](/d:/Data%20Pridata%20Jaya/test3/BE2/src/validators/me.validator.ts:1)

### Gap Yang Masih Perlu Dilanjutkan

1. Backlog lint FE2 untuk area dashboard/profile/shared component yang sempat tersisa sudah dibereskan.
   - `app/(dashboard)/accountant/page.tsx`
   - `app/(dashboard)/admin/page.tsx`
   - `app/(dashboard)/owner/kelola-toko/page.tsx`
   - `app/(dashboard)/owner/master-data/brands/page.tsx`
   - `app/(dashboard)/profile/page.tsx`
   - `components/fakturis/InvoiceDraftFormModal.tsx`
   - `components/owner/DashboardLowStockCard.tsx`
   - `components/owner/DashboardSalesChartCard.tsx`
   - `components/owner/DashboardTopProductsCard.tsx`
   - `components/shared/DataTable.tsx`
   - `components/admin/AdminRecentActivity.tsx`
   - `services/audit.ts`
   - `services/user.ts`

2. Masih ada backlog lint FE2 global, terutama:
   - `react-hooks/set-state-in-effect`
   - `@typescript-eslint/no-explicit-any`
   - render impure seperti `Math.random()` di render tree

3. Build FE2 sudah lolos, tetapi lint penuh belum bersih, jadi masih ada halaman yang rapuh walaupun tidak gagal compile.
   - Sebelum audit lanjutan: `76 problems`
   - Setelah batch audit saat ini: `58 problems`
   - Setelah batch prioritas lintas role terbaru: `32 problems`
   - Setelah penyapuan dashboard/shared lanjutan: `0 problems`

4. Area data yang tetap perlu dipantau untuk skenario dataset besar walaupun batch lint sudah lebih rapi:
   - `owner/master-data/divisions`
   - `owner/master-data/subdivisions`
   - `owner/kelola-user`
   - `gudang/dashboard`
   - `fakturis/dashboard`

5. Penyamaan profil FE1 untuk seluruh role selain toko masih terbatas oleh model tabel `users` di `BE2`.
   - FE1 lama punya field seperti `nik`, `nomorTelepon`, `kota`, `provinsi`, `kodePos`, dan `alamatLengkap`.
   - `BE2` saat ini belum menyimpan field tersebut di entitas `User`, jadi belum aman membuka form edit penuh untuk semua role tanpa perubahan schema dan migrasi backend.
   - Jalur yang sudah benar-benar aman saat ini adalah profil toko, karena field tambahannya memang hidup di tabel `stores`.
