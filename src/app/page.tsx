'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/src/lib/supabase'

interface User {
  id: string
  email: string
}

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

interface FollowUp {
  actionIndex: number
  actionLabel: string
  photo?: { file: File; preview: string }
  result?: any
  date: string
  status: 'pending' | 'done' | 'analyzing'
}

const PHOTO_INSTRUCTIONS = [
  { id: 1, label: 'Vue de loin', desc: 'Toute la piscine visible', emoji: '🏊' },
  { id: 2, label: 'Vue de près', desc: 'Surface eau en gros plan', emoji: '🔍' },
  { id: 3, label: 'Vue de côté', desc: 'Depuis le bord, angle latéral', emoji: '↔️' },
]

const LOADING_STEPS = [
  { pct: 5,  label: 'Envoi des photos...' },
  { pct: 15, label: 'Lecture des métadonnées EXIF...' },
  { pct: 25, label: 'Récupération de la météo...' },
  { pct: 35, label: 'Géolocalisation...' },
  { pct: 45, label: "Analyse visuelle de l'eau..." },
  { pct: 55, label: 'Détection des problèmes...' },
  { pct: 65, label: 'Croisement avec votre historique...' },
  { pct: 75, label: 'Calcul des dosages pour votre piscine...' },
  { pct: 85, label: 'Recommandations produits...' },
  { pct: 92, label: 'Finalisation du diagnostic...' },
  { pct: 98, label: 'Presque prêt...' },
]

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [credits, setCredits] = useState(0)
  const [authView, setAuthView] = useState<'login' | 'app'>('login')
  const [email, setEmail] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authSent, setAuthSent] = useState(false)
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [poolVolume, setPoolVolume] = useState<number>(50)
  const [volumeSet, setVolumeSet] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingPct, setLoadingPct] = useState(0)
  const [loadingLabel, setLoadingLabel] = useState('')
  const [result, setResult] = useState<any>(null)
  const [weather, setWeather] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const [photoMeta, setPhotoMeta] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<SavedAnalysis[]>([])
  const [dbHistory, setDbHistory] = useState<any[]>([])
  const [view, setView] = useState<'analyze' | 'history' | 'account'>('analyze')
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null)
  const [currentPhotoSlot, setCurrentPhotoSlot] = useState<number>(0)
  const [openSections, setOpenSections] = useState<string[]>(['score', 'action_0'])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [followUpSlot, setFollowUpSlot] = useState<number | null>(null)
  const [followUpPhoto, setFollowUpPhoto] = useState<{ file: File; preview: string } | null>(null)
  const [showBuyCredits, setShowBuyCredits] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const followUpRef = useRef<HTMLInputElement>(null)
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! })
        setAuthView('app')
        fetchCredits(session.user.id)
        fetchDbHistory(session.user.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email! })
        setAuthView('app')
        fetchCredits(session.user.id)
        fetchDbHistory(session.user.id)
      } else {
        setUser(null)
        setAuthView('login')
      }
    })

    try {
      const saved = localStorage.getItem('pool_analyses')
      if (saved) setHistory(JSON.parse(saved))
      const vol = localStorage.getItem('pool_volume')
      if (vol) { setPoolVolume(parseInt(vol)); setVolumeSet(true) }
    } catch {}

    const url = new URL(window.location.href)
    if (url.searchParams.get('success') === 'true') {
      setTimeout(() => {
        if (user) fetchCredits(user.id)
        window.history.replaceState({}, '', '/')
      }, 2000)
    }

    return () => subscription.unsubscribe()
  }, [])

  async function fetchCredits(userId: string) {
    const res = await fetch(`/api/auth/credits?userId=${userId}`)
    const data = await res.json()
    setCredits(data.credits || 0)
  }

  async function fetchDbHistory(userId: string) {
    const { data } = await supabase
      .from('analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setDbHistory(data)
  }

  async function signIn() {
    setAuthLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` }
    })
    if (error) alert(error.message)
    else setAuthSent(true)
    setAuthLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setAuthView('login')
    setResult(null)
    setCredits(0)
  }

  function startLoadingAnimation() {
    setLoadingPct(0)
    setLoadingLabel(LOADING_STEPS[0].label)
    let stepIndex = 0
    const tick = () => {
      stepIndex++
      if (stepIndex < LOADING_STEPS.length) {
        setLoadingPct(LOADING_STEPS[stepIndex].pct)
        setLoadingLabel(LOADING_STEPS[stepIndex].label)
        const delay = stepIndex < 4 ? 600 : stepIndex < 7 ? 1200 : 1800
        loadingTimerRef.current = setTimeout(tick, delay)
      }
    }
    loadingTimerRef.current = setTimeout(tick, 600)
  }

  function stopLoadingAnimation() {
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current)
    setLoadingPct(100)
    setLoadingLabel('Diagnostic prêt !')
  }

  function toggleSection(id: string) {
    setOpenSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

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
        canvas.width = width; canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => {
          resolve(blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file)
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
      setResult(null); setError(null); setFollowUps([])
    })
  }

  function handleFollowUpPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    compressImage(file).then(compressed => {
      setFollowUpPhoto({ file: compressed, preview: URL.createObjectURL(compressed) })
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
    setResult(null); setFollowUps([])
  }

  function saveLocalAnalysis(diagnostic: any, weatherData: any, locationData: any, metaData: any) {
    const newAnalysis: SavedAnalysis = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      score: diagnostic.score_global,
      etat: diagnostic.etat,
      resume: diagnostic.resume,
      problemes: diagnostic.problemes_detectes || [],
      diagnostic, weather: weatherData, location: locationData, photoMeta: metaData,
      photoPreview: photos[0]?.preview || '',
      poolVolume, photoCount: photos.length
    }
    const updated = [newAnalysis, ...history].slice(0, 20)
    setHistory(updated)
    try { localStorage.setItem('pool_analyses', JSON.stringify(updated)) } catch {}
  }

  async function analyze() {
    if (photos.length < 1) return
    if (user && credits < 1) { setShowBuyCredits(true); return }
    setLoading(true); setError(null); setFollowUps([])
    startLoadingAnimation()
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      ).catch(() => null)

      const sessionId = `${user?.id || 'anon'}_${Date.now()}`
      const formData = new FormData()
      formData.append('poolVolume', poolVolume.toString())
      formData.append('sessionId', sessionId)
      if (user) formData.append('userId', user.id)
      photos.forEach((p, i) => formData.append(`photo${i + 1}`, p.file))
      if (pos) {
        formData.append('lat', pos.coords.latitude.toString())
        formData.append('lng', pos.coords.longitude.toString())
      }
      const historyForPrompt = (user ? dbHistory : history).slice(0, 5).map((a: any) => ({
        date: a.date || a.created_at,
        score: a.score || a.diagnostic?.score_global,
        etat: a.etat || a.diagnostic?.etat,
        resume: a.resume || a.diagnostic?.resume,
        problemes: a.problemes || a.diagnostic?.problemes_detectes || []
      }))
      formData.append('history', JSON.stringify(historyForPrompt))

      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()

      stopLoadingAnimation()
      await new Promise(r => setTimeout(r, 800))

      if (!res.ok) {
        if (data.code === 'NO_CREDITS') setShowBuyCredits(true)
        else setError(data.error || 'Erreur')
        setLoading(false)
        return
      }

      setResult(data.diagnostic)
      setWeather(data.weather)
      setLocation(data.location)
      setPhotoMeta(data.photoMeta)
      setOpenSections(['score', 'context', 'action_0'])

      if (user) {
        fetchCredits(user.id)
        fetchDbHistory(user.id)
      } else {
        saveLocalAnalysis(data.diagnostic, data.weather, data.location, data.photoMeta)
      }
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }

  async function analyzeFollowUp(actionIndex: number) {
    if (!followUpPhoto) return
    const action = result.plan_action[actionIndex]
    setFollowUps(prev => prev.map((f, i) => i === actionIndex ? { ...f, status: 'analyzing' } : f))
    try {
      const formData = new FormData()
      formData.append('poolVolume', poolVolume.toString())
      formData.append('photo1', followUpPhoto.file)
      if (user) formData.append('userId', user.id)
      formData.append('history', JSON.stringify([{
        date: new Date().toLocaleDateString('fr-FR'),
        score: result.score_global, etat: result.etat,
        resume: result.resume, problemes: result.problemes_detectes || []
      }]))
      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) return
      setFollowUps(prev => prev.map((f, i) => i === actionIndex
        ? { ...f, status: 'done', photo: followUpPhoto, result: data.diagnostic } : f
      ))
      setFollowUpPhoto(null); setFollowUpSlot(null)
      if (user) { fetchCredits(user.id); fetchDbHistory(user.id) }
    } catch {
      setFollowUps(prev => prev.map((f, i) => i === actionIndex ? { ...f, status: 'pending' } : f))
    }
  }

  function markActionDone(actionIndex: number) {
    setFollowUps(prev => {
      if (prev.find(f => f.actionIndex === actionIndex)) return prev
      return [...prev, { actionIndex, actionLabel: result.plan_action[actionIndex].action, date: new Date().toISOString(), status: 'pending' }]
    })
    setFollowUpSlot(actionIndex)
  }

  async function buyCredits(packId: string) {
    if (!user) return
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId, userId: user.id, userEmail: user.email })
    })
    const { url } = await res.json()
    window.location.href = url
  }

  const getColor = (etat: string) => ({ excellent: '#22c55e', bon: '#84cc16', attention: '#f59e0b', urgent: '#ef4444' }[etat] || '#6b7280')
  const getScoreEmoji = (score: number) => score >= 8 ? '😊' : score >= 6 ? '😐' : score >= 4 ? '😟' : '😰'

  const Accordion = ({ id, title, emoji, badge, badgeColor, children }: any) => {
    const isOpen = openSections.includes(id)
    return (
      <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <button onClick={() => toggleSection(id)}
          style={{ width: '100%', padding: '16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>{emoji}</span>
            <span style={{ fontWeight: '700', color: '#0c4a6e', fontSize: '15px' }}>{title}</span>
            {badge && <span style={{ background: badgeColor || '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{badge}</span>}
          </div>
          <span style={{ color: '#94a3b8', fontSize: '18px', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
        </button>
        {isOpen && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
      </div>
    )
  }

  const ActionCard = ({ action, index }: { action: any, index: number }) => {
    const followUp = followUps.find(f => f.actionIndex === index)
    return (
      <Accordion id={`action_${index}`}
        emoji={action.priorite === 1 ? '🔴' : action.priorite === 2 ? '🟠' : '🟢'}
        title={action.action}
        badge={followUp?.status === 'done' ? '✅ Fait' : action.delai}
        badgeColor={followUp?.status === 'done' ? '#d1fae5' : '#f1f5f9'}>
        {action.explication && (
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>💡 {action.explication}</p>
          </div>
        )}
        <div style={{ background: '#f0f9ff', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '700', color: '#0369a1' }}>🧪 {action.produit_recommande}</p>
          {action.marque_alternative && <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#64748b' }}>Alternative : {action.marque_alternative}</p>}
          {action.dosage_calcule && (
            <div style={{ background: '#0ea5e9', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'white' }}>📏 {action.dosage_calcule}</p>
              {action.dosage_standard && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>Standard 50m³ : {action.dosage_standard}</p>}
            </div>
          )}
          {action.moment_application && <p style={{ margin: 0, fontSize: '13px', color: '#0c4a6e' }}>🕐 {action.moment_application}</p>}
        </div>
        {action.precautions && (
          <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', lineHeight: '1.5' }}>⚠️ {action.precautions}</p>
          </div>
        )}
        {!followUp && (
          <button onClick={() => markActionDone(index)}
            style={{ width: '100%', padding: '12px', background: '#0c4a6e', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
            ✅ Traitement effectué → Vérifier l'amélioration
          </button>
        )}
        {followUp?.status === 'pending' && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#15803d', fontWeight: '600' }}>✅ Laissez la pompe tourner 2h puis prenez une photo.</p>
            </div>
            {!followUpPhoto || followUpSlot !== index ? (
              <button onClick={() => { setFollowUpSlot(index); setTimeout(() => followUpRef.current?.click(), 50) }}
                style={{ width: '100%', padding: '14px', background: 'white', border: '2px dashed #0ea5e9', borderRadius: '12px', color: '#0ea5e9', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                📸 Prendre une photo de vérification
              </button>
            ) : (
              <div>
                <img src={followUpPhoto.preview} alt="" style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '180px', marginBottom: '10px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setFollowUpPhoto(null)}
                    style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#64748b', cursor: 'pointer' }}>
                    🔄 Changer
                  </button>
                  <button onClick={() => analyzeFollowUp(index)}
                    style={{ flex: 2, padding: '12px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>
                    🔬 Analyser l'amélioration
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {followUp?.status === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#0369a1' }}>
            <p style={{ margin: 0, fontWeight: '600' }}>⏳ Analyse en cours...</p>
          </div>
        )}
        {followUp?.status === 'done' && followUp.result && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ height: '1px', background: '#e2e8f0', marginBottom: '14px' }} />
            {followUp.photo && <img src={followUp.photo.preview} alt="" style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '160px', marginBottom: '12px' }} />}
            <div style={{ background: getColor(followUp.result.etat), borderRadius: '12px', padding: '16px', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: '800' }}>{followUp.result.score_global}/10</div>
              <div style={{ fontSize: '16px', fontWeight: '600', textTransform: 'capitalize' }}>{followUp.result.etat}</div>
              <div style={{ opacity: 0.9, fontSize: '14px', marginTop: '4px' }}>{followUp.result.resume}</div>
            </div>
          </div>
        )}
      </Accordion>
    )
  }

  const DiagnosticView = ({ r, w, l, m }: { r: any, w?: any, l?: any, m?: any }) => (
    <div style={{ marginTop: '16px' }}>
      <Accordion id="score" emoji={getScoreEmoji(r.score_global)} title="Score & état général" badge={`${r.score_global}/10`} badgeColor={getColor(r.etat)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
          <div style={{ background: getColor(r.etat), borderRadius: '14px', padding: '14px 20px', textAlign: 'center', minWidth: '80px' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: 'white', lineHeight: 1 }}>{r.score_global}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>sur 10</div>
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#0c4a6e', fontSize: '16px', textTransform: 'capitalize' }}>{r.etat}</p>
            <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>{r.resume}</p>
            {r.evolution_vs_precedent && r.evolution_vs_precedent !== 'premiere analyse' && (
              <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: '600', color: r.evolution_vs_precedent === 'amelioration' ? '#16a34a' : r.evolution_vs_precedent === 'degradation' ? '#dc2626' : '#64748b' }}>
                {r.evolution_vs_precedent === 'amelioration' ? '📈 En amélioration' : r.evolution_vs_precedent === 'degradation' ? '📉 En dégradation' : '➡️ Stable'}
              </p>
            )}
          </div>
        </div>
        <div style={{ background: '#f1f5f9', borderRadius: '20px', height: '10px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${r.score_global * 10}%`, background: getColor(r.etat), borderRadius: '20px' }} />
        </div>
      </Accordion>

      {(w || l || m) && (
        <Accordion id="context" emoji="🌤️" title="Contexte & météo">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {l && <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}><span>📍 {l.city}, {l.country}</span></div>}
            {m && <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}><span>🕐 Photo le {m.date} à {m.heure} ({m.momentJournee})</span></div>}
            {w && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#92400e' }}>{w.temp_air}°C</div>
                  <div style={{ fontSize: '11px', color: '#92400e' }}>Air</div>
                </div>
                <div style={{ padding: '10px', background: '#e0f2fe', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#0369a1' }}>{w.temp_water_estimated}°C</div>
                  <div style={{ fontSize: '11px', color: '#0369a1' }}>Eau ~</div>
                </div>
              </div>
            )}
            {r.impact_contexte && <div style={{ padding: '10px 12px', background: '#fefce8', borderRadius: '8px' }}><p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>💡 {r.impact_contexte}</p></div>}
          </div>
        </Accordion>
      )}

      <Accordion id="observations" emoji="👁️" title="Observations visuelles">
        {r.synthese_photos && <div style={{ background: '#f5f3ff', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}><p style={{ margin: 0, fontSize: '13px', color: '#5b21b6' }}>📸 {r.synthese_photos}</p></div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {Object.entries(r.observations || {}).map(([key, val]) => (
            <div key={key} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>{key.replace(/_/g, ' ')}</div>
              <div style={{ fontWeight: '600', color: '#0c4a6e', fontSize: '14px', marginTop: '4px' }}>
                {typeof val === 'boolean' ? (val ? '⚠️ Oui' : '✅ Non') : String(val)}
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      {r.problemes_detectes?.length > 0 && (
        <Accordion id="problems" emoji="⚠️" title="Problèmes détectés" badge={r.problemes_detectes.length.toString()} badgeColor="#fee2e2">
          {r.problemes_detectes.map((p: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px', background: '#fef2f2', borderRadius: '8px', marginBottom: '6px' }}>
              <span style={{ color: '#dc2626' }}>•</span>
              <span style={{ fontSize: '13px', color: '#7f1d1d' }}>{p}</span>
            </div>
          ))}
        </Accordion>
      )}

      {r.plan_action?.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '20px 0 12px' }}>
            <span>🎯</span>
            <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '16px' }}>Plan d'action ({r.plan_action.length} étape{r.plan_action.length > 1 ? 's' : ''})</h3>
          </div>
          {r.plan_action.map((action: any, i: number) => <ActionCard key={i} action={action} index={i} />)}
        </div>
      )}

      <Accordion id="prevention" emoji="🛡️" title="Conseils de prévention">
        <p style={{ margin: 0, color: '#374151', fontSize: '14px', lineHeight: '1.7' }}>{r.conseil_prevention}</p>
      </Accordion>

      <div style={{ background: 'white', borderRadius: '14px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginTop: '10px' }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>📅 Prochaine analyse dans</p>
        <p style={{ margin: '4px 0 12px', fontWeight: '800', color: '#0c4a6e', fontSize: '18px' }}>{r.prochaine_analyse_dans}</p>
        <button onClick={() => { setPhotos([]); setResult(null); setFollowUps([]); window.scrollTo(0, 0) }}
          style={{ padding: '10px 20px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', color: '#0369a1', fontWeight: '600', cursor: 'pointer' }}>
          📸 Nouvelle analyse
        </button>
      </div>
    </div>
  )

  // ECRAN LOGIN
  if (authView === 'login') return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '64px', marginBottom: '12px' }}>🏊</div>
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'white', margin: '0 0 8px' }}>Pool Water AI</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', margin: 0 }}>Diagnostic IA de votre eau de piscine</p>
        </div>

        <div style={{ background: 'white', borderRadius: '20px', padding: '32px' }}>
          {!authSent ? (
            <>
              <h2 style={{ margin: '0 0 6px', color: '#0c4a6e', fontSize: '20px', fontWeight: '700' }}>Connexion</h2>
              <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px' }}>Recevez un lien magique par email</p>
              <input type="email" placeholder="votre@email.com" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && signIn()}
                style={{ width: '100%', padding: '14px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '12px', outline: 'none' }} />
              <button onClick={signIn} disabled={authLoading || !email}
                style={{ width: '100%', padding: '14px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginBottom: '16px' }}>
                {authLoading ? '...' : 'Recevoir le lien →'}
              </button>
              <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>🎁 1 analyse offerte à l'inscription</p>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
              <h3 style={{ color: '#0c4a6e', margin: '0 0 8px' }}>Vérifiez votre email !</h3>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>
                Un lien de connexion a été envoyé à <strong>{email}</strong>
              </p>
              <button onClick={() => setAuthSent(false)}
                style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '14px' }}>
                ← Changer d'email
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '24px' }}>
          {[
            { emoji: '📸', label: '3 photos', sub: 'analyse précise' },
            { emoji: '🌤️', label: 'Météo GPS', sub: 'contexte réel' },
            { emoji: '🧪', label: 'Dosages', sub: 'pour votre bassin' }
          ].map(f => (
            <div key={f.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>{f.emoji}</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>{f.label}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>{f.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )

  // APP PRINCIPALE
  return (
    <main style={{ minHeight: '100vh', background: '#f0f9ff', fontFamily: 'system-ui, sans-serif', paddingBottom: '80px' }}>

      {/* LOADING OVERLAY */}
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(12, 74, 110, 0.97)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 30px' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🏊</div>
          <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '800', margin: '0 0 8px', textAlign: 'center' }}>Analyse en cours...</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: '0 0 40px', textAlign: 'center' }}>Ne fermez pas cette page</p>
          <div style={{ fontSize: '56px', fontWeight: '800', color: 'white', lineHeight: 1, marginBottom: '8px' }}>{loadingPct}%</div>
          <div style={{ width: '100%', maxWidth: '320px', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ height: '100%', width: `${loadingPct}%`, background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)', borderRadius: '20px', transition: 'width 0.6s ease' }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', fontWeight: '500', textAlign: 'center', minHeight: '24px' }}>{loadingLabel}</p>
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '32px' }}>
              {photos.map((p, i) => (
                <img key={i} src={p.preview} alt="" style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover', opacity: 0.7, border: '2px solid rgba(255,255,255,0.3)' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL ACHAT CREDITS */}
      {showBuyCredits && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '18px', fontWeight: '800' }}>💳 Recharger des crédits</h3>
              <button onClick={() => setShowBuyCredits(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
              Vous avez <strong style={{ color: '#dc2626' }}>{credits} crédit{credits !== 1 ? 's' : ''}</strong> restant{credits !== 1 ? 's' : ''}. Chaque analyse utilise 1 crédit.
            </p>
            {[
              { id: 'single', label: '1 analyse', price: '5€', per: '5€/analyse' },
              { id: 'pack5', label: '5 analyses', price: '20€', per: '4€/analyse', badge: '-20%' },
              { id: 'pack10', label: '10 analyses', price: '35€', per: '3,50€/analyse', badge: '-30%' }
            ].map(pack => (
              <button key={pack.id} onClick={() => buyCredits(pack.id)}
                style={{ width: '100%', padding: '14px', border: '2px solid #e0f2fe', borderRadius: '12px', background: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: '700', color: '#0c4a6e', fontSize: '15px' }}>{pack.label}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{pack.per}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {pack.badge && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' }}>{pack.badge}</span>}
                  <span style={{ fontWeight: '800', color: '#0ea5e9', fontSize: '16px' }}>{pack.price}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* HEADER */}
      <header style={{ background: 'white', borderBottom: '1px solid #e0f2fe', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: '800', color: '#0c4a6e', fontSize: '18px' }}>🏊 Pool Water AI</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setShowBuyCredits(true)}
            style={{ background: credits > 0 ? '#e0f2fe' : '#fee2e2', color: credits > 0 ? '#0369a1' : '#dc2626', padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
            {credits} crédit{credits !== 1 ? 's' : ''}
          </button>
        </div>
      </header>

      {/* TABS */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #e0f2fe' }}>
        {[
          { id: 'analyze', label: '🔬 Analyser' },
          { id: 'history', label: `📋 Historique (${user ? dbHistory.length : history.length})` },
          { id: 'account', label: '👤 Compte' }
        ].map(tab => (
          <button key={tab.id} onClick={() => { setView(tab.id as any); setSelectedAnalysis(null) }}
            style={{ flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: view === tab.id ? '700' : '400', color: view === tab.id ? '#0ea5e9' : '#64748b', borderBottom: view === tab.id ? '2px solid #0ea5e9' : '2px solid transparent', fontSize: '13px' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
      <input ref={followUpRef} type="file" accept="image/*" capture="environment" onChange={handleFollowUpPhoto} style={{ display: 'none' }} />

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px' }}>

        {/* VUE ANALYSER */}
        {view === 'analyze' && (
          <>
            {!result && (
              <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '16px' }}>💧 Volume de votre piscine</h3>
                  {volumeSet && <button onClick={() => setVolumeSet(false)} style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '13px', cursor: 'pointer' }}>Modifier</button>}
                </div>
                {!volumeSet ? (
                  <>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>Indispensable pour calculer les doses exactes.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                      {[20, 30, 50, 75, 100, 150, 200, 300].map(v => (
                        <button key={v} onClick={() => setPoolVolume(v)}
                          style={{ padding: '10px 4px', border: `2px solid ${poolVolume === v ? '#0ea5e9' : '#e2e8f0'}`, borderRadius: '10px', background: poolVolume === v ? '#e0f2fe' : 'white', color: poolVolume === v ? '#0369a1' : '#374151', fontWeight: poolVolume === v ? '700' : '400', cursor: 'pointer', fontSize: '14px' }}>
                          {v}m³
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>Autre :</span>
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
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Dosages calculés pour {poolVolume}m³</p>
                  </div>
                )}
              </div>
            )}

            {volumeSet && !result && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '16px' }}>📸 Photos de la piscine</h3>
                    <span style={{ fontSize: '13px', color: photos.length >= 3 ? '#16a34a' : '#f59e0b', fontWeight: '600' }}>{photos.length}/3 {photos.length >= 3 ? '✅' : ''}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                    {PHOTO_INSTRUCTIONS.map((slot, index) => (
                      <div key={slot.id}>
                        {photos[index] ? (
                          <div style={{ position: 'relative' }}>
                            <img src={photos[index].preview} alt={slot.label} onClick={() => triggerPhoto(index)}
                              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', cursor: 'pointer', border: '2px solid #0ea5e9', display: 'block' }} />
                            <button onClick={() => removePhoto(index)}
                              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', color: 'white', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
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
                  {photos.length >= 3 && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>✅ Parfait ! L'IA va croiser les 3 vues.</p>
                    </div>
                  )}
                </div>

                <button onClick={analyze} disabled={photos.length < 1}
                  style={{ width: '100%', padding: '16px', background: photos.length >= 1 ? '#0ea5e9' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '14px', fontSize: '17px', fontWeight: '700', cursor: photos.length >= 1 ? 'pointer' : 'not-allowed', marginBottom: '12px' }}>
                  {photos.length >= 3 ? `🔬 Analyser (${photos.length} photos — ${poolVolume}m³)` : photos.length > 0 ? `🔬 Analyser avec ${photos.length} photo${photos.length > 1 ? 's' : ''}` : '📸 Ajoutez au moins 1 photo'}
                </button>

                {user && credits < 2 && (
                  <button onClick={() => setShowBuyCredits(true)}
                    style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #fde68a', borderRadius: '12px', color: '#92400e', fontSize: '14px', cursor: 'pointer', fontWeight: '600' }}>
                    💳 Vous avez {credits} crédit{credits !== 1 ? 's' : ''} — Recharger
                  </button>
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

        {/* VUE HISTORIQUE */}
        {view === 'history' && !selectedAnalysis && (
          <>
            {(user ? dbHistory : history).length === 0
              ? <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                  <p style={{ fontWeight: '600', fontSize: '16px' }}>Aucune analyse sauvegardée</p>
                </div>
              : <>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                    {user ? dbHistory.length : history.length} analyse{(user ? dbHistory.length : history.length) > 1 ? 's' : ''} sauvegardée{(user ? dbHistory.length : history.length) > 1 ? 's' : ''}
                  </p>
                  {(user ? dbHistory : history).map((a: any, i: number) => {
                    const score = a.score || a.diagnostic?.score_global
                    const etat = a.etat || a.diagnostic?.etat || 'bon'
                    const resume = a.resume || a.diagnostic?.resume
                    const date = a.date || new Date(a.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    const photoPreview = a.photoPreview || a.photo_urls?.[0]
                    const vol = a.poolVolume || a.pool_volume
                    const city = a.location?.city || a.location_data?.city
                    return (
                      <div key={i} onClick={() => setSelectedAnalysis(a)}
                        style={{ background: 'white', borderRadius: '16px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center', border: '1px solid #f1f5f9' }}>
                        {photoPreview && <img src={photoPreview} alt="" style={{ width: '64px', height: '64px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '800', color: getColor(etat), fontSize: '22px' }}>{score}/10</span>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{date}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resume}</p>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            {city && <span style={{ fontSize: '12px', color: '#94a3b8' }}>📍 {city}</span>}
                            {vol && <span style={{ fontSize: '12px', color: '#94a3b8' }}>💧 {vol}m³</span>}
                          </div>
                        </div>
                        <span style={{ color: '#cbd5e1', fontSize: '18px' }}>›</span>
                      </div>
                    )
                  })}
                </>
            }
          </>
        )}

        {view === 'history' && selectedAnalysis && (
          <>
            <button onClick={() => setSelectedAnalysis(null)}
              style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: '14px', marginBottom: '16px', padding: 0 }}>
              ← Retour
            </button>
            {(selectedAnalysis.photoPreview || (selectedAnalysis as any).photo_urls?.[0]) && (
              <img src={selectedAnalysis.photoPreview || (selectedAnalysis as any).photo_urls?.[0]} alt=""
                style={{ width: '100%', borderRadius: '14px', objectFit: 'cover', maxHeight: '200px', marginBottom: '16px' }} />
            )}
            <DiagnosticView
              r={selectedAnalysis.diagnostic}
              w={selectedAnalysis.weather || (selectedAnalysis as any).weather_data}
              l={selectedAnalysis.location || (selectedAnalysis as any).location_data}
              m={selectedAnalysis.photoMeta || (selectedAnalysis as any).photo_meta}
            />
          </>
        )}

        {/* VUE COMPTE */}
        {view === 'account' && (
          <div>
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '24px' }}>👤</span>
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: '#0c4a6e', fontSize: '16px' }}>{user?.email}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Membre Pool Water AI</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#0369a1' }}>{credits}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Crédit{credits !== 1 ? 's' : ''} restant{credits !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a' }}>{dbHistory.length}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Analyse{dbHistory.length !== 1 ? 's' : ''} effectuée{dbHistory.length !== 1 ? 's' : ''}</div>
                </div>
              </div>

              <button onClick={() => setShowBuyCredits(true)}
                style={{ width: '100%', padding: '14px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '15px', marginBottom: '10px' }}>
                💳 Acheter des crédits
              </button>

              <button onClick={signOut}
                style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}>
                Déconnexion
              </button>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#0c4a6e', fontSize: '15px' }}>📦 Packs disponibles</h3>
              {[
                { id: 'single', label: '1 analyse', price: '5€', per: '5€/analyse' },
                { id: 'pack5', label: '5 analyses', price: '20€', per: '4€/analyse', badge: '-20%' },
                { id: 'pack10', label: '10 analyses', price: '35€', per: '3,50€/analyse', badge: '-30%' }
              ].map(pack => (
                <button key={pack.id} onClick={() => buyCredits(pack.id)}
                  style={{ width: '100%', padding: '14px', border: '2px solid #e0f2fe', borderRadius: '12px', background: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '700', color: '#0c4a6e' }}>{pack.label}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{pack.per}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {pack.badge && <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '700' }}>{pack.badge}</span>}
                    <span style={{ fontWeight: '800', color: '#0ea5e9', fontSize: '16px' }}>{pack.price}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}