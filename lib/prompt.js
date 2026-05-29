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
9. COHÉRENCE GÉOGRAPHIQUE ABSOLUE — RÈGLE LA PLUS IMPORTANTE :
   - Le voyage doit suivre une ROUTE LOGIQUE, sans allers-retours inutiles. Planifie l'itinéraire comme un circuit ou une ligne directe, jamais comme un zigzag.
   - La première étape de chaque jour doit partir du lieu de nuit du jour précédent (ou d'un lieu proche).
   - L'"overnight" de chaque jour doit être positionné géographiquement ENTRE la dernière activité du jour et la première activité du lendemain — jamais dans la direction opposée.
   - Avant de générer, trace mentalement la carte : chaque jour doit avancer dans une direction cohérente avec la destination finale.
   - INTERDIT : générer un jour dans une ville A, dormir dans une ville B à 200 km, puis le lendemain repartir dans une ville C à 200 km dans l'autre sens.
10. CHAMP access_point : fournis des coordonnées GPS précises ET une instruction concrète (ex: "Parking Cornavin, rue de Lausanne 8, Genève — 3 min à pied"). Si tu ne connais pas l'adresse exacte d'un parking, écris "Stationnement dans le quartier [nom du quartier], adresses disponibles sur Google Maps" — JAMAIS une phrase vague sans localisation.

PERSONNALISATION OBLIGATOIRE :
- Pour chaque étape (step), le champ "why_chosen" doit expliquer en 1 phrase pourquoi CE lieu a été choisi pour CE voyageur précis. Exemples : "Idéal en famille : activité accessible dès 4 ans", "Parfait en solo : ambiance locale authentique loin des circuits touristiques", "Incontournable en moto : virage emblématique du col".
- Le "summary" logistique doit mentionner le profil du voyageur (compagnons, véhicule, rythme).

CONSEILS TRANSPORT OBLIGATOIRES (selon le véhicule) :
- Voiture classique : si tu connais un parking précis avec son adresse exacte, mentionne-le. Sinon, dis simplement "Des parkings sont disponibles dans le quartier" — NE JAMAIS inventer un nom de parking sans adresse réelle.
- Véhicule électrique : indiquer les bornes de recharge proches (réseau, ex: Ionity, Supercharger), zones à faible autonomie.
- Van / camping-car : signaler les hauteurs limitées, routes interdites, aires de bivouac légales, interdictions de stationnement nocturne.
- Moto : privilégier cols et routes sinueuses, signaler routes fermées en hiver ou dangereuses.
- Transports en commun : donner le nom des lignes (train, bus, métro), les pass transport recommandés.
- Pour TOUT véhicule : signaler les péages (montant estimé), les zones à vignette (ex: Suisse, Autriche), les restrictions de circulation en centre-ville.
- INTERDIT : ne jamais écrire "Vous pouvez vous garer ici" ou "parking disponible" sans donner une adresse précise et vérifiable. Préférer des formulations génériques si tu n'es pas certain.

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
    "budget_breakdown": {
      "fuel_detail":          ["<ex: Trajet aller ~250km → ~25L × 1.8€ = 45€>", ...],
      "accommodation_detail": ["<ex: Hôtel 3★ Genève ~90€/nuit × 3 = 270€>", ...],
      "food_detail":          ["<ex: Repas midi ~15€ + dîner ~30€ × 7j = 315€>", ...],
      "activities_detail":    ["<ex: Musée d'Art 18CHF, Téléphérique Salève 12€>", ...]
    },
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
        "place_info": "<Informations factuelles certaines sur ce lieu : histoire, particularité, horaires. NULL si pas sûr.>",
        "price_info": "<Prix d'entrée ou de consommation si connu avec certitude : 'Gratuit', 'Entrée : environ 15 CHF', 'Menu midi : 18-25€'. NULL si inconnu.>",
        "transport_tip": "<conseil pratique lié au moyen de transport. JAMAIS de parking inventé sans adresse précise.>",
        "tips": ["<conseil pratique général>", ...],
        "booking_url": "<URL officielle du lieu ou de réservation si activité payante, sinon null>",
        "secret": false | true
      }
    ],
    "overnight": {
      "name": "<Nom générique du quartier/zone recommandée pour dormir — PAS une étape d'activité>",
      "description": "<Pourquoi dormir dans cette zone par rapport aux activités du lendemain>",
      "type": "bivouac" | "campsite" | "hostel" | "hotel" | "airbnb",
      "price_range": "<Fourchette de prix réaliste pour cette zone : ex '60-90€/nuit pour un hôtel', '30-50€ en auberge'>",
      "lat": <float>,
      "lng": <float>,
      "address": "<Quartier ou zone, PAS une adresse inventée>",
      "tips": "<Conseil géographique : pourquoi cette zone est idéale pour la suite du voyage>"
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
    accommodation   = [],
    food            = 'local',
    interests       = [],
    departure_place = '',
    departure_date  = '',
    departure_time  = '',
    return_place    = '',
    return_date     = '',
    return_time     = '',
    lodgings        = [],
    budget_level    = 'medium',
    budget_amount   = null,
    vehicle_range   = null,
    custom_notes    = '',
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

  // Budget
  const BUDGET_GUIDES = {
    eco:     'Budget économique : hébergement 20-50€/nuit (auberge, camping, bivouac), repas 10-20€, activités gratuites ou peu chères. Total estimé : 40-80€/jour/personne.',
    medium:  'Budget moyen : hébergement 60-120€/nuit (hôtel 3★, Airbnb), repas 20-40€, quelques activités payantes. Total estimé : 100-180€/jour/personne.',
    premium: 'Budget premium : hébergement 150€+/nuit (hôtel 4-5★, lodge), repas 50€+, activités premium. Total estimé : 250€+/jour/personne.',
  };
  const budgetStr = budget_amount
    ? `Budget total indiqué par le voyageur : ${budget_amount}€ pour ${days} jours (soit ~${Math.round(budget_amount / days)}€/jour). Respecte strictement cette enveloppe dans tes estimations.`
    : (BUDGET_GUIDES[budget_level] || BUDGET_GUIDES.medium);

  // Infos de départ
  const departureStr = [
    departure_place && `depuis ${departure_place}`,
    departure_date  && `le ${departure_date}`,
    departure_time  && `à ${departure_time}`,
  ].filter(Boolean).join(', ') || 'non précisé';

  // Infos de retour (optionnel)
  const returnStr = [
    return_place && `à ${return_place}`,
    return_date  && `le ${return_date}`,
    return_time  && `avant ${return_time}`,
  ].filter(Boolean).join(', ') || null;

  return `
Génère un roadbook complet pour ce voyage.

PROFIL VOYAGEUR (utilise ces infos pour personnaliser chaque étape et le champ "why_chosen") :
- Destination / région : ${destination || 'France (au choix)'}
- Voyageur(s) : ${COMPANION_MAP[companion] || companion}
- Véhicule : ${VEHICLE_MAP[vehicle] || vehicle}${vehicle === 'electrique' && vehicle_range ? ` (autonomie : ${vehicle_range} km — planifie les recharges en conséquence)` : ''}
- Durée : ${days} jour(s)
- Départ : ${departureStr}
${returnStr ? `- Retour : ${returnStr} — CONTRAINTE ABSOLUE : le dernier jour doit se terminer à "${return_place || 'lieu de retour'}" et le voyageur doit pouvoir y être avant ${return_time || 'l\'heure indiquée'}. Planifie le dernier jour en conséquence (distances, horaires, nombre d'étapes réduit si nécessaire).` : ''}
- Rythme souhaité : ${RHYTHM_MAP[rhythm] || rhythm}
- Hébergement préféré : ${accommodationStr}
${lodgingsStr ? `- Hébergements réservés (génère les trajets depuis ces adresses) :\n  ${lodgingsStr}` : ''}
- Alimentation : ${FOOD_MAP[food] || food}
- Centres d'intérêt : ${interestsStr}
- Budget : ${budgetStr}
${custom_notes ? `\nCONTRAINTES ET SOUHAITS PERSONNELS DU VOYAGEUR (PRIORITÉ ABSOLUE) :\n"${custom_notes}"\nL'itinéraire DOIT tenir compte de ces contraintes. Si une date, un lieu ou une activité précise est mentionnée, construis le voyage autour de cette contrainte en minimisant les distances et en assurant la logistique.` : ''}
${companion === 'famille' ? `\nCONTEXTE FAMILLE AVEC ENFANTS : pour chaque activité, restaurant ou parc, si tu connais des informations pratiques spécifiques aux enfants (menu enfant, âge minimum, aire de jeux, espace poussette, animations jeunesse), intègre-les dans le champ "place_info". Si tu ne trouves pas d'info enfant fiable sur un lieu, laisse null pour ce champ plutôt que d'inventer.` : ''}

MISSION :
0. AVANT TOUT : planifie mentalement la carte du voyage sur ${days} jours. Trace une route logique depuis "${departure_place || 'le point de départ'}" vers "${destination}" — un circuit ou une ligne directe sans zigzag. Chaque jour doit avancer géographiquement de façon cohérente. Le lieu de nuit de chaque jour doit être positionné entre les activités du jour et celles du lendemain.
1. Calcule la logistique globale et le budget estimé pour ${days} jours EN RESPECTANT le niveau de budget indiqué. Les montants doivent être cohérents entre eux (ex: si budget total = 2500€ sur 7j, l'hébergement ne peut pas être 2000€).
2. Pour chaque poste budgétaire (fuel, hébergement, nourriture, activités), inclus dans "logistics.budget_breakdown" une liste de 2-3 exemples précis justifiant l'estimation (ex: "Hôtel 3★ à Genève : ~90€/nuit × 3 nuits = 270€").
3. Remplis "transport_warnings" avec les avertissements spécifiques au véhicule pour la destination.
4. Détaille précisément le Jour 1 avec toutes les étapes, horaires et coordonnées GPS réelles. Le Jour 1 commence impérativement depuis "${departure_place || 'le point de départ indiqué'}".
5. RÈGLE HÉBERGEMENT : le champ "overnight" n'est PAS une étape d'activité. Il ne doit JAMAIS apparaître dans "steps". Il représente la zone où dormir — elle doit être géographiquement cohérente avec la dernière activité du jour ET proche du début du jour suivant prévu.
6. Pour chaque étape, remplis "price_info" si tu connais le tarif avec certitude. Pour les activités gratuites, écris "Gratuit".
7. Pour chaque étape du Jour 1, remplis "why_chosen" en 1 phrase adaptée au profil.
8. Fournis un aperçu des jours 2 à ${Math.min(Number(days), 7)} avec des titres qui reflètent la progression géographique réelle du voyage (ex: "De Lyon à Marseille", "Côte d'Azur — Nice et ses environs").
9. Inclus au moins 1 spot secret dans le Jour 1.

Réponds UNIQUEMENT avec le JSON valide décrit dans tes instructions système.
  `.trim();
}
