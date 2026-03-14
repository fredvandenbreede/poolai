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
  photoMeta?: {
    date: string
    heure: string
    momentJournee: string
    jourSemaine: string
    sourceGPS: string
  }
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
- Temperature air : ${context.weather.temp_air}C
- Temperature eau estimee : ${context.weather.temp_water_estimated}C
- Humidite : ${context.weather.humidity}%
- Conditions : ${context.weather.description}
- Pluies ces 7 derniers jours : ${context.weather.rain_last_7d}mm
IMPACT METEO : Une eau chaude accelere la croissance des algues et consomme plus de chlore. Les fortes pluies diluent les traitements et apportent des contaminants.` : ''

  const locationBlock = context.location ? `
LOCALISATION : ${context.location.city}, ${context.location.country}
IMPACT : Adapter les recommandations au climat local et aux produits disponibles dans cette region.` : ''

  const metaBlock = context.photoMeta ? `
METADONNEES PHOTO :
- Photo prise le : ${context.photoMeta.date} (${context.photoMeta.jourSemaine})
- Heure exacte : ${context.photoMeta.heure} (${context.photoMeta.momentJournee})
- Source GPS : ${context.photoMeta.sourceGPS}
IMPACT :
- Le matin, l eau est plus froide et le chlore plus stable, diagnostic plus fiable.
- En apres-midi avec soleil fort, le chlore se degrade rapidement, tenir compte du rayonnement UV.
- Le week-end, la piscine est souvent plus utilisee, charge bacterienne potentiellement plus elevee.` : ''

  const historyBlock = context.previousAnalyses?.length ? `
HISTORIQUE DES ANALYSES PRECEDENTES :
${context.previousAnalyses.map(a => `- ${a.date} : score ${a.score}/10 (${a.etat}) — ${a.resume} — Problemes: ${a.problemes.join(', ') || 'aucun'}`).join('\n')}
IMPORTANT : Tiens compte de cette evolution. Si les problemes persistent, intensifie le traitement. Si l eau s ameliore, confirme la progression.` : `
PREMIERE ANALYSE de cette piscine, pas d historique disponible.`

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: `Tu es un expert pisciniste avec 20 ans d experience. Tu connais parfaitement les produits europeens : Bayrol, Zodiac, HTH, AstralPool, BWT, Biopool, Ocedis, Mareva, Pontaqua.

Quand tu recommandes un traitement, tu cites TOUJOURS :
- Le nom exact du produit commercial (ex: Bayrol Chlorifix, Zodiac pH Minus, HTH Choc Liquide)
- Le dosage precis pour un volume de piscine standard de 50m3
- La raison chimique du probleme
- Le moment ideal pour traiter
- Les precautions de securite essentielles

Tu tiens compte de la meteo, de la localisation, de l heure de prise de vue et de l historique pour affiner ton diagnostic.

Tu reponds UNIQUEMENT en JSON brut valide, sans markdown, sans backticks, sans texte avant ou apres. Commence directement par { et termine par }.`,

    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: photoBase64 }
        },
        {
          type: 'text',
          text: `Analyse cette photo de piscine.

CONTEXTE COMPLET :
- Saison : ${context.season}
${weatherBlock}
${locationBlock}
${metaBlock}
${historyBlock}

Reponds avec exactement ce JSON :
{
  "score_global": <note de 1 a 10>,
  "etat": <"excellent" ou "bon" ou "attention" ou "urgent">,
  "resume": "<phrase de 10 mots max decrivant letat general>",
  "impact_contexte": "<comment la meteo, lheure et la localisation influencent cet etat>",
  "observations": {
    "couleur": "<description precise de la couleur et teinte de leau>",
    "transparence": "<limpide ou legerement trouble ou trouble ou opaque>",
    "mousse": <true ou false>,
    "depot_visible": <true ou false>,
    "algues_suspectees": <true ou false>
  },
  "problemes_detectes": [
    "<probleme 1 avec explication chimique>",
    "<probleme 2 si present>"
  ],
  "evolution_vs_precedent": "<amelioration ou stable ou degradation ou premiere analyse>",
  "plan_action": [
    {
      "priorite": <1 ou 2 ou 3>,
      "action": "<description complete et precise de laction a realiser>",
      "explication": "<pourquoi ce traitement est necessaire, cause chimique detaillee>",
      "produit_recommande": "<nom commercial exact du produit>",
      "marque_alternative": "<autre marque equivalente>",
      "dosage": "<dosage precis pour 50m3 et comment ladapter>",
      "moment_application": "<ex: le soir apres baignade, eau en circulation>",
      "precautions": "<securite et conseils dapplication>",
      "delai": "<maintenant ou dans 24h ou dans 48h>"
    }
  ],
  "conseil_prevention": "<conseil detaille pour eviter ce probleme avec frequence de traitement recommandee>",
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