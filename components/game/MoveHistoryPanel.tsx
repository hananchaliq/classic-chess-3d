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
  themeMode?: 'light' | 'dark';
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
  themeMode = 'dark',
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
  const isLight = themeMode === 'light';

  return (
    <div
      className={`flex flex-col h-full rounded-xl border-2 p-4 transition-colors ${
        isLight
          ? 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E]'
          : 'bg-[#6E473B] border-[#A78D78] text-[#E1D4C2]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#A78D78]">
        <div>
          <h3 className="text-sm sm:text-base font-bold font-serif">
            Notasi & Riwayat Langkah
          </h3>
          <p
            className={`text-xs font-mono tabular-nums ${
              isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
            }`}
          >
            Total {moves.length} ply ({moveRows.length} langkah penuh)
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleCopy('fen', fen)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-[#E1D4C2] text-[#291C0E] border-[#6E473B] hover:bg-[#6E473B] hover:text-[#E1D4C2]'
                : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
            }`}
            title="Salin string posisi FEN"
          >
            {copiedType === 'fen' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedType === 'fen' ? 'FEN Disalin' : 'FEN'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy('pgn', pgn || 'Belum ada langkah')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-[#E1D4C2] text-[#291C0E] border-[#6E473B] hover:bg-[#6E473B] hover:text-[#E1D4C2]'
                : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
            }`}
            title="Salin notasi PGN pertandingan"
          >
            {copiedType === 'pgn' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            <span>{copiedType === 'pgn' ? 'PGN Disalin' : 'PGN'}</span>
          </button>
        </div>
      </div>

      {/* Draw Offer Banner if opponent offered draw */}
      {isGameActive && opponentOfferedDraw && onRespondDraw && (
        <div className="mb-3 p-3 rounded-lg bg-[#A78D78] text-[#291C0E] border-2 border-[#291C0E] flex flex-col gap-2">
          <p className="text-xs font-bold">
            Lawan menawarkan remis (Draw). Terima tawaran ini?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRespondDraw(true)}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-[#291C0E] text-[#E1D4C2] hover:bg-[#6E473B] transition-colors whitespace-nowrap"
            >
              Terima Remis
            </button>
            <button
              type="button"
              onClick={() => onRespondDraw(false)}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#E1D4C2] text-[#291C0E] border border-[#291C0E] hover:bg-[#BEB5A9] transition-colors whitespace-nowrap"
            >
              Tolak
            </button>
          </div>
        </div>
      )}

      {/* Claimable Draw Banner (Threefold Repetition or 50-Move Rule) */}
      {isGameActive && canClaimDraw && onClaimDraw && myColor !== 'spectator' && (
        <div className="mb-3 p-3 rounded-lg bg-[#A78D78] text-[#291C0E] border-2 border-[#291C0E] flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="font-bold">Syarat Klaim Remis Terpenuhi:</span>{' '}
            {claimDrawReason || 'Pengulangan posisi 3x / Aturan 50 langkah'}
          </div>
          <button
            type="button"
            onClick={onClaimDraw}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#291C0E] text-[#E1D4C2] hover:bg-[#6E473B] transition-colors whitespace-nowrap shrink-0"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Klaim Remis</span>
          </button>
        </div>
      )}

      {/* Algebraic Move Table */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 min-h-[160px] max-h-[260px] lg:max-h-none overflow-y-auto rounded-lg border-2 p-2 font-mono tabular-nums text-xs ${
          isLight
            ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E]'
            : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2]'
        }`}
      >
        {moveRows.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-5 font-sans">
            <p className="text-sm font-bold mb-1">Belum Ada Langkah</p>
            <p
              className={`text-xs ${
                isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
              }`}
            >
              Ketuk bidak Putih atau tarik bidak ke petak tujuan legal untuk memulai.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`border-b ${
                  isLight
                    ? 'text-[#6E473B] border-[#BEB5A9]'
                    : 'text-[#BEB5A9] border-[#6E473B]'
                }`}
              >
                <th className="py-1.5 px-2 w-12">#</th>
                <th className="py-1.5 px-2">Putih</th>
                <th className="py-1.5 px-2">Hitam</th>
              </tr>
            </thead>
            <tbody>
              {moveRows.map((row) => (
                <tr
                  key={row.moveNumber}
                  className={`border-b last:border-b-0 transition-colors ${
                    isLight
                      ? 'border-[#BEB5A9] hover:bg-[#BEB5A9]/60'
                      : 'border-[#6E473B]/60 hover:bg-[#6E473B]/40'
                  }`}
                >
                  <td
                    className={`py-1.5 px-2 ${
                      isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
                    }`}
                  >
                    {row.moveNumber}.
                  </td>
                  <td className="py-1.5 px-2 font-bold">
                    {row.white ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{row.white.san}</span>
                        <span
                          className={`text-[10px] font-normal ${
                            isLight ? 'text-[#6E473B]' : 'text-[#A78D78]'
                          }`}
                        >
                          ({row.white.from}→{row.white.to})
                        </span>
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="py-1.5 px-2 font-bold">
                    {row.black ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{row.black.san}</span>
                        <span
                          className={`text-[10px] font-normal ${
                            isLight ? 'text-[#6E473B]' : 'text-[#A78D78]'
                          }`}
                        >
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
      <div className="pt-3 mt-3 border-t border-[#A78D78] flex flex-wrap items-center gap-2">
        {mode === 'local' ? (
          <>
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none ${
                isLight
                  ? 'bg-[#E1D4C2] text-[#291C0E] border-[#6E473B] hover:bg-[#A78D78]'
                  : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo Langkah</span>
            </button>

            <button
              type="button"
              onClick={onResetLocal}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                isLight
                  ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E] hover:bg-[#291C0E]'
                  : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] hover:bg-[#BEB5A9]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mulai Ulang</span>
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
                  isLight
                    ? 'bg-[#E1D4C2] text-[#291C0E] border-[#6E473B] hover:bg-[#A78D78]'
                    : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
                }`}
              >
                <Handshake className="w-3.5 h-3.5" />
                <span>{iOfferedDraw ? 'Tawaran Remis Terkirim' : 'Tawarkan Remis'}</span>
              </button>

              {!confirmResign ? (
                <button
                  type="button"
                  onClick={() => setConfirmResign(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold bg-[#291C0E] text-[#E1D4C2] border border-[#E1D4C2] hover:bg-[#A78D78] hover:text-[#291C0E] transition-colors whitespace-nowrap shrink-0"
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
                    className="py-2 px-3 rounded-lg text-xs font-bold bg-[#291C0E] text-[#E1D4C2] border-2 border-[#E1D4C2] hover:bg-[#A78D78] hover:text-[#291C0E] transition-colors whitespace-nowrap shrink-0"
                  >
                    Ya, Menyerah
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResign(false)}
                    className="py-2 px-2.5 rounded-lg text-xs font-semibold bg-[#E1D4C2] text-[#291C0E] border border-[#291C0E] hover:bg-[#BEB5A9] transition-colors whitespace-nowrap shrink-0"
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
