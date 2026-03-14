import Anthropic from '@anthropic-ai/sdk'

interface AnalysisContext {
  season: string
}

export async function analyzePoolPhoto(
  photoBase64: string,
  _stripBase64: string | null,
  context: AnalysisContext
): Promise<object> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    system: `Tu es un expert en traitement eau de piscine. Reponds UNIQUEMENT en JSON valide.`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoBase64 } },
        { type: 'text', text: `Analyse cette photo de piscine. Saison: ${context.season}. Retourne exactement ce JSON:
{
  "score_global": 7,
  "etat": "bon",
  "resume": "description courte",
  "observations": {
    "couleur": "description",
    "transparence": "limpide",
    "mousse": false,
    "depot_visible": false,
    "algues_suspectees": false
  },
  "problemes_detectes": [],
  "plan_action": [
    {
      "priorite": 1,
      "action": "action a faire",
      "produit_type": null,
      "dosage": "n/a",
      "delai": "dans 24h"
    }
  ],
  "conseil_prevention": "conseil",
  "prochaine_analyse_dans": "1 semaine"
}` }
      ]
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text)
}
