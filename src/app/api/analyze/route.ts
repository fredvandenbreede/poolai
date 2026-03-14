import { NextRequest, NextResponse } from 'next/server'
import { analyzePoolPhoto } from '../../lib/claude'

function getSeason(date: Date): string {
  const m = date.getMonth() + 1
  if (m >= 3 && m <= 5) return 'printemps'
  if (m >= 6 && m <= 8) return 'été'
  if (m >= 9 && m <= 11) return 'automne'
  return 'hiver'
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const photoFile = formData.get('photo') as File
    if (!photoFile) return NextResponse.json({ error: 'Photo manquante' }, { status: 400 })

    const photoBuffer = await photoFile.arrayBuffer()
    const photoBase64 = Buffer.from(photoBuffer).toString('base64')

    const diagnostic = await analyzePoolPhoto(photoBase64, null, {
      season: getSeason(new Date())
    })

    return NextResponse.json({ diagnostic })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}