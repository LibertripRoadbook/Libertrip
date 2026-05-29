// api/generate-full.js
// POST /api/generate-full
// Génère les jours 2→N d'un roadbook payé.
// Appelé directement par le navigateur de l'utilisateur après paiement.
// Reçoit : { roadbook_id }
// Retourne : { ok: true } quand les jours sont sauvegardés en base.

import OpenAI from 'openai';
import { supabase } from '../lib/supabase.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../lib/prompt.js';

const openai         = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const UUID_REGEX     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const { roadbook_id } = req.body || {};

  if (!roadbook_id || !UUID_REGEX.test(roadbook_id)) {
    return json(res, 400, { error: 'ID invalide.' });
  }

  // Charger le roadbook
  const { data: rb, error } = await supabase
    .from('roadbooks')
    .select('id, criteria, day_1, days_full, payment_status')
    .eq('id', roadbook_id)
    .single();

  if (error || !rb) return json(res, 404, { error: 'Roadbook introuvable.' });

  // Vérifier que c'est bien payé
  if (rb.payment_status !== 'paid') {
    return json(res, 403, { error: 'Paiement requis.' });
  }

  // Si déjà généré, retourner directement
  if (rb.days_full && Array.isArray(rb.days_full) && rb.days_full.length > 0) {
    return json(res, 200, { ok: true, already_done: true });
  }

  const criteria = rb.criteria || {};
  const days     = Number(criteria.days) || 3;

  if (days <= 1) {
    // Voyage d'un seul jour, rien à générer
    await supabase.from('roadbooks').update({ days_full: [] }).eq('id', roadbook_id);
    return json(res, 200, { ok: true });
  }

  // Construire le prompt pour les jours 2→N
  const fullPrompt = `
${buildUserPrompt(criteria)}

MISSION SPÉCIALE — VERSION PREMIUM :
Le Jour 1 a déjà été généré.
Génère maintenant les jours 2 à ${days} avec le MÊME niveau de détail que le Jour 1.

JOUR 1 DÉJÀ GÉNÉRÉ (contexte, ne pas répéter) :
${JSON.stringify({ title: rb.day_1?.title, steps: (rb.day_1?.steps||[]).map(s => s.title) })}

FORMAT DE RÉPONSE — retourne UNIQUEMENT ce JSON :
{
  "days": [
    {
      "day": 2,
      "title": "...",
      "theme": "...",
      "distance_km": 0,
      "highlight": "...",
      "steps": [
        {
          "order": 1, "time": "HH:MM", "title": "...", "description": "...",
          "why_chosen": "...", "type": "stop",
          "duration_min": 60,
          "location": { "name": "...", "address": "...", "lat": 0.0, "lng": 0.0 },
          "access_point": { "label": "...", "lat": 0.0, "lng": 0.0, "note": "..." },
          "place_info": null, "price_info": null,
          "transport_tip": "...", "tips": [], "booking_url": null, "secret": false
        }
      ],
      "overnight": {
        "name": "...", "description": "...", "type": "hotel",
        "price_range": "...", "lat": 0.0, "lng": 0.0,
        "address": "...", "tips": "..."
      }
    }
  ]
}
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model:           'gpt-4o',
      max_tokens:      4000,
      temperature:     0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: fullPrompt }
      ]
    });

    const raw    = completion.choices[0]?.message?.content || '{"days":[]}';
    const parsed = JSON.parse(raw);
    const daysArr = Array.isArray(parsed) ? parsed : (parsed.days || []);

    await supabase
      .from('roadbooks')
      .update({ days_full: daysArr })
      .eq('id', roadbook_id);

    console.log(`[generate-full] ${daysArr.length} jours générés pour ${roadbook_id}`);
    return json(res, 200, { ok: true, days_count: daysArr.length });

  } catch (err) {
    console.error('[generate-full] Erreur OpenAI:', err.message);
    return json(res, 502, { error: 'Erreur IA. Réessaie.' });
  }
}
