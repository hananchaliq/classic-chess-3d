'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chess } from 'chess.js';
import { io, type Socket } from 'socket.io-client';
import type {
  ArenaVisualSettings,
  BotDifficultyId,
  BotHintResult,
  CaptureDuelEvent,
  ChatMessageItem,
  LegalMoveOption,
  MoveRecord,
  PieceColor,
  PieceSymbol,
  RoomJoinedResponse,
  RoomStateSnapshot,
  RoomVisibility,
  TimeControlPreset,
  YourRoleInRoom,
} from '../../types/chess.ts';
import { DEFAULT_VISUAL_SETTINGS } from '../../types/chess.ts';
import {
  calculateMaterialBalance,
  evaluateChessInstance,
  getLegalMovesForSquare,
  INITIAL_FEN,
} from '../../lib/chess-rules.ts';
import {
  BOT_DIFFICULTY_PRESETS,
  computeBotMoveAsync,
  computeTacticalHintAsync,
  evaluatePositionCp,
} from '../../lib/bot-engine.ts';
import {
  playCastleSound,
  playCheckAlertSound,
  playDuelCombatSound,
  playGameBellSound,
  playPromotionFanfareSound,
  playWoodCaptureSound,
  playWoodMoveSound,
  setChamberAmbientSound,
  setSoundMuted,
  stopChamberAmbientSound,
} from '../../lib/sound-fx.ts';
import type {
  BoardTheme2DId,
  PieceStyle2DId,
} from '../../lib/board-themes-2d.ts';
import {
  BOARD_THEMES_2D,
  PIECE_STYLES_2D,
} from '../../lib/board-themes-2d.ts';
import dynamic from 'next/dynamic';
import ChessBoard2D from '../chess/ChessBoard2D.tsx';
import PromotionModal from '../chess/PromotionModal.tsx';
import PlayerClockBar from './PlayerClockBar.tsx';
import MoveHistoryPanel from './MoveHistoryPanel.tsx';
import RoomLobbyAndChatPanel from './RoomLobbyAndChatPanel.tsx';
import UserGuideModal from './UserGuideModal.tsx';
import { ChessBrandEmblem } from './ChessBrandLogo.tsx';
import {
  Volume2,
  VolumeX,
  Swords,
  Users,
  Bot,
  BookOpen,
  Lightbulb,
  Sun,
  Moon,
  HelpCircle,
  Box,
  Grid,
  ListOrdered,
  Palette,
  Sparkles,
  MonitorSmartphone,
  TrendingUp,
} from 'lucide-react';

// Dynamically load ChessBoard3D ONLY on Desktop (>= 1024px) when 3D mode is active
const ChessBoard3D = dynamic(() => import('../chess/ChessBoard3D.tsx'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-2xl bg-[#0D1A13] border border-[#7A9A76]/40 flex flex-col items-center justify-center p-6 text-center text-[#F3ECE0] shadow-2xl">
      <ChessBrandEmblem size="lg" variant="sand" className="mb-3" />
      <p className="text-base font-bold font-serif text-[#DFC29B]">
        Memuat Arena Catur 3D...
      </p>
      <p className="text-xs text-[#9BB09D] mt-1">
        Menyiapkan pencahayaan dan bidak 3D khusus Komputer/Desktop
      </p>
    </div>
  ),
});

type ActiveWorkspaceTab = 'bot' | 'local' | 'multiplayer';
type SidebarSubTab = 'match' | 'moves';

interface SpecialRuleTestPreset {
  id: string;
  label: string;
  description: string;
  fen: string;
}

const RULE_TEST_PRESETS: SpecialRuleTestPreset[] = [
  {
    id: 'standard',
    label: 'Standar FIDE',
    description: '32 bidak catur pada susunan awal resmi turnamen FIDE.',
    fen: INITIAL_FEN,
  },
  {
    id: 'duel_arena',
    label: 'Taktik Tengah',
    description: 'Posisi tengah permainan terbuka untuk melatih kombinasi taktis.',
    fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 7',
  },
  {
    id: 'castling',
    label: 'Rokade (O-O)',
    description: 'Jalur Raja & Benteng terbuka untuk menguji rokade pendek dan panjang.',
    fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 4 8',
  },
  {
    id: 'enpassant',
    label: 'En Passant',
    description: 'Pion Putih di e5 dapat menangkap pion Hitam d5 secara en passant (e5xd6).',
    fen: 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
  },
  {
    id: 'promotion',
    label: 'Promosi Pion',
    description: 'Pion Putih di g7 siap maju ke g8 untuk promosi menjadi Ratu/Benteng/Gajah/Kuda.',
    fen: '1rbq1rk1/p1pp1pPp/2n2n2/1p2p3/4P3/2NP4/PPP2PPP/R1BQKBNR w KQ - 1 8',
  },
  {
    id: 'checkmate',
    label: 'Skakmat 1 Langkah',
    description: 'Scholar’s Mate: Ratu Putih di h5 dapat langsung melakukan skakmat di f7 (Qxf7#).',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 3',
  },
];

function getOrCreateTabSessionToken(): string {
  if (typeof window === 'undefined') return 'ssr_token_placeholder';
  let tabId = window.name;
  if (!tabId || !tabId.startsWith('chess_tab_')) {
    tabId = 'chess_tab_' + Math.random().toString(36).slice(2, 10);
    window.name = tabId;
  }
  const key = `classic_chess_3d_session_token_v2_${tabId}`;
  let token = window.sessionStorage.getItem(key);
  if (!token) {
    token =
      'sess_' +
      Math.random().toString(36).slice(2) +
      '_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2);
    window.sessionStorage.setItem(key, token);
  }
  return token;
}

export default function ClassicChessApp() {
  // Navigation, Botanical Forest / Architectural Bronze Theme, & 2D/3D Preferences
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('bot');
  const [sidebarSubTab, setSidebarSubTab] = useState<SidebarSubTab>('match');
  const [soundMuted, setSoundMutedState] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(false);
  const [desktopBoardMode, setDesktopBoardMode] = useState<'2d' | '3d'>('2d');
  const [boardTheme2D, setBoardTheme2D] = useState<BoardTheme2DId>('rennake_forest');
  const [pieceStyle2D, setPieceStyle2D] = useState<PieceStyle2DId>('rennake_botanical');
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [visualSettings, setVisualSettings] = useState<ArenaVisualSettings>(
    DEFAULT_VISUAL_SETTINGS
  );

  // Detect Desktop (>= 1024px) vs Mobile/Tablet (< 1024px) and restore saved preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedTheme = window.localStorage.getItem('classic_chess_theme_mode');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      queueMicrotask(() => setThemeMode(savedTheme));
    }

    const savedBoardMode = window.localStorage.getItem('classic_chess_desktop_board_mode');
    if (savedBoardMode === '2d' || savedBoardMode === '3d') {
      queueMicrotask(() => setDesktopBoardMode(savedBoardMode));
    }

    const savedBoardTheme2D = window.localStorage.getItem(
      'classic_chess_board_theme_2d'
    ) as BoardTheme2DId | null;
    if (savedBoardTheme2D && BOARD_THEMES_2D[savedBoardTheme2D]) {
      queueMicrotask(() => setBoardTheme2D(savedBoardTheme2D));
    }

    const savedPieceStyle2D = window.localStorage.getItem(
      'classic_chess_piece_style_2d'
    ) as PieceStyle2DId | null;
    if (savedPieceStyle2D && PIECE_STYLES_2D[savedPieceStyle2D]) {
      queueMicrotask(() => setPieceStyle2D(savedPieceStyle2D));
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleViewportChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktopViewport(e.matches);
    };
    handleViewportChange(mediaQuery);

    mediaQuery.addEventListener('change', handleViewportChange);
    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, []);

  const toggleThemeMode = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('classic_chess_theme_mode', next);
      }
      return next;
    });
  }, []);

  const toggleDesktopBoardMode = useCallback(() => {
    setDesktopBoardMode((prev) => {
      const next = prev === '3d' ? '2d' : '3d';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('classic_chess_desktop_board_mode', next);
      }
      return next;
    });
  }, []);

  const handleSelectBoardTheme2D = useCallback((id: BoardTheme2DId) => {
    setBoardTheme2D(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('classic_chess_board_theme_2d', id);
    }
  }, []);

  const handleSelectPieceStyle2D = useCallback((id: PieceStyle2DId) => {
    setPieceStyle2D(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('classic_chess_piece_style_2d', id);
    }
  }, []);

  // Mobile/Tablet (< 1024px) STRICTLY uses 2D. Desktop uses selected 2D or 3D mode.
  const effectiveBoardMode: '2d' | '3d' = isDesktopViewport ? desktopBoardMode : '2d';
  const isLight = themeMode === 'light';

  const updateVisualSettings = useCallback((partial: Partial<ArenaVisualSettings>) => {
    setVisualSettings((prev) => {
      const next = { ...prev, ...partial };
      if (partial.graphicsQuality && partial.shadows === undefined) {
        next.shadows =
          partial.graphicsQuality === 'low'
            ? 'off'
            : partial.graphicsQuality === 'medium'
            ? 'low'
            : 'high';
      }
      if (partial.ambientSound !== undefined) {
        setChamberAmbientSound(partial.ambientSound);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      stopChamberAmbientSound();
    };
  }, []);

  // =========================================================================
  // STAGE 1: LOCAL & BOT AI CHESS STATE (chess.js)
  // =========================================================================
  const localChessRef = useRef<Chess>(new Chess(INITIAL_FEN));
  const [localFen, setLocalFen] = useState<string>(INITIAL_FEN);
  const [localPgn, setLocalPgn] = useState<string>('');
  const [localMoves, setLocalMoves] = useState<MoveRecord[]>([]);
  const [localLastMove, setLocalLastMove] = useState<{ from: string; to: string } | null>(null);
  const [localLastCaptureDuel, setLocalLastCaptureDuel] = useState<CaptureDuelEvent | null>(null);
  const [localOrientation, setLocalOrientation] = useState<PieceColor>('w');
  const [autoFlipLocal, setAutoFlipLocal] = useState<boolean>(false);
  const [localClaimedDraw, setLocalClaimedDraw] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string>('standard');
  const [localEval, setLocalEval] = useState(() =>
    evaluateChessInstance(new Chess(INITIAL_FEN))
  );

  // Bot AI Training Mode State
  const [botDifficulty, setBotDifficulty] = useState<BotDifficultyId>('tactician');
  const [botPlayerColor, setBotPlayerColor] = useState<PieceColor>('w');
  const [botThinking, setBotThinking] = useState<boolean>(false);
  const [hintResult, setHintResult] = useState<BotHintResult | null>(null);
  const [hintLoading, setHintLoading] = useState<boolean>(false);
  const [evaluationCp, setEvaluationCp] = useState<number>(0);

  // Shared Selection & Promotion Modal State
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<LegalMoveOption[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    color: PieceColor;
  } | null>(null);

  // =========================================================================
  // STAGE 2: MULTIPLAYER HYBRID STATE (Socket.IO + Serverless API)
  // =========================================================================
  const socketRef = useRef<Socket | null>(null);
  const sessionTokenRef = useRef<string>('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [playerName, setPlayerName] = useState('Grandmaster');
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControlPreset>('5+0');
  const [preferredColor, setPreferredColor] = useState<'w' | 'b' | 'random'>('w');
  const [roomVisibility, setRoomVisibility] = useState<RoomVisibility>('public');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [waitingRooms, setWaitingRooms] = useState<
    Array<{
      roomCode: string;
      hostName: string;
      hostColor: PieceColor;
      timeControl: TimeControlPreset;
      createdAt: number;
    }>
  >([]);
  const [activeRoom, setActiveRoom] = useState<RoomStateSnapshot | null>(null);
  const [myRole, setMyRole] = useState<YourRoleInRoom>('w');
  const [mpOrientation, setMpOrientation] = useState<PieceColor>('w');
  const [mpErrorBanner, setMpErrorBanner] = useState<string | null>(null);
  const prevMpPlyRef = useRef<number>(0);
  const prevMpStatusRef = useRef<string>('waiting');
  const pollNotFoundCountRef = useRef<number>(0);
  const activeRoomCodeRef = useRef<string | null>(null);

  const applyIncomingRoomSnapshot = useCallback((roomSnapshot: RoomStateSnapshot) => {
    setActiveRoom((prev) => {
      if (
        prev &&
        prev.roomCode === roomSnapshot.roomCode &&
        typeof prev.version === 'number' &&
        typeof roomSnapshot.version === 'number' &&
        roomSnapshot.version < prev.version
      ) {
        return prev;
      }

      if (prev && prev.status === 'waiting' && roomSnapshot.status === 'active') {
        playGameBellSound();
      } else if (
        prev &&
        prev.status === 'active' &&
        (roomSnapshot.status === 'finished' || roomSnapshot.status === 'abandoned')
      ) {
        playGameBellSound();
      }
      prevMpStatusRef.current = roomSnapshot.status;

      if (roomSnapshot.ply > prevMpPlyRef.current) {
        const latestMove = roomSnapshot.moveHistory[roomSnapshot.moveHistory.length - 1];
        if (roomSnapshot.inCheck) {
          playCheckAlertSound();
        } else if (latestMove?.promotion) {
          playPromotionFanfareSound();
        } else if (latestMove?.captured) {
          playDuelCombatSound(latestMove.piece);
        } else {
          playWoodMoveSound();
        }
        prevMpPlyRef.current = roomSnapshot.ply;
        setSelectedSquare(null);
        setLegalMoves([]);
      } else if (roomSnapshot.ply === 0 && prev && prev.ply > 0) {
        prevMpPlyRef.current = 0;
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      return roomSnapshot;
    });
  }, []);

  const fetchLobbyViaHttp = useCallback(async () => {
    try {
      const res = await fetch('/api/multiplayer?action=lobby', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) {
        setSocketConnected(true);
        if (Array.isArray(data.rooms)) {
          setWaitingRooms(data.rooms);
        }
      }
    } catch {
      // ignore network error
    }
  }, []);

  const dispatchMultiplayerAction = useCallback(
    async <T = Record<string, unknown>>(
      action: string,
      payload: Record<string, unknown>,
      onComplete?: (res: T) => void
    ) => {
      try {
        const response = await fetch('/api/multiplayer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        });
        const data = await response.json();
        if (data.waitingRooms && Array.isArray(data.waitingRooms)) {
          setWaitingRooms(data.waitingRooms);
        }
        if (data.room) {
          const snapshot = data.room as RoomStateSnapshot;
          activeRoomCodeRef.current = snapshot.roomCode;
          pollNotFoundCountRef.current = 0;
          applyIncomingRoomSnapshot(snapshot);
          if (socketRef.current?.connected) {
            socketRef.current.emit('room:subscribe', { roomCode: snapshot.roomCode });
          }
        }
        onComplete?.(data as T);

        if (socketRef.current?.connected && data.ok && data.room) {
          socketRef.current.emit('lobby:list');
        }
      } catch {
        if (socketRef.current?.connected) {
          socketRef.current.emit(action, payload, (res: T) => {
            onComplete?.(res);
          });
        } else {
          onComplete?.({ ok: false, error: 'Gagal menghubungi server multiplayer.' } as unknown as T);
        }
      }
    },
    [applyIncomingRoomSnapshot]
  );

  // Connect Hybrid Multiplayer on mount
  useEffect(() => {
    sessionTokenRef.current = getOrCreateTabSessionToken();
    const suffix = sessionTokenRef.current.slice(-4).toUpperCase();
    queueMicrotask(() => {
      setPlayerName((prev) => (prev === 'Grandmaster' ? `Pemain ${suffix}` : prev));
      void fetchLobbyViaHttp().then(() => {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const urlRoom = params.get('room');
          const savedRoom = window.sessionStorage.getItem('classic_chess_active_room');
          const roomToJoin = urlRoom || savedRoom;

          if (roomToJoin) {
            setActiveTab('multiplayer');
            setSidebarSubTab('match');
            dispatchMultiplayerAction<RoomJoinedResponse>(
              'room:join',
              {
                sessionToken: sessionTokenRef.current,
                roomCode: roomToJoin.toUpperCase(),
                playerName: `Pemain ${suffix}`,
              },
              (res) => {
                if (res.ok && res.room && res.yourRole) {
                  activeRoomCodeRef.current = res.room.roomCode;
                  pollNotFoundCountRef.current = 0;
                  setActiveRoom(res.room);
                  setMyRole(res.yourRole);
                  prevMpPlyRef.current = res.room.ply;
                  prevMpStatusRef.current = res.room.status;
                  if (res.yourRole === 'w' || res.yourRole === 'b') {
                    setMpOrientation(res.yourRole);
                  }
                  window.sessionStorage.setItem('classic_chess_active_room', res.room.roomCode);
                } else if (urlRoom) {
                  setMpErrorBanner(res.error || 'Tidak dapat bergabung ke room dari tautan.');
                } else {
                  window.sessionStorage.removeItem('classic_chess_active_room');
                }
              }
            );
          }
        }
      });
    });

    const socket = io({
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      if (activeRoomCodeRef.current) {
        socket.emit('room:subscribe', { roomCode: activeRoomCodeRef.current });
      }
    });

    socket.on('lobby:rooms', (rooms) => {
      if (Array.isArray(rooms)) {
        setWaitingRooms(rooms);
      }
    });

    socket.on('room:cancelled', (payload?: { roomCode?: string }) => {
      if (!payload?.roomCode || payload.roomCode === activeRoomCodeRef.current) {
        activeRoomCodeRef.current = null;
        setActiveRoom(null);
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('classic_chess_active_room');
        }
      }
    });

    socket.on('game:start', (roomSnapshot: RoomStateSnapshot) => {
      applyIncomingRoomSnapshot(roomSnapshot);
    });

    socket.on('game:state', (roomSnapshot: RoomStateSnapshot) => {
      applyIncomingRoomSnapshot(roomSnapshot);
    });

    socket.on('game:clock', (clockSnapshot) => {
      setActiveRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          clocks: clockSnapshot,
        };
      });
    });

    socket.on('chat:message', (chatItem: ChatMessageItem) => {
      setActiveRoom((prev) => {
        if (!prev) return prev;
        const exists = prev.chatMessages.some((m) => m.id === chatItem.id);
        if (exists) return prev;
        return {
          ...prev,
          chatMessages: [...prev.chatMessages, chatItem],
        };
      });
    });

    socket.on('game:finished', (roomSnapshot: RoomStateSnapshot) => {
      applyIncomingRoomSnapshot(roomSnapshot);
    });

    return () => {
      socket.disconnect();
    };
  }, [applyIncomingRoomSnapshot, dispatchMultiplayerAction, fetchLobbyViaHttp]);

  const activeRoomCode = activeRoom?.roomCode ?? null;
  const pollInFlightRef = useRef<boolean>(false);

  // Real-time Serverless Polling Loop
  useEffect(() => {
    activeRoomCodeRef.current = activeRoomCode;
    if (activeRoomCode) {
      pollNotFoundCountRef.current = 0;
      pollInFlightRef.current = false;
      const interval = setInterval(async () => {
        if (pollInFlightRef.current || activeRoomCodeRef.current !== activeRoomCode) return;
        pollInFlightRef.current = true;
        try {
          const res = await fetch(
            `/api/multiplayer?action=poll&roomCode=${encodeURIComponent(
              activeRoomCode
            )}&sessionToken=${encodeURIComponent(sessionTokenRef.current)}`,
            { cache: 'no-store' }
          );
          if (!res.ok) return;
          const data = await res.json();
          if (activeRoomCodeRef.current !== activeRoomCode) return;

          if (data.ok && data.room) {
            pollNotFoundCountRef.current = 0;
            setSocketConnected(true);
            applyIncomingRoomSnapshot(data.room as RoomStateSnapshot);
            if (data.yourRole === 'w' || data.yourRole === 'b' || data.yourRole === 'spectator') {
              setMyRole((prevRole) => {
                if (prevRole !== data.yourRole) {
                  if (data.yourRole === 'w' || data.yourRole === 'b') {
                    setMpOrientation(data.yourRole);
                  }
                  return data.yourRole;
                }
                return prevRole;
              });
            }
          } else if (!data.ok) {
            if (data.errorCode === 'ROOM_CANCELLED') {
              activeRoomCodeRef.current = null;
              setActiveRoom(null);
              if (typeof window !== 'undefined') {
                window.sessionStorage.removeItem('classic_chess_active_room');
                const url = new URL(window.location.href);
                url.searchParams.delete('room');
                window.history.replaceState({}, '', url.toString());
              }
            } else if (data.errorCode === 'ROOM_NOT_FOUND') {
              pollNotFoundCountRef.current += 1;
              if (pollNotFoundCountRef.current >= 6) {
                activeRoomCodeRef.current = null;
                setActiveRoom(null);
                if (typeof window !== 'undefined') {
                  window.sessionStorage.removeItem('classic_chess_active_room');
                  const url = new URL(window.location.href);
                  url.searchParams.delete('room');
                  window.history.replaceState({}, '', url.toString());
                }
              }
            }
          }
        } catch {
          // ignore transient poll error
        } finally {
          pollInFlightRef.current = false;
        }
      }, 800);
      return () => clearInterval(interval);
    }

    if (activeTab === 'multiplayer') {
      const lobbyInterval = setInterval(() => {
        fetchLobbyViaHttp();
      }, 3000);
      return () => clearInterval(lobbyInterval);
    }
  }, [activeRoomCode, activeTab, applyIncomingRoomSnapshot, fetchLobbyViaHttp]);

  // Determine current active board state based on activeTab
  const isMultiplayerView = activeTab === 'multiplayer' && activeRoom !== null;
  const currentFen = isMultiplayerView ? activeRoom.fen : localFen;
  const currentPgn = isMultiplayerView ? activeRoom.pgn : localPgn;
  const currentMoves = isMultiplayerView ? activeRoom.moveHistory : localMoves;
  const currentLastMove = isMultiplayerView ? activeRoom.lastMove : localLastMove;
  const currentLastCaptureDuel = isMultiplayerView
    ? activeRoom.lastCaptureDuel
    : localLastCaptureDuel;
  const currentOrientation = isMultiplayerView ? mpOrientation : localOrientation;

  const latestMoveWasCapture = useMemo(() => {
    if (currentMoves.length === 0) return false;
    return Boolean(currentMoves[currentMoves.length - 1]?.captured);
  }, [currentMoves]);

  const currentTurn: PieceColor = isMultiplayerView ? activeRoom.turn : localEval.turn;
  const currentKingSquareInCheck = isMultiplayerView
    ? activeRoom.kingSquareInCheck
    : localEval.kingSquareInCheck;

  const materialBalance = calculateMaterialBalance(currentFen);

  const canInteractWithBoard = (() => {
    if (activeTab === 'bot') {
      if (localEval.isAutomaticGameOver || localClaimedDraw || botThinking) return false;
      return localEval.turn === botPlayerColor;
    }
    if (activeTab === 'local') {
      return !localEval.isAutomaticGameOver && !localClaimedDraw;
    }
    if (activeTab === 'multiplayer' && activeRoom) {
      if (activeRoom.status !== 'active') return false;
      if (myRole === 'spectator') return false;
      return activeRoom.turn === myRole;
    }
    return false;
  })();

  const applyLocalOrBotMove = useCallback(
    (
      from: string,
      to: string,
      promotionPiece?: PieceSymbol,
      isBotMove = false
    ): boolean => {
      const chess = localChessRef.current;
      try {
        const moveResult = chess.move({
          from,
          to,
          promotion: promotionPiece || 'q',
        });

        if (!moveResult) return false;

        const nextFen = chess.fen();
        const evalAfter = evaluateChessInstance(chess);
        const now = Math.round(performance.now());

        if (evalAfter.isAutomaticGameOver) {
          playGameBellSound();
        } else if (evalAfter.inCheck) {
          playCheckAlertSound();
        } else if (moveResult.promotion) {
          playPromotionFanfareSound();
        } else if (moveResult.flags.includes('k') || moveResult.flags.includes('q')) {
          playCastleSound();
        } else if (moveResult.captured) {
          if (visualSettings.pieceStyle === 'living') {
            playDuelCombatSound(moveResult.piece as PieceSymbol);
          } else {
            playWoodCaptureSound();
          }
        } else {
          playWoodMoveSound();
        }

        if (moveResult.captured) {
          setLocalLastCaptureDuel({
            id: `local_duel_${now}_${moveResult.from}_${moveResult.to}`,
            from: moveResult.from,
            to: moveResult.to,
            attackerType: moveResult.piece as PieceSymbol,
            attackerColor: moveResult.color as PieceColor,
            defenderType: moveResult.captured as PieceSymbol,
            defenderColor: moveResult.color === 'w' ? 'b' : 'w',
            isEnPassant: moveResult.flags.includes('e'),
            isCheckmate: evalAfter.isCheckmate,
            timestamp: now,
          });
        } else {
          setLocalLastCaptureDuel(null);
        }

        setLocalFen(nextFen);
        setLocalPgn(chess.pgn());
        setLocalEval(evalAfter);
        setEvaluationCp(evaluatePositionCp(nextFen));
        setLocalMoves((prev) => {
          const ply = prev.length + 1;
          const record: MoveRecord = {
            ply,
            moveNumber: Math.ceil(ply / 2),
            color: moveResult.color as PieceColor,
            from: moveResult.from,
            to: moveResult.to,
            san: moveResult.san,
            uci: `${moveResult.from}${moveResult.to}${moveResult.promotion || ''}`,
            piece: moveResult.piece as PieceSymbol,
            captured: moveResult.captured as PieceSymbol | undefined,
            promotion: moveResult.promotion as PieceSymbol | undefined,
            fenAfter: nextFen,
            elapsedMs: 0,
            timestamp: now,
          };
          return [...prev, record];
        });
        setLocalLastMove({ from: moveResult.from, to: moveResult.to });
        setSelectedSquare(null);
        setLegalMoves([]);
        setHintResult(null);

        if (!isBotMove && activeTab === 'local' && autoFlipLocal && !evalAfter.isAutomaticGameOver) {
          setLocalOrientation(evalAfter.turn);
        }

        return true;
      } catch {
        return false;
      }
    },
    [activeTab, autoFlipLocal, visualSettings.pieceStyle]
  );

  // Trigger Bot AI turn automatically
  useEffect(() => {
    if (activeTab !== 'bot') return;
    if (localEval.isAutomaticGameOver || localClaimedDraw) return;
    if (localEval.turn === botPlayerColor) return;

    let cancelled = false;
    queueMicrotask(() => setBotThinking(true));

    const delayMs = effectiveBoardMode === '3d' && localLastCaptureDuel ? 1150 : 480;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const botDecision = await computeBotMoveAsync(localFen, botDifficulty);
      if (cancelled) return;
      setBotThinking(false);
      if (botDecision) {
        applyLocalOrBotMove(
          botDecision.from,
          botDecision.to,
          botDecision.promotion,
          true
        );
      }
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeTab,
    localFen,
    localEval.turn,
    localEval.isAutomaticGameOver,
    localClaimedDraw,
    botPlayerColor,
    botDifficulty,
    effectiveBoardMode,
    localLastCaptureDuel,
    applyLocalOrBotMove,
  ]);

  const handleSquareSelect = (square: string) => {
    if (!canInteractWithBoard) return;

    const options = getLegalMovesForSquare(currentFen, square);
    if (isMultiplayerView && options.length > 0 && options[0].color !== myRole) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }
    if (activeTab === 'bot' && options.length > 0 && options[0].color !== botPlayerColor) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    if (options.length > 0) {
      setSelectedSquare(square);
      setLegalMoves(options);
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const executeValidatedMove = (from: string, to: string, promotionPiece?: PieceSymbol) => {
    if (isMultiplayerView && activeRoom) {
      setMpErrorBanner(null);
      dispatchMultiplayerAction<{ ok: boolean; error?: string; room?: RoomStateSnapshot }>(
        'game:move',
        {
          sessionToken: sessionTokenRef.current,
          roomCode: activeRoom.roomCode,
          from,
          to,
          promotion: promotionPiece,
          ply: activeRoom.ply,
        },
        (res) => {
          if (!res.ok) {
            setMpErrorBanner(res.error || 'Langkah ditolak oleh server.');
          }
        }
      );
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    applyLocalOrBotMove(from, to, promotionPiece, false);
  };

  const handleMoveAttempt = (from: string, to: string) => {
    if (!canInteractWithBoard) return;
    const options = getLegalMovesForSquare(currentFen, from);
    const matching = options.find((m) => m.to === to);
    if (!matching) {
      handleSquareSelect(to);
      return;
    }

    if (matching.isPromotion) {
      setPendingPromotion({
        from,
        to,
        color: matching.color,
      });
      return;
    }

    executeValidatedMove(from, to);
  };

  const handleStartBotGame = (chosenSide: 'w' | 'b' | 'random') => {
    const resolvedColor: PieceColor =
      chosenSide === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : chosenSide;
    const nextChess = new Chess(INITIAL_FEN);
    localChessRef.current = nextChess;
    setBotPlayerColor(resolvedColor);
    setLocalOrientation(resolvedColor);
    setLocalFen(INITIAL_FEN);
    setLocalPgn('');
    setLocalEval(evaluateChessInstance(nextChess));
    setEvaluationCp(0);
    setLocalMoves([]);
    setLocalLastMove(null);
    setLocalLastCaptureDuel(null);
    setLocalClaimedDraw(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setHintResult(null);
    setBotThinking(false);
    playGameBellSound();
  };

  const handleRequestHint = async () => {
    if (hintLoading || localEval.isAutomaticGameOver) return;
    setHintLoading(true);
    const hint = await computeTacticalHintAsync(localFen);
    setHintLoading(false);
    if (hint) {
      setHintResult(hint);
    }
  };

  const handleLoadLocalPreset = (preset: SpecialRuleTestPreset) => {
    const nextChess = new Chess(preset.fen);
    localChessRef.current = nextChess;
    setLocalFen(preset.fen);
    setLocalPgn('');
    setLocalEval(evaluateChessInstance(nextChess));
    setEvaluationCp(evaluatePositionCp(preset.fen));
    setLocalMoves([]);
    setLocalLastMove(null);
    setLocalLastCaptureDuel(null);
    setLocalClaimedDraw(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setHintResult(null);
    setActivePresetId(preset.id);
    playGameBellSound();
  };

  const handleUndoLocal = () => {
    const chess = localChessRef.current;
    const stepsToUndo =
      activeTab === 'bot' && chess.turn() === botPlayerColor && localMoves.length >= 2
        ? 2
        : 1;
    let undoneCount = 0;
    for (let i = 0; i < stepsToUndo; i++) {
      if (chess.undo()) undoneCount++;
    }
    if (undoneCount === 0) return;

    const nextFen = chess.fen();
    setLocalFen(nextFen);
    setLocalPgn(chess.pgn());
    setLocalEval(evaluateChessInstance(chess));
    setEvaluationCp(evaluatePositionCp(nextFen));
    setLocalMoves((prev) => {
      const next = prev.slice(0, -undoneCount);
      const last = next[next.length - 1];
      setLocalLastMove(last ? { from: last.from, to: last.to } : null);
      return next;
    });
    setLocalLastCaptureDuel(null);
    setLocalClaimedDraw(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setHintResult(null);
    playWoodMoveSound();
  };

  // Multiplayer Actions
  const handleCreateRoom = () => {
    setMpErrorBanner(null);
    dispatchMultiplayerAction<RoomJoinedResponse>(
      'room:create',
      {
        sessionToken: sessionTokenRef.current,
        playerName,
        timeControl: selectedTimeControl,
        preferredColor,
        visibility: roomVisibility,
      },
      (res) => {
        if (res.ok && res.room && res.yourRole) {
          setActiveRoom(res.room);
          setMyRole(res.yourRole);
          prevMpPlyRef.current = res.room.ply;
          prevMpStatusRef.current = res.room.status;
          if (res.yourRole === 'w' || res.yourRole === 'b') {
            setMpOrientation(res.yourRole);
          }
          setActiveTab('multiplayer');
          setSidebarSubTab('match');
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('classic_chess_active_room', res.room.roomCode);
            const url = new URL(window.location.href);
            url.searchParams.set('room', res.room.roomCode);
            window.history.replaceState({}, '', url.toString());
          }
        } else {
          setMpErrorBanner(res.error || 'Gagal membuat room.');
        }
      }
    );
  };

  const handleJoinRoomByCode = (code: string) => {
    setMpErrorBanner(null);
    dispatchMultiplayerAction<RoomJoinedResponse>(
      'room:join',
      {
        sessionToken: sessionTokenRef.current,
        roomCode: code.toUpperCase(),
        playerName,
      },
      (res) => {
        if (res.ok && res.room && res.yourRole) {
          setActiveRoom(res.room);
          setMyRole(res.yourRole);
          prevMpPlyRef.current = res.room.ply;
          prevMpStatusRef.current = res.room.status;
          if (res.yourRole === 'w' || res.yourRole === 'b') {
            setMpOrientation(res.yourRole);
          }
          setActiveTab('multiplayer');
          setSidebarSubTab('match');
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('classic_chess_active_room', res.room.roomCode);
            const url = new URL(window.location.href);
            url.searchParams.set('room', res.room.roomCode);
            window.history.replaceState({}, '', url.toString());
          }
        } else {
          setMpErrorBanner(res.error || 'Gagal bergabung ke room.');
        }
      }
    );
  };

  const handleReadyToStart = () => {
    if (!activeRoom) return;
    dispatchMultiplayerAction<{ ok: boolean; error?: string }>(
      'room:ready',
      {
        sessionToken: sessionTokenRef.current,
        roomCode: activeRoom.roomCode,
      },
      (res) => {
        if (!res.ok) {
          setMpErrorBanner(res.error || 'Gagal memulai pertandingan.');
        }
      }
    );
  };

  const handleCancelWaitingRoom = () => {
    if (!activeRoom) return;
    dispatchMultiplayerAction(
      'room:cancel',
      {
        sessionToken: sessionTokenRef.current,
        roomCode: activeRoom.roomCode,
      },
      () => {
        handleLeaveRoom();
      }
    );
  };

  const handleOfferDraw = () => {
    if (!activeRoom) return;
    dispatchMultiplayerAction('game:draw-offer', {
      sessionToken: sessionTokenRef.current,
      roomCode: activeRoom.roomCode,
    });
  };

  const handleRespondDraw = (accept: boolean) => {
    if (!activeRoom) return;
    dispatchMultiplayerAction('game:draw-response', {
      sessionToken: sessionTokenRef.current,
      roomCode: activeRoom.roomCode,
      accept,
    });
  };

  const handleClaimDraw = () => {
    if (isMultiplayerView && activeRoom) {
      dispatchMultiplayerAction<{ ok: boolean; error?: string }>(
        'game:claim-draw',
        {
          sessionToken: sessionTokenRef.current,
          roomCode: activeRoom.roomCode,
        },
        (res) => {
          if (!res.ok) {
            setMpErrorBanner(res.error || 'Klaim remis ditolak.');
          }
        }
      );
      return;
    }

    if (localEval.canClaimThreefold) {
      setLocalClaimedDraw('Remis diklaim melalui Pengulangan Posisi 3 Kali (Threefold Repetition).');
      playGameBellSound();
    } else if (localEval.canClaimFiftyMoves) {
      setLocalClaimedDraw('Remis diklaim melalui Aturan 50 Langkah.');
      playGameBellSound();
    }
  };

  const handleResign = () => {
    if (!activeRoom) return;
    dispatchMultiplayerAction('game:resign', {
      sessionToken: sessionTokenRef.current,
      roomCode: activeRoom.roomCode,
    });
  };

  const handleRematch = () => {
    if (!activeRoom) return;
    dispatchMultiplayerAction<{ ok: boolean; room?: RoomStateSnapshot }>(
      'room:rematch',
      {
        sessionToken: sessionTokenRef.current,
        roomCode: activeRoom.roomCode,
      },
      (res) => {
        if (res.ok && res.room) {
          if (myRole === 'w') {
            setMyRole('b');
            setMpOrientation('b');
          } else if (myRole === 'b') {
            setMyRole('w');
            setMpOrientation('w');
          }
        }
      }
    );
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    setMpErrorBanner(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('classic_chess_active_room');
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
    }
    fetchLobbyViaHttp();
  };

  const handleSendChat = (message: string) => {
    if (!activeRoom) return;
    dispatchMultiplayerAction<{ ok: boolean; error?: string }>(
      'chat:send',
      {
        sessionToken: sessionTokenRef.current,
        roomCode: activeRoom.roomCode,
        message,
      },
      (res) => {
        if (!res.ok && res.error) {
          setMpErrorBanner(res.error);
        }
      }
    );
  };

  const toggleMute = () => {
    const next = !soundMuted;
    setSoundMutedState(next);
    setSoundMuted(next);
  };

  // Top & Bottom Player Bar Calculation
  const topBarColor: PieceColor = currentOrientation === 'w' ? 'b' : 'w';
  const bottomBarColor: PieceColor = currentOrientation;

  const getPlayerBarProps = (barColor: PieceColor) => {
    const isWhite = barColor === 'w';
    const capturedPieces = isWhite
      ? materialBalance.capturedByWhite
      : materialBalance.capturedByBlack;
    const materialAdvantage =
      materialBalance.advantageColor === barColor ? materialBalance.advantageDiff : 0;

    if (isMultiplayerView && activeRoom) {
      const seat = isWhite ? activeRoom.whitePlayer : activeRoom.blackPlayer;
      return {
        displayName:
          seat?.displayName || (isWhite ? 'Menunggu Pemain Putih...' : 'Menunggu Pemain Hitam...'),
        color: barColor,
        isTurn: activeRoom.status === 'active' && activeRoom.turn === barColor,
        inCheck: activeRoom.inCheck && activeRoom.turn === barColor,
        connected: seat ? seat.connected : false,
        isMultiplayer: true,
        rating: seat?.rating,
        capturedPieces,
        materialAdvantage,
        clocks: activeRoom.clocks,
        roleBadge: myRole === barColor ? 'Anda' : undefined,
        themeMode,
      };
    }

    if (activeTab === 'bot') {
      const isBotSeat = barColor !== botPlayerColor;
      const preset = BOT_DIFFICULTY_PRESETS[botDifficulty];
      return {
        displayName: isBotSeat
          ? `Bot AI · ${preset.name}`
          : `${playerName} (${barColor === 'w' ? 'Putih' : 'Hitam'})`,
        color: barColor,
        isTurn: !localEval.isAutomaticGameOver && !localClaimedDraw && localEval.turn === barColor,
        inCheck: localEval.inCheck && localEval.turn === barColor,
        connected: true,
        isMultiplayer: false,
        rating: isBotSeat ? preset.eloEstimate : 1200,
        capturedPieces,
        materialAdvantage,
        clocks: null,
        roleBadge: isBotSeat ? (botThinking ? 'Berpikir...' : 'AI') : 'Anda',
        themeMode,
      };
    }

    return {
      displayName: isWhite ? 'Pemain Putih (Lokal)' : 'Pemain Hitam (Lokal)',
      color: barColor,
      isTurn: !localEval.isAutomaticGameOver && !localClaimedDraw && localEval.turn === barColor,
      inCheck: localEval.inCheck && localEval.turn === barColor,
      connected: true,
      isMultiplayer: false,
      capturedPieces,
      materialAdvantage,
      clocks: null,
      themeMode,
    };
  };

  const canClaimCurrentDraw = isMultiplayerView
    ? Boolean(activeRoom?.canClaimThreefold || activeRoom?.canClaimFiftyMoves)
    : Boolean(localEval.canClaimThreefold || localEval.canClaimFiftyMoves);

  const claimDrawReasonText = (() => {
    if (isMultiplayerView && activeRoom) {
      if (activeRoom.canClaimThreefold) return 'Pengulangan Posisi 3 Kali';
      if (activeRoom.canClaimFiftyMoves) return 'Aturan 50 Langkah';
    } else {
      if (localEval.canClaimThreefold) return 'Pengulangan Posisi 3 Kali';
      if (localEval.canClaimFiftyMoves) return 'Aturan 50 Langkah';
    }
    return null;
  })();

  const whiteEvalPercentage = Math.min(
    94,
    Math.max(6, 50 + Math.atan(evaluationCp / 350) * (44 / (Math.PI / 2)))
  );
  const formattedEvalScore =
    Math.abs(evaluationCp) > 9000
      ? 'M'
      : `${evaluationCp >= 0 ? '+' : ''}${(evaluationCp / 100).toFixed(1)}`;

  const handleFlipBoardOrientation = () => {
    if (isMultiplayerView) {
      setMpOrientation((prev) => (prev === 'w' ? 'b' : 'w'));
    } else {
      setLocalOrientation((prev) => (prev === 'w' ? 'b' : 'w'));
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isLight
          ? 'bg-[#E6E2D8] text-[#12231B]'
          : 'bg-[#09130E] bg-[radial-gradient(ellipse_at_top_left,_#152C20_0%,_#09130E_58%,_#14100C_100%)] text-[#F3ECE0]'
      }`}
    >
      {/* Top Header Inspired by Image 2 Portfolio Header (Rennale & Archiova Aesthetic) */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between gap-3 px-3 sm:px-6 py-2.5 border-b backdrop-blur-md transition-colors ${
          isLight
            ? 'bg-[#F4F1EA]/92 border-[#C5BFB3] text-[#12231B]'
            : 'bg-[#0D1A13]/92 border-[#7A9A76]/30 text-[#F3ECE0] shadow-[0_8px_28px_rgba(0,0,0,0.55)]'
        }`}
      >
        {/* Zone 1: Crowned Knight Emblem + Wordmark + Sage Tag */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('bot');
            setSidebarSubTab('match');
          }}
          className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 focus:outline-none"
        >
          <ChessBrandEmblem
            size="sm"
            variant={isLight ? 'forest' : 'sand'}
          />
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-lg sm:text-xl font-bold tracking-tight">
              Classic{' '}
              <span className={isLight ? 'text-[#3F543E]' : 'text-[#DFC29B]'}>
                Chess
              </span>
            </span>
            <span
              className={`hidden xl:inline-block text-[10px] font-semibold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border ${
                isLight
                  ? 'bg-[#E2DDD3] text-[#3F543E] border-[#C5BFB3]'
                  : 'bg-[#14281E] text-[#7A9A76] border-[#7A9A76]/30'
              }`}
            >
              FIDE Studio
            </span>
          </div>
        </a>

        {/* Zone 2: Animated Mode Switcher (Desktop & Tablet) */}
        <nav
          aria-label="Mode Permainan"
          className={`hidden md:flex items-center gap-1 p-1 rounded-full border ${
            isLight
              ? 'bg-[#E2DDD3]/90 border-[#C5BFB3]'
              : 'bg-[#09130E] border-[#7A9A76]/30 shadow-[inset_0_2px_5px_rgba(0,0,0,0.6)]'
          }`}
        >
          {[
            { id: 'bot' as const, label: 'Lawan Bot AI', icon: Bot },
            {
              id: 'multiplayer' as const,
              label: activeRoom ? `Multiplayer (${activeRoom.roomCode})` : 'Multiplayer Online',
              icon: Users,
            },
            { id: 'local' as const, label: 'Latihan FIDE', icon: Swords },
          ].map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarSubTab('match');
                }}
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? isLight
                      ? 'text-[#EFE6D5] font-bold'
                      : 'text-[#0E1B14] font-bold'
                    : isLight
                    ? 'text-[#4A5D49] hover:text-[#12231B]'
                    : 'text-[#9BB09D] hover:text-[#F3ECE0]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="activeArenaModePill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className={`absolute inset-0 rounded-full ${
                      isLight ? 'bg-[#14261D]' : 'bg-[#DFC29B]'
                    }`}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Compact Guide Button + Desktop 2D/3D Toggle + Sound + Dark/Light Switch */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDesktopViewport && (
            <button
              type="button"
              onClick={toggleDesktopBoardMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                effectiveBoardMode === '3d'
                  ? 'bg-[#DFC29B] text-[#0E1B14] border-[#DFC29B]'
                  : isLight
                  ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#14261D] hover:text-[#EFE6D5]'
                  : 'bg-[#152A20] text-[#F3ECE0] border-[#7A9A76]/40 hover:border-[#DFC29B]'
              }`}
              title="Beralih antara Papan 2D dan Papan 3D (Khusus Komputer/Desktop)"
            >
              {effectiveBoardMode === '3d' ? (
                <>
                  <Grid className="w-3.5 h-3.5" />
                  <span>Mode 2D</span>
                </>
              ) : (
                <>
                  <Box className="w-3.5 h-3.5 text-[#DFC29B]" />
                  <span>Mode 3D</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#14261D] hover:text-[#EFE6D5]'
                : 'bg-[#152A20] text-[#F3ECE0] border-[#7A9A76]/40 hover:border-[#DFC29B] shadow-[inset_0_1px_0_0_rgba(223,194,155,0.12)]'
            }`}
            title="Buka Panduan Interaktif Ringkas"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#DFC29B]" />
            <span className="hidden sm:inline">Panduan</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className={`p-1.5 rounded-full border transition-colors shrink-0 ${
              isLight
                ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#D5CFC3]'
                : 'bg-[#152A20] text-[#F3ECE0] border-[#7A9A76]/40 hover:border-[#DFC29B]'
            }`}
            title={soundMuted ? 'Aktifkan Suara' : 'Matikan Suara'}
            aria-label={soundMuted ? 'Aktifkan Suara' : 'Matikan Suara'}
          >
            {soundMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleThemeMode}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors shrink-0 ${
              isLight
                ? 'bg-[#14261D] text-[#EFE6D5] border-[#14261D] hover:bg-[#1F3A2C]'
                : 'bg-[#DFC29B] text-[#0E1B14] border-[#DFC29B] hover:bg-[#EAD3B3]'
            }`}
            title={isLight ? 'Beralih ke Suasana Gelap (Rennale & Archiova)' : 'Beralih ke Suasana Terang (Vellure Linen)'}
          >
            {isLight ? (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Gelap</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Terang</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Compact Mode Switcher Bar (< 768px) */}
      <div
        className={`flex md:hidden items-center justify-between gap-1 px-3 py-1.5 border-b ${
          isLight
            ? 'bg-[#EAE6DF] border-[#C5BFB3]'
            : 'bg-[#0D1A13] border-[#7A9A76]/30'
        }`}
      >
        {[
          { id: 'bot' as const, label: 'Bot AI', icon: Bot },
          {
            id: 'multiplayer' as const,
            label: activeRoom ? `Room (${activeRoom.roomCode})` : 'Multiplayer',
            icon: Users,
          },
          { id: 'local' as const, label: 'Latihan', icon: Swords },
        ].map((item) => {
          const active = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setSidebarSubTab('match');
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                active
                  ? isLight
                    ? 'bg-[#14261D] text-[#EFE6D5]'
                    : 'bg-[#DFC29B] text-[#0E1B14]'
                  : isLight
                  ? 'text-[#4A5D49]'
                  : 'text-[#9BB09D]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN FOCUSED ARENA WORKSPACE: Responsive 12-Col Split (Board Stage + Unified Sidebar Card) */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-2.5 sm:px-5 lg:px-8 py-3 sm:py-5 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* LEFT / CENTER ARENA STAGE (7 cols on lg, 8 cols on xl) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col items-center w-full">
          <div className="w-full max-w-[540px] lg:max-w-[min(100%,calc(100vh-175px))] flex flex-col gap-2">
            {/* Top Bar: Opponent Info & Clock */}
            <PlayerClockBar {...getPlayerBarProps(topBarColor)} />

            {/* Center: Live Evaluation Bar + Active Chessboard */}
            <div className="flex gap-2 sm:gap-2.5 items-stretch w-full">
              {/* Vertical Live Evaluation Bar */}
              {!isMultiplayerView && (
                <div
                  className={`w-4 sm:w-5 rounded-xl overflow-hidden flex flex-col justify-between relative shrink-0 select-none border ${
                    isLight
                      ? 'bg-[#14261D] border-[#5E785D]'
                      : 'bg-[#0A140F] border-[#7A9A76]/40 shadow-[inset_0_2px_6px_rgba(0,0,0,0.75)]'
                  }`}
                  title={`Evaluasi Posisi: ${formattedEvalScore}`}
                >
                  <svg
                    viewBox="0 0 24 100"
                    preserveAspectRatio="none"
                    className="w-full h-full block"
                    aria-hidden="true"
                  >
                    <rect x="0" y="0" width="24" height="100" fill="#13261C" />
                    <rect
                      x="0"
                      y={100 - whiteEvalPercentage}
                      width="24"
                      height={whiteEvalPercentage}
                      fill="#E3DEC6"
                      className="transition-all duration-300"
                    />
                  </svg>
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 text-[8px] sm:text-[9px] font-mono font-bold tabular-nums ${
                      evaluationCp >= 0
                        ? 'bottom-1 text-[#12231B]'
                        : 'top-1 text-[#F3ECE0]'
                    }`}
                  >
                    {formattedEvalScore}
                  </span>
                </div>
              )}

              {/* Chessboard Canvas Container (Strictly 2D on Mobile/Tablet, 2D or 3D on Desktop) */}
              <div className="flex-1 relative min-w-0">
                {effectiveBoardMode === '3d' ? (
                  <div className="w-full aspect-square min-h-[420px] max-h-[620px] relative">
                    <ChessBoard3D
                      fen={currentFen}
                      orientation={currentOrientation}
                      selectedSquare={selectedSquare}
                      legalMoves={legalMoves}
                      lastMove={currentLastMove}
                      lastCaptureDuel={currentLastCaptureDuel}
                      hintMove={
                        hintResult ? { from: hintResult.from, to: hintResult.to } : null
                      }
                      kingSquareInCheck={currentKingSquareInCheck}
                      interactive={canInteractWithBoard}
                      onSquareSelect={handleSquareSelect}
                      onMoveAttempt={handleMoveAttempt}
                      onFlipOrientation={handleFlipBoardOrientation}
                      onSwitchTo2D={() => {
                        setDesktopBoardMode('2d');
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('classic_chess_desktop_board_mode', '2d');
                        }
                      }}
                      visualSettings={visualSettings}
                      onUpdateVisualSettings={updateVisualSettings}
                    />
                  </div>
                ) : (
                  <ChessBoard2D
                    fen={currentFen}
                    orientation={currentOrientation}
                    selectedSquare={selectedSquare}
                    legalMoves={legalMoves}
                    lastMove={currentLastMove}
                    wasCapture={latestMoveWasCapture}
                    hintMove={
                      hintResult ? { from: hintResult.from, to: hintResult.to } : null
                    }
                    kingSquareInCheck={currentKingSquareInCheck}
                    interactive={canInteractWithBoard}
                    onSquareSelect={handleSquareSelect}
                    onMoveAttempt={handleMoveAttempt}
                    onFlipOrientation={handleFlipBoardOrientation}
                    themeMode={themeMode}
                    isDesktopViewport={isDesktopViewport}
                    onSwitchTo3D={() => {
                      setDesktopBoardMode('3d');
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('classic_chess_desktop_board_mode', '3d');
                      }
                    }}
                    boardThemeId={boardTheme2D}
                    onSelectBoardTheme={handleSelectBoardTheme2D}
                    pieceStyle2D={pieceStyle2D}
                    onSelectPieceStyle2D={handleSelectPieceStyle2D}
                  />
                )}

                {/* Animated Local / Bot Game Over Overlay Modal */}
                <AnimatePresence>
                  {(activeTab === 'local' || activeTab === 'bot') &&
                    (localEval.isAutomaticGameOver || Boolean(localClaimedDraw)) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="absolute top-12 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-sm p-4 rounded-2xl bg-[#102018]/95 backdrop-blur-md text-[#F3ECE0] border border-[#DFC29B]/70 shadow-[0_24px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <ChessBrandEmblem size="sm" variant="sand" />
                          <div>
                            <div className="text-sm sm:text-base font-bold text-[#DFC29B] font-serif">
                              {localClaimedDraw
                                ? 'Pertandingan Remis'
                                : localEval.isCheckmate
                                ? `Skakmat! ${
                                    localEval.winnerColor === 'w' ? 'Putih' : 'Hitam'
                                  } Menang`
                                : 'Pertandingan Remis'}
                            </div>
                            <div className="text-[11px] text-[#9BB09D]">
                              {localClaimedDraw ||
                                (localEval.terminationReason === 'checkmate'
                                  ? `Skor Akhir: ${localEval.result}`
                                  : `Alasan: ${localEval.terminationReason}`)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            activeTab === 'bot'
                              ? handleStartBotGame(botPlayerColor)
                              : handleLoadLocalPreset(RULE_TEST_PRESETS[0])
                          }
                          className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap shrink-0"
                        >
                          Main Lagi
                        </button>
                      </motion.div>
                    )}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom Bar: Active Player Info & Clock */}
            <PlayerClockBar {...getPlayerBarProps(bottomBarColor)} />
          </div>
        </div>

        {/* RIGHT SIDEBAR: Unified Portfolio-Styled Control Card (5 cols on lg, 4 cols on xl) */}
        <aside
          aria-label="Panel Kontrol Pertandingan"
          className={`lg:col-span-5 xl:col-span-4 w-full rounded-2xl border p-4 sm:p-5 flex flex-col gap-3.5 transition-all ${
            isLight
              ? 'bg-[#F4F1EA] border-[#C5BFB3] text-[#12231B] shadow-[0_12px_32px_-10px_rgba(18,35,27,0.12)]'
              : 'bg-[linear-gradient(155deg,#13271D_0%,#0E1D15_60%,#1B1611_100%)] border-[#7A9A76]/35 text-[#F3ECE0] shadow-[0_24px_54px_-12px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(223,194,155,0.16)]'
          }`}
        >
          {/* Portfolio Card Editorial Header */}
          <div
            className={`flex items-center justify-between gap-2 pb-2.5 border-b ${
              isLight ? 'border-[#C5BFB3]' : 'border-[#7A9A76]/25'
            }`}
          >
            <div>
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                  isLight ? 'text-[#5E785D]' : 'text-[#7A9A76]'
                }`}
              >
                {activeTab === 'bot'
                  ? 'AI TACTICAL ENGINE'
                  : activeTab === 'multiplayer'
                  ? 'REAL-TIME MULTIPLAYER'
                  : 'FIDE TRAINING STUDIO'}
              </span>
              <h2 className="text-base sm:text-lg font-bold font-serif leading-tight">
                {activeTab === 'bot' ? (
                  <>
                    Arena{' '}
                    <span className={isLight ? 'text-[#3F543E]' : 'text-[#DFC29B]'}>
                      Lawan Bot AI
                    </span>
                  </>
                ) : activeTab === 'multiplayer' ? (
                  <>
                    Lobi &{' '}
                    <span className={isLight ? 'text-[#3F543E]' : 'text-[#DFC29B]'}>
                      Room Online
                    </span>
                  </>
                ) : (
                  <>
                    Simulasi{' '}
                    <span className={isLight ? 'text-[#3F543E]' : 'text-[#DFC29B]'}>
                      Aturan FIDE
                    </span>
                  </>
                )}
              </h2>
            </div>

            {activeTab === 'multiplayer' && (
              <div
                className={`inline-flex items-center gap-1 p-1 rounded-full border ${
                  isLight
                    ? 'bg-[#E2DDD3] border-[#C5BFB3]'
                    : 'bg-[#09130E] border-[#7A9A76]/30'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSidebarSubTab('match')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap ${
                    sidebarSubTab !== 'moves'
                      ? isLight
                        ? 'bg-[#14261D] text-[#EFE6D5]'
                        : 'bg-[#DFC29B] text-[#0E1B14]'
                      : isLight
                      ? 'text-[#4A5D49]'
                      : 'text-[#9BB09D]'
                  }`}
                >
                  Lobi
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarSubTab('moves')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap ${
                    sidebarSubTab === 'moves'
                      ? isLight
                        ? 'bg-[#14261D] text-[#EFE6D5]'
                        : 'bg-[#DFC29B] text-[#0E1B14]'
                      : isLight
                      ? 'text-[#4A5D49]'
                      : 'text-[#9BB09D]'
                  }`}
                >
                  <ListOrdered className="w-3 h-3" />
                  <span>Notasi ({currentMoves.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Animated Body inside Unified Sidebar Card */}
          <AnimatePresence mode="wait">
            {activeTab === 'multiplayer' ? (
              sidebarSubTab === 'moves' ? (
                <motion.div
                  key="mp-moves-tab"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                >
                  <MoveHistoryPanel
                    embedded
                    moves={currentMoves}
                    fen={currentFen}
                    pgn={currentPgn}
                    mode="multiplayer"
                    isGameActive={activeRoom?.status === 'active'}
                    canClaimDraw={canClaimCurrentDraw}
                    claimDrawReason={claimDrawReasonText}
                    onClaimDraw={handleClaimDraw}
                    drawOfferBy={activeRoom ? activeRoom.drawOfferBy : null}
                    myColor={myRole}
                    onOfferDraw={handleOfferDraw}
                    onRespondDraw={handleRespondDraw}
                    onResign={handleResign}
                    themeMode={themeMode}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="mp-lobby-tab"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="flex flex-col gap-3"
                >
                  <RoomLobbyAndChatPanel
                    embedded
                    socketConnected={socketConnected}
                    playerName={playerName}
                    onPlayerNameChange={setPlayerName}
                    selectedTimeControl={selectedTimeControl}
                    onSelectTimeControl={setSelectedTimeControl}
                    preferredColor={preferredColor}
                    onSelectPreferredColor={setPreferredColor}
                    roomVisibility={roomVisibility}
                    onSelectRoomVisibility={setRoomVisibility}
                    joinCodeInput={joinCodeInput}
                    onJoinCodeInputChange={setJoinCodeInput}
                    waitingRooms={waitingRooms}
                    onCreateRoom={handleCreateRoom}
                    onJoinRoomByCode={handleJoinRoomByCode}
                    onRefreshLobby={() => {
                      fetchLobbyViaHttp();
                      socketRef.current?.emit('lobby:list');
                    }}
                    activeRoom={activeRoom}
                    myRole={myRole}
                    onReadyToStart={handleReadyToStart}
                    onRematch={handleRematch}
                    onLeaveRoom={handleLeaveRoom}
                    onCancelRoom={handleCancelWaitingRoom}
                    onSendChat={handleSendChat}
                    errorBanner={mpErrorBanner}
                    themeMode={themeMode}
                  />

                  {/* When game is active, also show compact resign/draw footer directly under room panel */}
                  {activeRoom?.status === 'active' && (
                    <div
                      className={`pt-2.5 border-t ${
                        isLight ? 'border-[#C5BFB3]' : 'border-[#7A9A76]/25'
                      }`}
                    >
                      <MoveHistoryPanel
                        embedded
                        moves={currentMoves}
                        fen={currentFen}
                        pgn={currentPgn}
                        mode="multiplayer"
                        isGameActive={activeRoom.status === 'active'}
                        canClaimDraw={canClaimCurrentDraw}
                        claimDrawReason={claimDrawReasonText}
                        onClaimDraw={handleClaimDraw}
                        drawOfferBy={activeRoom.drawOfferBy}
                        myColor={myRole}
                        onOfferDraw={handleOfferDraw}
                        onRespondDraw={handleRespondDraw}
                        onResign={handleResign}
                        themeMode={themeMode}
                      />
                    </div>
                  )}
                </motion.div>
              )
            ) : (
              <motion.div
                key={`deck-match-${activeTab}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="flex flex-col gap-3"
              >
                {activeTab === 'bot' ? (
                  <div
                    className={`flex flex-col gap-2.5 pb-3 border-b ${
                      isLight ? 'border-[#C5BFB3]' : 'border-[#7A9A76]/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold font-serif">
                          Tingkat Kesulitan AI
                        </h3>
                        <p
                          className={`text-[11px] ${
                            isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
                          }`}
                        >
                          {BOT_DIFFICULTY_PRESETS[botDifficulty].name} · ~
                          {BOT_DIFFICULTY_PRESETS[botDifficulty].eloEstimate} ELO
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={botThinking || hintLoading || localEval.isAutomaticGameOver}
                        onClick={handleRequestHint}
                        className={`inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap disabled:opacity-40 ${
                          isLight
                            ? 'bg-[#14261D] text-[#EFE6D5] hover:bg-[#1F3A2C]'
                            : 'bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] shadow-xs'
                        }`}
                        title="Tampilkan Panah Saran Langkah Terbaik"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>{hintLoading ? 'Analisis...' : 'Hint Langkah'}</span>
                      </button>
                    </div>

                    {/* 5 Compact Difficulty Buttons */}
                    <div className="grid grid-cols-5 gap-1">
                      {(
                        [
                          'beginner',
                          'casual',
                          'tactician',
                          'master',
                          'grandmaster',
                        ] as BotDifficultyId[]
                      ).map((diffId) => {
                        const active = botDifficulty === diffId;
                        const labels: Record<BotDifficultyId, string> = {
                          beginner: 'Pemula',
                          casual: 'Kasual',
                          tactician: 'Taktis',
                          master: 'Master',
                          grandmaster: 'GM',
                        };
                        return (
                          <button
                            key={diffId}
                            type="button"
                            onClick={() => setBotDifficulty(diffId)}
                            className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold border transition-all whitespace-nowrap ${
                              active
                                ? isLight
                                  ? 'bg-[#14261D] text-[#EFE6D5] border-[#14261D] font-bold'
                                  : 'bg-[#DFC29B] text-[#0E1B14] border-[#DFC29B] font-bold'
                                : isLight
                                ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3] hover:bg-[#DFD9CE]'
                                : 'bg-[#0A140F] text-[#9BB09D] border-[#7A9A76]/30 hover:text-[#F3ECE0]'
                            }`}
                          >
                            {labels[diffId]}
                          </button>
                        );
                      })}
                    </div>

                    {/* Side Selection Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-medium ${
                          isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
                        }`}
                      >
                        Main Sebagai:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[
                          { id: 'w' as const, label: 'Putih' },
                          { id: 'b' as const, label: 'Hitam' },
                          { id: 'random' as const, label: 'Acak' },
                        ].map((side) => {
                          const active = side.id !== 'random' && botPlayerColor === side.id;
                          return (
                            <button
                              key={side.id}
                              type="button"
                              onClick={() => handleStartBotGame(side.id)}
                              className={`py-1 px-3 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                                active
                                  ? isLight
                                    ? 'bg-[#4E392B] text-[#EFE6D5] border-[#4E392B] font-bold'
                                    : 'bg-[#1A3326] text-[#DFC29B] border-[#DFC29B]/60 font-bold'
                                  : isLight
                                  ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3]'
                                  : 'bg-[#0A140F] text-[#9BB09D] border-[#7A9A76]/30 hover:text-[#F3ECE0]'
                              }`}
                            >
                              {side.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Animated Tactical Hint Callout */}
                    <AnimatePresence>
                      {hintResult && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-2.5 rounded-xl bg-[#152A20] text-[#F3ECE0] border border-[#DFC29B]/45 text-xs flex flex-col gap-1 overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-serif font-bold text-xs text-[#DFC29B]">
                              Saran: {hintResult.san} ({hintResult.from} → {hintResult.to})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                executeValidatedMove(hintResult.from, hintResult.to)
                              }
                              className="px-2.5 py-0.5 rounded-full bg-[#DFC29B] text-[#0E1B14] font-bold text-[11px] hover:bg-[#EAD3B3] whitespace-nowrap"
                            >
                              Jalankan
                            </button>
                          </div>
                          <p className="text-[11px] text-[#9BB09D] leading-relaxed">
                            {hintResult.explanation}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div
                    className={`flex flex-col gap-2 pb-3 border-b ${
                      isLight ? 'border-[#C5BFB3]' : 'border-[#7A9A76]/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-serif">
                        Skenario Aturan FIDE
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoFlipLocal}
                          onChange={(e) => setAutoFlipLocal(e.target.checked)}
                          className="rounded border-[#7A9A76]"
                        />
                        <span>Putar Otomatis</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {RULE_TEST_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleLoadLocalPreset(preset)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap truncate ${
                            activePresetId === preset.id
                              ? isLight
                                ? 'bg-[#14261D] text-[#EFE6D5] border-[#14261D] font-bold'
                                : 'bg-[#DFC29B] text-[#0E1B14] border-[#DFC29B] font-bold'
                              : isLight
                              ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3]'
                              : 'bg-[#0A140F] text-[#9BB09D] border-[#7A9A76]/30 hover:text-[#F3ECE0]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
                      }`}
                    >
                      {RULE_TEST_PRESETS.find((p) => p.id === activePresetId)?.description}
                    </p>
                  </div>
                )}

                {/* Embedded Move History & Action Controls */}
                <MoveHistoryPanel
                  embedded
                  moves={currentMoves}
                  fen={currentFen}
                  pgn={currentPgn}
                  mode="local"
                  isGameActive={!localEval.isAutomaticGameOver && !localClaimedDraw}
                  canUndo={localMoves.length > 0 && !botThinking}
                  onUndo={handleUndoLocal}
                  onResetLocal={() =>
                    activeTab === 'bot'
                      ? handleStartBotGame(botPlayerColor)
                      : handleLoadLocalPreset(
                          RULE_TEST_PRESETS.find((p) => p.id === activePresetId) ||
                            RULE_TEST_PRESETS[0]
                        )
                  }
                  canClaimDraw={canClaimCurrentDraw}
                  claimDrawReason={claimDrawReasonText}
                  onClaimDraw={handleClaimDraw}
                  drawOfferBy={null}
                  myColor={currentTurn}
                  themeMode={themeMode}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </main>

      {/* Bottom Portfolio Feature Strip Inspired by Image 2 */}
      <footer
        className={`w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 pt-2 pb-5 flex flex-col items-center gap-3 select-none`}
      >
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2.5 max-w-4xl">
          {[
            {
              icon: Palette,
              title: '12 Tema & 8 Bidak',
              sub: 'Kustomisasi 1 Tombol',
            },
            {
              icon: Sparkles,
              title: 'Estetika Modern',
              sub: 'Rennale & Archiova',
            },
            {
              icon: MonitorSmartphone,
              title: 'Responsif Penuh',
              sub: '2D Mobile · 3D Desktop',
            },
            {
              icon: TrendingUp,
              title: 'FIDE & AI Taktis',
              sub: 'Hint & Room Online',
            },
          ].map((feat, idx) => {
            const FeatIcon = feat.icon;
            return (
              <div
                key={idx}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border ${
                  isLight
                    ? 'bg-[#F4F1EA]/80 border-[#C5BFB3] text-[#12231B]'
                    : 'bg-[#0E1D15]/80 border-[#7A9A76]/25 text-[#F3ECE0]'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                    isLight
                      ? 'bg-[#E2DDD3] border-[#C5BFB3] text-[#1F4031]'
                      : 'bg-[#162C20] border-[#7A9A76]/35 text-[#DFC29B]'
                  }`}
                >
                  <FeatIcon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight truncate">
                    {feat.title}
                  </div>
                  <div
                    className={`text-[10px] truncate ${
                      isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
                    }`}
                  >
                    {feat.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={`px-5 py-1.5 rounded-full border text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-center ${
            isLight
              ? 'bg-[#F4F1EA] border-[#C5BFB3] text-[#3F543E]'
              : 'bg-[#0D1A13] border-[#7A9A76]/30 text-[#DFC29B]'
          }`}
        >
          DESIGNS THAT INSPIRE · CHESS THAT PERFORMS
        </div>
      </footer>

      {/* Pawn Promotion Selection Modal */}
      {pendingPromotion && (
        <PromotionModal
          color={pendingPromotion.color}
          themeMode={themeMode}
          onSelect={(piece) => {
            const { from, to } = pendingPromotion;
            setPendingPromotion(null);
            executeValidatedMove(from, to, piece);
          }}
          onCancel={() => setPendingPromotion(null)}
        />
      )}

      {/* Compact Interactive User Guide Modal */}
      <UserGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        themeMode={themeMode}
        onToggleTheme={toggleThemeMode}
        isDesktopViewport={isDesktopViewport}
        effectiveBoardMode={effectiveBoardMode}
        onToggleDesktopBoardMode={toggleDesktopBoardMode}
      />
    </div>
  );
}
