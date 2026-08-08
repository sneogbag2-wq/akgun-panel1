// src/pages/LoginPage.tsx
// Basit e-posta/şifre giriş ekranı. Backend tüm /api/v2 endpointlerinde
// geçerli bir Supabase oturumu (Bearer token) istiyor; bu ekran olmadan
// hiçbir istek gönderilmiyordu (session her zaman null kalıyordu).
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';

interface LoginPageProps {
  onLoggedIn: () => void;
}

export default function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials'
          ? 'E-posta veya şifre hatalı.'
          : signInError.message);
        return;
      }
      onLoggedIn();
    } catch (err: any) {
      setError(err?.message || 'Giriş sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-gradient, radial-gradient(circle at 15% 50%, #0a081a, #04060d 40%, #000000 100%))',
      fontFamily: 'var(--font-sans, Inter, sans-serif)',
      padding: '16px',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: '360px',
          background: 'var(--bg-card, rgba(8, 12, 20, 0.65))',
          border: '1px solid var(--border, rgba(255,255,255,0.12))',
          borderRadius: '16px',
          padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <h1 style={{
          margin: '0 0 4px',
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#F1F5F9',
        }}>
          AKGÜN Panel
        </h1>
        <p style={{
          margin: '0 0 24px',
          fontSize: '0.85rem',
          color: '#94A3B8',
        }}>
          Devam etmek için giriş yapın
        </p>

        <label style={{ display: 'block', marginBottom: '14px' }}>
          <span style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '6px' }}>
            E-posta
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border, rgba(255,255,255,0.12))',
              background: 'rgba(255,255,255,0.05)',
              color: '#F1F5F9',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '20px' }}>
          <span style={{ display: 'block', fontSize: '0.78rem', color: '#94A3B8', marginBottom: '6px' }}>
            Şifre
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border, rgba(255,255,255,0.12))',
              background: 'rgba(255,255,255,0.05)',
              color: '#F1F5F9',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
        </label>

        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#FCA5A5',
            fontSize: '0.82rem',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: '8px',
            border: 'none',
            background: loading
              ? 'rgba(59,130,246,0.5)'
              : 'var(--accent-gradient, linear-gradient(135deg, #2563eb 0%, #0284c7 100%))',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  );
}
