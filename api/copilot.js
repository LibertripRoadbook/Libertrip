// api/copilot.js
// Vercel Serverless Function — POST /api/copilot
//
// Chat copilote IA pour les utilisateurs premium.
// Reçoit : { roadbook_id, message, history[] }
// Charge le roadbook depuis Supabase, construit un contexte, appelle GPT-4o.
// Accessible uniquement si payment_status = 'paid' ou abonnement actif.

import { supabase }  from '../lib/supabase.js';
import OpenAI        from 'openai';

const openai         = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function jsonResponse(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(status).json(data);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Méthode non autorisée.' });

  const { roadbook_id, message, history = [] } = req.body || {};

  if (!roadbook_id || !UUID_REGEX.test(roadbook_id))
    return jsonResponse(res, 400, { error: 'ID invalide.' });
  if (!message || typeof message !== 'string' || message.trim().length === 0)
    return jsonResponse(res, 400, { error: 'Message vide.' });

  // ── Vérifier si abonné ──────────────────────────────────────────────────────
  async function hasActiveSubscription(email) {
    if (!email) return false;
    const { data } = await supabase
      .from('subscriptions').select('id')
      .eq('email', email).eq('status', 'active').limit(1).single();
    return !!data;
  }

  // ── Charger le roadbook ─────────────────────────────────────────────────────
  const { data: rb, error } = await supabase
    .from('roadbooks')
    .select('id, email, criteria, logistics, day_1, days_full, days_preview, payment_status')
    .eq('id', roadbook_id)
    .single();

  if (error || !rb) return jsonResponse(res, 404, { error: 'Roadbook introuvable.' });

  // ── Vérifier l'accès premium ────────────────────────────────────────────────
  let isSubscriber = false;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: { user } } = await userClient.auth.getUser(token);
      if (user?.email) isSubscriber = await hasActiveSubscription(user.email);
    } catch (e) { /* ignore */ }
  }

  const isPaid = rb.payment_status === 'paid' || isSubscriber;
  if (!isPaid) return jsonResponse(res, 403, { error: 'Accès réservé aux voyageurs premium.' });

  // ── Construire le contexte du roadbook ──────────────────────────────────────
  const criteria   = rb.criteria || {};
  const logistics  = rb.logistics || {};
  const day1Steps  = (rb.day_1?.steps || []).map(s =>
    `- ${s.time || ''} ${s.title}: ${s.description || ''} (${s.location?.address || ''})`
  ).join('\n');

  const fullDays = Array.isArray(rb.days_full)
    ? rb.days_full.map(d => `Jour ${d.day || ''}: ${d.title || ''} — ${(d.steps||[]).map(s => s.title).join(', ')}`).join('\n')
    : '';

  const systemPrompt = `
Tu es LIBERTRIP Copilote, l'assistant IA de voyage personnel de ${criteria.companion === 'solo' ? 'ce voyageur solo' : `ce groupe (${criteria.companion})`}.
Tu guides l'utilisateur PENDANT son voyage en te basant sur l'itinéraire que l'IA a généré pour lui.

ITINÉRAIRE GÉNÉRÉ :
- Destination : ${criteria.destination || 'non précisée'}
- Véhicule : ${criteria.vehicle || 'non précisé'}
- Durée : ${criteria.days || '?'} jours
- Départ : ${criteria.departure_place || ''} ${criteria.departure_date || ''}
- Distance totale : ${logistics.total_distance_km || '?'} km
- Budget estimé : ${logistics.budget_estimated?.total_eur || '?'}€

JOUR 1 — ÉTAPES :
${day1Steps || 'Non disponible'}

${fullDays ? `JOURS SUIVANTS :\n${fullDays}` : ''}

RÈGLES :
- Réponds toujours en français, de façon concise et pratique.
- Tu connais précisément cet itinéraire — aide l'utilisateur à naviguer, trouver des alternatives, ajuster en cas d'imprévu.
- Si l'utilisateur demande une alternative à une étape, propose quelque chose de cohérent géographiquement.
- Ne réponds qu'aux questions liées au voyage. Si la question est hors-sujet, redirige poliment.
- Reste sous 150 mots par réponse sauf si l'utilisateur demande un détail précis.
`.trim();

  // ── Construire l'historique de messages ─────────────────────────────────────
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message.trim() }
  ];

  // ── Appel OpenAI ─────────────────────────────────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o',
      max_tokens:  400,
      temperature: 0.7,
      messages
    });
    const reply = completion.choices[0]?.message?.content || 'Désolé, je n\'ai pas pu répondre.';
    return jsonResponse(res, 200, { reply });
  } catch (err) {
    console.error('[copilot] Erreur OpenAI:', err.message);
    return jsonResponse(res, 502, { error: 'Erreur IA. Réessaie dans un instant.' });
  }
}
