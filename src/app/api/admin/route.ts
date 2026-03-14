import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 401 })
  }

  const [
    { data: analyses },
    { data: byEtat },
    { data: byCountry },
    { data: recent },
    { data: liveData }
  ] = await Promise.all([
    supabaseAdmin.from('anonymous_analyses').select('*').order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('anonymous_analyses').select('etat'),
    supabaseAdmin.from('anonymous_analyses').select('location_data'),
    supabaseAdmin.from('anonymous_analyses').select('created_at, score, etat, pool_volume, location_data, photo_count, photo_urls, diagnostic').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('settings').select('value').eq('key', 'is_live').single()
  ])

  const scores = (analyses || []).map((a: any) => a.score).filter(Boolean)
  const avgScore = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 10) / 10 : 0

  const etatCounts = (byEtat || []).reduce((acc: any, a: any) => {
    if (a.etat) acc[a.etat] = (acc[a.etat] || 0) + 1
    return acc
  }, {})

  const countryCounts = (byCountry || []).reduce((acc: any, a: any) => {
    const country = a.location_data?.country
    if (country) acc[country] = (acc[country] || 0) + 1
    return acc
  }, {})

  const cityCounts = (byCountry || []).reduce((acc: any, a: any) => {
    const city = a.location_data?.city
    if (city && city !== 'Inconnue') acc[city] = (acc[city] || 0) + 1
    return acc
  }, {})

  const volumes = (analyses || []).map((a: any) => a.pool_volume).filter(Boolean)
  const avgVolume = volumes.length ? Math.round(volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length) : 0

  const today = new Date().toDateString()
  const todayCount = (analyses || []).filter((a: any) => new Date(a.created_at).toDateString() === today).length

  return NextResponse.json({
    stats: {
      total: analyses?.length || 0,
      avgScore,
      avgVolume,
      todayCount,
      etatCounts,
      countryCounts,
      cityCounts: Object.entries(cityCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10)
    },
    recent: recent || [],
    isLive: liveData?.value === 'true'
  })
}