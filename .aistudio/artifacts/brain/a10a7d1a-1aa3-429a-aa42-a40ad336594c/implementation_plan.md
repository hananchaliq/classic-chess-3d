# Rencana Implementasi: Optimasi Mobile 2D / Desktop 3D, Tata Letak Sederhana, Panduan Pengguna & Palet Warna Hangat

## 1. Tujuan & Konteks Masalah
Berdasarkan hasil analisis PageSpeed Insights dan kebutuhan pengguna:
1. **Performa & Kompatibilitas Mobile**: Memuat engine 3D (Three.js, WebGL, geometri 3D) secara langsung di semua perangkat membuat beban JavaScript awal tinggi (Total Blocking Time besar) dan kurang nyaman di layar HP/Tablet.
2. **Pemisahan Visual 2D & 3D**:
   - **Mobile & Tablet (`< 1024px`)**: Otomatis menggunakan **Papan Catur 2D SVG Ringan (`ChessBoard2D`)** tanpa memuat bundle Three.js sama sekali agar cepat, responsif, dan hemat baterai/memori.
   - **Desktop (`>= 1024px`)**: Otomatis menampilkan **Papan Catur 3D (`ChessBoard3D`)** melalui *dynamic import* (`next/dynamic`, `ssr: false`), dilengkapi **tombol pengalih 2D / 3D** agar pengguna desktop/laptop juga bebas beralih ke mode 2D kapan saja.
3. **Sistem Palet 5 Warna Solid (Tanpa Gradasi) + Tombol Tema Terang & Gelap Hangat**:
   Menggunakan kelima warna dari referensi gambar secara menyeluruh dan saling melengkapi (**tanpa gradasi CSS**):
   - `#291C0E` (*Deep Espresso*)
   - `#6E473B` (*Roasted Chestnut*)
   - `#A78D78` (*Warm Taupe*)
   - `#BEB5A9` (*Soft Warm Stone*)
   - `#E1D4C2` (*Warm Cream*)
4. **Tata Letak Sederhana & Panduan Pengguna Interaktif**:
   - Menyederhanakan navigasi dan panel kontrol agar bersih, rapi, dan mudah dipahami di layar HP, tablet, maupun desktop.
   - Menambahkan **Panel Panduan Ringkas** di layar utama serta **Pop-up Panduan Interaktif Langkah demi Langkah** untuk membantu pemain baru maupun pemain yang ingin bermain bersama teman.

---

## 2. Desain Sistem Warna (5 Warna Solid Saling Melengkapi, Tanpa Gradasi)

Seluruh komponen akan menggunakan variabel CSS / kelas warna solid dari kelima warna palet dengan tombol **Ganti Tema (Terang Hangat / Gelap Hangat)** di bilah atas:

| Elemen UI | Tema Terang Hangat (Default) | Tema Gelap Hangat |
| :--- | :--- | :--- |
| **Latar Utama (Canvas)** | `#E1D4C2` (Warm Cream) | `#291C0E` (Deep Espresso) |
| **Panel & Kartu Utama** | `#BEB5A9` (Soft Warm Stone) | `#6E473B` (Roasted Chestnut) |
| **Sub-Panel & Pembatas (Border)** | `#A78D78` (Warm Taupe) | `#A78D78` (Warm Taupe) |
| **Aksen Interaktif & Tombol Aktif** | `#6E473B` (Roasted Chestnut) | `#E1D4C2` (Warm Cream) |
| **Teks Utama & Kontras Tinggi** | `#291C0E` (Deep Espresso) | `#E1D4C2` (Warm Cream) |
| **Teks Sekunder & Label** | `#6E473B` (Roasted Chestnut) | `#BEB5A9` (Soft Warm Stone) |
| **Petak Papan Catur 2D** | Terang: `#E1D4C2` · Gelap: `#A78D78` · Bingkai: `#291C0E` & `#6E473B` | Terang: `#E1D4C2` · Gelap: `#A78D78` · Bingkai: `#291C0E` & `#BEB5A9` |

---

## 3. Arsitektur & Komponen yang Akan Dibuat / Dimodifikasi

### A. Komponen Baru: `components/chess/ChessBoard2D.tsx`
- Papan catur 2D berbasis SVG & CSS Grid yang sangat ringan (0 KB ketergantungan 3D).
- **Fitur**:
  - Ikon bidak catur Staunton 2D vektor (SVG) dengan kontras tegas: Bidak Putih (`#E1D4C2` dengan garis tegas `#291C0E`) dan Bidak Hitam (`#291C0E` dengan detail aksen `#BEB5A9`).
  - Mendukung klik/sentuh (*tap-to-move*) dan seret (*drag-and-drop*) yang ramah layar sentuh HP/Tablet (`touch-action: manipulation`).
  - Indikator petak terpilih, titik langkah sah (*legal moves*), sorotan langkah terakhir, saran taktis (*hint*), dan peringatan Raja sedang Skak (*Check*).
  - Koordinat baris (`1–8`) dan kolom (`a–h`) yang otomatis menyesuaikan orientasi papan (Putih/Hitam) serta tombol putar papan.

### B. Komponen Baru: `components/game/UserGuideModal.tsx`
- Menyediakan **2 bentuk panduan** sesuai pilihan pengguna:
  1. **Kartu Panduan Ringkas (`QuickGuideCard`)** di layar utama: menampilkan 4 poin singkat cara bermain (Pilih Mode, Gerakkan Bidak, Gunakan Hint AI, dan Undang Teman di Room Online) beserta tombol **"Buka Panduan Lengkap"**.
  2. **Pop-up Interaktif Langkah demi Langkah (`UserGuideModal`)**: panduan visual bertahap (4 langkah dengan navigasi *Sebelumnya / Selanjutnya*) yang menjelaskan:
     - **Langkah 1**: Cara Menggerakkan Bidak & Indikator Petak (2D & 3D).
     - **Langkah 2**: Bermain Melawan Bot AI & Membaca Evaluasi / Hint.
     - **Langkah 3**: Bermain Online Bersama Teman (Buat Room, Bagikan Kode, Terima Lawan).
     - **Langkah 4**: Aturan Khusus FIDE (Rokade, Promosi Pion, En Passant, Klaim Remis) & Pengaturan Tampilan (2D/3D & Tema).

### C. Optimasi & Penyederhanaan: `components/game/ClassicChessApp.tsx`
- **Lazy Loading 3D**: Mengubah import `ChessBoard3D` menjadi `dynamic(() => import('../chess/ChessBoard3D'), { ssr: false })` sehingga kode Three.js hanya diunduh ketika mode 3D aktif di perangkat Desktop.
- **Deteksi Perangkat Otomatis + Opsi Beralih di Desktop**:
  - Saat dibuka di HP/Tablet (`< 1024px`), otomatis menggunakan tampilan **2D**.
  - Saat dibuka di Desktop (`>= 1024px`), otomatis menggunakan tampilan **3D** dengan tombol pengalih cepat **`Mode 2D / Mode 3D`** di bilah kontrol papan.
- **Tombol Tema Terang & Gelap Hangat**: Menyediakan tombol pengalih tema (`Terang Hangat` / `Gelap Hangat`) yang menerapkan kelima warna palet secara konsisten di seluruh halaman.
- **Tata Letak Responsif yang Lebih Sederhana**:
  - Di Mobile & Tablet: Papan catur 2D tampil proporsional (`aspect-square`) di bagian atas tanpa terpotong, diikuti bar pemain yang ringkas, pemilih mode (Bot AI / Room Online / Latihan), panduan singkat, dan riwayat langkah.
  - Di Desktop: Tata letak 2 kolom bersih (Papan Catur 3D/2D di kiri, Panel Mode + Panduan Ringkas + Riwayat Langkah di kanan).

### D. Penyesuaian Warna & Kesederhanaan Komponen Pendukung
- `components/game/PlayerClockBar.tsx`: Menyesuaikan warna bar pemain, jam catur, dan indikator giliran menggunakan 5 warna palet solid (`#291C0E`, `#6E473B`, `#A78D78`, `#BEB5A9`, `#E1D4C2`).
- `components/game/MoveHistoryPanel.tsx`: Menyesuaikan tabel notasi langkah dan tombol aksi (Undo, Menyerah, Remis) dengan warna palet baru dan tata letak lebih bersih.
- `components/game/RoomLobbyAndChatPanel.tsx`: Menyesuaikan lobi multiplayer dan ruang tunggu agar selaras dengan palet 5 warna solid tanpa mengubah logika sinkronisasi room yang sudah berjalan stabil.
- `components/chess/PromotionModal.tsx` & `app/globals.css` & `app/layout.tsx`: Menyelaraskan variabel warna tema terang/gelap hangat dan memperbaiki meta viewport/performa halaman.

---

## 4. Tahapan Verifikasi
1. Memastikan tidak ada penggunaan warna gradasi (`bg-gradient-*`) pada antarmuka utama dan kelima warna (`#291C0E`, `#6E473B`, `#A78D78`, `#BEB5A9`, `#E1D4C2`) berpadu secara solid di Tema Terang maupun Tema Gelap.
2. Memastikan tampilan Mobile/Tablet (`< 1024px`) merender `ChessBoard2D` secara instan tanpa mengunduh bundle Three.js, serta tampilan Desktop (`>= 1024px`) merender `ChessBoard3D` dengan tombol ganti ke `2D`.
3. Menguji Panel Panduan Ringkas dan Pop-up Panduan Interaktif Langkah demi Langkah.
4. Menjalankan pemeriksaan tipe dan build produksi (`lint_applet` dan `compile_applet`) untuk memastikan tidak ada error dan performa optimal.
