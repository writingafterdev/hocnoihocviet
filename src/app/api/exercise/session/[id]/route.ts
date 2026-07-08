import { NextRequest, NextResponse } from 'next/server';
import { serverDatabases } from '@/lib/appwrite-server';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const SESSIONS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_ACTIVE_SESSIONS_COLLECTION_ID!;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userHeader = req.headers.get('x-user-id');
    if (!userHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const sessionId = id;
    const body = await req.json();

    const updateData: any = {};
    if (body.current_question_index !== undefined) {
      updateData.current_question_index = body.current_question_index;
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.answers !== undefined) {
      updateData.answers = typeof body.answers === 'string' ? body.answers : JSON.stringify(body.answers);
    }

    const updated = await serverDatabases.updateDocument(
      DATABASE_ID,
      SESSIONS_COLLECTION,
      sessionId,
      updateData
    );

    return NextResponse.json({ session: updated });
  } catch (error: any) {
    console.error('Patch Session API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
