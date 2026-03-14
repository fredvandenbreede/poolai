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

  const vol = context.poolVolume

  const contextLines = [
    `Saison: ${context.season}`,
    `Volume piscine: ${vol}m3`,
    context.weather ? `Meteo: ${context.weather.temp_air}C, ${context.weather.description}, humidite ${context.weather.humidity}%, eau estimee ${context.weather.temp_water_estimated}C` : '',
    context.location ? `Lieu: ${context.location.city} ${context.location.country}` : '',
    context.photoMeta ? `Photo prise le ${context.photoMeta.date} a ${context.photoMeta.heure} (${context.photoMeta.momentJournee})` : '',
    context.previousAnalyses?.length
      ? `Historique: ${context.previousAnalyses.slice(0, 3).map(a => `${a.date} score ${a.score}/10 ${a.etat}`).join(' | ')}`
      : 'Premiere analyse',
    `Nombre de photos: ${photos.length}`
  ].filter(Boolean).join('\n')

  const imageBlocks: Anthropic.ImageBlockParam[] = photos.map(p => ({
    type: 'image',
    source: { type: 'base64', media_type: p.mediaType, data: p.base64 }
  }))

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    system: `Tu es un expert pisciniste. Reponds UNIQUEMENT en JSON brut valide sans markdown ni backticks. Commence par { et termine par }. Sois concis dans les textes, max 100 caracteres par champ texte.`,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: `Analyse ces photos de piscine.

CONTEXTE:
${contextLines}

Calcule les dosages EXACTEMENT pour ${vol}m3 (base standard 50m3).

Reponds avec ce JSON:
{
  "score_global": 7,
  "etat": "bon",
  "resume": "eau correcte quelques ajustements",
  "impact_contexte": "texte court",
  "synthese_photos": "texte court si plusieurs photos",
  "observations": {
    "couleur": "bleu clair",
    "transparence": "limpide",
    "mousse": false,
    "depot_visible": false,
    "algues_suspectees": false
  },
  "problemes_detectes": ["probleme 1"],
  "evolution_vs_precedent": "stable",
  "plan_action": [
    {
      "priorite": 1,
      "action": "action courte",
      "explication": "explication courte",
      "produit_recommande": "Bayrol Chlorifix",
      "marque_alternative": "HTH Granules",
      "dosage_standard": "200g pour 50m3",
      "dosage_calcule": "${Math.round(vol * 200 / 50)}g pour ${vol}m3",
      "moment_application": "le soir apres baignade",
      "precautions": "ne pas melanger",
      "delai": "maintenant"
    }
  ],
  "conseil_prevention": "conseil court",
  "prochaine_analyse_dans": "1 semaine"
}`
        }
      ]
    }]
  })

  let text = response.content[0].type === 'text' ? response.content[0].text : ''
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  // S'assurer que le JSON est complet
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1) {
    text = text.substring(firstBrace, lastBrace + 1)
  }

  return JSON.parse(text)
}