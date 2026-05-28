// api/my-roadbooks.js
// GET /api/my-roadbooks
// Retourne tous les roadbooks de l'utilisateur connecté.
// Authentification via Bearer token Supabase.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res.status(status).json(data);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' });

  // ── Vérifier le token Supabase ────────────────────────────────────────────
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) return json(res, 401, { error: 'Non authentifié.' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) return json(res, 401, { error: 'Session invalide.' });

  // ── Récupérer les roadbooks de cet utilisateur ────────────────────────────
  const { data, error } = await supabaseAdmin
    .from('roadbooks')
    .select('id, criteria, payment_status, created_at, paid_at')
    .eq('email', user.email)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return json(res, 500, { error: 'Erreur base de données.' });

  const roadbooks = (data || []).map(rb => ({
    id:             rb.id,
    destination:    rb.criteria?.destination || 'Destination inconnue',
    days:           rb.criteria?.days || '?',
    payment_status: rb.payment_status,
    created_at:     rb.created_at,
    url:            `/roadbook/${rb.id}`,
  }));

  return json(res, 200, { roadbooks });
}
