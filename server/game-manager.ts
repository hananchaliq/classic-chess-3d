import { Chess } from 'chess.js';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  CaptureDuelEvent,
  ChatMessageItem,
  ClockSnapshot,
  GameResult,
  GameTerminationReason,
  MoveRecord,
  PieceColor,
  PieceSymbol,
  PublicPlayerSeat,
  RoomJoinedResponse,
  RoomStateSnapshot,
  RoomStatus,
  RoomVisibility,
  TimeControlPreset,
  YourRoleInRoom,
} from '../types/chess.ts';
import { TIME_CONTROL_PRESETS } from '../types/chess.ts';
import { evaluateChessInstance, INITIAL_FEN } from '../lib/chess-rules.ts';

interface InternalPlayerSeat {
  sessionToken: string;
  playerId: string;
  socketId: string | null;
  displayName: string;
  color: PieceColor;
  connected: boolean;
  ready: boolean;
  rating: number;
  disconnectedAt: number | null;
}

interface InternalRoomState {
  roomCode: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  timeControl: TimeControlPreset;
  chess: Chess;
  whiteSeat: InternalPlayerSeat | null;
  blackSeat: InternalPlayerSeat | null;
  spectatorSockets: Set<string>;
  moveHistory: MoveRecord[];
  lastMove: { from: string; to: string } | null;
  lastCaptureDuel: CaptureDuelEvent | null;
  drawOfferBy: PieceColor | null;
  result: GameResult;
  winnerColor: PieceColor | null;
  terminationReason: GameTerminationReason;
  whiteMs: number;
  blackMs: number;
  incrementMs: number;
  isUnlimited: boolean;
  lastClockUpdateAt: number;
  chatMessages: ChatMessageItem[];
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ABANDON_TIMEOUT_MS = 90 * 1000; // 90s grace period for reconnecting
const TMP_STORE_PATH = path.join(os.tmpdir(), 'classic_chess_3d_rooms_v1.json');

export class GameRoomManager {
  private rooms = new Map<string, InternalRoomState>();
  private socketToRoom = new Map<string, { roomCode: string; sessionToken: string }>();
  private chatRateMap = new Map<string, number[]>();

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 20; attempt++) {
      let code = '';
      const bytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) {
        code += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
      }
      if (!this.rooms.has(code)) {
        return code;
      }
    }
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  private generatePlayerId(sessionToken: string): string {
    return 'plr_' + crypto.createHash('sha256').update(sessionToken).digest('hex').slice(0, 10);
  }

  private sanitizeName(raw: string, fallback: string): string {
    const cleaned = raw.replace(/[<>]/g, '').trim().slice(0, 24);
    return cleaned.length >= 2 ? cleaned : fallback;
  }

  private addSystemMessage(room: InternalRoomState, text: string): ChatMessageItem {
    const msg: ChatMessageItem = {
      id: 'msg_' + crypto.randomBytes(6).toString('hex'),
      senderId: 'system',
      senderName: 'Sistem Klub',
      senderColor: 'system',
      message: text,
      timestamp: Date.now(),
    };
    room.chatMessages.push(msg);
    if (room.chatMessages.length > 100) {
      room.chatMessages.shift();
    }
    return msg;
  }

  private updateLiveClocks(room: InternalRoomState, now = Date.now()): boolean {
    if (room.status !== 'active' || room.isUnlimited) {
      room.lastClockUpdateAt = now;
      return false;
    }

    const elapsed = Math.max(0, now - room.lastClockUpdateAt);
    room.lastClockUpdateAt = now;

    const turn = room.chess.turn() as PieceColor;
    if (turn === 'w') {
      room.whiteMs = Math.max(0, room.whiteMs - elapsed);
      if (room.whiteMs <= 0) {
        this.finishGame(room, '0-1', 'b', 'timeout', 'Waktu Putih habis. Hitam menang!');
        return true;
      }
    } else {
      room.blackMs = Math.max(0, room.blackMs - elapsed);
      if (room.blackMs <= 0) {
        this.finishGame(room, '1-0', 'w', 'timeout', 'Waktu Hitam habis. Putih menang!');
        return true;
      }
    }
    return false;
  }

  private finishGame(
    room: InternalRoomState,
    result: GameResult,
    winnerColor: PieceColor | null,
    reason: GameTerminationReason,
    systemNote: string
  ): void {
    if (room.status === 'finished' || room.status === 'abandoned') return;
    room.status = 'finished';
    room.result = result;
    room.winnerColor = winnerColor;
    room.terminationReason = reason;
    room.drawOfferBy = null;
    room.finishedAt = Date.now();
    this.addSystemMessage(room, systemNote);
  }

  public toPublicSeat(seat: InternalPlayerSeat | null): PublicPlayerSeat | null {
    if (!seat) return null;
    return {
      playerId: seat.playerId,
      displayName: seat.displayName,
      color: seat.color,
      connected: seat.connected,
      ready: seat.ready,
      rating: seat.rating,
    };
  }

  public getClockSnapshot(room: InternalRoomState): ClockSnapshot {
    return {
      whiteMs: Math.round(room.whiteMs),
      blackMs: Math.round(room.blackMs),
      incrementMs: room.incrementMs,
      activeColor: room.status === 'active' ? (room.chess.turn() as PieceColor) : null,
      isUnlimited: room.isUnlimited,
      serverTimestamp: Date.now(),
    };
  }

  public toSnapshot(room: InternalRoomState): RoomStateSnapshot {
    const evalState = evaluateChessInstance(room.chess);
    return {
      roomCode: room.roomCode,
      status: room.status,
      visibility: room.visibility,
      timeControl: room.timeControl,
      whitePlayer: this.toPublicSeat(room.whiteSeat),
      blackPlayer: this.toPublicSeat(room.blackSeat),
      spectatorCount: room.spectatorSockets.size,
      fen: room.chess.fen(),
      pgn: room.chess.pgn(),
      turn: evalState.turn,
      ply: room.moveHistory.length,
      moveHistory: room.moveHistory,
      lastMove: room.lastMove,
      lastCaptureDuel: room.lastCaptureDuel,
      inCheck: evalState.inCheck,
      kingSquareInCheck: evalState.kingSquareInCheck,
      isCheckmate: evalState.isCheckmate,
      isStalemate: evalState.isStalemate,
      isInsufficientMaterial: evalState.isInsufficientMaterial,
      canClaimThreefold: evalState.canClaimThreefold,
      canClaimFiftyMoves: evalState.canClaimFiftyMoves,
      result: room.result,
      winnerColor: room.winnerColor,
      terminationReason: room.terminationReason,
      drawOfferBy: room.drawOfferBy,
      clocks: this.getClockSnapshot(room),
      chatMessages: room.chatMessages,
      createdAt: room.createdAt,
      startedAt: room.startedAt,
      finishedAt: room.finishedAt,
    };
  }

  public createRoom(params: {
    socketId: string;
    sessionToken: string;
    playerName: string;
    timeControl: TimeControlPreset;
    preferredColor: 'w' | 'b' | 'random';
    visibility?: RoomVisibility;
  }): RoomJoinedResponse {
    this.hydrateFromTmpIfNeeded();
    const preset = TIME_CONTROL_PRESETS[params.timeControl] || TIME_CONTROL_PRESETS['5+0'];
    const roomCode = this.generateRoomCode();
    const assignedColor: PieceColor =
      params.preferredColor === 'random'
        ? Math.random() < 0.5
          ? 'w'
          : 'b'
        : params.preferredColor;

    const playerId = this.generatePlayerId(params.sessionToken);
    const displayName = this.sanitizeName(params.playerName, 'Pemain 1');
    const visibility: RoomVisibility = params.visibility || 'public';

    const seat: InternalPlayerSeat = {
      sessionToken: params.sessionToken,
      playerId,
      socketId: params.socketId,
      displayName,
      color: assignedColor,
      connected: true,
      ready: true,
      rating: 1200,
      disconnectedAt: null,
    };

    const now = Date.now();
    const chess = new Chess(INITIAL_FEN);

    const room: InternalRoomState = {
      roomCode,
      status: 'waiting',
      visibility,
      timeControl: preset.id,
      chess,
      whiteSeat: assignedColor === 'w' ? seat : null,
      blackSeat: assignedColor === 'b' ? seat : null,
      spectatorSockets: new Set(),
      moveHistory: [],
      lastMove: null,
      lastCaptureDuel: null,
      drawOfferBy: null,
      result: null,
      winnerColor: null,
      terminationReason: null,
      whiteMs: preset.initialMs,
      blackMs: preset.initialMs,
      incrementMs: preset.incrementMs,
      isUnlimited: preset.isUnlimited,
      lastClockUpdateAt: now,
      chatMessages: [],
      createdAt: now,
      startedAt: null,
      finishedAt: null,
    };

    this.addSystemMessage(
      room,
      `Room ${roomCode} (${visibility === 'private' ? 'Privat' : 'Publik'}) dibuat oleh ${displayName} (${preset.label}). Menunggu lawan bergabung.`
    );

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(params.socketId, {
      roomCode,
      sessionToken: params.sessionToken,
    });
    this.persistToTmp();

    return {
      ok: true,
      room: this.toSnapshot(room),
      yourRole: assignedColor,
      playerId,
    };
  }

  public joinRoom(params: {
    socketId: string;
    sessionToken: string;
    roomCode: string;
    playerName: string;
  }): RoomJoinedResponse & { reconnected?: boolean; autoStarted?: boolean } {
    this.hydrateFromTmpIfNeeded();
    const normalizedCode = params.roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      return {
        ok: false,
        error: `Room dengan kode "${normalizedCode}" tidak ditemukan atau sudah ditutup.`,
      };
    }

    this.updateLiveClocks(room);
    const playerId = this.generatePlayerId(params.sessionToken);

    // 1. Check if this sessionToken is reconnecting to an existing seat
    if (room.whiteSeat && room.whiteSeat.sessionToken === params.sessionToken) {
      room.whiteSeat.socketId = params.socketId;
      room.whiteSeat.connected = true;
      room.whiteSeat.disconnectedAt = null;
      if (params.playerName.trim()) {
        room.whiteSeat.displayName = this.sanitizeName(
          params.playerName,
          room.whiteSeat.displayName
        );
      }
      this.socketToRoom.set(params.socketId, {
        roomCode: normalizedCode,
        sessionToken: params.sessionToken,
      });
      this.persistToTmp();
      return {
        ok: true,
        room: this.toSnapshot(room),
        yourRole: 'w',
        playerId,
        reconnected: true,
      };
    }

    if (room.blackSeat && room.blackSeat.sessionToken === params.sessionToken) {
      room.blackSeat.socketId = params.socketId;
      room.blackSeat.connected = true;
      room.blackSeat.disconnectedAt = null;
      if (params.playerName.trim()) {
        room.blackSeat.displayName = this.sanitizeName(
          params.playerName,
          room.blackSeat.displayName
        );
      }
      this.socketToRoom.set(params.socketId, {
        roomCode: normalizedCode,
        sessionToken: params.sessionToken,
      });
      this.persistToTmp();
      return {
        ok: true,
        room: this.toSnapshot(room),
        yourRole: 'b',
        playerId,
        reconnected: true,
      };
    }

    // 2. If room is waiting and has an open seat, assign second player
    if (room.status === 'waiting' && (!room.whiteSeat || !room.blackSeat)) {
      const openColor: PieceColor = !room.whiteSeat ? 'w' : 'b';
      const displayName = this.sanitizeName(
        params.playerName,
        openColor === 'w' ? 'Pemain Putih' : 'Pemain Hitam'
      );

      const newSeat: InternalPlayerSeat = {
        sessionToken: params.sessionToken,
        playerId,
        socketId: params.socketId,
        displayName,
        color: openColor,
        connected: true,
        ready: false,
        rating: 1200,
        disconnectedAt: null,
      };

      if (openColor === 'w') {
        room.whiteSeat = newSeat;
      } else {
        room.blackSeat = newSeat;
      }

      this.addSystemMessage(
        room,
        `${displayName} bergabung sebagai ${openColor === 'w' ? 'Putih' : 'Hitam'}. Tekan "Siap Mulai" untuk memulai pertandingan!`
      );

      this.socketToRoom.set(params.socketId, {
        roomCode: normalizedCode,
        sessionToken: params.sessionToken,
      });
      this.persistToTmp();

      return {
        ok: true,
        room: this.toSnapshot(room),
        yourRole: openColor,
        playerId,
      };
    }

    // 3. Otherwise join as Spectator
    room.spectatorSockets.add(params.socketId);
    this.socketToRoom.set(params.socketId, {
      roomCode: normalizedCode,
      sessionToken: params.sessionToken,
    });
    this.persistToTmp();

    return {
      ok: true,
      room: this.toSnapshot(room),
      yourRole: 'spectator',
      playerId,
    };
  }

  public setPlayerReady(params: {
    roomCode: string;
    sessionToken: string;
  }): { ok: boolean; error?: string; started?: boolean; room?: RoomStateSnapshot } {
    this.hydrateFromTmpIfNeeded();
    const room = this.rooms.get(params.roomCode.toUpperCase());
    if (!room) {
      return { ok: false, error: 'Room tidak ditemukan.' };
    }

    let seat: InternalPlayerSeat | null = null;
    if (room.whiteSeat?.sessionToken === params.sessionToken) {
      seat = room.whiteSeat;
    } else if (room.blackSeat?.sessionToken === params.sessionToken) {
      seat = room.blackSeat;
    }

    if (!seat) {
      return { ok: false, error: 'Hanya pemain di kursi Putih/Hitam yang dapat mengubah status siap.' };
    }

    seat.ready = true;

    let started = false;
    if (
      room.status === 'waiting' &&
      room.whiteSeat &&
      room.blackSeat &&
      room.whiteSeat.ready &&
      room.blackSeat.ready
    ) {
      room.status = 'active';
      room.startedAt = Date.now();
      room.lastClockUpdateAt = Date.now();
      started = true;
      this.addSystemMessage(
        room,
        `Pertandingan dimulai! ${room.whiteSeat.displayName} (Putih) vs ${room.blackSeat.displayName} (Hitam).`
      );
    }

    this.persistToTmp();
    return {
      ok: true,
      started,
      room: this.toSnapshot(room),
    };
  }

  public makeMove(params: {
    roomCode: string;
    sessionToken: string;
    from: string;
    to: string;
    promotion?: PieceSymbol;
    ply?: number;
  }): {
    ok: boolean;
    error?: string;
    room?: RoomStateSnapshot;
    move?: MoveRecord;
    gameFinished?: boolean;
  } {
    this.hydrateFromTmpIfNeeded();
    const room = this.rooms.get(params.roomCode.toUpperCase());
    if (!room) {
      return { ok: false, error: 'Room tidak ditemukan.' };
    }

    if (room.status !== 'active') {
      return { ok: false, error: 'Pertandingan belum dimulai atau sudah berakhir.' };
    }

    // Update server clock first; check if active player ran out of time
    const timedOut = this.updateLiveClocks(room);
    if (timedOut) {
      this.persistToTmp();
      return {
        ok: false,
        error: 'Waktu habis sebelum langkah diterima.',
        room: this.toSnapshot(room),
        gameFinished: true,
      };
    }

    const currentTurn = room.chess.turn() as PieceColor;
    const expectedSeat = currentTurn === 'w' ? room.whiteSeat : room.blackSeat;

    if (!expectedSeat || expectedSeat.sessionToken !== params.sessionToken) {
      return {
        ok: false,
        error: 'Bukan giliran Anda atau Anda tidak memiliki otorisasi kursi ini.',
      };
    }

    // Idempotency guard: if client sends expected ply and it doesn't match server ply
    if (typeof params.ply === 'number' && params.ply !== room.moveHistory.length) {
      return {
        ok: false,
        error: 'Langkah sudah diproses atau tidak sinkron dengan urutan server.',
        room: this.toSnapshot(room),
      };
    }

    const now = Date.now();
    let moveObj;
    try {
      moveObj = room.chess.move({
        from: params.from,
        to: params.to,
        promotion: params.promotion || 'q',
      });
    } catch {
      return {
        ok: false,
        error: `Langkah ${params.from} ke ${params.to} tidak legal menurut aturan catur.`,
      };
    }

    if (!moveObj) {
      return {
        ok: false,
        error: 'Langkah tidak legal.',
      };
    }

    // Clear any pending draw offer when a move is made
    room.drawOfferBy = null;

    // Apply time increment if game is still continuing
    const evalAfter = evaluateChessInstance(room.chess);
    if (!room.isUnlimited && !evalAfter.isAutomaticGameOver) {
      if (currentTurn === 'w') {
        room.whiteMs += room.incrementMs;
      } else {
        room.blackMs += room.incrementMs;
      }
    }
    room.lastClockUpdateAt = now;

    const ply = room.moveHistory.length + 1;
    const moveRecord: MoveRecord = {
      ply,
      moveNumber: Math.ceil(ply / 2),
      color: currentTurn,
      from: moveObj.from,
      to: moveObj.to,
      san: moveObj.san,
      uci: `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}`,
      piece: moveObj.piece as PieceSymbol,
      captured: moveObj.captured as PieceSymbol | undefined,
      promotion: moveObj.promotion as PieceSymbol | undefined,
      fenAfter: room.chess.fen(),
      elapsedMs: 0,
      timestamp: now,
    };

    room.moveHistory.push(moveRecord);
    room.lastMove = { from: moveObj.from, to: moveObj.to };

    if (moveObj.captured) {
      room.lastCaptureDuel = {
        id: `duel_${room.roomCode}_${ply}_${now}`,
        from: moveObj.from,
        to: moveObj.to,
        attackerType: moveObj.piece as PieceSymbol,
        attackerColor: currentTurn,
        defenderType: moveObj.captured as PieceSymbol,
        defenderColor: currentTurn === 'w' ? 'b' : 'w',
        isEnPassant: moveObj.flags.includes('e'),
        isCheckmate: evalAfter.isCheckmate,
        timestamp: now,
      };
    } else {
      room.lastCaptureDuel = null;
    }

    let gameFinished = false;
    if (evalAfter.isAutomaticGameOver) {
      gameFinished = true;
      const reasonMap: Record<string, string> = {
        checkmate: `Skakmat! ${currentTurn === 'w' ? 'Putih' : 'Hitam'} menang.`,
        stalemate: 'Pertandingan berakhir remis karena Stalemate.',
        insufficient_material: 'Pertandingan berakhir remis karena material tidak mencukupi.',
        seventy_five_move_rule: 'Pertandingan berakhir remis otomatis (Aturan 75 langkah).',
      };
      this.finishGame(
        room,
        evalAfter.result,
        evalAfter.winnerColor,
        evalAfter.terminationReason,
        reasonMap[evalAfter.terminationReason || ''] || 'Pertandingan berakhir.'
      );
    }

    this.persistToTmp();
    return {
      ok: true,
      room: this.toSnapshot(room),
      move: moveRecord,
      gameFinished,
    };
  }

  public offerDraw(params: {
    roomCode: string;
    sessionToken: string;
  }): { ok: boolean; error?: string; room?: RoomStateSnapshot } {
    this.hydrateFromTmpIfNeeded();
    const room = this.rooms.get(params.roomCode.toUpperCase());
    if (!room || room.status !== 'active') {
      return { ok: false, error: 'Pertandingan tidak aktif.' };
    }

    let color: PieceColor | null = null;
    let playerName = '';
    if (room.whiteSeat?.sessionToken === params.sessionToken) {
      color = 'w';
      playerName = room.whiteSeat.displayName;
    } else if (room.blackSeat?.sessionToken === params.sessionToken) {
      color = 'b';
      playerName = room.blackSeat.displayName;
    }

    if (!color) {
      return { ok: false, error: 'Bukan pemain aktif.' };
    }

    room.drawOfferBy = color;
    this.addSystemMessage(room, `${playerName} menawarkan remis (Draw).`);
    this.persistToTmp();
    return { ok: true, room: this.toSnapshot(room) };
  }

  public respondDraw(params: {
    roomCode: string;
    sessionToken: string;
    accept: boolean;
  }): { ok: boolean; error?: string; room?: RoomStateSnapshot; gameFinished?: boolean } {
    this.hydrateFromTmpIfNeeded();
    const room = this.rooms.get(params.roomCode.toUpperCase());
    if (!room || room.status !== 'active' || !room.drawOfferBy) {
      return { ok: false, error: 'Tidak ada tawaran remis yang aktif.' };
    }

    let responderColor: PieceColor | null = null;
    let responderName = '';
    if (room.whiteSeat?.sessionToken === params.sessionToken) {
      responderColor = 'w';
      responderName = room.whiteSeat.displayName;
    } else if (room.blackSeat?.sessionToken === params.sessionToken) {
      responderColor = 'b';
      responderName = room.blackSeat.displayName;
    }

    if (!responderColor || responderColor === room.drawOfferBy) {
      return { ok: false, error: 'Hanya lawan yang dapat merespons tawaran remis.' };
    }

    if (params.accept) {
      this.finishGame(
        room,
        '1/2-1/2',
        null,
        'draw_agreement',
        `Remis disepakati oleh kedua pemain (${responderName} menerima tawaran).`
      );
      this.persistToTmp();
      return { ok: true, room: this.toSnapshot(room), gameFinished: true };
    } else {
      room.drawOfferBy = null;
      this.addSystemMessage(room, `${responderName} menolak tawaran remis.`);
      this.persistToTmp();
      return { ok: true, room: this.toSnapshot(room), gameFinished: false };
    }
  }

  public claimDraw(params: {
    roomCode: string;
    sessionToken: string;
  }): { ok: boolean; error?: string; room?: RoomStateSnapshot; gameFinished?: boolean } {
    this.hydrateFromTmpIfNeeded();
    const room = this.rooms.get(params.roomCode.toUpperCase());
    if (!room || room.status !== 'active') {
      return { ok: false, error: 'Pertandingan tidak aktif.' };
    }

    const isPlayer =
      room.whiteSeat?.sessionToken === params.sessionToken ||
      room.blackSeat?.sessionToken === params.sessionToken;
    if (!isPlayer) {
      return { ok: false, error: 'Hanya pemain yang dapat mengklaim remis.' };
    }

    const evalState = evaluateChessInstance(room.chess);
    if (evalState.canClaimThreefold) {
      this.finishGame(
        room,
        '1/2-1/2',
        null,
        'threefold_repetition',
        'Pertandingan berakhir remis melalui klaim Pengulangan Tiga Kali (Threefold Repetition).'
      );
      this.persistToTmp();
      return { ok: true, room: this.toSnapshot(room), gameFinished: true };
    }

    if (evalState.canClaimFiftyMoves) {
      this.finishGame(
        room,
        '1/2-1/2',
        null,
        'fifty_move_rule',
        'Pertandingan berakhir remis melalui klaim Aturan 50 Langkah.'
      );
      this.persistToTmp();
      return { ok: true, room: this.toSnapshot(room), gameFinished: true };
    }

    return {
      ok: false,
      error: 'Syarat klaim remis (pengulangan 3 kali atau aturan 50 langkah) belum terpenuhi.',
    };
  }

  public resignGame(params: {
    roomCode: string;
    sessionToken: string;
  }): { ok: boolean; error?: string; room?: RoomStateSnapshot; gameFinished?: boolean } {
    this.hydrateFromTmpIfNeeded();
    const room = this.rooms.get(params.roomCode.toUpperCase());
    if (!room || room.status !== 'active') {
      return { ok: false, error: 'Pertandingan tidak aktif.' };
    }

    let resignColor: PieceColor | null = null;
    let resignName = '';
    if (room.whiteSeat?.sessionToken === params.sessionToken) {
      resignColor = 'w';
      resignName = room.whiteSeat.displayName;
    } else if (room.blackSeat?.sessionToken === params.sessionToken) {
      resignColor = 'b';
      resignName = room.blackSeat.displayName;
    }

    if (!resignColor) {
      return { ok: false, error: 'Bukan pemain aktif.' };
    }

    const winnerColor: PieceColor = resignColor === 'w' ? 'b' : 'w';
    const result: GameResult = winnerColor === 'w' ? '1-0' : '0-1';

    this.finishGame(
      room,
      result,
      winnerColor,
      'resignation',
      `${resignName} (${resignColor === 'w' ? 'Putih' : 'Hitam'}) menyerah. ${
        winnerColor === 'w' ? 'Putih' : 'Hitam'
      } menang!`
    );

    this.persistToTmp();
    return { ok: true, room: this.toSnapshot(room), gameFinished: true };
  }

  public requestRematch(params: {
    roomCode: string;
    sessionToken: string;
  }): { ok: boolean; error?: string; room?: RoomStateSnapshot } {
    this.hydrateFromTmpIfNeeded();
    const room = this.rooms.get(params.roomCode.toUpperCase());
    if (!room) {
      return { ok: false, error: 'Room tidak ditemukan.' };
    }

    const isPlayer =
      room.whiteSeat?.sessionToken === params.sessionToken ||
      room.blackSeat?.sessionToken === params.sessionToken;
    if (!isPlayer) {
      return { ok: false, error: 'Hanya pemain yang dapat memulai tanding ulang.' };
    }

    if (room.status !== 'finished' && room.status !== 'abandoned') {
      return { ok: false, error: 'Pertandingan masih berlangsung.' };
    }

    // Swap colors for fairness on rematch if both seats exist
    const oldWhite = room.whiteSeat;
    const oldBlack = room.blackSeat;
    if (oldWhite && oldBlack) {
      oldWhite.color = 'b';
      oldBlack.color = 'w';
      room.whiteSeat = oldBlack;
      room.blackSeat = oldWhite;
    }

    const preset = TIME_CONTROL_PRESETS[room.timeControl] || TIME_CONTROL_PRESETS['5+0'];
    room.chess = new Chess(INITIAL_FEN);
    room.moveHistory = [];
    room.lastMove = null;
    room.lastCaptureDuel = null;
    room.drawOfferBy = null;
    room.result = null;
    room.winnerColor = null;
    room.terminationReason = null;
    room.whiteMs = preset.initialMs;
    room.blackMs = preset.initialMs;
    room.lastClockUpdateAt = Date.now();
    room.startedAt = Date.now();
    room.finishedAt = null;
    room.status = room.whiteSeat && room.blackSeat ? 'active' : 'waiting';

    this.addSystemMessage(room, 'Pertandingan baru dimulai dengan pertukaran warna sisi!');
    this.persistToTmp();
    return { ok: true, room: this.toSnapshot(room) };
  }

  public cancelWaitingRoom(params: {
    roomCode: string;
    sessionToken: string;
  }): { ok: boolean; error?: string } {
    this.hydrateFromTmpIfNeeded();
    const code = params.roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: 'Room tidak ditemukan.' };
    }

    const isHost =
      room.whiteSeat?.sessionToken === params.sessionToken ||
      room.blackSeat?.sessionToken === params.sessionToken;
    if (!isHost) {
      return { ok: false, error: 'Hanya pembuat room yang dapat membatalkan room.' };
    }

    this.rooms.delete(code);
    this.persistToTmp();
    return { ok: true };
  }

  public sendChatMessage(params: {
    roomCode: string;
    sessionToken: string;
    message: string;
  }): { ok: boolean; error?: string; chatItem?: ChatMessageItem } {
    this.hydrateFromTmpIfNeeded();
    const room = this.rooms.get(params.roomCode.toUpperCase());
    if (!room) {
      return { ok: false, error: 'Room tidak ditemukan.' };
    }

    const trimmed = params.message.replace(/[<>]/g, '').trim();
    if (!trimmed) {
      return { ok: false, error: 'Pesan tidak boleh kosong.' };
    }
    if (trimmed.length > 240) {
      return { ok: false, error: 'Pesan terlalu panjang (maksimal 240 karakter).' };
    }

    // Rate limiting: max 5 messages per 5 seconds per sessionToken
    const now = Date.now();
    const recent = (this.chatRateMap.get(params.sessionToken) || []).filter(
      (t) => now - t < 5000
    );
    if (recent.length >= 5) {
      return { ok: false, error: 'Terlalu banyak pesan. Mohon tunggu beberapa detik.' };
    }
    recent.push(now);
    this.chatRateMap.set(params.sessionToken, recent);

    let senderName = 'Penonton';
    let senderColor: PieceColor | 'system' = 'system';
    const senderId = this.generatePlayerId(params.sessionToken);

    if (room.whiteSeat?.sessionToken === params.sessionToken) {
      senderName = room.whiteSeat.displayName;
      senderColor = 'w';
    } else if (room.blackSeat?.sessionToken === params.sessionToken) {
      senderName = room.blackSeat.displayName;
      senderColor = 'b';
    }

    const item: ChatMessageItem = {
      id: 'msg_' + crypto.randomBytes(6).toString('hex'),
      senderId,
      senderName,
      senderColor,
      message: trimmed,
      timestamp: now,
    };

    room.chatMessages.push(item);
    if (room.chatMessages.length > 100) {
      room.chatMessages.shift();
    }

    this.persistToTmp();
    return { ok: true, chatItem: item };
  }

  public handleDisconnect(socketId: string): {
    roomCode?: string;
    disconnectedColor?: PieceColor;
    playerName?: string;
    room?: RoomStateSnapshot;
  } {
    const mapping = this.socketToRoom.get(socketId);
    if (!mapping) return {};
    this.socketToRoom.delete(socketId);

    const room = this.rooms.get(mapping.roomCode);
    if (!room) return {};

    if (room.spectatorSockets.has(socketId)) {
      room.spectatorSockets.delete(socketId);
      return { roomCode: room.roomCode, room: this.toSnapshot(room) };
    }

    if (room.whiteSeat?.socketId === socketId) {
      room.whiteSeat.connected = false;
      room.whiteSeat.socketId = null;
      room.whiteSeat.disconnectedAt = Date.now();
      return {
        roomCode: room.roomCode,
        disconnectedColor: 'w',
        playerName: room.whiteSeat.displayName,
        room: this.toSnapshot(room),
      };
    }

    if (room.blackSeat?.socketId === socketId) {
      room.blackSeat.connected = false;
      room.blackSeat.socketId = null;
      room.blackSeat.disconnectedAt = Date.now();
      return {
        roomCode: room.roomCode,
        disconnectedColor: 'b',
        playerName: room.blackSeat.displayName,
        room: this.toSnapshot(room),
      };
    }

    return {};
  }

  public tickActiveRooms(): Array<{
    roomCode: string;
    clock: ClockSnapshot;
    finishedRoom?: RoomStateSnapshot;
  }> {
    const now = Date.now();
    const updates: Array<{
      roomCode: string;
      clock: ClockSnapshot;
      finishedRoom?: RoomStateSnapshot;
    }> = [];

    for (const [roomCode, room] of this.rooms.entries()) {
      if (room.status === 'active') {
        const timedOut = this.updateLiveClocks(room, now);
        if (timedOut) {
          updates.push({
            roomCode,
            clock: this.getClockSnapshot(room),
            finishedRoom: this.toSnapshot(room),
          });
          continue;
        }

        // Check disconnect abandonment grace period
        if (
          room.whiteSeat &&
          !room.whiteSeat.connected &&
          room.whiteSeat.disconnectedAt &&
          now - room.whiteSeat.disconnectedAt > ABANDON_TIMEOUT_MS
        ) {
          this.finishGame(
            room,
            '0-1',
            'b',
            'abandoned',
            `${room.whiteSeat.displayName} (Putih) tidak kembali dalam batas waktu rekoneksi. Hitam menang.`
          );
          updates.push({
            roomCode,
            clock: this.getClockSnapshot(room),
            finishedRoom: this.toSnapshot(room),
          });
          continue;
        }

        if (
          room.blackSeat &&
          !room.blackSeat.connected &&
          room.blackSeat.disconnectedAt &&
          now - room.blackSeat.disconnectedAt > ABANDON_TIMEOUT_MS
        ) {
          this.finishGame(
            room,
            '1-0',
            'w',
            'abandoned',
            `${room.blackSeat.displayName} (Hitam) tidak kembali dalam batas waktu rekoneksi. Putih menang.`
          );
          updates.push({
            roomCode,
            clock: this.getClockSnapshot(room),
            finishedRoom: this.toSnapshot(room),
          });
          continue;
        }

        if (!room.isUnlimited) {
          updates.push({
            roomCode,
            clock: this.getClockSnapshot(room),
          });
        }
      }
    }

    return updates;
  }

  public pollRoom(params: {
    roomCode: string;
    sessionToken: string;
  }): {
    ok: boolean;
    error?: string;
    room?: RoomStateSnapshot;
    yourRole?: YourRoleInRoom;
  } {
    this.hydrateFromTmpIfNeeded();
    const code = params.roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      return { ok: false, error: 'Room tidak ditemukan atau sudah ditutup.' };
    }

    this.updateLiveClocks(room, Date.now());

    let yourRole: YourRoleInRoom = 'spectator';
    if (room.whiteSeat?.sessionToken === params.sessionToken) {
      room.whiteSeat.connected = true;
      room.whiteSeat.disconnectedAt = null;
      yourRole = 'w';
    } else if (room.blackSeat?.sessionToken === params.sessionToken) {
      room.blackSeat.connected = true;
      room.blackSeat.disconnectedAt = null;
      yourRole = 'b';
    }

    this.persistToTmp();
    return {
      ok: true,
      room: this.toSnapshot(room),
      yourRole,
    };
  }

  public persistToTmp(): void {
    try {
      const serialized: Array<Record<string, unknown>> = [];
      const now = Date.now();
      for (const room of this.rooms.values()) {
        // Prune rooms older than 6 hours
        if (now - room.createdAt > 6 * 3600 * 1000) continue;
        serialized.push({
          roomCode: room.roomCode,
          status: room.status,
          visibility: room.visibility,
          timeControl: room.timeControl,
          fen: room.chess.fen(),
          pgn: room.chess.pgn(),
          whiteSeat: room.whiteSeat,
          blackSeat: room.blackSeat,
          moveHistory: room.moveHistory,
          lastMove: room.lastMove,
          lastCaptureDuel: room.lastCaptureDuel,
          drawOfferBy: room.drawOfferBy,
          result: room.result,
          winnerColor: room.winnerColor,
          terminationReason: room.terminationReason,
          whiteMs: room.whiteMs,
          blackMs: room.blackMs,
          incrementMs: room.incrementMs,
          isUnlimited: room.isUnlimited,
          lastClockUpdateAt: room.lastClockUpdateAt,
          chatMessages: room.chatMessages,
          createdAt: room.createdAt,
          startedAt: room.startedAt,
          finishedAt: room.finishedAt,
        });
      }
      fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(serialized), 'utf-8');
    } catch {
      // Ignore write errors in restricted environments
    }
  }

  public hydrateFromTmpIfNeeded(): void {
    try {
      if (!fs.existsSync(TMP_STORE_PATH)) return;
      const raw = fs.readFileSync(TMP_STORE_PATH, 'utf-8');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
      if (!Array.isArray(parsed)) return;

      for (const item of parsed) {
        const code = String(item.roomCode || '');
        if (!code) continue;
        const existing = this.rooms.get(code);
        const itemPly = Array.isArray(item.moveHistory) ? item.moveHistory.length : 0;
        const existingPly = existing ? existing.moveHistory.length : -1;

        if (!existing || itemPly > existingPly || existing.status !== item.status) {
          const chess = new Chess();
          try {
            if (typeof item.pgn === 'string' && item.pgn.trim().length > 0) {
              chess.loadPgn(item.pgn);
            } else if (typeof item.fen === 'string') {
              chess.load(item.fen);
            }
          } catch {
            if (typeof item.fen === 'string') {
              try {
                chess.load(item.fen);
              } catch {
                // fallback initial
              }
            }
          }

          this.rooms.set(code, {
            roomCode: code,
            status: (item.status as RoomStatus) || 'waiting',
            visibility: (item.visibility as RoomVisibility) || 'public',
            timeControl: (item.timeControl as TimeControlPreset) || '5+0',
            chess,
            whiteSeat: (item.whiteSeat as InternalPlayerSeat | null) || null,
            blackSeat: (item.blackSeat as InternalPlayerSeat | null) || null,
            spectatorSockets: existing?.spectatorSockets || new Set(),
            moveHistory: (item.moveHistory as MoveRecord[]) || [],
            lastMove: (item.lastMove as { from: string; to: string } | null) || null,
            lastCaptureDuel: (item.lastCaptureDuel as CaptureDuelEvent | null) || null,
            drawOfferBy: (item.drawOfferBy as PieceColor | null) || null,
            result: (item.result as GameResult) || null,
            winnerColor: (item.winnerColor as PieceColor | null) || null,
            terminationReason: (item.terminationReason as GameTerminationReason) || null,
            whiteMs: Number(item.whiteMs ?? 300000),
            blackMs: Number(item.blackMs ?? 300000),
            incrementMs: Number(item.incrementMs ?? 0),
            isUnlimited: Boolean(item.isUnlimited),
            lastClockUpdateAt: Number(item.lastClockUpdateAt ?? Date.now()),
            chatMessages: (item.chatMessages as ChatMessageItem[]) || [],
            createdAt: Number(item.createdAt ?? Date.now()),
            startedAt: item.startedAt ? Number(item.startedAt) : null,
            finishedAt: item.finishedAt ? Number(item.finishedAt) : null,
          });
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  public listWaitingRooms(): Array<{
    roomCode: string;
    hostName: string;
    hostColor: PieceColor;
    timeControl: TimeControlPreset;
    createdAt: number;
  }> {
    this.hydrateFromTmpIfNeeded();
    const list: Array<{
      roomCode: string;
      hostName: string;
      hostColor: PieceColor;
      timeControl: TimeControlPreset;
      createdAt: number;
    }> = [];

    for (const room of this.rooms.values()) {
      if (room.status === 'waiting' && room.visibility === 'public') {
        const host = room.whiteSeat || room.blackSeat;
        if (host && (!room.whiteSeat || !room.blackSeat)) {
          list.push({
            roomCode: room.roomCode,
            hostName: host.displayName,
            hostColor: host.color,
            timeControl: room.timeControl,
            createdAt: room.createdAt,
          });
        }
      }
    }

    return list.sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
  }
}

const globalForChess = globalThis as unknown as {
  __classicChessRoomManager?: GameRoomManager;
};

export const gameRoomManager =
  globalForChess.__classicChessRoomManager ||
  (globalForChess.__classicChessRoomManager = new GameRoomManager());
