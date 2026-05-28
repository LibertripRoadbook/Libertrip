// api/roadbook.js
// Vercel Serverless Function — GET /api/roadbook?id=<uuid>
//
// Retourne les données d'un roadbook pour affichage dans roadbook.html.
// - Si payment_status = 'pending' → renvoie day_1 + logistics + days_preview (sans days_full)
// - Si payment_status = 'paid'    → renvoie tout le contenu débloqué

import { supabase } from '../lib/supabase.js';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function jsonResponse(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Cache court : 30s côté CDN (les données changent après paiement)
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.status(status).json(data);
}

// Regex UUID v4 pour validation basique de l'ID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {

  // Pre-flight CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return jsonResponse(res, 405, { error: 'Méthode non autorisée.' });
  }

  // ── 1. Validation de l'ID ────────────────────────────────────────────────

  const { id } = req.query;

  // ── Vérifier si l'utilisateur connecté a un abonnement actif ────────────
  async function hasActiveSubscription(email) {
    if (!email) return false;
    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('email', email)
      .eq('status', 'active')
      .limit(1)
      .single();
    return !!data;
  }

  // Token optionnel pour vérifier l'abonnement
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!id || !UUID_REGEX.test(id)) {
    return jsonResponse(res, 400, { error: 'ID de roadbook invalide.' });
  }

  // ── 2. Récupération depuis Supabase ──────────────────────────────────────

  const { data: roadbook, error } = await supabase
    .from('roadbooks')
    .select('id, email, criteria, logistics, day_1, days_full, days_preview, payment_status, created_at')
    .eq('id', id)
    .single();

  if (error || !roadbook) {
    // Ne pas distinguer "introuvable" de "erreur" pour éviter l'énumération d'IDs
    return jsonResponse(res, 404, { error: 'Roadbook introuvable.' });
  }

  // ── 3. Masquage conditionnel selon le statut de paiement ────────────────

  // Vérifier si l'utilisateur connecté a un abonnement actif
  let isSubscriber = false;
  if (token) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: { user } } = await userClient.auth.getUser(token);
      if (user?.email) {
        isSubscriber = await hasActiveSubscription(user.email);
      }
    } catch(e) { /* token invalide, on ignore */ }
  }

  const isPaid = roadbook.payment_status === 'paid' || isSubscriber;

  const response = {
    id:             roadbook.id,
    payment_status: roadbook.payment_status,
    criteria:       roadbook.criteria,
    logistics:      roadbook.logistics,
    day_1:          roadbook.day_1,
    days_preview:   roadbook.days_preview || [],
    // Jours complets uniquement si payé
    days_full:      isPaid ? (roadbook.days_full || []) : null,
    created_at:     roadbook.created_at
  };

  return jsonResponse(res, 200, response);
}
