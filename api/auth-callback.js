// api/auth-callback.js
// GET /auth/callback?code=xxx
// Gère le callback PKCE de Supabase (magic link).
// Échange le code contre un access_token et redirige vers /mes-roadbooks.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const BASE_URL      = process.env.NEXT_PUBLIC_BASE_URL || 'https://libertrip.vercel.app';

export default async function handler(req, res) {
  const code  = req.query.code;
  const error = req.query.error;

  // Erreur renvoyée par Supabase
  if (error) {
    const desc = req.query.error_description || error;
    return res.redirect(302, `${BASE_URL}/mes-roadbooks?auth_error=${encodeURIComponent(desc)}`);
  }

  if (!code) {
    return res.redirect(302, `${BASE_URL}/mes-roadbooks`);
  }

  try {
    // Échange du code PKCE contre une session
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data, error: exchError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchError || !data?.session) {
      console.error('[auth-callback] exchange error:', exchError?.message);
      return res.redirect(302, `${BASE_URL}/mes-roadbooks?auth_error=lien_expire`);
    }

    const { access_token, refresh_token } = data.session;

    // Redirige vers mes-roadbooks avec les tokens dans le hash
    // (mes-roadbooks.html les lit via handleMagicLinkCallback)
    return res.redirect(302,
      `${BASE_URL}/mes-roadbooks#access_token=${access_token}&refresh_token=${refresh_token}&token_type=bearer`
    );
  } catch (e) {
    console.error('[auth-callback] unexpected error:', e.message);
    return res.redirect(302, `${BASE_URL}/mes-roadbooks?auth_error=erreur_serveur`);
  }
}
