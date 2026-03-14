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
    max_tokens: 2000,
    system: `Tu es un expert pisciniste avec 20 ans d'experience. Tu connais parfaitement les produits du marche europeen : Bayrol, Zodiac, HTH, AstralPool, BWT, Biopool, Ocedis, Desinfection Piscine, Mareva, Pontaqua.

Quand tu recommandes un traitement, tu cites TOUJOURS :
- Le nom exact du produit commercial (ex: Bayrol Chlorifix, Zodiac pH Minus, HTH Choc Liquide)
- Le dosage precis pour un volume de piscine standard (ex: 150g pour 50m3)
- La raison chimique du probleme (ex: pH trop bas acidifie l'eau et corrode les equipements)
- Le moment ideal pour traiter (ex: le soir apres la baignade, jamais en plein soleil)
- Les precautions de securite essentielles

Tu reponds UNIQUEMENT en JSON brut valide, sans markdown, sans backticks, sans texte avant ou apres. Commence directement par { et termine par }.`,

    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: photoBase64 } },
        { type: 'text', text: `Analyse cette photo de piscine. Saison: ${context.season}.

Reponds avec exactement ce JSON:
{
  "score_global": <note de 1 a 10>,
  "etat": <"excellent"|"bon"|"attention"|"urgent">,
  "resume": "<phrase de 10 mots max decrivant letat general>",
  "observations": {
    "couleur": "<description precise de la couleur et teinte de leau>",
    "transparence": "<limpide|legerement trouble|trouble|opaque>",
    "mousse": <true|false>,
    "depot_visible": <true|false>,
    "algues_suspectees": <true|false>
  },
  "problemes_detectes": [
    "<probleme 1 avec explication chimique>",
    "<probleme 2 si present>"
  ],
  "plan_action": [
    {
      "priorite": <1|2|3>,
      "action": "<description complete et precise de laction a realiser>",
      "explication": "<pourquoi ce traitement est necessaire, cause chimique>",
      "produit_recommande": "<nom commercial exact du produit, ex: Bayrol Chlorifix>",
      "marque_alternative": "<autre marque equivalent, ex: HTH Granules>",
      "dosage": "<dosage precis pour 50m3, et comment ladapter>",
      "moment_application": "<ex: le soir apres baignade, eau en circulation>",
      "precautions": "<securite et conseils dapplication>",
      "delai": "<maintenant|dans 24h|dans 48h>"
    }
  ],
  "conseil_prevention": "<conseil detaille pour eviter ce probleme, avec frequence de traitement recommandee>",
  "prochaine_analyse_dans": "<3 jours|1 semaine|2 semaines>"
}` }
      ]
    }]
  })

  let text = response.content[0].type === 'text' ? response.content[0].text : ''
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(text)
}
