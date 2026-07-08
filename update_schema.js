const sdk = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new sdk.Client();
client
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new sdk.Databases(client);
const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const excerptsColId = process.env.NEXT_PUBLIC_APPWRITE_READING_EXCERPTS_COLLECTION_ID;
const usersMetaColId = process.env.NEXT_PUBLIC_APPWRITE_USERS_META_COLLECTION_ID;

async function run() {
    console.log("Updating schemas...");
    try {
        await databases.createIntegerAttribute(dbId, excerptsColId, 'order_index', false, 0, 1000, 0);
        console.log("Added order_index to reading_excerpts");
    } catch (e) {
        console.error("Error order_index:", e.message);
    }
    
    try {
        await databases.createStringAttribute(dbId, usersMetaColId, 'current_article_id', 255, false, null);
        console.log("Added current_article_id to users_meta");
    } catch (e) {
        console.error("Error current_article_id:", e.message);
    }
}

run().catch(console.error);
