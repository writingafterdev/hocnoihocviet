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
      Query.limit(50),
      Query.orderDesc('$createdAt')
    ]
  );
  
  const gifArticles = docs.documents.filter(d => 
    (d.cover_image_id && d.cover_image_id.toLowerCase().includes('.gif')) ||
    (d.body && d.body.toLowerCase().includes('.gif'))
  );
  
  console.log(`Found ${gifArticles.length} articles with GIFs.`);
  for (const a of gifArticles) {
    console.log(`- Title: ${a.title}`);
    console.log(`  Cover: ${a.cover_image_id}`);
  }
}
run();
