const { Client, Databases, Query } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

const databases = new Databases(client);

async function resetSRS() {
  console.log("Fetching vocab entries to reset...");
  try {
    const res = await databases.listDocuments(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      process.env.NEXT_PUBLIC_APPWRITE_VOCAB_COLLECTION_ID,
      [Query.limit(100)]
    );
    
    console.log(`Found ${res.documents.length} words.`);
    
    // Reset them to be due 1 hour ago
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    
    for (const doc of res.documents) {
      await databases.updateDocument(
        process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        process.env.NEXT_PUBLIC_APPWRITE_VOCAB_COLLECTION_ID,
        doc.$id,
        {
          next_review: pastDate,
          repetitions: 0,
          interval: 0,
          ease_factor: 2.5,
          mastery: 'new'
        }
      );
      console.log(`Reset SRS for word: ${doc.word}`);
    }
    
    console.log("Done resetting SRS data!");
  } catch (err) {
    console.error("Failed:", err);
  }
}

resetSRS();
