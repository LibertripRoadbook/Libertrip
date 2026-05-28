// api/generate.js
// Vercel Serverless Function — POST /api/generate
//
// Reçoit les réponses du formulaire LIBERTRIP (10 questions + email),
// appelle l'API IA, enregistre le roadbook dans Supabase,
// et retourne l'UUID unique pour redirection vers /roadbook/[id].

import { supabase }                      from '../lib/supabase.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../lib/prompt.js';
import { sendRoadbookReadyEmail }         from '../lib/email.js';
import OpenAI                             from 'openai';

// ── Constantes ────────────────────────────────────────────────────────────────

const OPENAI_MODEL   = 'gpt-4o';
const MAX_TOKENS     = 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // Restreindre en prod

// ── Initialisation OpenAI ─────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Valide les données du formulaire reçues.
 * @returns {string|null} Message d'erreur ou null si valide.
 */
function validateCriteria(body) {
  if (!body || typeof body !== 'object') return 'Corps de requête invalide.';
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return 'Email invalide ou manquant.';
  }
  if (!body.destination || String(body.destination).trim().length < 2) {
    return 'Destination manquante.';
  }
  const days = Number(body.days);
  if (!body.days || isNaN(days) || days < 1 || days > 30) {
    return 'Durée invalide (1-30 jours).';
  }
  return null;
}

/**
 * Extrait et parse le JSON retourné par l'IA.
 * Gère les cas où le modèle entoure le JSON de backticks markdown.
 */
function parseAIResponse(content) {
  // Nettoyer les éventuels ```json ... ``` ajoutés par le modèle
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

/**
 * Envoie une réponse JSON avec les headers CORS.
 */
function jsonResponse(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(status).json(data);
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // Pre-flight CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  // Méthode autorisée : POST seulement
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Méthode non autorisée.' });
  }

  // ── 1. Validation des données entrantes ──────────────────────────────────

  const body       = req.body;
  const validError  = validateCriteria(body);

  if (validError) {
    return jsonResponse(res, 400, { error: validError });
  }

  const criteria = {
    companion:       body.companion        || 'solo',
    destination:     String(body.destination).trim(),
    vehicle:         body.vehicle          || 'van',
    days:            Number(body.days),
    rhythm:          body.rhythm           || 'equilibre',
    accommodation:   Array.isArray(body.accommodation) ? body.accommodation : (body.accommodation ? [body.accommodation] : []),
    food:            body.food             || 'local',
    interests:       Array.isArray(body.interests)     ? body.interests     : [],
    departure_place: body.departure_place  || '',
    departure_date:  body.departure_date   || '',
    departure_time:  body.departure_time   || '',
    lodgings:        Array.isArray(body.lodgings) ? body.lodgings.filter(l => l.trim()) : [],
    budget_level:    body.budget_level   || 'medium',
    budget_amount:   body.budget_amount  || null,
  };

  const email = body.email.toLowerCase().trim();

  // ── 2. Appel API IA ──────────────────────────────────────────────────────

  let aiData;

  try {
    const completion = await openai.chat.completions.create({
      model:       OPENAI_MODEL,
      max_tokens:  MAX_TOKENS,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: buildUserPrompt(criteria) }
      ],
      // Force un output JSON valide (disponible sur gpt-4o)
      response_format: { type: 'json_object' }
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) throw new Error('Réponse IA vide.');

    aiData = parseAIResponse(rawContent);

    // Vérification minimale de la structure
    if (!aiData.day_1 || !aiData.logistics) {
      throw new Error('Structure JSON IA incomplète.');
    }

  } catch (aiError) {
    console.error('[generate] Erreur appel IA :', aiError.message);
    return jsonResponse(res, 502, {
      error: 'Erreur lors de la génération IA. Réessaie dans quelques instants.'
    });
  }

  // ── 3. Enregistrement dans Supabase ──────────────────────────────────────

  const { data: inserted, error: dbError } = await supabase
    .from('roadbooks')
    .insert({
      email,
      criteria,
      day_1:          aiData.day_1,
      logistics:      aiData.logistics,
      days_full:      null,           // Généré après paiement (voir /api/generate-full.js)
      days_preview:   aiData.days_preview || [],
      payment_status: 'pending'
    })
    .select('id')
    .single();

  if (dbError || !inserted) {
    console.error('[generate] Erreur Supabase insert :', dbError);
    return jsonResponse(res, 500, {
      error: 'Erreur lors de la sauvegarde. Contactez le support.'
    });
  }

  // ── 4. Email de confirmation (non bloquant) ──────────────────────────────

  sendRoadbookReadyEmail({
    to:          email,
    destination: criteria.destination,
    roadbookId:  inserted.id,
  }).catch(err => console.error('[generate] Erreur envoi email:', err));

  // ── 5. Réponse succès ────────────────────────────────────────────────────

  return jsonResponse(res, 200, {
    success:    true,
    roadbook_id: inserted.id,
    redirect:   `/roadbook/${inserted.id}`
  });
}
