const { Client, Users, Databases, ID, Permission, Role } = require('node-appwrite');

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a1d8fca002bb2a78d76')
  .setKey('standard_0d54373f226f0c107e3f9405675e3538b1b0eb64de93e570df284b69d701fcf4c4fd1347958e516511462bf870e4aefe9316222d27aa5ff79cbb13c90b7b221a9e466b5972be8f19ba6c9954a49f5a3103b4e5fd7640dc7d948f337d575ac527b5280ed148c49e2fdea1a1fc586d044d4cd3bd57b89e2c0e84c8bbcaa223dd0c');

const users = new Users(client);
const databases = new Databases(client);

const DB_ID = 'fuckyoureading';
const VOCAB_COLLECTION = 'vocab_entries';

const dummyWords = [
  { word: "Ephemeral", pos: "adj.", definition: "Lasting for a very short time.", example: "The ephemeral beauty of a sunset." },
  { word: "Serendipity", pos: "n.", definition: "The occurrence and development of events by chance in a happy or beneficial way.", example: "A stroke of serendipity led to their meeting." },
  { word: "Ubiquitous", pos: "adj.", definition: "Present, appearing, or found everywhere.", example: "His ubiquitous influence was felt by everyone." },
  { word: "Lucid", pos: "adj.", definition: "Expressed clearly; easy to understand.", example: "A lucid account of complex events." },
  { word: "Ineffable", pos: "adj.", definition: "Too great or extreme to be expressed or described in words.", example: "The ineffable natural beauty of the Everglades." },
  { word: "Mellifluous", pos: "adj.", definition: "Sweet or musical; pleasant to hear.", example: "The voice was mellifluous and smooth." },
  { word: "Nefarious", pos: "adj.", definition: "Wicked or criminal.", example: "The nefarious activities of the organized crime syndicates." },
  { word: "Cacophony", pos: "n.", definition: "A harsh discordant mixture of sounds.", example: "A cacophony of deafening alarm bells." },
  { word: "Sycophant", pos: "n.", definition: "A person who acts obsequiously toward someone important in order to gain advantage.", example: "He was surrounded by sycophants." },
  { word: "Alacrity", pos: "n.", definition: "Brisk and cheerful readiness.", example: "She accepted the invitation with alacrity." },
];

async function seed() {
  try {
    const userList = await users.list();
    if (userList.users.length === 0) {
      console.log("No users found in Appwrite! Please create an account in the app first.");
      return;
    }
    const userId = userList.users[0].$id;
    console.log(`Seeding for user: ${userId}`);

    for (const item of dummyWords) {
      await databases.createDocument(
        DB_ID,
        VOCAB_COLLECTION,
        ID.unique(),
        {
          word: item.word,
          pos: item.pos,
          definition: item.definition,
          example: item.example,
          tags: ['Dummy Data'],
          mastery: 'new',
          next_review: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          interval: 0,
          ease_factor: 2.5,
          repetitions: 0
        },
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId))
        ]
      );
      console.log(`Seeded word: ${item.word}`);
    }
    console.log("Seeding complete!");
  } catch (err) {
    console.error(err);
  }
}

seed();
