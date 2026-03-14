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

function getTimeOfDay(hour: number): string {
  if (hour >= 6 && hour < 12) return 'matin'
  if (hour >= 12 && hour < 14) return 'midi'
  if (hour >= 14 && hour < 19) return 'apres-midi'
  if (hour >= 19 && hour < 22) return 'soiree'
  return 'nuit'
}

async function getWeather(lat: number, lng: number) {
  try {
    const [current, geo] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=fr`).then(r => r.json()),
      fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lng}&limit=1&appid=${process.env.OPENWEATHER_API_KEY}`).then(r => r.json())
    ])
    const tempAir = Math.round(current.main?.temp ?? 20)
    return {
      weather: {
        temp_air: tempAir,
        humidity: current.main?.humidity ?? 50,
        description: current.weather?.[0]?.description ?? '',
        rain_last_7d: current.rain?.['1h'] ?? 0,
        temp_water_estimated: Math.round(tempAir * 0.85)
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

async function extractExif(buffer: ArrayBuffer) {
  try {
    const { default: exifr } = await import('exifr')
    const exif = await exifr.parse(Buffer.from(buffer), {
      gps: true,
      tiff: true,
      exif: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'Make', 'Model']
    })
    if (!exif) return null
    return {
      date: exif.DateTimeOriginal || exif.CreateDate || null,
      lat: exif.latitude || null,
      lng: exif.longitude || null,
      camera: exif.Make ? `${exif.Make} ${exif.Model || ''}`.trim() : null
    }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const photoFile = formData.get('photo') as File
    const latForm = parseFloat(formData.get('lat') as string || '0')
    const lngForm = parseFloat(formData.get('lng') as string || '0')
    const historyRaw = formData.get('history') as string | null

    if (!photoFile) return NextResponse.json({ error: 'Photo manquante' }, { status: 400 })

    const photoBuffer = await photoFile.arrayBuffer()
    const photoBase64 = Buffer.from(photoBuffer).toString('base64')
    const mimeType = getMimeType(photoFile)

    const exif = await extractExif(photoBuffer)

    const lat = exif?.lat || latForm
    const lng = exif?.lng || lngForm

    const photoDate = exif?.date ? new Date(exif.date) : new Date()
    const hour = photoDate.getHours()
    const timeOfDay = getTimeOfDay(hour)
    const dayOfWeek = photoDate.toLocaleDateString('fr-FR', { weekday: 'long' })

    const geoData = lat && lng ? await getWeather(lat, lng) : null
    const previousAnalyses = historyRaw ? JSON.parse(historyRaw) : []

    const photoMeta = {
      date: photoDate.toLocaleDateString('fr-FR'),
      heure: `${hour}h${photoDate.getMinutes().toString().padStart(2, '0')}`,
      momentJournee: timeOfDay,
      jourSemaine: dayOfWeek,
      sourceGPS: exif?.lat ? 'EXIF photo' : lat ? 'GPS navigateur' : 'non disponible'
    }

    const diagnostic = await analyzePoolPhoto(photoBase64, null, {
      season: getSeason(photoDate),
      mimeType,
      weather: geoData?.weather,
      location: geoData?.location,
      previousAnalyses,
      photoMeta
    })

    return NextResponse.json({
      diagnostic,
      weather: geoData?.weather,
      location: geoData?.location,
      photoMeta
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}