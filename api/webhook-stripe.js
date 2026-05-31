// api/webhook-stripe.js
// POST /api/webhook-stripe
// Reçoit les événements Stripe, vérifie la signature, met à jour Supabase.
// La génération des jours complets est déclenchée par le frontend (api/generate-full.js).

import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';
import { sendRoadbookUnlockedEmail } from '../lib/email.js';

export const config = { api: { bodyParser: false } };

const stripe        = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig     = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session    = event.data.object;
      const roadbookId = session.client_reference_id || session.metadata?.roadbook_id;

      if (!roadbookId) {
        console.warn('[webhook] checkout.session.completed sans roadbook_id');
        break;
      }

      const { error } = await supabase
        .from('roadbooks')
        .update({
          payment_status:    'paid',
          stripe_session_id: session.id,
          paid_at:           new Date().toISOString()
        })
        .eq('id', roadbookId);

      if (error) {
        console.error('[webhook] Erreur Supabase:', error.message);
      } else {
        console.log(`[webhook] Roadbook ${roadbookId} marqué payé.`);
        // Envoyer l'email de confirmation avec lien roadbook complet
        try {
          const { data: rb } = await supabase
            .from('roadbooks')
            .select('email, criteria')
            .eq('id', roadbookId)
            .single();
          if (rb?.email) {
            await sendRoadbookUnlockedEmail({
              to:          rb.email,
              destination: rb.criteria?.destination || '',
              roadbookId,
              days:        rb.criteria?.days || null,
            });
            console.log(`[webhook] Email de confirmation envoyé à ${rb.email}`);
          }
        } catch (emailErr) {
          console.error('[webhook] Erreur envoi email confirmation:', emailErr.message);
        }
      }
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      if (charge.payment_intent) {
        try {
          const pi = await stripe.paymentIntents.retrieve(charge.payment_intent);
          if (pi.metadata?.roadbook_id) {
            await supabase
              .from('roadbooks')
              .update({ payment_status: 'refunded' })
              .eq('id', pi.metadata.roadbook_id);
            console.log(`[webhook] Roadbook ${pi.metadata.roadbook_id} remboursé.`);
          }
        } catch(e) { /* ignore */ }
      }
      break;
    }

    default:
      console.log(`[webhook] Événement ignoré: ${event.type}`);
  }

  return res.status(200).json({ received: true });
}
