'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/src/lib/supabase'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [credits, setCredits] = useState(0)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setUser(data.user); fetchCredits(data.user.id) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); fetchCredits(session.user.id) }
      else { setUser(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchCredits(userId: string) {
    const { data } = await supabase.from('profiles').select('credits').eq('id', userId).single()
    setCredits(data?.credits ?? 0)
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    })
    if (error) alert(error.message)
    else alert('✅ Vérifiez votre email !')
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setResult(null)
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setResult(null); setError(null)
  }

  async function analyze() {
    if (!photo || !user) return
    setLoading(true); setError(null)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      ).catch(() => null)
      const formData = new FormData()
      formData.append('photo', photo)
      formData.append('userId', user.id)
      if (pos) {
        formData.append('lat', pos.coords.latitude.toString())
        formData.append('lng', pos.coords.longitude.toString())
      }
      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(res.status === 402 ? 'Plus de crédits — rechargez votre compte' : data.error || 'Erreur'); return }
      setResult(data.diagnostic)
      setCredits(data.remainingCredits)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  async function buyCredits(packId: string) {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId, userId: user.id, userEmail: user.email })
    })
    const { url } = await res.json()
    window.location.href = url
  }

  const getColor = (etat: string) => ({ excellent: '#22c55e', bon: '#84cc16', attention: '#f59e0b', urgent: '#ef4444' }[etat] || '#6b7280')

  if (!user) return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#f0f9ff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🏊</div>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0c4a6e', margin: 0 }}>Pool Water AI</h1>
        <p style={{ color: '#0369a1', marginTop: '8px' }}>Diagnostic IA de votre eau de piscine</p>
      </div>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <p style={{ color: '#374151', marginBottom: '16px', fontWeight: '500' }}>Connexion par lien magique</p>
        <input type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '12px', border: '1.5px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '12px' }} />
        <button onClick={signIn}
          style={{ width: '100%', padding: '14px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
          Recevoir le lien →
        </button>
        <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', marginTop: '16px' }}>1 analyse offerte à l'inscription</p>
      </div>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#f0f9ff', fontFamily: 'system-ui, sans-serif', paddingBottom: '40px' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #e0f2fe', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: '700', color: '#0c4a6e', fontSize: '18px' }}>🏊 Pool Water AI</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: '600' }}>
            {credits} crédit{credits !== 1 ? 's' : ''}
          </span>
          <button onClick={signOut} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>Déconnexion</button>
        </div>
      </header>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px' }}>
        <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${photoPreview ? '#0ea5e9' : '#93c5fd'}`, borderRadius: '16px', background: photoPreview ? 'transparent' : 'white', overflow: 'hidden', cursor: 'pointer', marginBottom: '16px', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photoPreview
            ? <img src={photoPreview} alt="Aperçu" style={{ width: '100%', objectFit: 'cover', maxHeight: '320px' }} />
            : <div style={{ textAlign: 'center', padding: '32px', color: '#0369a1' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📸</div>
                <p style={{ fontWeight: '600', margin: 0 }}>Photographier ma piscine</p>
                <p style={{ fontSize: '14px', color: '#64748b', marginTop: '6px' }}>Depuis le bord du bassin</p>
              </div>
          }
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />

        <button onClick={analyze} disabled={!photo || loading || credits < 1}
          style={{ width: '100%', padding: '16px', background: photo && credits > 0 ? '#0ea5e9' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '14px', fontSize: '17px', fontWeight: '700', cursor: photo && credits > 0 ? 'pointer' : 'not-allowed', marginBottom: '12px' }}>
          {loading ? '⏳ Analyse en cours...' : `🔬 Analyser — 1 crédit (${credits} restant${credits !== 1 ? 's' : ''})`}
        </button>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', color: '#dc2626', marginBottom: '16px' }}>{error}</div>}

        {credits < 2 && user && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <p style={{ fontWeight: '600', color: '#0c4a6e', marginTop: 0 }}>Recharger des crédits</p>
            {[{ id: 'single', label: '1 analyse', price: '5€' }, { id: 'pack5', label: '5 analyses', price: '20€', badge: '-20%' }, { id: 'pack10', label: '10 analyses', price: '35€', badge: '-30%' }].map(pack => (
              <button key={pack.id} onClick={() => buyCredits(pack.id)}
                style={{ width: '100%', padding: '14px', border: '1.5px solid #e0f2fe', borderRadius: '12px', background: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '15px' }}>
                <span style={{ fontWeight: '600', color: '#0c4a6e' }}>{pack.label}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {pack.badge && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>{pack.badge}</span>}
                  <span style={{ fontWeight: '700', color: '#0ea5e9' }}>{pack.price}</span>
                </div>
              </button>
            ))}
          </div>
        )}

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
                  <h3 style={{ color: '#0c4a6e' }}>Plan d'action</h3>
                  {result.plan_action.map((action: any, i: number) => (
                    <div key={i} style={{ border: `1.5px solid ${action.priorite === 1 ? '#fecaca' : action.priorite === 2 ? '#fed7aa' : '#d1fae5'}`, borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '600', color: '#0c4a6e', fontSize: '14px' }}>Priorité {action.priorite}</span>
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
                  <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>💡 <strong>Prévention :</strong> {result.conseil_prevention}</p>
                </div>
              )}
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '16px' }}>Prochaine analyse recommandée : {result.prochaine_analyse_dans}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}