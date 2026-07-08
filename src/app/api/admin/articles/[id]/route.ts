import { NextResponse } from 'next/server';
import { serverDatabases } from '@/lib/appwrite-server';
import { DB_ID, COLLECTIONS } from '@/lib/appwrite';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing article ID' }, { status: 400 });
    }

    // Use Server SDK to delete the document, bypassing client collection permissions
    await serverDatabases.deleteDocument(DB_ID, COLLECTIONS.articles, id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
