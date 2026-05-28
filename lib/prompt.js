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
Tu es LIBERTRIP AI, un expert en voyages personnalisés (van, voiture, moto, train, vélo, transports en commun).
Ton unique mission est de générer un roadbook de voyage ultra-personnalisé, adapté précisément au profil du voyageur.

RÈGLES ABSOLUES :
1. Tu réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ou après.
2. Les coordonnées GPS (lat/lng) dans "location" doivent pointer vers le POINT D'ACCÈS du lieu (entrée principale, parking le plus proche, arrêt de bus/train/téléphérique), PAS le centre géographique de la ville. Si tu n'es pas certain des coordonnées exactes, utilise les coordonnées de la rue ou du quartier précis, jamais le centre-ville par défaut.
3. Chaque étape doit avoir un nom de lieu réel, vérifiable sur une carte.
4. Le budget doit être réaliste pour la destination, la durée et le type de voyage.
5. Les "spots secrets" doivent être de vraies adresses peu connues des touristes.
6. Le JSON doit strictement respecter le schéma fourni par l'utilisateur.
7. Le champ "place_info" doit contenir uniquement des faits que tu connais avec certitude sur ce lieu (histoire, particularité, horaires typiques, tarif si connu). Si tu n'es pas sûr d'une information, NE LA MET PAS. Vaut mieux null que faux.
8. COHÉRENCE TRANSPORT OBLIGATOIRE : les coordonnées GPS doivent correspondre au mode d'accès réel selon le véhicule. Exemples : pour une montagne accessible en téléphérique → coordonnées de la gare du téléphérique, PAS du sommet. Pour un site piéton en centre-ville → coordonnées du parking conseillé ou de l'arrêt de transport. Pour un café ou restaurant → coordonnées exactes de la rue, avec adresse précise.

PERSONNALISATION OBLIGATOIRE :
- Pour chaque étape (step), le champ "why_chosen" doit expliquer en 1 phrase pourquoi CE lieu a été choisi pour CE voyageur précis. Exemples : "Idéal en famille : activité accessible dès 4 ans", "Parfait en solo : ambiance locale authentique loin des circuits touristiques", "Incontournable en moto : virage emblématique du col".
- Le "summary" logistique doit mentionner le profil du voyageur (compagnons, véhicule, rythme).

CONSEILS TRANSPORT OBLIGATOIRES (selon le véhicule) :
- Voiture classique : signaler les parkings (nom, tarif estimé), les zones piétonnes, les vignettes obligatoires à l'étranger, les routes sans GPS fiable.
- Véhicule électrique : indiquer les bornes de recharge proches de chaque étape (réseau, distance, temps de charge estimé), les zones à faible autonomie.
- Van / camping-car : signaler les hauteurs limitées, les routes interdites aux camping-cars, les aires de bivouac légales, les interdictions de stationnement nocturne.
- Moto : privilégier cols et routes sinueuses, signaler les routes fermées en hiver ou dangereuses, équipement recommandé selon météo.
- Transports en commun : donner le nom des lignes (train, bus, métro), les horaires approximatifs, les pass transport recommandés, les bagageries en gare.
- Pour TOUT véhicule : signaler les péages (montant estimé), les zones à vignette (ex: Suisse, Autriche), les restrictions de circulation en centre-ville.

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
    "transport_warnings": ["<avertissement spécifique au véhicule>", ...],
    "packing_essentials": ["<item>", ...],
    "summary": "<2-3 phrases inspirantes décrivant le voyage en mentionnant le profil voyageur>"
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
        "description": "<2-3 phrases vivantes et précises sur le lieu>",
        "why_chosen": "<1 phrase expliquant pourquoi ce lieu pour CE voyageur précis>",
        "type": "depart" | "route" | "stop" | "meal" | "activity" | "overnight",
        "duration_min": <number>,
        "location": {
          "name": "<Nom complet du lieu>",
          "address": "<Adresse précise, rue + ville>",
          "lat": <float précis du lieu exact, PAS du centre-ville>,
          "lng": <float précis du lieu exact, PAS du centre-ville>
        },
        "access_point": {
          "label": "<Ce que représente ce point : ex 'Parking Cornavin', 'Gare du téléphérique', 'Arrêt tram n°12'>",
          "lat": <float du point d'accès recommandé>,
          "lng": <float du point d'accès recommandé>,
          "note": "<Instruction courte : ex 'Garez-vous ici puis 5 min à pied vers le café', 'Départ téléphérique ici, 12 min pour le sommet'>"
        },
        "place_info": "<Informations factuelles certaines sur ce lieu : histoire, particularité, horaires, tarif. NULL si pas sûr.>",
        "transport_tip": "<conseil pratique lié au moyen de transport : parking, borne, quai, etc.>",
        "tips": ["<conseil pratique général>", ...],
        "booking_url": "<URL de réservation si activité payante, sinon null>",
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
      "tips": "<conseil pour s'installer ou accéder>"
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
    lodgings        = [],            // tableau d'adresses d'hébergements réservés
  } = criteria;

  // Hébergements réservés : adresses précises fournies par l'utilisateur
  const lodgingsStr = Array.isArray(lodgings) && lodgings.length
    ? lodgings.map((l, i) => `Nuit ${i + 1} : ${l}`).join(' | ')
    : null;

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

PROFIL VOYAGEUR (utilise ces infos pour personnaliser chaque étape et le champ "why_chosen") :
- Destination / région : ${destination || 'France (au choix)'}
- Voyageur(s) : ${COMPANION_MAP[companion] || companion}
- Véhicule : ${VEHICLE_MAP[vehicle] || vehicle}
- Durée : ${days} jour(s)
- Départ : ${departureStr}
- Rythme souhaité : ${RHYTHM_MAP[rhythm] || rhythm}
- Hébergement préféré : ${accommodationStr}
${lodgingsStr ? `- Hébergements réservés (génère les trajets depuis ces adresses) :\n  ${lodgingsStr}` : ''}
- Alimentation : ${FOOD_MAP[food] || food}
- Centres d'intérêt : ${interestsStr}

MISSION :
1. Calcule la logistique globale et le budget estimé pour ${days} jours.
2. Remplis "transport_warnings" avec les avertissements spécifiques au véhicule "${VEHICLE_MAP[vehicle] || vehicle}" pour la destination "${destination}" : vignettes, parkings, bornes, péages, routes interdites, restrictions, etc.
3. Détaille précisément le Jour 1 avec toutes les étapes, horaires et coordonnées GPS réelles.
4. Pour chaque étape du Jour 1, remplis "why_chosen" en 1 phrase qui montre que tu as tenu compte du profil (${COMPANION_MAP[companion] || companion}, ${VEHICLE_MAP[vehicle] || vehicle}, ${interestsStr}).
5. Pour chaque étape, remplis "transport_tip" avec un conseil pratique adapté au véhicule (parking, borne de recharge, quai de train, etc.).
6. Fournis un aperçu des jours 2 à ${Math.min(Number(days), 7)} (titres + highlights seulement).
7. Inclus au moins 1 spot secret / adresse locale peu connue dans le Jour 1.

Réponds UNIQUEMENT avec le JSON valide décrit dans tes instructions système.
  `.trim();
}
