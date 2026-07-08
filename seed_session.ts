require('dotenv').config({ path: '.env.local' });
import { generateDailySessionData } from './src/lib/daily-session-generator';
import { serverDatabases } from './src/lib/appwrite-server';

async function seed() {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const aColId = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID!;
  const doc = await serverDatabases.getDocument(dbId, aColId, '6a2c60fb001c507c66aa');
  
  console.log("Generating data for:", doc.title);
  await generateDailySessionData(doc.$id, doc.body.replace(/<[^>]*>?/gm, ''));
  console.log("Done");
}
seed();
