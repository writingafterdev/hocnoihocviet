const sdk = require('node-appwrite');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const client = new sdk.Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new sdk.Databases(client);

async function addAttributes() {
  try {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const collectionId = process.env.NEXT_PUBLIC_APPWRITE_ARTICLES_COLLECTION_ID;

    console.log(`Adding 'section' attribute...`);
    await databases.createStringAttribute(dbId, collectionId, 'section', 100, false);
    console.log(`Added 'section'.`);

    console.log(`Adding 'column' attribute...`);
    await databases.createStringAttribute(dbId, collectionId, 'column', 100, false);
    console.log(`Added 'column'.`);

  } catch (error) {
    if (error.code === 409) {
      console.log('Attribute already exists:', error.message);
    } else {
      console.error('Failed:', error);
    }
  }
}

addAttributes();
