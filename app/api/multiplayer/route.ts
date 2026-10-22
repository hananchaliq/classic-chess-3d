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
        return NextResponse.json({
          ...res,
          waitingRooms: gameRoomManager.listWaitingRooms(),
        });
      }

      case 'room:join': {
        const res = gameRoomManager.joinRoom({
          socketId: pseudoSocketId,
          sessionToken,
          roomCode: String(body.roomCode || ''),
          playerName: String(body.playerName || 'Pemain'),
        });
        return NextResponse.json({
          ...res,
          waitingRooms: gameRoomManager.listWaitingRooms(),
        });
      }

      case 'room:ready': {
        const res = gameRoomManager.setPlayerReady({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        return NextResponse.json(res);
      }

      case 'room:cancel': {
        const res = gameRoomManager.cancelWaitingRoom({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        return NextResponse.json({
          ...res,
          waitingRooms: gameRoomManager.listWaitingRooms(),
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
        return NextResponse.json(res);
      }

      case 'game:draw-offer': {
        const res = gameRoomManager.offerDraw({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        return NextResponse.json(res);
      }

      case 'game:draw-response': {
        const res = gameRoomManager.respondDraw({
          roomCode: String(body.roomCode || ''),
          sessionToken,
          accept: Boolean(body.accept),
        });
        return NextResponse.json(res);
      }

      case 'game:claim-draw': {
        const res = gameRoomManager.claimDraw({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        return NextResponse.json(res);
      }

      case 'game:resign': {
        const res = gameRoomManager.resignGame({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
        return NextResponse.json(res);
      }

      case 'room:rematch': {
        const res = gameRoomManager.requestRematch({
          roomCode: String(body.roomCode || ''),
          sessionToken,
        });
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
