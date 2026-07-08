const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

const databases = new Databases(client);

async function run() {
  const res = await databases.listDocuments(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID,
    []
  );
  if (res.documents.length > 0) {
    const doc = res.documents.find(d => d.source.includes('New Yorker'));
    console.log(Object.keys(doc));
    console.log(doc);
  }
}
run();
