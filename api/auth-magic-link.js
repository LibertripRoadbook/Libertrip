// api/auth-magic-link.js
// POST /api/auth-magic-link
// Envoie un magic link de connexion à l'utilisateur via Supabase Auth.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL       = process.env.NEXT_PUBLIC_BASE_URL || 'https://libertrip.vercel.app';
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

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: 'Email invalide.' });
  }

  const { error } = await supabase.auth.admin.generateLink({
    type:       'magiclink',
    email:      email.toLowerCase().trim(),
    options: {
      redirectTo: `${BASE_URL}/mes-roadbooks`,
    }
  });

  if (error) {
    console.error('[auth-magic-link]', error);
    return json(res, 500, { error: 'Impossible d\'envoyer le magic link.' });
  }

  return json(res, 200, { success: true, message: 'Magic link envoyé !' });
}
