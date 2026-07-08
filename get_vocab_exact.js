const { Client, Databases, Query } = require('node-appwrite');
const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a1d8fca002bb2a78d76')
  .setKey('standard_0d54373f226f0c107e3f9405675e3538b1b0eb64de93e570df284b69d701fcf4c4fd1347958e516511462bf870e4aefe9316222d27aa5ff79cbb13c90b7b221a9e466b5972be8f19ba6c9954a49f5a3103b4e5fd7640dc7d948f337d575ac527b5280ed148c49e2fdea1a1fc586d044d4cd3bd57b89e2c0e84c8bbcaa223dd0c');
const databases = new Databases(client);

async function test() {
  try {
    const res = await databases.listDocuments('fuckyoureading', 'vocab_entries', [
      Query.orderDesc('$createdAt'),
      Query.limit(10),
      Query.lessThanEqual('next_review', new Date().toISOString())
    ]);
    console.log(res.documents.length, 'docs found');
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
test();
