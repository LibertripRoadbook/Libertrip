// lib/supabase.js
// Client Supabase réutilisé par toutes les fonctions serverless.
// Utilise la SERVICE_ROLE_KEY (bypass RLS) — ne jamais exposer côté client.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Supabase] Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquantes.'
  );
}

// Singleton : en environnement serverless chaque invocation est indépendante,
// mais on garde le pattern pour cohérence et futur warm-start possible.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});
