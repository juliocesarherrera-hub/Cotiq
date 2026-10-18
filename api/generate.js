export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { prompt, modelId } = req.body;

  // Traducimos el ID de tu pantalla al formato exacto que pide OpenRouter
  const modelMapping = {
    'gemini-1.5-flash': 'google/gemini-1.5-flash',
    'gemini-1.5-pro': 'google/gemini-1.5-pro',
    'gpt-4o-mini': 'openai/gpt-4o-mini'
  };

  // Si por alguna razón no detecta el modelo, usa Flash por defecto
  const openRouterModel = modelMapping[modelId] || 'google/gemini-1.5-flash';

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
      // Si la API falla, devolvemos el error exacto para saber qué falló
      return res.status(response.status).json({ error: data.error?.message || 'Error en la API de IA' });
    }

    // Si todo sale bien, extraemos el texto y se lo mandamos a tu página
    return res.status(200).json({ text: data.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor al contactar a la IA.' });
  }
}