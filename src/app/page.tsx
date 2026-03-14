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
  photoMeta?: any
  photoPreview: string
}

export default function Home() {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [weather, setWeather] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const [photoMeta, setPhotoMeta] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<SavedAnalysis[]>([])
  const [view, setView] = useState<'analyze' | 'history'>('analyze')
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pool_analyses')
      if (saved) setHistory(JSON.parse(saved))
    } catch {}
  }, [])

  function saveAnalysis(diagnostic: any, weatherData: any, locationData: any, metaData: any, preview: string) {
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
      photoMeta: metaData,
      photoPreview: preview
    }
    const updated = [newAnalysis, ...history].slice(0, 20)
    setHistory(updated)
    try { localStorage.setItem('pool_analyses', JSON.stringify(updated)) } catch {}
    return updated
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setResult(null)
    setError(null)
  }

  async function analyze() {
    if (!photo) return
    setLoading(true)
    setError(null)
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
      setPhotoMeta(data.photoMeta)
      saveAnalysis(data.diagnostic, data.weather, data.location, data.photoMeta, photoPreview!)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  const getColor = (etat: string) => ({
    excellent: '#22c55e', bon: '#84cc16', attention: '#f59e0b', urgent: '#ef4444'
  }[etat] || '#6b7280')

  const DiagnosticView = ({ r, w, l, m }: { r: any, w?: any, l?: any, m?: any }) => (
    <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

      {/* Score */}
      <div style={{ background: getColor(r.etat), padding: '24px', color: 'white', textAlign: 'center' }}>
        <div style={{ fontSize: '52px', fontWeight: '800', lineHeight: 1 }}>{r.score_global}/10</div>
        <div style={{ fontSize: '20px', fontWeight: '600', marginTop: '6px', textTransform: 'capitalize' }}>{r.etat}</div>
        <div style={{ opacity: 0.9, marginTop: '8px', fontSize: '15px' }}>{r.resume}</div>
        {r.evolution_vs_precedent && r.evolution_vs_precedent !== 'premiere analyse' && (
          <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', display: 'inline-block' }}>
            {r.evolution_vs_precedent === 'amelioration' ? '📈 En amélioration' : r.evolution_vs_precedent === 'degradation' ? '📉 En dégradation' : '➡️ Stable'} vs dernière analyse
          </div>
        )}
      </div>

      <div style={{ padding: '20px' }}>

        {/* Contexte météo + localisation + heure */}
        {(w || l || m) && (
          <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {l && <span style={{ fontSize: '13px', color: '#0369a1' }}>📍 {l.city}, {l.country}</span>}
              {m && <span style={{ fontSize: '13px', color: '#0369a1' }}>🕐 {m.heure} ({m.momentJournee})</span>}
              {m && <span style={{ fontSize: '13px', color: '#0369a1' }}>📅 {m.date}</span>}
              {w && <span style={{ fontSize: '13px', color: '#0369a1' }}>🌡️ Air {w.temp_air}°C</span>}
              {w && <span style={{ fontSize: '13px', color: '#0369a1' }}>💧 Eau ~{w.temp_water_estimated}°C</span>}
              {w && <span style={{ fontSize: '13px', color: '#0369a1' }}>☁️ {w.description}</span>}
              {m?.gpsSource && <span style={{ fontSize: '12px', color: '#94a3b8' }}>GPS: {m.gpsSource}</span>}
            </div>
          </div>
        )}

        {/* Impact contexte */}
        {r.impact_contexte && (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: '1.5' }}>
              🌤️ <strong>Impact contexte :</strong> {r.impact_contexte}
            </p>
          </div>
        )}

        {/* Observations */}
        <h3 style={{ color: '#0c4a6e', marginTop: 0, marginBottom: '12px' }}>Observations</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          {Object.entries(r.observations || {}).map(([key, val]) => (
            <div key={key} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {key.replace(/_/g, ' ')}
              </div>
              <div style={{ fontWeight: '600', color: '#0c4a6e', fontSize: '14px', marginTop: '4px' }}>
                {typeof val === 'boolean' ? (val ? '⚠️ Oui' : '✅ Non') : String(val)}
              </div>
            </div>
          ))}
        </div>

        {/* Problèmes */}
        {r.problemes_detectes?.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: '700', color: '#dc2626', fontSize: '14px' }}>⚠️ Problèmes détectés</p>
            {r.problemes_detectes.map((p: string, i: number) => (
              <p key={i} style={{ margin: '4px 0 0', color: '#7f1d1d', fontSize: '13px' }}>• {p}</p>
            ))}
          </div>
        )}

        {/* Plan d'action */}
        {r.plan_action?.length > 0 && (
          <>
            <h3 style={{ color: '#0c4a6e', marginBottom: '12px' }}>Plan d'action</h3>
            {r.plan_action.map((action: any, i: number) => (
              <div key={i} style={{
                border: `1.5px solid ${action.priorite === 1 ? '#fecaca' : action.priorite === 2 ? '#fed7aa' : '#d1fae5'}`,
                borderRadius: '14px', padding: '16px', marginBottom: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{
                    fontWeight: '700', fontSize: '12px', padding: '3px 10px', borderRadius: '20px',
                    background: action.priorite === 1 ? '#fee2e2' : action.priorite === 2 ? '#ffedd5' : '#d1fae5',
                    color: action.priorite === 1 ? '#dc2626' : action.priorite === 2 ? '#ea580c' : '#16a34a'
                  }}>
                    PRIORITÉ {action.priorite}
                  </span>
                  <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '3px 10px', borderRadius: '20px', color: '#64748b' }}>
                    {action.delai}
                  </span>
                </div>

                <p style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '15px', fontWeight: '600', lineHeight: '1.4' }}>
                  {action.action}
                </p>

                {action.explication && (
                  <p style={{ margin: '0 0 12px', color: '#475569', fontSize: '13px', lineHeight: '1.6' }}>
                    💡 {action.explication}
                  </p>
                )}

                <div style={{ background: '#f0f9ff', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '700', color: '#0369a1' }}>
                    🧪 {action.produit_recommande}
                  </p>
                  {action.marque_alternative && (
                    <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#64748b' }}>
                      Alternative : {action.marque_alternative}
                    </p>
                  )}
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#0c4a6e' }}>
                    📏 Dosage : {action.dosage}
                  </p>
                  {action.moment_application && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#0c4a6e' }}>
                      🕐 {action.moment_application}
                    </p>
                  )}
                </div>

                {action.precautions && (
                  <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', lineHeight: '1.5' }}>
                      ⚠️ {action.precautions}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Conseil prévention */}
        {r.conseil_prevention && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ margin: 0, color: '#15803d', fontSize: '14px', lineHeight: '1.6' }}>
              💡 <strong>Prévention :</strong> {r.conseil_prevention}
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '8px' }}>
          📅 Prochaine analyse recommandée : <strong>{r.prochaine_analyse_dans}</strong>
        </p>
      </div>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#f0f9ff', fontFamily: 'system-ui, sans-serif', paddingBottom: '80px' }}>

      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid #e0f2fe', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: '700', color: '#0c4a6e', fontSize: '18px' }}>🏊 Pool Water AI</span>
        <span style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>MODE TEST</span>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #e0f2fe' }}>
        {[
          { id: 'analyze', label: '🔬 Analyser' },
          { id: 'history', label: `📋 Historique (${history.length})` }
        ].map(tab => (
          <button key={tab.id} onClick={() => { setView(tab.id as any); setSelectedAnalysis(null) }}
            style={{
              padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: view === tab.id ? '700' : '400',
              color: view === tab.id ? '#0ea5e9' : '#64748b',
              borderBottom: view === tab.id ? '2px solid #0ea5e9' : '2px solid transparent',
              fontSize: '14px'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px' }}>

        {/* Vue analyser */}
        {view === 'analyze' && (
          <>
            <div onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${photoPreview ? '#0ea5e9' : '#93c5fd'}`,
                borderRadius: '16px',
                background: photoPreview ? 'transparent' : 'white',
                overflow: 'hidden', cursor: 'pointer', marginBottom: '16px',
                minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
              {photoPreview
                ? <img src={photoPreview} alt="Apercu" style={{ width: '100%', objectFit: 'cover', maxHeight: '320px' }} />
                : <div style={{ textAlign: 'center', padding: '32px', color: '#0369a1' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📸</div>
                    <p style={{ fontWeight: '600', margin: 0, fontSize: '16px' }}>Photographier ma piscine</p>
                    <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>Cliquez pour choisir une photo</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>GPS et heure lus automatiquement depuis la photo</p>
                  </div>
              }
            </div>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />

            {photoPreview && (
              <button onClick={() => { setPhoto(null); setPhotoPreview(null); setResult(null) }}
                style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#64748b', cursor: 'pointer', marginBottom: '10px', fontSize: '14px' }}>
                🔄 Changer la photo
              </button>
            )}

            <button onClick={analyze} disabled={!photo || loading}
              style={{
                width: '100%', padding: '16px',
                background: photo ? '#0ea5e9' : '#cbd5e1',
                color: 'white', border: 'none', borderRadius: '14px',
                fontSize: '17px', fontWeight: '700',
                cursor: photo ? 'pointer' : 'not-allowed', marginBottom: '12px',
                opacity: loading ? 0.8 : 1
              }}>
              {loading ? '⏳ Analyse en cours...' : '🔬 Analyser cette piscine'}
            </button>

            {history.length > 0 && !loading && !result && (
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                🧠 {history.length} analyse{history.length > 1 ? 's' : ''} dans l'historique — l'IA en tient compte
              </p>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', color: '#dc2626', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            {result && <DiagnosticView r={result} w={weather} l={location} m={photoMeta} />}
          </>
        )}

        {/* Vue historique — liste */}
        {view === 'history' && !selectedAnalysis && (
          <>
            {history.length === 0
              ? <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                  <p style={{ fontWeight: '600', fontSize: '16px' }}>Aucune analyse sauvegardée</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>Faites votre première analyse !</p>
                </div>
              : <>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                    {history.length} analyse{history.length > 1 ? 's' : ''} sauvegardée{history.length > 1 ? 's' : ''}
                  </p>
                  {history.map(a => (
                    <div key={a.id} onClick={() => setSelectedAnalysis(a)}
                      style={{
                        background: 'white', borderRadius: '16px', padding: '16px', marginBottom: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer',
                        display: 'flex', gap: '14px', alignItems: 'center',
                        border: '1px solid #f1f5f9'
                      }}>
                      <img src={a.photoPreview} alt="" style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '800', color: getColor(a.etat), fontSize: '22px' }}>{a.score}/10</span>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>{a.date}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.resume}
                        </p>
                        {a.location && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>📍 {a.location.city}</p>}
                      </div>
                      <span style={{ color: '#cbd5e1', fontSize: '18px' }}>›</span>
                    </div>
                  ))}
                </>
            }
          </>
        )}

        {/* Vue historique — détail */}
        {view === 'history' && selectedAnalysis && (
          <>
            <button onClick={() => setSelectedAnalysis(null)}
              style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '14px', marginBottom: '16px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              ← Retour à l'historique
            </button>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }}>
              Analyse du {selectedAnalysis.date}
            </p>
            <img src={selectedAnalysis.photoPreview} alt="" style={{ width: '100%', borderRadius: '14px', objectFit: 'cover', maxHeight: '220px', marginBottom: '16px' }} />
            <DiagnosticView
              r={selectedAnalysis.diagnostic}
              w={selectedAnalysis.weather}
              l={selectedAnalysis.location}
              m={selectedAnalysis.photoMeta}
            />
          </>
        )}

      </div>
    </main>
  )
}