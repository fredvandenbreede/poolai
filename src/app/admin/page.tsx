'use client'
import { useState, useEffect } from 'react'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'analyses' | 'users'>('overview')
  const [analyses, setAnalyses] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [isLive, setIsLive] = useState(false)
  const [goLiveLoading, setGoLiveLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('admin_password')
    if (saved) {
      setPassword(saved)
      setRememberMe(true)
      fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: saved })
      }).then(r => r.json()).then(json => {
        if (json.stats) {
          setData(json.stats)
          setAnalyses(json.recent || [])
          setUsers(json.users || [])
          setIsLive(json.isLive || false)
          setAuthed(true)
        } else {
          localStorage.removeItem('admin_password')
        }
      }).catch(() => localStorage.removeItem('admin_password'))
    }
  }, [])

  async function login() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const json = await res.json()
      if (!res.ok) { setError('Mot de passe incorrect'); return }
      if (rememberMe) localStorage.setItem('admin_password', password)
      else localStorage.removeItem('admin_password')
      setData(json.stats)
      setAnalyses(json.recent || [])
      setUsers(json.users || [])
      setIsLive(json.isLive || false)
      setAuthed(true)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  async function toggleLive() {
    const msg = isLive ? 'Remettre en mode test ?' : '🚀 Déployer en public sur pooltester.app ?'
    if (!window.confirm(msg)) return
    setGoLiveLoading(true)
    const res = await fetch('/api/admin/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, live: !isLive })
    })
    const d = await res.json()
    if (d.success) setIsLive(!isLive)
    setGoLiveLoading(false)
  }

  const getColor = (etat: string) => ({
    excellent: '#22c55e', bon: '#84cc16', attention: '#f59e0b', urgent: '#ef4444'
  }[etat] || '#6b7280')

  const StatCard = ({ label, value, sub, color }: any) => (
    <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: color || '#0c4a6e', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>{sub}</p>}
    </div>
  )

  // Donut chart SVG
  const DonutChart = ({ data: chartData, title }: { data: { label: string; value: number; color: string }[], title: string }) => {
    const total = chartData.reduce((s, d) => s + d.value, 0)
    if (total === 0) return (
      <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>Pas de données</div>
    )
    let angle = -90
    const cx = 80, cy = 80, r = 60, inner = 35
    const slices = chartData.map(d => {
      const pct = d.value / total
      const startAngle = angle
      angle += pct * 360
      return { ...d, pct, startAngle, endAngle: angle }
    })

    function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
      const rad = (angleDeg * Math.PI) / 180
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
    }

    function arcPath(startAngle: number, endAngle: number) {
      const start = polarToCartesian(cx, cy, r, startAngle)
      const end = polarToCartesian(cx, cy, r, endAngle)
      const innerStart = polarToCartesian(cx, cy, inner, endAngle)
      const innerEnd = polarToCartesian(cx, cy, inner, startAngle)
      const largeArc = endAngle - startAngle > 180 ? 1 : 0
      return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} L ${innerStart.x} ${innerStart.y} A ${inner} ${inner} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y} Z`
    }

    return (
      <div>
        <p style={{ margin: '0 0 16px', fontWeight: '700', color: '#0c4a6e', fontSize: '15px' }}>{title}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <svg width="160" height="160" viewBox="0 0 160 160">
            {slices.map((s, i) => (
              <path key={i} d={arcPath(s.startAngle, s.endAngle - 0.5)} fill={s.color} />
            ))}
            <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '20px', fontWeight: '800', fill: '#0c4a6e' }}>{total}</text>
            <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: '10px', fill: '#94a3b8' }}>total</text>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {slices.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#374151', textTransform: 'capitalize' }}>{s.label}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: s.color }}>{s.value}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{Math.round(s.pct * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!authed) return (
    <main style={{ minHeight: '100vh', background: '#0c4a6e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏊</div>
        <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#0c4a6e' }}>Pooltester.app</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Dashboard admin</p>
        <input type="password" placeholder="Mot de passe" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          style={{ width: '100%', padding: '14px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '12px', textAlign: 'center', outline: 'none' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '16px', cursor: 'pointer' }}>
          <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0ea5e9' }} />
          <span style={{ fontSize: '14px', color: '#64748b' }}>Rester connecté</span>
        </label>
        {error && <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
        <button onClick={login} disabled={loading}
          style={{ width: '100%', padding: '14px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>
          {loading ? '...' : 'Accéder →'}
        </button>
      </div>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      <header style={{ background: '#0c4a6e', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🏊</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white' }}>Pooltester.app</h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Dashboard admin</p>
          </div>
        </div>
        <button onClick={() => { setAuthed(false); localStorage.removeItem('admin_password') }}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          Déconnexion
        </button>
      </header>

      {/* Bannière GO LIVE */}
      <div style={{ background: isLive ? '#f0fdf4' : '#fffbeb', borderBottom: `2px solid ${isLive ? '#86efac' : '#fde68a'}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: isLive ? '#16a34a' : '#92400e' }}>
            {isLive ? '🟢 APP EN LIGNE' : '🟡 MODE TEST'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: isLive ? '#15803d' : '#a16207' }}>
            {isLive ? 'Visible publiquement sur pooltester.app' : 'App accessible sur pooltester.app/test uniquement'}
          </p>
        </div>
        <button onClick={toggleLive} disabled={goLiveLoading}
          style={{ padding: '10px 20px', background: isLive ? 'white' : '#0ea5e9', color: isLive ? '#dc2626' : 'white', border: isLive ? '2px solid #fecaca' : 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {goLiveLoading ? '...' : isLive ? '⏸ Remettre en test' : '🚀 GO LIVE'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex' }}>
        {[
          { id: 'overview', label: "📊 Analytics" },
          { id: 'analyses', label: '🔬 Analyses' },
          { id: 'users', label: `👤 Users (${users.length})` }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t.id ? '700' : '400', color: tab === t.id ? '#0ea5e9' : '#64748b', borderBottom: tab === t.id ? '2px solid #0ea5e9' : '2px solid transparent', fontSize: '14px' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>

        {/* ===== ANALYTICS ===== */}
        {tab === 'overview' && data && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Total analyses" value={data.total} sub="users + anonymes" />
              <StatCard label="Users inscrits" value={data.totalUsers} sub={`${data.totalAnon} anonymes`} color="#8b5cf6" />
              <StatCard label="Aujourd'hui" value={data.todayCount} color="#0ea5e9" />
              <StatCard label="Score moyen" value={`${data.avgScore}/10`} color={data.avgScore >= 7 ? '#22c55e' : data.avgScore >= 5 ? '#f59e0b' : '#ef4444'} />
              <StatCard label="Volume moyen" value={`${data.avgVolume}m³`} sub="des piscines" />
            </div>

            {/* Donuts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>

              {/* Donut état des piscines */}
              <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <DonutChart
                  title="🎯 État des piscines"
                  data={[
                    { label: 'Excellent', value: data.etatCounts?.excellent || 0, color: '#22c55e' },
                    { label: 'Bon', value: data.etatCounts?.bon || 0, color: '#84cc16' },
                    { label: 'Attention', value: data.etatCounts?.attention || 0, color: '#f59e0b' },
                    { label: 'Urgent', value: data.etatCounts?.urgent || 0, color: '#ef4444' },
                  ].filter(d => d.value > 0)}
                />
              </div>

              {/* Donut users vs anonymes */}
              <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <DonutChart
                  title="👥 Profil des analyseurs"
                  data={[
                    { label: 'Connectés', value: data.total - data.totalAnon, color: '#8b5cf6' },
                    { label: 'Anonymes', value: data.totalAnon, color: '#e2e8f0' },
                  ].filter(d => d.value > 0)}
                />
              </div>

              {/* Donut volumes */}
              <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <DonutChart
                  title="💧 Tailles de piscines"
                  data={[
                    { label: '< 30m³', value: data.volumeRanges?.small || 0, color: '#bfdbfe' },
                    { label: '30–70m³', value: data.volumeRanges?.medium || 0, color: '#0ea5e9' },
                    { label: '70–120m³', value: data.volumeRanges?.large || 0, color: '#0369a1' },
                    { label: '> 120m³', value: data.volumeRanges?.xlarge || 0, color: '#0c4a6e' },
                  ].filter(d => d.value > 0)}
                />
              </div>

              {/* Donut photos par analyse */}
              <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <DonutChart
                  title="📸 Nb photos par analyse"
                  data={[
                    { label: '1 photo', value: data.photoCounts?.one || 0, color: '#fde68a' },
                    { label: '2 photos', value: data.photoCounts?.two || 0, color: '#f59e0b' },
                    { label: '3 photos', value: data.photoCounts?.three || 0, color: '#22c55e' },
                  ].filter(d => d.value > 0)}
                />
              </div>
            </div>

            {/* Top villes + pays */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0c4a6e', fontSize: '15px' }}>📍 Top villes</h3>
                {!data.cityCounts?.length
                  ? <p style={{ color: '#94a3b8', fontSize: '14px' }}>Pas encore de données GPS</p>
                  : data.cityCounts.map(([city, count]: any, i: number) => (
                    <div key={city} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < data.cityCounts.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', minWidth: '24px' }}>#{i + 1}</span>
                        <span style={{ fontSize: '14px', color: '#374151' }}>{city}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ height: '6px', width: `${Math.round(count / data.cityCounts[0][1] * 80)}px`, background: '#0ea5e9', borderRadius: '3px' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#0369a1', minWidth: '20px', textAlign: 'right' }}>{count}</span>
                      </div>
                    </div>
                  ))
                }
              </div>

              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0c4a6e', fontSize: '15px' }}>🌍 Par pays</h3>
                {!Object.keys(data.countryCounts || {}).length
                  ? <p style={{ color: '#94a3b8', fontSize: '14px' }}>Pas encore de données</p>
                  : Object.entries(data.countryCounts).sort((a: any, b: any) => b[1] - a[1]).map(([country, count]: any, i: number, arr: any[]) => (
                    <div key={country} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{country}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ height: '6px', width: `${Math.round(count / arr[0][1] * 80)}px`, background: '#8b5cf6', borderRadius: '3px' }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#7c3aed', minWidth: '20px', textAlign: 'right' }}>{count}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </>
        )}

        {/* ===== ANALYSES ===== */}
        {tab === 'analyses' && (
          <>
            {selectedAnalysis ? (
              <div>
                <button onClick={() => setSelectedAnalysis(null)}
                  style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '14px', marginBottom: '20px', padding: 0 }}>
                  ← Retour
                </button>
                <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'flex-start' }}>
                    <div style={{ background: getColor(selectedAnalysis.etat), borderRadius: '12px', padding: '12px 20px', color: 'white', textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '800' }}>{selectedAnalysis.score}/10</div>
                      <div style={{ fontSize: '12px', textTransform: 'capitalize' }}>{selectedAnalysis.etat}</div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ background: selectedAnalysis.source === 'user' ? '#f5f3ff' : '#f0fdf4', color: selectedAnalysis.source === 'user' ? '#7c3aed' : '#16a34a', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                          {selectedAnalysis.source === 'user' ? '👤 Connecté' : '👻 Anonyme'}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b' }}>📅 {new Date(selectedAnalysis.created_at).toLocaleString('fr-FR')}</p>
                      {selectedAnalysis.location_data?.city && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b' }}>📍 {selectedAnalysis.location_data.city}, {selectedAnalysis.location_data.country}</p>}
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>💧 {selectedAnalysis.pool_volume}m³ — {selectedAnalysis.photo_count} photo{selectedAnalysis.photo_count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {selectedAnalysis.photo_urls?.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ color: '#0c4a6e', margin: '0 0 12px' }}>Photos</h4>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {selectedAnalysis.photo_urls.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '2px solid #e2e8f0' }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <h4 style={{ color: '#0c4a6e', margin: '0 0 12px' }}>Diagnostic</h4>
                  <pre style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', fontSize: '12px', overflow: 'auto', color: '#374151', lineHeight: '1.6', maxHeight: '400px' }}>
                    {JSON.stringify(selectedAnalysis.diagnostic, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ color: '#0c4a6e', margin: 0 }}>Analyses récentes ({analyses.length})</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                      👤 {analyses.filter(a => a.source === 'user').length}
                    </span>
                    <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                      👻 {analyses.filter(a => a.source === 'anonymous').length}
                    </span>
                  </div>
                </div>
                {analyses.length === 0
                  ? <div style={{ background: 'white', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔬</div>
                      <p style={{ color: '#64748b' }}>Aucune analyse pour l'instant</p>
                    </div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {analyses.map((a: any, i: number) => (
                        <div key={i} onClick={() => setSelectedAnalysis(a)}
                          style={{ background: 'white', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', gap: '16px', alignItems: 'center', border: '1px solid #f1f5f9' }}>
                          {a.photo_urls?.[0]
                            ? <img src={a.photo_urls[0]} alt="" style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🏊</div>
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontWeight: '800', fontSize: '18px', color: getColor(a.etat) }}>{a.score}/10</span>
                              <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '20px', color: '#64748b', textTransform: 'capitalize' }}>{a.etat}</span>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>💧 {a.pool_volume}m³</span>
                              <span style={{ fontSize: '11px', background: a.source === 'user' ? '#f5f3ff' : '#f0fdf4', color: a.source === 'user' ? '#7c3aed' : '#16a34a', padding: '1px 6px', borderRadius: '10px', fontWeight: '600' }}>
                                {a.source === 'user' ? '👤' : '👻'}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.diagnostic?.resume || 'Pas de résumé'}</p>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                              {a.location_data?.city && <span style={{ fontSize: '12px', color: '#94a3b8' }}>📍 {a.location_data.city}</span>}
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>📅 {new Date(a.created_at).toLocaleDateString('fr-FR')} {new Date(a.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <span style={{ color: '#cbd5e1', fontSize: '18px' }}>›</span>
                        </div>
                      ))}
                    </div>
                }
              </>
            )}
          </>
        )}

        {/* ===== USERS ===== */}
        {tab === 'users' && (
          <>
            {selectedUser ? (
              <div>
                <button onClick={() => setSelectedUser(null)}
                  style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '14px', marginBottom: '20px', padding: 0 }}>
                  ← Retour aux users
                </button>
                <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>👤</div>
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', color: '#0c4a6e', fontSize: '18px' }}>{selectedUser.email}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                        Inscrit le {new Date(selectedUser.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: '#0369a1' }}>{selectedUser.credits}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Crédits</div>
                    </div>
                    <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a' }}>{selectedUser.analyses_count}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Analyses</div>
                    </div>
                    <div style={{ background: '#f5f3ff', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: '#7c3aed' }}>{selectedUser.avg_score || '—'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Score moyen</div>
                    </div>
                  </div>

                  {selectedUser.last_city && (
                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
                        📍 Dernière localisation : <strong>{selectedUser.last_city}, {selectedUser.last_country}</strong>
                      </p>
                    </div>
                  )}
                </div>

                {/* Analyses de ce user */}
                <h3 style={{ color: '#0c4a6e', margin: '0 0 16px' }}>Analyses de ce user</h3>
                {selectedUser.analyses?.length === 0
                  ? <p style={{ color: '#94a3b8' }}>Aucune analyse</p>
                  : selectedUser.analyses?.map((a: any, i: number) => (
                    <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '14px 18px', marginBottom: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', display: 'flex', gap: '14px', alignItems: 'center' }}>
                      {a.photo_urls?.[0] && <img src={a.photo_urls[0]} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '800', fontSize: '16px', color: getColor(a.etat) }}>{a.score}/10</span>
                          <span style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '20px', color: '#64748b', textTransform: 'capitalize' }}>{a.etat}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>💧 {a.pool_volume}m³</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.diagnostic?.resume}</p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                          {a.location_data?.city && <span style={{ fontSize: '11px', color: '#94a3b8' }}>📍 {a.location_data.city}</span>}
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>📅 {new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            ) : (
              <>
                <h3 style={{ color: '#0c4a6e', margin: '0 0 16px' }}>Users inscrits ({users.length})</h3>
                {users.length === 0
                  ? <div style={{ background: 'white', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
                      <p style={{ color: '#64748b' }}>Aucun user inscrit pour l'instant</p>
                    </div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {users.map((u: any, i: number) => (
                        <div key={i} onClick={() => setSelectedUser(u)}
                          style={{ background: 'white', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center', border: '1px solid #f1f5f9' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>👤</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#0c4a6e', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                🔬 {u.analyses_count} analyse{u.analyses_count !== 1 ? 's' : ''}
                              </span>
                              <span style={{ fontSize: '12px', color: u.credits > 0 ? '#0369a1' : '#dc2626' }}>
                                💳 {u.credits} crédit{u.credits !== 1 ? 's' : ''}
                              </span>
                              {u.last_city && <span style={{ fontSize: '12px', color: '#94a3b8' }}>📍 {u.last_city}</span>}
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>📅 {new Date(u.created_at).toLocaleDateString('fr-FR')}</span>
                            </div>
                          </div>
                          {u.avg_score && (
                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                              <div style={{ fontWeight: '800', fontSize: '18px', color: u.avg_score >= 7 ? '#22c55e' : u.avg_score >= 5 ? '#f59e0b' : '#ef4444' }}>{u.avg_score}</div>
                              <div style={{ fontSize: '10px', color: '#94a3b8' }}>moy.</div>
                            </div>
                          )}
                          <span style={{ color: '#cbd5e1', fontSize: '18px' }}>›</span>
                        </div>
                      ))}
                    </div>
                }
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}