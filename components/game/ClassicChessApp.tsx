'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import dynamic from 'next/dynamic';
import ChessBoard2D from '../chess/ChessBoard2D.tsx';
import PromotionModal from '../chess/PromotionModal.tsx';
import PlayerClockBar from './PlayerClockBar.tsx';
import MoveHistoryPanel from './MoveHistoryPanel.tsx';
import RoomLobbyAndChatPanel from './RoomLobbyAndChatPanel.tsx';
import UserGuideModal, { QuickGuideCard } from './UserGuideModal.tsx';
import {
  Volume2,
  VolumeX,
  Swords,
  Users,
  Bot,
  BookOpen,
  Lightbulb,
  SlidersHorizontal,
  Sun,
  Moon,
  HelpCircle,
  Box,
  Grid,
} from 'lucide-react';

// Dynamically load ChessBoard3D ONLY on Desktop when 3D mode is active so Mobile/Tablet never downloads Three.js/WebGL
const ChessBoard3D = dynamic(() => import('../chess/ChessBoard3D.tsx'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-xl bg-[#291C0E] border-2 border-[#6E473B] flex flex-col items-center justify-center p-6 text-center text-[#E1D4C2]">
      <div className="w-10 h-10 rounded-xl bg-[#6E473B] border border-[#A78D78] flex items-center justify-center mb-3 font-serif text-xl font-bold">
        ♔
      </div>
      <p className="text-sm font-bold font-serif">Memuat Ruang Catur 3D...</p>
      <p className="text-xs text-[#BEB5A9] mt-1">
        Menyiapkan pencahayaan dan bidak 3D untuk layar Desktop
      </p>
    </div>
  ),
});

type ActiveWorkspaceTab = 'bot' | 'local' | 'multiplayer' | 'roadmap';

interface SpecialRuleTestPreset {
  id: string;
  label: string;
  description: string;
  fen: string;
}

const RULE_TEST_PRESETS: SpecialRuleTestPreset[] = [
  {
    id: 'standard',
    label: 'Posisi Standar',
    description: '32 Bidak Catur pada susunan awal resmi FIDE.',
    fen: INITIAL_FEN,
  },
  {
    id: 'duel_arena',
    label: 'Taktik Tengah Permainan',
    description:
      'Posisi taktis tengah permainan untuk melatih serangan dan kombinasi perwira.',
    fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 7',
  },
  {
    id: 'castling',
    label: 'Uji Rokade (O-O & O-O-O)',
    description: 'Jalur Raja & Benteng terbuka untuk menguji rokade pendek dan panjang.',
    fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 4 8',
  },
  {
    id: 'enpassant',
    label: 'Uji En Passant',
    description: 'Pion Putih di e5 dapat menangkap pion Hitam d5 secara en passant (e5xd6).',
    fen: 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
  },
  {
    id: 'promotion',
    label: 'Uji Promosi Pion',
    description: 'Pion Putih di g7 siap maju ke g8 untuk promosi menjadi Ratu/Benteng/Gajah/Kuda.',
    fen: '1rbq1rk1/p1pp1pPp/2n2n2/1p2p3/4P3/2NP4/PPP2PPP/R1BQKBNR w KQ - 1 8',
  },
  {
    id: 'checkmate',
    label: 'Uji Skakmat 1 Langkah',
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
  // Navigation, Theme (Warm Light / Warm Dark), & Responsive 2D/3D Mode
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('bot');
  const [soundMuted, setSoundMutedState] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(false);
  const [desktopBoardMode, setDesktopBoardMode] = useState<'3d' | '2d'>('3d');
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [visualSettings, setVisualSettings] = useState<ArenaVisualSettings>(
    DEFAULT_VISUAL_SETTINGS
  );
  const [showVisualDrawer, setShowVisualDrawer] = useState(false);

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

  // Mobile/Tablet (< 1024px) ALWAYS uses 2D. Desktop (>= 1024px) uses 3D by default with 2D toggle.
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
  // STAGE 1: LOCAL & BOT AI 3D CHESS STATE (chess.js)
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
  // STAGE 2: MULTIPLAYER HYBRID STATE (Socket.IO + Vercel Serverless API)
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
      // Prevent out-of-order stale HTTP or socket responses from reverting newer room state
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
      // Always execute via authoritative /api/multiplayer so Vercel Serverless & Node server stay in sync
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

        // If Socket.IO is also connected on a custom server, notify peers immediately
        if (socketRef.current?.connected && data.ok && data.room) {
          socketRef.current.emit('lobby:list');
        }
      } catch {
        // Fallback to Socket.IO if fetch failed
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

  // Connect Hybrid Multiplayer (HTTP Serverless + optional Socket.IO) on mount and check URL `?room=XXXXXX`
  useEffect(() => {
    sessionTokenRef.current = getOrCreateTabSessionToken();
    const suffix = sessionTokenRef.current.slice(-4).toUpperCase();
    queueMicrotask(() => {
      setPlayerName((prev) => (prev === 'Grandmaster' ? `Pemain ${suffix}` : prev));
      // 1. Immediately activate via Next.js Serverless API (/api/multiplayer) so Vercel works 100% out of the box
      void fetchLobbyViaHttp().then(() => {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const urlRoom = params.get('room');
          const savedRoom = window.sessionStorage.getItem('classic_chess_active_room');
          const roomToJoin = urlRoom || savedRoom;

          if (roomToJoin) {
            setActiveTab('multiplayer');
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

    // 2. Optional Socket.IO accelerator when hosted on a stateful Node container
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

  // Real-time Serverless Polling Loop for Vercel & Hybrid synchronization
  // Stabilized on primitive activeRoomCode so interval is not torn down on every clock/state update
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

  const currentTurn: PieceColor = isMultiplayerView ? activeRoom.turn : localEval.turn;
  const currentKingSquareInCheck = isMultiplayerView
    ? activeRoom.kingSquareInCheck
    : localEval.kingSquareInCheck;

  const materialBalance = calculateMaterialBalance(currentFen);

  // Can the user currently interact with the pieces?
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

  // Core helper to apply a move to `localChessRef` (used by both player and Bot AI)
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

        // Play audio feedback
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

  // Trigger Bot AI turn automatically when in 'bot' mode and it's the bot's turn
  useEffect(() => {
    if (activeTab !== 'bot') return;
    if (localEval.isAutomaticGameOver || localClaimedDraw) return;
    if (localEval.turn === botPlayerColor) return;

    let cancelled = false;
    queueMicrotask(() => setBotThinking(true));

    // Give a brief natural pause after the player's 3D move animation completes
    const delayMs = localLastCaptureDuel ? 1150 : 560;
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
    localLastCaptureDuel,
    applyLocalOrBotMove,
  ]);

  // Handle selecting a square on the 3D/2D board
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

  // Execute move either locally, vs Bot AI, or via Hybrid Multiplayer
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

  // Start a new Bot AI match
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

  // Local Mode Helpers
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
    const stepsToUndo = activeTab === 'bot' && chess.turn() === botPlayerColor && localMoves.length >= 2 ? 2 : 1;
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

  // Multiplayer Actions (Hybrid Serverless + Socket.IO)
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
          ? `Bot AI: ${preset.name}`
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

  // Calculate evaluation bar percentage (White height %)
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
      className={`min-h-screen flex flex-col transition-colors ${
        isLight
          ? 'bg-[#E1D4C2] text-[#291C0E]'
          : 'bg-[#291C0E] text-[#E1D4C2]'
      }`}
    >
      {/* Top Header Bar combining all 5 palette colors (#291C0E, #6E473B, #A78D78, #BEB5A9, #E1D4C2) */}
      <header
        className={`flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b-2 transition-colors ${
          isLight
            ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B]'
            : 'bg-[#6E473B] text-[#E1D4C2] border-[#A78D78]'
        }`}
      >
        {/* Left: Brand & 5-Color Palette Swatch */}
        <div className="flex items-center gap-3">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('bot');
            }}
            className="flex items-center gap-2.5 text-lg sm:text-xl font-bold tracking-tight text-[#E1D4C2] font-serif whitespace-nowrap shrink-0"
          >
            <span className="w-8 h-8 rounded-lg bg-[#E1D4C2] text-[#291C0E] border-2 border-[#A78D78] flex items-center justify-center text-base font-bold">
              ♔
            </span>
            <span>Classic Chess</span>
          </a>

          {/* 5-Color Complementary Palette Badge */}
          <div
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-[#291C0E] border border-[#A78D78]"
            title="Palet 5 Warna Hangat: #291C0E · #6E473B · #A78D78 · #BEB5A9 · #E1D4C2"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#291C0E] border border-[#E1D4C2]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#6E473B] border border-[#E1D4C2]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#A78D78]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#BEB5A9]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#E1D4C2]" />
          </div>
        </div>

        {/* Center: Mode Navigation Links (Desktop/Tablet) */}
        <nav className="hidden md:flex items-center gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('bot')}
            className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
              activeTab === 'bot'
                ? 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                : 'bg-[#6E473B] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
            }`}
          >
            Lawan Bot AI
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('multiplayer')}
            className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
              activeTab === 'multiplayer'
                ? 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                : 'bg-[#6E473B] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
            }`}
          >
            Room Online {activeRoom ? `(${activeRoom.roomCode})` : ''}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
              activeTab === 'local'
                ? 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                : 'bg-[#6E473B] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
            }`}
          >
            Latihan & Aturan
          </button>
        </nav>

        {/* Right: 2D/3D Switch (Desktop), Theme Toggle (Light/Dark), Guide Modal Button, & Sound */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop 2D / 3D Switch Button (Mobile/Tablet automatically uses 2D) */}
          {isDesktopViewport ? (
            <button
              type="button"
              onClick={toggleDesktopBoardMode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#A78D78] text-[#291C0E] border border-[#E1D4C2] hover:bg-[#E1D4C2] transition-colors whitespace-nowrap"
              title="Beralih antara Papan 3D dan Papan 2D di Desktop"
            >
              {effectiveBoardMode === '3d' ? (
                <>
                  <Grid className="w-3.5 h-3.5" />
                  <span>Ganti ke 2D</span>
                </>
              ) : (
                <>
                  <Box className="w-3.5 h-3.5" />
                  <span>Ganti ke 3D</span>
                </>
              )}
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#A78D78] text-[#291C0E] border border-[#E1D4C2] whitespace-nowrap"
              title="Mode 2D aktif otomatis untuk performa optimal di HP & Tablet"
            >
              <Grid className="w-3 h-3" />
              <span>2D Mobile</span>
            </span>
          )}

          {/* Desktop 3D Quality Settings Drawer Toggle (only when 3D board is active) */}
          {isDesktopViewport && effectiveBoardMode === '3d' && (
            <button
              type="button"
              onClick={() => setShowVisualDrawer((prev) => !prev)}
              className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                showVisualDrawer
                  ? 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9]'
                  : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
              }`}
              title="Pengaturan Kualitas Visual 3D"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Kualitas 3D</span>
            </button>
          )}

          {/* Warm Light / Warm Dark Theme Switcher */}
          <button
            type="button"
            onClick={toggleThemeMode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#BEB5A9] text-[#291C0E] border border-[#E1D4C2] hover:bg-[#E1D4C2] transition-colors whitespace-nowrap"
            title="Ganti antara Tema Terang Hangat dan Tema Gelap Hangat"
          >
            {isLight ? (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tema Gelap</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tema Terang</span>
              </>
            )}
          </button>

          {/* Interactive Step-by-Step Guide Button */}
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9] hover:bg-[#BEB5A9] transition-colors whitespace-nowrap"
            title="Buka Panduan Langkah demi Langkah"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Panduan</span>
          </button>

          {/* Sound Mute Button */}
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-lg bg-[#291C0E] text-[#E1D4C2] border border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E] transition-colors"
            aria-label={soundMuted ? 'Aktifkan Suara' : 'Matikan Suara'}
            title={soundMuted ? 'Suara: Mati' : 'Suara: Aktif'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Optional 3D Visual Settings Strip (Desktop 3D Mode only) */}
      {isDesktopViewport && effectiveBoardMode === '3d' && showVisualDrawer && (
        <div className="bg-[#6E473B] text-[#E1D4C2] border-b-2 border-[#A78D78] px-6 py-2.5">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#E1D4C2]" />
              <span className="text-xs font-bold">
                Pengaturan Visual Papan 3D Desktop:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Piece Representation Toggle */}
              <div className="flex items-center gap-1 bg-[#291C0E] p-1 rounded-lg border border-[#A78D78]">
                <button
                  type="button"
                  onClick={() => updateVisualSettings({ pieceStyle: 'living' })}
                  className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                    visualSettings.pieceStyle === 'living'
                      ? 'bg-[#E1D4C2] text-[#291C0E] font-bold'
                      : 'text-[#BEB5A9]'
                  }`}
                >
                  Karakter 3D
                </button>
                <button
                  type="button"
                  onClick={() => updateVisualSettings({ pieceStyle: 'staunton' })}
                  className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                    visualSettings.pieceStyle === 'staunton'
                      ? 'bg-[#E1D4C2] text-[#291C0E] font-bold'
                      : 'text-[#BEB5A9]'
                  }`}
                >
                  Staunton Klasik
                </button>
              </div>

              {/* Quality Presets */}
              <div className="flex items-center gap-1 bg-[#291C0E] p-1 rounded-lg border border-[#A78D78]">
                {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => updateVisualSettings({ graphicsQuality: q })}
                    className={`px-2 py-1 rounded text-xs font-semibold uppercase whitespace-nowrap ${
                      visualSettings.graphicsQuality === q
                        ? 'bg-[#E1D4C2] text-[#291C0E] font-bold'
                        : 'text-[#BEB5A9]'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Switch to 2D shortcut */}
              <button
                type="button"
                onClick={() => setDesktopBoardMode('2d')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E1D4C2] text-[#291C0E] border border-[#291C0E] hover:bg-[#BEB5A9] transition-colors whitespace-nowrap"
              >
                Gunakan Papan 2D Ringan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile & Tablet Mode Switcher Strip */}
      <div
        className={`flex md:hidden items-center justify-between gap-1.5 px-3 py-2 border-b-2 overflow-x-auto ${
          isLight
            ? 'bg-[#BEB5A9] border-[#A78D78]'
            : 'bg-[#6E473B] border-[#A78D78]'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('bot')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap ${
            activeTab === 'bot'
              ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B]'
              : 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78]'
          }`}
        >
          Lawan Bot AI
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('multiplayer')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap ${
            activeTab === 'multiplayer'
              ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B]'
              : 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78]'
          }`}
        >
          Room Online {activeRoom ? `(${activeRoom.roomCode})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('local')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap ${
            activeTab === 'local'
              ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B]'
              : 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78]'
          }`}
        >
          Latihan
        </button>
      </div>

      {/* Main Content Container: Simple, Clean Responsive Grid */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT / MAIN AREA: Player Clocks + Chessboard (2D on Mobile/Tablet, 3D/2D on Desktop) + Quick Guide (8 cols on desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Top Bar: Opponent Info & Clock */}
          <PlayerClockBar {...getPlayerBarProps(topBarColor)} />

          {/* Center: Evaluation Bar + Active Chessboard (2D or 3D) */}
          <div className="flex gap-2.5 items-stretch">
            {/* Vertical Live Evaluation Bar using pure SVG (zero inline styles) */}
            {!isMultiplayerView && (
              <div
                className="w-6 rounded-xl bg-[#291C0E] border-2 border-[#6E473B] overflow-hidden flex flex-col justify-between relative shrink-0 select-none"
                title={`Evaluasi Posisi: ${formattedEvalScore}`}
              >
                <svg
                  viewBox="0 0 24 100"
                  preserveAspectRatio="none"
                  className="w-full h-full block"
                  aria-hidden="true"
                >
                  <rect x="0" y="0" width="24" height="100" fill="#291C0E" />
                  <rect
                    x="0"
                    y={100 - whiteEvalPercentage}
                    width="24"
                    height={whiteEvalPercentage}
                    fill="#E1D4C2"
                  />
                </svg>
                <span
                  className={`absolute left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold tabular-nums ${
                    evaluationCp >= 0
                      ? 'bottom-1.5 text-[#291C0E]'
                      : 'top-1.5 text-[#E1D4C2]'
                  }`}
                >
                  {formattedEvalScore}
                </span>
              </div>
            )}

            {/* Board Container */}
            <div className="flex-1 relative min-h-[340px] sm:min-h-[460px]">
              {effectiveBoardMode === '3d' ? (
                <div className="w-full h-[500px] lg:h-[540px] relative">
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
                  onSwitchTo3D={() => setDesktopBoardMode('3d')}
                />
              )}

              {/* Local / Bot Game Over Overlay Banner */}
              {(activeTab === 'local' || activeTab === 'bot') &&
                (localEval.isAutomaticGameOver || Boolean(localClaimedDraw)) && (
                  <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md p-4 rounded-xl bg-[#291C0E] text-[#E1D4C2] border-2 border-[#E1D4C2] shadow-2xl flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-[#E1D4C2] font-serif">
                        {localClaimedDraw
                          ? 'Pertandingan Remis (Klaim Pemain)'
                          : localEval.isCheckmate
                          ? `Skakmat! ${
                              localEval.winnerColor === 'w' ? 'Putih' : 'Hitam'
                            } Menang`
                          : 'Pertandingan Berakhir Remis'}
                      </div>
                      <div className="text-xs text-[#BEB5A9] mt-0.5">
                        {localClaimedDraw ||
                          (localEval.terminationReason === 'checkmate'
                            ? `Skor Akhir: ${localEval.result}`
                            : `Alasan: ${localEval.terminationReason}`)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        activeTab === 'bot'
                          ? handleStartBotGame(botPlayerColor)
                          : handleLoadLocalPreset(RULE_TEST_PRESETS[0])
                      }
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-[#E1D4C2] text-[#291C0E] hover:bg-[#BEB5A9] transition-colors whitespace-nowrap shrink-0"
                    >
                      Main Lagi
                    </button>
                  </div>
                )}
            </div>
          </div>

          {/* Bottom Bar: Active Player Info & Clock */}
          <PlayerClockBar {...getPlayerBarProps(bottomBarColor)} />

          {/* Compact User Guide Panel on Main Screen */}
          <QuickGuideCard
            themeMode={themeMode}
            isDesktopViewport={isDesktopViewport}
            effectiveBoardMode={effectiveBoardMode}
            onOpenModal={() => setShowGuideModal(true)}
          />
        </div>

        {/* RIGHT SIDEBAR: Mode Switcher, Bot AI / Multiplayer / Local Controls, & Move History (4 cols on desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          {/* 3-Mode Segmented Control */}
          <div
            className={`grid grid-cols-3 gap-1.5 p-1.5 rounded-xl border-2 shrink-0 ${
              isLight
                ? 'bg-[#BEB5A9] border-[#A78D78]'
                : 'bg-[#6E473B] border-[#A78D78]'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab('bot')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'bot'
                  ? isLight
                    ? 'bg-[#6E473B] text-[#E1D4C2] border border-[#291C0E]'
                    : 'bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]'
                  : isLight
                  ? 'text-[#291C0E] hover:bg-[#A78D78]'
                  : 'text-[#E1D4C2] hover:bg-[#291C0E]'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Bot AI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('multiplayer')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'multiplayer'
                  ? isLight
                    ? 'bg-[#6E473B] text-[#E1D4C2] border border-[#291C0E]'
                    : 'bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]'
                  : isLight
                  ? 'text-[#291C0E] hover:bg-[#A78D78]'
                  : 'text-[#E1D4C2] hover:bg-[#291C0E]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Multiplayer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('local')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'local'
                  ? isLight
                    ? 'bg-[#6E473B] text-[#E1D4C2] border border-[#291C0E]'
                    : 'bg-[#E1D4C2] text-[#291C0E] border border-[#BEB5A9]'
                  : isLight
                  ? 'text-[#291C0E] hover:bg-[#A78D78]'
                  : 'text-[#E1D4C2] hover:bg-[#291C0E]'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Latihan</span>
            </button>
          </div>

          {/* Conditional Context Card: Bot AI Mode OR Local Presets OR Multiplayer Room */}
          {activeTab === 'bot' ? (
            <div
              className={`rounded-xl border-2 p-4 flex flex-col gap-3 shrink-0 transition-colors ${
                isLight
                  ? 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E]'
                  : 'bg-[#6E473B] border-[#A78D78] text-[#E1D4C2]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#A78D78] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#291C0E] text-[#E1D4C2] border border-[#A78D78] flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold font-serif">
                      Lawan Bot AI
                    </h3>
                    <p
                      className={`text-[11px] ${
                        isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
                      }`}
                    >
                      Pilih tingkat kesulitan & minta saran langkah
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#291C0E] text-[#E1D4C2] text-xs font-mono font-bold tabular-nums">
                  ELO ~{BOT_DIFFICULTY_PRESETS[botDifficulty].eloEstimate}
                </span>
              </div>

              {/* 5 Difficulty Levels */}
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Tingkat Kesulitan AI
                </label>
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
                        className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                          active
                            ? isLight
                              ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E] font-bold'
                              : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                            : isLight
                            ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78] hover:bg-[#A78D78]'
                            : 'bg-[#291C0E] text-[#BEB5A9] border-[#A78D78] hover:text-[#E1D4C2]'
                        }`}
                      >
                        {labels[diffId]}
                      </button>
                    );
                  })}
                </div>
                <p
                  className={`text-[11px] mt-1.5 leading-relaxed ${
                    isLight ? 'text-[#291C0E]' : 'text-[#E1D4C2]'
                  }`}
                >
                  <strong>{BOT_DIFFICULTY_PRESETS[botDifficulty].name}:</strong>{' '}
                  {BOT_DIFFICULTY_PRESETS[botDifficulty].description}
                </p>
              </div>

              {/* Start New Game as White / Black / Random + Hint Button */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStartBotGame('w')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                    botPlayerColor === 'w'
                      ? isLight
                        ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B] font-bold'
                        : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                      : isLight
                      ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78]'
                      : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78]'
                  }`}
                >
                  Putih
                </button>
                <button
                  type="button"
                  onClick={() => handleStartBotGame('b')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                    botPlayerColor === 'b'
                      ? isLight
                        ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B] font-bold'
                        : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                      : isLight
                      ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78]'
                      : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78]'
                  }`}
                >
                  Hitam
                </button>
                <button
                  type="button"
                  onClick={() => handleStartBotGame('random')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                    isLight
                      ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78] hover:bg-[#A78D78]'
                      : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
                  }`}
                >
                  Acak
                </button>
                <button
                  type="button"
                  disabled={botThinking || hintLoading || localEval.isAutomaticGameOver}
                  onClick={handleRequestHint}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold bg-[#6E473B] text-[#E1D4C2] border border-[#291C0E] hover:bg-[#291C0E] disabled:opacity-40 transition-colors whitespace-nowrap"
                  title="Tampilkan Saran Langkah Terbaik"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Hint</span>
                </button>
              </div>

              {/* Tactical Hint Explanation Card */}
              {hintResult && (
                <div
                  className={`p-3 rounded-lg border-2 text-xs flex flex-col gap-1.5 ${
                    isLight
                      ? 'bg-[#E1D4C2] border-[#6E473B] text-[#291C0E]'
                      : 'bg-[#291C0E] border-[#E1D4C2] text-[#E1D4C2]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      Saran Taktis: {hintResult.san} ({hintResult.from} → {hintResult.to})
                    </span>
                    <button
                      type="button"
                      onClick={() => executeValidatedMove(hintResult.from, hintResult.to)}
                      className="px-2.5 py-1 rounded-md bg-[#6E473B] text-[#E1D4C2] border border-[#E1D4C2] font-bold text-[11px] hover:bg-[#A78D78] hover:text-[#291C0E] whitespace-nowrap"
                    >
                      Jalankan
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {hintResult.explanation}
                  </p>
                </div>
              )}
            </div>
          ) : activeTab === 'local' ? (
            <div
              className={`rounded-xl border-2 p-4 shrink-0 transition-colors ${
                isLight
                  ? 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E]'
                  : 'bg-[#6E473B] border-[#A78D78] text-[#E1D4C2]'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#A78D78]">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  <h3 className="text-sm font-bold font-serif">
                    Latihan & Uji Aturan Catur
                  </h3>
                </div>

                <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoFlipLocal}
                    onChange={(e) => setAutoFlipLocal(e.target.checked)}
                    className="rounded border-[#291C0E]"
                  />
                  <span>Putar Otomatis</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {RULE_TEST_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleLoadLocalPreset(preset)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                      activePresetId === preset.id
                        ? isLight
                          ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E] font-bold'
                          : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                        : isLight
                        ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78] hover:bg-[#A78D78]'
                        : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <p
                className={`text-xs mt-2.5 leading-relaxed ${
                  isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
                }`}
              >
                {RULE_TEST_PRESETS.find((p) => p.id === activePresetId)?.description}
              </p>
            </div>
          ) : (
            <div className="shrink-0">
              <RoomLobbyAndChatPanel
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
            </div>
          )}

          {/* Algebraic Move History & Resign/Draw/Undo Panel */}
          <div className="flex-1 min-h-[240px]">
            <MoveHistoryPanel
              moves={currentMoves}
              fen={currentFen}
              pgn={currentPgn}
              mode={isMultiplayerView ? 'multiplayer' : 'local'}
              isGameActive={
                isMultiplayerView
                  ? activeRoom?.status === 'active'
                  : !localEval.isAutomaticGameOver && !localClaimedDraw
              }
              canUndo={!isMultiplayerView && localMoves.length > 0 && !botThinking}
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
              drawOfferBy={isMultiplayerView && activeRoom ? activeRoom.drawOfferBy : null}
              myColor={isMultiplayerView ? myRole : currentTurn}
              onOfferDraw={handleOfferDraw}
              onRespondDraw={handleRespondDraw}
              onResign={handleResign}
              themeMode={themeMode}
            />
          </div>
        </div>
      </main>

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

      {/* Step-by-Step Interactive User Guide Modal */}
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
