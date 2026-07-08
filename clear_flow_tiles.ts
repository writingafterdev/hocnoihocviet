import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Client, Databases, Query } from 'appwrite';

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

const serverDatabases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const READING_EXCERPTS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_READING_EXCERPTS_COLLECTION_ID!;

async function clearFlowTiles() {
    try {
        console.log('Fetching flow-tiles excerpts to delete...');
        let offset = 0;
        const limit = 100;
        let totalDeleted = 0;

        while (true) {
            const result = await serverDatabases.listDocuments(
                DATABASE_ID,
                READING_EXCERPTS_COLLECTION_ID,
                [
                    Query.equal('game_id', 'flow-tiles'),
                    Query.limit(limit)
                ]
            );

            if (result.documents.length === 0) break;

            for (const doc of result.documents) {
                await serverDatabases.deleteDocument(DATABASE_ID, READING_EXCERPTS_COLLECTION_ID, doc.$id);
                totalDeleted++;
                console.log(`Deleted excerpt ${doc.$id}`);
            }
        }

        console.log(`Successfully deleted ${totalDeleted} flow-tiles excerpts.`);
    } catch (e) {
        console.error('Failed to clear excerpts:', e);
    }
}

clearFlowTiles();
