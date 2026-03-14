'use client'
import { useState, useRef, useEffect } from 'react'

interface SavedAnalysis {
  id: string
  date: string
  score: number
  etat: string
  resume: string
  problemes: string[]
  diagnostic: any
  weather?: any
  location?: any
  photoPreview: string
}

export default function Home() {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [weather, setWeather] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<SavedAnalysis[]>([])
  const [view, setView] = useState<'analyze' | 'history'>('analyze')
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('pool_analyses')
    if (saved) setHistory(JSON.parse(saved))
  }, [])

  function saveAnalysis(diagnostic: any, weatherData: any, locationData: any, preview: string) {
    const newAnalysis: SavedAnalysis = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      score: diagnostic.score_global,
      etat: diagnostic.etat,
      resume: diagnostic.resume,
      problemes: diagnostic.problemes_detectes || [],
      diagnostic,
      weather: weatherData,
      location: locationData,
      photoPreview: preview
    }
    const updated = [newAnalysis, ...history].slice(0, 20)
    setHistory(updated)
    localStorage.setItem('pool_analyses', JSON.stringify(updated))
    return updated
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setResult(null); setError(null)
  }

  async function analyze() {
    if (!photo) return
    setLoading(true); setError(null)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      ).catch(() => null)

      const historyForPrompt = history.slice(0, 5).map(a => ({
        date: a.date, score: a.score, etat: a.etat, resume: a.resume, problemes: a.problemes
      }))

      const formData = new FormData()
      formData.append('photo', photo)
      if (pos) {
        formData.append('lat', pos.coords.latitude.toString())
        formData.append('lng', pos.coords.longitude.toString())
      }
      formData.append('history', JSON.stringify(historyForPrompt))

      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur'); return }

      setResult(data.diagnostic)
      setWeather(data.weather)
      setLocation(data.location)
      saveAnalysis(data.diagnostic, data.weather, data.location, photoPreview!)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  const getColor = (etat: string) => ({ excellent: '#22c55e', bon: '#84cc16', attention: '#f59e0b', urgent: '#ef4444' }[etat] || '#6b7280')

  const DiagnosticView = ({ r, w, l }: { r: any, w?: any, l?: any }) => (
    <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ background: getColor(r.etat), padding: '24px', color: 'white', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', fontWeight: '800' }}>{r.score_global}/10</div>
        <div style={{ fontSize: '20px', fontWeight: '600', marginTop: '4px', textTransform: 'capitalize' }}>{r.etat}</div>
        <div style={{ opacity: 0.9, marginTop: '8px' }}>{r.resume}</div>
        {r.evolution_vs_precedent && r.evolution_vs_precedent !== 'premiere analyse' && (
          <div style={{ marginTop: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}>
            {r.evolution_vs_precedent === 'amelioration' ? '📈 En amélioration' : r.evolution_vs_precedent === 'degradation' ? '📉 En dégradation' : '➡️ Stable'} vs dernière analyse
          </div>
        )}
      </div>

      <div style={{ padding: '20px' }}>
        {(w || l) && (
          <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {l && <span style={{ fontSize: '13px', color: '#0369a1' }}>📍 {l.city}, {l.country}</span>}
            {w && <>
              <span style={{ fontSize: '13px', color: '#0369a1' }}>🌡️ Air {w.temp_air}°C</span>
              <span style={{ fontSize: '13px', color: '#0369a1' }}>💧 Eau ~{w.temp_water_estimated}°C</span>
              <span style={{ fontSize: '13px', color: '#0369a1' }}>☁️ {w.description}</span>
            </>}
          </div>
        )}

        {r.impact_meteo && (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>🌤️ <strong>Impact météo :</strong> {r.impact_meteo}</p>
          </div>
        )}

        <h3 style={{ color: '#0c4a6e', marginTop: 0 }}>Observations</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          {Object.entries(r.observations || {}).map(([key, val]) => (
            <div key={key} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</div>
              <div style={{ fontWeight: '600', color: '#0c4a6e', fontSize: '14px', marginTop: '2px' }}>
                {typeof val === 'boolean' ? (val ? '⚠️ Oui' : '✅ Non') : String(val)}
              </div>
            </div>
          ))}
        </div>

        {r.plan_action?.length > 0 && (
          <>
            <h3 style={{ color: '#0c4a6e' }}>Plan d'action</h3>
            {r.plan_action.map((action: any, i: number) => (
              <div key={i} style={{ border: `1.5px solid ${action.priorite === 1 ? '#fecaca' : action.priorite === 2 ? '#fed7aa' : '#d1fae5'}`, borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', color: '#0c4a6e', fontSize: '14px' }}>Priorité {action.priorite}</span>
                  <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '8px', color: '#64748b' }}>{action.delai}</span>
                </div>
                <p style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '15px', fontWeight: '600' }}>{action.action}</p>
                {action.explication && <p style={{ margin: '0 0 10px', color: '#475569', fontSize: '13px', lineHeight: '1.5' }}>💡 {action.explication}</p>}
                <div style={{ background: '#f0f9ff', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '700', color: '#0369a1' }}>🧪 {action.produit_recommande}</p>
                  {action.marque_alternative && <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#64748b' }}>Alternative : {action.marque_alternative}</p>}
                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#0c4a6e' }}>📏 {action.dosage}</p>
                  {action.moment_application && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#0c4a6e' }}>🕐 {action.moment_application}</p>}
                </div>
                {action.precautions && <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', background: '#fef2f2', padding: '8px', borderRadius: '6px' }}>⚠️ {action.precautions}</p>}
              </div>
            ))}
          </>
        )}

        {r.conseil_prevention && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px' }}>
            <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>💡 <strong>Prévention :</strong> {r.conseil_prevention}</p>
          </div>
        )}
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '16px' }}>Prochaine analyse recommandée : {r.prochaine_analyse_dans}</p>
      </div>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#f0f9ff', fontFamily: 'system-ui, sans-serif', paddingBottom: '80px' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #e0f2fe', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: '700', color: '#0c4a6e', fontSize: '18px' }}>🏊 Pool Water AI</span>
        <span style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>MODE TEST</span>
      </header>

      {/* Navigation */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #e0f2fe', padding: '0 20px' }}>
        {[{ id: 'analyze', label: '🔬 Analyser' }, { id: 'history', label: `📋 Historique (${history.length})` }].map(tab => (
          <button key={tab.id} onClick={() => { setView(tab.id as any); setSelectedAnalysis(null) }}
            style={{ padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: view === tab.id ? '700' : '400', color: view === tab.id ? '#0ea5e9' : '#64748b', borderBottom: view === tab.id ? '2px solid #0ea5e9' : '2px solid transparent', fontSize: '14px' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px' }}>

        {/* Vue analyse */}
        {view === 'analyze' && (
          <>
            <div onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${photoPreview ? '#0ea5e9' : '#93c5fd'}`, borderRadius: '16px', background: photoPreview ? 'transparent' : 'white', overflow: 'hidden', cursor: 'pointer', marginBottom: '16px', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {photoPreview
                ? <img src={photoPreview} alt="Apercu" style={{ width: '100%', objectFit: 'cover', maxHeight: '320px' }} />
                : <div style={{ textAlign: 'center', padding: '32px', color: '#0369a1' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📸</div>
                    <p style={{ fontWeight: '600', margin: 0 }}>Photographier ma piscine</p>
                    <p style={{ fontSize: '14px', color: '#64748b', marginTop: '6px' }}>Cliquez pour choisir une photo</p>
                  </div>
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
            <button onClick={analyze} disabled={!photo || loading}
              style={{ width: '100%', padding: '16px', background: photo ? '#0ea5e9' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '14px', fontSize: '17px', fontWeight: '700', cursor: photo ? 'pointer' : 'not-allowed', marginBottom: '12px' }}>
              {loading ? '⏳ Analyse en cours...' : '🔬 Analyser cette piscine'}
            </button>
            {history.length > 0 && !loading && !result && (
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                {history.length} analyse{history.length > 1 ? 's' : ''} sauvegardée{history.length > 1 ? 's' : ''} — l'IA en tient compte
              </p>
            )}
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', color: '#dc2626', marginBottom: '16px' }}>{error}</div>}
            {result && <DiagnosticView r={result} w={weather} l={location} />}
          </>
        )}

        {/* Vue historique */}
        {view === 'history' && !selectedAnalysis && (
          <>
            {history.length === 0
              ? <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
                  <p>Aucune analyse sauvegardée</p>
                  <p style={{ fontSize: '13px' }}>Faites votre première analyse !</p>
                </div>
              : history.map(a => (
                  <div key={a.id} onClick={() => setSelectedAnalysis(a)}
                    style={{ background: 'white', borderRadius: '16px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <img src={a.photoPreview} alt="" style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', color: getColor(a.etat), fontSize: '20px' }}>{a.score}/10</span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{a.date}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>{a.resume}</p>
                    </div>
                  </div>
                ))
            }
          </>
        )}

        {/* Detail historique */}
        {view === 'history' && selectedAnalysis && (
          <>
            <button onClick={() => setSelectedAnalysis(null)}
              style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '14px', marginBottom: '16px', padding: 0 }}>
              ← Retour à l'historique
            </button>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }}>Analyse du {selectedAnalysis.date}</p>
            <img src={selectedAnalysis.photoPreview} alt="" style={{ width: '100%', borderRadius: '12px', objectFit: 'cover', maxHeight: '200px', marginBottom: '16px' }} />
            <DiagnosticView r={selectedAnalysis.diagnostic} w={selectedAnalysis.weather} l={selectedAnalysis.location} />
          </>
        )}
      </div>
    </main>
  )
}
