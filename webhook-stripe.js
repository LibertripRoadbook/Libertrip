// api/webhook-stripe.js
// Vercel Serverless Function — POST /api/webhook-stripe
//
// Reçoit les événements Stripe (checkout.session.completed, etc.).
// Vérifie la signature cryptographique Stripe avant tout traitement.
// Met à jour le statut du roadbook et déclenche la génération complète.

import Stripe   from 'stripe';
import { supabase } from '../lib/supabase.js';

// ── IMPORTANT : désactiver le body parser de Vercel pour ce endpoint ─────────
// Stripe a besoin du body brut (Buffer) pour vérifier la signature.
export const config = {
  api: { bodyParser: false }
};

const stripe          = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret   = process.env.STRIPE_WEBHOOK_SECRET;

// ── Helper : lire le corps brut de la requête ─────────────────────────────────

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  ()    => resolve(Buffer.concat(chunks)));
    req.on('error', err  => reject(err));
  });
}

// ── Génération des jours complets après paiement ──────────────────────────────
// On importe OpenAI ici pour éviter la dépendance circulaire avec generate.js

import OpenAI from 'openai';
import { SYSTEM_PROMPT, buildUserPrompt } from '../lib/prompt.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Génère les jours 2 → N pour un roadbook déjà en base.
 * Appelé après confirmation de paiement Stripe.
 */
async function generateFullRoadbook(roadbookId, criteria, day1) {
  try {
    const fullPrompt = `
${buildUserPrompt(criteria)}

MISSION SPÉCIALE — VERSION PREMIUM :
Le Jour 1 a déjà été généré (ci-dessous).
Génère maintenant les jours 2 à ${criteria.days} avec le MÊME niveau de détail que le Jour 1.

JOUR 1 DÉJÀ GÉNÉRÉ (ne pas répéter) :
${JSON.stringify(day1, null, 2)}

FORMAT DE RÉPONSE :
Retourne UNIQUEMENT un tableau JSON :
[
  { "day": 2, "title": "...", "theme": "...", "distance_km": X, "highlight": "...", "steps": [...], "overnight": {...} },
  { "day": 3, ... },
  ...
]
    `.trim();

    const completion = await openai.chat.completions.create({
      model:       'gpt-4o',
      max_tokens:  8000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: fullPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    const raw     = completion.choices[0]?.message?.content || '{"days":[]}';
    const parsed  = JSON.parse(raw);
    const daysArr = Array.isArray(parsed) ? parsed : (parsed.days || []);

    // Mise à jour en base
    await supabase
      .from('roadbooks')
      .update({ days_full: daysArr })
      .eq('id', roadbookId);

    console.log(`[webhook] days_full généré pour roadbook ${roadbookId}`);

  } catch (err) {
    // On ne bloque pas le webhook si la génération échoue (elle sera retenée plus tard)
    console.error(`[webhook] Erreur génération days_full pour ${roadbookId}:`, err.message);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).end('Méthode non autorisée');
  }

  // ── 1. Vérification de la signature Stripe ───────────────────────────────

  const sig     = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature invalide :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ── 2. Traitement des événements ─────────────────────────────────────────

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;

      // L'UUID du roadbook est passé via client_reference_id (Payment Link + URL param)
      // ou via metadata.roadbook_id (Checkout Session créée manuellement)
      const roadbookId = session.client_reference_id || session.metadata?.roadbook_id;

      if (!roadbookId) {
        console.warn('[webhook] checkout.session.completed sans roadbook_id dans metadata');
        break;
      }

      // Mettre à jour le statut
      const { data: rb, error } = await supabase
        .from('roadbooks')
        .update({
          payment_status:   'paid',
          stripe_session_id: session.id,
          paid_at:          new Date().toISOString()
        })
        .eq('id', roadbookId)
        .select('criteria, day_1')
        .single();

      if (error) {
        console.error('[webhook] Erreur mise à jour Supabase :', error);
        break;
      }

      console.log(`[webhook] Roadbook ${roadbookId} marqué comme payé.`);

      // Déclencher la génération des jours complets (async, non-bloquant pour Stripe)
      generateFullRoadbook(roadbookId, rb.criteria, rb.day_1);
      break;
    }

    case 'checkout.session.expired': {
      // Optionnel : loguer les sessions abandonnées
      console.log('[webhook] Session Stripe expirée :', event.data.object.id);
      break;
    }

    case 'charge.refunded': {
      const charge     = event.data.object;
      // Récupérer la session liée à ce charge pour trouver l'ID roadbook
      if (charge.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(charge.payment_intent);
        if (pi.metadata?.roadbook_id) {
          await supabase
            .from('roadbooks')
            .update({ payment_status: 'refunded' })
            .eq('id', pi.metadata.roadbook_id);
          console.log(`[webhook] Roadbook ${pi.metadata.roadbook_id} marqué comme remboursé.`);
        }
      }
      break;
    }

    default:
      // Ignorer les autres événements
      console.log(`[webhook] Événement ignoré : ${event.type}`);
  }

  // Stripe attend un 200 rapide pour confirmer la réception
  return res.status(200).json({ received: true });
}
