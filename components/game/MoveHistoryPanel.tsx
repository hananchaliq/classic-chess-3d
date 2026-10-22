'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { MoveRecord, PieceColor } from '../../types/chess.ts';
import {
  Copy,
  Check,
  Flag,
  Handshake,
  RotateCcw,
  Undo2,
  Scale,
  FileText,
} from 'lucide-react';

interface MoveHistoryPanelProps {
  moves: MoveRecord[];
  fen: string;
  pgn: string;
  mode: 'local' | 'multiplayer';
  isGameActive: boolean;
  canUndo?: boolean;
  onUndo?: () => void;
  onResetLocal?: () => void;
  canClaimDraw: boolean;
  claimDrawReason?: string | null;
  onClaimDraw?: () => void;
  drawOfferBy: PieceColor | null;
  myColor: PieceColor | 'spectator';
  onOfferDraw?: () => void;
  onRespondDraw?: (accept: boolean) => void;
  onResign?: () => void;
}

export default function MoveHistoryPanel({
  moves,
  fen,
  pgn,
  mode,
  isGameActive,
  canUndo = false,
  onUndo,
  onResetLocal,
  canClaimDraw,
  claimDrawReason,
  onClaimDraw,
  drawOfferBy,
  myColor,
  onOfferDraw,
  onRespondDraw,
  onResign,
}: MoveHistoryPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [copiedType, setCopiedType] = useState<'fen' | 'pgn' | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);

  // Group moves into pairs (White & Black per full move number)
  const moveRows: Array<{
    moveNumber: number;
    white?: MoveRecord;
    black?: MoveRecord;
  }> = [];

  for (let i = 0; i < moves.length; i += 2) {
    moveRows.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [moves.length]);

  const handleCopy = async (type: 'fen' | 'pgn', text: string) => {
    try {
      await navigator.clipboard.writeText(text || (type === 'fen' ? fen : pgn));
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const opponentOfferedDraw =
    drawOfferBy !== null && myColor !== 'spectator' && drawOfferBy !== myColor;
  const iOfferedDraw =
    drawOfferBy !== null && myColor !== 'spectator' && drawOfferBy === myColor;

  return (
    <div className="flex flex-col h-full bg-[#221D19] border border-[#38251C] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#38251C]">
        <div>
          <h3 className="text-base font-semibold text-[#F2E9DC]">Notasi & Riwayat Langkah</h3>
          <p className="text-xs text-[#B5A695] font-mono tabular-nums">
            Total {moves.length} ply ({moveRows.length} langkah penuh)
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleCopy('fen', fen)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-[#171513] text-[#F2E9DC]/90 hover:text-[#C7A66A] border border-[#38251C] transition-colors whitespace-nowrap shrink-0"
            title="Salin string posisi FEN"
          >
            {copiedType === 'fen' ? (
              <Check className="w-3.5 h-3.5 text-[#C7A66A]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedType === 'fen' ? 'FEN Tersalin' : 'Salin FEN'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy('pgn', pgn || 'Belum ada langkah')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-[#171513] text-[#F2E9DC]/90 hover:text-[#C7A66A] border border-[#38251C] transition-colors whitespace-nowrap shrink-0"
            title="Salin notasi PGN pertandingan"
          >
            {copiedType === 'pgn' ? (
              <Check className="w-3.5 h-3.5 text-[#C7A66A]" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            <span>{copiedType === 'pgn' ? 'PGN Tersalin' : 'Salin PGN'}</span>
          </button>
        </div>
      </div>

      {/* Draw Offer Banner if opponent offered draw */}
      {isGameActive && opponentOfferedDraw && onRespondDraw && (
        <div className="mb-3 p-3 rounded-lg bg-[#38251C] border border-[#C7A66A] flex flex-col gap-2">
          <p className="text-xs font-medium text-[#F2E9DC]">
            Lawan menawarkan remis (Draw). Terima tawaran ini?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRespondDraw(true)}
              className="flex-1 py-1.5 px-3 rounded text-xs font-semibold bg-[#C7A66A] text-[#171513] hover:bg-[#d4b67d] transition-colors whitespace-nowrap"
            >
              Terima Remis
            </button>
            <button
              type="button"
              onClick={() => onRespondDraw(false)}
              className="flex-1 py-1.5 px-3 rounded text-xs font-medium bg-[#171513] text-[#F2E9DC] border border-[#79543A] hover:bg-[#221D19] transition-colors whitespace-nowrap"
            >
              Tolak
            </button>
          </div>
        </div>
      )}

      {/* Claimable Draw Banner (Threefold Repetition or 50-Move Rule) */}
      {isGameActive && canClaimDraw && onClaimDraw && myColor !== 'spectator' && (
        <div className="mb-3 p-3 rounded-lg bg-[#2D241B] border border-[#C7A66A] flex items-center justify-between gap-2">
          <div className="text-xs text-[#F2E9DC]">
            <span className="font-semibold text-[#C7A66A]">Syarat Klaim Remis Terpenuhi:</span>{' '}
            {claimDrawReason || 'Pengulangan posisi 3x / Aturan 50 langkah'}
          </div>
          <button
            type="button"
            onClick={onClaimDraw}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#C7A66A] text-[#171513] hover:bg-[#d4b67d] transition-colors whitespace-nowrap shrink-0"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Klaim Remis</span>
          </button>
        </div>
      )}

      {/* Algebraic Move Table */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-[180px] max-h-[320px] lg:max-h-none overflow-y-auto rounded-lg bg-[#171513] border border-[#38251C] p-2 font-mono tabular-nums text-xs"
      >
        {moveRows.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#B5A695]/70 font-sans">
            <p className="text-sm font-medium text-[#F2E9DC]/80 mb-1">Belum Ada Langkah</p>
            <p className="text-xs">
              Klik salah satu bidak Putih atau tarik bidak ke petak tujuan legal untuk memulai.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[#B5A695] border-b border-[#38251C]/80">
                <th className="py-1.5 px-2 w-12">#</th>
                <th className="py-1.5 px-2">Putih</th>
                <th className="py-1.5 px-2">Hitam</th>
              </tr>
            </thead>
            <tbody>
              {moveRows.map((row) => (
                <tr
                  key={row.moveNumber}
                  className="border-b border-[#221D19] last:border-b-0 hover:bg-[#221D19]/70 transition-colors"
                >
                  <td className="py-1.5 px-2 text-[#B5A695]">{row.moveNumber}.</td>
                  <td className="py-1.5 px-2 font-medium text-[#F2E9DC]">
                    {row.white ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{row.white.san}</span>
                        <span className="text-[10px] text-[#B5A695]/60">
                          ({row.white.from}→{row.white.to})
                        </span>
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="py-1.5 px-2 font-medium text-[#E7D5B5]">
                    {row.black ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{row.black.san}</span>
                        <span className="text-[10px] text-[#B5A695]/60">
                          ({row.black.from}→{row.black.to})
                        </span>
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Action Controls Footer */}
      <div className="pt-3 mt-3 border-t border-[#38251C] flex flex-wrap items-center gap-2">
        {mode === 'local' ? (
          <>
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-[#171513] text-[#F2E9DC] border border-[#38251C] hover:border-[#C7A66A] disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo Langkah</span>
            </button>

            <button
              type="button"
              onClick={onResetLocal}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-[#38251C] text-[#F2E9DC] hover:bg-[#79543A] transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mulai Ulang Papan</span>
            </button>
          </>
        ) : (
          isGameActive &&
          myColor !== 'spectator' && (
            <>
              <button
                type="button"
                disabled={iOfferedDraw}
                onClick={onOfferDraw}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-[#171513] text-[#F2E9DC] border border-[#38251C] hover:border-[#C7A66A] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Handshake className="w-3.5 h-3.5 text-[#C7A66A]" />
                <span>{iOfferedDraw ? 'Tawaran Remis Terkirim' : 'Tawarkan Remis'}</span>
              </button>

              {!confirmResign ? (
                <button
                  type="button"
                  onClick={() => setConfirmResign(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-[#171513] text-[#D9534F] border border-[#38251C] hover:border-[#D9534F] transition-colors whitespace-nowrap shrink-0"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Menyerah</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmResign(false);
                      onResign?.();
                    }}
                    className="py-2 px-3 rounded-lg text-xs font-semibold bg-[#D9534F] text-white hover:bg-[#c9302c] transition-colors whitespace-nowrap shrink-0"
                  >
                    Ya, Menyerah
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResign(false)}
                    className="py-2 px-2.5 rounded-lg text-xs font-medium bg-[#171513] text-[#B5A695] border border-[#38251C] hover:text-[#F2E9DC] transition-colors whitespace-nowrap shrink-0"
                  >
                    Batal
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
