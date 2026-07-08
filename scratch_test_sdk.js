const { Client, Storage } = require('appwrite');
const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('dummy_project_id');
const storage = new Storage(client);
console.log(storage.getFileView('bucket_id', 'file_id'));
