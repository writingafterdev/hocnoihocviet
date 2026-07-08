const { Client, Databases } = require('node-appwrite');
require('dotenv').config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

async function setupSkillsTracking() {
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const usersMetaId = process.env.NEXT_PUBLIC_APPWRITE_USERS_META_COLLECTION_ID;

  const skills = [
    'score_scanning',
    'score_deduction',
    'score_cohesion',
    'score_register',
    'score_syntax',
    'score_precision',
    'score_retrieval',
    'score_pronunciation'
  ];

  console.log('Adding skill tracking fields to users_meta collection...');

  for (const skill of skills) {
    try {
      await databases.createIntegerAttribute(
        dbId,
        usersMetaId,
        skill,
        false, // required must be false to have a default
        0, // min
        5000, // max
        1200 // default Elo
      );
      console.log(`Created attribute: ${skill}`);
      // Wait a bit to prevent rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      if (e.code === 409) {
        console.log(`Attribute ${skill} already exists. Skipping.`);
      } else {
        console.error(`Error creating attribute ${skill}:`, e.message);
      }
    }
  }

  console.log('Finished updating Appwrite schema.');
}

setupSkillsTracking().catch(console.error);
