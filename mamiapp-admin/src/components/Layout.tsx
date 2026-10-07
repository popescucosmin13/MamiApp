/* ── Layout: Sidebar + Header ── */
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAdminStore } from '../store/adminStore';
import type { AdminRole } from '../types';

const NAV = [
  { section: 'Principal', items: [
    { to: '/',            icon: '📊', label: 'Dashboard' },
    { to: '/users',       icon: '👥', label: 'Utilizatori' },
    { to: '/children',    icon: '👶', label: 'Copii & Sarcini' },
  ]},
  { section: 'Conținut', items: [
    { to: '/community',   icon: '💬', label: 'Comunitate' },
    { to: '/content',     icon: '📝', label: 'Conținut' },
    { to: '/medical',     icon: '🏥', label: 'Module Medicale' },
  ]},
  { section: 'AI & Sistem', items: [
    { to: '/ai',          icon: '🤖', label: 'AI Center' },
    { to: '/notifications', icon: '🔔', label: 'Notificări' },
    { to: '/smart-notifications', icon: '🧠', label: 'Notificări Smart' },
    { to: '/reports',     icon: '📋', label: 'Rapoarte' },
  ]},
  { section: 'Email', items: [
    { to: '/email-templates', icon: '✉️', label: 'Email Templates' },
  ]},
  { section: 'Business', items: [
    { to: '/billing',     icon: '💳', label: 'Abonamente & Plăți' },
    { to: '/storage',     icon: '💾', label: 'Documente & Storage' },
    { to: '/support',     icon: '🎧', label: 'Feedback & Suport' },
  ]},
  { section: 'Analytics & Config', items: [
    { to: '/analytics',   icon: '📈', label: 'Analytics' },
    { to: '/flags',       icon: '🏴', label: 'Feature Flags' },
    { to: '/audit',       icon: '🔒', label: 'Audit & Security' },
    { to: '/settings',    icon: '⚙️',  label: 'Setări Aplicație' },
  ]},
];

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  content_editor: 'Editor Conținut',
  medical_reviewer: 'Reviewer Medical',
  community_moderator: 'Moderator',
  support_agent: 'Agent Suport',
  finance_manager: 'Finance',
  developer: 'Developer',
};

const ROLE_COLORS: Record<AdminRole, string> = {
  super_admin: '#A855F7',
  admin: '#6366F1',
  content_editor: '#3B82F6',
  medical_reviewer: '#10B981',
  community_moderator: '#F59E0B',
  support_agent: '#6B7280',
  finance_manager: '#EC4899',
  developer: '#14B8A6',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { adminUser } = useAdminStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const role = adminUser?.role ?? 'admin';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: collapsed ? 60 : 'var(--sidebar-w)',
        minWidth: collapsed ? 60 : 'var(--sidebar-w)',
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width .2s, min-width .2s',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          height: 'var(--header-h)', display: 'flex',
          alignItems: 'center', gap: 10,
          padding: collapsed ? '0 14px' : '0 16px',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366F1, #A855F7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>🌸</div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>MamiApp</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>ADMIN CONSOLE</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="btn btn-ghost btn-icon btn-sm"
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {NAV.map(section => (
            <div key={section.section} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                  textTransform: 'uppercase', color: 'var(--text3)',
                  padding: '8px 8px 4px', marginTop: 4,
                }}>{section.section}</div>
              )}
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: collapsed ? '9px 14px' : '9px 10px',
                    borderRadius: 8, marginBottom: 1, textDecoration: 'none',
                    fontSize: 13, fontWeight: 500,
                    color: isActive ? 'var(--text)' : 'var(--text2)',
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'all .12s',
                  })}
                >
                  <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User section */}
        <div style={{
          padding: collapsed ? '12px 8px' : '12px',
          borderTop: '1px solid var(--border)', flexShrink: 0,
        }}>
          {!collapsed ? (
            <div style={{
              background: 'var(--surface)', borderRadius: 10, padding: 10,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: `${ROLE_COLORS[role]}25`, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, color: ROLE_COLORS[role], fontWeight: 700,
              }}>{adminUser?.displayName?.[0]?.toUpperCase() || 'A'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {adminUser?.displayName || adminUser?.email}
                </div>
                <div style={{ fontSize: 10, color: ROLE_COLORS[role], fontWeight: 600, marginTop: 1 }}>
                  {ROLE_LABELS[role]}
                </div>
              </div>
              <button onClick={handleLogout} className="btn btn-ghost btn-icon btn-sm" title="Logout">
                🚪
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="btn btn-ghost btn-icon" title="Logout" style={{ width: '100%' }}>
              🚪
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          height: 'var(--header-h)', flexShrink: 0,
          background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          paddingInline: 24, gap: 12,
        }}>
          <GlobalSearch />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <HealthScore />
            <NotifButton />
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <div style={{ position: 'relative', width: 320 }}>
      <span style={{
        position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
        fontSize: 13, color: 'var(--text3)',
      }}>🔍</span>
      <input
        className="input"
        placeholder="Caută utilizatori, postări, ticket-uri..."
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && q.trim()) {
            navigate(`/users?search=${encodeURIComponent(q.trim())}`);
            setQ('');
          }
        }}
        style={{ paddingLeft: 32, height: 36, fontSize: 13 }}
      />
    </div>
  );
}

function HealthScore() {
  const [score, setScore] = useState(100);

  useEffect(() => {
    let maintenancePenalty = 0;
    let ticketPenalty = 0;
    const recompute = () => setScore(Math.max(0, Math.min(100, 100 - maintenancePenalty - ticketPenalty)));

    // Config (one-time) + live tickets — scorul se actualizează în timp real.
    getDoc(doc(db, 'appConfig', 'global'))
      .then((configDoc) => {
        maintenancePenalty = configDoc.exists() && configDoc.data().maintenanceMode === true ? 30 : 0;
        recompute();
      })
      .catch(() => {});

    const unsub = onSnapshot(
      query(collection(db, 'supportTickets'), where('status', 'in', ['open', 'in_progress'])),
      (snap) => { ticketPenalty = Math.min(snap.size * 3, 30); recompute(); },
      () => {}
    );
    return unsub;
  }, []);

  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--surface)', borderRadius: 8, padding: '5px 10px',
      border: '1px solid var(--border)',
    }}>
      <div className="dot" style={{ background: color }} />
      <span style={{ fontSize: 12, fontWeight: 600, color }}>Sănătate: {score}/100</span>
    </div>
  );
}

function NotifButton() {
  const navigate = useNavigate();
  const [urgentCount, setUrgentCount] = useState(0);

  useEffect(() => {
    // Live: contorul de urgențe se actualizează pe măsură ce apar tichete.
    const unsub = onSnapshot(
      query(collection(db, 'supportTickets'), where('status', 'in', ['open', 'in_progress']), where('priority', '==', 'urgent')),
      (snap) => setUrgentCount(snap.size),
      () => {}
    );
    return unsub;
  }, []);

  return (
    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/notifications')} style={{ position: 'relative' }}>
      🔔 <span style={{ fontSize: 11 }}>Notificări</span>
      {urgentCount > 0 && (
        <span style={{
          position: 'absolute', top: 2, right: 2,
          background: 'var(--danger)', color: '#fff',
          borderRadius: '50%', width: 16, height: 16,
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{urgentCount > 9 ? '9+' : urgentCount}</span>
      )}
    </button>
  );
}
