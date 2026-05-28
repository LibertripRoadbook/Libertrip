// api/admin.js
// Vercel Serverless Function — GET /api/admin?secret=XXX
//
// Retourne toutes les soumissions du formulaire LIBERTRIP.
// Protégé par un secret simple (variable d'env ADMIN_SECRET).
// Usage : /api/admin?secret=MON_MOT_DE_PASSE

import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {

  // CORS minimal (admin interne seulement)
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  // ── Vérification du secret ───────────────────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return res.status(500).json({ error: 'ADMIN_SECRET non configuré sur le serveur.' });
  }

  const { secret } = req.query;

  if (!secret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Accès refusé. Secret invalide.' });
  }

  // ── Paramètres de pagination ─────────────────────────────────────────────────
  const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
  const from  = (page - 1) * limit;

  // ── Filtre optionnel par statut ──────────────────────────────────────────────
  const statusFilter = req.query.status; // 'pending' | 'paid' | 'refunded'

  // ── Requête Supabase ─────────────────────────────────────────────────────────
  let query = supabase
    .from('roadbooks')
    .select(`
      id,
      email,
      payment_status,
      criteria,
      created_at,
      paid_at
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (statusFilter && ['pending', 'paid', 'refunded'].includes(statusFilter)) {
    query = query.eq('payment_status', statusFilter);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[admin] Erreur Supabase:', error);
    return res.status(500).json({ error: 'Erreur base de données.' });
  }

  // ── Formater pour l'affichage ─────────────────────────────────────────────────
  const rows = (data || []).map(rb => ({
    id:             rb.id,
    email:          rb.email,
    payment_status: rb.payment_status,
    destination:    rb.criteria?.destination || '—',
    companion:      rb.criteria?.companion   || '—',
    vehicle:        rb.criteria?.vehicle     || '—',
    days:           rb.criteria?.days        || '—',
    rhythm:         rb.criteria?.rhythm      || '—',
    food:           rb.criteria?.food        || '—',
    accommodation:  Array.isArray(rb.criteria?.accommodation)
                      ? rb.criteria.accommodation.join(', ')
                      : (rb.criteria?.accommodation || '—'),
    interests:      Array.isArray(rb.criteria?.interests)
                      ? rb.criteria.interests.join(', ')
                      : (rb.criteria?.interests || '—'),
    departure_place: rb.criteria?.departure_place || '—',
    departure_date:  rb.criteria?.departure_date  || '—',
    created_at:      rb.created_at,
    paid_at:         rb.paid_at || null,
    roadbook_url:   `/roadbook/${rb.id}`
  }));

  return res.status(200).json({
    total: count,
    page,
    limit,
    rows
  });
}
