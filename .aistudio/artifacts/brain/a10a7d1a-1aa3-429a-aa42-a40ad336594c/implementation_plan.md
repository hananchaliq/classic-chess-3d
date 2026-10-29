# Rencana Implementasi: Restrukturisasi Arena Fokus, Animasi Interaktif & Pendalaman Tema Gelap Classic Chess

## 1. Gambaran Umum Aplikasi (App Overview)
Pembaruan menyeluruh pada aplikasi **Classic Chess** untuk menghadirkan pengalaman bermain catur yang jauh lebih fokus, hidup dengan animasi halus, serta bebas dari elemen antarmuka yang menumpuk:
- **Layout "Arena Fokus" ala Chess.com**: Menghapus duplikasi navigasi, kartu panduan besar di bawah papan, dan footer yang memakan ruang. Seluruh layar terfokus pada area papan catur utama di sisi kiri/tengah dan **satu Panel Kanan Terpadu (Unified Control Deck)** yang mengintegrasikan mode permainan, konfigurasi lawan/ruangan, riwayat notasi, dan kontrol aksi.
- **Animasi Lengkap & Responsif (`motion/react` + CSS Transform)**: Menambahkan animasi meluncur (*spring glide*) saat bidak bergerak, efek visual saat memakan bidak (*capture burst/scale*), sorotan dinamis saat Raja terkena Skak (*check pulse*), serta transisi halus saat berpindah tab atau membuka panel.
- **Tema Gelap Berdimensi Tinggi (Deep Dimensional Dark Mode)**: Merombak tema gelap agar tidak lagi terlihat datar (*flat*) dengan menerapkan hierarki kedalaman berlapis (*layered surface elevation*), pencahayaan ambient radial halus, bingkai papan kayu espresso bertekstur dengan bayangan dalam (*inset & drop shadow*), serta aksen garis tepi *warm bronze specular*.
- **Panduan Kompak di Bar Atas**: Menggantikan kartu panduan besar di bawah papan menjadi tombol bantuan ringkas di *top bar* yang membuka pop-up panduan interaktif langkah demi langkah kapan saja dibutuhkan.
- **Fleksibilitas Responsif Semua Perangkat & Aturan 3D Khusus Komputer**: Papan catur menyesuaikan ukuran layar secara proporsional (`clamp` / rasio 1:1 fleksibel) dari layar ponsel kecil, tablet, hingga monitor desktop lebar. Mode **3D WebGL (`ChessBoard3D`)** dikunci secara eksklusif hanya untuk pengguna Komputer/Desktop (`>= 1024px`), sementara HP dan Tablet otomatis menjalankan papan 2D bergaya Chess.com yang ringan.

---

## 2. Arahan Estetika & Dimensi Tema Gelap (Aesthetic Direction)
- **Domain**: Permainan Strategi Papan Catur Modern & Editorial Mewah (*Tactile Chess Arena*).
- **Persona Estetika**: **Warm Obsidian & Espresso Club** — memadukan ketajaman kontras ala platform catur turnamen modern (Chess.com) dengan kemewahan material kayu mahoni/espresso, tipografi serif klasik (*Glinster / Laluna* via *Playfair Display*), dan emblem Kuda Catur Bermahkota.
- **Penyempurnaan Tema Gelap (Anti-Flat Dark Theme)**:
  - **Kedalaman 3 Lapis (3-Tier Surface Depth)**: Memisahkan kanvas latar belakang utama (`#120B06` dengan pendaran radial halus `#291C0E`), permukaan kartu/panel utama (`#1C120B`), dan permukaan elemen interaktif/kotak aktif (`#291C0E` hingga `#382615`).
  - **Specular Rim & Tactile Framing**: Setiap panel dan bingkai papan catur di mode gelap dilengkapi garis tepi atas yang sedikit lebih terang (`border-top: 1px solid rgba(225, 212, 194, 0.14)`) dan bayangan bawah berlapis untuk menciptakan ilusi objek fisik yang nyata.

---

## 3. Palet Warna (Color Palette)

| Peran Warna | Mode Gelap Berdimensi (Deep Espresso) | Mode Terang Hangat (Warm Editorial) | Keterangan Penggunaan |
| :--- | :--- | :--- | :--- |
| **Background Primary (Kanvas)** | `#120B06` (Obsidian Roast + Radial `#1F140B`) | `#E1D4C2` (Warm Cream Linen) | Latar belakang utama ruang arena catur |
| **Background Secondary (Panel/Deck)** | `#1B120A` (Elevated Espresso Surface) | `#EBE1D3` (Soft Ivory Card) | Panel samping terpadu, bar pemain, dan header |
| **Surface Interactive / Elevated** | `#291C0E` (Deep Coffee Container) | `#DFD3C3` (Warm Sand Surface) | Tab aktif, baris riwayat langkah, dan pemilih mode |
| **Text Primary** | `#F2E8DA` (Crisp Parchment Cream) | `#291C0E` (Deep Espresso Ink) | Judul, nama pemain, jam catur, dan notasi utama |
| **Text Secondary / Muted** | `#B8A390` (Warm Muted Taupe) | `#6E473B` (Roasted Umber) | Label sekunder, koordinat, dan keterangan langkah |
| **Accent Primary** | `#C89D66` (Burnished Warm Gold / Amber) | `#6E473B` (Rich Mahogany) | Tombol aksi utama, indikator giliran aktif, dan sorotan |
| **Accent Secondary** | `#A78D78` (Warm Mocha Bronze) | `#A78D78` (Warm Mocha) | Garis tepi aktif, lencana emblem, dan tombol sekunder |
| **Semantic Status (Check / Win / Draw)** | `#10B981` (Win), `#F59E0B` (Draw/Hint), `#EF4444` (Check/Alert) | `#059669` (Win), `#D97706` (Draw/Hint), `#DC2626` (Check/Alert) | Sorotan petak Raja saat Skak, panah bantuan AI, dan status hasil |

*(Ditambah 8 tema papan catur 2D pilihan seperti Espresso & Cream, Classic Tournament Green, Walnut Club, Icy Sea, dll. yang dapat diganti langsung oleh pemain).*

---

## 4. Tipografi (Typography)
- **Heading & Branding Font**: `Playfair Display` (SemiBold 600 & Bold 700, terinspirasi karakter serif klasik *Glinster* dan *Laluna*) untuk identitas **Classic Chess**, modal kemenangan, dan judul bagian utama.
- **Body & UI Controls**: `Plus Jakarta Sans` (Regular 400, Medium 500, SemiBold 600) untuk keterbacaan optimal pada tombol, tab, dan panduan ringkas di semua ukuran layar.
- **Monospace (Jam, Notasi & Kode Room)**: `JetBrains Mono` dengan `tabular-nums` untuk jam catur, tabel notasi langkah FIDE, dan kode ruangan 6 huruf agar angka tidak bergeser saat berdetak.

---

## 5. Struktur Layout Baru & Responsivitas (Layout Structure)
Elemen yang berlebihan (duplikasi kartu mode di atas kanan, kartu panduan besar di bawah papan, dan footer panjang) dihapus dan digantikan oleh struktur **Arena Fokus**:

1. **Compact Top Bar (3 Zona Bersih)**:
   - **Kiri**: Emblem Kuda Catur Bermahkota + wordmark **Classic Chess**.
   - **Tengah**: Pemilih Mode Permainan langsung dalam 1 baris bersih (*Lawan Bot AI*, *Multiplayer Online*, *Latihan Lokal*).
   - **Kanan**: Tombol **Panduan Ringkas** (ikon tanda tanya/buku yang membuka pop-up interaktif), tombol **Studio Tampilan Papan**, dan pengalih **Tema Gelap/Terang**.
2. **Kolom Utama Kiri/Tengah — Arena Papan Catur Proporsional**:
   - **Bar Pemain Lawan (Atas)** & **Bar Pemain Anda (Bawah)**: Menampilkan avatar emblem, nama, selisih bidak yang dimakan, dan jam catur beranimasi.
   - **Kanvas Papan Catur Fleksibel**: Ukuran papan otomatis menyesuaikan tinggi dan lebar viewport (`max-w-[min(100%,72vh)]` di desktop dan `100%` lebar layar di mobile) sehingga papan serta kedua jam pemain terlihat utuh dalam satu layar tanpa perlu *scroll* berlebih.
   - **Toolbar Cepat di Bawah Bar Pemain**: Tombol ringkas untuk Putar Papan, Suara, Bantuan AI (*Hint*), dan pengalih **2D / 3D** (tombol 3D hanya dirender pada layar Desktop `>= 1024px`).
3. **Kolom Kanan — Satu Panel Kontrol Terpadu (Unified Sidebar Deck)**:
   - Menggunakan sistem tab beranimasi (`motion/react`) yang rapi:
     - **Tab 1: Pertandingan & Notasi**: Pengaturan instan (level AI / kontrol waktu), daftar langkah notasi aljabar dua kolom yang otomatis *scroll* ke langkah terbaru, serta tombol aksi pertandingan (Undo, Mulai Ulang, Remis, Menyerah).
     - **Tab 2: Lobi & Obrolan (Aktif di Multiplayer)**: Pembuatan/gabung kode room 6 karakter, daftar room publik, dan obrolan langsung bersama lawan.
4. **Adaptasi Mobile & Tablet (`< 1024px`)**:
   - Papan 2D tampil penuh dan tajam di bagian atas dengan bar lawan dan pemain mengapit papan secara kompak.
   - Panel Kontrol di bawah papan disajikan dalam bentuk kartu ber-tab yang ringkas dan bebas *overflow* horizontal.

---

## 6. Fitur Utama & Sistem Animasi (Core Capabilities)
- **Animasi Pergerakan Bidak & Efek Makan (`ChessBoard2D.tsx`)**:
  - Setiap bidak 2D dianimasikan menggunakan `motion/react` (`layoutId` / transisi koordinat *spring* cepat `< 180ms`) sehingga bidak terlihat meluncur mulus dari petak asal ke petak tujuan.
  - Saat terjadi langkah memakan bidak (*capture*), muncul efek gelombang cincin halus (*capture ripple*) pada petak tujuan dan animasi masuk pada daftar bidak yang tertangkap di bar pemain.
  - Saat Raja berada dalam posisi **Skak (Check)**, petak Raja menampilkan pendaran merah berdenyut (*radial crimson pulse*) disertai indikator status yang jelas.
- **Animasi Transisi Antarmuka (`ClassicChessApp.tsx` & Panel)**:
  - Indikator tab aktif menggunakan animasi *sliding pill* (`layoutId="activeTab"`), perpindahan isi panel menggunakan `AnimatePresence` (`opacity` & `translateY`), dan modal hasil pertandingan/panduan muncul dengan efek *spring scale* yang elegan.
- **Panduan Interaktif Kompak (`UserGuideModal.tsx`)**:
  - Kartu panduan besar di halaman utama dihapus agar tidak memenuhi layar.
  - Digantikan oleh tombol **Panduan** di *top bar* yang membuka pop-up interaktif ber-tab kompak: (1) *Cara Jalan & Gerakan Bidak*, (2) *Aturan Khusus FIDE (Rokade, En Passant, Promosi)*, dan (3) *Cara Main Multiplayer & Kustomisasi Tema*.
- **Isolasi Ketat Papan 3D Khusus Desktop**:
  - Komponen Three.js (`ChessBoard3D`) dimuat secara *lazy* (`next/dynamic`, `ssr: false`) hanya ketika lebar layar terdeteksi `>= 1024px` dan pengguna memilih mode 3D. Pengguna smartphone dan tablet dijamin 100% menggunakan mode 2D berkinerja tinggi.

---

## 7. Di Luar Cakupan (Out of Scope)
- Mengubah protokol backend Socket.IO / REST API multiplayer yang sudah stabil.
- Menambahkan fitur login akun pihak ketiga (OAuth) atau sistem pembayaran.
- Merender model 3D WebGL pada perangkat mobile/tablet (demi menjaga performa dan skor PageSpeed mobile).
