'use client';

import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  X,
  MousePointerClick,
  Bot,
  Users,
  MonitorSmartphone,
  CheckCircle2,
} from 'lucide-react';

interface QuickGuideCardProps {
  themeMode: 'light' | 'dark';
  isDesktopViewport: boolean;
  effectiveBoardMode: '2d' | '3d';
  onOpenModal: () => void;
}

export function QuickGuideCard({
  themeMode,
  isDesktopViewport,
  effectiveBoardMode,
  onOpenModal,
}: QuickGuideCardProps) {
  const isLight = themeMode === 'light';

  return (
    <div
      className={`rounded-xl border-2 p-3.5 transition-colors ${
        isLight
          ? 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E]'
          : 'bg-[#6E473B] border-[#A78D78] text-[#E1D4C2]'
      }`}
    >
      <div
        className={`flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b ${
          isLight ? 'border-[#A78D78]' : 'border-[#A78D78]'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#291C0E] text-[#E1D4C2] border border-[#A78D78] flex items-center justify-center shrink-0">
            <HelpCircle className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold font-serif leading-tight">
              Panduan Cepat Bermain
            </h3>
            <p
              className={`text-[11px] ${
                isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
              }`}
            >
              Mode Aktif: Papan {effectiveBoardMode.toUpperCase()}{' '}
              {isDesktopViewport ? '(Desktop)' : '(HP / Tablet Ringan)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenModal}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
            isLight
              ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E] hover:bg-[#291C0E]'
              : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] hover:bg-[#BEB5A9]'
          }`}
        >
          Panduan Interaktif
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div
          className={`p-2 rounded-lg border ${
            isLight
              ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E]'
              : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2]'
          }`}
        >
          <span className="font-bold block mb-0.5">1. Gerakkan Bidak</span>
          <span className={isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'}>
            Ketuk bidak untuk melihat titik langkah legal, lalu ketuk petak tujuan.
          </span>
        </div>

        <div
          className={`p-2 rounded-lg border ${
            isLight
              ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E]'
              : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2]'
          }`}
        >
          <span className="font-bold block mb-0.5">2. Bot AI & Hint</span>
          <span className={isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'}>
            Pilih level Pemula–GM atau tekan tombol Hint saat butuh saran langkah.
          </span>
        </div>

        <div
          className={`p-2 rounded-lg border ${
            isLight
              ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E]'
              : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2]'
          }`}
        >
          <span className="font-bold block mb-0.5">3. Room Multiplayer</span>
          <span className={isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'}>
            Buat Room Online & bagikan kode 6 huruf ke teman untuk main bersama.
          </span>
        </div>

        <div
          className={`p-2 rounded-lg border ${
            isLight
              ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E]'
              : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2]'
          }`}
        >
          <span className="font-bold block mb-0.5">4. Visual 2D/3D & Tema</span>
          <span className={isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'}>
            Otomatis 2D cepat di HP/Tablet. Di Desktop tersedia tombol 2D/3D.
          </span>
        </div>
      </div>
    </div>
  );
}

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
    title: 'Langkah 1: Cara Menggerakkan Bidak & Aturan Catur',
    subtitle: 'Kendali papan yang mudah di layar sentuh maupun mouse',
    icon: MousePointerClick,
    points: [
      'Ketuk atau klik bidak milik Anda (Putih berjalan lebih dulu). Petak yang bisa dituju akan ditandai dengan titik bulat.',
      'Ketuk petak bertitik tersebut untuk memindahkan bidak, atau tarik (drag & drop) bidak langsung ke petak tujuan.',
      'Semua aturan resmi FIDE didukung penuh: Rokade (O-O / O-O-O), En Passant, Promosi Pion otomatis, Skak, dan Klaim Remis.',
    ],
    tip: 'Gunakan tombol "Putar Papan" di atas papan jika ingin membalik sudut pandang Putih/Hitam.',
  },
  {
    title: 'Langkah 2: Bermain Lawan Bot AI & Bantuan Hint',
    subtitle: 'Latihan santai hingga tingkat Grandmaster',
    icon: Bot,
    points: [
      'Buka tab "Lawan Bot AI" untuk bermain langsung tanpa perlu menunggu lawan online.',
      'Tersedia 5 tingkat kesulitan: Pemula, Kasual, Taktis, Master, hingga Grandmaster (GM).',
      'Bingung menentukan langkah? Tekan tombol "Hint" untuk melihat saran langkah terbaik beserta penjelasan taktisnya, atau tekan "Undo Langkah" untuk menarik kembali langkah.',
    ],
    tip: 'Bar evaluasi di samping papan menunjukkan siapa yang sedang unggul posisi secara real-time.',
  },
  {
    title: 'Langkah 3: Mabar Online di Room Multiplayer',
    subtitle: 'Bermain real-time bersama teman lewat kode 6 karakter',
    icon: Users,
    points: [
      'Pilih tab "Room Online", tentukan nama pemain dan durasi waktu (misal 5+0 Blitz atau 10+0 Rapid), lalu tekan "Buat Room".',
      'Salin Kode Room (6 karakter) atau Tautan Undangan dan kirimkan ke teman Anda.',
      'Setelah teman bergabung ke dalam room, tekan tombol "Terima & Mulai Pertandingan" untuk memulai jam catur.',
    ],
    tip: 'Koneksi room dilengkapi sinkronisasi otomatis sehingga permainan tetap berjalan stabil di semua perangkat.',
  },
  {
    title: 'Langkah 4: Mode 2D/3D & Tema Warna Hangat',
    subtitle: 'Ringan di HP/Tablet dan fleksibel di Desktop',
    icon: MonitorSmartphone,
    points: [
      'Di HP dan Tablet, aplikasi otomatis menggunakan Papan 2D Klasik yang sangat ringan, hemat baterai, dan bebas lag.',
      'Di komputer Desktop, Papan 3D aktif secara bawaan dan Anda dapat beralih ke Papan 2D kapan saja lewat tombol "Mode 2D / 3D" di bagian atas.',
      'Anda juga dapat mengganti suasana antara Tema Terang Hangat (#E1D4C2) dan Tema Gelap Hangat (#291C0E) sesuai kenyamanan mata.',
    ],
    tip: 'Coba tombol pengatur tema dan mode papan di bawah ini sebelum mulai bermain!',
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

  if (!isOpen) return null;

  const isLight = themeMode === 'light';
  const currentStep = GUIDE_STEPS[stepIndex];
  const StepIcon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#291C0E]/80 p-4">
      <div
        className={`w-full max-w-lg rounded-2xl border-2 p-5 sm:p-6 shadow-2xl transition-colors ${
          isLight
            ? 'bg-[#E1D4C2] border-[#6E473B] text-[#291C0E]'
            : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between gap-3 pb-3.5 mb-4 border-b-2 ${
            isLight ? 'border-[#BEB5A9]' : 'border-[#6E473B]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#6E473B] text-[#E1D4C2] border border-[#A78D78] flex items-center justify-center shrink-0">
              <StepIcon className="w-5 h-5" />
            </div>
            <div>
              <span
                className={`text-[11px] font-mono uppercase tracking-wider font-bold ${
                  isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
                }`}
              >
                Panduan Pengguna · Langkah {stepIndex + 1} dari {GUIDE_STEPS.length}
              </span>
              <h2 className="text-base sm:text-lg font-bold font-serif leading-snug">
                {currentStep.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
              isLight
                ? 'bg-[#BEB5A9] text-[#291C0E] border-[#A78D78] hover:bg-[#6E473B] hover:text-[#E1D4C2]'
                : 'bg-[#6E473B] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
            }`}
            aria-label="Tutup panduan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Indicator Pills (Solid 5-color palette) */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {GUIDE_STEPS.map((s, idx) => {
            const active = idx === stepIndex;
            const completed = idx < stepIndex;
            return (
              <button
                key={s.title}
                type="button"
                onClick={() => setStepIndex(idx)}
                className={`h-2.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-[#6E473B] border-[#291C0E]'
                    : completed
                    ? 'bg-[#A78D78] border-[#6E473B]'
                    : isLight
                    ? 'bg-[#BEB5A9] border-[#A78D78]'
                    : 'bg-[#6E473B]/40 border-[#A78D78]'
                }`}
                aria-label={`Ke langkah ${idx + 1}`}
              />
            );
          })}
        </div>

        <p
          className={`text-xs font-medium mb-3 ${
            isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
          }`}
        >
          {currentStep.subtitle}
        </p>

        {/* Bullet Points Box */}
        <div
          className={`rounded-xl border-2 p-4 space-y-2.5 mb-4 ${
            isLight
              ? 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E]'
              : 'bg-[#6E473B] border-[#A78D78] text-[#E1D4C2]'
          }`}
        >
          {currentStep.points.map((pt, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed">
              <CheckCircle2
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isLight ? 'text-[#291C0E]' : 'text-[#E1D4C2]'
                }`}
              />
              <span>{pt}</span>
            </div>
          ))}
        </div>

        {/* Interactive Quick Toggles on Step 4 */}
        {stepIndex === 3 && (
          <div
            className={`rounded-xl border p-3 mb-4 flex flex-wrap items-center justify-between gap-2 ${
              isLight
                ? 'bg-[#A78D78] border-[#6E473B] text-[#291C0E]'
                : 'bg-[#A78D78] border-[#E1D4C2] text-[#291C0E]'
            }`}
          >
            <span className="text-xs font-bold">Coba Pengaturan Sekarang:</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onToggleTheme}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#291C0E] text-[#E1D4C2] border border-[#E1D4C2] hover:bg-[#6E473B] transition-colors"
              >
                Ganti ke Tema {isLight ? 'Gelap Hangat' : 'Terang Hangat'}
              </button>

              {isDesktopViewport && onToggleDesktopBoardMode && (
                <button
                  type="button"
                  onClick={onToggleDesktopBoardMode}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E1D4C2] text-[#291C0E] border border-[#291C0E] hover:bg-[#BEB5A9] transition-colors"
                >
                  Ganti ke Papan {effectiveBoardMode === '3d' ? '2D' : '3D'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tip Box */}
        <div
          className={`rounded-lg border px-3.5 py-2.5 text-xs mb-5 ${
            isLight
              ? 'bg-[#A78D78] border-[#6E473B] text-[#291C0E]'
              : 'bg-[#291C0E] border-[#6E473B] text-[#BEB5A9]'
          }`}
        >
          <strong className={isLight ? 'text-[#291C0E]' : 'text-[#E1D4C2]'}>Tips: </strong>
          {currentStep.tip}
        </div>

        {/* Palette Swatch Preview Footer & Step Navigation */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#A78D78]">
          {/* 5-color palette indicator */}
          <div className="flex items-center gap-1" title="Palet 5 Warna Hangat Aktif">
            <span className="w-4 h-4 rounded-full bg-[#291C0E] border border-[#E1D4C2]" />
            <span className="w-4 h-4 rounded-full bg-[#6E473B] border border-[#E1D4C2]" />
            <span className="w-4 h-4 rounded-full bg-[#A78D78] border border-[#291C0E]" />
            <span className="w-4 h-4 rounded-full bg-[#BEB5A9] border border-[#291C0E]" />
            <span className="w-4 h-4 rounded-full bg-[#E1D4C2] border border-[#291C0E]" />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border disabled:opacity-40 transition-colors ${
                isLight
                  ? 'bg-[#BEB5A9] text-[#291C0E] border-[#6E473B] hover:bg-[#A78D78]'
                  : 'bg-[#6E473B] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
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
                className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  isLight
                    ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B] hover:bg-[#6E473B]'
                    : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] hover:bg-[#BEB5A9]'
                }`}
              >
                <span>Selanjutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  isLight
                    ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E] hover:bg-[#291C0E]'
                    : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] hover:bg-[#BEB5A9]'
                }`}
              >
                <span>Mulai Bermain</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
