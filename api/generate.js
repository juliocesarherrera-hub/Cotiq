export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { prompt, modelId } = req.body;

  // Nombres corregidos exactamente como los exige OpenRouter
  const modelMapping = {
    'gemini-1.5-flash': 'google/gemini-flash-1.5',
    'gemini-1.5-pro': 'google/gemini-pro-1.5',
    'gpt-4o-mini': 'openai/gpt-4o-mini'
  };

  const openRouterModel = modelMapping[modelId] || 'google/gemini-flash-1.5';

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Error en la API de IA' });
    }

    return res.status(200).json({ text: data.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor al contactar a la IA.' });
  }
}