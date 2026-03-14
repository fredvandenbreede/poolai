'use client'
import { useState } from 'react'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'analyses'>('overview')
  const [analyses, setAnalyses] = useState<any[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null)

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
      setData(json.stats)
      setAnalyses(json.recent || [])
      setAuthed(true)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  const getColor = (etat: string) => ({ excellent: '#22c55e', bon: '#84cc16', attention: '#f59e0b', urgent: '#ef4444' }[etat] || '#6b7280')

  const StatCard = ({ label, value, sub, color }: any) => (
    <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: color || '#0c4a6e', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>{sub}</p>}
    </div>
  )

  if (!authed) return (
    <main style={{ minHeight: '100vh', background: '#0c4a6e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏊</div>
        <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '800', color: '#0c4a6e' }}>Pool Water AI</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>Dashboard admin</p>
        <input type="password" placeholder="Mot de passe" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          style={{ width: '100%', padding: '14px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '12px', textAlign: 'center' }} />
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
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white' }}>Pool Water AI</h1>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Dashboard admin</p>
          </div>
        </div>
        <button onClick={() => setAuthed(false)}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          Déconnexion
        </button>
      </header>

      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', gap: '4px' }}>
        {[{ id: 'overview', label: "📊 Vue d'ensemble" }, { id: 'analyses', label: '🔬 Analyses récentes' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: tab === t.id ? '700' : '400', color: tab === t.id ? '#0ea5e9' : '#64748b', borderBottom: tab === t.id ? '2px solid #0ea5e9' : '2px solid transparent', fontSize: '14px' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>

        {tab === 'overview' && data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Total analyses" value={data.total} sub="depuis le lancement" />
              <StatCard label="Analyses aujourd'hui" value={data.todayCount} color="#0ea5e9" />
              <StatCard label="Score eau moyen" value={`${data.avgScore}/10`} color={data.avgScore >= 7 ? '#22c55e' : data.avgScore >= 5 ? '#f59e0b' : '#ef4444'} />
              <StatCard label="Volume moyen" value={`${data.avgVolume}m³`} sub="des piscines analysées" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0c4a6e', fontSize: '15px' }}>🎯 État des piscines</h3>
                {Object.entries(data.etatCounts || {}).sort((a: any, b: any) => b[1] - a[1]).map(([etat, count]: any) => (
                  <div key={etat} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151', textTransform: 'capitalize' }}>{etat}</span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: getColor(etat) }}>{count}</span>
                    </div>
                    <div style={{ background: '#f1f5f9', borderRadius: '20px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(count / data.total * 100)}%`, background: getColor(etat), borderRadius: '20px' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{Math.round(count / data.total * 100)}%</span>
                  </div>
                ))}
              </div>

              <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 16px', color: '#0c4a6e', fontSize: '15px' }}>📍 Top villes</h3>
                {data.cityCounts?.length === 0 && <p style={{ color: '#94a3b8', fontSize: '14px' }}>Pas encore de données GPS</p>}
                {data.cityCounts?.map(([city, count]: any, i: number) => (
                  <div key={city} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < data.cityCounts.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '700', minWidth: '20px' }}>#{i + 1}</span>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{city}</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#0369a1' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {data.total === 0 && (
              <div style={{ background: 'white', borderRadius: '14px', padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <h3 style={{ color: '#0c4a6e', margin: '0 0 8px' }}>Aucune analyse pour l'instant</h3>
                <p style={{ color: '#64748b', fontSize: '14px' }}>Les données apparaîtront ici dès la première analyse.</p>
              </div>
            )}
          </>
        )}

        {tab === 'analyses' && (
          <>
            {selectedAnalysis ? (
              <div>
                <button onClick={() => setSelectedAnalysis(null)}
                  style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '14px', marginBottom: '20px', padding: 0 }}>
                  ← Retour
                </button>
                <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <div style={{ background: getColor(selectedAnalysis.etat), borderRadius: '12px', padding: '12px 20px', color: 'white', textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '800' }}>{selectedAnalysis.score}/10</div>
                      <div style={{ fontSize: '12px', textTransform: 'capitalize' }}>{selectedAnalysis.etat}</div>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b' }}>📅 {new Date(selectedAnalysis.created_at).toLocaleString('fr-FR')}</p>
                      {selectedAnalysis.location_data?.city && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b' }}>📍 {selectedAnalysis.location_data.city}, {selectedAnalysis.location_data.country}</p>}
                      <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748b' }}>💧 {selectedAnalysis.pool_volume}m³ — {selectedAnalysis.photo_count} photo{selectedAnalysis.photo_count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {selectedAnalysis.photo_urls?.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ color: '#0c4a6e', margin: '0 0 12px' }}>Photos</h4>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {selectedAnalysis.photo_urls.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Photo ${i + 1}`} style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', border: '2px solid #e2e8f0' }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <h4 style={{ color: '#0c4a6e', margin: '0 0 12px' }}>Diagnostic complet</h4>
                  <pre style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', fontSize: '12px', overflow: 'auto', color: '#374151', lineHeight: '1.6', maxHeight: '400px' }}>
                    {JSON.stringify(selectedAnalysis.diagnostic, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <>
                <h3 style={{ color: '#0c4a6e', margin: '0 0 16px' }}>Analyses récentes</h3>
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
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontWeight: '800', fontSize: '18px', color: getColor(a.etat) }}>{a.score}/10</span>
                              <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '20px', color: '#64748b', textTransform: 'capitalize' }}>{a.etat}</span>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>💧 {a.pool_volume}m³</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.diagnostic?.resume || 'Pas de résumé'}</p>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                              {a.location_data?.city && <span style={{ fontSize: '12px', color: '#94a3b8' }}>📍 {a.location_data.city}</span>}
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>📅 {new Date(a.created_at).toLocaleDateString('fr-FR')} {new Date(a.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>📸 {a.photo_count} photo{a.photo_count > 1 ? 's' : ''}</span>
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
      </div>
    </main>
  )
}
