export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { prompt, modelId } = req.body;

  // Redirigimos tus opciones a los modelos 100% gratuitos de OpenRouter
  const modelMapping = {
    'gemini-1.5-flash': 'google/gemini-2.0-flash-lite-preview-02-05:free', // Súper rápido de Google
    'gemini-1.5-pro': 'google/gemini-2.0-flash-exp:free',                  // Versión avanzada de Google
    'gpt-4o-mini': 'meta-llama/llama-3.3-70b-instruct:free'                // Versión de Meta (Facebook)
  };

  const openRouterModel = modelMapping[modelId] || 'google/gemini-2.0-flash-lite-preview-02-05:free';

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