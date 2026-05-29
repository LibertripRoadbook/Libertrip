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

  const { data: linkData, error } = await supabase.auth.admin.generateLink({
    type:    'magiclink',
    email:   email.toLowerCase().trim(),
    options: { redirectTo: `${BASE_URL}/mes-roadbooks` }
  });

  if (error || !linkData?.properties?.action_link) {
    console.error('[auth-magic-link] generateLink error:', error);
    return json(res, 500, { error: 'Impossible de générer le lien de connexion.' });
  }

  const magicLink = linkData.properties.action_link;

  // Envoyer l'email via Resend
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('[auth-magic-link] RESEND_API_KEY manquante');
    return json(res, 500, { error: 'Configuration email manquante.' });
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'LIBERTRIP <hello@libertrip.fr>',
      to:      email.toLowerCase().trim(),
      subject: '🔑 Ton lien de connexion LIBERTRIP',
      html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr><td align="center" style="padding-bottom:28px;">
          <span style="font-size:22px;font-weight:800;color:#4f8eff;">LIBERTRIP</span>
        </td></tr>
        <tr><td style="background:#0a0a0a;border:1px solid #1f1f1f;border-radius:20px;padding:40px 36px;">
          <h1 style="font-size:24px;font-weight:800;color:#fff;margin:0 0 12px;">Connexion à ton compte</h1>
          <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 28px;">
            Clique sur le bouton ci-dessous pour accéder à tes roadbooks. Ce lien est valable <strong style="color:#fff;">1 heure</strong>.
          </p>
          <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
            <tr><td align="center">
              <a href="${magicLink}"
                 style="display:inline-block;background:linear-gradient(135deg,#4f8eff,#8b5cf6);
                        color:#fff;text-decoration:none;font-size:16px;font-weight:700;
                        padding:17px 38px;border-radius:100px;">
                Accéder à mes roadbooks →
              </a>
            </td></tr>
          </table>
          <p style="font-size:12px;color:rgba(255,255,255,0.3);text-align:center;margin:0 0 20px;">
            Ou copie ce lien : <a href="${magicLink}" style="color:#4f8eff;word-break:break-all;">${magicLink}</a>
          </p>
          <hr style="border:none;border-top:1px solid #1f1f1f;margin:0 0 20px;">
          <p style="font-size:12px;color:rgba(255,255,255,0.3);text-align:center;margin:0;">
            Si tu n'as pas demandé cette connexion, ignore cet email.<br>
            <a href="${BASE_URL}" style="color:#4f8eff;text-decoration:none;">libertrip.fr</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
    })
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    console.error('[auth-magic-link] Resend error:', errText);
    return json(res, 500, { error: 'Erreur lors de l\'envoi de l\'email.' });
  }

  return json(res, 200, { success: true, message: 'Magic link envoyé !' });
}
