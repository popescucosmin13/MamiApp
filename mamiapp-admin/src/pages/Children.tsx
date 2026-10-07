import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Baby, CalendarClock, HeartHandshake, RefreshCw, Sparkles, UsersRound } from 'lucide-react';
import { functions } from '../firebase';

type AgeGroup = { label: string; count: number; color: string };
type ChildRow = { id: string; name: string; owner: string; birthDate: string | null; active: boolean };
type PregnancyRow = { id: string; owner: string; currentWeek: number | null; dueDate: string | null; status: string };
type VaccineRow = { id: string; childName: string; owner: string; vaccineName: string; scheduledDate: string | null };

interface ChildrenOverview {
  totalChildren: number;
  activePregnancies: number;
  sharedFamilyMembers: number;
  ageGroups: AgeGroup[];
  recentChildren: ChildRow[];
  recentPregnancies: PregnancyRow[];
  upcomingVaccines: VaccineRow[];
}

const EMPTY: ChildrenOverview = {
  totalChildren: 0,
  activePregnancies: 0,
  sharedFamilyMembers: 0,
  ageGroups: [],
  recentChildren: [],
  recentPregnancies: [],
  upcomingVaccines: [],
};

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  return days < 0 ? 'depasit' : days === 0 ? 'astazi' : `in ${days} zile`;
}

export default function Children() {
  const [data, setData] = useState<ChildrenOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const getOverview = httpsCallable<Record<string, never>, ChildrenOverview>(functions, 'getAdminChildrenOverview');
      const result = await getOverview({});
      setData(result.data);
    } catch (cause) {
      console.error('Failed to load children overview', cause);
      setError('Nu am putut incarca sumarul. Reincearca in cateva secunde.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const knownAgeChildren = useMemo(() => data.ageGroups.reduce((sum, group) => sum + group.count, 0), [data.ageGroups]);
  const ageMax = Math.max(...data.ageGroups.map((group) => group.count), 1);

  return (
    <div className="admin-page children-page fade-in">
      <div className="ops-hero children-hero">
        <div>
          <div className="page-kicker">MamiApp admin</div>
          <h1>Copii & sarcini</h1>
          <p>O vedere de ansamblu clara: copii, sarcini active, vaccinuri apropiate si distributia pe varste.</p>
        </div>
        <div className="hero-actions">
          <div className="children-cache-chip"><Sparkles size={15} /> sumar cache: max. 2 minute</div>
          <button className="btn btn-ghost" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw size={15} /> {refreshing ? 'Se actualizeaza...' : 'Actualizeaza'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-shell"><div className="spinner" /><div><h2>Se pregateste sumarul...</h2><p>Fara parcurgerea tuturor familiilor din browser.</p></div></div>
      ) : error ? (
        <div className="children-error"><strong>Sumarul nu este disponibil.</strong><span>{error}</span><button className="btn btn-ghost btn-sm" onClick={() => void load(true)}>Reincearca</button></div>
      ) : (
        <>
          <section className="children-summary-grid" aria-label="Indicatori copii si sarcini">
            <div className="children-stat"><div className="children-stat-icon blue"><Baby size={20} /></div><div><strong>{data.totalChildren.toLocaleString()}</strong><span>copii inregistrati</span></div></div>
            <div className="children-stat"><div className="children-stat-icon pink"><UsersRound size={20} /></div><div><strong>{data.activePregnancies.toLocaleString()}</strong><span>sarcini active</span></div></div>
            <div className="children-stat"><div className="children-stat-icon green"><HeartHandshake size={20} /></div><div><strong>{data.sharedFamilyMembers.toLocaleString()}</strong><span>membri familie activi</span></div></div>
            <div className={`children-stat ${data.upcomingVaccines.length ? 'attention' : ''}`}><div className="children-stat-icon amber"><CalendarClock size={20} /></div><div><strong>{data.upcomingVaccines.length.toLocaleString()}</strong><span>vaccinuri in urmatoarele 60 zile</span></div></div>
          </section>

          <div className="children-main-grid">
            <section className="ops-card">
              <div className="card-heading"><div><h2>Varsta copiilor</h2><p>{knownAgeChildren} copii cu data nasterii completata.</p></div><span className="badge badge-blue">date cunoscute</span></div>
              <div className="children-age-list">
                {data.ageGroups.map((group) => (
                  <div className="children-age-row" key={group.label}>
                    <div><span style={{ background: group.color }} /><strong>{group.label}</strong></div>
                    <div className="children-age-track"><i style={{ width: `${Math.max(group.count ? 5 : 0, (group.count / ageMax) * 100)}%`, background: group.color }} /></div>
                    <b>{group.count}</b>
                  </div>
                ))}
              </div>
            </section>

            <section className="ops-card children-note-card">
              <div className="card-heading"><div><h2>Semnale rapide</h2><p>Lucrurile care merita urmarite azi.</p></div></div>
              <div className="children-signal"><span className={data.upcomingVaccines.length ? 'signal-dot amber' : 'signal-dot green'} /> <div><strong>{data.upcomingVaccines.length ? `${data.upcomingVaccines.length} vaccinuri apropiate` : 'Niciun vaccin apropiat'}</strong><small>{data.upcomingVaccines.length ? 'Verifica programarile din urmatoarele 60 zile.' : 'Nu exista programari de urmarit in interval.'}</small></div></div>
              <div className="children-signal"><span className="signal-dot pink" /> <div><strong>{data.activePregnancies} sarcini active</strong><small>Urmarirea detaliata ramane in dossierul fiecarui utilizator.</small></div></div>
              <div className="children-signal"><span className="signal-dot blue" /> <div><strong>{knownAgeChildren} copii clasificati</strong><small>{data.totalChildren - knownAgeChildren > 0 ? `${data.totalChildren - knownAgeChildren} fara data nasterii completa.` : 'Toate varstele sunt disponibile.'}</small></div></div>
            </section>
          </div>

          <div className="children-content-grid">
            <section className="ops-card">
              <div className="card-heading"><div><h2>Copii cu date recente</h2><p>Cei mai mici copii cu data nasterii salvata.</p></div></div>
              {data.recentChildren.length === 0 ? <div className="empty-block">Nu exista copii cu date disponibile.</div> : <div className="children-list">
                {data.recentChildren.map((child) => <div className="children-person-row" key={child.id}><div className="children-avatar blue"><Baby size={16} /></div><div><strong>{child.name}</strong><span>{child.owner} · nascut {formatDate(child.birthDate)}</span></div>{child.active && <span className="badge badge-green">activ</span>}</div>)}
              </div>}
            </section>

            <section className="ops-card">
              <div className="card-heading"><div><h2>Sarcini active</h2><p>Ordonate dupa termenul estimat.</p></div></div>
              {data.recentPregnancies.length === 0 ? <div className="empty-block">Nu exista sarcini active cu termen salvat.</div> : <div className="children-list">
                {data.recentPregnancies.map((pregnancy) => <div className="children-person-row" key={`${pregnancy.owner}-${pregnancy.id}`}><div className="children-avatar pink"><Sparkles size={16} /></div><div><strong>{pregnancy.owner}</strong><span>{pregnancy.currentWeek ? `Saptamana ${pregnancy.currentWeek}` : 'Saptamana necompletata'} · termen {formatDate(pregnancy.dueDate)}</span></div><span className="badge badge-purple">{pregnancy.status}</span></div>)}
              </div>}
            </section>
          </div>

          <section className="ops-card">
            <div className="card-heading"><div><h2>Vaccinuri de urmarit</h2><p>Programari neadministrate, in urmatoarele 60 zile.</p></div><span className={`badge ${data.upcomingVaccines.length ? 'badge-yellow' : 'badge-green'}`}>{data.upcomingVaccines.length}</span></div>
            {data.upcomingVaccines.length === 0 ? <div className="empty-block">Nu exista vaccinuri de urmarit in urmatoarele 60 zile.</div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Copil</th><th>Parinte</th><th>Vaccin</th><th>Programat</th><th>Termen</th></tr></thead><tbody>
              {data.upcomingVaccines.map((vaccine) => <tr key={vaccine.id}><td><strong>{vaccine.childName}</strong></td><td>{vaccine.owner}</td><td>{vaccine.vaccineName}</td><td>{formatDate(vaccine.scheduledDate)}</td><td><span className={`badge ${daysUntil(vaccine.scheduledDate) === 'depasit' ? 'badge-red' : 'badge-yellow'}`}>{daysUntil(vaccine.scheduledDate)}</span></td></tr>)}
            </tbody></table></div>}
          </section>
        </>
      )}
    </div>
  );
}
