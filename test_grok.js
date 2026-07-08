const apiKey = 'xai-ZcghpJxWM5iwX46B1tv4P7xeaZFLJMEPijEoG2oGmqjWIwXA4EoN0R7g5k8lADFpGnzJLIs6rOvdPFWT';

async function testGrok(modelName) {
  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Say hi in JSON format: {"message":"hi"}' }],
        response_format: { type: 'json_object' }
      })
    });
    
    if (res.ok) {
      console.log(`Model ${modelName} WORKED.`);
    } else {
      const text = await res.text();
      console.log(`Model ${modelName} FAILED: ${text}`);
    }
  } catch(e) {
    console.log(`Model ${modelName} ERROR:`, e);
  }
}

async function run() {
  await testGrok('grok-2-latest');
  await testGrok('grok-2-1212');
  await testGrok('grok-beta');
  await testGrok('grok-2');
}

run();
