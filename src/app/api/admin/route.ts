import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 401 })
  }

  const [
    { data: anonAnalyses },
    { data: userAnalyses },
    { data: liveData }
  ] = await Promise.all([
    supabaseAdmin.from('anonymous_analyses').select('*').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('analyses').select('*').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('settings').select('value').eq('key', 'is_live').single()
  ])

  // Fusionner les deux tables
  const allAnalyses = [
    ...(userAnalyses || []).map((a: any) => ({ ...a, source: 'user' })),
    ...(anonAnalyses || []).map((a: any) => ({ ...a, source: 'anonymous' }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Stats
  const scores = allAnalyses.map((a: any) => a.score).filter(Boolean)
  const avgScore = scores.length
    ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 10) / 10
    : 0

  const etatCounts = allAnalyses.reduce((acc: any, a: any) => {
    if (a.etat) acc[a.etat] = (acc[a.etat] || 0) + 1
    return acc
  }, {})

  const countryCounts = allAnalyses.reduce((acc: any, a: any) => {
    const country = a.location_data?.country
    if (country) acc[country] = (acc[country] || 0) + 1
    return acc
  }, {})

  const cityCounts = allAnalyses.reduce((acc: any, a: any) => {
    const city = a.location_data?.city
    if (city && city !== 'Inconnue') acc[city] = (acc[city] || 0) + 1
    return acc
  }, {})

  const volumes = allAnalyses.map((a: any) => a.pool_volume).filter(Boolean)
  const avgVolume = volumes.length
    ? Math.round(volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length)
    : 0

  const today = new Date().toDateString()
  const todayCount = allAnalyses.filter((a: any) =>
    new Date(a.created_at).toDateString() === today
  ).length

  const userCount = new Set((userAnalyses || []).map((a: any) => a.user_id)).size

  return NextResponse.json({
    stats: {
      total: allAnalyses.length,
      totalUsers: userCount,
      totalAnon: (anonAnalyses || []).length,
      avgScore,
      avgVolume,
      todayCount,
      etatCounts,
      countryCounts,
      cityCounts: Object.entries(cityCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10)
    },
    recent: allAnalyses.slice(0, 20),
    isLive: liveData?.value === 'true'
  })
}