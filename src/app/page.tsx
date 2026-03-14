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
  poolVolume: number
  photoCount: number
}

const PHOTO_INSTRUCTIONS = [
  { id: 1, label: 'Vue de loin', desc: 'Toute la piscine visible', emoji: '🏊', required: true },
  { id: 2, label: 'Vue de près', desc: 'Surface de l\'eau en gros plan', emoji: '🔍', required: true },
  { id: 3, label: 'Vue de côté', desc: 'Depuis le bord, angle latéral', emoji: '↔️', required: true },
]

export default function Home() {
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [poolVolume, setPoolVolume] = useState<number>(50)
  const [volumeSet, setVolumeSet] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [weather, setWeather] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const [photoMeta, setPhotoMeta] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<SavedAnalysis[]>([])
  const [view, setView] = useState<'analyze' | 'history'>('analyze')
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null)
  const [currentPhotoSlot, setCurrentPhotoSlot] = useState<number>(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pool_analyses')
      if (saved) setHistory(JSON.parse(saved))
      const vol = localStorage.getItem('pool_volume')
      if (vol) { setPoolVolume(parseInt(vol)); setVolumeSet(true) }
    } catch {}
  }, [])

  function saveVolume() {
    localStorage.setItem('pool_volume', poolVolume.toString())
    setVolumeSet(true)
  }

  async function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      img.onload = () => {
        const maxSize = 1200
        let { width, height } = img
        if (width > height && width > maxSize) { height = height * maxSize / width; width = maxSize }
        else if (height > maxSize) { width = width * maxSize / height; height = maxSize }
        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          else resolve(file)
        }, 'image/jpeg', 0.75)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    compressImage(file).then(compressed => {
      const preview = URL.createObjectURL(compressed)
      const newPhotos = [...photos]
      newPhotos[currentPhotoSlot] = { file: compressed, preview }
      setPhotos(newPhotos)
      setResult(null)
      setError(null)
    })
  }

  function triggerPhoto(slotIndex: number) {
    setCurrentPhotoSlot(slotIndex)
    setTimeout(() => fileRef.current?.click(), 50)
  }

  function removePhoto(index: number) {
    const newPhotos = [...photos]
    newPhotos.splice(index, 1)
    setPhotos(newPhotos)
    setResult(null)
  }

  function saveAnalysis(diagnostic: any, weatherData: any, locationData: any, metaData: any) {
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
      photoPreview: photos[0]?.preview || '',
      poolVolume,
      photoCount: photos.length
    }
    const updated = [newAnalysis, ...history].slice(0, 20)
    setHistory(updated)
    try { localStorage.setItem('pool_analyses', JSON.stringify(updated)) } catch {}
  }

  async function analyze() {
    if (photos.length < 1) return
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
      formData.append('poolVolume', poolVolume.toString())
      photos.forEach((p, i) => formData.append(`photo${i + 1}`, p.file))
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
      saveAnalysis(data.diagnostic, data.weather, data.location, data.photoMeta)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  const getColor = (etat: string) => ({
    excellent: '#22c55e', bon: '#84cc16', attention: '#f59e0b', urgent: '#ef4444'
  }[etat] || '#6b7280')

  const canAnalyze = photos.length >= 1 && !loading

  const DiagnosticView = ({ r, w, l, m }: { r: any, w?: any, l?: any, m?: any }) => (
    <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', marginTop: '20px' }}>

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

        {(w || l || m) && (
          <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {l && <span style={{ fontSize: '13px', color: '#0369a1' }}>📍 {l.city}, {l.country}</span>}
              {m && <span style={{ fontSize: '13px', color: '#0369a1' }}>🕐 {m.heure} ({m.momentJournee})</span>}
              {m && <span style={{ fontSize: '13px', color: '#0369a1' }}>📅 {m.date}</span>}
              {w && <span style={{ fontSize: '13px', color: '#0369a1' }}>🌡️ Air {w.temp_air}°C — Eau ~{w.temp_water_estimated}°C</span>}
              {w && <span style={{ fontSize: '13px', color: '#0369a1' }}>☁️ {w.description}</span>}
            </div>
          </div>
        )}

        {r.synthese_photos && (
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#5b21b6', lineHeight: '1.5' }}>
              📸 <strong>Synthèse multi-photos :</strong> {r.synthese_photos}
            </p>
          </div>
        )}

        {r.impact_contexte && (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: '1.5' }}>
              🌤️ <strong>Impact contexte :</strong> {r.impact_contexte}
            </p>
          </div>
        )}

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

        {r.problemes_detectes?.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: '700', color: '#dc2626', fontSize: '14px' }}>⚠️ Problèmes détectés</p>
            {r.problemes_detectes.map((p: string, i: number) => (
              <p key={i} style={{ margin: '4px 0 0', color: '#7f1d1d', fontSize: '13px' }}>• {p}</p>
            ))}
          </div>
        )}

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
                  }}>PRIORITÉ {action.priorite}</span>
                  <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '3px 10px', borderRadius: '20px', color: '#64748b' }}>{action.delai}</span>
                </div>

                <p style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '15px', fontWeight: '600', lineHeight: '1.4' }}>{action.action}</p>

                {action.explication && (
                  <p style={{ margin: '0 0 12px', color: '#475569', fontSize: '13px', lineHeight: '1.6' }}>💡 {action.explication}</p>
                )}

                <div style={{ background: '#f0f9ff', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: '700', color: '#0369a1' }}>🧪 {action.produit_recommande}</p>
                  {action.marque_alternative && (
                    <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#64748b' }}>Alternative : {action.marque_alternative}</p>
                  )}
                  {action.dosage_calcule && (
                    <div style={{ background: '#0ea5e9', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px' }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'white' }}>
                        📏 Dose pour votre piscine : {action.dosage_calcule}
                      </p>
                    </div>
                  )}
                  {action.dosage_standard && (
                    <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#64748b' }}>Dose standard 50m³ : {action.dosage_standard}</p>
                  )}
                  {action.moment_application && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#0c4a6e' }}>🕐 {action.moment_application}</p>
                  )}
                </div>

                {action.precautions && (
                  <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', lineHeight: '1.5' }}>⚠️ {action.precautions}</p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {r.conseil_prevention && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ margin: 0, color: '#15803d', fontSize: '14px', lineHeight: '1.6' }}>
              💡 <strong>Prévention :</strong> {r.conseil_prevention}
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '8px' }}>
          📅 Prochaine analyse : <strong>{r.prochaine_analyse_dans}</strong>
        </p>
      </div>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#f0f9ff', fontFamily: 'system-ui, sans-serif', paddingBottom: '80px' }}>

      <header style={{ background: 'white', borderBottom: '1px solid #e0f2fe', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: '700', color: '#0c4a6e', fontSize: '18px' }}>🏊 Pool Water AI</span>
        <span style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>MODE TEST</span>
      </header>

      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #e0f2fe' }}>
        {[{ id: 'analyze', label: '🔬 Analyser' }, { id: 'history', label: `📋 Historique (${history.length})` }].map(tab => (
          <button key={tab.id} onClick={() => { setView(tab.id as any); setSelectedAnalysis(null) }}
            style={{ padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: view === tab.id ? '700' : '400', color: view === tab.id ? '#0ea5e9' : '#64748b', borderBottom: view === tab.id ? '2px solid #0ea5e9' : '2px solid transparent', fontSize: '14px' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px' }}>

        {view === 'analyze' && (
          <>
            {/* Volume */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '16px' }}>💧 Volume de votre piscine</h3>
                {volumeSet && (
                  <button onClick={() => setVolumeSet(false)}
                    style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '13px', cursor: 'pointer' }}>
                    Modifier
                  </button>
                )}
              </div>

              {!volumeSet ? (
                <>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                    Indispensable pour calculer les doses exactes de produits chimiques.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    {[20, 30, 50, 75, 100, 150, 200, 300].map(v => (
                      <button key={v} onClick={() => setPoolVolume(v)}
                        style={{ padding: '10px 4px', border: `2px solid ${poolVolume === v ? '#0ea5e9' : '#e2e8f0'}`, borderRadius: '10px', background: poolVolume === v ? '#e0f2fe' : 'white', color: poolVolume === v ? '#0369a1' : '#374151', fontWeight: poolVolume === v ? '700' : '400', cursor: 'pointer', fontSize: '14px' }}>
                        {v}m³
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>Autre :</span>
                    <input type="number" value={poolVolume} onChange={e => setPoolVolume(parseInt(e.target.value) || 0)}
                      style={{ flex: 1, padding: '10px', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '16px', textAlign: 'center' }} min={5} max={1000} />
                    <span style={{ fontSize: '13px', color: '#64748b' }}>m³</span>
                  </div>
                  <button onClick={saveVolume}
                    style={{ width: '100%', padding: '12px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }}>
                    Confirmer — {poolVolume} m³
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#e0f2fe', borderRadius: '12px', padding: '12px 20px', textAlign: 'center' }}>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: '#0369a1' }}>{poolVolume}</span>
                    <span style={{ fontSize: '14px', color: '#0369a1', marginLeft: '4px' }}>m³</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
                    Dosages calculés précisément pour {poolVolume}m³
                  </p>
                </div>
              )}
            </div>

            {/* Photos */}
            {volumeSet && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '16px' }}>📸 Photos de la piscine</h3>
                    <span style={{ fontSize: '13px', color: photos.length >= 3 ? '#16a34a' : '#f59e0b', fontWeight: '600' }}>
                      {photos.length}/3 {photos.length >= 3 ? '✅' : '(3 recommandées)'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                    {PHOTO_INSTRUCTIONS.map((slot, index) => (
                      <div key={slot.id}>
                        {photos[index] ? (
                          <div style={{ position: 'relative' }}>
                            <img src={photos[index].preview} alt={slot.label} onClick={() => triggerPhoto(index)}
                              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', cursor: 'pointer', border: '2px solid #0ea5e9', display: 'block' }} />
                            <button onClick={() => removePhoto(index)}
                              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', color: 'white', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                              ×
                            </button>
                            <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '6px', padding: '2px 6px' }}>
                              <span style={{ color: 'white', fontSize: '10px' }}>{slot.label}</span>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => triggerPhoto(index)}
                            style={{ aspectRatio: '1', border: '2px dashed #93c5fd', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'white', padding: '8px', textAlign: 'center' }}>
                            <span style={{ fontSize: '24px', marginBottom: '4px' }}>{slot.emoji}</span>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#374151' }}>{slot.label}</span>
                            <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{slot.desc}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {photos.length < 3 && photos.length > 0 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                        💡 3 photos recommandées pour un diagnostic optimal. Vous pouvez analyser avec {photos.length} photo{photos.length > 1 ? 's' : ''}.
                      </p>
                    </div>
                  )}

                  {photos.length === 0 && (
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#0369a1' }}>
                        📸 Ajoutez au moins 1 photo. 3 vues différentes = diagnostic plus précis.
                      </p>
                    </div>
                  )}

                  {photos.length >= 3 && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
                        ✅ Parfait ! L'IA va croiser les 3 vues pour un diagnostic précis.
                      </p>
                    </div>
                  )}
                </div>

                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />

                <button onClick={analyze} disabled={!canAnalyze}
                  style={{ width: '100%', padding: '16px', background: canAnalyze ? '#0ea5e9' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '14px', fontSize: '17px', fontWeight: '700', cursor: canAnalyze ? 'pointer' : 'not-allowed', marginBottom: '12px', opacity: loading ? 0.8 : 1 }}>
                  {loading ? '⏳ Analyse en cours...' : photos.length >= 3 ? `🔬 Analyser (${photos.length} photos — ${poolVolume}m³)` : photos.length > 0 ? `🔬 Analyser avec ${photos.length} photo${photos.length > 1 ? 's' : ''}` : '📸 Ajoutez au moins 1 photo'}
                </button>

                {history.length > 0 && !loading && !result && (
                  <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                    🧠 {history.length} analyse{history.length > 1 ? 's' : ''} dans l'historique — l'IA en tient compte
                  </p>
                )}
              </>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', color: '#dc2626', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            {result && <DiagnosticView r={result} w={weather} l={location} m={photoMeta} />}
          </>
        )}

        {/* Historique liste */}
        {view === 'history' && !selectedAnalysis && (
          <>
            {history.length === 0
              ? <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                  <p style={{ fontWeight: '600', fontSize: '16px' }}>Aucune analyse sauvegardée</p>
                  <p style={{ fontSize: '14px' }}>Faites votre première analyse !</p>
                </div>
              : <>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                    {history.length} analyse{history.length > 1 ? 's' : ''} sauvegardée{history.length > 1 ? 's' : ''}
                  </p>
                  {history.map(a => (
                    <div key={a.id} onClick={() => setSelectedAnalysis(a)}
                      style={{ background: 'white', borderRadius: '16px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center', border: '1px solid #f1f5f9' }}>
                      {a.photoPreview && <img src={a.photoPreview} alt="" style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '800', color: getColor(a.etat), fontSize: '22px' }}>{a.score}/10</span>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>{a.date}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.resume}</p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          {a.location && <span style={{ fontSize: '12px', color: '#94a3b8' }}>📍 {a.location.city}</span>}
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>💧 {a.poolVolume}m³</span>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>📸 {a.photoCount} photo{a.photoCount > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <span style={{ color: '#cbd5e1', fontSize: '18px' }}>›</span>
                    </div>
                  ))}
                </>
            }
          </>
        )}

        {/* Historique détail */}
        {view === 'history' && selectedAnalysis && (
          <>
            <button onClick={() => setSelectedAnalysis(null)}
              style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '14px', marginBottom: '16px', padding: 0 }}>
              ← Retour
            </button>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }}>
              Analyse du {selectedAnalysis.date} — {selectedAnalysis.poolVolume}m³ — {selectedAnalysis.photoCount} photo{selectedAnalysis.photoCount > 1 ? 's' : ''}
            </p>
            {selectedAnalysis.photoPreview && (
              <img src={selectedAnalysis.photoPreview} alt="" style={{ width: '100%', borderRadius: '14px', objectFit: 'cover', maxHeight: '200px', marginBottom: '16px' }} />
            )}
            <DiagnosticView r={selectedAnalysis.diagnostic} w={selectedAnalysis.weather} l={selectedAnalysis.location} m={selectedAnalysis.photoMeta} />
          </>
        )}

      </div>
    </main>
  )
}