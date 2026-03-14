import { NextRequest, NextResponse } from 'next/server'
import { analyzePoolPhoto } from '../../../lib/claude'
import { supabaseAdmin } from '../../../lib/supabase'

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
        lat, lng
      }
    }
  } catch { return null }
}

async function extractExif(buffer: ArrayBuffer) {
  try {
    const { default: exifr } = await import('exifr')
    const exif = await exifr.parse(Buffer.from(buffer), {
      gps: true, tiff: true, exif: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude']
    })
    if (!exif) return null
    return {
      date: exif.DateTimeOriginal || exif.CreateDate || null,
      lat: exif.latitude || null,
      lng: exif.longitude || null,
    }
  } catch { return null }
}

async function uploadPhoto(
  buffer: ArrayBuffer,
  sessionId: string,
  index: number,
  mimeType: string
): Promise<string | null> {
  try {
    const ext = mimeType.split('/')[1] || 'jpg'
    const path = `anonymous/${sessionId}/photo_${index}.${ext}`
    const { error } = await supabaseAdmin.storage
      .from('pool-photos')
      .upload(path, Buffer.from(buffer), {
        contentType: mimeType,
        upsert: true
      })
    if (error) return null
    const { data } = supabaseAdmin.storage.from('pool-photos').getPublicUrl(path)
    return data.publicUrl
  } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const poolVolume = parseInt(formData.get('poolVolume') as string || '50')
    const latForm = parseFloat(formData.get('lat') as string || '0')
    const lngForm = parseFloat(formData.get('lng') as string || '0')
    const historyRaw = formData.get('history') as string | null
    const sessionId = formData.get('sessionId') as string || `anon_${Date.now()}`

    const photoFiles: File[] = []
    for (let i = 1; i <= 5; i++) {
      const f = formData.get(`photo${i}`) as File | null
      if (f) photoFiles.push(f)
    }

    if (photoFiles.length === 0) {
      return NextResponse.json({ error: 'Au moins une photo requise' }, { status: 400 })
    }

    // Traiter toutes les photos en parallèle
    const photoBuffers = await Promise.all(photoFiles.map(f => f.arrayBuffer()))
    const mimeTypes = photoFiles.map(getMimeType)

    // Upload photos vers Supabase Storage en parallèle
    const photoUrls = await Promise.all(
      photoBuffers.map((buf, i) => uploadPhoto(buf, sessionId, i + 1, mimeTypes[i]))
    )

    const photos = photoBuffers.map((buf, i) => ({
      base64: Buffer.from(buf).toString('base64'),
      mediaType: mimeTypes[i]
    }))

    // EXIF de la première photo
    const exif = await extractExif(photoBuffers[0])
    const lat = exif?.lat || latForm
    const lng = exif?.lng || lngForm
    const photoDate = exif?.date ? new Date(exif.date) : new Date()
    const hour = photoDate.getHours()

    const geoData = lat && lng ? await getWeather(lat, lng) : null
    const previousAnalyses = historyRaw ? JSON.parse(historyRaw) : []

    const photoMeta = {
      date: photoDate.toLocaleDateString('fr-FR'),
      heure: `${hour}h${photoDate.getMinutes().toString().padStart(2, '0')}`,
      momentJournee: getTimeOfDay(hour),
      jourSemaine: photoDate.toLocaleDateString('fr-FR', { weekday: 'long' }),
      sourceGPS: exif?.lat ? 'EXIF photo' : lat ? 'GPS navigateur' : 'non disponible'
    }

    // Appel Claude Vision
    const diagnostic = await analyzePoolPhoto(photos, {
      season: getSeason(photoDate),
      poolVolume,
      weather: geoData?.weather,
      location: geoData?.location,
      previousAnalyses,
      photoMeta,
      photoCount: photos.length
    })

    const diagAny = diagnostic as any

    // Sauvegarder en base de données (anonyme)
    await supabaseAdmin.from('anonymous_analyses').insert({
      session_id: sessionId,
      photo_urls: photoUrls.filter(Boolean),
      diagnostic,
      weather_data: geoData?.weather || null,
      location_data: geoData?.location || null,
      photo_meta: photoMeta,
      pool_volume: poolVolume,
      photo_count: photos.length,
      score: diagAny.score_global || null,
      etat: diagAny.etat || null
    })

    return NextResponse.json({
      diagnostic,
      weather: geoData?.weather,
      location: geoData?.location,
      photoMeta,
      photoUrls: photoUrls.filter(Boolean),
      sessionId
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}