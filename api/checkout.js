// Vercel serverless function — creates a Stripe Checkout Session for a
// subscription plan. The client sends a plan slug only; the server maps
// the slug to a Stripe price ID from environment variables so the client
// can never request a tampered-with price.

import Stripe from 'stripe';

// Price IDs are not secrets — they're public identifiers that appear in
// Stripe receipts and checkout URLs — but the slug→price mapping MUST stay
// on the server. If the client could pick its own price_id, a visitor could
// swap "pro 129€" for any cheaper price and pay less. The client only sends
// a plan slug; the server resolves it to the real price.
const PLAN_TO_PRICE = {
  essentiel: 'price_1TLpwRAWkVVDRUkaYux4MvVM',
  precision: 'price_1TLpwwAWkVVDRUkaWCgRVvKA',
  pro: 'price_1TLpy9AWkVVDRUkaPiCvo3Wk'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  // .trim() guards against trailing whitespace/newlines in the env var
  // value (common when pasting from a dashboard), which would otherwise
  // corrupt the Authorization header and cause Node http.request to throw,
  // surfacing as a misleading "connection to Stripe" error.
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return res.status(500).json({
      error: { message: 'STRIPE_SECRET_KEY is not configured on the server.' }
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: { message: 'Invalid JSON body' } });
  }

  const plan = typeof body.plan === 'string' ? body.plan.toLowerCase() : null;
  const priceId = PLAN_TO_PRICE[plan];
  if (!priceId) {
    return res.status(400).json({
      error: { message: `Unknown plan "${plan}". Expected: essentiel, precision, pro.` }
    });
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${proto}://${host}`;

  try {
    const stripe = new Stripe(secretKey);
    const PLAN_LABELS = {
      essentiel: 'Elisa Health — Essentiel',
      precision: 'Elisa Health — Précision',
      pro: 'Elisa Health — Pro'
    };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'fr',
      metadata: { plan },
      subscription_data: {
        description: `Abonnement mensuel ${PLAN_LABELS[plan] || 'Elisa Health'} — renouvelé automatiquement chaque mois. Résiliable à tout moment.`,
        metadata: { plan }
      },
      custom_text: {
        submit: {
          message: 'Abonnement mensuel avec renouvellement automatique. Résiliable à tout moment. Service numérique fourni immédiatement après paiement.'
        }
      }
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[stripe] checkout session creation failed:', { plan, priceId, error: err.message, type: err.type, code: err.code });
    return res.status(502).json({
      error: { message: `Stripe error: ${err.message}` }
    });
  }
}
