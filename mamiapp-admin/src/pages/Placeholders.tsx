// Placeholder pages for remaining sections
function ComingSoon({ icon, title, sub, items }: { icon: string; title: string; sub: string; items?: string[] }) {
  return (
    <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'var(--accent-soft)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 32, margin: '0 auto 20px',
        }}>{icon}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{title}</h2>
        <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>{sub}</p>
        {items && (
          <div style={{ textAlign: 'left', background: 'var(--surface)', borderRadius: 12, padding: 16 }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ color: 'var(--accent)' }}>→</span>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 20 }}>
          <span className="badge badge-purple" style={{ fontSize: 12, padding: '4px 12px' }}>🚧 În Construcție — Faza 2</span>
        </div>
      </div>
    </div>
  );
}

export function Children() {
  return <ComingSoon icon="👶" title="Copii & Sarcini"
    sub="Statistici agregate despre copiii și sarcinile înregistrate. Date anonimizate pentru suport și analiză."
    items={['Sarcini active pe săptămâni', 'Distribuție pe trimestre', 'Copii pe categorii de vârstă', 'Module cele mai folosite per vârstă']} />;
}
export function Content() {
  return <ComingSoon icon="📝" title="Management Conținut"
    sub="Administrare articole, ghiduri sarcină, activități, checklist-uri și conținut premium mapat pe LifeStage."
    items={['Articole & Ghiduri', 'Mapping pe săptămâni sarcină', 'Activități pe vârstă copil', 'Conținut Premium vs Free']} />;
}
export function Medical() {
  return <ComingSoon icon="🏥" title="Module Medicale"
    sub="Configurare calendar vaccinuri, milestone-uri de dezvoltare, grafice creștere și surse medicale."
    items={['Calendar vaccinare România (cu versionare)', 'Milestone-uri pe categorii', 'Grafice creștere WHO', 'Disclaimer medical & surse']} />;
}
export function Reports() {
  return <ComingSoon icon="📋" title="Rapoarte Generate"
    sub="Metadate despre rapoartele generate de AI pentru utilizatori. Acces la conținut necesită justificare."
    items={['Rapoarte medic', 'Rapoarte somn & diversificare', 'Cost AI per raport', 'Acces cu audit obligatoriu']} />;
}
export function Billing() {
  return <ComingSoon icon="💳" title="Abonamente & Plăți"
    sub="Gestionare planuri Premium, trial-uri, plăți și coduri promoționale prin RevenueCat."
    items={['Planuri Free / Premium Monthly / Yearly', 'Feature access per plan', 'Trial-uri active', 'Promo codes & discount-uri']} />;
}
export function Storage() {
  return <ComingSoon icon="💾" title="Documente & Storage"
    sub="Monitorizare spațiu folosit, documente încărcate și costuri Firebase Storage."
    items={['Total storage per utilizator', 'Documente suspecte', 'Fișiere eșuate']} />;
}
export function Support() {
  return <ComingSoon icon="🎧" title="Feedback & Suport"
    sub="Tickete suport, feedback aplicație, bug reports și contact utilizatori."
    items={['Tickete cu status & prioritate', 'Bug reports cu device info', 'Sugestii funcții', 'Răspuns direct utilizator']} />;
}
export function Analytics() {
  return <ComingSoon icon="📈" title="Analytics Produs"
    sub="Metrici detaliate: DAU/MAU, retenție D1/D7/D30, conversie Free→Premium, funnel onboarding."
    items={['Retenție zilnică & lunară', 'Modul care aduce retenție', 'Conversie Premium', 'Abandon onboarding']} />;
}
