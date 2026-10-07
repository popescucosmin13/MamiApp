// src/pages/Medical.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from "../lib/toast";
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

interface VaccineDose {
  doseIndex: number;
  ageMonths: number;
  ageLabel: string;
}

interface VaccineMaster {
  id: string;
  key: string;
  name: string;
  ageGroup: string;
  ageMonths: number;
  type: 'mandatory' | 'recommended';
  mandatory: boolean;
  description: string;
  sideEffects: string[];
  doses: VaccineDose[];
}

interface MilestoneMaster {
  id: string;
  key?: string;
  title?: string;
  title_ro?: string;
  description?: string;
  expectedAge?: number;
  expectedAgeMonths?: number;
  ageMonths?: number;
  category: string;
  howToStimulate?: string[];
  redFlag?: boolean;
}

type Tab = 'vaccines' | 'milestones';

const VACCINES_2026 = [
  { name: 'Hep B (Hepatită B)', ageMonths: 0, type: 'mandatory', description: 'În maternitate, primele 24 ore.' },
  { name: 'BCG (Tuberculoză)', ageMonths: 0, type: 'mandatory', description: 'În maternitate, zilele 2-7.' },
  { name: 'Hexavalent (DTPa-VPI-Hib-Hep B)', ageMonths: 2, type: 'mandatory', description: 'Doza 1 (Difterie, tetanos, tuse convulsivă, polio, hib, hepatită B)' },
  { name: 'Pneumococic', ageMonths: 2, type: 'mandatory', description: 'Doza 1' },
  { name: 'Rotavirus', ageMonths: 2, type: 'recommended', description: 'Doza 1 (opțional)' },
  { name: 'Hexavalent (DTPa-VPI-Hib-Hep B)', ageMonths: 4, type: 'mandatory', description: 'Doza 2' },
  { name: 'Pneumococic', ageMonths: 4, type: 'mandatory', description: 'Doza 2' },
  { name: 'Rotavirus', ageMonths: 4, type: 'recommended', description: 'Doza 2 (opțional)' },
  { name: 'Hexavalent (DTPa-VPI-Hib-Hep B)', ageMonths: 11, type: 'mandatory', description: 'Doza 3' },
  { name: 'Pneumococic', ageMonths: 11, type: 'mandatory', description: 'Doza 3' },
  { name: 'ROR (Rujeolă, Oreion, Rubeolă)', ageMonths: 12, type: 'mandatory', description: 'Doza 1' },
  { name: 'Varicelă', ageMonths: 12, type: 'recommended', description: 'Opțional' },
  { name: 'Meningococic', ageMonths: 12, type: 'recommended', description: 'Opțional' },
  { name: 'Hepatita A', ageMonths: 12, type: 'recommended', description: 'Opțional' },
  { name: 'ROR (Rujeolă, Oreion, Rubeolă)', ageMonths: 60, type: 'mandatory', description: 'Doza 2 (la 5 ani)' },
  { name: 'Tetravalent (DTPa-VPI)', ageMonths: 72, type: 'mandatory', description: 'Rapel (la 6 ani)' },
  { name: 'dTaP (Difterie, tetanos, tuse convulsivă)', ageMonths: 168, type: 'mandatory', description: 'Rapel (la 14 ani)' },
  { name: 'HPV', ageMonths: 132, type: 'recommended', description: 'Opțional (între 11-14 ani)' },
];

const emptyVaccine = {
  key: '',
  name: '',
  ageGroup: '',
  ageMonths: '0',
  type: 'mandatory',
  description: '',
  sideEffects: '',
  doses: '0:naștere',
};

const emptyMilestone = {
  key: '',
  title: '',
  ageMonths: '0',
  category: '',
  description: '',
  howToStimulate: '',
  redFlag: false,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseDoses(raw: string): VaccineDose[] {
  return raw
    .split('\n')
    .map((line, index) => {
      const [monthsRaw, labelRaw] = line.split(':');
      const ageMonths = Number(monthsRaw?.trim());
      if (Number.isNaN(ageMonths)) return null;
      return {
        doseIndex: index,
        ageMonths,
        ageLabel: labelRaw?.trim() || (ageMonths === 0 ? 'naștere' : `${ageMonths} luni`),
      };
    })
    .filter(Boolean) as VaccineDose[];
}

function closeFocusedElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export default function Medical() {
  const [tab, setTab] = useState<Tab>('vaccines');
  const [vaccines, setVaccines] = useState<VaccineMaster[]>([]);
  const [milestones, setMilestones] = useState<MilestoneMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vaccineForm, setVaccineForm] = useState(emptyVaccine);
  const [milestoneForm, setMilestoneForm] = useState(emptyMilestone);
  const modalRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vSnap, mSnap] = await Promise.all([
        getDocs(collection(db, 'vaccines_master')),
        getDocs(collection(db, 'milestones_master')),
      ]);
      setVaccines(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as VaccineMaster)));
      setMilestones(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as MilestoneMaster)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!showForm) return;
    setTimeout(() => modalRef.current?.focus(), 0);
  }, [showForm]);

  const closeForm = () => {
    closeFocusedElement();
    setShowForm(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === 'vaccines') {
        const key = vaccineForm.key.trim() || slugify(vaccineForm.name);
        const doses = parseDoses(vaccineForm.doses);
        const ageMonths = Number(vaccineForm.ageMonths);
        const primaryAge = doses[0]?.ageMonths ?? ageMonths;
        const primaryLabel = vaccineForm.ageGroup.trim() || doses[0]?.ageLabel || (primaryAge === 0 ? 'naștere' : `${primaryAge} luni`);
        await addDoc(collection(db, 'vaccines_master'), {
          key,
          vaccineId: key,
          name: vaccineForm.name.trim(),
          type: vaccineForm.type,
          mandatory: vaccineForm.type === 'mandatory',
          ageGroup: primaryLabel,
          ageMonths: primaryAge,
          description: vaccineForm.description.trim(),
          sideEffects: vaccineForm.sideEffects.split('\n').map(s => s.trim()).filter(Boolean),
          doses: doses.length > 0 ? doses : [{ doseIndex: 0, ageMonths: primaryAge, ageLabel: primaryLabel }],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setVaccineForm(emptyVaccine);
      } else {
        const key = milestoneForm.key.trim() || slugify(milestoneForm.title);
        const ageMonths = Number(milestoneForm.ageMonths);
        await addDoc(collection(db, 'milestones_master'), {
          key,
          title: milestoneForm.title.trim(),
          title_ro: milestoneForm.title.trim(),
          ageMonths,
          expectedAge: ageMonths,
          expectedAgeMonths: ageMonths,
          category: milestoneForm.category,
          description: milestoneForm.description.trim(),
          howToStimulate: milestoneForm.howToStimulate.split('\n').map(s => s.trim()).filter(Boolean),
          redFlag: milestoneForm.redFlag,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setMilestoneForm(emptyMilestone);
      }
      closeForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const populateDefaults = async () => {
    if (!confirm('Vrei să adaugi automat calendarul oficial de vaccinare din România (2026)?')) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      VACCINES_2026.forEach(v => {
        const ref = doc(collection(db, 'vaccines_master'));
        const key = slugify(v.name) + '_' + v.ageMonths;
        batch.set(ref, {
          key,
          vaccineId: key,
          name: v.name,
          type: v.type,
          mandatory: v.type === 'mandatory',
          ageGroup: v.ageMonths === 0 ? 'la naștere' : `${v.ageMonths} luni`,
          ageMonths: v.ageMonths,
          description: v.description,
          sideEffects: [],
          doses: [{ doseIndex: 0, ageMonths: v.ageMonths, ageLabel: v.ageMonths === 0 ? 'naștere' : `${v.ageMonths} luni` }],
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
      toast.success('Calendarul a fost adăugat cu succes!');
      await loadData();
    } catch (e) {
      console.error('Error populating:', e);
      toast.error('Eroare la populare.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, colName: string) => {
    if (!confirm('Ești sigur că vrei să ștergi?')) return;
    await deleteDoc(doc(db, colName, id));
    await loadData();
  };

  const sortedVaccines = useMemo(() => [...vaccines].sort((a, b) => (a.ageMonths ?? 0) - (b.ageMonths ?? 0)), [vaccines]);
  const sortedMilestones = useMemo(() => [...milestones].sort((a, b) => (a.expectedAgeMonths ?? a.expectedAge ?? a.ageMonths ?? 0) - (b.expectedAgeMonths ?? b.expectedAge ?? b.ageMonths ?? 0)), [milestones]);

  return (
    <div style={{ padding: 24, maxWidth: 1200 }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Module Medicale</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>Date master folosite direct de aplicația mobilă.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'vaccines' && (
            <button className="btn" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 13 }} onClick={populateDefaults} disabled={saving}>
              🤖 Populează Calendar 2026
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>＋ Adaugă</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['vaccines', 'milestones'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'btn btn-primary' : 'btn'} style={{ fontSize: 13 }}>
            {t === 'vaccines' ? 'Vaccinuri' : 'Milestone-uri'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>
          {tab === 'vaccines' ? `${vaccines.length} intrări` : `${milestones.length} intrări`}
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>Vârstă</th>
                {tab === 'vaccines' ? (
                  <>
                    <th style={th}>Key</th>
                    <th style={th}>Vaccin</th>
                    <th style={th}>Tip</th>
                    <th style={th}>Doze</th>
                    <th style={th}>Reacții</th>
                  </>
                ) : (
                  <>
                    <th style={th}>Key</th>
                    <th style={th}>Milestone</th>
                    <th style={th}>Categorie</th>
                    <th style={th}>Red flag</th>
                  </>
                )}
                <th style={th}>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {tab === 'vaccines' ? sortedVaccines.map((v, i) => (
                <tr key={v.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                  <td style={td}><span className="badge badge-purple">{v.ageGroup || (v.ageMonths === 0 ? 'La naștere' : `${v.ageMonths} luni`)}</span></td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{v.key || v.id}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{v.name}<div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{v.description || '—'}</div></td>
                  <td style={td}><span className={`badge ${v.type === 'mandatory' || v.mandatory ? 'badge-green' : 'badge-gray'}`}>{v.type === 'mandatory' || v.mandatory ? 'Obligatoriu' : 'Recomandat'}</span></td>
                  <td style={{ ...td, fontSize: 12 }}>{(v.doses || []).map(d => d.ageLabel || `${d.ageMonths} luni`).join(', ') || '—'}</td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{(v.sideEffects || []).join(', ') || '—'}</td>
                  <td style={td}><button className="btn" style={dangerBtn} onClick={() => handleDelete(v.id, 'vaccines_master')}>Șterge</button></td>
                </tr>
              )) : sortedMilestones.map((m, i) => {
                const age = m.expectedAgeMonths ?? m.expectedAge ?? m.ageMonths ?? 0;
                return (
                  <tr key={m.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
                    <td style={td}><span className="badge badge-blue">{age} luni</span></td>
                    <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{m.key || m.id}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{m.title_ro || m.title}<div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{m.description || '—'}</div></td>
                    <td style={td}><span className="badge badge-gray">{m.category}</span></td>
                    <td style={td}>{m.redFlag ? 'Da' : 'Nu'}</td>
                    <td style={td}><button className="btn" style={dangerBtn} onClick={() => handleDelete(m.id, 'milestones_master')}>Șterge</button></td>
                  </tr>
                );
              })}
              {(tab === 'vaccines' ? sortedVaccines : sortedMilestones).length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Nu există date.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onMouseDown={e => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div ref={modalRef} tabIndex={-1} className="card" style={{ width: 640, padding: 24, maxHeight: '90vh', overflowY: 'auto', outline: 'none' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>{tab === 'vaccines' ? 'Adaugă Vaccin' : 'Adaugă Milestone'}</h3>
            {tab === 'vaccines' ? (
              <VaccineForm form={vaccineForm} setForm={setVaccineForm} />
            ) : (
              <MilestoneForm form={milestoneForm} setForm={setMilestoneForm} />
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn" onClick={closeForm} style={{ flex: 1 }}>Anulează</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Se salvează...' : 'Salvează'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VaccineForm({ form, setForm }: { form: typeof emptyVaccine; setForm: React.Dispatch<React.SetStateAction<typeof emptyVaccine>> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Key / ID vaccin"><input className="input" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} placeholder="ex: ror" /></Field>
        <Field label="Nume vaccin *"><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ex: ROR" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field label="Vârstă principală (luni)"><input className="input" type="number" value={form.ageMonths} onChange={e => setForm({ ...form, ageMonths: e.target.value })} /></Field>
        <Field label="Etichetă vârstă"><input className="input" value={form.ageGroup} onChange={e => setForm({ ...form, ageGroup: e.target.value })} placeholder="ex: 12 luni" /></Field>
        <Field label="Tip"><select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="mandatory">Obligatoriu</option><option value="recommended">Recomandat</option></select></Field>
      </div>
      <Field label="Descriere"><textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: 70, resize: 'vertical' }} /></Field>
      <Field label="Doze, câte una pe linie: luni:etichetă"><textarea className="input" value={form.doses} onChange={e => setForm({ ...form, doses: e.target.value })} placeholder={'0:naștere\n2:2 luni\n4:4 luni'} style={{ minHeight: 90, resize: 'vertical', fontFamily: 'monospace' }} /></Field>
      <Field label="Reacții posibile, câte una pe linie"><textarea className="input" value={form.sideEffects} onChange={e => setForm({ ...form, sideEffects: e.target.value })} style={{ minHeight: 80, resize: 'vertical' }} /></Field>
    </div>
  );
}

function MilestoneForm({ form, setForm }: { form: typeof emptyMilestone; setForm: React.Dispatch<React.SetStateAction<typeof emptyMilestone>> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Key / ID"><input className="input" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} placeholder="ex: merge_singur" /></Field>
        <Field label="Titlu *"><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Vârstă așteptată (luni)"><input className="input" type="number" value={form.ageMonths} onChange={e => setForm({ ...form, ageMonths: e.target.value })} /></Field>
        <Field label="Categorie"><select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="">Selectează...</option><option value="motor">Motor</option><option value="language">Limbaj</option><option value="social">Social</option><option value="cognitive">Cognitiv</option><option value="emotional">Emoțional</option></select></Field>
      </div>
      <Field label="Descriere"><textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: 70, resize: 'vertical' }} /></Field>
      <Field label="Cum poate fi stimulat, câte o idee pe linie"><textarea className="input" value={form.howToStimulate} onChange={e => setForm({ ...form, howToStimulate: e.target.value })} style={{ minHeight: 80, resize: 'vertical' }} /></Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={form.redFlag} onChange={e => setForm({ ...form, redFlag: e.target.checked })} /> Red flag dacă nu este atins la timp</label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: 'var(--text)' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 };
const dangerBtn: React.CSSProperties = { fontSize: 11, padding: '4px 10px', color: 'var(--danger)', borderColor: 'var(--danger)' };
