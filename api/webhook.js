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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
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
