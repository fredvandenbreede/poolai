import { NextRequest, NextResponse } from 'next/server'
import { analyzePoolPhoto } from '../../../lib/claude'

function getSeason(date: Date): string {
  const m = date.getMonth() + 1
  if (m >= 3 && m <= 5) return 'printemps'
  if (m >= 6 && m <= 8) return 'ete'
  if (m >= 9 && m <= 11) return 'automne'
  return 'hiver'
}

function getMimeType(file: File): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  if (file.type === 'image/png') return 'image/png'
  if (file.type === 'image/gif') return 'image/gif'
  if (file.type === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

async function getWeather(lat: number, lng: number) {
  try {
    const [current, geo] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=fr`).then(r => r.json()),
      fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lng}&limit=1&appid=${process.env.OPENWEATHER_API_KEY}`).then(r => r.json())
    ])
    const tempAir = Math.round(current.main?.temp ?? 20)
    const tempWater = Math.round(tempAir * 0.85)
    return {
      weather: {
        temp_air: tempAir,
        humidity: current.main?.humidity ?? 50,
        description: current.weather?.[0]?.description ?? '',
        rain_last_7d: current.rain?.['1h'] ?? 0,
        temp_water_estimated: tempWater
      },
      location: {
        city: geo[0]?.name ?? 'Inconnue',
        country: geo[0]?.country ?? '',
        lat,
        lng
      }
    }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const photoFile = formData.get('photo') as File
    const lat = parseFloat(formData.get('lat') as string || '0')
    const lng = parseFloat(formData.get('lng') as string || '0')
    const historyRaw = formData.get('history') as string | null

    if (!photoFile) return NextResponse.json({ error: 'Photo manquante' }, { status: 400 })

    const photoBuffer = await photoFile.arrayBuffer()
    const photoBase64 = Buffer.from(photoBuffer).toString('base64')
    const mimeType = getMimeType(photoFile)

    const geoData = lat && lng ? await getWeather(lat, lng) : null
    const previousAnalyses = historyRaw ? JSON.parse(historyRaw) : []

    const diagnostic = await analyzePoolPhoto(photoBase64, null, {
      season: getSeason(new Date()),
      mimeType,
      weather: geoData?.weather,
      location: geoData?.location,
      previousAnalyses
    })

    return NextResponse.json({
      diagnostic,
      weather: geoData?.weather,
      location: geoData?.location
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}
