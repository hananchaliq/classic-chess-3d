# Ultra-Realistic Living 3D Chess Arena — Rencana Peningkatan Visual, Karakter Hidup, Duel Sinematik & Bot AI

Meningkatkan **Classic Chess 3D** menjadi arena catur 3D sinematik yang hidup (*Grand Chess Chamber*) dengan 32 karakter fantasi realistis berartikulasi yang memiliki animasi *idle*, berjalan, menyerang, dan reaksi skak/kalah, sistem duel *capture* sinematik, mode latihan melawan Bot AI berbasis Web Worker (lengkap dengan *Hint* & evaluasi posisi), serta pengaturan kualitas grafis adaptif (`Low`, `Medium`, `High`, `Ultra`).

### User Review & Critical Decisions

> [!IMPORTANT]
> Berdasarkan konfirmasi Anda pada tahap klarifikasi, berikut adalah keputusan produk utama untuk pembaruan ini:

- **Confirmed Decision 1 — Cakupan Peningkatan Terpadu**: Mengimplementasikan secara utuh **Ruangan 3D Grand Chess Chamber**, **Karakter Bidak Hidup Beranimasi**, **Animasi Duel Capture & Kamera Sinematik**, **Mode Latihan Bot AI (Web Worker + Hint & Evaluasi)**, serta **Penyempurnaan Room Privat/Publik** dengan tetap mempertahankan aturan legal `chess.js` dan sinkronisasi `Socket.IO` yang sudah berjalan.
- **Confirmed Decision 2 — Karakter Hidup sebagai Utama + Toggle Staunton Klasik**: Menampilkan **Karakter Hidup 3D** (Kesatria Raja, Ratu Penyihir/Pemimpin, Golem Benteng, Pendeta Mistik Gajah, Kavaleri Kuda, dan Infanteri Pion) sebagai model utama, disertai tombol pengalih cepat ke **Bidak Kayu Staunton Klasik** kapan saja di HUD.
- **Confirmed Decision 3 — Kamera & Duel Capture Sinematik Terukur (~1.2 Detik)**: Saat terjadi langkah penangkapan bidak (*capture*) yang sah, karakter penyerang menghampiri target dan memainkan koreografi serangan singkat dengan fokus kamera sinematik (~1.2 detik) sebelum kembali ke sudut pandang pemain. Pengguna dapat mengubah mode ini ke **On**, **Reduced** (animasi serangan tanpa menggeser kamera), atau **Off** (perpindahan instan untuk catur cepat).

---

### 1. Overview & Core Concept

- **What It Does**: Mengubah area sekitar papan menjadi ruangan klub/perpustakaan catur kerajaan yang utuh (*Grand Chess Chamber*), menghidupkan setiap bidak catur sebagai prajurit dan penguasa berartikulasi penuh yang bernapas, melangkah, melompat, dan berduel ketika memakan bidak lawan, serta menyediakan lawan **Bot AI** dengan berbagai tingkat kesulitan dan fitur pelatih (*Hint*, *Undo*, & *Position Evaluation Bar*).
- **Target Audience / Persona**: Pemain catur yang menginginkan imersi visual setara game strategi fantasi AAA langsung di browser, sekaligus membutuhkan platform yang tetap mematuhi 100% aturan catur standar FIDE baik saat bermain melawan teman secara *real-time* maupun saat berlatih melawan AI.
- **Key Value**: Memisahkan secara tegas **State Logis Catur (`chess.js` & Server Authoritative)** dari **Representasi Visual & Animasi (`CharacterAnimator` & `CaptureSequence`)**, sehingga imersi sinematik tidak pernah mengorbankan keakuratan aturan, jam pertandingan, atau sinkronisasi jaringan.

---

### 2. User Experience & Visual Design

#### A. Arsitektur Ruangan 3D (*Grand Chess Chamber*)
- **Meja Pedestal & Lantai**: Papan catur berada di atas meja kayu Walnut berukir di tengah ruangan dengan lantai marmer gelap dan parket kayu yang memiliki refleksi halus.
- **Dinding Perpustakaan, Pilar & Jendela**: Dikelilingi dinding panel kayu Walnut gelap, pilar klasik beralur (*fluted columns*), rak buku perpustakaan (menggunakan `InstancedMesh` untuk efisiensi *draw call*), serta jendela tinggi di sisi ruangan yang memancarkan berkas cahaya matahari hangat (*sunbeams*).
- **Chandelier, Lampu Meja & Partikel Debu**: Lampu gantung kristal/kuningan (*chandelier*) di atas arena dan lampu meja hangat di sudut, dilengkapi partikel debu halus (*floating dust motes*) yang berkilau terkena cahaya pada preset kualitas `High` dan `Ultra`.

#### B. Desain Faksi & Karakter Bidak Hidup (6 Kelas Karakter Berartikulasi)
- **Identitas Dua Pasukan**:
  - **Pasukan Putih (Ivory & Royal Gold)**: Armor gading mengilap (`#F4EBDC`), pelat perak terang (`#D8DEE9`), dan jubah/aksen emas kerajaan (`#C7A66A`).
  - **Pasukan Hitam (Obsidian & Crimson Iron)**: Armor besi obsidian gelap (`#231F20`), baja tempa (`#3B322C`), dan jubah/aksen merah marun kerajaan (`#8C2D2D`).
- **Siluet & Anatomi 6 Jenis Karakter**:
  1. **Raja (Royal Monarch Knight)**: Tubuh lapis baja kerajaan, mahkota emas/besi menyatu di helm, jubah belakang yang bergerak mengikuti napas, dan pedang agung (*greatsword*) dua tangan.
  2. **Ratu (Arcane Sovereign / High Commander)**: Siluet anggun dengan jubah kerajaan bertingkat, mahkota runcing, tongkat kerajaan bercahaya (*scepter*) & bilah energi, serta partikel aura halus.
  3. **Benteng (Tower Golem / Siege Guardian)**: Tubuh raksasa berlapis baja tebal dengan bahu berbentuk menara benteng (*crenellated pauldrons*), perisai menara, dan palu godam berat yang menimbulkan efek getaran/debu saat menghantam.
  4. **Gajah (Mystic War Cleric /Hierophant)**: Jubah tinggi ramping dengan kerah mitre liturgis, staf tombak diagonal bercahaya, dan gerakan meluncur yang tenang.
  5. **Kuda (Cavalry Vanguard Knight)**: Prajurit kavaleri dengan helm/zirah kepala kuda perang yang ikonik, tombak kavaleri (*lance*) & perisai, serta animasi lompatan busur tinggi (*leap charge*) yang melompati karakter lain pada pola langkah L.
  6. **Pion (Infantry Footman)**: Prajurit infanteri kompak dengan helm ketopong, perisai bundar, dan tombak/pedang pendek, lengkap dengan efek transformasi cahaya saat mencapai baris ke-8 (**Promosi Pion**).

#### C. Empat Sudut Pandang Kamera & Pengaturan Visual
- **Player View**: Sudut pandang ergonomis dari belakang pasukan pemain.
- **Board View**: Sudut pandang lebih tinggi untuk membaca taktik seluruh petak secara jernih.
- **Inspection View**: Mode orbit bebas terukur untuk mengamati detail karakter dan ruangan 3D dari dekat.
- **Cinematic View**: Kamera otomatis yang meluncur mendekati petak pertarungan selama ~1.2 detik saat terjadi *capture* (dapat diatur ke `On`, `Reduced`, atau `Off`).
- **Panel Pengaturan Visual & Audio**:
  - *Graphics Quality*: `Low`, `Medium`, `High`, `Ultra` (mengatur *pixel ratio*, *shadow map*, detail geometri ruangan, dan partikel debu).
  - *Model Style*: `Living Characters (Karakter Hidup)` vs `Classic Staunton (Kayu Klasik)`.
  - *Cinematic Captures*: `On`, `Reduced`, `Off`.
  - *Sound & Ambience*: Efek suara langkah/pedang/armor dan suara atmosfer ruangan (*Ambient Sound*) yang disintesis secara prosedural via Web Audio API.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Sistem Karakter Hierarkis Berartikulasi (`THREE.Group` Skeletal Rig) + Dukungan Adapter GLB**
  - *Chosen Approach*: Membangun setiap karakter hidup sebagai rig artikulasi multi-sendi (`Root -> Pelvis -> Torso -> Head / LeftArm+Shield / RightArm+Weapon / Cape / LeftLeg / RightLeg`) menggunakan geometri PBR prosedural berdetail tinggi yang digerakkan oleh `CharacterAnimator` (*state machine* `idle`, `walk`, `leap`, `attack`, `hit_reaction`, `check_alert`, `defeat`, `victory`, `promote`), sembari menyediakan *loader pipeline* opsional untuk aset `.glb` kustom.
  - *Why*: Menjamin **0% risiko gagal muat (zero-404)**, memastikan ke-6 jenis bidak langsung tampil dengan anatomi, senjata, dan animasi hidup yang nyata di browser tanpa bergantung pada unduhan file eksternal berukuran puluhan megabyte, serta tetap menjaga *frame rate* yang mulus untuk 32 karakter sekaligus.
- **Decision 2: Pemisahan Ketat State Permainan dan Sekuens Duel Capture (`CaptureSequence`)**
  - *Chosen Approach*: Saat langkah *capture* divalidasi oleh `chess.js` (lokal/bot) atau dikonfirmasi server (`game:state` di multiplayer), state logis catur langsung diperbarui secara otoritatif, sementara *renderer* 3D menjalankan antrean transisi visual non-destruktif (`move -> attack -> hit_reaction + defeat -> settle`) selama ~1.2 detik. Jika pemain melangkah cepat di tengah animasi, animasi sebelumnya langsung diselesaikan (*fast-forward*) ke posisi petak tujuan.
  - *Why*: Memastikan animasi pertarungan tidak pernah mengunci input pemain, tidak mengubah giliran, dan tidak menyebabkan *desync* pada pertandingan *blitz/bullet*.
- **Decision 3: Engine Bot AI & Analisis Taktis melalui Web Worker**
  - *Chosen Approach*: Menjalankan perhitungan langkah Bot AI dan evaluasi posisi di dalam **Web Worker** terpisah (`bot-worker.ts`) dengan 5 tingkat kesulitan terukur (*Beginner*, *Club Player*, *Tactician*, *Master*, *Grandmaster Engine*), fitur **Petunjuk Langkah (Hint)** beserta alasan taktis singkat, dan **Evaluation Bar** tanpa pernah membekukan *main thread* rendering 3D.
  - *Why*: Menjaga animasi *idle* karakter dan rotasi kamera tetap berjalan mulus saat AI sedang menghitung langkah.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### Architecture & Animation Pipeline Diagram

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│                       CLASSIC CHESS 3D — LIVING ARENA CLIENT                       │
│                                                                                    │
│  ┌────────────────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │        3D Arena Viewport (Three.js)    │  │   Unified HUD & Mode Controllers │  │
│  │  • GrandChessChamber (Walls, Pillars,  │  │  • Mode: Local / Bot AI / Online │  │
│  │    Window Sunbeams, Chandelier, Dust)  │  │  • Bot Difficulty, Hint & Eval   │  │
│  │  • ChessBoard3D (Walnut/Maple Pedestal)│  │  • Private/Public Room + Link    │  │
│  │  • 32 LivingChessPiece / Staunton Mesh │  │  • Graphics & Capture Settings   │  │
│  └───────────────────┬────────────────────┘  └─────────────────┬────────────────┘  │
│                      │                                         │                   │
│                      ▼                                         ▼                   │
│  ┌────────────────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │   CharacterAnimator & CaptureSequence  │  │   Game State & Worker Bridges    │  │
│  │  • States: idle → walk/leap → attack   │  │  • Authoritative Socket.IO Sync  │  │
│  │    → hit_reaction → defeat / promote   │  │  • Web Worker AI Engine & Hint   │  │
│  │  • CinematicCamera (Player/Board/Duel) │  │  • Procedural Combat & Room SFX  │  │
│  └────────────────────────────────────────┘  └──────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

#### Matriks Preset Kualitas Grafis (`GraphicsSettings`)

| Preset | Pixel Ratio | Bayangan (Shadows) | Detail Ruangan 3D & Partikel | Animasi Duel Capture |
| :--- | :--- | :--- | :--- | :--- |
| **Low** | `1.0` | Nonaktif | Meja & Papan Inti, tanpa partikel debu | Instan / Ringkas |
| **Medium** | `min(dpr, 1.25)` | Shadow Map `1024px` | Ruangan Penuh + Pencahayaan Klub | Aktif (Tanpa Geser Kamera) |
| **High** | `min(dpr, 1.75)` | PCF Soft Shadow `1024px` | Ruangan Penuh + Chandelier + Debu Halus | Aktif Sinematik (~1.2 dtk) |
| **Ultra** | `min(dpr, 2.0)` | PCF Soft Shadow `2048px` | Detail Maksimum + Sunbeams + Partikel Penuh | Aktif Sinematik Penuh |

#### Penyempurnaan Room Multiplayer & Mode Bot AI
- **Visibilitas & Siklus Hidup Room (`Private` vs `Public`)**:
  - Pembuat room dapat memilih **Room Privat** (hanya dapat dimasuki via kode 6 karakter atau tautan undangan `?room=KODE` dan disembunyikan dari daftar lobi publik) atau **Room Publik** (tampil di daftar lobi terbuka).
  - Pemilik room dapat membatalkan room sebelum pertandingan dimulai (`room:cancel`), dan room yang tidak aktif otomatis kedaluwarsa.
- **Mode Latihan Bot AI (`Play vs Bot`)**:
  - Pilihan warna (`Putih`, `Hitam`, `Acak`), 5 tingkat kesulitan dengan parameter kedalaman dan waktu pikir yang transparan, tombol **Minta Petunjuk (Hint)** yang menyorot langkah terbaik di papan 3D beserta penjelasan taktisnya (misal: *"Mengamankan petak pusat & mengancam bidak lawan"*), **Evaluation Bar** (keunggulan Putih/Hitam dalam satuan pion), serta **Review & Undo** langkah latihan.
