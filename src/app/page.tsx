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
  { id: 2, label: 'Vue de près', desc: 'Surface de l\'eau en gros plan', emoji: '🔍' },
  { id: 3, label: 'Vue de côté', desc: 'Depuis le bord, angle latéral', emoji: '↔️' },
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
  const [openSections, setOpenSections] = useState<string[]>(['score', 'action_0'])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [followUpSlot, setFollowUpSlot] = useState<number | null>(null)
  const [followUpPhoto, setFollowUpPhoto] = useState<{ file: File; preview: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const followUpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pool_analyses')
      if (saved) setHistory(JSON.parse(saved))
      const vol = localStorage.getItem('pool_volume')
      if (vol) { setPoolVolume(parseInt(vol)); setVolumeSet(true) }
    } catch {}
  }, [])

  function toggleSection(id: string) {
    setOpenSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
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
    if (!file || followUpSlot === null) return
    compressImage(file).then(compressed => {
      const preview = URL.createObjectURL(compressed)
      setFollowUpPhoto({ file: compressed, preview })
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

  function saveAnalysis(diagnostic: any, weatherData: any, locationData: any, metaData: any) {
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
    setLoading(true); setError(null); setFollowUps([])
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      ).catch(() => null)

      const formData = new FormData()
      formData.append('poolVolume', poolVolume.toString())
      photos.forEach((p, i) => formData.append(`photo${i + 1}`, p.file))
      if (pos) {
        formData.append('lat', pos.coords.latitude.toString())
        formData.append('lng', pos.coords.longitude.toString())
      }
      formData.append('history', JSON.stringify(history.slice(0, 5).map(a => ({
        date: a.date, score: a.score, etat: a.etat, resume: a.resume, problemes: a.problemes
      }))))

      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur'); return }

      setResult(data.diagnostic)
      setWeather(data.weather)
      setLocation(data.location)
      setPhotoMeta(data.photoMeta)
      setOpenSections(['score', 'context', 'action_0'])
      saveAnalysis(data.diagnostic, data.weather, data.location, data.photoMeta)
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
      formData.append('history', JSON.stringify([{
        date: new Date().toLocaleDateString('fr-FR'),
        score: result.score_global,
        etat: result.etat,
        resume: result.resume,
        problemes: result.problemes_detectes || []
      }]))
      formData.append('followUpContext', JSON.stringify({
        actionDone: action.action,
        produitUtilise: action.produit_recommande,
        dosageApplique: action.dosage_calcule,
        heuresEcoulees: followUps[actionIndex]?.date
          ? Math.round((Date.now() - new Date(followUps[actionIndex].date).getTime()) / 3600000)
          : 0
      }))

      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) return

      setFollowUps(prev => prev.map((f, i) => i === actionIndex
        ? { ...f, status: 'done', photo: followUpPhoto, result: data.diagnostic }
        : f
      ))
      setFollowUpPhoto(null)
      setFollowUpSlot(null)
      setOpenSections(prev => [...prev, `followup_${actionIndex}`])
    } catch {
      setFollowUps(prev => prev.map((f, i) => i === actionIndex ? { ...f, status: 'pending' } : f))
    }
  }

  function markActionDone(actionIndex: number) {
    const action = result.plan_action[actionIndex]
    setFollowUps(prev => {
      const existing = prev.find(f => f.actionIndex === actionIndex)
      if (existing) return prev
      return [...prev, {
        actionIndex,
        actionLabel: action.action,
        date: new Date().toISOString(),
        status: 'pending'
      }]
    })
    setFollowUpSlot(actionIndex)
    setOpenSections(prev => [...prev, `action_${actionIndex}`])
  }

  const getColor = (etat: string) => ({
    excellent: '#22c55e', bon: '#84cc16', attention: '#f59e0b', urgent: '#ef4444'
  }[etat] || '#6b7280')

  const getScoreEmoji = (score: number) => {
    if (score >= 8) return '😊'
    if (score >= 6) return '😐'
    if (score >= 4) return '😟'
    return '😰'
  }

  const Accordion = ({ id, title, emoji, badge, badgeColor, children, defaultOpen }: any) => {
    const isOpen = openSections.includes(id)
    return (
      <div style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', marginBottom: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <button onClick={() => toggleSection(id)}
          style={{ width: '100%', padding: '16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>{emoji}</span>
            <span style={{ fontWeight: '700', color: '#0c4a6e', fontSize: '15px' }}>{title}</span>
            {badge && (
              <span style={{ background: badgeColor || '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                {badge}
              </span>
            )}
          </div>
          <span style={{ color: '#94a3b8', fontSize: '18px', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </button>
        {isOpen && (
          <div style={{ padding: '0 16px 16px' }}>
            {children}
          </div>
        )}
      </div>
    )
  }

  const ActionCard = ({ action, index }: { action: any, index: number }) => {
    const followUp = followUps.find(f => f.actionIndex === index)
    const isWaitingPhoto = followUpSlot === index && !followUp?.photo
    const priorityColors = {
      1: { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
      2: { bg: '#ffedd5', text: '#ea580c', border: '#fed7aa' },
      3: { bg: '#d1fae5', text: '#16a34a', border: '#a7f3d0' }
    }
    const pc = priorityColors[action.priorite as 1|2|3] || priorityColors[3]

    return (
      <Accordion
        id={`action_${index}`}
        emoji={action.priorite === 1 ? '🔴' : action.priorite === 2 ? '🟠' : '🟢'}
        title={action.action}
        badge={followUp?.status === 'done' ? '✅ Fait' : action.delai}
        badgeColor={followUp?.status === 'done' ? '#d1fae5' : '#f1f5f9'}
      >
        {/* Explication */}
        {action.explication && (
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
              💡 {action.explication}
            </p>
          </div>
        )}

        {/* Produit */}
        <div style={{ background: '#f0f9ff', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '700', color: '#0369a1' }}>
            🧪 {action.produit_recommande}
          </p>
          {action.marque_alternative && (
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#64748b' }}>
              Alternative : {action.marque_alternative}
            </p>
          )}
          {action.dosage_calcule && (
            <div style={{ background: '#0ea5e9', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'white' }}>
                📏 {action.dosage_calcule}
              </p>
              {action.dosage_standard && (
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                  Standard 50m³ : {action.dosage_standard}
                </p>
              )}
            </div>
          )}
          {action.moment_application && (
            <p style={{ margin: 0, fontSize: '13px', color: '#0c4a6e' }}>
              🕐 {action.moment_application}
            </p>
          )}
        </div>

        {/* Précautions */}
        {action.precautions && (
          <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', lineHeight: '1.5' }}>
              ⚠️ {action.precautions}
            </p>
          </div>
        )}

        {/* Suivi après traitement */}
        {!followUp && (
          <button onClick={() => markActionDone(index)}
            style={{ width: '100%', padding: '12px', background: '#0c4a6e', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
            ✅ J'ai effectué ce traitement → Vérifier l'amélioration
          </button>
        )}

        {/* Upload photo de suivi */}
        {followUp && followUp.status === 'pending' && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#15803d', fontWeight: '600' }}>
                ✅ Traitement effectué ! Attendez le temps recommandé puis prenez une photo pour vérifier l'amélioration.
              </p>
            </div>

            {action.delai === 'maintenant' && (
              <div style={{ background: '#fef9c3', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#854d0e' }}>
                  ⏳ Laissez circuler la pompe au moins 2h avant de reprendre une photo
                </p>
              </div>
            )}

            {!followUpPhoto ? (
              <button onClick={() => { setFollowUpSlot(index); setTimeout(() => followUpRef.current?.click(), 50) }}
                style={{ width: '100%', padding: '14px', background: 'white', border: '2px dashed #0ea5e9', borderRadius: '12px', color: '#0ea5e9', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                📸 Prendre une photo pour vérifier
              </button>
            ) : (
              <div>
                <img src={followUpPhoto.preview} alt="Suivi" style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '180px', marginBottom: '10px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setFollowUpPhoto(null)}
                    style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}>
                    🔄 Changer
                  </button>
                  <button onClick={() => analyzeFollowUp(index)}
                    style={{ flex: 2, padding: '12px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                    🔬 Analyser l'amélioration
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {followUp?.status === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#0369a1' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Analyse de l'amélioration...</p>
          </div>
        )}

        {/* Résultat du suivi */}
        {followUp?.status === 'done' && followUp.result && (
          <div id={`followup_${index}`} style={{ marginTop: '8px' }}>
            <div style={{ height: '1px', background: '#e2e8f0', marginBottom: '14px' }} />
            <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginBottom: '10px' }}>
              📊 Résultat après traitement :
            </p>
            {followUp.photo && (
              <img src={followUp.photo.preview} alt="" style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '160px', marginBottom: '12px' }} />
            )}
            <div style={{ background: getColor(followUp.result.etat), borderRadius: '12px', padding: '16px', color: 'white', textAlign: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '36px', fontWeight: '800' }}>{followUp.result.score_global}/10</div>
              <div style={{ fontSize: '16px', fontWeight: '600', marginTop: '4px', textTransform: 'capitalize' }}>{followUp.result.etat}</div>
              <div style={{ opacity: 0.9, marginTop: '6px', fontSize: '14px' }}>{followUp.result.resume}</div>
              {followUp.result.evolution_vs_precedent === 'amelioration' && (
                <div style={{ marginTop: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '4px 12px', display: 'inline-block', fontSize: '13px' }}>
                  📈 Amélioration confirmée !
                </div>
              )}
            </div>
            {followUp.result.plan_action?.length > 0 && (
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: '#0c4a6e' }}>Prochaine étape recommandée :</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                  {followUp.result.plan_action[0]?.action}
                </p>
                {followUp.result.plan_action[0]?.produit_recommande && (
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#0369a1', fontWeight: '600' }}>
                    🧪 {followUp.result.plan_action[0].produit_recommande} — {followUp.result.plan_action[0].dosage_calcule}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Accordion>
    )
  }

  const DiagnosticView = ({ r, w, l, m }: { r: any, w?: any, l?: any, m?: any }) => (
    <div style={{ marginTop: '16px' }}>

      {/* Score — toujours ouvert */}
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
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: r.evolution_vs_precedent === 'amelioration' ? '#16a34a' : r.evolution_vs_precedent === 'degradation' ? '#dc2626' : '#64748b', fontWeight: '600' }}>
                {r.evolution_vs_precedent === 'amelioration' ? '📈 En amélioration' : r.evolution_vs_precedent === 'degradation' ? '📉 En dégradation' : '➡️ Stable'} vs analyse précédente
              </p>
            )}
          </div>
        </div>

        {/* Jauge visuelle */}
        <div style={{ background: '#f1f5f9', borderRadius: '20px', height: '10px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${r.score_global * 10}%`, background: getColor(r.etat), borderRadius: '20px', transition: 'width 1s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Urgent</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Excellent</span>
        </div>
      </Accordion>

      {/* Contexte météo */}
      {(w || l || m) && (
        <Accordion id="context" emoji="🌤️" title="Contexte & météo">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {l && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '18px' }}>📍</span>
                <span style={{ fontSize: '14px', color: '#374151' }}>{l.city}, {l.country}</span>
              </div>
            )}
            {m && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '18px' }}>🕐</span>
                <span style={{ fontSize: '14px', color: '#374151' }}>Photo prise le {m.date} à {m.heure} ({m.momentJournee})</span>
              </div>
            )}
            {w && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#92400e' }}>{w.temp_air}°C</div>
                    <div style={{ fontSize: '11px', color: '#92400e' }}>Température air</div>
                  </div>
                  <div style={{ padding: '10px', background: '#e0f2fe', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#0369a1' }}>{w.temp_water_estimated}°C</div>
                    <div style={{ fontSize: '11px', color: '#0369a1' }}>Température eau ~</div>
                  </div>
                </div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>☁️ {w.description} — Humidité {w.humidity}%</span>
                </div>
              </>
            )}
            {r.impact_contexte && (
              <div style={{ padding: '10px 12px', background: '#fefce8', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: '1.5' }}>
                  💡 {r.impact_contexte}
                </p>
              </div>
            )}
          </div>
        </Accordion>
      )}

      {/* Observations */}
      <Accordion id="observations" emoji="👁️" title="Observations visuelles">
        {r.synthese_photos && (
          <div style={{ background: '#f5f3ff', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#5b21b6', lineHeight: '1.5' }}>
              📸 {r.synthese_photos}
            </p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {Object.entries(r.observations || {}).map(([key, val]) => (
            <div key={key} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: `1px solid ${typeof val === 'boolean' && val ? '#fecaca' : '#f1f5f9'}` }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {key.replace(/_/g, ' ')}
              </div>
              <div style={{ fontWeight: '600', color: '#0c4a6e', fontSize: '14px', marginTop: '4px' }}>
                {typeof val === 'boolean' ? (val ? '⚠️ Oui' : '✅ Non') : String(val)}
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      {/* Problèmes */}
      {r.problemes_detectes?.length > 0 && (
        <Accordion id="problems" emoji="⚠️" title="Problèmes détectés" badge={r.problemes_detectes.length.toString()} badgeColor="#fee2e2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {r.problemes_detectes.map((p: string, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: '#fef2f2', borderRadius: '8px', alignItems: 'flex-start' }}>
                <span style={{ color: '#dc2626', flexShrink: 0 }}>•</span>
                <span style={{ fontSize: '13px', color: '#7f1d1d', lineHeight: '1.5' }}>{p}</span>
              </div>
            ))}
          </div>
        </Accordion>
      )}

      {/* Plan d'action — chaque action est son propre accordéon */}
      {r.plan_action?.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '20px 0 12px' }}>
            <span style={{ fontSize: '18px' }}>🎯</span>
            <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '16px' }}>Plan d'action</h3>
            <span style={{ fontSize: '13px', color: '#64748b' }}>({r.plan_action.length} étape{r.plan_action.length > 1 ? 's' : ''})</span>
          </div>
          {r.plan_action.map((action: any, i: number) => (
            <ActionCard key={i} action={action} index={i} />
          ))}
        </div>
      )}

      {/* Prévention */}
      <Accordion id="prevention" emoji="🛡️" title="Conseils de prévention">
        <p style={{ margin: 0, color: '#374151', fontSize: '14px', lineHeight: '1.7' }}>
          {r.conseil_prevention}
        </p>
      </Accordion>

      {/* Prochaine analyse */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginTop: '10px' }}>
        <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
          📅 Prochaine analyse recommandée dans
        </p>
        <p style={{ margin: '4px 0 0', fontWeight: '800', color: '#0c4a6e', fontSize: '18px' }}>
          {r.prochaine_analyse_dans}
        </p>
        <button onClick={() => { setPhotos([]); setResult(null); setFollowUps([]); window.scrollTo(0, 0) }}
          style={{ marginTop: '12px', padding: '10px 20px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', color: '#0369a1', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
          📸 Nouvelle analyse
        </button>
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

      <input ref={followUpRef} type="file" accept="image/*" capture="environment" onChange={handleFollowUpPhoto} style={{ display: 'none' }} />

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px' }}>

        {view === 'analyze' && (
          <>
            {/* Volume */}
            {!result && (
              <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '16px' }}>💧 Volume de votre piscine</h3>
                  {volumeSet && (
                    <button onClick={() => setVolumeSet(false)}
                      style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '13px', cursor: 'pointer' }}>Modifier</button>
                  )}
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
            )}

            {/* Photos */}
            {volumeSet && !result && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '16px' }}>📸 Photos de la piscine</h3>
                    <span style={{ fontSize: '13px', color: photos.length >= 3 ? '#16a34a' : '#f59e0b', fontWeight: '600' }}>
                      {photos.length}/3 {photos.length >= 3 ? '✅' : ''}
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

                  {photos.length === 0 && (
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#0369a1' }}>📸 3 vues différentes = diagnostic plus précis. Min. 1 photo requise.</p>
                    </div>
                  )}
                  {photos.length >= 3 && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>✅ Parfait ! L'IA va croiser les 3 vues pour un diagnostic précis.</p>
                    </div>
                  )}
                </div>

                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />

                <button onClick={analyze} disabled={photos.length < 1 || loading}
                  style={{ width: '100%', padding: '16px', background: photos.length >= 1 ? '#0ea5e9' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '14px', fontSize: '17px', fontWeight: '700', cursor: photos.length >= 1 ? 'pointer' : 'not-allowed', marginBottom: '12px', opacity: loading ? 0.8 : 1 }}>
                  {loading ? '⏳ Analyse en cours...' : photos.length >= 3 ? `🔬 Analyser (${photos.length} photos — ${poolVolume}m³)` : photos.length > 0 ? `🔬 Analyser avec ${photos.length} photo${photos.length > 1 ? 's' : ''}` : '📸 Ajoutez au moins 1 photo'}
                </button>

                {history.length > 0 && !loading && (
                  <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
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
              Analyse du {selectedAnalysis.date} — {selectedAnalysis.poolVolume}m³
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