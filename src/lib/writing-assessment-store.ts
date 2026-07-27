import { createHash } from 'node:crypto';
import { serverDatabases } from '@/lib/appwrite-server';
import { DB_ID } from '@/lib/appwrite';
import { WRITING_ASSESSMENTS_COLLECTION_ID } from '@/lib/writing-assessments';
import type { WritingAnalysis } from '@/types/writing';

function assessmentDocumentId(userId: string, taskId: string) {
  const digest = createHash('sha256')
    .update(`${userId}\u0000${taskId}`)
    .digest('hex')
    .slice(0, 32);
  return `wa_${digest}`;
}

export async function loadWritingAssessment(userId: string, taskId: string) {
  return serverDatabases.getDocument(
    DB_ID,
    WRITING_ASSESSMENTS_COLLECTION_ID,
    assessmentDocumentId(userId, taskId),
  );
}

export async function saveWritingAssessment({
  userId,
  taskId,
  prompt,
  essay,
  analysis,
}: {
  userId: string;
  taskId: string;
  prompt: string;
  essay: string;
  analysis: WritingAnalysis;
}) {
  const documentId = assessmentDocumentId(userId, taskId);
  const data = {
    task_id: taskId,
    label: taskId,
    prompt,
    essay,
    analysis_json: JSON.stringify(analysis),
    // Keep the legacy collection enum stable. Partial/completion state lives in
    // analysis.run.status, where it can evolve without an Appwrite migration.
    state: 'complete',
  };

  try {
    await serverDatabases.updateDocument(
      DB_ID,
      WRITING_ASSESSMENTS_COLLECTION_ID,
      documentId,
      data,
    );
  } catch (error: unknown) {
    const isNotFound = typeof error === 'object' && error !== null && 'code' in error && error.code === 404;
    if (!isNotFound) throw error;
    await serverDatabases.createDocument(
      DB_ID,
      WRITING_ASSESSMENTS_COLLECTION_ID,
      documentId,
      data,
    );
  }
}
