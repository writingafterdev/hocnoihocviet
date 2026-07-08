// src/lib/appwrite-server.ts
// Server-side Appwrite SDK (API key — never expose to browser)

import { Client, Databases, Storage } from 'appwrite';

const serverClient = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

export const serverDatabases = new Databases(serverClient);
export const serverStorage = new Storage(serverClient);

export { serverClient };
