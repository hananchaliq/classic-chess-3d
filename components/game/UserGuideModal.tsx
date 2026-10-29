'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChessBrandEmblem } from './ChessBrandLogo.tsx';
import {
  ChevronLeft,
  ChevronRight,
  X,
  MousePointerClick,
  Bot,
  Users,
  Palette,
  CheckCircle2,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  isDesktopViewport: boolean;
  effectiveBoardMode: '2d' | '3d';
  onToggleDesktopBoardMode?: () => void;
}

const GUIDE_STEPS = [
  {
    id: 'moves',
    tabLabel: '1. Gerak & FIDE',
    title: 'Cara Melangkah & Aturan FIDE',
    subtitle: 'Kendali papan catur ala Chess.com yang presisi di semua layar',
    icon: MousePointerClick,
    points: [
      'Klik atau tarik bidak milik Anda. Petak kosong yang sah ditandai titik lingkaran, sedangkan bidak lawan yang bisa dimakan ditandai cincin sudut.',
      'Klik kanan pada petak mana saja untuk memberi tanda warna taktis.',
      'Mendukung penuh aturan resmi FIDE: Rokade (O-O & O-O-O), En Passant, Promosi Pion, dan Klaim Remis.',
    ],
    tip: 'Gunakan tombol "Putar" di bawah papan untuk membalik orientasi Putih atau Hitam.',
  },
  {
    id: 'themes',
    tabLabel: '2. Tema & Bidak',
    title: '12 Tema Papan 2D & 8 Tema Bidak',
    subtitle: 'Diatur praktis lewat 1 tombol sederhana di bawah papan',
    icon: Palette,
    points: [
      'Klik 1 tombol "Tema" di bawah papan 2D untuk memilih 12 tema papan (Rennale Forest, Archiova Bronze, Vellure Sage, Nextgenix Tech, Chess.com Green, dll.).',
      'Bidak catur 2D memiliki 8 tema warna & siluet tersendiri (Rennale Jade, Archiova Bronze, Vellure Organic, Nextgenix Cyber, Imperial Gold, dll.).',
      'Khusus pengguna Komputer/Desktop (>= 1024px), tersedia mode 3D dengan kontrol kamera minimalis.',
    ],
    tip: 'Gunakan tombol "Ganti Cepat" di dalam menu Tema untuk mencoba kombinasi papan & bidak secara instan.',
  },
  {
    id: 'bot',
    tabLabel: '3. Bot AI & Hint',
    title: 'Lawan Bot AI & Panah Saran (Hint)',
    subtitle: 'Latihan taktis dari level Pemula hingga Grandmaster',
    icon: Bot,
    points: [
      'Pilih 1 dari 5 tingkat kesulitan AI (Pemula ~600 ELO hingga Grandmaster ~2100 ELO) langsung dari panel kanan.',
      'Tekan tombol "Hint" saat giliran Anda untuk memunculkan panah saran langkah terbaik langsung di atas papan.',
      'Bar evaluasi vertikal di sisi kiri papan menampilkan keunggulan posisi Putih dan Hitam secara real-time.',
    ],
    tip: 'Gunakan tombol "Undo Langkah" untuk mempelajari ulang variasi langkah.',
  },
  {
    id: 'multiplayer',
    tabLabel: '4. Multiplayer',
    title: 'Bermain Bersama Teman (Room Online)',
    subtitle: 'Sinkronisasi real-time dengan kode undangan 6 huruf',
    icon: Users,
    points: [
      'Pilih mode "Multiplayer" di bar atas, tentukan durasi jam catur (Bullet, Blitz, Rapid, atau Santai), lalu klik "Buat Room".',
      'Salin kode 6 huruf atau tautan undangan dan kirimkan ke teman Anda.',
      'Begitu kedua pemain bergabung, klik "Mulai" untuk menjalankan jam catur dan obrolan.',
    ],
    tip: 'Koneksi room dilengkapi penyimpanan sesi otomatis jika halaman tidak sengaja ter-refresh.',
  },
];

export default function UserGuideModal({
  isOpen,
  onClose,
  themeMode,
  onToggleTheme,
  isDesktopViewport,
  effectiveBoardMode,
  onToggleDesktopBoardMode,
}: UserGuideModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const isLight = themeMode === 'light';
  const currentStep = GUIDE_STEPS[stepIndex];
  const StepIcon = currentStep.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#060E0A]/75 backdrop-blur-xs p-3 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border p-4 sm:p-5 transition-colors ${
              isLight
                ? 'bg-[#F4F1EA] border-[#C5BFB3] text-[#12231B] shadow-2xl'
                : 'bg-[#102018] border-[#7A9A76]/45 text-[#F3ECE0] shadow-[0_24px_60px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(223,194,155,0.16)]'
            }`}
          >
            {/* Compact Header */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#7A9A76]/25">
              <div className="flex items-center gap-2.5">
                <ChessBrandEmblem
                  size="sm"
                  variant={isLight ? 'forest' : 'sand'}
                />
                <div>
                  <div
                    className={`text-[11px] font-medium flex items-center gap-1 ${
                      isLight ? 'text-[#3F543E]' : 'text-[#DFC29B]'
                    }`}
                  >
                    <StepIcon className="w-3 h-3" />
                    <span>Panduan Ringkas · {stepIndex + 1}/{GUIDE_STEPS.length}</span>
                  </div>
                  <h2 className="text-base font-bold font-serif leading-tight">
                    {currentStep.title}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-full border transition-colors shrink-0 ${
                  isLight
                    ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#14261D] hover:text-[#EFE6D5]'
                    : 'bg-[#0A140F] text-[#F3ECE0] border-[#7A9A76]/40 hover:border-[#DFC29B]'
                }`}
                aria-label="Tutup panduan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Compact 4-Tab Pill Switcher */}
            <div
              className={`grid grid-cols-4 gap-1 p-1 rounded-full mb-3 border ${
                isLight
                  ? 'bg-[#E2DDD3]/80 border-[#C5BFB3]'
                  : 'bg-[#0A140F] border-[#7A9A76]/30'
              }`}
            >
              {GUIDE_STEPS.map((s, idx) => {
                const active = idx === stepIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStepIndex(idx)}
                    className={`relative py-1.5 px-1.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap truncate ${
                      active
                        ? isLight
                          ? 'bg-[#14261D] text-[#EFE6D5] font-bold'
                          : 'bg-[#DFC29B] text-[#0E1B14] font-bold'
                        : isLight
                        ? 'text-[#4A5D49] hover:text-[#12231B]'
                        : 'text-[#9BB09D] hover:text-[#F3ECE0]'
                    }`}
                  >
                    {s.tabLabel}
                  </button>
                );
              })}
            </div>

            {/* Animated Step Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
              >
                <p
                  className={`text-xs mb-2.5 ${
                    isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
                  }`}
                >
                  {currentStep.subtitle}
                </p>

                <div
                  className={`rounded-xl border p-3 space-y-2 mb-3 ${
                    isLight
                      ? 'bg-[#EAE6DF] border-[#C5BFB3] text-[#12231B]'
                      : 'bg-[#0A140F] border-[#7A9A76]/30 text-[#F3ECE0] shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]'
                  }`}
                >
                  {currentStep.points.map((pt, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          isLight ? 'text-[#1F4031]' : 'text-[#DFC29B]'
                        }`}
                      />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>

                {/* Quick Live Action Toggles */}
                {stepIndex === 1 && (
                  <div
                    className={`rounded-xl p-2.5 mb-3 flex flex-wrap items-center justify-between gap-2 border ${
                      isLight
                        ? 'bg-[#E2DDD3] border-[#C5BFB3]'
                        : 'bg-[#152A20] border-[#DFC29B]/40'
                    }`}
                  >
                    <span className="text-[11px] font-semibold">Uji Cepat:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={onToggleTheme}
                        className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors"
                      >
                        Suasana {isLight ? 'Gelap' : 'Terang'}
                      </button>

                      {isDesktopViewport && onToggleDesktopBoardMode && (
                        <button
                          type="button"
                          onClick={onToggleDesktopBoardMode}
                          className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#4E392B] text-[#EFE6D5] hover:bg-[#694D3A] transition-colors"
                        >
                          Mode {effectiveBoardMode === '3d' ? '2D' : '3D'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`rounded-xl px-3 py-2 text-[11px] mb-3.5 ${
                    isLight
                      ? 'bg-[#E2DDD3] text-[#12231B]'
                      : 'bg-[#152A20]/80 text-[#9BB09D] border border-[#7A9A76]/30'
                  }`}
                >
                  <strong className={isLight ? 'text-[#1F4031]' : 'text-[#DFC29B]'}>
                    Tips:{' '}
                  </strong>
                  {currentStep.tip}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Footer Controls */}
            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#7A9A76]/25">
              <button
                type="button"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border disabled:opacity-35 transition-colors ${
                  isLight
                    ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#D5CFC3]'
                    : 'bg-[#0A140F] text-[#F3ECE0] border-[#7A9A76]/40 hover:border-[#DFC29B]'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              {stepIndex < GUIDE_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setStepIndex((prev) => Math.min(GUIDE_STEPS.length - 1, prev + 1))
                  }
                  className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    isLight
                      ? 'bg-[#14261D] text-[#EFE6D5] hover:bg-[#1F3A2C]'
                      : 'bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3]'
                  }`}
                >
                  <span>Selanjutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors"
                >
                  <span>Mulai Bermain</span>
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
