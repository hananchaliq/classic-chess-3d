'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ClockSnapshot, PieceColor, PieceSymbol } from '../../types/chess.ts';
import { ChessBrandEmblem } from './ChessBrandLogo.tsx';
import { Clock, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

interface PlayerClockBarProps {
  displayName: string;
  color: PieceColor;
  isTurn: boolean;
  inCheck: boolean;
  connected?: boolean;
  isMultiplayer?: boolean;
  rating?: number;
  capturedPieces: PieceSymbol[];
  materialAdvantage: number;
  clocks: ClockSnapshot | null;
  roleBadge?: string;
  themeMode?: 'light' | 'dark';
}

const CAPTURED_UNICODE: Record<PieceColor, Record<PieceSymbol, string>> = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘', p: '♙', k: '♔' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟', k: '♚' },
};

export function formatChessClockMs(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((clamped % 1000) / 100);

  if (minutes === 0 && seconds < 20) {
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function PlayerClockBar({
  displayName,
  color,
  isTurn,
  inCheck,
  connected = true,
  isMultiplayer = false,
  rating,
  capturedPieces,
  materialAdvantage,
  clocks,
  roleBadge,
  themeMode = 'dark',
}: PlayerClockBarProps) {
  const [liveRemainingMs, setLiveRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!clocks || clocks.isUnlimited || clocks.activeColor !== color) {
      return;
    }

    const baseMs = color === 'w' ? clocks.whiteMs : clocks.blackMs;
    const clientSyncedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - clientSyncedAt;
      setLiveRemainingMs(Math.max(0, baseMs - elapsed));
    }, 100);

    return () => {
      window.clearInterval(timer);
      setLiveRemainingMs(null);
    };
  }, [clocks, color]);

  const baseClockMs =
    !clocks || clocks.isUnlimited ? 0 : color === 'w' ? clocks.whiteMs : clocks.blackMs;
  const displayMs =
    clocks && !clocks.isUnlimited && clocks.activeColor === color && liveRemainingMs !== null
      ? liveRemainingMs
      : baseClockMs;

  const capturedPieceColor: PieceColor = color === 'w' ? 'b' : 'w';
  const isLowTime = Boolean(
    clocks && !clocks.isUnlimited && displayMs < 20000 && displayMs > 0
  );
  const isLight = themeMode === 'light';

  return (
    <motion.div
      layout
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl border transition-all ${
        isLight
          ? isTurn
            ? 'bg-[#F4F1EA] border-[#5E785D] text-[#12231B] shadow-[0_8px_22px_-6px_rgba(18,35,27,0.16)]'
            : 'bg-[#ECE8DF]/90 border-[#C5BFB3] text-[#12231B]'
          : isTurn
          ? 'bg-[#152A20] border-[#DFC29B]/65 text-[#F3ECE0] shadow-[0_12px_28px_-8px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(223,194,155,0.18)]'
          : 'bg-[#0F1E17] border-[#7A9A76]/30 text-[#E5DEC9] shadow-[inset_0_1px_0_0_rgba(122,154,118,0.08)]'
      }`}
    >
      {/* Left: Branded Player Emblem, Identity, & Captured Material */}
      <div className="flex items-center gap-2.5 min-w-0">
        <ChessBrandEmblem
          size="sm"
          variant={color === 'w' ? 'sand' : 'forest'}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold">
            <span className="font-serif text-sm sm:text-base font-bold truncate max-w-[140px] sm:max-w-[220px]">
              {displayName}
            </span>

            <div
              className={`flex items-center gap-1 text-xs font-normal ${
                isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
              }`}
            >
              {typeof rating === 'number' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-[11px]">{rating}</span>
                </>
              )}
              {roleBadge && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-medium text-[11px] ${
                      isTurn && !isLight ? 'text-[#DFC29B]' : ''
                    }`}
                  >
                    {roleBadge}
                  </span>
                </>
              )}
              {isMultiplayer && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className="inline-flex items-center"
                    title={connected ? 'Terhubung ke room' : 'Terputus sementara'}
                  >
                    {connected ? (
                      <Wifi className="w-3 h-3 text-[#7A9A76]" />
                    ) : (
                      <WifiOff className="w-3 h-3 opacity-60" />
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Captured pieces & material diff with smooth pop-in */}
          <div className="flex items-center gap-1.5 text-xs min-h-[16px]">
            {capturedPieces.length > 0 ? (
              <div
                className={`inline-flex items-center tracking-tight text-sm leading-none ${
                  isLight ? 'text-[#12231B]' : 'text-[#F3ECE0]'
                }`}
              >
                <AnimatePresence initial={false}>
                  {capturedPieces.map((p, idx) => (
                    <motion.span
                      key={`${p}-${idx}`}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                    >
                      {CAPTURED_UNICODE[capturedPieceColor][p]}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <span
                className={`text-[11px] ${
                  isLight ? 'text-[#4A5D49]/80' : 'text-[#7A9A76]'
                }`}
              >
                {color === 'w' ? 'Bidak Putih' : 'Bidak Hitam'}
              </span>
            )}

            {materialAdvantage > 0 && (
              <motion.span
                key={`adv-${materialAdvantage}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`font-mono tabular-nums text-[11px] font-bold ${
                  isLight ? 'text-[#1F4031]' : 'text-[#DFC29B]'
                }`}
              >
                +{materialAdvantage}
              </motion.span>
            )}

            {inCheck && (
              <motion.span
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#EF4444]"
              >
                <ShieldAlert className="w-3 h-3" />
                <span>Skak</span>
              </motion.span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Turn Status & Dimensional Pill Clock */}
      <div className="flex items-center gap-2 shrink-0">
        {isTurn && (
          <motion.span
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            className={`hidden sm:inline-block text-[11px] font-semibold ${
              isLight ? 'text-[#1F4031]' : 'text-[#DFC29B]'
            }`}
          >
            Giliran
          </motion.span>
        )}

        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-mono tabular-nums text-xs sm:text-sm font-bold border transition-all ${
            clocks?.isUnlimited
              ? isLight
                ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3]'
                : 'bg-[#0A140F] text-[#9BB09D] border-[#7A9A76]/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]'
              : isLowTime
              ? 'bg-[#B91C1C] text-white border-[#7F1D1D] animate-pulse'
              : isTurn
              ? isLight
                ? 'bg-[#14261D] text-[#EFE6D5] border-[#14261D]'
                : 'bg-[#DFC29B] text-[#0E1B14] border-[#DFC29B] shadow-sm'
              : isLight
              ? 'bg-[#E2DDD3] text-[#4A5D49] border-[#C5BFB3]'
              : 'bg-[#0A140F] text-[#9BB09D] border-[#7A9A76]/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            {!clocks || clocks.isUnlimited ? '∞ Santai' : formatChessClockMs(displayMs)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
