'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/src/lib/supabase'

export default function Home() {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'is_live')
      .single()
      .then(({ data }) => {
        if (data?.value === 'true') {
          window.location.replace('/test')
        } else {
          setChecking(false)
        }
      })
  }, [])

  if (checking) return (
    <main style={{ minHeight: '100vh', background: '#0c4a6e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '48px' }}>🏊</div>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c4a6e, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ fontSize: '72px', marginBottom: '16px' }}>🏊</div>
        <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'white', margin: '0 0 12px' }}>Pool Water AI</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', marginBottom: '32px', lineHeight: '1.6' }}>
          Diagnostic IA de votre eau de piscine — Bientôt disponible
        </p>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px' }}>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', margin: 0 }}>
            🚀 Lancement imminent — Revenez bientôt !
          </p>
        </div>
      </div>
    </main>
  )
}