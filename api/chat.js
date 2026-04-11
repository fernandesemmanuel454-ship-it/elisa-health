// Vercel serverless function — proxies chat requests to the Anthropic API.
// The ANTHROPIC_API_KEY environment variable is read server-side so the key
// is never exposed to the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: { message: 'ANTHROPIC_API_KEY is not configured on the server.' }
    });
  }

  // Vercel parses JSON bodies automatically when Content-Type is application/json,
  // but fall back to manual parsing just in case.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: { message: 'Invalid JSON body' } });
  }

  const { system, messages, model, max_tokens } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: '`messages` must be a non-empty array' } });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 2048,
        system,
        messages
      })
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({
      error: { message: `Upstream request failed: ${err.message}` }
    });
  }
}
