'use client';

import React from 'react';
import type { PieceColor, PieceSymbol } from '../../types/chess.ts';

interface PromotionModalProps {
  color: PieceColor;
  onSelect: (piece: PieceSymbol) => void;
  onCancel: () => void;
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

export default function PromotionModal({ color, onSelect, onCancel }: PromotionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-xl bg-[#221D19] border border-[#79543A] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-[#F2E9DC] font-serif">
            Promosi Pion ({color === 'w' ? 'Putih' : 'Hitam'})
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-xs font-medium text-[#B5A695] hover:text-[#F2E9DC] rounded border border-[#38251C] hover:border-[#79543A] transition-colors whitespace-nowrap shrink-0"
          >
            Batal
          </button>
        </div>

        <p className="text-sm text-[#B5A695] mb-5">
          Pilih bidak pengganti untuk pion yang mencapai baris terakhir:
        </p>

        <div className="grid grid-cols-2 gap-3">
          {PROMOTION_CHOICES.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => onSelect(item.type)}
              className="flex flex-col items-center justify-center p-4 rounded-lg bg-[#171513] border border-[#38251C] hover:border-[#C7A66A] hover:bg-[#38251C]/50 transition-all group"
            >
              <span className="text-4xl mb-2 text-[#F2E9DC] group-hover:scale-110 transition-transform">
                {color === 'w' ? item.whiteIcon : item.blackIcon}
              </span>
              <span className="text-sm font-semibold text-[#F2E9DC] whitespace-nowrap">
                {item.name}
              </span>
              <span className="text-xs text-[#B5A695] mt-0.5 whitespace-nowrap">
                {item.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
