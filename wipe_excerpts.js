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

async function wipe() {
    console.log("Wiping reading_excerpts...");
    let hasMore = true;
    let count = 0;
    while (hasMore) {
        const docs = await databases.listDocuments(dbId, excerptsColId, [sdk.Query.limit(100)]);
        if (docs.documents.length === 0) {
            hasMore = false;
            break;
        }
        for (const doc of docs.documents) {
            await databases.deleteDocument(dbId, excerptsColId, doc.$id);
            count++;
        }
    }
    console.log(`Deleted ${count} excerpts.`);

    console.log("Resetting users_meta progression...");
    const users = await databases.listDocuments(dbId, usersMetaColId, [sdk.Query.limit(100)]);
    for (const user of users.documents) {
        await databases.updateDocument(dbId, usersMetaColId, user.$id, {
            current_article_id: null,
            dismissed_excerpts: []
        });
    }
    console.log(`Reset progression for ${users.documents.length} users.`);
}

wipe().catch(console.error);
