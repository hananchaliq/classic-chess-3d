'use client';

import React from 'react';
import type { PieceColor, PieceSymbol } from '../../types/chess.ts';

interface PromotionModalProps {
  color: PieceColor;
  onSelect: (piece: PieceSymbol) => void;
  onCancel: () => void;
  themeMode?: 'light' | 'dark';
}

const PROMOTION_CHOICES: Array<{
  type: PieceSymbol;
  name: string;
  whiteIcon: string;
  blackIcon: string;
  desc: string;
}> = [
  { type: 'q', name: 'Ratu (Queen)', whiteIcon: '♕', blackIcon: '♛', desc: '9 Poin · Segala Arah' },
  { type: 'r', name: 'Benteng (Rook)', whiteIcon: '♖', blackIcon: '♜', desc: '5 Poin · Lajur & Baris' },
  { type: 'b', name: 'Gajah (Bishop)', whiteIcon: '♗', blackIcon: '♝', desc: '3 Poin · Diagonal' },
  { type: 'n', name: 'Kuda (Knight)', whiteIcon: '♘', blackIcon: '♞', desc: '3 Poin · Langkah L' },
];

export default function PromotionModal({
  color,
  onSelect,
  onCancel,
  themeMode = 'dark',
}: PromotionModalProps) {
  const isLight = themeMode === 'light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09130E]/80 backdrop-blur-[2px] p-4">
      <div
        className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${
          isLight
            ? 'bg-[#F4F1EA] border-[#C5BFB3] text-[#12231B]'
            : 'bg-[#102018] border-[#7A9A76]/45 text-[#F3ECE0]'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold font-serif">
            Promosi Pion ({color === 'w' ? 'Putih' : 'Hitam'})
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className={`px-3.5 py-1 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#14261D] hover:text-[#EFE6D5]'
                : 'bg-[#0A140F] text-[#EFE6D5] border-[#7A9A76]/40 hover:bg-[#DFC29B] hover:text-[#0E1B14]'
            }`}
          >
            Batal
          </button>
        </div>

        <p
          className={`text-xs sm:text-sm mb-5 ${
            isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
          }`}
        >
          Pilih perwira pengganti untuk pion yang mencapai baris akhir:
        </p>

        <div className="grid grid-cols-2 gap-3">
          {PROMOTION_CHOICES.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => onSelect(item.type)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all group ${
                isLight
                  ? 'bg-[#EAE6DF] border-[#C5BFB3] text-[#12231B] hover:bg-[#14261D] hover:text-[#EFE6D5] hover:border-[#14261D]'
                  : 'bg-[#0A140F] border-[#7A9A76]/35 text-[#F3ECE0] hover:bg-[#DFC29B] hover:text-[#0E1B14] hover:border-[#DFC29B]'
              }`}
            >
              <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                {color === 'w' ? item.whiteIcon : item.blackIcon}
              </span>
              <span className="text-sm font-serif font-bold whitespace-nowrap">
                {item.name}
              </span>
              <span className="text-[11px] opacity-80 mt-0.5 whitespace-nowrap">
                {item.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
