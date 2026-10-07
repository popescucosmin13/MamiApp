// src/pages/Analytics.tsx
import { useEffect, useState } from 'react';
import { collection, getDocs, getCountFromServer, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [premiumUsers, setPremiumUsers] = useState(0);
  const [pregnantUsers, setPregnantUsers] = useState(0);
  const [childUsers, setChildUsers] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState(0);
  const [registrationData, setRegistrationData] = useState<Array<{ day: string; utilizatori: number }>>([]);
  const [modeData, setModeData] = useState<Array<{ name: string; value: number; fill: string }>>([]);
  const [pwaData, setPwaData] = useState<Array<{ name: string; value: number; fill: string }>>([]);
  const [totalPwa, setTotalPwa] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        // Numărătorile se fac cu aggregation (o citire fiecare), nu prin scanarea întregii colecții.
        // Graficele au nevoie de date per-document, dar doar pentru subseturi mici:
        //  - înregistrări: doar ultimele 7 zile
        //  - PWA: doar utilizatorii marcați isPWA
        const usersCol = collection(db, 'users');
        const weekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 86400000));

        const [totalC, premiumC, pregnantC, childC, onboardedC, recentSnap, pwaSnap] = await Promise.all([
          getCountFromServer(usersCol),
          getCountFromServer(query(usersCol, where('subscription.plan', '==', 'premium'))),
          getCountFromServer(query(usersCol, where('profileMode', '==', 'pregnancy'))),
          getCountFromServer(query(usersCol, where('profileMode', '==', 'child'))),
          getCountFromServer(query(usersCol, where('onboardingCompleted', '==', true))),
          getDocs(query(usersCol, where('createdAt', '>=', weekAgo))),
          getDocs(query(usersCol, where('isPWA', '==', true))),
        ]);

        const total = totalC.data().count;
        const premium = premiumC.data().count;
        const pregnant = pregnantC.data().count;
        const child = childC.data().count;
        const onboarded = onboardedC.data().count;

        const regByDay: Record<string, number> = {};
        recentSnap.forEach(userDoc => {
          const createdAt = toDate(userDoc.data().createdAt);
          if (createdAt) {
            const key = createdAt.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
            regByDay[key] = (regByDay[key] || 0) + 1;
          }
        });

        const pwaByOS: Record<string, number> = {};
        const pwaCount = pwaSnap.size;
        pwaSnap.forEach(userDoc => {
          const platform = (userDoc.data().platform || '').toLowerCase();
          let os = 'Altele';
          if (platform.includes('ios')) os = 'iOS';
          else if (platform.includes('android')) os = 'Android';
          else if (platform.includes('windows')) os = 'Windows';
          else if (platform.includes('mac')) os = 'macOS';
          else if (platform.includes('linux')) os = 'Linux';
          pwaByOS[os] = (pwaByOS[os] || 0) + 1;
        });

        setTotalUsers(total);
        setPremiumUsers(premium);
        setPregnantUsers(pregnant);
        setChildUsers(child);
        setOnboardingCompleted(onboarded);
        setTotalPwa(pwaCount);

        setRegistrationData(Array.from({ length: 7 }, (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - index));
          const key = date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
          return { day: key, utilizatori: regByDay[key] || 0 };
        }));

        setModeData([
          { name: 'Copil', value: child, fill: '#6366F1' },
          { name: 'Sarcină', value: pregnant, fill: '#EC4899' },
          { name: 'Nesetat', value: Math.max(total - child - pregnant, 0), fill: '#F59E0B' },
        ]);

        const pwaColors: Record<string, string> = { iOS: '#6366F1', Android: '#10B981', Windows: '#3B82F6', macOS: '#F59E0B', Linux: '#EF4444', Altele: '#6B7280' };
        setPwaData(Object.entries(pwaByOS).map(([name, value]) => ({ name, value, fill: pwaColors[name] || '#6B7280' })).sort((a, b) => b.value - a.value));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const conversionRate = totalUsers > 0 ? ((premiumUsers / totalUsers) * 100).toFixed(1) : '0';
  const onboardingRate = totalUsers > 0 ? ((onboardingCompleted / totalUsers) * 100).toFixed(1) : '0';

  const tt = (p: any) => (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      {p.active && p.payload?.map((e: any, i: number) => (
        <div key={i} style={{ color: e.color }}>{e.name || e.dataKey}: <strong>{e.value}</strong></div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200 }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Analytics Produs</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>Metrici calculate din Firestore.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total Utilizatori', val: totalUsers, color: '#6366F1' },
              { label: 'Utilizatori Premium', val: premiumUsers, color: '#F59E0B' },
              { label: 'Conversie Premium', val: conversionRate + '%', color: '#10B981' },
              { label: 'Onboarding complet', val: onboardingRate + '%', color: '#8B5CF6' },
              { label: 'Mod Sarcină', val: pregnantUsers, color: '#EC4899' },
              { label: 'Mod Copil', val: childUsers, color: '#3B82F6' },
            ].map(k => (
              <div key={k.label} className="card">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: k.color + '20', marginBottom: 8 }} />
                <div style={{ fontSize: 22, fontWeight: 800 }}>{typeof k.val === 'number' ? k.val.toLocaleString() : k.val}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 24 }}>
            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Înregistrări noi (ultimele 7 zile)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={registrationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={tt} />
                  <Bar dataKey="utilizatori" fill="#6366F1" radius={[4, 4, 0, 0]} name="Utilizatori noi" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Distribuție mod de utilizare</div>
              <ProgressRows rows={modeData} total={totalUsers} />
              <div style={{ marginTop: 24, padding: 16, background: 'var(--surface2)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Onboarding real</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text2)' }}>Completat</span>
                  <span style={{ fontWeight: 700, color: '#10B981' }}>{onboardingCompleted}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                  <span style={{ color: 'var(--text2)' }}>Rată completare</span>
                  <span style={{ fontWeight: 700, color: '#6366F1' }}>{onboardingRate}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Instalări PWA pe sisteme de operare</div>
            {pwaData.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, padding: 20, textAlign: 'center' }}>Nu există date PWA în profilurile utilizatorilor.</div>
            ) : <ProgressRows rows={pwaData} total={totalPwa} />}
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Onboarding și conversie reale</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {[
                { step: '1. Utilizatori', pct: 100, count: totalUsers, color: '#6366F1' },
                { step: '2. Onboarding', pct: Number(onboardingRate), count: onboardingCompleted, color: '#8B5CF6' },
                { step: '3. Mod copil', pct: totalUsers > 0 ? Math.round((childUsers / totalUsers) * 100) : 0, count: childUsers, color: '#A855F7' },
                { step: '4. Mod sarcină', pct: totalUsers > 0 ? Math.round((pregnantUsers / totalUsers) * 100) : 0, count: pregnantUsers, color: '#EC4899' },
                { step: '5. Premium', pct: totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0, count: premiumUsers, color: '#F59E0B' },
              ].map(s => (
                <div key={s.step} style={{ textAlign: 'center' }}>
                  <div style={{ height: 120, background: 'var(--surface2)', borderRadius: 8, display: 'flex', alignItems: 'flex-end', overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ width: '100%', background: s.color, height: `${s.pct}%`, borderRadius: '8px 8px 0 0', transition: 'height .6s' }} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.pct}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{s.step}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{s.count.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProgressRows({ rows, total }: { rows: Array<{ name: string; value: number; fill: string }>; total: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      {rows.map(row => {
        const pct = total > 0 ? (row.value / total) * 100 : 0;
        return (
          <div key={row.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text2)' }}>{row.name}</span>
              <span style={{ fontWeight: 700, color: row.fill }}>{row.value} ({pct.toFixed(0)}%)</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--border2)' }}>
              <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: row.fill, transition: 'width .6s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
