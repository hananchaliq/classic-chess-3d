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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#291C0E]/80 p-4">
      <div
        className={`w-full max-w-md rounded-xl border-2 p-6 shadow-2xl ${
          isLight
            ? 'bg-[#E1D4C2] border-[#6E473B] text-[#291C0E]'
            : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2]'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold font-serif">
            Promosi Pion ({color === 'w' ? 'Putih' : 'Hitam'})
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-[#BEB5A9] text-[#291C0E] border-[#6E473B] hover:bg-[#6E473B] hover:text-[#E1D4C2]'
                : 'bg-[#6E473B] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
            }`}
          >
            Batal
          </button>
        </div>

        <p
          className={`text-sm mb-5 ${
            isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
          }`}
        >
          Pilih bidak pengganti untuk pion yang mencapai baris terakhir:
        </p>

        <div className="grid grid-cols-2 gap-3">
          {PROMOTION_CHOICES.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => onSelect(item.type)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all group ${
                isLight
                  ? 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E] hover:bg-[#6E473B] hover:text-[#E1D4C2] hover:border-[#291C0E]'
                  : 'bg-[#6E473B] border-[#A78D78] text-[#E1D4C2] hover:bg-[#A78D78] hover:text-[#291C0E] hover:border-[#E1D4C2]'
              }`}
            >
              <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                {color === 'w' ? item.whiteIcon : item.blackIcon}
              </span>
              <span className="text-sm font-bold whitespace-nowrap">
                {item.name}
              </span>
              <span className="text-xs opacity-85 mt-0.5 whitespace-nowrap">
                {item.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
