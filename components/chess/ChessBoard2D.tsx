'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type {
  BoardPiece,
  LegalMoveOption,
  PieceColor,
  PieceSymbol,
} from '../../types/chess.ts';
import { indicesToSquare, parseBoardFromFen } from '../../lib/chess-rules.ts';
import type {
  BoardTheme2DId,
  PieceStyle2DId,
} from '../../lib/board-themes-2d.ts';
import {
  BOARD_THEMES_2D,
  BOARD_THEME_2D_LIST,
  PIECE_STYLES_2D,
  PIECE_STYLE_2D_LIST,
} from '../../lib/board-themes-2d.ts';
import {
  FlipHorizontal2,
  ShieldAlert,
  Box,
  Palette,
  Sparkles,
  Check,
  Eye,
  X,
  Shuffle,
  Crown,
} from 'lucide-react';

export interface ChessBoard2DProps {
  fen: string;
  orientation: PieceColor;
  selectedSquare: string | null;
  legalMoves: LegalMoveOption[];
  lastMove: { from: string; to: string } | null;
  wasCapture?: boolean;
  hintMove?: { from: string; to: string } | null;
  kingSquareInCheck: string | null;
  interactive: boolean;
  onSquareSelect: (square: string) => void;
  onMoveAttempt: (from: string, to: string) => void;
  onFlipOrientation?: () => void;
  themeMode?: 'light' | 'dark';
  isDesktopViewport?: boolean;
  onSwitchTo3D?: () => void;
  boardThemeId?: BoardTheme2DId;
  onSelectBoardTheme?: (id: BoardTheme2DId) => void;
  pieceStyle2D?: PieceStyle2DId;
  onSelectPieceStyle2D?: (id: PieceStyle2DId) => void;
  showThemePickerExternal?: boolean;
  onToggleThemePickerExternal?: (open: boolean) => void;
}

const PIECE_NAMES_ID: Record<PieceSymbol, string> = {
  k: 'Raja',
  q: 'Ratu',
  r: 'Benteng',
  b: 'Gajah',
  n: 'Kuda',
  p: 'Pion',
};

interface ThemeTailwindClasses {
  lightBg: string;
  darkBg: string;
  selectedBg: string;
  lastLightBg: string;
  lastDarkBg: string;
  coordOnLight: string;
  coordOnDark: string;
  outerBorder: string;
}

const THEME_CLASS_MAP: Record<BoardTheme2DId, ThemeTailwindClasses> = {
  rennake_forest: {
    lightBg: 'bg-[#E3DEC6]',
    darkBg: 'bg-[#1F4031]',
    selectedBg: 'bg-[#7A9A76]',
    lastLightBg: 'bg-[#D0C9A8]',
    lastDarkBg: 'bg-[#2E5945]',
    coordOnLight: 'text-[#1F4031]',
    coordOnDark: 'text-[#E3DEC6]',
    outerBorder: 'border-[#162E22]',
  },
  archiova_bronze: {
    lightBg: 'bg-[#E6D7C3]',
    darkBg: 'bg-[#4E392B]',
    selectedBg: 'bg-[#9C7A54]',
    lastLightBg: 'bg-[#D6C1A4]',
    lastDarkBg: 'bg-[#694D3A]',
    coordOnLight: 'text-[#4E392B]',
    coordOnDark: 'text-[#E6D7C3]',
    outerBorder: 'border-[#261B13]',
  },
  vellure_sage: {
    lightBg: 'bg-[#EAE6DF]',
    darkBg: 'bg-[#5E785D]',
    selectedBg: 'bg-[#9AB396]',
    lastLightBg: 'bg-[#D7D2C6]',
    lastDarkBg: 'bg-[#739172]',
    coordOnLight: 'text-[#3F543E]',
    coordOnDark: 'text-[#EAE6DF]',
    outerBorder: 'border-[#1F2D21]',
  },
  nextgenix_emerald: {
    lightBg: 'bg-[#D7E6DF]',
    darkBg: 'bg-[#143328]',
    selectedBg: 'bg-[#3B7A5E]',
    lastLightBg: 'bg-[#B8D4C7]',
    lastDarkBg: 'bg-[#1E4B3B]',
    coordOnLight: 'text-[#143328]',
    coordOnDark: 'text-[#D7E6DF]',
    outerBorder: 'border-[#0D211A]',
  },
  espresso_cream: {
    lightBg: 'bg-[#E1D4C2]',
    darkBg: 'bg-[#6E473B]',
    selectedBg: 'bg-[#A78D78]',
    lastLightBg: 'bg-[#D5C0A5]',
    lastDarkBg: 'bg-[#875849]',
    coordOnLight: 'text-[#6E473B]',
    coordOnDark: 'text-[#E1D4C2]',
    outerBorder: 'border-[#291C0E]',
  },
  chesscom_green: {
    lightBg: 'bg-[#EEEED2]',
    darkBg: 'bg-[#769656]',
    selectedBg: 'bg-[#BACA44]',
    lastLightBg: 'bg-[#F6F669]',
    lastDarkBg: 'bg-[#BACA44]',
    coordOnLight: 'text-[#769656]',
    coordOnDark: 'text-[#EEEED2]',
    outerBorder: 'border-[#1D2B1A]',
  },
  taupe_stone: {
    lightBg: 'bg-[#E1D4C2]',
    darkBg: 'bg-[#A78D78]',
    selectedBg: 'bg-[#6E473B]',
    lastLightBg: 'bg-[#CFC2B0]',
    lastDarkBg: 'bg-[#8E735E]',
    coordOnLight: 'text-[#6E473B]',
    coordOnDark: 'text-[#291C0E]',
    outerBorder: 'border-[#6E473B]',
  },
  obsidian_ivory: {
    lightBg: 'bg-[#BEB5A9]',
    darkBg: 'bg-[#291C0E]',
    selectedBg: 'bg-[#6E473B]',
    lastLightBg: 'bg-[#A78D78]',
    lastDarkBg: 'bg-[#523624]',
    coordOnLight: 'text-[#291C0E]',
    coordOnDark: 'text-[#E1D4C2]',
    outerBorder: 'border-[#291C0E]',
  },
  walnut_maple: {
    lightBg: 'bg-[#EAE0C8]',
    darkBg: 'bg-[#8B5A2B]',
    selectedBg: 'bg-[#C18C5D]',
    lastLightBg: 'bg-[#DFC99B]',
    lastDarkBg: 'bg-[#A66E38]',
    coordOnLight: 'text-[#8B5A2B]',
    coordOnDark: 'text-[#EAE0C8]',
    outerBorder: 'border-[#3B2314]',
  },
  tournament_blue: {
    lightBg: 'bg-[#DEE3E6]',
    darkBg: 'bg-[#4B7399]',
    selectedBg: 'bg-[#729FCF]',
    lastLightBg: 'bg-[#B7D0E8]',
    lastDarkBg: 'bg-[#5B8BB8]',
    coordOnLight: 'text-[#4B7399]',
    coordOnDark: 'text-[#DEE3E6]',
    outerBorder: 'border-[#1E293B]',
  },
  coral_sand: {
    lightBg: 'bg-[#F4EBE1]',
    darkBg: 'bg-[#B0644F]',
    selectedBg: 'bg-[#D4846A]',
    lastLightBg: 'bg-[#E8D3BD]',
    lastDarkBg: 'bg-[#C4755E]',
    coordOnLight: 'text-[#B0644F]',
    coordOnDark: 'text-[#F4EBE1]',
    outerBorder: 'border-[#4A251B]',
  },
  emerald_marble: {
    lightBg: 'bg-[#E6EDE8]',
    darkBg: 'bg-[#3B6E5C]',
    selectedBg: 'bg-[#5C9B84]',
    lastLightBg: 'bg-[#C5DDD0]',
    lastDarkBg: 'bg-[#4B8570]',
    coordOnLight: 'text-[#3B6E5C]',
    coordOnDark: 'text-[#E6EDE8]',
    outerBorder: 'border-[#1A332A]',
  },
};

export function ChessPiece2DSvg({
  type,
  color,
  pieceStyle = 'rennake_botanical',
}: {
  type: PieceSymbol;
  color: PieceColor;
  pieceStyle?: PieceStyle2DId;
}) {
  const isWhite = color === 'w';
  const preset = PIECE_STYLES_2D[pieceStyle] || PIECE_STYLES_2D.rennake_botanical;

  const primaryFill = isWhite ? preset.whitePrimary : preset.blackPrimary;
  const secondaryFill = isWhite ? preset.whiteSecondary : preset.blackSecondary;
  const accentDetail = isWhite ? preset.whiteAccent : preset.blackAccent;
  const strokeColor = isWhite ? preset.whiteStroke : preset.blackStroke;
  const outerRimForBlack = !isWhite ? preset.blackOuterRim : 'none';
  const innerHighlight = isWhite ? preset.whiteAccent : preset.blackAccent;
  const showGem = preset.badgeStyle === 'gem';
  const showCrown = preset.badgeStyle === 'crown';
  const isMinimal = preset.badgeStyle === 'minimal';

  switch (type) {
    case 'p':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[82%] h-[82%] select-none pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.42)]"
          aria-hidden="true"
        >
          {!isWhite && (
            <path
              d="M 22.5,8.5 C 19.2,8.5 16.5,11.2 16.5,14.5 C 16.5,16.8 18,18.7 20,19.5 C 17,21.2 15,24.5 15,29 L 11,36.5 L 34,36.5 L 30,29 C 30,24.5 28,21.2 25,19.5 C 27,18.7 28.5,16.8 28.5,14.5 C 28.5,11.2 25.8,8.5 22.5,8.5 z"
              fill="none"
              stroke={outerRimForBlack}
              strokeWidth="3.2"
              strokeOpacity="0.6"
              strokeLinejoin="round"
            />
          )}
          <path
            d="M 22.5,9 C 19.5,9 17,11.5 17,14.5 C 17,16.8 18.4,18.7 20.4,19.5 C 17.5,21.2 15.5,24.5 15.5,29 L 29.5,29 C 29.5,24.5 27.5,21.2 24.6,19.5 C 26.6,18.7 28,16.8 28,14.5 C 28,11.5 25.5,9 22.5,9 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <rect
            x="13.5"
            y="29"
            width="18"
            height="3.5"
            rx="1.5"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="1.9"
          />
          <path
            d="M 11,36.5 L 34,36.5 C 34,33.5 31,32.5 29.5,32.5 L 15.5,32.5 C 14,32.5 11,33.5 11,36.5 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          {showCrown && <circle cx="22.5" cy="14" r="1.9" fill={accentDetail} />}
          {showGem && (
            <polygon
              points="22.5,21.5 24.7,24.2 22.5,26.9 20.3,24.2"
              fill={accentDetail}
            />
          )}
        </svg>
      );

    case 'r':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[84%] h-[84%] select-none pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.42)]"
          aria-hidden="true"
        >
          {!isWhite && (
            <path
              d="M 13.5,10.5 L 31.5,10.5 L 30.5,29.5 L 34,36.5 L 11,36.5 L 14.5,29.5 Z"
              fill="none"
              stroke={outerRimForBlack}
              strokeWidth="3"
              strokeOpacity="0.55"
              strokeLinejoin="round"
            />
          )}
          <path
            d="M 14,11 L 14,16 L 18,16 L 18,13 L 21,13 L 21,16 L 24,16 L 24,13 L 27,13 L 27,16 L 31,16 L 31,11 L 28,11 L 28,13.2 L 25,13.2 L 25,11 L 20,11 L 20,13.2 L 17,13.2 L 17,11 L 14,11 z"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M 15,16 L 16.5,29.5 L 28.5,29.5 L 30,16 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          {!isMinimal && (
            <line
              x1="18"
              y1="20.5"
              x2="27"
              y2="20.5"
              stroke={innerHighlight}
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          )}
          {showGem && (
            <polygon
              points="22.5,22.2 24.5,24.8 22.5,27.4 20.5,24.8"
              fill={accentDetail}
            />
          )}
          <rect
            x="13.5"
            y="29.5"
            width="18"
            height="3.5"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="1.9"
          />
          <path
            d="M 11,36.5 L 34,36.5 L 32.5,33 L 12.5,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'n':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[85%] h-[85%] select-none pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.42)]"
          aria-hidden="true"
        >
          {!isWhite && (
            <path
              d="M 22,9.5 C 31,10.5 35.8,18 35.2,30 L 34,36.5 L 11,36.5 L 15,30 C 15,23 22,24.5 21,18 C 18,19 14.5,21 13,18.5 C 11.5,16 15,12 18,11.5 L 19,9 L 22,9.5 z"
              fill="none"
              stroke={outerRimForBlack}
              strokeWidth="3.2"
              strokeOpacity="0.6"
              strokeLinejoin="round"
            />
          )}
          <path
            d="M 22,10 C 30.5,11 35.5,18 35,30 L 15,30 C 15,23 22,24.5 21,18 C 18,19 14.5,21 13,18.5 C 11.5,16 15,12 18,11.5 L 19,9 L 22,10 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <circle cx="18.5" cy="14.5" r="1.6" fill={innerHighlight} />
          {(showCrown || showGem) && (
            <path
              d="M 28.5,14.5 C 31.8,17.8 32.8,23 32.2,28"
              stroke={accentDetail}
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
          <rect
            x="13.5"
            y="30"
            width="18"
            height="3"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="1.9"
          />
          <path
            d="M 11,36.5 L 34,36.5 L 32.5,33 L 12.5,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'b':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[85%] h-[85%] select-none pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.42)]"
          aria-hidden="true"
        >
          {!isWhite && (
            <path
              d="M 22.5,7 C 16,13 14.5,21 16,29.5 L 11,36.5 L 34,36.5 L 29,29.5 C 30.5,21 29,13 22.5,7 z"
              fill="none"
              stroke={outerRimForBlack}
              strokeWidth="3"
              strokeOpacity="0.6"
              strokeLinejoin="round"
            />
          )}
          <circle
            cx="22.5"
            cy="9"
            r="2.3"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="1.8"
          />
          <path
            d="M 22.5,11.5 C 16.5,14.5 14.5,21.5 16,29.5 L 29,29.5 C 30.5,21.5 28.5,14.5 22.5,11.5 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          {showGem ? (
            <polygon
              points="22.5,16 25,19 22.5,22 20,19"
              fill={accentDetail}
            />
          ) : (
            <path
              d="M 20,17.5 L 25,17.5 M 22.5,15 L 22.5,20"
              stroke={innerHighlight}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          )}
          <rect
            x="13.5"
            y="29.5"
            width="18"
            height="3.5"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="1.9"
          />
          <path
            d="M 11,36.5 L 34,36.5 L 32.5,33 L 12.5,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'q':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[86%] h-[86%] select-none pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.42)]"
          aria-hidden="true"
        >
          {!isWhite && (
            <path
              d="M 9,14 L 14,29.5 L 10.5,36.5 L 34.5,36.5 L 31,29.5 L 36,14 L 29,21 L 22.5,11 L 16,21 L 9,14 z"
              fill="none"
              stroke={outerRimForBlack}
              strokeWidth="3.2"
              strokeOpacity="0.6"
              strokeLinejoin="round"
            />
          )}
          <path
            d="M 9,14 L 14,29.5 L 31,29.5 L 36,14 L 29,21 L 22.5,11 L 16,21 L 9,14 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="12.5" r="1.8" fill={accentDetail} stroke={strokeColor} strokeWidth="1.4" />
          <circle cx="16" cy="10.5" r="1.8" fill={accentDetail} stroke={strokeColor} strokeWidth="1.4" />
          <circle cx="22.5" cy="9.5" r="2.1" fill={secondaryFill} stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="29" cy="10.5" r="1.8" fill={accentDetail} stroke={strokeColor} strokeWidth="1.4" />
          <circle cx="36" cy="12.5" r="1.8" fill={accentDetail} stroke={strokeColor} strokeWidth="1.4" />
          {showGem && (
            <polygon
              points="22.5,21 24.8,23.8 22.5,26.6 20.2,23.8"
              fill={accentDetail}
            />
          )}
          <rect
            x="13"
            y="29.5"
            width="19"
            height="3.5"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="1.9"
          />
          <path
            d="M 10.5,36.5 L 34.5,36.5 L 33,33 L 12,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'k':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[86%] h-[86%] select-none pointer-events-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.42)]"
          aria-hidden="true"
        >
          {!isWhite && (
            <path
              d="M 22.5,6.5 L 22.5,12.5 C 16,13.5 12.5,19 14.5,29.5 L 10.5,36.5 L 34.5,36.5 L 30.5,29.5 C 32.5,19 29,13.5 22.5,12.5"
              fill="none"
              stroke={outerRimForBlack}
              strokeWidth="3.2"
              strokeOpacity="0.6"
              strokeLinejoin="round"
            />
          )}
          <path
            d="M 22.5,6.5 L 22.5,12.5 M 19.5,9.5 L 25.5,9.5"
            stroke={!isWhite ? preset.blackOuterRim : strokeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 22.5,12.5 C 16,13.5 12.5,19 14.5,29.5 L 30.5,29.5 C 32.5,19 29,13.5 22.5,12.5 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          {showGem ? (
            <polygon
              points="22.5,17.5 25.2,20.8 22.5,24.1 19.8,20.8"
              fill={accentDetail}
            />
          ) : (
            <path
              d="M 18,20 C 20,17.5 25,17.5 27,20"
              fill="none"
              stroke={innerHighlight}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          )}
          <rect
            x="13"
            y="29.5"
            width="19"
            height="3.5"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="1.9"
          />
          <path
            d="M 10.5,36.5 L 34.5,36.5 L 33,33 L 12,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function squareToBoardCoords(
  square: string,
  orientation: PieceColor
): { x: number; y: number } | null {
  if (square.length < 2) return null;
  const fileIdx = square.charCodeAt(0) - 97;
  const rankIdx = parseInt(square[1], 10) - 1;
  if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return null;

  const visualCol = orientation === 'w' ? fileIdx : 7 - fileIdx;
  const visualRow = orientation === 'w' ? 7 - rankIdx : rankIdx;

  return {
    x: visualCol * 12.5 + 6.25,
    y: visualRow * 12.5 + 6.25,
  };
}

function getMoveSlideDeltaPercent(
  fromSquare: string,
  toSquare: string,
  orientation: PieceColor
): { dxPercent: string; dyPercent: string } | null {
  if (fromSquare.length < 2 || toSquare.length < 2) return null;
  const fromFile = fromSquare.charCodeAt(0) - 97;
  const fromRank = parseInt(fromSquare[1], 10) - 1;
  const toFile = toSquare.charCodeAt(0) - 97;
  const toRank = parseInt(toSquare[1], 10) - 1;

  const fromCol = orientation === 'w' ? fromFile : 7 - fromFile;
  const fromRow = orientation === 'w' ? 7 - fromRank : fromRank;
  const toCol = orientation === 'w' ? toFile : 7 - toFile;
  const toRow = orientation === 'w' ? 7 - toRank : toRank;

  const dCol = fromCol - toCol;
  const dRow = fromRow - toRow;

  return {
    dxPercent: `${dCol * 100}%`,
    dyPercent: `${dRow * 100}%`,
  };
}

export default function ChessBoard2D({
  fen,
  orientation,
  selectedSquare,
  legalMoves,
  lastMove,
  wasCapture = false,
  hintMove = null,
  kingSquareInCheck,
  interactive,
  onSquareSelect,
  onMoveAttempt,
  onFlipOrientation,
  themeMode = 'dark',
  isDesktopViewport = false,
  onSwitchTo3D,
  boardThemeId = 'rennake_forest',
  onSelectBoardTheme,
  pieceStyle2D = 'rennake_botanical',
  onSelectPieceStyle2D,
  showThemePickerExternal,
  onToggleThemePickerExternal,
}: ChessBoard2DProps) {
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [internalThemePicker, setInternalThemePicker] = useState(false);
  const [dragOriginSquare, setDragOriginSquare] = useState<string | null>(null);
  const [markedSquares, setMarkedSquares] = useState<Set<string>>(new Set());

  const showThemePicker =
    showThemePickerExternal !== undefined ? showThemePickerExternal : internalThemePicker;

  const setShowThemePicker = (next: boolean) => {
    setInternalThemePicker(next);
    onToggleThemePickerExternal?.(next);
  };

  const activeTheme = BOARD_THEMES_2D[boardThemeId] || BOARD_THEMES_2D.rennake_forest;
  const activePiecePreset =
    PIECE_STYLES_2D[pieceStyle2D] || PIECE_STYLES_2D.rennake_botanical;
  const activeClasses = THEME_CLASS_MAP[boardThemeId] || THEME_CLASS_MAP.rennake_forest;
  const isLightTheme = themeMode === 'light';

  const piecesBySquare = useMemo(() => {
    const pieces = parseBoardFromFen(fen);
    const map = new Map<string, BoardPiece>();
    for (const p of pieces) {
      map.set(p.square, p);
    }
    return map;
  }, [fen]);

  const legalMovesByTarget = useMemo(() => {
    const map = new Map<string, LegalMoveOption>();
    for (const m of legalMoves) {
      map.set(m.to, m);
    }
    return map;
  }, [legalMoves]);

  const rankIndices =
    orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const orderedFiles =
    orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  const handleSquareClick = (square: string) => {
    if (markedSquares.size > 0) {
      setMarkedSquares(new Set());
    }
    if (!interactive) return;

    if (selectedSquare && selectedSquare !== square && legalMovesByTarget.has(square)) {
      onMoveAttempt(selectedSquare, square);
      return;
    }

    onSquareSelect(square);
  };

  const handleSquareContextMenu = (e: React.MouseEvent, square: string) => {
    e.preventDefault();
    setMarkedSquares((prev) => {
      const next = new Set(prev);
      if (next.has(square)) {
        next.delete(square);
      } else {
        next.add(square);
      }
      return next;
    });
  };

  const handleQuickCycleBothThemes = () => {
    const nextBoardIdx =
      (BOARD_THEME_2D_LIST.findIndex((b) => b.id === boardThemeId) + 1) %
      BOARD_THEME_2D_LIST.length;
    const nextPieceIdx =
      (PIECE_STYLE_2D_LIST.findIndex((p) => p.id === pieceStyle2D) + 1) %
      PIECE_STYLE_2D_LIST.length;
    onSelectBoardTheme?.(BOARD_THEME_2D_LIST[nextBoardIdx].id);
    onSelectPieceStyle2D?.(PIECE_STYLE_2D_LIST[nextPieceIdx].id);
  };

  const hintArrowCoords = useMemo(() => {
    if (!hintMove) return null;
    const fromPt = squareToBoardCoords(hintMove.from, orientation);
    const toPt = squareToBoardCoords(hintMove.to, orientation);
    if (!fromPt || !toPt) return null;
    return { fromPt, toPt };
  }, [hintMove, orientation]);

  return (
    <div className="w-full flex flex-col items-center select-none relative">
      {/* Main Tactile Square 2D Chessboard */}
      <div
        className={`relative w-full aspect-square rounded-2xl overflow-hidden border-[3px] transition-shadow duration-300 ${
          activeClasses.outerBorder
        } ${
          isLightTheme
            ? 'shadow-[0_14px_34px_-10px_rgba(15,28,21,0.28)]'
            : 'shadow-[0_22px_52px_-12px_rgba(0,0,0,0.88)] ring-1 ring-[#7A9A76]/25'
        }`}
      >
        <div className="w-full h-full grid grid-cols-8 grid-rows-8">
          {rankIndices.map((rankIdx, visualRow) =>
            orderedFiles.map((fileIdx, visualCol) => {
              const square = indicesToSquare(fileIdx, rankIdx);
              const isLightSquare = (fileIdx + rankIdx) % 2 === 1;
              const piece = piecesBySquare.get(square);
              const isSelected = selectedSquare === square;
              const legalMove = legalMovesByTarget.get(square);
              const isLastMoveFrom = lastMove?.from === square;
              const isLastMoveTo = lastMove?.to === square;
              const isLastMove = isLastMoveFrom || isLastMoveTo;
              const isHintSquare =
                hintMove?.from === square || hintMove?.to === square;
              const isKingInCheck = kingSquareInCheck === square;
              const isRightClickMarked = markedSquares.has(square);

              const rankLabel = String(rankIdx + 1);
              const fileLabel = String.fromCharCode(97 + fileIdx);

              let squareBgClass = isLightSquare
                ? activeClasses.lightBg
                : activeClasses.darkBg;

              if (isSelected) {
                squareBgClass = activeClasses.selectedBg;
              } else if (isRightClickMarked) {
                squareBgClass = 'bg-[#B0644F]';
              } else if (isLastMove) {
                squareBgClass = isLightSquare
                  ? activeClasses.lastLightBg
                  : activeClasses.lastDarkBg;
              }

              const coordTextClass = isSelected
                ? 'text-[#0E1B14]'
                : isLightSquare
                ? activeClasses.coordOnLight
                : activeClasses.coordOnDark;

              const slideDelta =
                isLastMoveTo && lastMove
                  ? getMoveSlideDeltaPercent(lastMove.from, lastMove.to, orientation)
                  : null;

              return (
                <button
                  key={square}
                  type="button"
                  aria-label={`Petak ${square}${
                    piece
                      ? ` berisi ${PIECE_NAMES_ID[piece.type]} ${
                          piece.color === 'w' ? 'Putih' : 'Hitam'
                        }`
                      : ''
                  }`}
                  onClick={() => handleSquareClick(square)}
                  onContextMenu={(e) => handleSquareContextMenu(e, square)}
                  onDragStart={(e) => {
                    if (!interactive || !piece) {
                      e.preventDefault();
                      return;
                    }
                    setDragOriginSquare(square);
                    onSquareSelect(square);
                    e.dataTransfer.setData('text/plain', square);
                  }}
                  onDragOver={(e) => {
                    if (interactive) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!interactive) return;
                    const fromSq =
                      e.dataTransfer.getData('text/plain') || dragOriginSquare;
                    setDragOriginSquare(null);
                    if (fromSq && fromSq !== square) {
                      onMoveAttempt(fromSq, square);
                    }
                  }}
                  draggable={Boolean(interactive && piece)}
                  className={`relative w-full h-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#DFC29B] transition-colors duration-100 ${squareBgClass} ${
                    interactive && (piece || legalMove)
                      ? 'cursor-pointer'
                      : 'cursor-default'
                  }`}
                >
                  {/* Animated King in Check crimson alert pulse */}
                  {isKingInCheck && (
                    <motion.span
                      initial={{ opacity: 0.4, scale: 0.85 }}
                      animate={{ opacity: [0.55, 0.85, 0.55], scale: [0.96, 1.02, 0.96] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-0 bg-[#DC2626]/65 ring-4 ring-inset ring-[#7F1D1D] pointer-events-none"
                    />
                  )}

                  {/* Capture Burst Effect when a piece is captured on this square */}
                  <AnimatePresence>
                    {isLastMoveTo && wasCapture && (
                      <motion.span
                        key={`capture-burst-${fen}-${square}`}
                        initial={{ scale: 0.35, opacity: 0.9 }}
                        animate={{ scale: 1.35, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.38, ease: 'easeOut' }}
                        className="absolute w-[86%] h-[86%] rounded-full border-4 border-[#DFC29B] pointer-events-none z-20"
                      />
                    )}
                  </AnimatePresence>

                  {/* Hint square subtle frame */}
                  {isHintSquare && !isKingInCheck && (
                    <span className="absolute inset-0 ring-[3px] ring-inset ring-[#12231B]/80 pointer-events-none" />
                  )}

                  {/* Chess.com Rank Coordinate (Top-Left of Leftmost Column) */}
                  {showCoordinates && visualCol === 0 && (
                    <span
                      className={`absolute top-0.5 left-1 text-[10px] sm:text-[11px] font-sans font-bold leading-none pointer-events-none ${coordTextClass}`}
                    >
                      {rankLabel}
                    </span>
                  )}

                  {/* Chess.com File Coordinate (Bottom-Right of Bottom Row) */}
                  {showCoordinates && visualRow === 7 && (
                    <span
                      className={`absolute bottom-0.5 right-1 text-[10px] sm:text-[11px] font-sans font-bold leading-none pointer-events-none ${coordTextClass}`}
                    >
                      {fileLabel}
                    </span>
                  )}

                  {/* Animated Chess Piece Vector */}
                  {piece && (
                    <motion.div
                      key={
                        isLastMoveTo
                          ? `moved-${piece.color}-${piece.type}-${fen}`
                          : `static-${square}-${piece.color}-${piece.type}`
                      }
                      initial={
                        slideDelta
                          ? {
                              x: slideDelta.dxPercent,
                              y: slideDelta.dyPercent,
                              scale: 1.12,
                            }
                          : false
                      }
                      animate={{
                        x: '0%',
                        y: '0%',
                        scale: isSelected ? 1.08 : 1,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 440,
                        damping: 32,
                        mass: 0.7,
                      }}
                      className={`w-full h-full flex items-center justify-center ${
                        isLastMoveTo ? 'z-10' : ''
                      }`}
                    >
                      <ChessPiece2DSvg
                        type={piece.type}
                        color={piece.color}
                        pieceStyle={pieceStyle2D}
                      />
                    </motion.div>
                  )}

                  {/* Chess.com Legal Move Dot (Animated pop-in) */}
                  {legalMove && !piece && (
                    <motion.span
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      className="w-[30%] h-[30%] rounded-full bg-black/24 pointer-events-none"
                    />
                  )}

                  {/* Chess.com Legal Capture Ring (Animated pop-in) */}
                  {legalMove && piece && (
                    <motion.span
                      initial={{ scale: 0.75, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute w-[88%] h-[88%] rounded-full border-[5px] sm:border-[6px] border-black/28 pointer-events-none"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Tactical Hint Arrow Overlay */}
        {hintArrowCoords && (
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="hintArrowHead"
                markerWidth="4.5"
                markerHeight="4.5"
                refX="2.8"
                refY="2.25"
                orient="auto"
              >
                <polygon
                  points="0 0, 4.5 2.25, 0 4.5"
                  fill={activeTheme.arrowColor}
                  fillOpacity="0.92"
                />
              </marker>
            </defs>
            <line
              x1={hintArrowCoords.fromPt.x}
              y1={hintArrowCoords.fromPt.y}
              x2={hintArrowCoords.toPt.x}
              y2={hintArrowCoords.toPt.y}
              stroke={activeTheme.arrowColor}
              strokeWidth="2.5"
              strokeOpacity="0.92"
              strokeLinecap="round"
              markerEnd="url(#hintArrowHead)"
            />
          </svg>
        )}
      </div>

      {/* Sleek Floating Utility Strip Under Board — 1 Unified Simple Button for 2D Board + Piece Themes */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 mt-2.5 px-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* THE 1 SIMPLE UNIFIED BUTTON FOR 2D BOARD THEME & PIECE THEME */}
          <button
            type="button"
            onClick={() => setShowThemePicker(!showThemePicker)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
              showThemePicker
                ? 'bg-[#DFC29B] text-[#0E1B14] border-[#DFC29B] font-bold shadow-sm'
                : isLightTheme
                ? 'bg-[#14261D] text-[#F3ECE0] border-[#264A39] hover:bg-[#1E382B]'
                : 'bg-[#13241B] text-[#EFE6D5] border-[#7A9A76]/35 hover:border-[#DFC29B]/70 shadow-[inset_0_1px_0_0_rgba(223,194,155,0.12)]'
            }`}
            title="Atur Tema Papan 2D & Tema Bidak Catur lewat 1 tombol"
          >
            <Palette className="w-3.5 h-3.5 text-[#DFC29B] shrink-0" />
            <span>
              Tema: {activeTheme.name} · {activePiecePreset.name}
            </span>
          </button>

          {kingSquareInCheck && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#B91C1C] text-white"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Skak!</span>
            </motion.span>
          )}

          {hintMove && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#DFC29B] text-[#0E1B14]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                Saran: {hintMove.from.toUpperCase()} → {hintMove.to.toUpperCase()}
              </span>
            </motion.span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCoordinates((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
              showCoordinates
                ? isLightTheme
                  ? 'bg-[#14261D] text-[#EFE6D5] border-[#14261D]'
                  : 'bg-[#192E23] text-[#EFE6D5] border-[#7A9A76]/45'
                : isLightTheme
                ? 'bg-[#E2DDD3] text-[#3F543E] border-[#C5BFB3]'
                : 'bg-[#0F1C15] text-[#9BB09D] border-[#7A9A76]/25'
            }`}
            title="Tampilkan atau sembunyikan koordinat petak"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Koordinat</span>
          </button>

          {onFlipOrientation && (
            <button
              type="button"
              onClick={onFlipOrientation}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
                isLightTheme
                  ? 'bg-[#E2DDD3] text-[#14261D] border-[#C5BFB3] hover:bg-[#D5CFC3]'
                  : 'bg-[#13241B] text-[#EFE6D5] border-[#7A9A76]/35 hover:border-[#DFC29B]/60'
              }`}
              title="Putar arah pandang papan catur"
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
              <span>Putar</span>
            </button>
          )}

          {isDesktopViewport && onSwitchTo3D && (
            <button
              type="button"
              onClick={onSwitchTo3D}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap"
              title="Beralih ke Papan Catur 3D (Khusus Desktop)"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Mode 3D</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified 1-Button Compact Popover for 12 Board Themes + 8 Piece Themes */}
      <AnimatePresence>
        {showThemePicker && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`w-full mt-2.5 p-3.5 sm:p-4 rounded-2xl border transition-colors ${
              isLightTheme
                ? 'bg-[#F4F1EA] border-[#C5BFB3] text-[#12231B] shadow-lg'
                : 'bg-[#101F18] border-[#7A9A76]/40 text-[#F3ECE0] shadow-[0_20px_48px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(223,194,155,0.14)]'
            }`}
          >
            {/* Header + 1-Click Quick Cycle Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[#7A9A76]/25">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#DFC29B]" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold font-serif leading-tight">
                    Kustomisasi Visual 2D (12 Papan & 8 Tema Bidak)
                  </h4>
                  <p
                    className={`text-[10px] ${
                      isLightTheme ? 'text-[#4E634D]' : 'text-[#9BB09D]'
                    }`}
                  >
                    Padukan tema papan dan tema bidak sesuai selera Anda
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleQuickCycleBothThemes}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap"
                  title="Ganti kombinasi tema papan & bidak secara instan"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Ganti Cepat</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowThemePicker(false)}
                  className={`p-1 rounded-lg border transition-colors ${
                    isLightTheme
                      ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3]'
                      : 'bg-[#1A2F24] text-[#EFE6D5] border-[#7A9A76]/35 hover:border-[#DFC29B]'
                  }`}
                  aria-label="Tutup pemilih tema"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Section 1: 12 Board Themes Grid */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A9A76]">
                  1. Pilih Tema Papan 2D ({BOARD_THEME_2D_LIST.length} Tema)
                </span>
                <span className="text-[11px] font-semibold text-[#DFC29B]">
                  {activeTheme.name}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {BOARD_THEME_2D_LIST.map((t) => {
                  const isSelected = t.id === boardThemeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectBoardTheme?.(t.id)}
                      className={`flex items-center gap-2 p-1.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-[#DFC29B] text-[#0E1B14] border-[#DFC29B] font-bold shadow-xs'
                          : isLightTheme
                          ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3] hover:border-[#5E785D]'
                          : 'bg-[#0B1611] text-[#EFE6D5] border-[#7A9A76]/25 hover:border-[#DFC29B]/60'
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5 rounded shrink-0 overflow-hidden border border-black/30"
                        aria-hidden="true"
                      >
                        <rect x="0" y="0" width="12" height="12" fill={t.lightSquare} />
                        <rect x="12" y="0" width="12" height="12" fill={t.darkSquare} />
                        <rect x="0" y="12" width="12" height="12" fill={t.darkSquare} />
                        <rect x="12" y="12" width="12" height="12" fill={t.lightSquare} />
                      </svg>
                      <span className="text-[11px] font-semibold truncate flex-1">
                        {t.name}
                      </span>
                      {isSelected && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: 8 Piece Themes Grid with Live Dual-Piece Color Swatches */}
            <div className="pt-2.5 border-t border-[#7A9A76]/25">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A9A76] inline-flex items-center gap-1">
                  <Crown className="w-3 h-3 text-[#DFC29B]" />
                  <span>2. Pilih Tema Bidak Catur ({PIECE_STYLE_2D_LIST.length} Tema)</span>
                </span>
                <span className="text-[11px] font-semibold text-[#DFC29B]">
                  {activePiecePreset.name}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PIECE_STYLE_2D_LIST.map((ps) => {
                  const active = pieceStyle2D === ps.id;
                  return (
                    <button
                      key={ps.id}
                      type="button"
                      onClick={() => onSelectPieceStyle2D?.(ps.id)}
                      className={`flex items-center gap-2 p-1.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-[#DFC29B] text-[#0E1B14] border-[#DFC29B] font-bold shadow-xs'
                          : isLightTheme
                          ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3] hover:border-[#5E785D]'
                          : 'bg-[#0B1611] text-[#EFE6D5] border-[#7A9A76]/25 hover:border-[#DFC29B]/60'
                      }`}
                      title={ps.description}
                    >
                      {/* Dual Miniature Piece Swatch (White & Black Piece Colors) */}
                      <span className="inline-flex items-center -space-x-1.5 shrink-0">
                        <span
                          className="w-4 h-4 rounded-full border shadow-2xs"
                          style={{
                            backgroundColor: ps.whitePrimary,
                            borderColor: ps.whiteStroke,
                          }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border shadow-2xs"
                          style={{
                            backgroundColor: ps.blackPrimary,
                            borderColor: ps.blackOuterRim,
                          }}
                        />
                      </span>
                      <span className="text-[11px] font-semibold truncate flex-1">
                        {ps.name}
                      </span>
                      {active && <Check className="w-3 h-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
