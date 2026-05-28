// api/generate.js
// Vercel Serverless Function â€” POST /api/generate
//
// ReÃ§oit les rÃ©ponses du formulaire LIBERTRIP (10 questions + email),
// appelle l'API IA, enregistre le roadbook dans Supabase,
// et retourne l'UUID unique pour redirection vers /roadbook/[id].

import { supabase }                      from '../lib/supabase.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../lib/prompt.js';
import OpenAI                             from 'openai';

// â”€â”€ Constantes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const OPENAI_MODEL   = 'gpt-4o';          // ou 'gpt-4o-mini' pour rÃ©duire les coÃ»ts
const MAX_TOKENS     = 4096;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // Restreindre en prod

// â”€â”€ Initialisation OpenAI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Valide les donnÃ©es du formulaire reÃ§ues.
 * @returns {string|null} Message d'erreur ou null si valide.
 */
function validateCriteria(body) {
  if (!body || typeof body !== 'object') return 'Corps de requÃªte invalide.';
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return 'Email invalide ou manquant.';
  }
  if (!body.destination || String(body.destination).trim().length < 2) {
    return 'Destination manquante.';
  }
  const days = Number(body.days);
  if (!body.days || isNaN(days) || days < 1 || days > 30) {
    return 'DurÃ©e invalide (1-30 jours).';
  }
  return null;
}

/**
 * Extrait et parse le JSON retournÃ© par l'IA.
 * GÃ¨re les cas oÃ¹ le modÃ¨le entoure le JSON de backticks markdown.
 */
function parseAIResponse(content) {
  // Nettoyer les Ã©ventuels ```json ... ``` ajoutÃ©s par le modÃ¨le
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

/**
 * Envoie une rÃ©ponse JSON avec les headers CORS.
 */
function jsonResponse(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(status).json(data);
}

// â”€â”€ Handler principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default async function handler(req, res) {

  // Pre-flight CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  // MÃ©thode autorisÃ©e : POST seulement
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'MÃ©thode non autorisÃ©e.' });
  }

  // â”€â”€ 1. Validation des donnÃ©es entrantes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  };

  const email = body.email.toLowerCase().trim();

  // â”€â”€ 2. Appel API IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    if (!rawContent) throw new Error('RÃ©ponse IA vide.');

    aiData = parseAIResponse(rawContent);

    // VÃ©rification minimale de la structure
    if (!aiData.day_1 || !aiData.logistics) {
      throw new Error('Structure JSON IA incomplÃ¨te.');
    }

  } catch (aiError) {
    console.error('[generate] Erreur appel IA :', aiError.message);
    return jsonResponse(res, 502, {
      error: 'Erreur lors de la gÃ©nÃ©ration IA. RÃ©essaie dans quelques instants.'
    });
  }

  // â”€â”€ 3. Enregistrement dans Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const { data: inserted, error: dbError } = await supabase
    .from('roadbooks')
    .insert({
      email,
      criteria,
      day_1:          aiData.day_1,
      logistics:      aiData.logistics,
      days_full:      null,           // GÃ©nÃ©rÃ© aprÃ¨s paiement (voir /api/generate-full.js)
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

  // â”€â”€ 4. RÃ©ponse succÃ¨s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return jsonResponse(res, 200, {
    success:    true,
    roadbook_id: inserted.id,
    redirect:   `/roadbook/${inserted.id}`
  });
}
