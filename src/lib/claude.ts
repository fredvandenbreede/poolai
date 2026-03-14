import Anthropic from '@anthropic-ai/sdk'

export interface AnalysisContext {
  season: string
  mimeType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
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
}

export async function analyzePoolPhoto(
  photoBase64: string,
  _stripBase64: string | null,
  context: AnalysisContext
): Promise<object> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const mediaType = context.mimeType || 'image/jpeg'

  const weatherBlock = context.weather ? `
METEO ACTUELLE :
- Temperature air : ${context.weather.temp_air}°C
- Temperature eau estimee : ${context.weather.temp_water_estimated}°C
- Humidite : ${context.weather.humidity}%
- Conditions : ${context.weather.description}
- Pluies ces 7 derniers jours : ${context.weather.rain_last_7d}mm
IMPACT : Une eau chaude accelere la croissance des algues et consomme plus de chlore. Les fortes pluies diluent les traitements et apportent des contaminants.` : ''

  const locationBlock = context.location ? `
LOCALISATION : ${context.location.city}, ${context.location.country}
IMPACT : Adapter les recommandations au climat local et aux produits disponibles dans cette region.` : ''

  const historyBlock = context.previousAnalyses?.length ? `
HISTORIQUE DES ANALYSES PRECEDENTES :
${context.previousAnalyses.map(a => `- ${a.date} : score ${a.score}/10 (${a.etat}) — ${a.resume} — Problemes: ${a.problemes.join(', ') || 'aucun'}`).join('\n')}
IMPORTANT : Tiens compte de cette evolution. Si les problemes persistent, intensifie le traitement. Si l'eau s'ameliore, confirme la progression.` : `
PREMIERE ANALYSE de cette piscine — pas d'historique disponible.`

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: `Tu es un expert pisciniste avec 20 ans d'experience. Tu connais parfaitement les produits europeens : Bayrol, Zodiac, HTH, AstralPool, BWT, Biopool, Ocedis, Mareva, Pontaqua.

Quand tu recommandes un traitement, tu cites TOUJOURS le nom exact du produit commercial, le dosage precis, la raison chimique, le moment ideal et les precautions.

Tu tiens compte de la meteo, de la localisation et de l'historique pour affiner ton diagnostic.

Tu reponds UNIQUEMENT en JSON brut valide, sans markdown, sans backticks. Commence par { et termine par }.`,

    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: photoBase64 } },
        { type: 'text', text: `Analyse cette photo de piscine.

CONTEXTE :
- Saison : ${context.season}
${weatherBlock}
${locationBlock}
${historyBlock}

Reponds avec exactement ce JSON:
{
  "score_global": <1-10>,
  "etat": <"excellent"|"bon"|"attention"|"urgent">,
  "resume": "<10 mots max>",
  "impact_meteo": "<comment la meteo actuelle influence l'etat de l'eau>",
  "observations": {
    "couleur": "<description precise>",
    "transparence": "<limpide|legerement trouble|trouble|opaque>",
    "mousse": <true|false>,
    "depot_visible": <true|false>,
    "algues_suspectees": <true|false>
  },
  "problemes_detectes": ["<probleme avec explication chimique>"],
  "evolution_vs_precedent": "<amelioration|stable|degradation|premiere analyse>",
  "plan_action": [
    {
      "priorite": <1|2|3>,
      "action": "<action complete>",
      "explication": "<pourquoi, cause chimique>",
      "produit_recommande": "<nom commercial exact>",
      "marque_alternative": "<equivalent autre marque>",
      "dosage": "<dosage precis pour 50m3>",
      "moment_application": "<quand appliquer>",
      "precautions": "<securite>",
      "delai": "<maintenant|dans 24h|dans 48h>"
    }
  ],
  "conseil_prevention": "<conseil detaille avec frequence recommandee>",
  "prochaine_analyse_dans": "<3 jours|1 semaine|2 semaines>"
}` }
      ]
    }]
  })

  let text = response.content[0].type === 'text' ? response.content[0].text : ''
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(text)
}
