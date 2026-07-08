const { Client, Storage } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });
const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
const storage = new Storage(client);
const bucket = process.env.NEXT_PUBLIC_APPWRITE_COVERS_BUCKET_ID;
console.log("View:", storage.getFileView(bucket, 'some-file-id').toString());
console.log("Preview:", storage.getFilePreview(bucket, 'some-file-id').toString());
