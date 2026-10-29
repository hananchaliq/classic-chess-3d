'use client';

import React, { useState, useMemo } from 'react';
import type {
  BoardPiece,
  LegalMoveOption,
  PieceColor,
  PieceSymbol,
} from '../../types/chess.ts';
import { indicesToSquare, parseBoardFromFen } from '../../lib/chess-rules.ts';
import { FlipHorizontal2, ShieldAlert, Box, Grid, Sparkles } from 'lucide-react';

export interface ChessBoard2DProps {
  fen: string;
  orientation: PieceColor;
  selectedSquare: string | null;
  legalMoves: LegalMoveOption[];
  lastMove: { from: string; to: string } | null;
  hintMove?: { from: string; to: string } | null;
  kingSquareInCheck: string | null;
  interactive: boolean;
  onSquareSelect: (square: string) => void;
  onMoveAttempt: (from: string, to: string) => void;
  onFlipOrientation?: () => void;
  themeMode?: 'light' | 'dark';
  isDesktopViewport?: boolean;
  onSwitchTo3D?: () => void;
}

const PIECE_NAMES_ID: Record<PieceSymbol, string> = {
  k: 'Raja',
  q: 'Ratu',
  r: 'Benteng',
  b: 'Gajah',
  n: 'Kuda',
  p: 'Pion',
};

function StauntonPieceSvg({
  type,
  color,
}: {
  type: PieceSymbol;
  color: PieceColor;
}) {
  // Using all 5 palette colors across White and Black pieces:
  // White piece: primary fill #E1D4C2, secondary detail #BEB5A9, accent collar #A78D78, outline #291C0E
  // Black piece: primary fill #291C0E, secondary detail #6E473B, accent collar #A78D78, outline #E1D4C2
  const primaryFill = color === 'w' ? '#E1D4C2' : '#291C0E';
  const secondaryFill = color === 'w' ? '#BEB5A9' : '#6E473B';
  const accentDetail = '#A78D78';
  const strokeColor = color === 'w' ? '#291C0E' : '#E1D4C2';
  const innerStroke = color === 'w' ? '#6E473B' : '#BEB5A9';

  switch (type) {
    case 'p':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[82%] h-[82%] select-none pointer-events-none drop-shadow-sm"
          aria-hidden="true"
        >
          <path
            d="M 22.5,9 C 19.5,9 17,11.5 17,14.5 C 17,16.8 18.4,18.7 20.4,19.5 C 17.5,21.2 15.5,24.5 15.5,29 L 29.5,29 C 29.5,24.5 27.5,21.2 24.6,19.5 C 26.6,18.7 28,16.8 28,14.5 C 28,11.5 25.5,9 22.5,9 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
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
            strokeWidth="2"
          />
          <path
            d="M 11,36.5 L 34,36.5 C 34,33.5 31,32.5 29.5,32.5 L 15.5,32.5 C 14,32.5 11,33.5 11,36.5 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="22.5" cy="14" r="2" fill={accentDetail} />
        </svg>
      );

    case 'r':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[84%] h-[84%] select-none pointer-events-none drop-shadow-sm"
          aria-hidden="true"
        >
          <path
            d="M 14,11 L 14,16 L 18,16 L 18,13 L 21,13 L 21,16 L 24,16 L 24,13 L 27,13 L 27,16 L 31,16 L 31,11 L 28,11 L 28,13 L 25,13 L 25,11 L 20,11 L 20,13 L 17,13 L 17,11 L 14,11 z"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M 15,16 L 16.5,29.5 L 28.5,29.5 L 30,16 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <line
            x1="18"
            y1="20"
            x2="27"
            y2="20"
            stroke={innerStroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect
            x="13.5"
            y="29.5"
            width="18"
            height="3.5"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="2"
          />
          <path
            d="M 11,36.5 L 34,36.5 L 32.5,33 L 12.5,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'n':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[84%] h-[84%] select-none pointer-events-none drop-shadow-sm"
          aria-hidden="true"
        >
          <path
            d="M 22,10 C 30.5,11 35.5,18 35,30 L 15,30 C 15,23 22,24.5 21,18 C 18,19 14.5,21 13,18.5 C 11.5,16 15,12 18,11.5 L 19,9 L 22,10 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="18.5" cy="14.5" r="1.5" fill={innerStroke} />
          <rect
            x="13.5"
            y="30"
            width="18"
            height="3"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="2"
          />
          <path
            d="M 11,36.5 L 34,36.5 L 32.5,33 L 12.5,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'b':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[84%] h-[84%] select-none pointer-events-none drop-shadow-sm"
          aria-hidden="true"
        >
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
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M 20,17 L 25,17 M 22.5,14.5 L 22.5,19.5"
            stroke={innerStroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="13.5"
            y="29.5"
            width="18"
            height="3.5"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="2"
          />
          <path
            d="M 11,36.5 L 34,36.5 L 32.5,33 L 12.5,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'q':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[86%] h-[86%] select-none pointer-events-none drop-shadow-sm"
          aria-hidden="true"
        >
          <path
            d="M 9,14 L 14,29.5 L 31,29.5 L 36,14 L 29,21 L 22.5,11 L 16,21 L 9,14 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="12.5" r="1.8" fill={accentDetail} stroke={strokeColor} strokeWidth="1.4" />
          <circle cx="16" cy="10.5" r="1.8" fill={accentDetail} stroke={strokeColor} strokeWidth="1.4" />
          <circle cx="22.5" cy="9.5" r="2" fill={secondaryFill} stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="29" cy="10.5" r="1.8" fill={accentDetail} stroke={strokeColor} strokeWidth="1.4" />
          <circle cx="36" cy="12.5" r="1.8" fill={accentDetail} stroke={strokeColor} strokeWidth="1.4" />
          <rect
            x="13"
            y="29.5"
            width="19"
            height="3.5"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="2"
          />
          <path
            d="M 10.5,36.5 L 34.5,36.5 L 33,33 L 12,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'k':
      return (
        <svg
          viewBox="0 0 45 45"
          className="w-[86%] h-[86%] select-none pointer-events-none drop-shadow-sm"
          aria-hidden="true"
        >
          <path
            d="M 22.5,6.5 L 22.5,12.5 M 19.5,9.5 L 25.5,9.5"
            stroke={strokeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 22.5,12.5 C 16,13.5 12.5,19 14.5,29.5 L 30.5,29.5 C 32.5,19 29,13.5 22.5,12.5 z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M 18,20 C 20,17.5 25,17.5 27,20"
            fill="none"
            stroke={innerStroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="13"
            y="29.5"
            width="19"
            height="3.5"
            rx="1.2"
            fill={secondaryFill}
            stroke={strokeColor}
            strokeWidth="2"
          />
          <path
            d="M 10.5,36.5 L 34.5,36.5 L 33,33 L 12,33 Z"
            fill={primaryFill}
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export default function ChessBoard2D({
  fen,
  orientation,
  selectedSquare,
  legalMoves,
  lastMove,
  hintMove = null,
  kingSquareInCheck,
  interactive,
  onSquareSelect,
  onMoveAttempt,
  onFlipOrientation,
  themeMode = 'dark',
  isDesktopViewport = false,
  onSwitchTo3D,
}: ChessBoard2DProps) {
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [dragOriginSquare, setDragOriginSquare] = useState<string | null>(null);

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

  // Build 8x8 ordered ranks and files according to orientation
  const rankIndices =
    orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const fileIndices =
    orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  const handleSquareClick = (square: string) => {
    if (!interactive) return;

    // If a piece is already selected and user taps a legal target square, execute the move
    if (selectedSquare && selectedSquare !== square && legalMovesByTarget.has(square)) {
      onMoveAttempt(selectedSquare, square);
      return;
    }

    // Otherwise select the tapped square (or switch selection to another own piece)
    onSquareSelect(square);
  };

  const isLightTheme = themeMode === 'light';

  return (
    <div
      className={`w-full h-full flex flex-col justify-between rounded-xl border-2 p-2.5 sm:p-4 select-none transition-colors ${
        isLightTheme
          ? 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E]'
          : 'bg-[#291C0E] border-[#6E473B] text-[#E1D4C2]'
      }`}
    >
      {/* Top Compact Status & Quick Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
              isLightTheme
                ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B]'
                : 'bg-[#6E473B] text-[#E1D4C2] border-[#A78D78]'
            }`}
          >
            <Grid className="w-3.5 h-3.5 text-[#E1D4C2]" />
            <span>Papan 2D Klasik</span>
          </span>

          {kingSquareInCheck && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-[#6E473B] text-[#E1D4C2] border border-[#E1D4C2]">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>SKAK! Lindungi Raja</span>
            </span>
          )}

          {hintMove && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#291C0E] text-[#E1D4C2] border border-[#A78D78]">
              <Sparkles className="w-3.5 h-3.5 text-[#BEB5A9]" />
              <span>
                Saran: {hintMove.from.toUpperCase()} → {hintMove.to.toUpperCase()}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCoordinates((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
              showCoordinates
                ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E]'
                : 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78]'
            }`}
            title="Tampilkan atau sembunyikan koordinat A-H & 1-8"
          >
            Koordinat
          </button>

          {onFlipOrientation && (
            <button
              type="button"
              onClick={onFlipOrientation}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E1D4C2] text-[#291C0E] border border-[#6E473B] hover:bg-[#BEB5A9] transition-colors whitespace-nowrap"
              title="Putar arah pandang papan catur"
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
              <span>Putar Papan</span>
            </button>
          )}

          {isDesktopViewport && onSwitchTo3D && (
            <button
              type="button"
              onClick={onSwitchTo3D}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#6E473B] text-[#E1D4C2] border border-[#E1D4C2] hover:bg-[#291C0E] transition-colors whitespace-nowrap"
              title="Beralih ke Papan Catur 3D (Khusus Desktop)"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Ke Mode 3D</span>
            </button>
          )}
        </div>
      </div>

      {/* Center Responsive Square 2D Chessboard */}
      <div className="flex-1 flex items-center justify-center my-1">
        <div className="w-full max-w-[520px] aspect-square p-2 sm:p-3 rounded-xl bg-[#291C0E] border-4 border-[#6E473B] shadow-lg flex flex-col">
          <div className="w-full h-full grid grid-cols-8 grid-rows-8 border-2 border-[#A78D78] rounded-md overflow-hidden">
            {rankIndices.map((rankIdx, visualRow) =>
              fileIndices.map((fileIdx, visualCol) => {
                const square = indicesToSquare(fileIdx, rankIdx);
                const isLightSquare = (fileIdx + rankIdx) % 2 === 1;
                const piece = piecesBySquare.get(square);
                const isSelected = selectedSquare === square;
                const legalMove = legalMovesByTarget.get(square);
                const isLastMove =
                  lastMove?.from === square || lastMove?.to === square;
                const isHintSquare =
                  hintMove?.from === square || hintMove?.to === square;
                const isKingInCheck = kingSquareInCheck === square;

                const rankLabel = String(rankIdx + 1);
                const fileLabel = String.fromCharCode(97 + fileIdx);

                // Solid complementary palette colors for squares — NO gradients
                let squareBgClass = isLightSquare ? 'bg-[#E1D4C2]' : 'bg-[#A78D78]';
                if (isSelected) {
                  squareBgClass = 'bg-[#6E473B]';
                } else if (isKingInCheck) {
                  squareBgClass = 'bg-[#6E473B] ring-4 ring-inset ring-[#291C0E]';
                } else if (isHintSquare) {
                  squareBgClass = isLightSquare
                    ? 'bg-[#BEB5A9] ring-4 ring-inset ring-[#291C0E]'
                    : 'bg-[#6E473B] ring-4 ring-inset ring-[#E1D4C2]';
                } else if (isLastMove) {
                  squareBgClass = isLightSquare
                    ? 'bg-[#BEB5A9] ring-2 ring-inset ring-[#6E473B]'
                    : 'bg-[#6E473B] ring-2 ring-inset ring-[#E1D4C2]';
                }

                const coordTextColor = isSelected || (!isLightSquare && !isLastMove)
                  ? 'text-[#E1D4C2]'
                  : 'text-[#291C0E]';

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
                    className={`relative w-full h-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#291C0E] transition-colors ${squareBgClass} ${
                      interactive && (piece || legalMove)
                        ? 'cursor-pointer'
                        : 'cursor-default'
                    }`}
                  >
                    {/* Coordinate Rank Label on Leftmost Column */}
                    {showCoordinates && visualCol === 0 && (
                      <span
                        className={`absolute top-0.5 left-1 text-[10px] sm:text-[11px] font-mono font-bold leading-none pointer-events-none ${coordTextColor}`}
                      >
                        {rankLabel}
                      </span>
                    )}

                    {/* Coordinate File Label on Bottom Row */}
                    {showCoordinates && visualRow === 7 && (
                      <span
                        className={`absolute bottom-0.5 right-1 text-[10px] sm:text-[11px] font-mono font-bold uppercase leading-none pointer-events-none ${coordTextColor}`}
                      >
                        {fileLabel}
                      </span>
                    )}

                    {/* Chess Piece SVG */}
                    {piece && (
                      <StauntonPieceSvg type={piece.type} color={piece.color} />
                    )}

                    {/* Legal Move Indicator (Solid Dot for Empty Square, Solid Ring for Capture) */}
                    {legalMove && !piece && (
                      <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#291C0E] border-2 border-[#E1D4C2] pointer-events-none" />
                    )}

                    {legalMove && piece && (
                      <span className="absolute inset-1 rounded-md border-[3px] border-[#291C0E] bg-[#6E473B]/30 pointer-events-none" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Quick Instruction Strip */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 pt-2 text-xs border-t ${
          isLightTheme
            ? 'border-[#A78D78] text-[#291C0E]'
            : 'border-[#6E473B] text-[#BEB5A9]'
        }`}
      >
        <span>
          {selectedSquare
            ? `Petak dipilih: ${selectedSquare.toUpperCase()} (${legalMoves.length} langkah legal)`
            : 'Ketuk bidak untuk melihat titik langkah legal, lalu ketuk petak tujuan.'}
        </span>
        <span className="font-mono text-[11px]">
          Orientasi: {orientation === 'w' ? 'Putih di Bawah' : 'Hitam di Bawah'}
        </span>
      </div>
    </div>
  );
}
