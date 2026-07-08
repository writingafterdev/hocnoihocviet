const { Client, Databases, Permission, Role } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function setup() {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const qColId = process.env.NEXT_PUBLIC_APPWRITE_QUESTIONS_COLLECTION_ID;
  const pColId = process.env.NEXT_PUBLIC_APPWRITE_FEATURED_PHRASES_COLLECTION_ID;
  const sColId = process.env.NEXT_PUBLIC_APPWRITE_ACTIVE_SESSIONS_COLLECTION_ID;

  try {
    const permissions = [
      Permission.read(Role.any()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ];

    await databases.updateCollection(dbId, qColId, 'questions', permissions, true);
    await databases.updateCollection(dbId, pColId, 'featured_phrases', permissions, true);
    await databases.updateCollection(dbId, sColId, 'active_sessions', permissions, true);
    
    console.log("Updated permissions");
  } catch (err) {
    console.error("Error setting up DB:", err);
  }
}

setup();
