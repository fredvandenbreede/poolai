'use client'
import { useEffect } from 'react'

export default function AuthConfirm() {
  useEffect(() => {
    // Supabase gère automatiquement le token dans l'URL
    // On redirige vers /test après un court délai
    const timer = setTimeout(() => {
      window.location.replace('/test')
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0c4a6e, #0369a1)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: '20px'
    }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>🏊</div>
      <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '800', margin: '0 0 12px', textAlign: 'center' }}>
        Pooltester.app
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', margin: '0 0 40px', textAlign: 'center' }}>
        Connexion en cours...
      </p>

      <div style={{ display: 'flex', gap: '10px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'white',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
          }} />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-8px); }
        }
      `}</style>
    </main>
  )
}