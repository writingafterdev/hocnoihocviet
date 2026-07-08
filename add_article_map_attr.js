const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function run() {
  try {
    await databases.createStringAttribute(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID,
      'article_map',
      50000,
      false
    );
    console.log('Successfully added article_map attribute');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('Attribute article_map already exists');
    } else {
      console.error(e);
    }
  }
}
run();
