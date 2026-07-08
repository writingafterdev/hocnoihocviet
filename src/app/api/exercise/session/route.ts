import { NextRequest, NextResponse } from 'next/server';
import { serverDatabases } from '@/lib/appwrite-server';
import { ID, Query } from 'appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const SESSIONS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_ACTIVE_SESSIONS_COLLECTION_ID!;
const QUESTIONS_COLLECTION = process.env.NEXT_PUBLIC_APPWRITE_QUESTIONS_COLLECTION_ID!;

export async function GET(req: NextRequest) {
  try {
    const userHeader = req.headers.get('x-user-id');
    if (!userHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check for in_progress session
    const active = await serverDatabases.listDocuments(
      DATABASE_ID,
      SESSIONS_COLLECTION,
      [
        Query.equal('user_id', userHeader),
        Query.equal('status', 'in_progress')
      ]
    );

    if (active.total > 0) {
      return NextResponse.json({ session: active.documents[0] });
    }

    return NextResponse.json({ session: null });
  } catch (error: any) {
    console.error('Get Session API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userHeader = req.headers.get('x-user-id');
    if (!userHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { forceNew } = body;

    if (!forceNew) {
      const active = await serverDatabases.listDocuments(
        DATABASE_ID,
        SESSIONS_COLLECTION,
        [
          Query.equal('user_id', userHeader),
          Query.equal('status', 'in_progress')
        ]
      );
      if (active.total > 0) {
        return NextResponse.json({ session: active.documents[0] });
      }
    } else {
      // If forceNew is true, mark any existing in_progress as abandoned
      const active = await serverDatabases.listDocuments(
        DATABASE_ID,
        SESSIONS_COLLECTION,
        [
          Query.equal('user_id', userHeader),
          Query.equal('status', 'in_progress')
        ]
      );
      for (const doc of active.documents) {
        await serverDatabases.updateDocument(DATABASE_ID, SESSIONS_COLLECTION, doc.$id, {
          status: 'abandoned'
        });
      }
    }

    // Pick a new article that has questions
    // In a real app we'd filter out articles the user already completed. 
    // For now, let's just get the latest 50 questions, group by article, and pick a random one.
    const questionsResponse = await serverDatabases.listDocuments(
      DATABASE_ID,
      QUESTIONS_COLLECTION,
      [Query.limit(100)]
    );

    const articleIdsWithQuestions = Array.from(new Set(questionsResponse.documents.map(q => q.article_id)));

    if (articleIdsWithQuestions.length === 0) {
      return NextResponse.json({ error: 'No articles with questions available.' }, { status: 404 });
    }

    // Pick a random article
    const randomArticleId = articleIdsWithQuestions[Math.floor(Math.random() * articleIdsWithQuestions.length)];

    const newSession = await serverDatabases.createDocument(
      DATABASE_ID,
      SESSIONS_COLLECTION,
      ID.unique(),
      {
        user_id: userHeader,
        article_id: randomArticleId,
        current_question_index: 0,
        status: 'in_progress',
        answers: "{}"
      }
    );

    return NextResponse.json({ session: newSession });
  } catch (error: any) {
    console.error('Post Session API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
