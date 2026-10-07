// src/App.tsx
import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useAdminStore } from './store/adminStore';
import type { AdminUser } from './types';

import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import CommandPalette from './components/CommandPalette';
import { Toaster } from './lib/toast';
import { ConfirmHost } from './lib/confirm';

// Login is needed immediately (unauthenticated entry) — keep it eager.
import Login from './pages/Login';

// Everything behind auth is code-split so the initial bundle stays small.
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Users          = lazy(() => import('./pages/Users'));
const Children       = lazy(() => import('./pages/Children'));
const Community       = lazy(() => import('./pages/Community'));
const Content        = lazy(() => import('./pages/Content'));
const Medical        = lazy(() => import('./pages/Medical'));
const AICenter       = lazy(() => import('./pages/AICenter'));
const FeatureFlags   = lazy(() => import('./pages/FeatureFlags'));
const AuditLogs      = lazy(() => import('./pages/AuditLogs'));
const Notifications  = lazy(() => import('./pages/Notifications'));
const SmartNotifications = lazy(() => import('./pages/SmartNotifications'));
const EmailTemplates = lazy(() => import('./pages/EmailTemplates'));
const Settings       = lazy(() => import('./pages/Settings'));
const Reports        = lazy(() => import('./pages/Reports'));
const Billing        = lazy(() => import('./pages/Billing'));
const Storage        = lazy(() => import('./pages/Storage'));
const Support        = lazy(() => import('./pages/Support'));
const Analytics      = lazy(() => import('./pages/Analytics'));

function FullscreenLoader({ message = 'Se încarcă…' }: { message?: string }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: 'linear-gradient(135deg, #6366F1, #A855F7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
      }}>🌸</div>
      <div className="spinner" />
      <p style={{ color: 'var(--text3)', fontSize: 13 }}>{message}</p>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { adminUser, isLoading, isInitialized } = useAdminStore();
  if (!isInitialized || isLoading) return <FullscreenLoader message="Se verifică accesul…" />;
  if (!adminUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Wraps the page area so a crash on one route doesn't take down the console, and resets on navigation. */
function RouteArea() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<div style={{ padding: 40 }}><div className="spinner" /></div>}>
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/users"         element={<Users />} />
          <Route path="/children"      element={<Children />} />
          <Route path="/community"     element={<Community />} />
          <Route path="/content"       element={<Content />} />
          <Route path="/medical"       element={<Medical />} />
          <Route path="/ai"            element={<AICenter />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/smart-notifications" element={<SmartNotifications />} />
          <Route path="/email-templates" element={<EmailTemplates />} />
          <Route path="/reports"       element={<Reports />} />
          <Route path="/billing"       element={<Billing />} />
          <Route path="/storage"       element={<Storage />} />
          <Route path="/support"       element={<Support />} />
          <Route path="/analytics"     element={<Analytics />} />
          <Route path="/flags"         element={<FeatureFlags />} />
          <Route path="/audit"         element={<AuditLogs />} />
          <Route path="/settings"      element={<Settings />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  const { setAdminUser, setLoading, setInitialized } = useAdminStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'adminUsers', user.uid));
          if (snap.exists() && snap.data()?.isActive) {
            const adminData = { uid: user.uid, ...snap.data() } as AdminUser;
            setAdminUser(adminData);
            updateDoc(doc(db, 'adminUsers', user.uid), { lastLogin: serverTimestamp() }).catch(() => {});
          } else {
            await auth.signOut();
            setAdminUser(null);
          }
        } catch {
          setAdminUser(null);
        }
      } else {
        setAdminUser(null);
      }
      setLoading(false);
      setInitialized(true);
    });
    return unsub;
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <AuthGuard>
            <Layout>
              <RouteArea />
            </Layout>
            <CommandPalette />
          </AuthGuard>
        } />
      </Routes>
      <Toaster />
      <ConfirmHost />
    </BrowserRouter>
  );
}
