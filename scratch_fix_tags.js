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
  
  for (const doc of res.documents) {
    if (doc.section && doc.section.toLowerCase() === 'tags') {
      console.log(`Updating ${doc.title}...`);
      await databases.updateDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID,
        doc.$id,
        { section: 'Magazine' }
      );
    }
  }
  console.log("Done!");
}
run();
