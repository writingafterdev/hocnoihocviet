export async function generateGrokJSON(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error('Missing GROK_API_KEY environment variable');

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4.3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Grok API Error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to parse Grok JSON:", content);
    throw new Error("Grok did not return valid JSON");
  }
}
