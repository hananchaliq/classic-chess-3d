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

  const baseClockMs = !clocks || clocks.isUnlimited ? 0 : color === 'w' ? clocks.whiteMs : clocks.blackMs;
  const displayMs =
    clocks && !clocks.isUnlimited && clocks.activeColor === color && liveRemainingMs !== null
      ? liveRemainingMs
      : baseClockMs;

  // Captured pieces shown next to this player are the opponent's color pieces they captured
  const capturedPieceColor: PieceColor = color === 'w' ? 'b' : 'w';
  const isLowTime = Boolean(clocks && !clocks.isUnlimited && displayMs < 20000 && displayMs > 0);
  const isLight = themeMode === 'light';

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border-2 transition-colors ${
        isLight
          ? isTurn
            ? 'bg-[#BEB5A9] border-[#291C0E] text-[#291C0E]'
            : 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E]'
          : isTurn
          ? 'bg-[#6E473B] border-[#E1D4C2] text-[#E1D4C2]'
          : 'bg-[#6E473B] border-[#A78D78] text-[#E1D4C2]'
      }`}
    >
      {/* Left: Player identity, piece color swatch, captured pieces */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold shrink-0 border-2 ${
            color === 'w'
              ? 'bg-[#E1D4C2] text-[#291C0E] border-[#6E473B]'
              : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78]'
          }`}
          title={color === 'w' ? 'Pemain Putih' : 'Pemain Hitam'}
        >
          {color === 'w' ? '♔' : '♚'}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="truncate max-w-[150px] sm:max-w-[230px]">{displayName}</span>
            {typeof rating === 'number' && (
              <span
                className={`text-xs font-normal font-mono tabular-nums ${
                  isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
                }`}
              >
                · {rating}
              </span>
            )}
            {roleBadge && (
              <span
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap border ${
                  isLight
                    ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B]'
                    : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78]'
                }`}
              >
                {roleBadge}
              </span>
            )}
            {isMultiplayer && (
              <span
                className="inline-flex items-center gap-1 text-xs font-normal"
                title={connected ? 'Terhubung ke room' : 'Terputus sementara'}
              >
                {connected ? (
                  <Wifi className="w-3.5 h-3.5" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 opacity-60" />
                )}
              </span>
            )}
          </div>

          {/* Captured pieces & material diff */}
          <div className="flex items-center gap-1.5 text-xs min-h-[18px]">
            {capturedPieces.length > 0 ? (
              <span
                className={`tracking-tight text-sm leading-none ${
                  isLight ? 'text-[#291C0E]' : 'text-[#E1D4C2]'
                }`}
              >
                {capturedPieces.map((p, idx) => (
                  <span key={`${p}-${idx}`}>{CAPTURED_UNICODE[capturedPieceColor][p]}</span>
                ))}
              </span>
            ) : (
              <span
                className={`text-[11px] ${
                  isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
                }`}
              >
                {color === 'w' ? 'Sisi Putih' : 'Sisi Hitam'}
              </span>
            )}

            {materialAdvantage > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded font-mono tabular-nums text-[11px] font-bold ${
                  isLight
                    ? 'bg-[#6E473B] text-[#E1D4C2]'
                    : 'bg-[#E1D4C2] text-[#291C0E]'
                }`}
              >
                +{materialAdvantage}
              </span>
            )}

            {inCheck && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-[#291C0E] text-[#E1D4C2] border border-[#E1D4C2] ml-1">
                <ShieldAlert className="w-3 h-3" />
                <span>SKAK</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Turn indicator & Chess Clock */}
      <div className="flex items-center gap-2.5 shrink-0">
        {isTurn && (
          <span
            className={`hidden sm:inline-block px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
              isLight
                ? 'bg-[#A78D78] text-[#291C0E]'
                : 'bg-[#A78D78] text-[#291C0E]'
            }`}
          >
            Giliran Jalan
          </span>
        )}

        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono tabular-nums text-sm sm:text-base font-bold border-2 ${
            clocks?.isUnlimited
              ? isLight
                ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78]'
                : 'bg-[#291C0E] text-[#BEB5A9] border-[#A78D78]'
              : isLowTime
              ? 'bg-[#291C0E] text-[#E1D4C2] border-[#E1D4C2]'
              : isTurn
              ? isLight
                ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E]'
                : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9]'
              : isLight
              ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78]'
              : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78]'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            {!clocks || clocks.isUnlimited ? '∞ Santai' : formatChessClockMs(displayMs)}
          </span>
        </div>
      </div>
    </div>
  );
}
