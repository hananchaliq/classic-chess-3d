'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
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
  embedded?: boolean;
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
  embedded = false,
}: MoveHistoryPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [copiedType, setCopiedType] = useState<'fen' | 'pgn' | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);

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
      className={`flex flex-col h-full transition-colors ${
        embedded
          ? ''
          : `rounded-2xl border p-4 ${
              isLight
                ? 'bg-[#F4F1EA] border-[#C5BFB3] text-[#12231B]'
                : 'bg-[#102018] border-[#7A9A76]/35 text-[#F3ECE0] shadow-[0_14px_34px_-8px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(223,194,155,0.12)]'
            }`
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div>
          <h3 className="text-sm font-bold font-serif tracking-tight">
            Notasi Langkah FIDE
          </h3>
          <p
            className={`text-[11px] font-mono tabular-nums ${
              isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
            }`}
          >
            {moves.length} ply · {moveRows.length} langkah penuh
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleCopy('fen', fen)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#14261D] hover:text-[#EFE6D5]'
                : 'bg-[#0A140F] text-[#EFE6D5] border-[#7A9A76]/40 hover:border-[#DFC29B] hover:text-[#DFC29B]'
            }`}
            title="Salin posisi FEN"
          >
            {copiedType === 'fen' ? (
              <Check className="w-3 h-3 text-[#7A9A76]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copiedType === 'fen' ? 'Disalin' : 'FEN'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy('pgn', pgn || 'Belum ada langkah')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#14261D] hover:text-[#EFE6D5]'
                : 'bg-[#0A140F] text-[#EFE6D5] border-[#7A9A76]/40 hover:border-[#DFC29B] hover:text-[#DFC29B]'
            }`}
            title="Salin notasi PGN"
          >
            {copiedType === 'pgn' ? (
              <Check className="w-3 h-3 text-[#7A9A76]" />
            ) : (
              <FileText className="w-3 h-3" />
            )}
            <span>{copiedType === 'pgn' ? 'Disalin' : 'PGN'}</span>
          </button>
        </div>
      </div>

      {/* Draw Offer Banner if opponent offered draw */}
      {isGameActive && opponentOfferedDraw && onRespondDraw && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2.5 p-3 rounded-xl bg-[#1A3326] text-[#F3ECE0] flex flex-col gap-2 border border-[#DFC29B]/45"
        >
          <p className="text-xs font-bold">
            Lawan menawarkan remis (Draw). Terima tawaran ini?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRespondDraw(true)}
              className="flex-1 py-1.5 px-3 rounded-full text-xs font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap"
            >
              Terima Remis
            </button>
            <button
              type="button"
              onClick={() => onRespondDraw(false)}
              className="flex-1 py-1.5 px-3 rounded-full text-xs font-semibold bg-[#0A140F] text-[#EFE6D5] border border-[#7A9A76]/35 hover:bg-[#14261D] transition-colors whitespace-nowrap"
            >
              Tolak
            </button>
          </div>
        </motion.div>
      )}

      {/* Claimable Draw Banner */}
      {isGameActive && canClaimDraw && onClaimDraw && myColor !== 'spectator' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2.5 p-2.5 rounded-xl bg-[#1A3326] text-[#EFE6D5] border border-[#DFC29B]/40 flex items-center justify-between gap-2"
        >
          <div className="text-xs">
            <span className="font-bold text-[#DFC29B]">Klaim Remis:</span>{' '}
            {claimDrawReason || 'Pengulangan 3x / 50 langkah'}
          </div>
          <button
            type="button"
            onClick={onClaimDraw}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap shrink-0"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Klaim</span>
          </button>
        </motion.div>
      )}

      {/* Recessed Algebraic Move Table */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 min-h-[150px] max-h-[220px] lg:max-h-[260px] overflow-y-auto rounded-xl border p-1.5 font-mono tabular-nums text-xs [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:rounded-full ${
          isLight
            ? 'bg-[#EAE6DF] border-[#C5BFB3] text-[#12231B] shadow-inner [scrollbar-color:#7A9A76_#EAE6DF] [&::-webkit-scrollbar-track]:bg-[#EAE6DF] [&::-webkit-scrollbar-thumb]:bg-[#7A9A76]/60 hover:[&::-webkit-scrollbar-thumb]:bg-[#14261D]'
            : 'bg-[#0A140F] border-[#7A9A76]/30 text-[#F3ECE0] shadow-[inset_0_2px_8px_rgba(0,0,0,0.65)] [scrollbar-color:#7A9A76_#0A140F] [&::-webkit-scrollbar-track]:bg-[#0A140F] [&::-webkit-scrollbar-thumb]:bg-[#7A9A76]/60 hover:[&::-webkit-scrollbar-thumb]:bg-[#DFC29B]'
        }`}
      >
        {moveRows.length === 0 ? (
          <div className="h-full min-h-[130px] flex flex-col items-center justify-center text-center p-4 font-sans">
            <p className="text-xs font-serif font-bold mb-1 text-[#DFC29B]">
              Belum Ada Langkah
            </p>
            <p
              className={`text-[11px] max-w-[210px] leading-relaxed ${
                isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
              }`}
            >
              Klik atau tarik bidak di papan untuk memulai pertandingan.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`border-b text-[11px] ${
                  isLight
                    ? 'text-[#4A5D49] border-[#C5BFB3]'
                    : 'text-[#7A9A76] border-[#7A9A76]/25'
                }`}
              >
                <th className="py-1 px-2 w-10">#</th>
                <th className="py-1 px-2">Putih</th>
                <th className="py-1 px-2">Hitam</th>
              </tr>
            </thead>
            <tbody>
              {moveRows.map((row, idx) => {
                const isLatestRow = idx === moveRows.length - 1;
                return (
                  <motion.tr
                    key={row.moveNumber}
                    initial={isLatestRow ? { opacity: 0, x: -6 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.16 }}
                    className={`transition-colors ${
                      idx % 2 === 1
                        ? isLight
                          ? 'bg-[#DFD9CE]/55'
                          : 'bg-[#12231B]/75'
                        : ''
                    }`}
                  >
                    <td
                      className={`py-1.5 px-2 ${
                        isLight ? 'text-[#4A5D49]' : 'text-[#7A9A76]'
                      }`}
                    >
                      {row.moveNumber}.
                    </td>
                    <td className="py-1.5 px-2 font-semibold">
                      {row.white ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={
                              isLatestRow && !row.black && !isLight
                                ? 'text-[#DFC29B]'
                                : ''
                            }
                          >
                            {row.white.san}
                          </span>
                          <span
                            className={`text-[10px] font-normal ${
                              isLight ? 'text-[#4A5D49]' : 'text-[#7A9A76]'
                            }`}
                          >
                            {row.white.from}→{row.white.to}
                          </span>
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="py-1.5 px-2 font-semibold">
                      {row.black ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={
                              isLatestRow && !isLight ? 'text-[#DFC29B]' : ''
                            }
                          >
                            {row.black.san}
                          </span>
                          <span
                            className={`text-[10px] font-normal ${
                              isLight ? 'text-[#4A5D49]' : 'text-[#7A9A76]'
                            }`}
                          >
                            {row.black.from}→{row.black.to}
                          </span>
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Action Controls Footer */}
      <div className="pt-3 mt-2.5 flex flex-wrap items-center gap-2">
        {mode === 'local' ? (
          <>
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-semibold border transition-all whitespace-nowrap shrink-0 disabled:opacity-35 disabled:pointer-events-none ${
                isLight
                  ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#D5CFC3]'
                  : 'bg-[#162B20] text-[#F3ECE0] border-[#7A9A76]/40 hover:border-[#DFC29B] shadow-[inset_0_1px_0_0_rgba(223,194,155,0.1)]'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo Langkah</span>
            </button>

            <button
              type="button"
              onClick={onResetLocal}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                isLight
                  ? 'bg-[#14261D] text-[#EFE6D5] hover:bg-[#1F3A2C]'
                  : 'bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] shadow-sm'
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
                  isLight
                    ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#D5CFC3]'
                    : 'bg-[#162B20] text-[#F3ECE0] border-[#7A9A76]/40 hover:border-[#DFC29B]'
                }`}
              >
                <Handshake className="w-3.5 h-3.5" />
                <span>{iOfferedDraw ? 'Tawaran Terkirim' : 'Tawarkan Remis'}</span>
              </button>

              {!confirmResign ? (
                <button
                  type="button"
                  onClick={() => setConfirmResign(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-full text-xs font-bold bg-[#4E392B] text-[#EFE6D5] hover:bg-[#991B1B] transition-colors whitespace-nowrap shrink-0"
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
                    className="py-2 px-3 rounded-full text-xs font-bold bg-[#B91C1C] text-white hover:bg-[#991B1B] transition-colors whitespace-nowrap shrink-0"
                  >
                    Ya, Menyerah
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResign(false)}
                    className="py-2 px-2.5 rounded-full text-xs font-semibold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap shrink-0"
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
