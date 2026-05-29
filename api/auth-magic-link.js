// api/auth-magic-link.js
// POST /api/auth-magic-link
// Envoie un magic link de connexion via Supabase Auth (signInWithOtp).
// Supabase gère l'envoi de l'email directement via son service SMTP intégré.

import { createClient } from '@supabase/supabase-js';

// Client avec la clé anon pour les opérations Auth côté utilisateur
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
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

  // signInWithOtp envoie automatiquement l'email via Supabase (pas besoin de Resend)
  const { error } = await supabaseAnon.auth.signInWithOtp({
    email: email.toLowerCase().trim(),
    options: {
      emailRedirectTo: `${BASE_URL}/auth/callback`,
      shouldCreateUser: true,
    }
  });

  if (error) {
    console.error('[auth-magic-link] signInWithOtp error:', error.message);
    return json(res, 500, { error: 'Impossible d\'envoyer le magic link. Réessaie.' });
  }

  return json(res, 200, { success: true, message: 'Magic link envoyé !' });
}
