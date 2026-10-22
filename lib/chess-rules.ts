import { Chess, type Square } from 'chess.js';
import type {
  BoardPiece,
  GameResult,
  GameTerminationReason,
  LegalMoveOption,
  PieceColor,
  PieceSymbol,
} from '../types/chess.ts';

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export function parseBoardFromFen(fen: string): BoardPiece[] {
  const chess = new Chess(fen);
  const board = chess.board();
  const pieces: BoardPiece[] = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = board[row][col];
      if (cell) {
        pieces.push({
          square: cell.square,
          type: cell.type as PieceSymbol,
          color: cell.color as PieceColor,
          fileIndex: col,
          rankIndex: 7 - row,
        });
      }
    }
  }
  return pieces;
}

export function squareToIndices(square: string): { fileIndex: number; rankIndex: number } {
  const fileCode = square.charCodeAt(0) - 97; // 'a' -> 0
  const rankNum = parseInt(square[1], 10) - 1; // '1' -> 0
  return {
    fileIndex: Math.max(0, Math.min(7, fileCode)),
    rankIndex: Math.max(0, Math.min(7, rankNum)),
  };
}

export function indicesToSquare(fileIndex: number, rankIndex: number): string {
  const file = String.fromCharCode(97 + fileIndex);
  const rank = String(rankIndex + 1);
  return `${file}${rank}`;
}

export function findKingSquare(fen: string, color: PieceColor): string | null {
  const pieces = parseBoardFromFen(fen);
  const king = pieces.find((p) => p.type === 'k' && p.color === color);
  return king ? king.square : null;
}

export function getLegalMovesForSquare(fen: string, square: string): LegalMoveOption[] {
  try {
    const chess = new Chess(fen);
    const verboseMoves = chess.moves({ square: square as Square, verbose: true });

    // Group moves by destination square (since promotions generate 4 moves to the same square)
    const byTarget = new Map<string, LegalMoveOption>();

    for (const m of verboseMoves) {
      const key = `${m.from}-${m.to}`;
      const isPromotion = Boolean(m.promotion) || m.flags.includes('p');
      const isCastling = m.flags.includes('k') || m.flags.includes('q');
      const isEnPassant = m.flags.includes('e');

      if (!byTarget.has(key)) {
        byTarget.set(key, {
          from: m.from,
          to: m.to,
          san: m.san,
          uci: `${m.from}${m.to}${m.promotion || ''}`,
          piece: m.piece as PieceSymbol,
          color: m.color as PieceColor,
          captured: m.captured as PieceSymbol | undefined,
          isPromotion,
          isCastling,
          isEnPassant,
          promotionOptions: isPromotion ? ['q', 'r', 'b', 'n'] : undefined,
        });
      }
    }

    return Array.from(byTarget.values());
  } catch {
    return [];
  }
}

export function getAllLegalMoves(fen: string): LegalMoveOption[] {
  try {
    const chess = new Chess(fen);
    const verboseMoves = chess.moves({ verbose: true });
    const byTarget = new Map<string, LegalMoveOption>();

    for (const m of verboseMoves) {
      const key = `${m.from}-${m.to}`;
      const isPromotion = Boolean(m.promotion) || m.flags.includes('p');
      const isCastling = m.flags.includes('k') || m.flags.includes('q');
      const isEnPassant = m.flags.includes('e');

      if (!byTarget.has(key)) {
        byTarget.set(key, {
          from: m.from,
          to: m.to,
          san: m.san,
          uci: `${m.from}${m.to}${m.promotion || ''}`,
          piece: m.piece as PieceSymbol,
          color: m.color as PieceColor,
          captured: m.captured as PieceSymbol | undefined,
          isPromotion,
          isCastling,
          isEnPassant,
          promotionOptions: isPromotion ? ['q', 'r', 'b', 'n'] : undefined,
        });
      }
    }

    return Array.from(byTarget.values());
  } catch {
    return [];
  }
}

export interface EvaluatedChessStatus {
  turn: PieceColor;
  inCheck: boolean;
  kingSquareInCheck: string | null;
  isCheckmate: boolean;
  isStalemate: boolean;
  isInsufficientMaterial: boolean;
  canClaimThreefold: boolean;
  canClaimFiftyMoves: boolean;
  isAutomaticGameOver: boolean;
  result: GameResult;
  winnerColor: PieceColor | null;
  terminationReason: GameTerminationReason;
}

export function evaluateChessInstance(chess: Chess): EvaluatedChessStatus {
  const turn = chess.turn() as PieceColor;
  const inCheck = chess.inCheck();
  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();
  const isInsufficientMaterial = chess.isInsufficientMaterial();
  const canClaimThreefold = chess.isThreefoldRepetition();

  // Check halfmoves from FEN for 50-move claimable (100 halfmoves) vs 75-move automatic (150 halfmoves)
  const fenParts = chess.fen().split(' ');
  const halfMoves = parseInt(fenParts[4] || '0', 10);
  const canClaimFiftyMoves = halfMoves >= 100 && !isCheckmate;
  const isSeventyFiveMoves = halfMoves >= 150 && !isCheckmate;

  const kingSquareInCheck = inCheck ? findKingSquare(chess.fen(), turn) : null;

  let isAutomaticGameOver = false;
  let result: GameResult = null;
  let winnerColor: PieceColor | null = null;
  let terminationReason: GameTerminationReason = null;

  if (isCheckmate) {
    isAutomaticGameOver = true;
    winnerColor = turn === 'w' ? 'b' : 'w';
    result = winnerColor === 'w' ? '1-0' : '0-1';
    terminationReason = 'checkmate';
  } else if (isStalemate) {
    isAutomaticGameOver = true;
    result = '1/2-1/2';
    terminationReason = 'stalemate';
  } else if (isInsufficientMaterial) {
    isAutomaticGameOver = true;
    result = '1/2-1/2';
    terminationReason = 'insufficient_material';
  } else if (isSeventyFiveMoves) {
    isAutomaticGameOver = true;
    result = '1/2-1/2';
    terminationReason = 'seventy_five_move_rule';
  }

  return {
    turn,
    inCheck,
    kingSquareInCheck,
    isCheckmate,
    isStalemate,
    isInsufficientMaterial,
    canClaimThreefold,
    canClaimFiftyMoves,
    isAutomaticGameOver,
    result,
    winnerColor,
    terminationReason,
  };
}

export interface MaterialBalance {
  capturedByWhite: PieceSymbol[]; // Black pieces captured by White
  capturedByBlack: PieceSymbol[]; // White pieces captured by Black
  whiteScore: number;
  blackScore: number;
  advantageColor: PieceColor | null;
  advantageDiff: number;
}

export function calculateMaterialBalance(fen: string): MaterialBalance {
  const initialCounts: Record<PieceColor, Record<PieceSymbol, number>> = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
  };

  const currentCounts: Record<PieceColor, Record<PieceSymbol, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };

  const pieces = parseBoardFromFen(fen);
  let whiteScore = 0;
  let blackScore = 0;

  for (const p of pieces) {
    currentCounts[p.color][p.type]++;
    if (p.color === 'w') {
      whiteScore += PIECE_VALUES[p.type];
    } else {
      blackScore += PIECE_VALUES[p.type];
    }
  }

  const order: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];
  const capturedByWhite: PieceSymbol[] = [];
  const capturedByBlack: PieceSymbol[] = [];

  for (const sym of order) {
    const missingBlack = Math.max(0, initialCounts.b[sym] - currentCounts.b[sym]);
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(sym);

    const missingWhite = Math.max(0, initialCounts.w[sym] - currentCounts.w[sym]);
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(sym);
  }

  const diff = whiteScore - blackScore;
  return {
    capturedByWhite,
    capturedByBlack,
    whiteScore,
    blackScore,
    advantageColor: diff > 0 ? 'w' : diff < 0 ? 'b' : null,
    advantageDiff: Math.abs(diff),
  };
}
