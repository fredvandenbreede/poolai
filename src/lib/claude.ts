import Anthropic from '@anthropic-ai/sdk'

interface AnalysisContext {
  season: string
  mimeType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

export async function analyzePoolPhoto(
  photoBase64: string,
  _stripBase64: string | null,
  context: AnalysisContext
): Promise<object> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const mediaType = context.mimeType || 'image/jpeg'

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    system: `Tu es un expert en traitement de l'eau de piscine. Tu reponds UNIQUEMENT en JSON brut valide, sans markdown, sans backticks, sans texte avant ou apres. Commence directement par { et termine par }.`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: photoBase64 } },
        { type: 'text', text: `Analyse cette photo de piscine. Saison: ${context.season}. Reponds avec ce JSON et seulement ce JSON:
{
  "score_global": 7,
  "etat": "bon",
  "resume": "description courte",
  "observations": {
    "couleur": "description couleur eau",
    "transparence": "limpide",
    "mousse": false,
    "depot_visible": false,
    "algues_suspectees": false
  },
  "problemes_detectes": [],
  "plan_action": [
    {
      "priorite": 1,
      "action": "action concrete",
      "produit_type": null,
      "dosage": "n/a",
      "delai": "dans 24h"
    }
  ],
  "conseil_prevention": "conseil pratique",
  "prochaine_analyse_dans": "1 semaine"
}` }
      ]
    }]
  })

  let text = response.content[0].type === 'text' ? response.content[0].text : ''
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(text)
}
