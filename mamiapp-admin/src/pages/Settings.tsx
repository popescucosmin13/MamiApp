// src/pages/Settings.tsx — Configurare globală aplicație
import { useEffect, useState } from 'react';
import { toast } from "../lib/toast";
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logAudit } from '../lib/utils';
import type { AppConfig } from '../types';

const DEFAULT: AppConfig = {
  maintenanceMode: false,
  maintenanceMessage: 'Lucrăm la o actualizare. Unele funcții pot fi indisponibile temporar.',
  minAppVersion: '1.0.0',
  latestAndroidBuild: 0,
  forceUpdateBelowBuild: 0,
  updateMessage: '',
  aiLimitFreePerDay: 50,
  aiLimitBasicPerDay: 50,
  aiLimitPremiumPerDay: 500,
  aiLimitsByPlan: {
    free: 10,
    basic: 50,
    premium: 500,
  },
  storageLimitFreeMb: 100,
  storageLimitPremiumMb: 1000,
  supportEmail: 'suport@example.com',
  availableCountries: ['RO'],
};

export default function Settings() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const aiLimits = {
    free: Number(config.aiLimitsByPlan?.free ?? config.aiLimitFreePerDay ?? 10),
    basic: Number(config.aiLimitsByPlan?.basic ?? config.aiLimitBasicPerDay ?? config.aiLimitFreePerDay ?? 50),
    premium: Number(config.aiLimitsByPlan?.premium ?? config.aiLimitPremiumPerDay ?? 500),
  };

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'appConfig', 'global'));
        if (snap.exists()) setConfig({ ...DEFAULT, ...snap.data() as AppConfig });
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'appConfig', 'global'), {
        ...config,
        aiLimitFreePerDay: aiLimits.free,
        aiLimitBasicPerDay: aiLimits.basic,
        aiLimitPremiumPerDay: aiLimits.premium,
        aiLimitsByPlan: aiLimits,
        updatedAt: serverTimestamp(),
      });
      await logAudit('update_app_config', 'app_config', 'global', 'Configurație globală actualizată');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { toast.error('Eroare la salvare.'); }
    setSaving(false);
  };

  const Field = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 20 }}>{children}</div>
    </div>
  );

  const setAiLimit = (plan: 'free' | 'basic' | 'premium', value: number) => {
    const nextValue = Math.max(0, Number.isFinite(value) ? value : 0);
    setConfig(p => ({
      ...p,
      aiLimitFreePerDay: plan === 'free' ? nextValue : p.aiLimitFreePerDay,
      aiLimitBasicPerDay: plan === 'basic' ? nextValue : p.aiLimitBasicPerDay,
      aiLimitPremiumPerDay: plan === 'premium' ? nextValue : p.aiLimitPremiumPerDay,
      aiLimitsByPlan: {
        free: aiLimits.free,
        basic: aiLimits.basic,
        premium: aiLimits.premium,
        ...p.aiLimitsByPlan,
        [plan]: nextValue,
      },
    }));
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

  return (
    <div style={{ padding: 24, maxWidth: 800 }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>⚙️ Setări Aplicație</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>Configurație globală MamiApp</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Se salvează...' : saved ? '✅ Salvat!' : '💾 Salvează'}
        </button>
      </div>

      {/* Maintenance */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">🚧 Mentenanță</div>
        <Field label="Mod Mentenanță" desc="Utilizatorii văd un banner de mentenanță">
          <button
            onClick={() => setConfig(p => ({ ...p, maintenanceMode: !p.maintenanceMode }))}
            style={{
              width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: config.maintenanceMode ? 'var(--danger)' : 'var(--border2)',
              position: 'relative', transition: 'background .2s',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3, left: config.maintenanceMode ? 23 : 3,
              transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)',
            }} />
          </button>
        </Field>
        <Field label="Mesaj mentenanță" desc="Afișat în aplicație când modul mentenanță e activ">
          <input
            className="input" style={{ width: 300, fontSize: 12 }}
            value={config.maintenanceMessage}
            onChange={e => setConfig(p => ({ ...p, maintenanceMessage: e.target.value }))}
          />
        </Field>
        <Field label="Versiune minimă aplicație" desc="Utilizatorii cu versiune mai veche sunt rugați să actualizeze">
          <input
            className="input" style={{ width: 100, fontSize: 12 }}
            value={config.minAppVersion}
            onChange={e => setConfig(p => ({ ...p, minAppVersion: e.target.value }))}
          />
        </Field>
      </div>

      {/* Android Update */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">🔄 Actualizare Android</div>
        <Field label="Ultimul build publicat (versionCode)" desc="Utilizatorii cu build mai mic văd popup-ul de actualizare (cu buton «Mai târziu»). 0 = dezactivat.">
          <input type="number" className="input" style={{ width: 100 }} min={0}
            value={config.latestAndroidBuild ?? 0}
            onChange={e => setConfig(p => ({ ...p, latestAndroidBuild: Math.max(0, Number(e.target.value) || 0) }))} />
        </Field>
        <Field label="Build minim obligatoriu" desc="Build-urile SUB acest versionCode sunt blocate până actualizează (fără «Mai târziu»). 0 = dezactivat. Folosește cu grijă!">
          <input type="number" className="input" style={{ width: 100 }} min={0}
            value={config.forceUpdateBelowBuild ?? 0}
            onChange={e => setConfig(p => ({ ...p, forceUpdateBelowBuild: Math.max(0, Number(e.target.value) || 0) }))} />
        </Field>
        <Field label="Mesaj custom (opțional)" desc="Înlocuiește textul standard din popup-ul de actualizare">
          <input className="input" style={{ width: 300, fontSize: 12 }}
            placeholder="ex: Am adăugat modulul de somn îmbunătățit!"
            value={config.updateMessage ?? ''}
            onChange={e => setConfig(p => ({ ...p, updateMessage: e.target.value }))} />
        </Field>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
          versionCode-ul curent îl găsești în app.json → expo.android.versionCode (la fiecare release EAS crește).
          Popup-ul apare doar pe Android nativ, nu pe PWA.
        </div>
      </div>

      {/* AI Limits */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">🤖 Limite AI</div>
        <Field label="Cereri AI / zi (Free)" desc="Maxim intrebari/chat per utilizator free pe zi">
          <input type="number" className="input" style={{ width: 80 }} min={0} max={100}
            value={aiLimits.free}
            onChange={e => setAiLimit('free', Number(e.target.value))} />
        </Field>
        <Field label="Cereri AI / zi (Basic)" desc="Maxim intrebari/chat per utilizator basic pe zi">
          <input type="number" className="input" style={{ width: 80 }} min={0} max={1000}
            value={aiLimits.basic}
            onChange={e => setAiLimit('basic', Number(e.target.value))} />
        </Field>
        <Field label="Cereri AI / zi (Premium)" desc="Maxim intrebari/chat per utilizator premium pe zi">
          <input type="number" className="input" style={{ width: 80 }} min={0} max={1000}
            value={aiLimits.premium}
            onChange={e => setAiLimit('premium', Number(e.target.value))} />
        </Field>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>
          askAI foloseste aceste limite pe nivel. Daca setezi AI / zi in Billing pentru Basic/Premium, acesta ramane fallback cand aici nu exista o valoare salvata.
        </div>
      </div>

      {/* Storage */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">💾 Limite Storage</div>
        <Field label="Storage Free (MB)">
          <input type="number" className="input" style={{ width: 100 }} min={0}
            value={config.storageLimitFreeMb}
            onChange={e => setConfig(p => ({ ...p, storageLimitFreeMb: Number(e.target.value) }))} />
        </Field>
        <Field label="Storage Premium (MB)">
          <input type="number" className="input" style={{ width: 100 }} min={0}
            value={config.storageLimitPremiumMb}
            onChange={e => setConfig(p => ({ ...p, storageLimitPremiumMb: Number(e.target.value) }))} />
        </Field>
      </div>

      {/* Contact */}
      <div className="card">
        <div className="section-title">📧 Contact & Suport</div>
        <Field label="Email suport" desc="Afișat în aplicație și în notificări">
          <input className="input" style={{ width: 220, fontSize: 12 }}
            value={config.supportEmail}
            onChange={e => setConfig(p => ({ ...p, supportEmail: e.target.value }))} />
        </Field>
      </div>
    </div>
  );
}
