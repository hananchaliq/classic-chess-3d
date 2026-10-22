'use client';

import React, { useEffect, useState } from 'react';
import type { ClockSnapshot, PieceColor, PieceSymbol } from '../../types/chess.ts';
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

  const baseClockMs = !clocks || clocks.isUnlimited ? 0 : color === 'w' ? clocks.whiteMs : clocks.blackMs;
  const displayMs =
    clocks && !clocks.isUnlimited && clocks.activeColor === color && liveRemainingMs !== null
      ? liveRemainingMs
      : baseClockMs;

  // Captured pieces shown next to this player are the opponent's color pieces they captured
  const capturedPieceColor: PieceColor = color === 'w' ? 'b' : 'w';
  const isLowTime = Boolean(clocks && !clocks.isUnlimited && displayMs < 20000 && displayMs > 0);

  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg border transition-colors ${
        isTurn
          ? 'bg-[#2A221C] border-[#C7A66A]'
          : 'bg-[#221D19] border-[#38251C]'
      }`}
    >
      {/* Left: Player identity, piece color swatch, captured pieces */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-7 h-7 rounded-md flex items-center justify-center text-base font-bold shrink-0 border ${
            color === 'w'
              ? 'bg-[#F2E9DC] text-[#171513] border-[#C7A66A]'
              : 'bg-[#171513] text-[#F2E9DC] border-[#79543A]'
          }`}
          title={color === 'w' ? 'Pemain Putih' : 'Pemain Hitam'}
        >
          {color === 'w' ? '♔' : '♚'}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#F2E9DC]">
            <span className="truncate max-w-[160px] sm:max-w-[220px]">{displayName}</span>
            {typeof rating === 'number' && (
              <span className="text-xs font-normal text-[#B5A695] font-mono tabular-nums">
                · {rating}
              </span>
            )}
            {roleBadge && (
              <span className="text-xs font-normal text-[#C7A66A] whitespace-nowrap">
                · {roleBadge}
              </span>
            )}
            {isMultiplayer && (
              <span
                className="inline-flex items-center gap-1 text-xs font-normal text-[#B5A695]"
                title={connected ? 'Terhubung ke room' : 'Terputus sementara'}
              >
                {connected ? (
                  <Wifi className="w-3.5 h-3.5 text-[#C7A66A]" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-[#D9534F]" />
                )}
              </span>
            )}
          </div>

          {/* Captured pieces & material diff */}
          <div className="flex items-center gap-1.5 text-xs text-[#B5A695] min-h-[18px]">
            {capturedPieces.length > 0 ? (
              <span className="tracking-tight text-sm leading-none text-[#E7D5B5]">
                {capturedPieces.map((p, idx) => (
                  <span key={`${p}-${idx}`}>{CAPTURED_UNICODE[capturedPieceColor][p]}</span>
                ))}
              </span>
            ) : (
              <span className="text-[11px] text-[#B5A695]/60">
                {color === 'w' ? 'Sisi Putih' : 'Sisi Hitam'}
              </span>
            )}

            {materialAdvantage > 0 && (
              <span className="font-mono tabular-nums text-xs font-semibold text-[#C7A66A]">
                +{materialAdvantage}
              </span>
            )}

            {inCheck && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#D9534F] ml-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>SKAK</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Turn indicator & Chess Clock */}
      <div className="flex items-center gap-3 shrink-0">
        {isTurn && (
          <span className="hidden sm:inline-block text-xs font-medium text-[#C7A66A] whitespace-nowrap">
            Giliran Melangkah
          </span>
        )}

        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-mono tabular-nums text-base sm:text-lg font-semibold border ${
            clocks?.isUnlimited
              ? 'bg-[#171513] text-[#B5A695] border-[#38251C]'
              : isLowTime
              ? 'bg-[#3A1818] text-[#F2E9DC] border-[#D9534F]'
              : isTurn
              ? 'bg-[#C7A66A] text-[#171513] border-[#C7A66A]'
              : 'bg-[#171513] text-[#F2E9DC] border-[#38251C]'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0 opacity-80" />
          <span>
            {!clocks || clocks.isUnlimited ? '∞ Kasual' : formatChessClockMs(displayMs)}
          </span>
        </div>
      </div>
    </div>
  );
}
