// Vercel serverless function — captures a prospect's email from the
// conversion funnel and notifies the owner. Uses fetch against the
// Resend REST API directly (no SDK needed for a single POST).
//
// The endpoint always returns 200 to the client even if the Resend
// notification fails, so the prospect's UX is never degraded by a
// backend notification issue.

const PROG_LABELS = {
  nutrition: 'Nutrition',
  biohacking: 'Biohacking',
  hormonal: 'Hormonal',
  beaute: 'Beauté & Peau'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: { message: 'Invalid JSON body' } });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const programme = typeof body.programme === 'string' ? body.programme : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: { message: 'Adresse email invalide.' } });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY is not configured — skipping capture notification');
    return res.status(200).json({ ok: true });
  }

  const progLabel = PROG_LABELS[programme] || programme || '(inconnu)';
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#1a1d27;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:32px 40px 24px 40px;">
          <h1 style="margin:0 0 20px 0; font-size:22px; color:#0f1117;">📬 Nouveau prospect Elisa Health</h1>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:15px; line-height:1.7; color:#1a1d27;">
            <tr><td style="padding:6px 0; color:#6b7280; width:120px;">Email</td><td style="padding:6px 0; font-weight:600;">${email}</td></tr>
            <tr><td style="padding:6px 0; color:#6b7280;">Programme</td><td style="padding:6px 0; font-weight:600;">${progLabel}</td></tr>
            <tr><td style="padding:6px 0; color:#6b7280;">Date</td><td style="padding:6px 0;">${date}</td></tr>
            <tr><td style="padding:6px 0; color:#6b7280;">Source</td><td style="padding:6px 0;">Tunnel de conversion (3 msgs gratuits)</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 32px 40px;">
          <p style="margin:16px 0 0 0; font-size:13px; color:#6b7280; line-height:1.5;">
            Ce prospect a utilisé ses 3 messages gratuits et a donné son email pour voir son bilan complet.
            Il n'est pas encore client payant.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    '📬 Nouveau prospect Elisa Health',
    '',
    `Email : ${email}`,
    `Programme : ${progLabel}`,
    `Date : ${date}`,
    `Source : Tunnel de conversion (3 msgs gratuits)`,
    '',
    'Ce prospect a utilisé ses 3 messages gratuits et a donné son email pour voir son bilan complet.',
    'Il n\'est pas encore client payant.'
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Elisa Health <contact@elisahealth.eu>',
        to: ['emmanuel@elisahealth.eu'],
        subject: `📬 Nouveau prospect — ${progLabel}`,
        html,
        text
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error('[resend] capture notification failed', {
        email,
        programme,
        status: response.status,
        body: errBody.slice(0, 500)
      });
    } else {
      const data = await response.json().catch(() => ({}));
      console.log('[resend] capture notification sent', { email, programme, resendId: data.id });
    }
  } catch (err) {
    console.error('[resend] capture notification threw', { email, error: err.message });
  }

  return res.status(200).json({ ok: true });
}
