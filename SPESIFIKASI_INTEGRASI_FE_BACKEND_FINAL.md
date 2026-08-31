# Spesifikasi Integrasi FE–Backend Final

Dokumen ini adalah acuan implementasi backend untuk fitur frontend yang sudah selesai dan dapat diverifikasi menggunakan mock server Next.js. Dokumen menjelaskan kondisi akhir, bukan riwayat perubahan.

Fitur yang dicakup:

1. Pendaftaran toko oleh sales.
2. Daftar Toko Kelolaan sales dengan search global dan pagination tetap 10 toko.
3. Daftar dan penilaian Grade Toko untuk internal, owner, sales, dan toko.
4. Search serta filter grade global dengan pagination tetap 10 toko.
5. Pagination dan filter global Aging Piutang untuk sales.
6. Retur toko/sales, pemeriksaan parsial per item oleh gudang, dan aturan 24 jam khusus retail.
7. Aktor Digital Marketing, Kelola Katalog per item, dan Insight Katalog owner yang bersifat read-only.
8. Searchable combobox untuk reference data yang dapat berkembang besar.
9. Nomor dokumen ringkas dan cetak faktur final oleh Fakturis.

## 1. Strategi Mock Server Frontend

Frontend menggunakan Route Handler Next.js pada prefix berikut:

```text
/api/mock/features
```

Pada `npm run dev`, mock aktif secara default agar UI dapat diuji tanpa implementasi backend baru. Pengaturan dapat dioverride melalui environment variable:

```env
# Paksa memakai mock Next.js
NEXT_PUBLIC_USE_FEATURE_MOCK_SERVER=true

# Pakai backend asli untuk integrasi
NEXT_PUBLIC_USE_FEATURE_MOCK_SERVER=false
```

Restart proses Next.js setelah mengubah environment variable.

Mock hanya untuk development dan verifikasi frontend. Data mock disimpan di memori proses Next.js sehingga akan kembali ke seed awal setelah dev server direstart. Password pendaftaran tidak disimpan pada state mock.

Referensi implementasi mock:

- `lib/feature-mock.ts`
- `lib/mocks/feature-data.ts`
- `app/api/mock/features/store-grades/route.ts`
- `app/api/mock/features/store-grades/[storeId]/route.ts`
- `app/api/mock/features/store-grades/[storeId]/transactions/route.ts`
- `app/api/mock/features/sales/managed-stores/route.ts`
- `app/api/mock/features/sales/receivables/route.ts`
- `app/api/mock/features/sales/receivables/aging/route.ts`

Saat backend asli sudah memenuhi dokumen ini, FE tidak perlu diubah. Cukup nonaktifkan mock menggunakan environment variable di atas.

## 2. Format Response API

Gunakan envelope sukses yang konsisten:

```json
{
  "success": true,
  "message": "Deskripsi hasil",
  "data": {}
}
```

Untuk endpoint list dengan pagination:

```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": [],
  "meta": {
    "currentPage": 1,
    "totalPages": 4,
    "totalItems": 36,
    "itemsPerPage": 10
  }
}
```

Format error minimum:

```json
{
  "success": false,
  "message": "Pesan yang aman ditampilkan kepada pengguna",
  "data": null,
  "code": "OPTIONAL_MACHINE_READABLE_CODE"
}
```

## 3. Pendaftaran Toko oleh Sales

### Endpoint

```http
POST /api/v1/sales/managed-stores
```

Endpoint hanya dapat digunakan sales yang terautentikasi. System admin dapat diberi akses sesuai kebijakan backend.

### Kondisi Akhir Form Frontend

| Urutan | Label FE | Field request | Wajib |
|---:|---|---|---|
| 1 | Nama Pemilik | `ownerName` | Ya |
| 2 | Email Login Toko | `ownerEmail` | Ya |
| 3 | Password Login | `ownerPassword` | Ya |
| 4 | Nama Toko | `storeName` | Ya |
| 5 | Gender Pemilik | `ownerGender` | Ya |
| 6 | Jenis Toko | `storeType` | Ya |
| 7 | Telepon Pemilik | `ownerPhoneNumber` | Tidak |
| 8 | Telepon Toko | `phone` | Ya |
| 9 | Kota Toko tersimpan | `cityId` | Kondisional |
| 10 | Kota Baru | `newCityName` | Kondisional |
| 11 | Provinsi Kota Baru | `newCityProvince` | Kondisional |
| 12 | Lama Usaha | `yearsInBusiness` | Ya |
| 13 | Estimasi Omzet Bulanan | `estimatedMonthlyRevenue` | Tidak |
| 14 | Alamat Toko | `address` | Ya |
| 15 | Catatan Sales | `salesNotes` | Tidak |

Kota Toko ditampilkan satu baris penuh. Jenis Toko sejajar dengan Gender Pemilik. Telepon Pemilik dan Telepon Toko berada pada baris yang sama di layar desktop.

### Tipe dan Validasi Request

| Field | Tipe/aturan |
|---|---|
| `ownerName` | string yang sudah di-trim dan tidak kosong |
| `ownerEmail` | email valid, di-trim, lowercase, unik pada user dan toko |
| `ownerPassword` | string minimal 8 karakter |
| `storeName` | string minimal 3 karakter |
| `ownerGender` | enum `MALE` atau `FEMALE` |
| `ownerPhoneNumber` | opsional; format nomor Indonesia jika diisi |
| `phone` | wajib; format nomor Indonesia |
| `cityId` | UUID kota tersimpan; tidak boleh bersama field kota baru |
| `newCityName` | wajib bersama `newCityProvince` jika `cityId` tidak dikirim |
| `newCityProvince` | wajib bersama `newCityName` jika `cityId` tidak dikirim |
| `storeType` | enum `RETAILER`, `WHOLESALER`, atau `DISTRIBUTOR` |
| `yearsInBusiness` | integer minimal 0 |
| `estimatedMonthlyRevenue` | integer minimal 0 atau tidak dikirim |
| `address` | string minimal 10 karakter |
| `salesNotes` | string maksimal 2.000 karakter atau tidak dikirim |

Regex telepon yang digunakan FE:

```regex
^(\+62|62|0)[0-9]{9,13}$
```

Field opsional kosong tidak dikirim sebagai string kosong.

### Aturan Kota

Request harus memakai tepat satu cara:

1. Kirim `cityId`; atau
2. Kirim `newCityName` dan `newCityProvince` sekaligus.

Backend harus menolak request yang mengirim kedua cara sekaligus atau pasangan kota baru yang tidak lengkap. FE tidak memanggil `POST /cities` secara terpisah.

Untuk kota baru:

1. Cari nama dan provinsi secara case-insensitive.
2. Jika pasangan nama/provinsi sudah ada, gunakan record tersebut.
3. Jika belum ada, buat kota dalam transaksi pendaftaran.
4. Jika kebijakan database mengharuskan nama unik dan nama sudah ada dengan provinsi berbeda, kembalikan `409 CITY_PROVINCE_CONFLICT`.

### Contoh Request

```json
{
  "ownerName": "Budi Santoso",
  "ownerEmail": "budi.toko@example.com",
  "ownerPassword": "PasswordAman123!",
  "storeName": "Toko Budi Jaya",
  "ownerGender": "MALE",
  "ownerPhoneNumber": "081234567891",
  "phone": "081234567890",
  "newCityName": "Kota Baru",
  "newCityProvince": "Provinsi Baru",
  "storeType": "RETAILER",
  "yearsInBusiness": 4,
  "estimatedMonthlyRevenue": 25000000,
  "address": "Jalan Merdeka Nomor 10, Kota Baru",
  "salesNotes": "Lokasi strategis dan ramai."
}
```

### Proses Backend yang Diharapkan

1. Verifikasi actor adalah sales yang sah.
2. Normalisasi email menjadi lowercase.
3. Tolak email duplikat sebelum membuat akun/toko.
4. Resolve kota tersimpan atau buat kota baru dalam transaksi.
5. Buat akun login toko melalui sistem autentikasi proyek.
6. Simpan profile pemilik: nama, gender, dan telepon opsional.
7. Buat toko dengan `verificationStatus=PENDING`, `isActive=false`, dan `creditLimit=0`.
8. Simpan lama usaha, omzet, serta catatan sales pada struktur yang disepakati. Struktur database saat ini dapat memakai `stores.documents` JSON.
9. Buat assignment aktif antara toko dan sales pendaftar.
10. Buat audit log/notifikasi sesuai pola proyek.
11. Kembalikan HTTP `201`. Password tidak boleh dikembalikan atau ditulis ke log.

### Response Minimum

```json
{
  "success": true,
  "message": "Store registered by sales successfully",
  "data": {
    "id": "store-uuid",
    "name": "Toko Budi Jaya",
    "email": "budi.toko@example.com",
    "verificationStatus": "PENDING",
    "isActive": false,
    "city": {
      "id": "city-uuid",
      "name": "Kota Baru",
      "province": "Provinsi Baru"
    },
    "user": {
      "id": "user-uuid",
      "name": "Budi Santoso",
      "email": "budi.toko@example.com",
      "profile": {
        "gender": "MALE",
        "phone": "081234567891"
      }
    }
  }
}
```

### Daftar Toko Kelolaan Setelah Registrasi

Halaman `sales/toko-kelolaan` memakai sumber data paginated khusus toko kelolaan agar toko yang masih menunggu verifikasi tetap dapat dipantau tanpa mencampurkannya ke Grade Toko:

```http
GET /api/v1/sales/managed-stores?page=1&limit=10&search=
```

Ketentuan:

- `limit` selalu `10`; tidak ada pilihan page size.
- `search` mencari nama toko atau email pada seluruh toko yang mempunyai assignment aktif ke sales login.
- Search diterapkan sebelum pagination.
- Urutan default berdasarkan nama toko secara ascending.
- Response wajib menyertakan `meta.currentPage`, `meta.totalPages`, `meta.totalItems`, dan `meta.itemsPerPage`.
- Toko `PENDING` atau belum aktif tetap harus muncul pada sales pendaftar agar hasil registrasi dapat dilihat.
- Setelah registrasi berhasil, FE kembali ke halaman pertama dan memuat ulang endpoint list.
- FE hanya merender maksimal 10 kartu. FE tidak mengambil seluruh toko untuk melakukan pagination lokal.

Endpoint ini mengembalikan bentuk item yang kompatibel dengan kartu Toko Kelolaan. Data transaksi/grade boleh bernilai nol atau `N` untuk toko `PENDING`; nilai tersebut hanya placeholder kartu dan bukan berarti toko sudah menjadi peserta penilaian Grade Toko.

## 4. Grade Toko

### Endpoint Berdasarkan Scope

```http
GET /api/v1/store-grades
GET /api/v1/sales/store-grades
GET /api/v1/toko/grade
```

- `/store-grades`: role internal yang memiliki izin baca bisnis.
- `/sales/store-grades`: hanya toko dengan assignment aktif milik sales login.
- `/toko/grade`: hanya toko yang terhubung dengan user toko login.
- Ketiga endpoint selalu menerapkan `verificationStatus=VERIFIED` sebelum search, kalkulasi grade, dan pagination. Toko `PENDING` maupun `REJECTED` tidak boleh muncul.

### Query List

| Query | Tipe | Aturan |
|---|---|---|
| `page` | integer | minimal 1 |
| `limit` | integer | 1–100; FE Grade Toko selalu mengirim `10` |
| `search` | string | opsional; cari nama toko atau email secara case-insensitive |
| `grade` | enum | opsional: `N`, `A+`, `A`, `B+`, `B`, `C+`, `C`, atau `D` |
| `storeId` | UUID/string ID | opsional untuk mengambil grade toko tertentu |

### Urutan Search, Filter, dan Pagination yang Wajib

```text
Toko berstatus VERIFIED
  â†’ scope akses user
  → search ke seluruh toko dalam scope
  → hitung grade seluruh kandidat hasil search
  → filter grade ke seluruh hasil
  → hitung totalItems dan totalPages
  → urutkan nama toko
  → ambil 10 toko untuk halaman aktif
```

Search dan filter grade tidak boleh diterapkan hanya pada 10 toko yang sudah dipaginasi. Contoh: jika toko Grade A berada pada urutan data ke-25, memilih Grade A pada halaman pertama tetap harus menemukan toko tersebut dan menghitung metadata dari seluruh hasil Grade A.

Jika filter grade tidak dikirim, backend boleh mengoptimalkan proses dengan memaginasi ID toko lebih dahulu lalu menghitung agregat transaksi hanya untuk 10 toko aktif. Jika filter grade dikirim, seluruh kandidat harus dinilai sebelum pagination. Untuk volume sangat besar, backend disarankan memakai snapshot/materialized grade yang diperbarui terjadwal atau saat transaksi berubah agar filter tidak melakukan agregasi penuh pada setiap request.

### Aturan Penilaian Final yang Ditampilkan FE

Toko yang belum terverifikasi tidak masuk dataset grade sama sekali. Grade `N` hanya digunakan untuk outlet yang sudah `VERIFIED`, tetapi belum aktif untuk transaksi, berusia kurang dari 30 hari, atau belum memiliki invoice penilaian. Outlet yang sudah memenuhi syarat penilaian menggunakan matriks berikut:

| Grade | Rata-rata pembelian per bulan | Rata-rata pembayaran |
|---|---:|---:|
| `A+` | Lebih dari Rp15 juta | 0 sampai 40 hari sejak tanggal invoice |
| `A` | Rp7 juta sampai Rp15 juta | 0 sampai 40 hari sejak tanggal invoice |
| `B+` | Lebih dari Rp7 juta | 41 sampai 54 hari sejak tanggal invoice |
| `B` | Maksimal Rp7 juta | 0 sampai 54 hari sejak tanggal invoice |
| `C+` | Lebih dari Rp15 juta | 55 sampai 90 hari sejak tanggal invoice |
| `C` | Maksimal Rp15 juta | 55 sampai 90 hari sejak tanggal invoice |
| `D` | Berapa pun | Lebih dari 90 hari sejak tanggal invoice |

Rata-rata pembelian bulanan:

```text
recentSalesAmount / 3 bulan
```

Rata-rata hari pembayaran dihitung per invoice dari `invoiceDate` sampai pembayaran lunas terakhir. Untuk invoice yang belum lunas, umur pembayaran dihitung dari `invoiceDate` sampai tanggal evaluasi. Hasil seluruh invoice periode 90 hari kemudian dirata-ratakan.

Batas tepat Rp7 juta masuk Grade A pada pembayaran maksimal 40 hari dan Grade B pada pembayaran 41-54 hari. Batas tepat Rp15 juta masuk Grade A atau Grade C; Grade A+ dan C+ harus benar-benar lebih dari Rp15 juta. Periode evaluasi adalah 90 hari dan masa outlet baru adalah 30 hari.

### Bentuk Item Grade

```json
{
  "storeId": "store-uuid",
  "storeName": "Toko Budi Jaya",
  "email": "budi.toko@example.com",
  "isActive": true,
  "verificationStatus": "VERIFIED",
  "creditLimit": 100000000,
  "totalOrders": 48,
  "totalInvoices": 45,
  "totalSalesAmount": 500000000,
  "totalPaidAmount": 470000000,
  "totalOutstandingAmount": 30000000,
  "recentOrders": 8,
  "recentInvoices": 6,
  "recentSalesAmount": 72000000,
  "recentPaidAmount": 67680000,
  "recentOutstandingAmount": 4320000,
  "averageMonthlyPurchase": 24000000,
  "averagePaymentDays": 28.5,
  "evaluationWindowStart": "2026-05-28T00:00:00.000Z",
  "evaluationWindowEnd": "2026-08-26T00:00:00.000Z",
  "probationEndsAt": "2025-02-01T00:00:00.000Z",
  "storeAgeDays": 570,
  "gradeReason": "Grade A+: rata-rata pembelian bulanan di atas Rp15 juta dan rata-rata pembayaran 0-40 hari sejak tanggal invoice.",
  "grade": "A+"
}
```

`meta.totalItems` wajib menunjukkan jumlah hasil setelah search dan filter grade global, bukan jumlah baris halaman aktif.

### Perilaku FE Grade Toko

- Pagination tetap 10 toko; tidak ada pilihan 20/50.
- Search memiliki debounce 350 ms dan mengembalikan halaman ke 1.
- Perubahan filter grade mengembalikan halaman ke 1.
- Nomor halaman, Sebelumnya, dan Berikutnya memakai metadata backend.
- Kriteria grade ditampilkan setelah tabel pada halaman internal, owner, sales, dan halaman grade milik toko.
- Card `Total Toko` memakai `meta.totalItems`.
- Seluruh card, tabel, search, filter, dan metadata hanya menghitung toko `VERIFIED`.
- Ringkasan Sisa Piutang dan Risiko Tinggi hanya merangkum 10 baris halaman aktif. Status verifikasi tidak ditampilkan karena seluruh dataset Grade Toko sudah pasti `VERIFIED`.

## 5. Aging Piutang Sales

### Endpoint List

```http
GET /api/v1/sales/receivables
```

### Query

| Query | Tipe | Aturan |
|---|---|---|
| `page` | integer | minimal 1 |
| `limit` | integer | FE selalu mengirim `10` |
| `search` | string | nomor invoice atau nama toko, global dan case-insensitive |
| `agingRisk` | enum | `LOW`, `MEDIUM`, atau `HIGH` |
| `storeId` | UUID/string ID | opsional, hanya toko kelolaan sales login |
| `sortBy` | string | FE mengirim `dueDate` |
| `sortOrder` | enum | `asc` atau `desc`; FE mengirim `asc` |

Search dan `agingRisk` harus diterapkan pada seluruh piutang dalam scope sales sebelum pagination.

Definisi risiko:

- `LOW`: belum jatuh tempo sampai 60 hari lewat jatuh tempo.
- `MEDIUM`: 61–90 hari lewat jatuh tempo.
- `HIGH`: lebih dari 90 hari lewat jatuh tempo.

Hanya invoice dengan `remainingAmount > 0` yang relevan untuk tabel aging.

### Item Receivable Minimum

```json
{
  "id": "receivable-or-invoice-id",
  "invoiceNumber": "INV-2026-0001",
  "invoiceDate": "2026-05-01T00:00:00.000Z",
  "storeNameSnapshot": "Toko Budi Jaya",
  "store": {
    "id": "store-uuid",
    "name": "Toko Budi Jaya"
  },
  "dueDate": "2026-05-31T00:00:00.000Z",
  "amount": 10000000,
  "totalAmount": 10000000,
  "remainingAmount": 4000000,
  "status": "PARTIAL",
  "storeId": "store-uuid"
}
```

Response memakai envelope pagination pada bagian 2.

### Endpoint Ringkasan Aging

```http
GET /api/v1/sales/receivables/aging
GET /api/v1/sales/receivables/aging?storeId=store-uuid
```

Response data:

```json
{
  "current": { "count": 2, "amount": 5000000 },
  "days1To30": { "count": 4, "amount": 12000000 },
  "days31To60": { "count": 3, "amount": 9000000 },
  "days61To90": { "count": 2, "amount": 7000000 },
  "daysOver90": { "count": 1, "amount": 4000000 },
  "totalReceivables": 12,
  "totalOutstandingAmount": 37000000,
  "overdueCount": 10
}
```

Ringkasan tidak mengikuti page size. Ringkasan menghitung seluruh data dalam scope sales atau seluruh data toko jika `storeId` dikirim.

## 6. Retur Barang Toko, Sales, dan Gudang

### Endpoint Berdasarkan Aktor

- Toko: `GET /toko/returns` dan `POST /toko/returns`.
- Sales yang mewakili toko: `GET /sales/returns?storeId={storeId}` dan `POST /sales/returns`.
- Gudang: `GET /store-returns` dan `PATCH /store-returns/{returnId}/review`.

Backend mengambil scope toko dari sesi untuk role toko. Untuk sales, backend wajib memverifikasi assignment aktif sebelum sales dapat membaca atau membuat retur bagi toko tersebut.

### Aturan Kelayakan Pengajuan

Semua jenis toko hanya dapat mengajukan retur setelah Delivery Order berstatus `RECEIVED` dan memiliki `receivedAt`. Invoice `CANCELLED` tidak dapat diretur.

- `RETAILER`: maksimal 24 jam sejak `receivedAt`.
- `WHOLESALER`: tidak dibatasi 24 jam setelah barang diterima.
- `DISTRIBUTOR`: tidak dibatasi 24 jam setelah barang diterima.

Validasi wajib dilakukan di backend. Penyaringan transaksi di FE hanya membantu pengguna dan bukan pengaman utama.

### Klasifikasi Pengajuan Per Item

Satu pengajuan dapat berisi beberapa barang dengan klasifikasi berbeda:

```json
{
  "invoiceId": "invoice-uuid",
  "reason": "Hasil pemeriksaan barang setelah diterima",
  "note": "Satu produk rusak dan satu produk salah kirim",
  "items": [
    {
      "productId": "product-a-uuid",
      "quantity": 1,
      "requestedCondition": "DAMAGED"
    },
    {
      "productId": "product-b-uuid",
      "quantity": 1,
      "requestedCondition": "GOOD"
    }
  ]
}
```

`GOOD` berarti barang masih baik/salah kirim dan `DAMAGED` berarti barang diklasifikasikan rusak oleh pengaju. Klasifikasi tersebut adalah informasi awal; pemeriksaan gudang menjadi keputusan akhir.

Untuk produk yang sama, pengaju dapat membagi jumlah ke dua kategori sekaligus, misalnya 1 unit `GOOD` dan 1 unit `DAMAGED`. Backend menghitung gabungan kedua kategori dan menolak jika totalnya melebihi jumlah yang masih eligible diretur.

### Konfirmasi Gudang Per Item

Gudang tidak otomatis menerima seluruh jumlah pengajuan. Setiap item mempunyai:

- `receivedQuantity`: jumlah fisik yang diterima, dari `0` sampai jumlah pengajuan.
- `approvedCondition`: hasil pemeriksaan gudang, `GOOD` atau `DAMAGED`.

Nilai `0` berarti item tidak diterima dan tidak menambah stok. Jika pengajuan tidak ditolak seluruhnya, minimal satu item harus memiliki `receivedQuantity > 0`.

```json
{
  "decision": "APPROVED_DAMAGED",
  "reviewNote": "Diterima sebagian berdasarkan pemeriksaan fisik",
  "items": [
    {
      "returnItemId": "return-item-a-uuid",
      "receivedQuantity": 1,
      "approvedCondition": "DAMAGED"
    },
    {
      "returnItemId": "return-item-b-uuid",
      "receivedQuantity": 2,
      "approvedCondition": "GOOD"
    },
    {
      "returnItemId": "return-item-c-uuid",
      "receivedQuantity": 0,
      "approvedCondition": "GOOD"
    }
  ]
}
```

Penolakan seluruh retur tetap menggunakan `decision: "REJECTED"`. Backend wajib menolak jumlah negatif, jumlah melebihi pengajuan, item duplikat, item milik retur lain, dan penerimaan dengan total nol.

### Pagination Antrean Gudang

Halaman gudang memakai pagination server-side tetap 10 data:

```http
GET /store-returns?page=1&limit=10&search=RET-001&sortBy=submittedAt&sortOrder=desc
```

`search` diterapkan sebelum pagination pada seluruh scope data dan minimal mencakup nomor retur, nama toko, nomor invoice, alasan, catatan, serta nama produk. FE tidak memakai `listAll()` untuk tabel antrean gudang.

Response item membedakan `quantity` sebagai jumlah diajukan dan `receivedQuantity` sebagai jumlah yang dikonfirmasi gudang.

### Efek Persetujuan Gudang

- Stok `GOOD` bertambah sesuai jumlah aktual item hasil `GOOD`.
- Stok `DAMAGED` bertambah sesuai jumlah aktual item hasil `DAMAGED`.
- Item berjumlah diterima nol tidak mengubah stok.
- Perubahan status, stock adjustment, dan inventory berada dalam satu transaksi database.
- Setelah penerimaan, retur masuk ke `ACCOUNTING_REVIEW`; saldo kredit toko tetap diselesaikan oleh alur akuntansi.

## 7. Digital Marketing dan Pemisahan Kewenangan Katalog

### Role dan route frontend final

Tambahkan organization role bernama persis:

```text
digital_marketing
```

Untuk pengujian lokal, akun seed Digital Marketing adalah `digital.marketing@pridata.test`. Backend referensi menyediakan perintah idempotent berikut agar hanya akun tersebut yang dibuat atau diperbarui tanpa menjalankan ulang seluruh seed:

```bash
npm run dev:seed:digital-marketing
```

Route yang tersedia untuk role tersebut:

```text
/digital-marketing/dashboard
/digital-marketing/kelola-katalog
/digital-marketing/kelola-katalog/:productId
```

- Dashboard menampilkan jumlah produk dengan stok aktif, katalog yang sudah dikonfigurasi, published, draft, belum bergambar, persentase kesiapan konten, dan daftar prioritas konten.
- Kelola Katalog menampilkan ringkasan status, search seluruh data, filter status `Published`/`Draft`/`Belum Dibuat`, dan pagination tetap 10 produk per halaman.
- Urutan list selalu memprioritaskan `Belum Dibuat`, kemudian `Draft`, lalu `Published`; produk dalam kelompok status yang sama diurutkan berdasarkan nama marketing A-Z dengan nama master sebagai fallback.
- Tombol `Kelola Detail` pada kolom aksi membuka editor katalog untuk satu produk; baris tabel tidak digunakan sebagai aksi tersembunyi.
- Editor per item dapat mengubah nama marketing, harga jual, deskripsi, divisi, subdivisi, daftar gambar, dan status publish.
- Editor memakai alur vertikal: ringkasan Produk Master di bagian atas, divisi/subdivisi menyatu dengan Informasi Katalog, serta pilihan tombol eksklusif Draft/Published menyatu dengan area aksi simpan dan nonaktif.
- Produk hanya dapat dimasukkan ke katalog jika jumlah stok aktif lebih dari nol.

Owner tidak lagi memiliki halaman edit katalog. Menu owner berubah menjadi:

```text
/owner/insight-katalog
```

Owner hanya dapat membaca kesiapan katalog, kategori pembentuk market, penetrasi toko, serta performa brand. Route lama `/owner/kelola-katalog` mengarahkan owner ke halaman insight tersebut.

### Matriks izin backend final

| Operasi | Owner | Digital Marketing | System admin |
|---|---:|---:|---:|
| Membaca produk, inventory, divisi, dan subdivisi untuk workspace katalog | Ya | Ya | Ya, sesuai kebijakan sistem |
| Membaca katalog internal | Ya | Ya | Ya, sesuai kebijakan sistem |
| Membuat katalog | Tidak | Ya | Tidak secara default |
| Mengubah katalog | Tidak | Ya | Tidak secara default |
| Menghapus/menonaktifkan katalog | Tidak | Ya | Tidak secara default |
| Mengunggah gambar katalog | Tidak | Ya | Tidak secara default |
| Membaca analytics owner | Ya | Tidak | Ya, sesuai kebijakan analytics |

Pembatasan tulis wajib diterapkan di backend, bukan hanya dengan menyembunyikan tombol FE. Konstanta RBAC yang dipakai pada implementasi referensi:

```ts
CATALOG_READ_ROLES = ["owner", "digital_marketing"]
CATALOG_WRITE_ROLES = ["digital_marketing"]
```

### Endpoint backend yang digunakan

```http
GET    /api/v1/products
GET    /api/v1/products/:productId
GET    /api/v1/warehouse-inventories
GET    /api/v1/divisions
GET    /api/v1/sub-divisions
GET    /api/v1/catalog-products
POST   /api/v1/catalog-products
PUT    /api/v1/catalog-products/:catalogId
DELETE /api/v1/catalog-products/:catalogId
POST   /api/v1/files/product-images
GET    /api/v1/dashboard/owner/analytics?section=details
```

Payload create/update katalog:

```json
{
  "productId": "uuid-produk",
  "marketingName": "Nama yang tampil di katalog",
  "sellingPrice": 1250000,
  "description": "Deskripsi pemasaran",
  "divisionId": "uuid-divisi-atau-null",
  "subDivisionId": "uuid-subdivisi-atau-null",
  "imageList": ["https://storage.example/products/image.webp"],
  "isPublished": true
}
```

`productId` wajib pada create dan tidak perlu diubah pada update. `marketingName` wajib dan tidak boleh kosong. `sellingPrice` merupakan integer minimal 0. `imageList` berupa array URL yang sudah berhasil diunggah. `divisionId` dan `subDivisionId` boleh `null`. Subdivisi harus konsisten dengan divisi dan kategori produk.

Upload gambar memakai multipart form-data dengan nama field `file` atau alias `image`. Response minimum:

```json
{
  "success": true,
  "message": "Product image uploaded",
  "data": {
    "url": "https://storage.example/products/image.webp",
    "objectKey": "products/uuid.webp",
    "mimeType": "image/webp",
    "size": 124000
  }
}
```

### Mock server Next.js

Saat `NEXT_PUBLIC_USE_FEATURE_MOCK_SERVER=true`, halaman Digital Marketing memakai workspace mock berikut:

```http
GET  /api/mock/features/digital-marketing/catalog
POST /api/mock/features/digital-marketing/catalog
```

GET mengembalikan produk, inventory, divisi, dan subdivisi. POST menyimpan create/update/publish/nonaktif katalog pada memori proses Next.js. Unggah gambar pada mode mock dibaca menjadi data URL di browser agar galeri dapat langsung diuji. Data kembali ke seed awal setelah server Next.js direstart.

Saat environment variable bernilai `false`, service FE otomatis memakai endpoint backend asli tanpa perubahan UI.

## 8. Searchable Combobox Reference Data

Frontend memakai satu komponen `components/shared/SearchCombobox.tsx` untuk selector reference data yang dapat berisi puluhan atau ratusan record. Komponen tidak mengubah payload simpan: form tetap menyimpan dan mengirim ID yang sama seperti sebelumnya.

Perilaku final komponen:

- pencarian ditunda 300 ms;
- maksimal 10 hasil dan diurutkan A-Z;
- mendukung loading, hasil kosong, error dengan aksi coba lagi, clear selection, label nilai aktif, keyboard Arrow Up/Down, Enter, Escape, klik di luar, serta ARIA combobox/listbox;
- response request lama diabaikan jika request yang lebih baru sudah dimulai;
- nilai lama pada form edit tetap ditampilkan melalui snapshot label walaupun record itu tidak berada pada 10 hasil awal;
- mode lokal hanya digunakan jika seluruh dataset memang sudah wajib dimuat untuk workspace/visualisasi.

### Kontrak query backend

```http
GET /api/v1/categories?page=1&limit=10&search=&sortBy=name&sortOrder=asc
GET /api/v1/brands?page=1&limit=10&search=&sortBy=name&sortOrder=asc
GET /api/v1/divisions?page=1&limit=10&search=&sortBy=name&sortOrder=asc
GET /api/v1/sub-divisions?page=1&limit=10&search=&sortBy=name&sortOrder=asc&categoryId={id}&divisionId={id}
GET /api/v1/cities?page=1&limit=10&search=&sortBy=name&sortOrder=asc
GET /api/v1/products?page=1&limit=10&search=&sortBy=name&sortOrder=asc
GET /api/v1/catalog-products?page=1&limit=10&search=&sortBy=name&sortOrder=asc
GET /api/v1/stores?page=1&limit=10&search=&sortBy=name&sortOrder=asc
GET /api/v1/warehouse-inventory?page=1&limit=10&search=&sortBy=name&sortOrder=asc&warehouseId={id}&condition=GOOD
GET /api/v1/owner/sales-directory?page=1&limit=10&search=&sortBy=name&sortOrder=asc
```

`search` dijalankan case-insensitive sebelum pagination. Taxonomy dicari berdasarkan nama, kota berdasarkan nama atau provinsi, toko berdasarkan nama atau email, produk/inventory berdasarkan nama produk, katalog berdasarkan nama marketing atau nama produk master, dan Sales berdasarkan nama atau email. Response memakai envelope pagination pada bagian 2. Endpoint directory Sales lama tetap kompatibel dan menerima query pagination untuk kebutuhan combobox.

### Ketergantungan selector

- Perubahan kategori atau divisi mengosongkan `subDivisionId`.
- Subdivisi hanya dapat dicari jika kategori dan divisi sudah dipilih; backend menerapkan kedua filter bersama search.
- Perubahan gudang asal mengosongkan inventory terpilih dan draft transfer yang bergantung pada stok asal.
- Mengosongkan kota membuka input nama kota dan provinsi baru; memilih kota tersimpan mengosongkan kedua input baru.
- Selector taxonomy pada form Kelola Item Gudang hanya memilih data yang sudah ada. Kategori, brand, divisi, dan subdivisi dapat dibuat, diubah, atau dihapus oleh Owner maupun Gudang melalui halaman Master Data masing-masing.

Selector yang tetap menggunakan dropdown native karena opsinya pendek/terkontrol: driver, gudang, status, role, gender, jenis toko, kondisi barang, metode pembayaran, bulan, tahun, periode, grade, risiko, dan jenis laporan.

Area FE yang memakai komponen: taxonomy Kelola Item Gudang; kategori/brand master produk Admin; kategori/divisi master subdivisi Owner; divisi/subdivisi editor katalog; produk penerimaan dan invoice; inventory transfer; kota pada registrasi, pengelolaan toko, profil toko, dan gudang; toko pada kredit Akuntan dan konfirmasi pembayaran Sales; serta Sales pada assignment toko dan analitik.

### Master Data untuk Gudang

Role organisasi `warehouse_staff` mempunyai menu dan route berikut:

```text
/gudang/master-data
/gudang/master-data/categories
/gudang/master-data/brands
/gudang/master-data/divisions
/gudang/master-data/subdivisions
```

Gudang memiliki kemampuan CRUD yang sama dengan Owner hanya untuk kategori, brand, divisi, dan subdivisi. Backend memakai izin khusus `PRODUCT_TAXONOMY_WRITE_ROLES = ["owner", "warehouse_staff"]` pada endpoint `POST`, `PUT`, dan `DELETE` keempat taxonomy tersebut. Izin ini tidak memberikan Gudang kewenangan pengelolaan toko, user, kota, driver, supplier, atau master lain secara otomatis.

## 9. Nomor Dokumen dan Cetak Faktur Final

### Format nomor dokumen

Dokumen baru menggunakan format `PREFIX-YYMMDD-SEQUENCE`. Sequence bersifat atomik, terpisah per prefix dan tanggal UTC, dimulai dari `0001`, serta tetap bertambah menjadi lima digit setelah `9999`.

| Dokumen | Prefix | Contoh |
|---|---|---|
| Order | `ORD` | `ORD-260630-0001` |
| Invoice final | `INV` | `INV-260630-0001` |
| Draft invoice | `DRF` | `DRF-260630-0001` |
| Delivery Order | `DO` | `DO-260630-0001` |
| Retur | `RET` | `RET-260630-0001` |
| Pembayaran | `PAY` | `PAY-260630-0001` |
| Permintaan pembayaran | `PRQ` | `PRQ-260630-0001` |

Backend menyimpan counter pada tabel `document_number_counters` dengan composite key `prefix + sequenceDate` (`sequenceDate` memakai `YYYYMMDD`). Pengambilan nilai berikutnya wajib memakai operasi PostgreSQL atomik `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` di dalam transaksi yang sama dengan pembuatan dokumen. UUID tetap menjadi primary key internal dan constraint unique pada setiap nomor dokumen tetap dipertahankan.

Nomor historis dengan format lama tidak diubah dan tetap valid untuk detail, pencarian, relasi, laporan, serta PDF. Identifier seed development seperti `INV-DEV-*` juga tidak wajib dimigrasikan.

### Cetak faktur final Fakturis

Pada detail halaman Riwayat Transaksi Fakturis, tombol `Cetak Faktur Final` hanya tampil jika record merupakan invoice final yang tidak dibatalkan dan sudah memiliki Delivery Order. FE mengambil PDF melalui:

```http
GET /invoices/{invoiceId}/export/pdf
```

Endpoint menerima role `invoicist`, mengembalikan `Content-Type: application/pdf`, dan menggunakan nama file `{invoiceNumber}.pdf`. FE membuka Blob PDF di tab browser agar pengguna dapat melihat lalu mencetak dokumen final. Draft, order yang dibatalkan, invoice `CANCELLED`, atau invoice yang belum diteruskan ke gudang tidak menampilkan aksi cetak.

Tabel Riwayat Transaksi Fakturis mempunyai kolom `Status Gudang` berdasarkan Delivery Order:

- Tanpa Delivery Order: `Belum Diproses Gudang`.
- Delivery Order aktif: cukup menampilkan badge `Sudah Diproses Gudang` tanpa detail status operasional di bawahnya.
- Delivery Order `CANCELLED`: `Proses Gudang Dibatalkan`.
- Draft/order yang dibatalkan: `Tidak Diproses Gudang`.

Tombol cetak hanya tersedia untuk invoice final yang mempunyai Delivery Order aktif. FE boleh memperoleh Delivery Order dari relasi pada response invoice atau mencocokkannya berdasarkan `invoiceId` dari endpoint Delivery Order; hasil status dan aturan cetaknya harus sama.

PDF memakai format surat resmi A4 yang siap dicetak dan memuat:

- Kop memakai tiga area sejajar untuk logo, identitas `CV. PRIDATA JAYA`, serta label `FAKTUR`/nomor faktur yang dipisahkan garis aksen pendek. Proporsi kolom memastikan alamat perusahaan tampil utuh dalam satu baris; dua garis biru-oranye di bawah kop memiliki panjang penuh.
- Identitas penerima dan Informasi Faktur terlihat sebagai dua card terpisah dengan spacer transparan, tetapi dibangun dalam satu baris sehingga tinggi keduanya selalu sama.
- Informasi Faktur memuat nomor order, jatuh tempo, dan status tanpa mengulang nomor atau tanggal faktur.
- Tabel rincian barang memuat nama produk, kuantitas, harga satuan, dan subtotal tanpa kolom kondisi; header tabel memakai warna biru brand.
- Area bawah menempatkan pesan penyimpanan dokumen dan catatan opsional di kiri, sejajar dengan total faktur, nilai yang sudah dibayar, serta sisa tagihan di kanan tanpa mengulang informasi jatuh tempo.
- Pesan/catatan dan ringkasan nilai memakai dua card independen. Card kiri memiliki tinggi minimum setara ringkasan kanan ketika isinya pendek, tetapi dapat bertambah sendiri untuk catatan panjang tanpa memperpanjang card total di kanan.
- Tanggal dokumen, ruang tanda tangan Bagian Fakturis, nomor dokumen, dan nomor halaman.
- Label pembatalan tetap tersedia untuk kompatibilitas dokumen historis, walaupun aksi cetak FE tidak ditampilkan untuk invoice yang dibatalkan.

Logo harus dibundel bersama artefak backend dan dibaca sebagai data lokal ketika PDF dibuat. Kegagalan membaca logo tidak boleh menggagalkan pencetakan; backend menggunakan identitas teks sebagai fallback. Generator tidak mengambil logo melalui URL frontend sehingga pencetakan tidak bergantung pada frontend yang sedang aktif.

## 10. Daftar File Frontend Final

### Standardisasi pagination lintas role

- `components/shared/PaginationControls.tsx` menjadi satu-satunya pola visual pagination FE.
- Seluruh pagination memakai label Indonesia `Sebelumnya`, nomor halaman, dan `Berikutnya`.
- Maksimal lima nomor halaman ditampilkan di sekitar halaman aktif.
- Informasi selalu memakai format `Menampilkan X dari Y` dan `Halaman X dari Y`.
- Tombol aktif memakai warna sky, sedangkan tombol nonaktif memakai border slate yang konsisten.
- State loading serta halaman pertama/terakhir menonaktifkan tombol yang tidak dapat digunakan.
- Komponen dipakai pada halaman internal/owner, akuntan, fakturis, gudang, sales, toko, notifikasi, detail transaksi, dan detail dashboard.
- Standardisasi tampilan tidak mengubah sumber data: pagination server-side tetap server-side dan pagination lokal yang sudah ada tetap lokal.

Untuk list baru, backend wajib mengembalikan metadata `currentPage`, `totalPages`, `totalItems`, dan `itemsPerPage`. Search/filter harus diterapkan sebelum pagination agar FE tidak perlu mengambil seluruh dataset.

### Pendaftaran toko

- `app/(dashboard)/sales/toko-kelolaan/page.tsx`
- `services/sales.ts`
- `services/stores.ts`

### Komponen pagination bersama

- `components/shared/PaginationControls.tsx`

### Daftar toko kelolaan sales

- `app/(dashboard)/sales/toko-kelolaan/page.tsx`
- `services/grade.ts`

### Grade toko

- `app/(dashboard)/grade-toko/page.tsx`
- `app/(dashboard)/owner/grade-toko/page.tsx`
- `app/(dashboard)/sales/grade-toko/page.tsx`
- `app/(dashboard)/toko/grade-saya/page.tsx`
- `app/(dashboard)/sales/toko-kelolaan/[storeId]/grade-saya/page.tsx`
- `components/grade/StoreGradeWorkspace.tsx`
- `components/grade/StoreGradeCriteria.tsx`
- `services/grade.ts`

### Aging piutang sales

- `app/(dashboard)/sales/aging-piutang/page.tsx`
- `services/receivable.ts`
- `services/sales.ts`

### Retur barang

- `components/toko/TokoReturnsWorkspace.tsx`
- `app/(dashboard)/toko/retur/page.tsx`
- `app/(dashboard)/sales/toko-kelolaan/[storeId]/retur/page.tsx`
- `app/(dashboard)/gudang/retur-barang/page.tsx`
- `services/store-returns.ts`
- `services/damaged-goods.ts`

### Digital Marketing dan insight owner

- `app/(dashboard)/digital-marketing/dashboard/page.tsx`
- `app/(dashboard)/digital-marketing/kelola-katalog/page.tsx`
- `app/(dashboard)/digital-marketing/kelola-katalog/[productId]/page.tsx`
- `app/(dashboard)/owner/insight-katalog/page.tsx`
- `app/(dashboard)/owner/kelola-katalog/page.tsx`
- `components/catalog/CatalogOperationsOverview.tsx`
- `components/catalog/CatalogManagementList.tsx`
- `components/catalog/CatalogItemEditor.tsx`
- `services/digital-marketing-catalog.ts`
- `app/api/mock/features/digital-marketing/catalog/route.ts`
- `lib/mocks/catalog-data.ts`

### Searchable combobox

- `components/shared/SearchCombobox.tsx`
- `services/category.ts`, `services/brand.ts`, `services/divisions.ts`, dan `services/subdivisions.ts`
- `services/cities.ts`, `services/products.ts`, dan `services/warehouse-inventory.ts`
- `services/stores.ts`, `services/owner.ts`, dan `services/sales.ts`
- `app/(dashboard)/gudang/master-data/page.tsx` beserta route kategori, brand, divisi, dan subdivisi.

## 11. Rekomendasi Struktur Backend

Backend dapat mengikuti pembagian berikut tanpa harus menyalin implementasi mock:

- Validator:
  - validasi request pendaftaran toko;
  - validasi query grade;
  - validasi query aging piutang;
  - validasi kelayakan dan review retur per item.
- Controller:
  - hanya membaca request/context auth dan membentuk envelope response.
- Service:
  - transaksi pendaftaran toko dan assignment sales;
  - kalkulasi grade serta urutan filter global;
  - penyusunan ringkasan aging;
  - penerimaan parsial retur dan klasifikasi kondisi aktual.
- Repository:
  - scope toko berdasarkan role/user;
  - search database;
  - agregasi order/invoice/payment;
  - count dan pagination.
- Test:
  - unit test aturan bisnis;
  - integration test auth, validasi, query, metadata, dan response.

## 12. Checklist Integrasi Backend

### Pendaftaran toko

- [ ] Sales dapat mendaftarkan toko memakai kota tersimpan.
- [ ] Sales dapat mendaftarkan toko dengan kota baru.
- [ ] Dua metode kota tidak dapat dikirim bersamaan.
- [ ] Akun login dan profile pemilik tercipta.
- [ ] Toko baru berstatus `PENDING`, tidak aktif, dan terhubung ke sales.
- [ ] Field opsional boleh tidak dikirim.
- [ ] Email duplikat ditolak dengan `409`.
- [ ] Password tidak pernah muncul pada response/log.
- [ ] List Toko Kelolaan mengembalikan maksimal 10 toko per halaman.
- [ ] Search Toko Kelolaan diterapkan ke seluruh scope sales sebelum pagination.
- [ ] Toko baru berstatus `PENDING` tetap terlihat pada list sales pendaftar.
- [ ] Metadata pagination list Toko Kelolaan akurat.

### Grade toko

- [ ] Endpoint internal, sales, dan toko menerapkan scope akses yang benar.
- [ ] Hanya toko `VERIFIED` yang masuk list dan metadata Grade Toko; `PENDING`/`REJECTED` tidak muncul.
- [ ] Grade N hanya diberikan kepada toko `VERIFIED` yang belum cukup umur/data penilaian atau belum aktif.
- [ ] Search nama/email bekerja pada seluruh dataset.
- [ ] Filter Grade N/A+/A/B+/B/C+/C/D bekerja pada seluruh dataset.
- [ ] Search dan grade dapat digunakan bersamaan.
- [ ] Filter dilakukan sebelum pagination.
- [ ] Page 2 menghasilkan offset yang benar.
- [ ] Setiap halaman FE berisi maksimal 10 toko.
- [ ] `meta.totalItems` dan `meta.totalPages` berasal dari hasil filter global.
- [ ] Kriteria kalkulasi backend sama dengan kriteria yang ditampilkan FE.

### Aging piutang

- [ ] Scope hanya mencakup toko kelolaan sales login.
- [ ] Search dan filter risiko diterapkan sebelum pagination.
- [ ] Batas LOW/MEDIUM/HIGH sesuai definisi hari.
- [ ] Pagination tetap 10 data dan metadata benar.
- [ ] Ringkasan menghitung seluruh data, bukan hanya halaman aktif.
- [ ] `storeId` di luar scope sales ditolak atau menghasilkan not found.

### Retur barang

- [ ] Toko hanya membuat dan membaca retur miliknya.
- [ ] Sales hanya membuat dan membaca retur toko dengan assignment aktif.
- [ ] Batas 24 jam hanya diterapkan kepada `RETAILER`.
- [ ] `WHOLESALER` dan `DISTRIBUTOR` dapat mengajukan setelah 24 jam selama barang sudah diterima.
- [ ] Satu pengajuan mendukung kondisi berbeda pada setiap item.
- [ ] Gudang mengisi jumlah diterima dan hasil kondisi per item.
- [ ] Jumlah diterima nol tidak menambah stok.
- [ ] Penerimaan parsial menambah stok sesuai jumlah aktual.
- [ ] Search antrean gudang berlaku sebelum pagination.
- [ ] Antrean gudang hanya mengambil 10 data per halaman.
- [ ] Response membedakan jumlah diajukan dan jumlah diterima.

### Digital Marketing dan katalog

- [ ] Role `digital_marketing` dikenali oleh autentikasi dan organization membership.
- [ ] Login Digital Marketing diarahkan ke dashboard operasional katalog.
- [ ] Digital Marketing dapat membaca produk stok aktif beserta inventory dan klasifikasinya.
- [ ] Search katalog diterapkan pada seluruh data sebelum pagination 10 baris.
- [ ] Digital Marketing dapat membuat dan mengubah seluruh field katalog per item.
- [ ] Digital Marketing dapat mengunggah dan menghapus referensi gambar dari katalog.
- [ ] Digital Marketing dapat publish dan menonaktifkan katalog.
- [ ] Produk tanpa stok aktif ditolak saat hendak dimasukkan ke katalog.
- [ ] Owner dapat membaca katalog dan insight market.
- [ ] Owner mendapat `403` untuk create, update, delete, publish, nonaktif, dan upload gambar katalog.
- [ ] Digital Marketing tidak mendapat akses analytics finansial owner.
- [ ] System admin tidak otomatis mendapat izin tulis katalog kecuali kebijakan RBAC sengaja diubah.

### Searchable combobox

- [ ] Endpoint reference menerima `page=1`, `limit=10`, `search`, `sortBy=name`, dan `sortOrder=asc`.
- [ ] Search dilakukan case-insensitive terhadap seluruh dataset sebelum pagination.
- [ ] Kota dapat dicari melalui nama/provinsi; toko dan Sales melalui nama/email.
- [ ] Subdivisi menerapkan `categoryId` dan `divisionId` bersama search.
- [ ] Inventory menerapkan `warehouseId`, kondisi, dan pencarian nama produk bersama-sama.
- [ ] Tidak ada response combobox yang berisi lebih dari 10 item.
- [ ] Nilai ID pada payload create/update tidak berubah.
- [ ] Driver, gudang, dan opsi enum tetap menggunakan dropdown biasa.
- [ ] Owner dan Gudang dapat membuat, mengubah, serta menghapus kategori, brand, divisi, dan subdivisi.
- [ ] Role selain Owner, Gudang, dan system admin mendapat `403` untuk operasi tulis taxonomy.
- [ ] Kewenangan taxonomy Gudang tidak memperluas akses tulis ke master data lain.

### Nomor dokumen dan cetak faktur

- [ ] Seluruh dokumen baru memakai prefix dan format ringkas yang ditentukan.
- [ ] Sequence aman ketika beberapa transaksi dibuat bersamaan.
- [ ] Counter dan penyimpanan dokumen berada dalam transaksi database yang sama.
- [ ] Nomor historis tetap dapat dicari, dibuka, dan dicetak.
- [ ] Fakturis dapat mengekspor PDF invoice final yang sudah memiliki Delivery Order.
- [ ] Riwayat Fakturis menampilkan status proses gudang dan alasan faktur belum dapat dicetak.
- [ ] Delivery Order yang dibatalkan tidak dianggap siap cetak.
- [ ] PDF memuat kop dan logo lokal, penerima, identitas satu faktur, rincian barang, nilai pembayaran, jatuh tempo, serta tanda tangan Fakturis.
- [ ] PDF tetap dapat dibuat dengan fallback identitas teks apabila aset logo tidak dapat dibaca.
- [ ] Draft, invoice dibatalkan, dan invoice yang belum diteruskan ke gudang tidak menawarkan aksi cetak pada FE.

## 13. Skenario Acceptance Test FE–Backend

1. Cari toko yang secara urutan berada di halaman ketiga; toko harus muncul pada hasil halaman pertama setelah search.
2. Pilih Grade A; response hanya berisi Grade A dari seluruh scope dan total metadata sesuai seluruh Grade A.
3. Gabungkan search dan Grade N; hanya toko `VERIFIED` yang belum cukup data penilaian yang boleh ditemukan.
4. Pindah halaman Grade Toko; setiap halaman maksimal 10 baris dan tidak ada duplikasi ID.
5. Daftarkan toko dengan kota baru; setelah sukses toko muncul sebagai `PENDING` di Toko Kelolaan, tetapi tidak muncul di Grade Toko.
6. Buka Toko Kelolaan dengan lebih dari 10 toko; hanya 10 kartu tampil dan toko berikutnya berada di halaman 2.
7. Cari toko kelolaan yang semula berada di halaman 3; hasil harus ditemukan dari seluruh dataset.
8. Filter Aging Risiko Tinggi; hanya invoice lebih dari 90 hari yang muncul.
9. Cari nomor invoice yang berada di luar halaman pertama; invoice harus tetap ditemukan.
10. Pindah halaman Aging; setiap halaman harus tetap maksimal 10 baris.
11. Bandingkan card ringkasan aging sebelum dan sesudah pindah halaman; nilainya harus tetap karena ringkasan bersifat global.
12. Ajukan retur retail lebih dari 24 jam setelah penerimaan; backend harus menolak.
13. Ajukan retur wholesaler atau distributor lebih dari 24 jam setelah penerimaan; backend harus menerima selama Delivery Order sudah `RECEIVED`.
14. Ajukan dua item dengan kondisi awal berbeda; keduanya harus tersimpan dalam satu pengajuan.
15. Gudang menerima sebagian jumlah item dan mengisi kondisi berbeda per item; stok hanya bertambah sebesar jumlah aktual pada kondisi masing-masing.
16. Isi jumlah diterima nol untuk seluruh item tanpa menolak pengajuan; backend harus menolak request.
17. Cari retur yang berada di luar halaman pertama; retur harus ditemukan dan response tetap maksimal 10 baris.
18. Login sebagai Digital Marketing; dashboard operasional dan menu Kelola Katalog harus tersedia.
19. Cari produk yang berada di luar halaman pertama; produk harus ditemukan dan setiap halaman tetap maksimal 10 baris.
20. Buka satu item, ubah nama marketing, harga, deskripsi, klasifikasi, gambar, dan publish; buka kembali item dan seluruh nilai harus tetap tersimpan.
21. Nonaktifkan satu katalog; item tetap tersimpan sebagai draft dan tidak tampil pada endpoint katalog published.
22. Login sebagai owner; Insight Katalog dapat dibaca tetapi seluruh request tulis katalog dan upload gambar menghasilkan `403`.
23. Aktifkan mock server, lakukan edit katalog, lalu kembali ke daftar; data edit harus terlihat sampai proses Next.js direstart.
24. Cari kota, produk, toko, atau Sales yang tidak berada pada 10 data awal; record harus muncul karena search dilakukan server-side sebelum pagination.
25. Ketik cepat tiga kata kunci berbeda; hanya response request paling baru yang boleh ditampilkan.
26. Ubah kategori/divisi lalu gudang asal; subdivisi atau inventory lama harus langsung kosong dan tidak ikut tersimpan.
27. Buat dua Order pada tanggal UTC yang sama; nomor harus berakhir `0001` dan `0002`, sedangkan Invoice pada tanggal tersebut memiliki sequence sendiri.
28. Buka detail invoice final yang sudah memiliki Delivery Order sebagai Fakturis; tombol cetak membuka PDF dengan nama sesuai nomor invoice.
29. Buka detail draft, invoice dibatalkan, atau invoice yang belum memiliki Delivery Order; tombol cetak tidak boleh tampil.
30. Periksa hasil PDF pada ukuran A4; kop, tabel, total, dan tanda tangan harus tercetak utuh serta header tabel berulang jika rincian barang berlanjut ke halaman berikutnya.

Backend dianggap siap menggantikan mock jika seluruh checklist dan acceptance test di atas lulus dengan:

```env
NEXT_PUBLIC_USE_FEATURE_MOCK_SERVER=false
```
