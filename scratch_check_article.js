const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });
const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

async function run() {
  const docs = await databases.listDocuments(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID,
    [
      Query.search('title', 'Even Basketball Players Lie About Their Height')
    ]
  );
  if (docs.documents.length > 0) {
    console.log("Cover Image ID:", docs.documents[0].cover_image_id);
  } else {
    console.log("Article not found.");
  }
}
run();
