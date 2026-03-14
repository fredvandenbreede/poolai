'use client'
import { useState, useRef } from 'react'

export default function Home() {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
      const formData = new FormData()
      formData.append('photo', photo)
      formData.append('userId', 'test-user')
      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur'); return }
      setResult(data.diagnostic)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  const getColor = (etat: string) => ({ excellent: '#22c55e', bon: '#84cc16', attention: '#f59e0b', urgent: '#ef4444' }[etat] || '#6b7280')

  return (
    <main style={{ minHeight: '100vh', background: '#f0f9ff', fontFamily: 'system-ui, sans-serif', paddingBottom: '40px' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #e0f2fe', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: '700', color: '#0c4a6e', fontSize: '18px' }}>🏊 Pool Water AI</span>
        <span style={{ background: '#fef9c3', color: '#854d0e', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>MODE TEST</span>
      </header>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px' }}>
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
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', color: '#dc2626', marginBottom: '16px' }}>{error}</div>}
        {result && (
          <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ background: getColor(result.etat), padding: '24px', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: '800' }}>{result.score_global}/10</div>
              <div style={{ fontSize: '20px', fontWeight: '600', marginTop: '4px', textTransform: 'capitalize' }}>{result.etat}</div>
              <div style={{ opacity: 0.9, marginTop: '8px' }}>{result.resume}</div>
            </div>
            <div style={{ padding: '20px' }}>
              <h3 style={{ color: '#0c4a6e', marginTop: 0 }}>Observations</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                {Object.entries(result.observations || {}).map(([key, val]) => (
                  <div key={key} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</div>
                    <div style={{ fontWeight: '600', color: '#0c4a6e', fontSize: '14px', marginTop: '2px' }}>
                      {typeof val === 'boolean' ? (val ? '⚠️ Oui' : '✅ Non') : String(val)}
                    </div>
                  </div>
                ))}
              </div>
              {result.plan_action?.length > 0 && (
                <>
                  <h3 style={{ color: '#0c4a6e' }}>Plan action</h3>
                  {result.plan_action.map((action: any, i: number) => (
                    <div key={i} style={{ border: `1.5px solid ${action.priorite === 1 ? '#fecaca' : action.priorite === 2 ? '#fed7aa' : '#d1fae5'}`, borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '600', color: '#0c4a6e', fontSize: '14px' }}>Priorite {action.priorite}</span>
                        <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '8px', color: '#64748b' }}>{action.delai}</span>
                      </div>
                      <p style={{ margin: 0, color: '#374151', fontSize: '15px' }}>{action.action}</p>
                      {action.produit_type && <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#0369a1' }}>🧪 {action.produit_type} — {action.dosage}</p>}
                    </div>
                  ))}
                </>
              )}
              {result.conseil_prevention && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px' }}>
                  <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>💡 <strong>Prevention :</strong> {result.conseil_prevention}</p>
                </div>
              )}
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '16px' }}>Prochaine analyse : {result.prochaine_analyse_dans}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
