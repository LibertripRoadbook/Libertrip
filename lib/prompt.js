 // lib/prompt.js
// Construit le prompt systÃ¨me + utilisateur envoyÃ© Ã  l'API IA.
// Modifiable sans toucher au code de gÃ©nÃ©ration.

// â”€â”€ Correspondances lisibles pour le prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ClÃ©s EN (API) + clÃ©s FR (formulaire quiz) sont toutes les deux acceptÃ©es.

const COMPANION_MAP = {
  // ClÃ©s formulaire franÃ§ais
  solo:      'en solo',
  couple:    'en couple / duo',
  potes:     'entre amis (groupe)',
  famille:   'en famille avec enfants',
  // ClÃ©s API anglais (rÃ©trocompat)
  duo:       'en couple / duo',
  family:    'en famille avec enfants',
  group:     'entre amis (groupe)'
};

const VEHICLE_MAP = {
  // ClÃ©s formulaire franÃ§ais
  voiture:    'voiture classique',
  electrique: 'vÃ©hicule Ã©lectrique (tenir compte des bornes de recharge)',
  moto:       'moto (privilÃ©gier les routes sinueuses et cols)',
  van:        'van amÃ©nagÃ© / camping-car',
  transports: 'transports en commun (train, bus â€” pas de voiture)',
  // ClÃ©s API anglais (rÃ©trocompat)
  campervan:  'camping-car',
  car_tent:   'voiture + tente',
  motorcycle: 'moto',
  electric:   'vÃ©hicule Ã©lectrique',
  public_transport: 'transports en commun'
};

const RHYTHM_MAP = {
  // ClÃ©s formulaire franÃ§ais
  slow:       'rythme lent â€” Slow Travel (moins de 100 km/jour, longues pauses)',
  equilibre:  'rythme Ã©quilibrÃ© (100â€“200 km/jour, 3-4 Ã©tapes/jour)',
  rouleur:    'rythme soutenu â€” Grand Rouleur (200+ km/jour, beaucoup de kilomÃ¨tres)',
  // ClÃ©s API anglais (rÃ©trocompat)
  chill:      'rythme lent (1-2 Ã©tapes/jour, longues pauses)',
  balanced:   'rythme Ã©quilibrÃ© (3-4 Ã©tapes/jour)',
  active:     'rythme soutenu (explorer un maximum)'
};

const FOOD_MAP = {
  // ClÃ©s formulaire franÃ§ais
  economique:   'cuisine sur le pouce, Ã©conomique (sandwichs, fast-food, fait maison)',
  local:        'bons petits restaurants locaux, brasseries, rapport qualitÃ©/prix',
  gastronomie:  'gastronomie et terroir, spÃ©cialitÃ©s rÃ©gionales et belles tables',
  // ClÃ©s API anglais (rÃ©trocompat)
  cook:  'cuisine faite maison dans le van',
  mixed: 'mixte (cuisine + resto)'
};

// â”€â”€ Prompt systÃ¨me â€” RÃ´le et format de sortie obligatoire â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const SYSTEM_PROMPT = `
Tu es LIBERTRIP AI, un expert en voyages en van et road trips.
Ton unique mission est de gÃ©nÃ©rer un roadbook de voyage personnalisÃ© et ultra-dÃ©taillÃ©.

RÃˆGLES ABSOLUES :
1. Tu rÃ©ponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou aprÃ¨s.
2. Toutes les coordonnÃ©es GPS (lat/lng) doivent Ãªtre rÃ©elles et prÃ©cises.
3. Chaque Ã©tape doit avoir un nom de lieu rÃ©el, vÃ©rifiable sur une carte.
4. Le budget doit Ãªtre rÃ©aliste pour la destination et la durÃ©e.
5. Les "spots secrets" doivent Ãªtre de vraies adresses peu connues des touristes.
6. Le JSON doit strictement respecter le schÃ©ma fourni par l'utilisateur.

FORMAT DE RÃ‰PONSE OBLIGATOIRE (JSON pur, aucun markdown) :
{
  "logistics": {
    "total_distance_km": <number>,
    "total_days": <number>,
    "vehicle_type": "<string>",
    "best_season": "<string>",
    "difficulty": "Facile" | "ModÃ©rÃ©" | "Exigeant",
    "budget_estimated": {
      "fuel_eur": <number>,
      "accommodation_eur": <number>,
      "food_eur": <number>,
      "activities_eur": <number>,
      "total_eur": <number>
    },
    "packing_essentials": ["<item>", ...],
    "summary": "<2-3 phrases inspirantes dÃ©crivant le voyage>"
  },
  "day_1": {
    "title": "<Titre du Jour 1>",
    "theme": "<ThÃ¨me / ambiance>",
    "distance_km": <number>,
    "highlight": "<La chose incontournable de ce jour>",
    "steps": [
      {
        "order": <number>,
        "time": "<HH:MM>",
        "title": "<Nom du lieu>",
        "description": "<2-3 phrases vivantes et prÃ©cises>",
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
    { "day": 2, "title": "<Titre>", "theme": "<ThÃ¨me>", "highlight": "<Point fort>" },
    { "day": 3, "title": "<Titre>", "theme": "<ThÃ¨me>", "highlight": "<Point fort>" }
  ]
}
`.trim();

// â”€â”€ Constructeur du message utilisateur â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * @param {Object} criteria â€” RÃ©ponses du formulaire (10 questions)
 * @returns {string} Prompt utilisateur formatÃ©
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
    interests       = [],          // tableau de strings (ex: ['RandonnÃ©es & Nature sauvage'])
    departure_place = '',
    departure_date  = '',
    departure_time  = '',
    lodgings        = [],            // tableau d'adresses d'hÃ©bergements rÃ©servÃ©s
  } = criteria;

  // HÃ©bergements rÃ©servÃ©s : adresses prÃ©cises fournies par l'utilisateur
  const lodgingsStr = Array.isArray(lodgings) && lodgings.length
    ? lodgings.map((l, i) => `Nuit ${i + 1} : ${l}`).join(' | ')
    : null;

  // HÃ©bergements : tableau ou string
  const accommodationStr = Array.isArray(accommodation) && accommodation.length
    ? accommodation.join(', ')
    : (typeof accommodation === 'string' ? accommodation : 'peu importe');

  // IntÃ©rÃªts : tableau ou string
  const interestsStr = Array.isArray(interests) && interests.length
    ? interests.join(', ')
    : (typeof interests === 'string' ? interests : 'nature et dÃ©couverte gÃ©nÃ©rale');

  // Infos de dÃ©part
  const departureStr = [
    departure_place && `depuis ${departure_place}`,
    departure_date  && `le ${departure_date}`,
    departure_time  && `Ã  ${departure_time}`,
  ].filter(Boolean).join(', ') || 'non prÃ©cisÃ©';

  return `
GÃ©nÃ¨re un roadbook complet pour ce voyage.

PARAMÃˆTRES DU VOYAGE :
- Destination / rÃ©gion : ${destination || 'France (au choix)'}
- Voyageur(s) : ${COMPANION_MAP[companion] || companion}
- VÃ©hicule : ${VEHICLE_MAP[vehicle] || vehicle}
- DurÃ©e : ${days} jour(s)
- DÃ©part : ${departureStr}
- Rythme souhaitÃ© : ${RHYTHM_MAP[rhythm] || rhythm}
- HÃ©bergement prÃ©fÃ©rÃ© : ${accommodationStr}
${lodgingsStr ? `- HÃ©bergements rÃ©servÃ©s (gÃ©nÃ¨re les trajets depuis ces adresses) :\n  ${lodgingsStr}` : ''}
- Alimentation : ${FOOD_MAP[food] || food}
- Centres d'intÃ©rÃªt : ${interestsStr}

MISSION :
1. Calcule la logistique globale et le budget estimÃ© pour ${days} jours.
2. DÃ©taille prÃ©cisÃ©ment le Jour 1 avec toutes les Ã©tapes, horaires et coordonnÃ©es GPS rÃ©elles.
3. Fournis un aperÃ§u des jours 2 Ã  ${Math.min(Number(days), 7)} (titres + highlights seulement).
4. Inclus au moins 1 spot secret / adresse locale peu connue dans le Jour 1.

RÃ©ponds UNIQUEMENT avec le JSON valide dÃ©crit dans tes instructions systÃ¨me.
  `.trim();
}
