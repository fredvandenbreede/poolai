import Anthropic from '@anthropic-ai/sdk'

export interface AnalysisContext {
  season: string
  mimeType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  poolVolume: number
  weather?: {
    temp_air: number
    humidity: number
    description: string
    rain_last_7d: number
    temp_water_estimated: number
  }
  location?: {
    city: string
    country: string
    lat: number
    lng: number
  }
  previousAnalyses?: {
    date: string
    score: number
    etat: string
    resume: string
    problemes: string[]
  }[]
  photoMeta?: {
    date: string
    heure: string
    momentJournee: string
    jourSemaine: string
    sourceGPS: string
  }
  photoCount: number
}

export async function analyzePoolPhoto(
  photos: { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }[],
  context: AnalysisContext
): Promise<object> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const weatherBlock = context.weather ? `
METEO ACTUELLE :
- Temperature air : ${context.weather.temp_air}C
- Temperature eau estimee : ${context.weather.temp_water_estimated}C
- Humidite : ${context.weather.humidity}%
- Conditions : ${context.weather.description}
- Pluies ces 7 derniers jours : ${context.weather.rain_last_7d}mm
IMPACT : Une eau chaude accelere la croissance des algues et consomme plus de chlore. Les fortes pluies diluent les traitements.` : ''

  const locationBlock = context.location ? `
LOCALISATION : ${context.location.city}, ${context.location.country}` : ''

  const metaBlock = context.photoMeta ? `
METADONNEES PHOTO :
- Photo prise le : ${context.photoMeta.date} (${context.photoMeta.jourSemaine})
- Heure : ${context.photoMeta.heure} (${context.photoMeta.momentJournee})
- Source GPS : ${context.photoMeta.sourceGPS}
IMPACT : En apres-midi avec soleil fort, le chlore se degrade rapidement. Le week-end, charge bacterienne plus elevee.` : ''

  const historyBlock = context.previousAnalyses?.length ? `
HISTORIQUE :
${context.previousAnalyses.map(a => `- ${a.date} : score ${a.score}/10 (${a.etat}) — ${a.resume} — Problemes: ${a.problemes.join(', ') || 'aucun'}`).join('\n')}
IMPORTANT : Si les problemes persistent, intensifie le traitement. Si l'eau s'ameliore, confirme la progression.` : `
PREMIERE ANALYSE de cette piscine.`

  const imageBlocks: Anthropic.ImageBlockParam[] = photos.map(p => ({
    type: 'image',
    source: { type: 'base64', media_type: p.mediaType, data: p.base64 }
  }))

  const photoDesc = photos.length === 1
    ? '1 photo (vue generale)'
    : photos.length === 2
    ? '2 photos (vue generale + vue rapprochee)'
    : `${photos.length} photos (vue generale, vue rapprochee, vue de cote) — analyse croisee de toutes les vues`

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: `Tu es un expert pisciniste avec 20 ans d'experience. Tu connais parfaitement les produits europeens : Bayrol, Zodiac, HTH, AstralPool, BWT, Biopool, Ocedis, Mareva, Pontaqua.

Quand tu recommandes un traitement, tu calcules TOUJOURS le dosage exact pour le volume de piscine indique.
Tu cites le nom exact du produit commercial, le dosage calcule au gramme ou millilitre pres, la raison chimique, le moment ideal et les precautions.
Tu tiens compte de toutes les photos pour croiser les observations et affiner le diagnostic.

Tu reponds UNIQUEMENT en JSON brut valide, sans markdown, sans backticks. Commence par { et termine par }.`,

    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: `Analyse ces photos de piscine (${photoDesc}).

CONTEXTE COMPLET :
- Saison : ${context.season}
- Volume de la piscine : ${context.poolVolume} m3 (utilise ce volume EXACT pour calculer tous les dosages)
${weatherBlock}
${locationBlock}
${metaBlock}
${historyBlock}

INSTRUCTIONS DOSAGE : Pour chaque produit, calcule la dose exacte pour ${context.poolVolume}m3.
Exemple : si la dose standard est 200g/50m3, pour ${context.poolVolume}m3 = ${Math.round(context.poolVolume * 200 / 50)}g.

Reponds avec exactement ce JSON :
{
  "score_global": <1-10>,
  "etat": <"excellent" ou "bon" ou "attention" ou "urgent">,
  "resume": "<phrase de 10 mots max>",
  "impact_contexte": "<comment meteo, heure et localisation influencent cet etat>",
  "synthese_photos": "<ce que la combinaison des ${photos.length} photos revele par rapport a une seule photo>",
  "observations": {
    "couleur": "<description precise de la couleur>",
    "transparence": "<limpide ou legerement trouble ou trouble ou opaque>",
    "mousse": <true ou false>,
    "depot_visible": <true ou false>,
    "algues_suspectees": <true ou false>
  },
  "problemes_detectes": ["<probleme avec explication chimique>"],
  "evolution_vs_precedent": "<amelioration ou stable ou degradation ou premiere analyse>",
  "plan_action": [
    {
      "priorite": <1, 2 ou 3>,
      "action": "<action complete et precise>",
      "explication": "<pourquoi ce traitement, cause chimique detaillee>",
      "produit_recommande": "<nom commercial exact>",
      "marque_alternative": "<equivalent autre marque>",
      "dosage_standard": "<dose standard pour 50m3>",
      "dosage_calcule": "<dose EXACTE calculee pour ${context.poolVolume}m3>",
      "moment_application": "<ex: le soir apres baignade, eau en circulation 2h>",
      "precautions": "<securite et conseils application>",
      "delai": "<maintenant ou dans 24h ou dans 48h>"
    }
  ],
  "conseil_prevention": "<conseil detaille avec frequence recommandee>",
  "prochaine_analyse_dans": "<3 jours ou 1 semaine ou 2 semaines>"
}`
        }
      ]
    }]
  })

  let text = response.content[0].type === 'text' ? response.content[0].text : ''
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(text)
}