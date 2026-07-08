const { Client, Databases, ID } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setup() {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  
  try {
    console.log("Creating questions collection v2...");
    const qCol = await databases.createCollection(dbId, ID.unique(), 'questions');
    const qColId = qCol.$id;
    console.log(`Created collection: ${qColId}`);
    
    await databases.createStringAttribute(dbId, qColId, 'article_id', 255, true);
    await databases.createStringAttribute(dbId, qColId, 'type', 50, true);
    await databases.createStringAttribute(dbId, qColId, 'prompt', 2000, true);
    await databases.createStringAttribute(dbId, qColId, 'options', 500, false, null, true); // Array
    await databases.createStringAttribute(dbId, qColId, 'correct_answer', 500, true);
    await databases.createStringAttribute(dbId, qColId, 'explanation', 5000, false);
    
    await sleep(2000); // Wait for attributes to provision

    console.log("Creating featured_phrases collection...");
    const pCol = await databases.createCollection(dbId, ID.unique(), 'featured_phrases');
    const pColId = pCol.$id;
    console.log(`Created collection: ${pColId}`);
    
    await databases.createStringAttribute(dbId, pColId, 'article_id', 255, true);
    await databases.createStringAttribute(dbId, pColId, 'phrase', 255, true);
    await databases.createStringAttribute(dbId, pColId, 'context', 2000, true);
    
    await sleep(2000);

    console.log("Creating active_sessions collection...");
    const sCol = await databases.createCollection(dbId, ID.unique(), 'active_sessions');
    const sColId = sCol.$id;
    console.log(`Created collection: ${sColId}`);
    
    await databases.createStringAttribute(dbId, sColId, 'user_id', 255, true);
    await databases.createStringAttribute(dbId, sColId, 'article_id', 255, true);
    await databases.createIntegerAttribute(dbId, sColId, 'current_question_index', true);
    await databases.createStringAttribute(dbId, sColId, 'status', 50, true); // in_progress, completed
    await databases.createStringAttribute(dbId, sColId, 'answers', 10000, false); // JSON string map
    
    console.log(`\n\nAdd this to .env.local:`);
    console.log(`NEXT_PUBLIC_APPWRITE_QUESTIONS_COLLECTION_ID=${qColId}`);
    console.log(`NEXT_PUBLIC_APPWRITE_FEATURED_PHRASES_COLLECTION_ID=${pColId}`);
    console.log(`NEXT_PUBLIC_APPWRITE_ACTIVE_SESSIONS_COLLECTION_ID=${sColId}`);
    
  } catch (err) {
    console.error("Error setting up DB:", err);
  }
}

setup();
