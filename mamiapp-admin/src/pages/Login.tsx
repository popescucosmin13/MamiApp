// src/pages/Login.tsx
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAdminStore } from '../store/adminStore';
import { useNavigate } from 'react-router-dom';
import type { AdminUser } from '../types';

export default function Login() {
  const navigate = useNavigate();
  const { setAdminUser } = useAdminStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'adminUsers', cred.user.uid));
      if (!snap.exists() || !snap.data()?.isActive) {
        await auth.signOut();
        setError('Acces refuzat. Nu aveți permisiuni de admin.');
        setLoading(false);
        return;
      }
      const adminData = { uid: cred.user.uid, ...snap.data() } as AdminUser;
      setAdminUser(adminData);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(
        err.code === 'auth/invalid-credential'
          ? 'Email sau parolă incorectă.'
          : `Eroare la autentificare: ${err.code || err.message || err}`
      );
    } finally {

      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15), transparent)',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18,
            background: 'linear-gradient(135deg, #6366F1, #A855F7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
            boxShadow: '0 0 40px rgba(99,102,241,0.4)',
          }}>🌸</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>MamiApp Admin</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>Console de administrare</p>
        </div>

        {/* Card */}
        <div className="card" style={{ border: '1px solid var(--border2)', padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Autentificare</h2>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
            Accesul este restricționat la adminii autorizați.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                Email
              </label>
              <input
                className="input"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                Parolă
              </label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
                borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--danger)',
              }}>⚠️ {error}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ height: 44, fontSize: 14, marginTop: 4 }}
            >
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : '🔐 Intră în cont'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, marginTop: 20 }}>
          MamiApp Admin v1.0 · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
