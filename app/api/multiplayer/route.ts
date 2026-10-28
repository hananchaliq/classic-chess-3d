import { NextRequest, NextResponse } from 'next/server';
import { gameRoomManager } from '@/server/game-manager';
import type {
  PieceSymbol,
  RoomVisibility,
  TimeControlPreset,
} from '@/types/chess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/multiplayer
 * Supports:
 * - ?action=lobby -> returns waiting public rooms + server active status
 * - ?action=poll&roomCode=XXXXXX&sessionToken=YYYY -> ticks live clocks and returns authoritative room snapshot
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'lobby';

  if (action === 'poll') {
    const roomCode = searchParams.get('roomCode') || '';
    const sessionToken = searchParams.get('sessionToken') || '';
    if (!roomCode || !sessionToken) {
      return NextResponse.json(
        { ok: false, error: 'Parameter roomCode dan sessionToken diperlukan.' },
        { status: 400 }
      );
    }
    const res = gameRoomManager.pollRoom({ roomCode, sessionToken });
    return NextResponse.json(res, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }

  const rooms = gameRoomManager.listWaitingRooms();
  return NextResponse.json(
    {
      ok: true,
      mode: 'hybrid-serverless',
      rooms,
      serverTimestamp: Date.now(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

/**
 * POST /api/multiplayer
 * Unified serverless multiplayer endpoint for Vercel & Hybrid deployments.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || '');
    const sessionToken = String(body.sessionToken || '');

    if (!sessionToken || sessionToken.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Token sesi tidak valid.' },
        { status: 400 }
      );
    }

    const pseudoSocketId = `http_${sessionToken}`;
    const io = (
      globalThis as unknown as {
        __classicChessSocketIO?: {
          emit: (ev: string, data: unknown) => void;
          to: (room: string) => { emit: (ev: string, data: unknown) => void };
        };
      }
    ).__classicChessSocketIO;

    switch (action) {
      case 'room:create': {
        const res = gameRoomManager.createRoom({
          socketId: pseudoSocketId,
          sessionToken,
          playerName: String(body.playerName || 'Pemain'),
          timeControl: (body.timeControl as TimeControlPreset) || '5+0',
          preferredColor: (body.preferredColor as 'w' | 'b' | 'random') || 'w',
          visibility: (body.visibility as RoomVisibility) || 'public',
        });
        const waitingRooms = gameRoomManager.listWaitingRooms();
        if (res.ok && res.room) {
          io?.emit('lobby:rooms', waitingRooms);
        }
        return NextResponse.json({
          ...res,
          waitingRooms,
        });
      }

      case 'room:join': {
        const res = gameRoomManager.joinRoom({
          socketId: pseudoSocketId,
          sessionToken,
          roomCode: String(body.roomCode || ''),
          playerName: String(body.playerName || 'Pemain'),
        });
        const waitingRooms = gameRoomManager.listWaitingRooms();
        if (res.ok && res.room) {
          io?.to(res.room.roomCode).emit('game:state', res.room);
          io?.emit('lobby:rooms', waitingRooms);
        }
        return NextResponse.json({
          ...res,
          waitingRooms,
        });
      }

      case 'room:ready': {
        const res = gameRoomManager.setPlayerReady({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        if (res.ok && res.room) {
          io?.to(res.room.roomCode).emit('game:state', res.room);
          if (res.started) {
            io?.to(res.room.roomCode).emit('game:start', res.room);
            io?.emit('lobby:rooms', gameRoomManager.listWaitingRooms());
          }
        }
        return NextResponse.json(res);
      }

      case 'room:cancel': {
        const code = String(body.roomCode || '').trim().toUpperCase();
        const res = gameRoomManager.cancelWaitingRoom({
          roomCode: code,
          sessionToken,
        });
        const waitingRooms = gameRoomManager.listWaitingRooms();
        if (res.ok && code) {
          io?.to(code).emit('room:cancelled', { roomCode: code });
          io?.emit('lobby:rooms', waitingRooms);
        }
        return NextResponse.json({
          ...res,
          waitingRooms,
        });
      }

      case 'game:move': {
        const res = gameRoomManager.makeMove({
          roomCode: String(body.roomCode || ''),
          sessionToken,
          from: String(body.from || ''),
          to: String(body.to || ''),
          promotion: body.promotion as PieceSymbol | undefined,
          ply: typeof body.ply === 'number' ? body.ply : undefined,
        });
        if (res.ok && res.room) {
          io?.to(res.room.roomCode).emit('game:state', res.room);
          if (res.gameFinished) {
            io?.to(res.room.roomCode).emit('game:finished', res.room);
          }
        }
        return NextResponse.json(res);
      }

      case 'game:draw-offer': {
        const res = gameRoomManager.offerDraw({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        if (res.ok && res.room) {
          io?.to(res.room.roomCode).emit('game:state', res.room);
        }
        return NextResponse.json(res);
      }

      case 'game:draw-response': {
        const res = gameRoomManager.respondDraw({
          roomCode: String(body.roomCode || ''),
          sessionToken,
          accept: Boolean(body.accept),
        });
        if (res.ok && res.room) {
          io?.to(res.room.roomCode).emit('game:state', res.room);
          if (res.gameFinished) {
            io?.to(res.room.roomCode).emit('game:finished', res.room);
          }
        }
        return NextResponse.json(res);
      }

      case 'game:claim-draw': {
        const res = gameRoomManager.claimDraw({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        if (res.ok && res.room) {
          io?.to(res.room.roomCode).emit('game:state', res.room);
          if (res.gameFinished) {
            io?.to(res.room.roomCode).emit('game:finished', res.room);
          }
        }
        return NextResponse.json(res);
      }

      case 'game:resign': {
        const res = gameRoomManager.resignGame({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        if (res.ok && res.room) {
          io?.to(res.room.roomCode).emit('game:state', res.room);
          if (res.gameFinished) {
            io?.to(res.room.roomCode).emit('game:finished', res.room);
          }
        }
        return NextResponse.json(res);
      }

      case 'room:rematch': {
        const res = gameRoomManager.requestRematch({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        if (res.ok && res.room) {
          io?.to(res.room.roomCode).emit('game:state', res.room);
          io?.to(res.room.roomCode).emit('game:start', res.room);
        }
        return NextResponse.json(res);
      }

      case 'chat:send': {
        const res = gameRoomManager.sendChatMessage({
          roomCode: String(body.roomCode || ''),
          sessionToken,
          message: String(body.message || ''),
        });
        const pollRes = gameRoomManager.pollRoom({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        if (res.ok && res.chatItem && pollRes.room) {
          io?.to(pollRes.room.roomCode).emit('chat:message', res.chatItem);
          io?.to(pollRes.room.roomCode).emit('game:state', pollRes.room);
        }
        return NextResponse.json({
          ...res,
          room: pollRes.room,
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Aksi "${action}" tidak dikenali.` },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Gagal memproses permintaan multiplayer.' },
      { status: 500 }
    );
  }
}
