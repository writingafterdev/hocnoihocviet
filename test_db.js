const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });
const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);
const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const aColId = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID;
async function test() {
  const articles = await databases.listDocuments(dbId, aColId);
  console.log(articles.documents.map(a => ({ id: a.$id, title: a.title, text: (a.body||'').substring(0, 100) })));
}
test();
