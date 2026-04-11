// Vercel serverless function — receives Stripe webhook events.
//
// We disable Vercel's default body parser so we can read the raw request
// bytes. Stripe signs the exact raw payload, and re-serializing a parsed
// JSON object would produce slightly different bytes and break the HMAC
// signature check.

import Stripe from 'stripe';

export const config = {
  api: { bodyParser: false }
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// ---- Welcome email (Resend) ----

const PLAN_DISPLAY_NAME = {
  essentiel: 'Essentiel',
  precision: 'Précision',
  pro: 'Pro'
};

function formatAmount(amountTotal, currency) {
  if (typeof amountTotal !== 'number' || !currency) return '';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amountTotal / 100);
  } catch {
    return `${(amountTotal / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// Email clients strip <style> outside <head>, so everything is inline.
// Table-based layout is the only reliable cross-client approach (Outlook
// in particular mangles div-based flex layouts).
function renderWelcomeEmail({ firstName, planLabel, priceLabel, appUrl }) {
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const planLine = planLabel
    ? `Votre abonnement <strong>${planLabel}</strong>${priceLabel ? ` (${priceLabel} / mois)` : ''} est désormais actif.`
    : 'Votre abonnement est désormais actif.';
  const planLineText = planLine.replace(/<[^>]+>/g, '');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bienvenue chez Elisa Health</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#1a1d27;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(15,17,23,0.06);">
          <tr><td style="height:6px; background-color:#0ea571; font-size:0; line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:40px 48px 0 48px;">
              <p style="margin:0; font-size:20px; font-weight:700; color:#0f1117; letter-spacing:-0.01em;">
                <span style="color:#0ea571;">🌿</span> Elisa Health
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px 0 48px;">
              <h1 style="margin:0; font-size:28px; line-height:1.2; font-weight:700; color:#0f1117; letter-spacing:-0.02em;">
                Bienvenue chez Elisa Health&nbsp;🌿
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 48px 0 48px;">
              <p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#1a1d27;">${greeting}</p>
              <p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#1a1d27;">
                Merci pour votre confiance. ${planLine}
              </p>
              <p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#1a1d27;">
                Vous avez dès à présent accès à l'ensemble des programmes inclus dans votre offre&nbsp;:
                plans nutritionnels personnalisés, protocoles biohacking, équilibre hormonal et analyse photo
                beauté — le tout piloté par notre IA <strong>Claude</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px 0 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#0ea571" style="border-radius:8px;">
                    <a href="${appUrl}"
                       style="display:inline-block; padding:14px 32px; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                      Lancer l'application&nbsp;→
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px 0 48px;">
              <p style="margin:0; font-size:14px; line-height:1.6; color:#6b7280;">
                Conseil&nbsp;: commencez par renseigner votre profil (âge, objectifs, allergies)
                dans le programme de votre choix. Elisa s'adaptera à vos réponses à chaque échange.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 48px 0 48px;">
              <p style="margin:0 0 8px 0; font-size:13px; line-height:1.6; color:#6b7280; border-top:1px solid #f3f4f6; padding-top:24px;">
                Une question ou un souci&nbsp;? Répondez directement à ce message ou écrivez-nous
                à <a href="mailto:contact@elisahealth.eu" style="color:#0ea571; text-decoration:none;">contact@elisahealth.eu</a>.
              </p>
              <p style="margin:0 0 24px 0; font-size:13px; line-height:1.6; color:#6b7280;">
                Vous pouvez gérer ou annuler votre abonnement à tout moment depuis votre espace client.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px 32px 48px; background-color:#f3f4f6;">
              <p style="margin:0; font-size:12px; line-height:1.5; color:#6b7280; text-align:center;">
                © 2026 Elisa Health SAS · Intelligence artificielle au service de votre santé.<br>
                Elisa Health ne se substitue pas à un avis médical professionnel.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    greeting,
    '',
    `Merci pour votre confiance. ${planLineText}`,
    '',
    `Vous avez dès à présent accès à l'ensemble des programmes inclus dans votre offre : plans nutritionnels personnalisés, protocoles biohacking, équilibre hormonal et analyse photo beauté — le tout piloté par notre IA Claude.`,
    '',
    `Lancer l'application : ${appUrl}`,
    '',
    `Conseil : commencez par renseigner votre profil (âge, objectifs, allergies) dans le programme de votre choix. Elisa s'adaptera à vos réponses à chaque échange.`,
    '',
    `Une question ? Répondez à ce message ou écrivez-nous à contact@elisahealth.eu.`,
    '',
    '— L\'équipe Elisa Health'
  ].join('\n');

  return { html, text };
}

// Sends the welcome email via Resend. Swallows its own errors: a webhook
// must never fail because of a side effect, or Stripe will retry for up
// to 3 days and deliver duplicate emails on every successful retry.
async function sendWelcomeEmail(session) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY is not configured — skipping welcome email');
    return;
  }

  const to = session.customer_details?.email || session.customer_email;
  if (!to) {
    console.warn('[resend] no customer email on session — skipping', { sessionId: session.id });
    return;
  }

  const fullName = session.customer_details?.name || '';
  const firstName = fullName.trim().split(/\s+/)[0] || '';
  const planSlug = session.metadata?.plan;
  const planLabel = PLAN_DISPLAY_NAME[planSlug] || '';
  const priceLabel = formatAmount(session.amount_total, session.currency);
  const appUrl = 'https://elisahealth.eu/app';

  const { html, text } = renderWelcomeEmail({ firstName, planLabel, priceLabel, appUrl });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Elisa Health <contact@elisahealth.eu>',
        to: [to],
        subject: 'Bienvenue chez Elisa Health 🌿',
        html,
        text,
        reply_to: 'contact@elisahealth.eu'
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[resend] welcome email failed', {
        sessionId: session.id,
        to,
        status: response.status,
        body: body.slice(0, 500)
      });
      return;
    }

    const data = await response.json().catch(() => ({}));
    console.log('[resend] welcome email sent', {
      sessionId: session.id,
      to,
      resendId: data.id
    });
  } catch (err) {
    console.error('[resend] welcome email threw', {
      sessionId: session.id,
      to,
      error: err.message
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  // .trim() defends against trailing whitespace/newlines introduced when
  // pasting secrets into the Vercel dashboard. For STRIPE_SECRET_KEY this
  // prevents a malformed Authorization header; for STRIPE_WEBHOOK_SECRET
  // this prevents a silently-wrong HMAC that would reject every live event.
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) {
    return res.status(500).json({
      error: { message: 'Stripe is not configured on the server.' }
    });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: { message: 'Missing stripe-signature header' } });
  }

  const stripe = new Stripe(secretKey);

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe] webhook signature verification failed:', err.message);
    return res.status(400).json({ error: { message: `Webhook Error: ${err.message}` } });
  }

  // Handle the events we care about. Persistence (DB write, email, etc.)
  // will be added when the backing store exists — for now we log.
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('[stripe] subscription created', {
        sessionId: session.id,
        customer: session.customer,
        subscription: session.subscription,
        customerEmail: session.customer_details?.email,
        plan: session.metadata?.plan,
        amountTotal: session.amount_total,
        currency: session.currency
      });
      // Fire-and-(self-contained-)forget: sendWelcomeEmail catches its
      // own errors so a mail failure never causes Stripe to retry.
      await sendWelcomeEmail(session);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log('[stripe] subscription cancelled', {
        subscriptionId: subscription.id,
        customer: subscription.customer,
        canceledAt: subscription.canceled_at,
        cancellationReason: subscription.cancellation_details?.reason
      });
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('[stripe] payment failed', {
        invoiceId: invoice.id,
        customer: invoice.customer,
        subscription: invoice.subscription,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt
      });
      break;
    }
    default:
      // Acknowledge unhandled event types so Stripe stops retrying them.
      break;
  }

  return res.status(200).json({ received: true });
}
