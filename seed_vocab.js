const { Client, Databases, ID } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const words = [
  { word: "Ineffable", pos: "adj", definition: "Too great or extreme to be expressed or described in words.", mastery: "new", interval: 0, ease_factor: 2.5, repetitions: 0 },
  { word: "Ephemeral", pos: "adj", definition: "Lasting for a very short time.", mastery: "new", interval: 0, ease_factor: 2.5, repetitions: 0 },
  { word: "Mellifluous", pos: "adj", definition: "Sweet or musical; pleasant to hear.", mastery: "new", interval: 0, ease_factor: 2.5, repetitions: 0 },
  { word: "Obfuscate", pos: "verb", definition: "Render obscure, unclear, or unintelligible.", mastery: "inReview", interval: 4, ease_factor: 2.3, repetitions: 2 },
  { word: "Sycophant", pos: "noun", definition: "A person who acts obsequiously toward someone important in order to gain advantage.", mastery: "learning", interval: 1, ease_factor: 2.4, repetitions: 1 },
];

async function seed() {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const colId = process.env.NEXT_PUBLIC_APPWRITE_VOCAB_COLLECTION_ID;

  for (const w of words) {
    const dueTime = new Date();
    dueTime.setHours(dueTime.getHours() - 1); // Make them due!

    try {
      await databases.createDocument(
        dbId,
        colId,
        ID.unique(),
        {
          word: w.word,
          pos: w.pos,
          definition: w.definition,
          mastery: w.mastery,
          next_review: dueTime.toISOString(),
          interval: w.interval,
          ease_factor: w.ease_factor,
          repetitions: w.repetitions
        },
        [
          `read("users")`,
          `update("users")`,
          `delete("users")`
        ]
      );
      console.log(`Seeded: ${w.word}`);
    } catch (err) {
      console.error(`Error seeding ${w.word}:`, err.message);
    }
  }
  console.log("Done seeding vocab.");
}

seed();
