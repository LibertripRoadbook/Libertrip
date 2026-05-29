// api/generate-full.js
// POST /api/generate-full
// Génère UN jour à la fois pour un roadbook payé.
// Appelé en boucle par le navigateur jusqu'à ce que tous les jours soient générés.
// Reçoit : { roadbook_id, day_number }
// Retourne : { ok: true, day_number, done: bool }

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

  const { roadbook_id, day_number } = req.body || {};

  if (!roadbook_id || !UUID_REGEX.test(roadbook_id)) {
    return json(res, 400, { error: 'ID invalide.' });
  }

  const dayNum = Number(day_number);
  if (!dayNum || dayNum < 2) {
    return json(res, 400, { error: 'day_number invalide (min 2).' });
  }

  // Charger le roadbook
  const { data: rb, error } = await supabase
    .from('roadbooks')
    .select('id, criteria, day_1, days_full, payment_status')
    .eq('id', roadbook_id)
    .single();

  if (error || !rb) return json(res, 404, { error: 'Roadbook introuvable.' });

  if (rb.payment_status !== 'paid') {
    return json(res, 403, { error: 'Paiement requis.' });
  }

  const criteria  = rb.criteria || {};
  const totalDays = Number(criteria.days) || 3;

  if (dayNum > totalDays) {
    return json(res, 400, { error: `Jour ${dayNum} hors limites (max ${totalDays}).` });
  }

  // Si ce jour est déjà dans days_full, on skip
  const existing = Array.isArray(rb.days_full) ? rb.days_full : [];
  if (existing.find(d => d.day === dayNum)) {
    const done = existing.length >= (totalDays - 1);
    return json(res, 200, { ok: true, day_number: dayNum, skipped: true, done });
  }

  // Contexte des jours déjà générés (jour 1 + jours précédents déjà en base)
  const previousDays = [
    { day: 1, title: rb.day_1?.title, steps: (rb.day_1?.steps || []).map(s => s.title) },
    ...existing.filter(d => d.day < dayNum).map(d => ({
      day: d.day, title: d.title, steps: (d.steps || []).map(s => s.title)
    }))
  ];

  // Récupérer le lieu de nuit du jour précédent pour forcer la continuité géographique
  const prevDayData = dayNum === 2
    ? rb.day_1
    : existing.find(d => d.day === dayNum - 1);
  const prevOvernight = prevDayData?.overnight
    ? `${prevDayData.overnight.name}${prevDayData.overnight.address ? ' (' + prevDayData.overnight.address + ')' : ''}`
    : null;

  const dayPrompt = `
${buildUserPrompt(criteria)}

MISSION — VERSION PREMIUM, JOUR ${dayNum} UNIQUEMENT :
Les jours précédents ont déjà été générés. Génère UNIQUEMENT le Jour ${dayNum} sur ${totalDays}.

RÈGLE GÉOGRAPHIQUE ABSOLUE POUR CE JOUR :
${prevOvernight
  ? `- Ce jour commence depuis le lieu de nuit du jour précédent : "${prevOvernight}". La première étape doit partir de là ou de ses environs immédiats.`
  : '- Assure-toi de partir du lieu de nuit du jour précédent.'
}
- Le lieu de nuit ("overnight") de ce jour doit être positionné géographiquement entre les activités d'aujourd'hui et celles du Jour ${dayNum + 1} (si applicable). Pas d'aller-retour.
- La route de ce jour doit avancer dans la direction logique du voyage global vers "${criteria.destination || 'la destination'}".

JOURS DÉJÀ GÉNÉRÉS (contexte géographique — ne pas répéter ces lieux) :
${JSON.stringify(previousDays)}

FORMAT DE RÉPONSE — retourne UNIQUEMENT ce JSON :
{
  "day": ${dayNum},
  "title": "...",
  "theme": "...",
  "distance_km": 0,
  "highlight": "...",
  "steps": [
    {
      "order": 1, "time": "HH:MM", "title": "...", "description": "...",
      "why_chosen": "...", "type": "stop", "duration_min": 60,
      "location": { "name": "...", "address": "...", "lat": 0.0, "lng": 0.0 },
      "access_point": { "label": "...", "lat": 0.0, "lng": 0.0, "note": "..." },
      "place_info": null, "price_info": null,
      "transport_tip": "...", "tips": [], "booking_url": null, "secret": false
    }
  ],
  "overnight": {
    "name": "...", "description": "...", "type": "hotel",
    "price_range": "...", "lat": 0.0, "lng": 0.0, "address": "...", "tips": "..."
  }
}

IMPORTANT : 3 à 5 étapes, concis (2 phrases max par description), coordonnées GPS réelles.
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model:           'gpt-4o',
      max_tokens:      2500,
      temperature:     0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: dayPrompt }
      ]
    });

    const raw    = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    // S'assurer que le champ day est bien défini
    parsed.day = dayNum;

    // Ajouter ce jour à days_full (atomic: re-lire pour éviter les races)
    const { data: latest } = await supabase
      .from('roadbooks')
      .select('days_full')
      .eq('id', roadbook_id)
      .single();

    const currentDays = Array.isArray(latest?.days_full) ? latest.days_full : [];
    // Éviter les doublons
    const merged = [...currentDays.filter(d => d.day !== dayNum), parsed]
      .sort((a, b) => a.day - b.day);

    await supabase
      .from('roadbooks')
      .update({ days_full: merged })
      .eq('id', roadbook_id);

    const done = merged.length >= (totalDays - 1);
    console.log(`[generate-full] Jour ${dayNum}/${totalDays} généré pour ${roadbook_id} (done=${done})`);
    return json(res, 200, { ok: true, day_number: dayNum, done });

  } catch (err) {
    console.error(`[generate-full] Erreur jour ${dayNum}:`, err.message);
    return json(res, 502, { error: `Erreur IA jour ${dayNum}. Réessaie.` });
  }
}
