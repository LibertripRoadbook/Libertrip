// api/update-roadbook.js
// POST /api/update-roadbook
// Permet de modifier un roadbook existant : hébergements par nuit, upload de photos.
// Authentification : email requis (vérifié contre le roadbook).

import { supabase } from '../lib/supabase.js';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } } // Pour les photos en base64
};

export default async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || 'https://libertrip.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { roadbook_id, email, action, payload } = req.body || {};

  // Validation basique
  if (!roadbook_id || !email || !action) {
    return res.status(400).json({ error: 'Paramètres manquants : roadbook_id, email, action requis.' });
  }

  // Vérifier que le roadbook appartient bien à cet email
  const { data: rb, error: fetchErr } = await supabase
    .from('roadbooks')
    .select('id, email, user_lodgings, photos, criteria, payment_status')
    .eq('id', roadbook_id)
    .single();

  if (fetchErr || !rb) {
    return res.status(404).json({ error: 'Roadbook introuvable.' });
  }
  if (rb.email.toLowerCase() !== email.toLowerCase()) {
    return res.status(403).json({ error: 'Email incorrect pour ce roadbook.' });
  }

  // ── Action : mettre à jour les hébergements ───────────────────────────────
  if (action === 'update_lodgings') {
    // payload.lodgings = [{day: 1, name: "...", address: "...", notes: "..."}]
    const lodgings = Array.isArray(payload?.lodgings) ? payload.lodgings : [];
    const { error } = await supabase
      .from('roadbooks')
      .update({ user_lodgings: lodgings })
      .eq('id', roadbook_id);

    if (error) {
      console.error('[update-roadbook] Erreur lodgings:', error.message);
      return res.status(500).json({ error: 'Erreur sauvegarde hébergements.' });
    }
    return res.status(200).json({ ok: true, message: 'Hébergements mis à jour.' });
  }

  // ── Action : uploader une photo ───────────────────────────────────────────
  if (action === 'upload_photo') {
    // payload = { day, caption, file_base64, file_name, file_type }
    const { day, caption, file_base64, file_name, file_type } = payload || {};

    if (!file_base64 || !file_name) {
      return res.status(400).json({ error: 'Fichier manquant.' });
    }

    // Décoder base64 → buffer
    const base64Data = file_base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Chemin dans le bucket : roadbook_id/jour_X_timestamp_nom
    const timestamp = Date.now();
    const ext       = file_name.split('.').pop() || 'jpg';
    const path      = `${roadbook_id}/jour${day || 0}_${timestamp}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('roadbook-photos')
      .upload(path, buffer, {
        contentType:  file_type || 'image/jpeg',
        cacheControl: '3600',
        upsert:       false,
      });

    if (uploadErr) {
      console.error('[update-roadbook] Erreur upload:', uploadErr.message);
      return res.status(500).json({ error: 'Erreur upload photo.' });
    }

    // URL publique
    const { data: urlData } = supabase.storage
      .from('roadbook-photos')
      .getPublicUrl(path);
    const publicUrl = urlData?.publicUrl;

    // Ajouter la photo à la liste existante
    const existingPhotos = Array.isArray(rb.photos) ? rb.photos : [];
    const newPhoto = {
      url:         publicUrl,
      day:         day || null,
      caption:     caption || '',
      uploaded_at: new Date().toISOString(),
    };
    const updatedPhotos = [...existingPhotos, newPhoto];

    const { error: saveErr } = await supabase
      .from('roadbooks')
      .update({ photos: updatedPhotos })
      .eq('id', roadbook_id);

    if (saveErr) {
      console.error('[update-roadbook] Erreur save photo:', saveErr.message);
      return res.status(500).json({ error: 'Photo uploadée mais non sauvegardée.' });
    }

    return res.status(200).json({ ok: true, photo: newPhoto });
  }

  // ── Action : supprimer une photo ──────────────────────────────────────────
  if (action === 'delete_photo') {
    const { photo_url } = payload || {};
    const existingPhotos = Array.isArray(rb.photos) ? rb.photos : [];
    const updatedPhotos  = existingPhotos.filter(p => p.url !== photo_url);

    const { error } = await supabase
      .from('roadbooks')
      .update({ photos: updatedPhotos })
      .eq('id', roadbook_id);

    if (error) return res.status(500).json({ error: 'Erreur suppression photo.' });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: `Action inconnue : ${action}` });
}
