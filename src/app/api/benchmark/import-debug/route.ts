import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DEBUG_DIR = path.join(process.cwd(), '.benchmark-import-debug');
const DEBUG_FILE = path.join(DEBUG_DIR, 'last.json');

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers || {}),
    },
  });
}

export function OPTIONS() {
  return jsonResponse({});
}

export async function GET() {
  try {
    const raw = await readFile(DEBUG_FILE, 'utf8');
    return jsonResponse(JSON.parse(raw));
  } catch {
    return jsonResponse({ error: 'No benchmark import debug snapshot has been saved yet.' }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await mkdir(DEBUG_DIR, { recursive: true });
    await writeFile(DEBUG_FILE, JSON.stringify({
      savedAt: new Date().toISOString(),
      body,
    }, null, 2));
    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Failed to save import debug snapshot.' },
      { status: 500 },
    );
  }
}
