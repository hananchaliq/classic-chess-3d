export type PieceColor = 'w' | 'b';
export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type TimeControlPreset = '1+0' | '3+0' | '3+2' | '5+0' | '10+0' | 'casual';

export interface TimeControlConfig {
  id: TimeControlPreset;
  label: string;
  category: 'Bullet' | 'Blitz' | 'Rapid' | 'Casual';
  initialMs: number;
  incrementMs: number;
  isUnlimited: boolean;
}

export const TIME_CONTROL_PRESETS: Record<TimeControlPreset, TimeControlConfig> = {
  '1+0': {
    id: '1+0',
    label: '1 + 0 Bullet',
    category: 'Bullet',
    initialMs: 60 * 1000,
    incrementMs: 0,
    isUnlimited: false,
  },
  '3+0': {
    id: '3+0',
    label: '3 + 0 Blitz',
    category: 'Blitz',
    initialMs: 3 * 60 * 1000,
    incrementMs: 0,
    isUnlimited: false,
  },
  '3+2': {
    id: '3+2',
    label: '3 + 2 Blitz',
    category: 'Blitz',
    initialMs: 3 * 60 * 1000,
    incrementMs: 2 * 1000,
    isUnlimited: false,
  },
  '5+0': {
    id: '5+0',
    label: '5 + 0 Blitz',
    category: 'Blitz',
    initialMs: 5 * 60 * 1000,
    incrementMs: 0,
    isUnlimited: false,
  },
  '10+0': {
    id: '10+0',
    label: '10 + 0 Rapid',
    category: 'Rapid',
    initialMs: 10 * 60 * 1000,
    incrementMs: 0,
    isUnlimited: false,
  },
  casual: {
    id: 'casual',
    label: 'Tanpa Batas (Kasual)',
    category: 'Casual',
    initialMs: 0,
    incrementMs: 0,
    isUnlimited: true,
  },
};

export type GraphicsQualityPreset = 'low' | 'medium' | 'high' | 'ultra';
export type CinematicCaptureMode = 'on' | 'reduced' | 'off';
export type ShadowQualityMode = 'off' | 'low' | 'high';
export type PieceVisualStyle = 'living' | 'staunton';
export type CameraPerspectiveMode = 'player' | 'board' | 'inspection' | 'cinematic';

export interface ArenaVisualSettings {
  graphicsQuality: GraphicsQualityPreset;
  pieceStyle: PieceVisualStyle;
  cinematicCaptures: CinematicCaptureMode;
  shadows: ShadowQualityMode;
  showChamberRoom: boolean;
  cameraSensitivity: number;
  motionReduced: boolean;
  soundEffects: boolean;
  ambientSound: boolean;
}

export const DEFAULT_VISUAL_SETTINGS: ArenaVisualSettings = {
  graphicsQuality: 'low',
  pieceStyle: 'living',
  cinematicCaptures: 'on',
  shadows: 'off',
  showChamberRoom: true,
  cameraSensitivity: 1.0,
  motionReduced: false,
  soundEffects: true,
  ambientSound: false,
};

export interface BoardPiece {
  square: string;
  type: PieceSymbol;
  color: PieceColor;
  fileIndex: number; // 0 (a) to 7 (h)
  rankIndex: number; // 0 (rank 1) to 7 (rank 8)
}

export interface LegalMoveOption {
  from: string;
  to: string;
  san: string;
  uci: string;
  piece: PieceSymbol;
  color: PieceColor;
  captured?: PieceSymbol;
  isPromotion: boolean;
  isCastling: boolean;
  isEnPassant: boolean;
  promotionOptions?: PieceSymbol[];
}

export type MoveQualityClassification =
  | 'brilliant'
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface MoveRecord {
  ply: number;
  moveNumber: number;
  color: PieceColor;
  from: string;
  to: string;
  san: string;
  uci: string;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  fenAfter: string;
  elapsedMs: number;
  timestamp: number;
  evalCp?: number;
  quality?: MoveQualityClassification;
  coachingNote?: string;
}

export interface CaptureDuelEvent {
  id: string;
  from: string;
  to: string;
  attackerType: PieceSymbol;
  attackerColor: PieceColor;
  defenderType: PieceSymbol;
  defenderColor: PieceColor;
  isEnPassant?: boolean;
  isCheckmate?: boolean;
  isPromotion?: boolean;
  promotedTo?: PieceSymbol;
  timestamp: number;
}

export type RoomStatus = 'waiting' | 'active' | 'finished' | 'abandoned';
export type RoomVisibility = 'public' | 'private';

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | null;

export type GameTerminationReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold_repetition'
  | 'fifty_move_rule'
  | 'seventy_five_move_rule'
  | 'insufficient_material'
  | 'timeout'
  | 'resignation'
  | 'draw_agreement'
  | 'abandoned'
  | 'cancelled'
  | null;

export interface PublicPlayerSeat {
  playerId: string;
  displayName: string;
  color: PieceColor;
  connected: boolean;
  ready: boolean;
  rating: number;
}

export interface ClockSnapshot {
  whiteMs: number;
  blackMs: number;
  incrementMs: number;
  activeColor: PieceColor | null;
  isUnlimited: boolean;
  serverTimestamp: number;
}

export interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: PieceColor | 'system';
  message: string;
  timestamp: number;
}

export interface RoomStateSnapshot {
  roomCode: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  timeControl: TimeControlPreset;
  whitePlayer: PublicPlayerSeat | null;
  blackPlayer: PublicPlayerSeat | null;
  spectatorCount: number;
  fen: string;
  pgn: string;
  turn: PieceColor;
  ply: number;
  moveHistory: MoveRecord[];
  lastMove: { from: string; to: string } | null;
  lastCaptureDuel: CaptureDuelEvent | null;
  inCheck: boolean;
  kingSquareInCheck: string | null;
  isCheckmate: boolean;
  isStalemate: boolean;
  isInsufficientMaterial: boolean;
  canClaimThreefold: boolean;
  canClaimFiftyMoves: boolean;
  result: GameResult;
  winnerColor: PieceColor | null;
  terminationReason: GameTerminationReason;
  drawOfferBy: PieceColor | null;
  clocks: ClockSnapshot;
  chatMessages: ChatMessageItem[];
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export type YourRoleInRoom = 'w' | 'b' | 'spectator';

export interface RoomJoinedResponse {
  ok: boolean;
  error?: string;
  room?: RoomStateSnapshot;
  yourRole?: YourRoleInRoom;
  playerId?: string;
}

export type BotDifficultyId = 'beginner' | 'casual' | 'tactician' | 'master' | 'grandmaster';

export interface BotDifficultyPreset {
  id: BotDifficultyId;
  name: string;
  eloEstimate: number;
  depth: number;
  randomness: number;
  description: string;
}

export interface BotHintResult {
  from: string;
  to: string;
  san: string;
  evaluationCp: number;
  explanation: string;
}
