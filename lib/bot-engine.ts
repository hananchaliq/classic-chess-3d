import { Chess, type Move, type Square } from 'chess.js';
import type {
  BotDifficultyId,
  BotDifficultyPreset,
  BotHintResult,
  PieceColor,
  PieceSymbol,
} from '../types/chess.ts';

export const BOT_DIFFICULTY_PRESETS: Record<BotDifficultyId, BotDifficultyPreset> = {
  beginner: {
    id: 'beginner',
    name: 'Novice Squire',
    eloEstimate: 650,
    depth: 1,
    randomness: 0.42,
    description: 'Cocok untuk pemula. Sering melakukan langkah kasual dan memberikan peluang taktis.',
  },
  casual: {
    id: 'casual',
    name: 'Club Contender',
    eloEstimate: 1050,
    depth: 2,
    randomness: 0.18,
    description: 'Menjaga bidak dasar dan mengenali tangkapan langsung.',
  },
  tactician: {
    id: 'tactician',
    name: 'Royal Tactician',
    eloEstimate: 1450,
    depth: 3,
    randomness: 0.06,
    description: 'Aktif mencari kombinasi garpu (fork), tusukan (pin), dan menguasai petak pusat.',
  },
  master: {
    id: 'master',
    name: 'Chamber Master',
    eloEstimate: 1850,
    depth: 3,
    randomness: 0.01,
    description: 'Perhitungan posisi tajam dengan evaluasi struktur pion dan keamanan raja.',
  },
  grandmaster: {
    id: 'grandmaster',
    name: 'Arch-Grandmaster',
    eloEstimate: 2200,
    depth: 4,
    randomness: 0,
    description: 'Kalkulasi terdalam tanpa kompromi. Menghukum setiap kesalahan taktis.',
  },
};

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables from White's perspective (rank 8 at index 0 .. rank 1 at index 7)
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 27, 27, 10, 5, 5],
  [0, 0, 0, 24, 24, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

function getPstBonus(type: PieceSymbol, color: PieceColor, row: number, col: number): number {
  const r = color === 'w' ? row : 7 - row;
  switch (type) {
    case 'p':
      return PAWN_PST[r][col];
    case 'n':
      return KNIGHT_PST[r][col];
    case 'b':
      return BISHOP_PST[r][col];
    case 'r':
      return ROOK_PST[r][col];
    case 'q':
      return QUEEN_PST[r][col];
    case 'k':
      return KING_PST[r][col];
  }
}

/**
 * Evaluates a FEN or Chess instance in centipawns from White's perspective (+ve = White advantage).
 */
export function evaluateChessInstanceCp(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw()) {
    return 0;
  }

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      const val = PIECE_VALUES[cell.type] + getPstBonus(cell.type, cell.color, r, c);
      score += cell.color === 'w' ? val : -val;
    }
  }

  if (chess.inCheck()) {
    score += chess.turn() === 'w' ? -35 : 35;
  }

  return score;
}

export function evaluatePositionCp(fen: string): number {
  try {
    const chess = new Chess(fen);
    return evaluateChessInstanceCp(chess);
  } catch {
    return 0;
  }
}

function scoreMoveOrdering(move: Move): number {
  let score = 0;
  if (move.captured) {
    score += 10 * PIECE_VALUES[move.captured as PieceSymbol] - PIECE_VALUES[move.piece as PieceSymbol] / 10;
  }
  if (move.promotion) {
    score += PIECE_VALUES[move.promotion as PieceSymbol];
  }
  if (move.san.includes('+')) {
    score += 45;
  }
  return score;
}

function minimaxAlphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingWhite: boolean
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateChessInstanceCp(chess);
  }

  const moves = chess.moves({ verbose: true });
  moves.sort((a, b) => scoreMoveOrdering(b) - scoreMoveOrdering(a));

  if (maximizingWhite) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const evaluation = minimaxAlphaBeta(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (evaluation > maxEval) maxEval = evaluation;
      if (evaluation > alpha) alpha = evaluation;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const evaluation = minimaxAlphaBeta(chess, depth - 1, alpha, beta, true);
      chess.undo();
      if (evaluation < minEval) minEval = evaluation;
      if (evaluation < beta) beta = evaluation;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function describeTacticalReason(move: Move, resultingCheck: boolean, resultingMate: boolean): string {
  const pieceNames: Record<PieceSymbol, string> = {
    p: 'Pion Infanteri',
    n: 'Kavaleri Kuda',
    b: 'Uskup Mistik',
    r: 'Golem Benteng',
    q: 'Ratu Penguasa',
    k: 'Raja Monarki',
  };
  const actor = pieceNames[move.piece as PieceSymbol] || 'Bidak';

  if (resultingMate) {
    return `${actor} ke ${move.to} mengunci skakmat langsung!`;
  }
  if (move.captured && resultingCheck) {
    const victim = pieceNames[move.captured as PieceSymbol] || 'lawan';
    return `Serangan ganda! ${actor} mengeliminasi ${victim} di ${move.to} sekaligus memberikan skak.`;
  }
  if (move.captured) {
    const victim = pieceNames[move.captured as PieceSymbol] || 'bidak lawan';
    return `Keuntungan material: ${actor} memenangkan ${victim} di petak ${move.to}.`;
  }
  if (move.promotion) {
    return `Promosikan Pion di ${move.to} menjadi Ratu untuk mendominasi arena.`;
  }
  if (resultingCheck) {
    return `${actor} menekan Raja lawan dengan skak taktis dari petak ${move.to}.`;
  }
  if (move.san === 'O-O' || move.san === 'O-O-O') {
    return 'Rokade mengamankan Raja ke balik pertahanan dan mengaktifkan Golem Benteng.';
  }
  if (['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'].includes(move.to)) {
    return `${actor} ke ${move.to} memperluas kendali petak pusat arena dan membuka jalur serangan.`;
  }
  return `Aktifkan ${actor} menuju ${move.to} untuk memperkuat koordinasi pertahanan dan ruang gerak.`;
}

/**
 * Computes the best move or difficulty-adjusted bot move asynchronously so the 3D render loop stays smooth.
 */
export async function computeBotMoveAsync(
  fen: string,
  difficultyId: BotDifficultyId
): Promise<{
  from: Square;
  to: Square;
  promotion?: 'q' | 'r' | 'b' | 'n';
  san: string;
  evaluationCp: number;
} | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const chess = new Chess(fen);
        const legalMoves = chess.moves({ verbose: true });
        if (legalMoves.length === 0) {
          resolve(null);
          return;
        }

        const preset = BOT_DIFFICULTY_PRESETS[difficultyId];
        const isWhiteTurn = chess.turn() === 'w';

        // Order moves for faster pruning
        legalMoves.sort((a, b) => scoreMoveOrdering(b) - scoreMoveOrdering(a));

        const scoredMoves: { move: Move; score: number }[] = [];

        for (const m of legalMoves) {
          chess.move(m);
          const score = minimaxAlphaBeta(
            chess,
            Math.max(0, preset.depth - 1),
            -Infinity,
            Infinity,
            !isWhiteTurn
          );
          chess.undo();
          scoredMoves.push({ move: m, score });
        }

        // Sort from current player's perspective (best first)
        scoredMoves.sort((a, b) => (isWhiteTurn ? b.score - a.score : a.score - b.score));

        let chosen = scoredMoves[0];

        // Inject controlled human-like variance on lower difficulties
        if (preset.randomness > 0 && scoredMoves.length > 1 && Math.random() < preset.randomness) {
          const poolSize = Math.min(scoredMoves.length, difficultyId === 'beginner' ? 4 : 3);
          const idx = Math.floor(Math.random() * poolSize);
          chosen = scoredMoves[idx];
        }

        resolve({
          from: chosen.move.from as Square,
          to: chosen.move.to as Square,
          promotion: (chosen.move.promotion as 'q' | 'r' | 'b' | 'n' | undefined) ?? undefined,
          san: chosen.move.san,
          evaluationCp: chosen.score,
        });
      } catch {
        resolve(null);
      }
    }, 40);
  });
}

/**
 * Computes a tactical hint for the active player with an Indonesian explanation.
 */
export async function computeTacticalHintAsync(fen: string): Promise<BotHintResult | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const chess = new Chess(fen);
        const legalMoves = chess.moves({ verbose: true });
        if (legalMoves.length === 0) {
          resolve(null);
          return;
        }

        const isWhiteTurn = chess.turn() === 'w';
        legalMoves.sort((a, b) => scoreMoveOrdering(b) - scoreMoveOrdering(a));

        let bestMove = legalMoves[0];
        let bestScore = isWhiteTurn ? -Infinity : Infinity;

        for (const m of legalMoves) {
          chess.move(m);
          const score = minimaxAlphaBeta(chess, 2, -Infinity, Infinity, !isWhiteTurn);
          chess.undo();

          if (isWhiteTurn ? score > bestScore : score < bestScore) {
            bestScore = score;
            bestMove = m;
          }
        }

        chess.move(bestMove);
        const resultingCheck = chess.inCheck();
        const resultingMate = chess.isCheckmate();
        chess.undo();

        resolve({
          from: bestMove.from as Square,
          to: bestMove.to as Square,
          san: bestMove.san,
          evaluationCp: bestScore,
          explanation: describeTacticalReason(bestMove, resultingCheck, resultingMate),
        });
      } catch {
        resolve(null);
      }
    }, 25);
  });
}
