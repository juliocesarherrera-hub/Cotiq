export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { modelId, prompt } = req.body;

  // Mapeo de IDs de tu interfaz a los nombres oficiales en OpenRouter
  const modelMapping = {
    'antigravity-v1': 'google/gemini-2.0-flash-001',
    'gemini-3.1-flash-lite': 'google/gemini-2.0-flash-lite-001',
    'gpt-4o': 'openai/gpt-4o',
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'o3-mini': 'openai/o3-mini',
    'claude-3-7-sonnet': 'anthropic/claude-3.7-sonnet',
    'claude-3-5-sonnet': 'anthropic/claude-3.5-sonnet',
    'deepseek-v3': 'deepseek/deepseek-chat',
    'deepseek-r1': 'deepseek/deepseek-r1',
    'llama-3.3-70b': 'meta-llama/llama-3.3-70b-instruct',
    'grok-2': 'x-ai/grok-2-1212'
  };

  const targetModel = modelMapping[modelId] || 'google/gemini-2.0-flash-lite-001';

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Error en la respuesta del proveedor');
    }

    const replyText = data.choices[0]?.message?.content || '';
    return res.status(200).json({ text: replyText });

  } catch (error) {
    console.error("Error al conectar con la IA:", error);
    return res.status(500).json({ error: error.message || "Error interno al procesar la solicitud" });
  }
}