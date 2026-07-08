const { Client, Databases, ID } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function setupGlobalDict() {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  
  try {
    console.log("Creating global_dictionary collection...");
    const col = await databases.createCollection(dbId, ID.unique(), 'global_dictionary');
    const colId = col.$id;
    console.log(`Created collection: ${colId}`);

    // Create Attributes
    console.log("Creating attributes...");
    await databases.createStringAttribute(dbId, colId, 'word', 255, true);
    await databases.createStringAttribute(dbId, colId, 'language', 50, true);
    await databases.createStringAttribute(dbId, colId, 'translation', 255, false);
    await databases.createStringAttribute(dbId, colId, 'deep_analysis', 10000, false);
    
    // Add target_language to users_meta
    const userMetaColId = process.env.NEXT_PUBLIC_APPWRITE_USERS_META_COLLECTION_ID;
    try {
      await databases.createStringAttribute(dbId, userMetaColId, 'target_language', 50, false, 'Vietnamese');
      console.log("Added target_language to users_meta");
    } catch (e) {
      console.log("target_language already exists or error:", e.message);
    }

    console.log(`\n\nAdd this to .env.local:`);
    console.log(`NEXT_PUBLIC_APPWRITE_GLOBAL_DICTIONARY_COLLECTION_ID=${colId}`);
    
  } catch (err) {
    console.error("Error setting up DB:", err);
  }
}

setupGlobalDict();
