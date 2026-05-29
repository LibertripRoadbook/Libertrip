// api/create-checkout.js
// POST /api/create-checkout
// Crée une Stripe Checkout Session dynamique pour débloquer un roadbook.
// Reçoit : { roadbook_id, promo_code? }
// Retourne : { url } — l'URL de la page de paiement Stripe

import Stripe from 'stripe';

const stripe      = new Stripe(process.env.STRIPE_SECRET_KEY);
const BASE_URL    = process.env.NEXT_PUBLIC_BASE_URL || 'https://libertrip.vercel.app';
const PRICE_ID    = 'price_1Tc6yzFFqge1aosio2n4yXnH'; // 14,99€ one-time
const UUID_REGEX  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(status).json(data);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Méthode non autorisée.' });

  const { roadbook_id, promo_code } = req.body || {};

  if (!roadbook_id || !UUID_REGEX.test(roadbook_id)) {
    return json(res, 400, { error: 'ID roadbook invalide.' });
  }

  try {
    const sessionParams = {
      mode: 'payment',
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      client_reference_id: roadbook_id,
      success_url: `${BASE_URL}/roadbook/${roadbook_id}?paid=1`,
      cancel_url:  `${BASE_URL}/roadbook/${roadbook_id}`,
      allow_promotion_codes: true,
      metadata: { roadbook_id },
    };

    // Pré-remplir le code promo si fourni
    if (promo_code) {
      try {
        const promos = await stripe.promotionCodes.list({ code: promo_code, active: true, limit: 1 });
        if (promos.data.length > 0) {
          sessionParams.discounts = [{ promotion_code: promos.data[0].id }];
          delete sessionParams.allow_promotion_codes;
        }
      } catch(e) { /* ignore promo errors */ }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return json(res, 200, { url: session.url });

  } catch (err) {
    console.error('[create-checkout] Erreur Stripe:', err.message);
    return json(res, 500, { error: 'Impossible de créer la session de paiement.' });
  }
}
