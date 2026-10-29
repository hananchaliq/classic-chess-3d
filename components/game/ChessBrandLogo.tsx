'use client';

import React from 'react';

interface ChessBrandEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'espresso' | 'cream' | 'chestnut' | 'forest' | 'sand';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ChessBrandEmblemProps['size']>, string> = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
  xl: 'w-14 h-14',
};

/**
 * Emblem Kuda Catur Mahkota (Royal Crowned Knight Crest)
 * Menggabungkan estetika Botanical Forest Green & Architectural Bronze/Sand:
 * #0D1B14 (Deep Forest), #1A3326 (Rennale Emerald), #4E392B (Archiova Bronze),
 * #7A9A76 (Vellure Sage), #DFC29B (Warm Champagne Sand).
 */
export function ChessBrandEmblem({
  size = 'md',
  variant = 'forest',
  className = '',
}: ChessBrandEmblemProps) {
  const outerFill =
    variant === 'cream' || variant === 'sand'
      ? '#DFC29B'
      : variant === 'chestnut'
      ? '#4E392B'
      : variant === 'espresso'
      ? '#1E1610'
      : '#13281E';

  const innerFill =
    variant === 'cream' || variant === 'sand'
      ? '#1A3326'
      : variant === 'chestnut'
      ? '#1E1610'
      : '#264A39';

  const pieceFill =
    variant === 'cream' || variant === 'sand' ? '#11221A' : '#EFE6D5';
  const pieceStroke =
    variant === 'cream' || variant === 'sand' ? '#264A39' : '#0D1B14';
  const collarFill =
    variant === 'cream' || variant === 'sand' ? '#4E392B' : '#DFC29B';
  const rimStroke =
    variant === 'cream' || variant === 'sand' ? '#5E785D' : '#7A9A76';
  const accentDot =
    variant === 'cream' || variant === 'sand' ? '#5E785D' : '#DFC29B';

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={`${SIZE_CLASSES[size]} shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Outer Medallion Shield */}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill={outerFill}
        stroke={rimStroke}
        strokeWidth="2.4"
      />
      <rect
        x="7"
        y="7"
        width="50"
        height="50"
        rx="12"
        fill={innerFill}
        fillOpacity="0.45"
        stroke={accentDot}
        strokeWidth="1"
        strokeOpacity="0.45"
      />

      {/* Corner Chessboard Squares */}
      <rect x="10" y="10" width="4.5" height="4.5" rx="1" fill={accentDot} fillOpacity="0.4" />
      <rect x="49.5" y="10" width="4.5" height="4.5" rx="1" fill={accentDot} fillOpacity="0.4" />
      <rect x="10" y="49.5" width="4.5" height="4.5" rx="1" fill={accentDot} fillOpacity="0.4" />
      <rect x="49.5" y="49.5" width="4.5" height="4.5" rx="1" fill={accentDot} fillOpacity="0.4" />

      {/* Royal 3-Peak Crown */}
      <path
        d="M23 16.5L26.5 11.2L31.5 14.8L36.5 11.2L40 16.5H23Z"
        fill={collarFill}
        stroke={pieceStroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="26.5" cy="9.8" r="1.4" fill={accentDot} />
      <circle cx="31.5" cy="9" r="1.6" fill={pieceFill} />
      <circle cx="36.5" cy="9.8" r="1.4" fill={accentDot} />

      {/* Sculpted Staunton Knight */}
      <path
        d="M22 44C22 35.5 29.5 36.5 28.5 29.5C25 30.8 20.5 32.5 19 29.5C17.5 26.8 21.5 22.2 25.5 21L27 18H33.5C42.5 19.5 46.5 27.5 45.5 44H22Z"
        fill={pieceFill}
        stroke={pieceStroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle
        cx="25.5"
        cy="24"
        r="1.5"
        fill={variant === 'cream' || variant === 'sand' ? '#DFC29B' : '#13281E'}
      />
      <path
        d="M36.5 22.5C40.5 25.5 42 32 41.5 41"
        stroke={accentDot}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Base Pedestal */}
      <rect
        x="19.5"
        y="44"
        width="25"
        height="3.8"
        rx="1.8"
        fill={collarFill}
        stroke={pieceStroke}
        strokeWidth="1.4"
      />
      <path
        d="M16.5 52.5H47.5C47.5 49.2 44.5 47.8 42 47.8H22C19.5 47.8 16.5 49.2 16.5 52.5Z"
        fill={pieceFill}
        stroke={pieceStroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ChessBrandLockupProps {
  size?: 'sm' | 'md' | 'lg';
  themeMode?: 'light' | 'dark';
  subtitle?: string;
}

export function ChessBrandLockup({
  size = 'md',
  themeMode = 'light',
  subtitle,
}: ChessBrandLockupProps) {
  const isLight = themeMode === 'light';

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <ChessBrandEmblem
        size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
        variant={isLight ? 'forest' : 'sand'}
      />
      <div className="flex flex-col">
        <span
          className={`font-serif font-bold tracking-tight leading-none ${
            size === 'lg'
              ? 'text-2xl sm:text-3xl'
              : size === 'sm'
              ? 'text-lg'
              : 'text-xl sm:text-2xl'
          }`}
        >
          Classic Chess
        </span>
        {subtitle && (
          <span
            className={`text-[11px] font-sans tracking-wide mt-0.5 ${
              isLight ? 'text-[#3F543E]' : 'text-[#9BB09D]'
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
