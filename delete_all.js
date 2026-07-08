const sdk = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new sdk.Client();
client
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new sdk.Databases(client);

async function deleteAll() {
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
    const colId = process.env.NEXT_PUBLIC_APPWRITE_READING_EXCERPTS_COLLECTION_ID;

    console.log(`Deleting all excerpts from ${dbId} / ${colId}`);

    let count = 0;
    while (true) {
        const res = await databases.listDocuments(dbId, colId, [sdk.Query.limit(100)]);
        if (res.documents.length === 0) {
            break;
        }

        for (const doc of res.documents) {
            await databases.deleteDocument(dbId, colId, doc.$id);
            count++;
        }
        console.log(`Deleted ${count} documents so far...`);
    }

    console.log(`Done. Deleted total ${count} excerpts.`);
}

deleteAll().catch(console.error);
