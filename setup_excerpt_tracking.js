const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function setupExcerptTracking() {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const usersMetaId = process.env.NEXT_PUBLIC_APPWRITE_USERS_META_COLLECTION_ID;

  console.log('Adding dismissed_excerpts array to users_meta collection...');

  try {
    await databases.createStringAttribute(
      dbId,
      usersMetaId,
      'dismissed_excerpts',
      1000000, // Size - Appwrite arrays of strings use the total length or just set a large size for the array items
      false, // required
      undefined, // default
      true // array
    );
    console.log('Created attribute: dismissed_excerpts');
  } catch (e) {
    if (e.code === 409) {
      console.log('Attribute dismissed_excerpts already exists. Skipping.');
    } else {
      console.error('Error creating attribute dismissed_excerpts:', e.message);
    }
  }

  console.log('Finished updating Appwrite schema.');
}

setupExcerptTracking().catch(console.error);
