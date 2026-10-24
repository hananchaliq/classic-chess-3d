import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export const runtime = 'nodejs';

const ALLOWED_MODELS = new Set([
  'option8_cathedral',
  'pawn_white',
  'rook_white',
  'knight_white',
  'bishop_white',
  'queen_white',
  'king_white',
]);

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await context.params;
    const cleanName = name.replace(/\.glb(\.gz)?$/i, '');
    if (!ALLOWED_MODELS.has(cleanName)) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const gzPath = path.join(process.cwd(), 'public', 'models', `${cleanName}.glb.gz`);
    if (!fs.existsSync(gzPath)) {
      return NextResponse.json({ error: 'Model file missing' }, { status: 404 });
    }

    const gzBuffer = fs.readFileSync(gzPath);
    const glbBuffer = zlib.gunzipSync(gzBuffer);

    return new NextResponse(glbBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load model' },
      { status: 500 }
    );
  }
}
