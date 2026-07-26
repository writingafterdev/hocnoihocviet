import fs from 'node:fs';
import path from 'node:path';
import { Client, Databases, Query } from 'appwrite';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function normalizeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitQuestionUnits(question) {
  return normalizeSpaces(question)
    .match(/[^?]+\?/g)
    ?.map((unit) => normalizeSpaces(unit))
    .filter(Boolean) || [];
}

function dedupeQuestion(question) {
  const value = normalizeSpaces(question);
  if (!value) return value;

  const units = splitQuestionUnits(value);
  if (units.length >= 2 && units.length % 2 === 0) {
    const half = units.length / 2;
    const first = units.slice(0, half).join(' ');
    const second = units.slice(half).join(' ');
    if (first === second) return first;
  }

  for (let size = Math.floor(value.length / 2); size >= 30; size -= 1) {
    const first = value.slice(0, size).trim();
    const rest = value.slice(size).trim();
    if (first && rest === first) return first;
  }

  return value;
}

function stripLeadingReviewerChrome(essay) {
  return normalizeSpaces(essay)
    .replace(/^[\p{L}\s.'-]{2,60}\s+(?:một|\d+)\s+(?:giây|phút|giờ|ngày|tháng|năm)\s+trước\s+/iu, '')
    .trim();
}

function stripTrailingYouPassChrome(essay) {
  const markers = [
    /\bGợi ý nâng cấp\b/i,
    /\bSửa chi tiết và Nâng cấp bài\b/i,
    /\bSửa bài\b/i,
    /\b\d+\s*Thảo luận\b/i,
    /\bThảo luận\b/i,
    /\bXem thêm\b/i,
    /\bPhản hồi\b/i,
    /\bBand Score\b/i,
    /\bLưu ý chấm điểm\b/i,
    /\bGhi chú của bạn\b/i,
    /\bTra từ vựng\b/i,
  ];

  let cutIndex = -1;
  for (const marker of markers) {
    const match = marker.exec(essay);
    if (match && (cutIndex === -1 || match.index < cutIndex)) {
      cutIndex = match.index;
    }
  }
  return cutIndex >= 0 ? essay.slice(0, cutIndex).trim() : essay.trim();
}

function sentenceFingerprint(text) {
  return normalizeSpaces(text)
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ');
}

function dedupeEssayBody(essay) {
  const value = essay.trim();
  if (value.length < 500) return value;

  const sentences = value.match(/[^.!?]+[.!?]/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
  if (sentences.length < 6) return value;

  for (let start = 1; start < Math.min(6, sentences.length - 3); start += 1) {
    const head = sentenceFingerprint(sentences.slice(start, start + 2).join(' '));
    for (let next = start + 3; next < sentences.length - 1; next += 1) {
      const candidate = sentenceFingerprint(sentences.slice(next, next + 2).join(' '));
      if (head && head === candidate) {
        return sentences.slice(start, next).join(' ').trim();
      }
    }
  }

  const firstTwo = sentenceFingerprint(sentences.slice(0, 2).join(' '));
  for (let next = 2; next < sentences.length - 1; next += 1) {
    const candidate = sentenceFingerprint(sentences.slice(next, next + 2).join(' '));
    if (firstTwo && firstTwo === candidate) {
      return sentences.slice(0, next).join(' ').trim();
    }
  }

  return value;
}

function cleanEssay(essay) {
  let value = String(essay || '').replace(/\r/g, ' ');
  value = stripLeadingReviewerChrome(value);
  value = stripTrailingYouPassChrome(value);
  value = dedupeEssayBody(value);
  value = value
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return value;
}

function wordCount(text) {
  return normalizeSpaces(text).split(/\s+/).filter(Boolean).length;
}

function previewChange(before, after) {
  if (before === after) return '';
  return `${before.slice(0, 130)}\n→ ${after.slice(0, 130)}`;
}

async function listAllDocuments(databases, databaseId, collectionId) {
  const documents = [];
  for (let offset = 0; ; offset += 100) {
    const response = await databases.listDocuments(databaseId, collectionId, [
      Query.limit(100),
      Query.offset(offset),
      Query.orderDesc('$createdAt'),
    ]);
    documents.push(...response.documents);
    if (documents.length >= response.total || response.documents.length === 0) break;
  }
  return documents;
}

async function main() {
  loadEnv();

  const apply = process.argv.includes('--apply');
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const collectionId = process.env.APPWRITE_BENCHMARK_REFERENCE_COLLECTION_ID
    || process.env.NEXT_PUBLIC_APPWRITE_BENCHMARK_REFERENCE_COLLECTION_ID
    || 'benchmark_reference_jobs';

  if (!endpoint || !projectId || !apiKey || !databaseId) {
    throw new Error('Missing Appwrite environment variables.');
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);
  const documents = await listAllDocuments(databases, databaseId, collectionId);

  const changes = [];
  for (const document of documents) {
    if (document.status !== 'queued') continue;

    const question = String(document.question || '');
    const essay = String(document.essay || '');
    const cleanedQuestion = dedupeQuestion(question);
    const cleanedEssay = cleanEssay(essay);

    if (question === cleanedQuestion && essay === cleanedEssay) continue;
    if (wordCount(cleanedEssay) < 80) {
      changes.push({
        id: document.$id,
        sourceUrl: document.source_url || '',
        skipped: true,
        reason: `Cleaned essay too short (${wordCount(cleanedEssay)} words).`,
      });
      continue;
    }

    changes.push({
      id: document.$id,
      sourceUrl: document.source_url || '',
      questionChanged: question !== cleanedQuestion,
      essayChanged: essay !== cleanedEssay,
      questionBeforeLength: question.length,
      questionAfterLength: cleanedQuestion.length,
      essayBeforeWords: wordCount(essay),
      essayAfterWords: wordCount(cleanedEssay),
      questionPreview: previewChange(question, cleanedQuestion),
      essayPreview: previewChange(essay, cleanedEssay),
      patch: {
        question: cleanedQuestion,
        essay: cleanedEssay,
      },
    });
  }

  const actionable = changes.filter((change) => !change.skipped);

  if (apply) {
    for (const change of actionable) {
      await databases.updateDocument(databaseId, collectionId, change.id, change.patch);
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    totalDocuments: documents.length,
    changedDocuments: actionable.length,
    skippedDocuments: changes.filter((change) => change.skipped).length,
    questionChanged: actionable.filter((change) => change.questionChanged).length,
    essayChanged: actionable.filter((change) => change.essayChanged).length,
    samples: actionable.slice(0, 8).map((change) => ({
      id: change.id,
      sourceUrl: change.sourceUrl,
      questionChanged: change.questionChanged,
      essayChanged: change.essayChanged,
      questionBeforeLength: change.questionBeforeLength,
      questionAfterLength: change.questionAfterLength,
      essayBeforeWords: change.essayBeforeWords,
      essayAfterWords: change.essayAfterWords,
      questionPreview: change.questionPreview,
      essayPreview: change.essayPreview,
    })),
    skipped: changes.filter((change) => change.skipped).slice(0, 5),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
