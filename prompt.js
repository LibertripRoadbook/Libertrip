// lib/prompt.js
// Construit le prompt système + utilisateur envoyé à l'API IA.
// Modifiable sans toucher au code de génération.

// ── Correspondances lisibles pour le prompt ───────────────────────────────────
// Clés EN (API) + clés FR (formulaire quiz) sont toutes les deux acceptées.

const COMPANION_MAP = {
  // Clés formulaire français
  solo:      'en solo',
  couple:    'en couple / duo',
  potes:     'entre amis (groupe)',
  famille:   'en famille avec enfants',
  // Clés API anglais (rétrocompat)
  duo:       'en couple / duo',
  family:    'en famille avec enfants',
  group:     'entre amis (groupe)'
};

const VEHICLE_MAP = {
  // Clés formulaire français
  voiture:    'voiture classique',
  electrique: 'véhicule électrique (tenir compte des bornes de recharge)',
  moto:       'moto (privilégier les routes sinueuses et cols)',
  van:        'van aménagé / camping-car',
  transports: 'transports en commun (train, bus — pas de voiture)',
  // Clés API anglais (rétrocompat)
  campervan:  'camping-car',
  car_tent:   'voiture + tente',
  motorcycle: 'moto',
  electric:   'véhicule électrique',
  public_transport: 'transports en commun'
};

const RHYTHM_MAP = {
  // Clés formulaire français
  slow:       'rythme lent — Slow Travel (moins de 100 km/jour, longues pauses)',
  equilibre:  'rythme équilibré (100–200 km/jour, 3-4 étapes/jour)',
  rouleur:    'rythme soutenu — Grand Rouleur (200+ km/jour, beaucoup de kilomètres)',
  // Clés API anglais (rétrocompat)
  chill:      'rythme lent (1-2 étapes/jour, longues pauses)',
  balanced:   'rythme équilibré (3-4 étapes/jour)',
  active:     'rythme soutenu (explorer un maximum)'
};

const FOOD_MAP = {
  // Clés formulaire français
  economique:   'cuisine sur le pouce, économique (sandwichs, fast-food, fait maison)',
  local:        'bons petits restaurants locaux, brasseries, rapport qualité/prix',
  gastronomie:  'gastronomie et terroir, spécialités régionales et belles tables',
  // Clés API anglais (rétrocompat)
  cook:  'cuisine faite maison dans le van',
  mixed: 'mixte (cuisine + resto)'
};

// ── Prompt système — Rôle et format de sortie obligatoire ─────────────────────

export const SYSTEM_PROMPT = `
Tu es LIBERTRIP AI, un expert en voyages en van et road trips.
Ton unique mission est de générer un roadbook de voyage personnalisé et ultra-détaillé.

RÈGLES ABSOLUES :
1. Tu réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après.
2. Toutes les coordonnées GPS (lat/lng) doivent être réelles et précises.
3. Chaque étape doit avoir un nom de lieu réel, vérifiable sur une carte.
4. Le budget doit être réaliste pour la destination et la durée.
5. Les "spots secrets" doivent être de vraies adresses peu connues des touristes.
6. Le JSON doit strictement respecter le schéma fourni par l'utilisateur.

FORMAT DE RÉPONSE OBLIGATOIRE (JSON pur, aucun markdown) :
{
  "logistics": {
    "total_distance_km": <number>,
    "total_days": <number>,
    "vehicle_type": "<string>",
    "best_season": "<string>",
    "difficulty": "Facile" | "Modéré" | "Exigeant",
    "budget_estimated": {
      "fuel_eur": <number>,
      "accommodation_eur": <number>,
      "food_eur": <number>,
      "activities_eur": <number>,
      "total_eur": <number>
    },
    "packing_essentials": ["<item>", ...],
    "summary": "<2-3 phrases inspirantes décrivant le voyage>"
  },
  "day_1": {
    "title": "<Titre du Jour 1>",
    "theme": "<Thème / ambiance>",
    "distance_km": <number>,
    "highlight": "<La chose incontournable de ce jour>",
    "steps": [
      {
        "order": <number>,
        "time": "<HH:MM>",
        "title": "<Nom du lieu>",
        "description": "<2-3 phrases vivantes et précises>",
        "type": "depart" | "route" | "stop" | "meal" | "activity" | "overnight",
        "duration_min": <number>,
        "location": {
          "name": "<Nom complet>",
          "address": "<Adresse ou description GPS>",
          "lat": <float>,
          "lng": <float>
        },
        "tips": ["<conseil pratique>", ...],
        "secret": false | true
      }
    ],
    "overnight": {
      "name": "<Nom du bivouac / camping>",
      "description": "<Description>",
      "type": "bivouac" | "campsite" | "hostel",
      "lat": <float>,
      "lng": <float>,
      "address": "<Adresse>",
      "tips": "<conseil pour s'installer>"
    }
  },
  "days_preview": [
    { "day": 2, "title": "<Titre>", "theme": "<Thème>", "highlight": "<Point fort>" },
    { "day": 3, "title": "<Titre>", "theme": "<Thème>", "highlight": "<Point fort>" }
  ]
}
`.trim();

// ── Constructeur du message utilisateur ───────────────────────────────────────

/**
 * @param {Object} criteria — Réponses du formulaire (10 questions)
 * @returns {string} Prompt utilisateur formaté
 */
export function buildUserPrompt(criteria) {
  const {
    companion       = 'solo',
    destination     = '',
    vehicle         = 'van',
    days            = 7,
    rhythm          = 'equilibre',
    accommodation   = [],          // tableau de strings (ex: ['Camping / Nature'])
    food            = 'local',
    interests       = [],          // tableau de strings (ex: ['Randonnées & Nature sauvage'])
    departure_place = '',
    departure_date  = '',
    departure_time  = '',
  } = criteria;

  // Hébergements : tableau ou string
  const accommodationStr = Array.isArray(accommodation) && accommodation.length
    ? accommodation.join(', ')
    : (typeof accommodation === 'string' ? accommodation : 'peu importe');

  // Intérêts : tableau ou string
  const interestsStr = Array.isArray(interests) && interests.length
    ? interests.join(', ')
    : (typeof interests === 'string' ? interests : 'nature et découverte générale');

  // Infos de départ
  const departureStr = [
    departure_place && `depuis ${departure_place}`,
    departure_date  && `le ${departure_date}`,
    departure_time  && `à ${departure_time}`,
  ].filter(Boolean).join(', ') || 'non précisé';

  return `
Génère un roadbook complet pour ce voyage.

PARAMÈTRES DU VOYAGE :
- Destination / région : ${destination || 'France (au choix)'}
- Voyageur(s) : ${COMPANION_MAP[companion] || companion}
- Véhicule : ${VEHICLE_MAP[vehicle] || vehicle}
- Durée : ${days} jour(s)
- Départ : ${departureStr}
- Rythme souhaité : ${RHYTHM_MAP[rhythm] || rhythm}
- Hébergement préféré : ${accommodationStr}
- Alimentation : ${FOOD_MAP[food] || food}
- Centres d'intérêt : ${interestsStr}

MISSION :
1. Calcule la logistique globale et le budget estimé pour ${days} jours.
2. Détaille précisément le Jour 1 avec toutes les étapes, horaires et coordonnées GPS réelles.
3. Fournis un aperçu des jours 2 à ${Math.min(Number(days), 7)} (titres + highlights seulement).
4. Inclus au moins 1 spot secret / adresse locale peu connue dans le Jour 1.

Réponds UNIQUEMENT avec le JSON valide décrit dans tes instructions système.
  `.trim();
}
