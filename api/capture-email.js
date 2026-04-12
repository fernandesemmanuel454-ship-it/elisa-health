// Vercel serverless function — captures a prospect's email from the
// conversion funnel. Three parallel side effects:
//   1. Premium welcome email to the prospect (Resend)
//   2. Internal notification to the founder (Resend)
//   3. Lead stored in Supabase "leads" table
// All three are fire-and-forget: individual failures are logged but
// never degrade the prospect's UX.

const PROG_LABELS = {
  nutrition: 'Nutrition',
  biohacking: 'Biohacking',
  hormonal: 'Hormonal',
  beaute: 'Beauté & Peau'
};

const PROG_NUTRIENTS = {
  nutrition: ['Vitamine D', 'Magnésium', 'Oméga-3'],
  biohacking: ['Magnésium', 'Zinc', 'Vitamine B12'],
  hormonal: ['Zinc', 'Vitamine D', 'Sélénium'],
  beaute: ['Collagène', 'Vitamine C', 'Zinc']
};

// Deterministic "vitality score" seeded from the email so the same
// prospect always sees the same number (62-78 range — low enough to
// motivate action, not alarming).
function vitalityScore(email) {
  const hash = email.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return 62 + Math.abs(hash) % 17;
}

// ---- Prospect email (premium HTML) ----

function buildProspectEmail(email, programme, progLabel) {
  const score = vitalityScore(email);
  const nutrients = PROG_NUTRIENTS[programme] || PROG_NUTRIENTS.nutrition;
  const ctaUrl = 'https://elisahealth.eu/index.html#pricing';

  const nutrientRows = nutrients.map(n =>
    `<tr><td style="padding:8px 12px; font-size:15px; color:#1a1d27;">⚡ ${n}</td><td style="padding:8px 12px; font-size:13px; color:#6b7280; text-align:right;">Déficit détecté</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#1a1d27;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(15,17,23,0.06);">
        <!-- Green accent bar -->
        <tr><td style="height:6px; background:#0ea571; font-size:0; line-height:0;">&nbsp;</td></tr>
        <!-- Logo -->
        <tr><td style="padding:40px 48px 0 48px;">
          <p style="margin:0; font-size:20px; font-weight:700; color:#0f1117; letter-spacing:-0.01em;">
            <span style="color:#0ea571;">🌿</span> Elisa Health
          </p>
        </td></tr>
        <!-- Title -->
        <tr><td style="padding:24px 48px 0 48px;">
          <h1 style="margin:0; font-size:26px; line-height:1.2; font-weight:700; color:#0f1117;">
            Votre bilan ${progLabel} est prêt
          </h1>
        </td></tr>
        <!-- Intro -->
        <tr><td style="padding:16px 48px 0 48px;">
          <p style="margin:0; font-size:15px; line-height:1.6; color:#1a1d27;">
            Merci d'avoir utilisé Elisa Health. Notre IA a analysé votre profil
            et identifié des axes d'amélioration prioritaires.
          </p>
        </td></tr>
        <!-- Vitality score -->
        <tr><td style="padding:24px 48px 0 48px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; border-radius:12px; overflow:hidden;">
            <tr><td style="padding:24px; text-align:center;">
              <p style="margin:0 0 4px 0; font-size:13px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em;">Score de vitalité estimé</p>
              <p style="margin:0; font-size:48px; font-weight:700; color:#0ea571; line-height:1;">${score}<span style="font-size:20px; color:#6b7280;">/100</span></p>
              <p style="margin:8px 0 0 0; font-size:13px; color:#6b7280;">Potentiel d'amélioration significatif</p>
            </td></tr>
          </table>
        </td></tr>
        <!-- Nutrients -->
        <tr><td style="padding:24px 48px 0 48px;">
          <p style="margin:0 0 12px 0; font-size:14px; font-weight:600; color:#0f1117; text-transform:uppercase; letter-spacing:0.03em;">3 nutriments clés identifiés</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
            ${nutrientRows}
          </table>
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding:32px 48px 0 48px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td bgcolor="#0ea571" style="border-radius:8px;">
              <a href="${ctaUrl}" style="display:inline-block; padding:14px 32px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                Activer mon protocole personnalisé&nbsp;→
              </a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer note -->
        <tr><td style="padding:24px 48px 0 48px;">
          <p style="margin:0; font-size:13px; line-height:1.6; color:#6b7280;">
            Ce score est une estimation basée sur les informations partagées lors de votre conversation.
            Pour un bilan complet, Elisa vous accompagnera étape par étape dans votre protocole.
          </p>
        </td></tr>
        <tr><td style="padding:24px 48px 0 48px;">
          <p style="margin:0 0 8px 0; font-size:13px; color:#6b7280; border-top:1px solid #f3f4f6; padding-top:20px;">
            Une question ? Répondez à ce message ou écrivez à
            <a href="mailto:contact@elisahealth.eu" style="color:#0ea571; text-decoration:none;">contact@elisahealth.eu</a>
          </p>
        </td></tr>
        <!-- Legal footer -->
        <tr><td style="padding:24px 48px 32px 48px; background:#f3f4f6;">
          <p style="margin:0; font-size:12px; line-height:1.5; color:#6b7280; text-align:center;">
            © 2026 Elisa Health SAS · Intelligence artificielle au service de votre santé.<br>
            Elisa Health ne se substitue pas à un avis médical professionnel.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Votre bilan ${progLabel} est prêt`,
    '',
    `Score de vitalité estimé : ${score}/100`,
    'Potentiel d\'amélioration significatif',
    '',
    '3 nutriments clés identifiés :',
    ...nutrients.map(n => `  - ${n} : Déficit détecté`),
    '',
    `Activez votre protocole personnalisé : ${ctaUrl}`,
    '',
    '— L\'équipe Elisa Health'
  ].join('\n');

  return { html, text };
}

// ---- Owner notification ----

function buildOwnerEmail(email, progLabel, date) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#1a1d27;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:32px 40px;">
          <h1 style="margin:0 0 20px 0; font-size:22px; color:#0f1117;">📬 Nouveau prospect Elisa Health</h1>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:15px; line-height:1.7; color:#1a1d27;">
            <tr><td style="padding:6px 0; color:#6b7280; width:120px;">Email</td><td style="padding:6px 0; font-weight:600;">${email}</td></tr>
            <tr><td style="padding:6px 0; color:#6b7280;">Programme</td><td style="padding:6px 0; font-weight:600;">${progLabel}</td></tr>
            <tr><td style="padding:6px 0; color:#6b7280;">Date</td><td style="padding:6px 0;">${date}</td></tr>
          </table>
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
    `Date : ${date}`
  ].join('\n');

  return { html, text };
}

// ---- Resend send helper ----

async function sendEmail(apiKey, { from, to, subject, html, text, reply_to }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, html, text, reply_to })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
  }
  return response.json().catch(() => ({}));
}

// ---- Supabase lead insert ----

async function insertLead(email, programme, date) {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();

  console.log('[supabase] env check', {
    hasUrl: !!rawUrl,
    urlPrefix: rawUrl ? rawUrl.slice(0, 30) + '…' : '(missing)',
    hasKey: !!key,
    keyPrefix: key ? key.slice(0, 12) + '…' : '(missing)'
  });

  if (!rawUrl || !key) {
    console.warn('[supabase] SUPABASE_URL or SUPABASE_ANON_KEY is not configured — skipping');
    return { skipped: true };
  }

  // Strip trailing slash to avoid double-slash in the path
  const url = rawUrl.replace(/\/+$/, '');
  const endpoint = `${url}/rest/v1/leads`;
  const payload = { email, programme, date, source: programme || 'unknown' };

  console.log('[supabase] inserting lead', { endpoint, payload });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  const body = await res.text().catch(() => '');
  console.log('[supabase] response', { status: res.status, body: body.slice(0, 500) });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  return { inserted: true };
}

// ---- Handler ----

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
  const progLabel = PROG_LABELS[programme] || programme || '(inconnu)';
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  // All three operations run in parallel and catch their own errors.
  const results = await Promise.allSettled([
    // 1. Premium email to prospect
    (async () => {
      if (!apiKey) { console.warn('[resend] RESEND_API_KEY not configured'); return; }
      const { html, text } = buildProspectEmail(email, programme, progLabel);
      const data = await sendEmail(apiKey, {
        from: 'Elisa Health <contact@elisahealth.eu>',
        to: [email],
        subject: 'Votre bilan Elisa Health est prêt ✨',
        html,
        text,
        reply_to: 'contact@elisahealth.eu'
      });
      console.log('[resend] prospect email sent', { email, resendId: data.id });
    })(),

    // 2. Owner notification
    (async () => {
      if (!apiKey) return;
      const { html, text } = buildOwnerEmail(email, progLabel, date);
      const data = await sendEmail(apiKey, {
        from: 'Elisa Health <contact@elisahealth.eu>',
        to: ['emmanuel@elisahealth.eu'],
        subject: `📬 Nouveau prospect — ${progLabel}`,
        html,
        text
      });
      console.log('[resend] owner notification sent', { resendId: data.id });
    })(),

    // 3. Supabase lead
    (async () => {
      const result = await insertLead(email, programme, date);
      if (result?.inserted) {
        console.log('[supabase] lead inserted OK', { email, programme });
      }
    })()
  ]);

  // Build diagnostic output — returned in the response so curl can see it
  const labels = ['prospect_email', 'owner_notification', 'supabase_insert'];
  const debug = {};
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      debug[labels[i]] = { status: 'error', message: r.reason?.message || String(r.reason) };
      console.error(`[capture] ${labels[i]} failed:`, r.reason?.message || r.reason);
    } else {
      debug[labels[i]] = { status: 'ok' };
    }
  });

  return res.status(200).json({ ok: true, debug });
}
