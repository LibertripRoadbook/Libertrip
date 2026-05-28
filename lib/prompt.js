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
Tu es LIBERTRIP AI, un expert en voyages personnalisÃ©s (van, voiture, moto, train, vÃ©lo, transports en commun).
Ton unique mission est de gÃ©nÃ©rer un roadbook de voyage ultra-personnalisÃ©, adaptÃ© prÃ©cisÃ©ment au profil du voyageur.

RÃˆGLES ABSOLUES :
1. Tu rÃ©ponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou aprÃ¨s.
2. Toutes les coordonnÃ©es GPS (lat/lng) doivent Ãªtre rÃ©elles et prÃ©cises.
3. Chaque Ã©tape doit avoir un nom de lieu rÃ©el, vÃ©rifiable sur une carte.
4. Le budget doit Ãªtre rÃ©aliste pour la destination, la durÃ©e et le type de voyage.
5. Les "spots secrets" doivent Ãªtre de vraies adresses peu connues des touristes.
6. Le JSON doit strictement respecter le schÃ©ma fourni par l'utilisateur.

PERSONNALISATION OBLIGATOIRE :
- Pour chaque Ã©tape (step), le champ "why_chosen" doit expliquer en 1 phrase pourquoi CE lieu a Ã©tÃ© choisi pour CE voyageur prÃ©cis. Exemples : "IdÃ©al en famille : activitÃ© accessible dÃ¨s 4 ans", "Parfait en solo : ambiance locale authentique loin des circuits touristiques", "Incontournable en moto : virage emblÃ©matique du col".
- Le "summary" logistique doit mentionner le profil du voyageur (compagnons, vÃ©hicule, rythme).

CONSEILS TRANSPORT OBLIGATOIRES (selon le vÃ©hicule) :
- Voiture classique : signaler les parkings (nom, tarif estimÃ©), les zones piÃ©tonnes, les vignettes obligatoires Ã  l'Ã©tranger, les routes sans GPS fiable.
- VÃ©hicule Ã©lectrique : indiquer les bornes de recharge proches de chaque Ã©tape (rÃ©seau, distance, temps de charge estimÃ©), les zones Ã  faible autonomie.
- Van / camping-car : signaler les hauteurs limitÃ©es, les routes interdites aux camping-cars, les aires de bivouac lÃ©gales, les interdictions de stationnement nocturne.
- Moto : privilÃ©gier cols et routes sinueuses, signaler les routes fermÃ©es en hiver ou dangereuses, Ã©quipement recommandÃ© selon mÃ©tÃ©o.
- Transports en commun : donner le nom des lignes (train, bus, mÃ©tro), les horaires approximatifs, les pass transport recommandÃ©s, les bagageries en gare.
- Pour TOUT vÃ©hicule : signaler les pÃ©ages (montant estimÃ©), les zones Ã  vignette (ex: Suisse, Autriche), les restrictions de circulation en centre-ville.

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
    "transport_warnings": ["<avertissement spÃ©cifique au vÃ©hicule>", ...],
    "packing_essentials": ["<item>", ...],
    "summary": "<2-3 phrases inspirantes dÃ©crivant le voyage en mentionnant le profil voyageur>"
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
        "description": "<2-3 phrases vivantes et prÃ©cises sur le lieu>",
        "why_chosen": "<1 phrase expliquant pourquoi ce lieu pour CE voyageur prÃ©cis>",
        "type": "depart" | "route" | "stop" | "meal" | "activity" | "overnight",
        "duration_min": <number>,
        "location": {
          "name": "<Nom complet>",
          "address": "<Adresse complÃ¨te>",
          "lat": <float>,
          "lng": <float>
        },
        "transport_tip": "<conseil pratique liÃ© au moyen de transport : parking, borne, quai, etc.>",
        "tips": ["<conseil pratique gÃ©nÃ©ral>", ...],
        "booking_url": "<URL de rÃ©servation si activitÃ© payante, sinon null>",
        "secret": false | true
      }
    ],
    "overnight": {
      "name": "<Nom du lieu de nuit>",
      "description": "<Description>",
      "type": "bivouac" | "campsite" | "hostel" | "hotel" | "airbnb",
      "lat": <float>,
      "lng": <float>,
      "address": "<Adresse>",
      "tips": "<conseil pour s'installer ou accÃ©der>"
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

PROFIL VOYAGEUR (utilise ces infos pour personnaliser chaque Ã©tape et le champ "why_chosen") :
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
2. Remplis "transport_warnings" avec les avertissements spÃ©cifiques au vÃ©hicule "${VEHICLE_MAP[vehicle] || vehicle}" pour la destination "${destination}" : vignettes, parkings, bornes, pÃ©ages, routes interdites, restrictions, etc.
3. DÃ©taille prÃ©cisÃ©ment le Jour 1 avec toutes les Ã©tapes, horaires et coordonnÃ©es GPS rÃ©elles.
4. Pour chaque Ã©tape du Jour 1, remplis "why_chosen" en 1 phrase qui montre que tu as tenu compte du profil (${COMPANION_MAP[companion] || companion}, ${VEHICLE_MAP[vehicle] || vehicle}, ${interestsStr}).
5. Pour chaque Ã©tape, remplis "transport_tip" avec un conseil pratique adaptÃ© au vÃ©hicule (parking, borne de recharge, quai de train, etc.).
6. Fournis un aperÃ§u des jours 2 Ã  ${Math.min(Number(days), 7)} (titres + highlights seulement).
7. Inclus au moins 1 spot secret / adresse locale peu connue dans le Jour 1.

RÃ©ponds UNIQUEMENT avec le JSON valide dÃ©crit dans tes instructions systÃ¨me.
  `.trim();
}
