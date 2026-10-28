import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { z } from 'zod';
import { gameRoomManager } from './server/game-manager.ts';
import type { PieceSymbol, TimeControlPreset } from './types/chess.ts';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Zod Schemas for Socket.IO Event Payloads
const CreateRoomSchema = z.object({
  sessionToken: z.string().min(8).max(128),
  playerName: z.string().min(1).max(32),
  timeControl: z.enum(['1+0', '3+0', '3+2', '5+0', '10+0', 'casual']),
  preferredColor: z.enum(['w', 'b', 'random']),
  visibility: z.enum(['public', 'private']).optional().default('public'),
});

const JoinRoomSchema = z.object({
  sessionToken: z.string().min(8).max(128),
  roomCode: z.string().min(4).max(12),
  playerName: z.string().max(32).optional().default('Pemain'),
});

const RoomActionSchema = z.object({
  sessionToken: z.string().min(8).max(128),
  roomCode: z.string().min(4).max(12),
});

const MovePayloadSchema = z.object({
  sessionToken: z.string().min(8).max(128),
  roomCode: z.string().min(4).max(12),
  from: z.string().regex(/^[a-h][1-8]$/),
  to: z.string().regex(/^[a-h][1-8]$/),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
  ply: z.number().int().nonnegative().optional(),
});

const DrawResponseSchema = z.object({
  sessionToken: z.string().min(8).max(128),
  roomCode: z.string().min(4).max(12),
  accept: z.boolean(),
});

const ChatPayloadSchema = z.object({
  sessionToken: z.string().min(8).max(128),
  roomCode: z.string().min(4).max(12),
  message: z.string().min(1).max(240),
});

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: process.env.ALLOWED_WEB_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 64 * 1024, // 64KB max payload safety
  });

  (globalThis as unknown as { __classicChessSocketIO?: SocketIOServer }).__classicChessSocketIO =
    io;

  io.on('connection', (socket) => {
    // Send active open lobby list on connect
    socket.emit('lobby:rooms', gameRoomManager.listWaitingRooms());

    socket.on('lobby:list', () => {
      socket.emit('lobby:rooms', gameRoomManager.listWaitingRooms());
    });

    socket.on('room:subscribe', (rawPayload) => {
      if (rawPayload && typeof rawPayload.roomCode === 'string') {
        const code = rawPayload.roomCode.trim().toUpperCase();
        if (code.length >= 4 && code.length <= 12) {
          socket.join(code);
        }
      }
    });

    socket.on('room:create', (rawPayload, ack) => {
      const parsed = CreateRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Payload pembuatan room tidak valid.' });
        return;
      }

      const res = gameRoomManager.createRoom({
        socketId: socket.id,
        sessionToken: parsed.data.sessionToken,
        playerName: parsed.data.playerName,
        timeControl: parsed.data.timeControl as TimeControlPreset,
        preferredColor: parsed.data.preferredColor,
        visibility: parsed.data.visibility,
      });

      if (res.ok && res.room) {
        socket.join(res.room.roomCode);
        io.emit('lobby:rooms', gameRoomManager.listWaitingRooms());
      }
      ack?.(res);
    });

    socket.on('room:cancel', (rawPayload, ack) => {
      const parsed = RoomActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Permintaan pembatalan room tidak valid.' });
        return;
      }
      const res = gameRoomManager.cancelWaitingRoom(parsed.data);
      if (res.ok) {
        const code = parsed.data.roomCode.toUpperCase();
        io.to(code).emit('room:cancelled', { roomCode: code });
        socket.leave(code);
        io.emit('lobby:rooms', gameRoomManager.listWaitingRooms());
      }
      ack?.(res);
    });

    socket.on('room:join', (rawPayload, ack) => {
      const parsed = JoinRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Kode room atau identitas tidak valid.' });
        return;
      }

      const res = gameRoomManager.joinRoom({
        socketId: socket.id,
        sessionToken: parsed.data.sessionToken,
        roomCode: parsed.data.roomCode,
        playerName: parsed.data.playerName,
      });

      if (res.ok && res.room) {
        const code = res.room.roomCode;
        socket.join(code);

        if (res.reconnected) {
          socket.to(code).emit('player:reconnected', {
            color: res.yourRole,
            room: res.room,
          });
        }

        io.to(code).emit('game:state', res.room);
        io.emit('lobby:rooms', gameRoomManager.listWaitingRooms());
      }
      ack?.(res);
    });

    socket.on('room:ready', (rawPayload, ack) => {
      const parsed = RoomActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Permintaan tidak valid.' });
        return;
      }

      const res = gameRoomManager.setPlayerReady(parsed.data);
      if (res.ok && res.room) {
        const code = res.room.roomCode;
        io.to(code).emit('game:state', res.room);
        if (res.started) {
          io.to(code).emit('game:start', res.room);
          io.emit('lobby:rooms', gameRoomManager.listWaitingRooms());
        }
      }
      ack?.(res);
    });

    socket.on('game:move', (rawPayload, ack) => {
      const parsed = MovePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Format langkah catur tidak valid.' });
        return;
      }

      const res = gameRoomManager.makeMove({
        roomCode: parsed.data.roomCode,
        sessionToken: parsed.data.sessionToken,
        from: parsed.data.from,
        to: parsed.data.to,
        promotion: parsed.data.promotion as PieceSymbol | undefined,
        ply: parsed.data.ply,
      });

      if (res.ok && res.room) {
        const code = res.room.roomCode;
        io.to(code).emit('game:state', res.room);
        if (res.gameFinished) {
          io.to(code).emit('game:finished', res.room);
        }
      }
      ack?.(res);
    });

    socket.on('game:draw-offer', (rawPayload, ack) => {
      const parsed = RoomActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Permintaan tawaran remis tidak valid.' });
        return;
      }

      const res = gameRoomManager.offerDraw(parsed.data);
      if (res.ok && res.room) {
        io.to(res.room.roomCode).emit('game:state', res.room);
      }
      ack?.(res);
    });

    socket.on('game:draw-response', (rawPayload, ack) => {
      const parsed = DrawResponseSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Respons remis tidak valid.' });
        return;
      }

      const res = gameRoomManager.respondDraw(parsed.data);
      if (res.ok && res.room) {
        const code = res.room.roomCode;
        io.to(code).emit('game:state', res.room);
        if (res.gameFinished) {
          io.to(code).emit('game:finished', res.room);
        }
      }
      ack?.(res);
    });

    socket.on('game:claim-draw', (rawPayload, ack) => {
      const parsed = RoomActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Permintaan klaim remis tidak valid.' });
        return;
      }

      const res = gameRoomManager.claimDraw(parsed.data);
      if (res.ok && res.room) {
        const code = res.room.roomCode;
        io.to(code).emit('game:state', res.room);
        if (res.gameFinished) {
          io.to(code).emit('game:finished', res.room);
        }
      }
      ack?.(res);
    });

    socket.on('game:resign', (rawPayload, ack) => {
      const parsed = RoomActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Permintaan menyerah tidak valid.' });
        return;
      }

      const res = gameRoomManager.resignGame(parsed.data);
      if (res.ok && res.room) {
        const code = res.room.roomCode;
        io.to(code).emit('game:state', res.room);
        if (res.gameFinished) {
          io.to(code).emit('game:finished', res.room);
        }
      }
      ack?.(res);
    });

    socket.on('room:rematch', (rawPayload, ack) => {
      const parsed = RoomActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Permintaan tanding ulang tidak valid.' });
        return;
      }

      const res = gameRoomManager.requestRematch(parsed.data);
      if (res.ok && res.room) {
        const code = res.room.roomCode;
        io.to(code).emit('game:state', res.room);
        io.to(code).emit('game:start', res.room);
      }
      ack?.(res);
    });

    socket.on('chat:send', (rawPayload, ack) => {
      const parsed = ChatPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        ack?.({ ok: false, error: 'Pesan chat tidak valid (maks 240 karakter).' });
        return;
      }

      const res = gameRoomManager.sendChatMessage(parsed.data);
      if (res.ok && res.chatItem) {
        io.to(parsed.data.roomCode.toUpperCase()).emit('chat:message', res.chatItem);
      }
      ack?.(res);
    });

    socket.on('disconnect', () => {
      const info = gameRoomManager.handleDisconnect(socket.id);
      if (info.roomCode && info.room) {
        if (info.disconnectedColor) {
          io.to(info.roomCode).emit('player:disconnected', {
            color: info.disconnectedColor,
            playerName: info.playerName,
            gracePeriodMs: 90000,
          });
        }
        io.to(info.roomCode).emit('game:state', info.room);
        io.emit('lobby:rooms', gameRoomManager.listWaitingRooms());
      }
    });
  });

  // Authoritative server clock loop (250ms resolution)
  setInterval(() => {
    const updates = gameRoomManager.tickActiveRooms();
    for (const u of updates) {
      io.to(u.roomCode).emit('game:clock', u.clock);
      if (u.finishedRoom) {
        io.to(u.roomCode).emit('game:state', u.finishedRoom);
        io.to(u.roomCode).emit('game:finished', u.finishedRoom);
      }
    }
  }, 250);

  httpServer.listen(port, hostname, () => {
    console.log(`> Classic Chess 3D Server & Socket.IO listening on http://${hostname}:${port}`);
  });
});
