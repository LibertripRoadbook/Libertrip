// lib/email.js
// Envoi d'emails transactionnels via Resend (https://resend.com)
// Variable d'env requise : RESEND_API_KEY

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = 'LIBERTRIP <hello@libertrip.fr>';
const BASE_URL       = process.env.NEXT_PUBLIC_BASE_URL || 'https://libertrip.vercel.app';

/**
 * Envoie un email via l'API Resend.
 */
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY non configuré — email non envoyé.');
    return { ok: false, reason: 'no_api_key' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[email] Erreur Resend:', err);
    return { ok: false, reason: err };
  }

  return { ok: true };
}

/**
 * Email envoyé juste après la génération du roadbook.
 * Contient le lien vers le roadbook et une invitation à déverrouiller.
 */
export async function sendRoadbookReadyEmail({ to, destination, roadbookId }) {
  const roadbookUrl = `${BASE_URL}/roadbook/${roadbookId}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ton roadbook LIBERTRIP est prêt !</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:24px;font-weight:800;letter-spacing:-1px;
                background:linear-gradient(135deg,#ffffff 40%,#4f8eff);
                -webkit-background-clip:text;color:#4f8eff;">
                LIBERTRIP
              </span>
            </td>
          </tr>

          <!-- Card principale -->
          <tr>
            <td style="background:#0a0a0a;border:1px solid #1f1f1f;border-radius:20px;padding:40px 36px;">

              <p style="font-size:13px;color:#4f8eff;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px;">
                🗺️ Ton roadbook est prêt
              </p>

              <h1 style="font-size:28px;font-weight:800;color:#ffffff;margin:0 0 12px;line-height:1.2;">
                Ton voyage ${destination ? `en ${destination}` : ''} t'attend !
              </h1>

              <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 32px;">
                Ton Jour 1 est généré et disponible. Clique ci-dessous pour découvrir ton itinéraire personnalisé — et débloque le roadbook complet pour vivre l'expérience totale.
              </p>

              <!-- CTA principal -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${roadbookUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#4f8eff,#8b5cf6);
                              color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;
                              padding:18px 40px;border-radius:100px;letter-spacing:-0.3px;">
                      Voir mon Roadbook →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Lien texte de secours -->
              <p style="font-size:12px;color:rgba(255,255,255,0.3);text-align:center;margin:0 0 32px;">
                Ou copie ce lien : <a href="${roadbookUrl}" style="color:#4f8eff;word-break:break-all;">${roadbookUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #1f1f1f;margin:0 0 24px;">

              <p style="font-size:13px;color:rgba(255,255,255,0.35);margin:0;text-align:center;line-height:1.6;">
                Ce lien est permanent — garde cet email pour retrouver ton roadbook à tout moment.<br>
                <a href="${BASE_URL}" style="color:#4f8eff;text-decoration:none;">libertrip.fr</a> · Pas de spam, promis sur la route.
              </p>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to:      to,
    subject: `🗺️ Ton roadbook ${destination ? destination + ' ' : ''}est prêt — LIBERTRIP`,
    html,
  });
}

/**
 * Email envoyé après le paiement — confirmation + accès au roadbook complet.
 */
export async function sendRoadbookUnlockedEmail({ to, destination, roadbookId, days }) {
  const roadbookUrl = `${BASE_URL}/roadbook/${roadbookId}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ton voyage complet est débloqué !</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:24px;font-weight:800;letter-spacing:-1px;color:#4f8eff;">
                LIBERTRIP
              </span>
            </td>
          </tr>

          <!-- Card principale -->
          <tr>
            <td style="background:#0a0a0a;border:1px solid #1f1f1f;border-radius:20px;padding:40px 36px;">

              <p style="font-size:13px;color:#34d399;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px;">
                ✅ Paiement confirmé
              </p>

              <h1 style="font-size:28px;font-weight:800;color:#ffffff;margin:0 0 12px;line-height:1.2;">
                Ton voyage${destination ? ` ${destination}` : ''} est entièrement débloqué !
              </h1>

              <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0 0 24px;">
                ${days ? `Tes <strong style="color:#fff;">${days} jours</strong> d'itinéraire sont disponibles.` : 'Ton roadbook complet est disponible.'} Toutes tes étapes, coordonnées GPS, spots secrets et conseils pratiques sont désormais accessibles à vie.
              </p>

              <!-- Récap -->
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#111;border:1px solid #222;border-radius:12px;padding:16px 20px;margin-bottom:28px;">
                <tr>
                  <td style="font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:2px;padding-bottom:12px;">Récap de ta commande</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#fff;padding:4px 0;">🌍 Destination : <strong>${destination || 'Non précisée'}</strong></td>
                </tr>
                ${days ? `<tr><td style="font-size:14px;color:#fff;padding:4px 0;">📅 Durée : <strong>${days} jours</strong></td></tr>` : ''}
                <tr>
                  <td style="font-size:14px;color:#fff;padding:4px 0;">💳 Accès : <strong>À vie</strong></td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#fff;padding:4px 0;">🔒 Roadbook ID : <span style="font-family:monospace;font-size:12px;color:rgba(255,255,255,0.4);">${roadbookId}</span></td>
                </tr>
              </table>

              <!-- CTA principal -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${roadbookUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#7c3aed);
                              color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;
                              padding:18px 44px;border-radius:100px;letter-spacing:-0.3px;">
                      ✨ Ouvrir mon roadbook complet →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Lien de secours -->
              <p style="font-size:12px;color:rgba(255,255,255,0.3);text-align:center;margin:0 0 32px;">
                Lien permanent : <a href="${roadbookUrl}" style="color:#4f8eff;word-break:break-all;">${roadbookUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #1f1f1f;margin:0 0 20px;">

              <!-- Conseils -->
              <p style="font-size:13px;color:rgba(255,255,255,0.35);margin:0 0 8px;">💡 <strong style="color:rgba(255,255,255,0.5);">Astuce :</strong> Ajoute ce lien en favori sur ton téléphone pour l'avoir toujours sous la main pendant le voyage.</p>
              <p style="font-size:13px;color:rgba(255,255,255,0.35);margin:0 0 8px;">📸 Tu peux ajouter tes hébergements et tes photos directement dans ton roadbook au fur et à mesure du voyage.</p>
              <p style="font-size:13px;color:rgba(255,255,255,0.25);margin:16px 0 0;text-align:center;">
                <a href="${BASE_URL}" style="color:#4f8eff;text-decoration:none;">libertrip.fr</a> · Merci de nous faire confiance pour ce voyage 🙏
              </p>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to,
    subject: `✅ Ton voyage${destination ? ` ${destination}` : ''} est débloqué — LIBERTRIP`,
    html,
  });
}
