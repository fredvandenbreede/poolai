import { NextRequest, NextResponse } from 'next/server'
import { analyzePoolPhoto } from '../../../lib/claude'

function getSeason(date: Date): string {
  const m = date.getMonth() + 1
  if (m >= 3 && m <= 5) return 'printemps'
  if (m >= 6 && m <= 8) return 'été'
  if (m >= 9 && m <= 11) return 'automne'
  return 'hiver'
}

function getMimeType(file: File): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const type = file.type
  if (type === 'image/png') return 'image/png'
  if (type === 'image/gif') return 'image/gif'
  if (type === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const photoFile = formData.get('photo') as File
    if (!photoFile) return NextResponse.json({ error: 'Photo manquante' }, { status: 400 })

    const photoBuffer = await photoFile.arrayBuffer()
    const photoBase64 = Buffer.from(photoBuffer).toString('base64')
    const mimeType = getMimeType(photoFile)

    const diagnostic = await analyzePoolPhoto(photoBase64, null, {
      season: getSeason(new Date()),
      mimeType
    })

    return NextResponse.json({ diagnostic })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}
