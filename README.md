# ifs24049-pabwe-p3 — Produktif

Studi kasus Praktikum 3 mata kuliah PABWE: aplikasi web interaktif satu halaman (SPA)
dengan tiga fitur berbeda dipisah lewat tab — **Expense Tracker**, **Bookmark Manager**,
dan **Quiz App** — murni JavaScript + `localStorage`, tanpa backend/API.

## Struktur Proyek

```
ifs24049-pabwe-p3/
├── index.html          # Markup + struktur tab & modal (satu-satunya file HTML)
├── assets/
│   └── script.js       # Seluruh logika JavaScript (DOM, event, localStorage)
└── README.md
```

Styling memakai Tailwind CSS (Play CDN), Google Fonts (Inter & Manrope), dan Tabler Icons
lewat CDN — sesuai yang diizinkan modul. Tidak ada dependency build/backend.

## Fitur

### 1. Expense Tracker (`?tab=expense`)
- CRUD transaksi (judul, kategori, jumlah, tipe, tanggal) lewat modal
- Ringkasan total pemasukan, pengeluaran, dan saldo
- Cari (judul), filter (tipe & kategori), sort (terbaru/terlama/jumlah)
- Validasi: field wajib tidak boleh kosong, jumlah harus angka > 0
- Data tersimpan di `localStorage` key `produktif_expenses`

### 2. Bookmark Manager (`?tab=bookmark`)
- CRUD bookmark (nama, URL, kategori, catatan opsional) lewat modal
- Validasi URL wajib diawali `http://` atau `https://`
- Klik judul/URL membuka tab baru (`target="_blank" rel="noopener noreferrer"`)
- Cari (nama/URL/kategori), sort (A-Z / Z-A / terbaru)
- Data tersimpan di `localStorage` key `produktif_bookmarks` (key terpisah dari Expense)

### 3. Quiz App (`?tab=quiz`)
- 7 soal pilihan ganda (≥5) disimpan sebagai *array of object* di `script.js`
- Alur: mulai → jawab per soal dengan feedback benar/salah → skor akhir → main lagi
- High score tersimpan di `localStorage` key `produktif_quiz_highscore`

### Integrasi Tab
- Hanya satu panel aktif dalam satu waktu
- Tab aktif disimpan & dipulihkan lewat **query URL** (`?tab=expense|bookmark|quiz`),
  bukan `localStorage` — sesuai `history.replaceState`
- Setiap fitur punya key `localStorage` sendiri, tidak saling menimpa

## Cara Menjalankan

1. Buka folder ini di VS Code.
2. Jalankan lewat ekstensi **Live Server** (klik kanan `index.html` → "Open with Live Server").
3. Coba tiap tab, tambah beberapa data, refresh halaman — data & tab terakhir tetap ada.

## Catatan

- Tidak ada backend/API — semua data disimpan lokal di browser lewat `localStorage`.
- Kode `assets/script.js` dikelompokkan per fitur dengan komentar section (UTIL, TAB SWITCHER,
  MODAL HELPER, EXPENSE TRACKER, BOOKMARK MANAGER, QUIZ APP, INIT) untuk memudahkan penjelasan
  saat video grading.
