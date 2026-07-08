const { Client, Databases } = require('node-appwrite');

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a1d8fca002bb2a78d76')
  .setKey('standard_0d54373f226f0c107e3f9405675e3538b1b0eb64de93e570df284b69d701fcf4c4fd1347958e516511462bf870e4aefe9316222d27aa5ff79cbb13c90b7b221a9e466b5972be8f19ba6c9954a49f5a3103b4e5fd7640dc7d948f337d575ac527b5280ed148c49e2fdea1a1fc586d044d4cd3bd57b89e2c0e84c8bbcaa223dd0c');

const databases = new Databases(client);

async function increaseLimit() {
  try {
    const dbId = 'fuckyoureading';
    const colId = 'articles';
    
    console.log('Increasing body attribute size to 5,000,000...');
    await databases.updateStringAttribute(dbId, colId, 'body', 5000000, true);
    console.log('Successfully requested size increase. It may take a few seconds to process.');
    
    // Poll until ready
    while (true) {
      const attr = await databases.getAttribute(dbId, colId, 'body');
      if (attr.status === 'available') {
        console.log('Attribute size is now updated and ready!');
        break;
      }
      if (attr.status === 'failed') {
        console.error('Attribute update failed.');
        break;
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.error(e);
  }
}

increaseLimit();
