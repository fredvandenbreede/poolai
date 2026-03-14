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
    { data: profiles },
    { data: liveData }
  ] = await Promise.all([
    supabaseAdmin.from('anonymous_analyses').select('*').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('analyses').select('*').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('settings').select('value').eq('key', 'is_live').single()
  ])

  const allAnalyses = [
    ...(userAnalyses || []).map((a: any) => ({ ...a, source: 'user' })),
    ...(anonAnalyses || []).map((a: any) => ({ ...a, source: 'anonymous' }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Stats de base
  const scores = allAnalyses.map((a: any) => a.score).filter(Boolean)
  const avgScore = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 10) / 10 : 0

  const etatCounts = allAnalyses.reduce((acc: any, a: any) => {
    if (a.etat) acc[a.etat] = (acc[a.etat] || 0) + 1
    return acc
  }, {})

  const countryCounts = allAnalyses.reduce((acc: any, a: any) => {
    const c = a.location_data?.country
    if (c) acc[c] = (acc[c] || 0) + 1
    return acc
  }, {})

  const cityCounts = allAnalyses.reduce((acc: any, a: any) => {
    const c = a.location_data?.city
    if (c && c !== 'Inconnue') acc[c] = (acc[c] || 0) + 1
    return acc
  }, {})

  const volumes = allAnalyses.map((a: any) => a.pool_volume).filter(Boolean)
  const avgVolume = volumes.length ? Math.round(volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length) : 0

  // Ranges de volumes
  const volumeRanges = volumes.reduce((acc: any, v: number) => {
    if (v < 30) acc.small = (acc.small || 0) + 1
    else if (v < 70) acc.medium = (acc.medium || 0) + 1
    else if (v < 120) acc.large = (acc.large || 0) + 1
    else acc.xlarge = (acc.xlarge || 0) + 1
    return acc
  }, {})

  // Nombre de photos par analyse
  const photoCounts = allAnalyses.reduce((acc: any, a: any) => {
    const n = a.photo_count
    if (n === 1) acc.one = (acc.one || 0) + 1
    else if (n === 2) acc.two = (acc.two || 0) + 1
    else if (n >= 3) acc.three = (acc.three || 0) + 1
    return acc
  }, {})

  const today = new Date().toDateString()
  const todayCount = allAnalyses.filter((a: any) => new Date(a.created_at).toDateString() === today).length

  // Enrichir les users avec leurs analyses
  const usersWithDetails = (profiles || []).map((profile: any) => {
    const userAnalysesList = (userAnalyses || []).filter((a: any) => a.user_id === profile.id)
    const userScores = userAnalysesList.map((a: any) => a.score).filter(Boolean)
    const avgUserScore = userScores.length ? Math.round(userScores.reduce((a: number, b: number) => a + b, 0) / userScores.length * 10) / 10 : null
    const lastAnalysis = userAnalysesList[0]
    return {
      ...profile,
      analyses_count: userAnalysesList.length,
      avg_score: avgUserScore,
      last_city: lastAnalysis?.location_data?.city || null,
      last_country: lastAnalysis?.location_data?.country || null,
      analyses: userAnalysesList.slice(0, 10)
    }
  })

  return NextResponse.json({
    stats: {
      total: allAnalyses.length,
      totalUsers: new Set((userAnalyses || []).map((a: any) => a.user_id)).size,
      totalAnon: (anonAnalyses || []).length,
      avgScore,
      avgVolume,
      todayCount,
      etatCounts,
      countryCounts,
      cityCounts: Object.entries(cityCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10),
      volumeRanges,
      photoCounts
    },
    recent: allAnalyses.slice(0, 20),
    users: usersWithDetails,
    isLive: liveData?.value === 'true'
  })
}