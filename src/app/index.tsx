import { createElement, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

/**
 * Landing page (web only).
 *
 * On native (Google Play / iOS build) this screen renders nothing and immediately
 * redirects into the app — the marketing page never ships inside the installed app.
 * On web it renders a self-contained, bilingual (EN default / RO) landing page.
 */

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.example.mamiapp';
const WEB_APP_URL = 'https://example.com';

/**
 * Resolves a Metro asset module to a URI on web.
 * On Expo web, `require('img.png')` yields a string or an object with `uri`
 * (Image.resolveAssetSource does not exist on react-native-web).
 */
function webAssetUri(mod: unknown): string {
  if (typeof mod === 'string') return mod;
  if (mod && typeof mod === 'object') {
    const source = mod as { uri?: unknown; default?: unknown };
    if (typeof source.uri === 'string') return source.uri;
    if (typeof source.default === 'string') return source.default;
  }
  return '';
}

const PLAY_BADGE_URI = Platform.OS === 'web' ? webAssetUri(require('../../assets/google-play-logo.png')) : '';
const BRAND_LOGO_URI = Platform.OS === 'web' ? webAssetUri(require('../../assets/icon.png')) : '';

// ---------------------------------------------------------------------------
// Translations (English is the default)
// ---------------------------------------------------------------------------
const I18N: Record<string, Record<string, string>> = {
  en: {
    'nav.features': 'Features',
    'nav.ai': 'Assistant',
    'nav.get': 'Download',
    'nav.faq': 'FAQ',
    'nav.login': 'Log in',
    'nav.cta': 'Get the app',

    'hero.pill': 'Pregnancy & the first 5 years',
    'hero.title_a': 'The calmest way to raise',
    'hero.title_b': 'your little one',
    'hero.sub': 'Track pregnancy and your baby’s first five years in one gentle app — feeding, sleep, growth, vaccines and milestones, plus an assistant that answers at 3 a.m. and a community that gets it.',
    'hero.cta': 'Download free',
    'hero.cta_note': 'Free · Android on Google Play · iPhone web app',
    'hero.login': 'I already have an account →',
    'hero.proof': 'Loved by mothers across Romania',
    'auth.create_account_btn': 'Create Account',

    'stat.modules': 'thoughtful modules',
    'stat.years': 'years, one app',
    'stat.offline': 'works offline',

    'std.title': 'Guidance rooted in sources you already trust',
    'std.who': 'growth percentiles',
    'std.aap': 'sleep & feeding',
    'std.cdc': 'milestones',
    'std.insp': 'vaccination schedule',

    'val.eyebrow': 'Why mothers stay',
    'val.title': 'Less worry. More of the good part.',
    'val.sub': 'MamiApp quietly does the remembering, so you can be present.',
    'v1.t': 'Everything in one place',
    'v1.d': 'No more juggling five apps and a notebook. Pregnancy and baby, side by side.',
    'v2.t': 'Answers when you need them',
    'v2.d': 'A caring assistant and a real community — for the questions Google makes scarier.',
    'v3.t': 'Never miss what matters',
    'v3.d': 'Gentle reminders for vaccines, appointments and milestones, right on time.',

    'paths.eyebrow': 'Two chapters, one app',
    'paths.title': 'Whether you’re expecting or already holding them',
    'paths.sub': 'MamiApp reads the moment you’re in — and moves with you from bump to toddler, all on its own.',
    'paths.preg_tag': 'Pregnancy',
    'paths.preg_h': 'A calm companion for all 40 weeks',
    'paths.preg1': 'Contraction timer with the 5-1-1 rule and a history you can show your doctor',
    'paths.preg2': 'Kick counter and fetal-movement log',
    'paths.preg3': 'Weight tracking with healthy-range guidance',
    'paths.preg4': 'Appointments, questions for the doctor and documents in one folder',
    'paths.preg5': 'Interactive hospital-bag checklist and a personal birth plan',
    'paths.baby_tag': 'Baby · 0–5 years',
    'paths.baby_h': 'Every little milestone, gently kept',
    'paths.baby1': 'Feeding, sleep and diapers with patterns that actually make sense',
    'paths.baby2': 'Growth charts on WHO percentiles',
    'paths.baby3': 'Vaccine calendar with reminders (INSP)',
    'paths.baby4': 'Developmental milestones guided by the CDC',
    'paths.baby5': 'Solids diary, teething, activities and school',

    'feat.eyebrow': 'Everything you need',
    'feat.title': 'One app instead of a drawer full of them',
    'feat.sub': 'More than twenty modules, each designed with care — and they grow up right alongside your child.',
    'f1.t': 'Feeding',
    'f1.d': 'Breastfeeding timer per side, bottle (breast milk or formula) and first solid meals.',
    'f2.t': 'Sleep & coaching',
    'f2.d': 'Log naps, uncover the rhythm and follow gentle, age-appropriate sleep methods.',
    'f3.t': 'Diapers',
    'f3.d': 'A quick tap keeps an eye on hydration and digestion.',
    'f4.t': 'Growth',
    'f4.d': 'Weight, height and head circumference on automatic WHO percentile charts.',
    'f5.t': 'Vaccines',
    'f5.d': 'The full INSP schedule, with reminders for what’s coming and what’s done.',
    'f6.t': 'Milestones',
    'f6.d': 'First smile, first steps, motor and cognitive progress — guided by the CDC.',
    'f7.t': 'Solids & nutrition',
    'f7.d': 'A diary of new foods, allergic reactions and balanced meal ideas.',
    'f8.t': 'Teething',
    'f8.d': 'Note the order teeth appear and follow the little dental calendar.',
    'f9.t': 'Activities',
    'f9.d': 'Age-fit play ideas that wake up the senses, movement and emotions.',
    'f10.t': 'Wellbeing & emotions',
    'f10.d': 'Breathing exercises, postnatal mood screening and a journal — for you.',
    'f11.t': 'Medical documents',
    'f11.d': 'A secure digital folder for analyses, prescriptions and ultrasounds.',
    'f12.t': 'Emergency',
    'f12.d': 'Offline first-aid essentials and one-tap calling for 112 and your pediatrician.',

    'ai.eyebrow': 'The assistant',
    'ai.title': 'Answers at 3 a.m., without the spiral',
    'ai.sub': 'A warm, well-read assistant that understands your child’s context — and always points you to a doctor when it truly matters.',
    'ai1': 'Personalised to your baby’s age and the things you track',
    'ai2': 'Grounded in AAP and WHO recommendations',
    'ai3': 'Short, calm replies made for reading half-asleep',
    'ai.q': 'My 6-month-old won’t nap longer than 30 minutes. Is that normal?',
    'ai.a': 'At six months short naps are very common as sleep cycles mature. Try a consistent wind-down and watch for sleepy cues around 2–2.5h of awake time. If naps stay very short and baby seems tired or fussy, mention it at the next check-up. 💛',
    'ai.typing': 'the assistant is typing…',

    'why.eyebrow': 'Made to be trusted',
    'why.title': 'Built around you and your little one',
    'p1.t': 'Private by design',
    'p1.d': 'Your data is yours. Export it or delete everything, any time (GDPR).',
    'p2.t': 'Works offline',
    'p2.d': 'Log a feed on a plane or out in the countryside — it syncs when you’re back.',
    'p3.t': 'Share with family',
    'p3.d': 'Invite your partner or the grandparents with fine-grained permissions.',
    'p4.t': 'A warm community',
    'p4.d': 'Trade experiences and quiet reassurance with other mothers.',

    'plat.eyebrow': 'Get MamiApp',
    'plat.title': 'On Android, and on iPhone',
    'plat.sub': 'A native app on Google Play, and a full-screen web app on iOS — no App Store needed.',
    'plat.and_h': 'Android',
    'plat.and_s': 'Native app · Google Play',
    'plat.and1': 'Tap the button below to open Google Play.',
    'plat.and2': 'Install MamiApp like any other app.',
    'plat.and3': 'Create an account in seconds and choose your mode.',
    'plat.and_note': 'Free to download — no card needed.',
    'plat.and_cta': 'Get it on Google Play',
    'plat.chip_offline': 'Works offline',
    'plat.chip_secure': 'Private & secure',
    'plat.chip_family': 'Family sharing',
    'plat.ios_h': 'iPhone & iPad',
    'plat.ios_s': 'Web app · Add to Home Screen',
    'plat.ios1': 'Open example.com in Safari (on iPhone it must be Safari, not Chrome).',
    'plat.ios2': 'Tap the Share button — the square with an up-arrow — in Safari’s toolbar.',
    'plat.ios3': 'Scroll down the menu and tap “Add to Home Screen”.',
    'plat.ios4': 'Tap “Add” — MamiApp lands on your home screen and opens full-screen.',
    'plat.ios_note': 'On iPhone the Share button sits at the bottom of the screen; on iPad it’s at the top-right.',
    'plat.ios_cta': 'Open example.com',

    'faq.eyebrow': 'Good to know',
    'faq.title': 'Questions, answered',
    'q1.q': 'Is MamiApp free?',
    'q1.a': 'Yes — you can download MamiApp and start tracking for free. It’s a native app on Google Play and a full-screen web app on iPhone.',
    'q2.q': 'Is MamiApp on iPhone?',
    'q2.a': 'Yes. On Android it’s a native app on Google Play; on iPhone and iPad it runs as a full-screen web app — open it in Safari and choose “Add to Home Screen”.',
    'q3.q': 'Which languages does it speak?',
    'q3.a': 'MamiApp is fully available in English and Romanian, and you can switch whenever you like.',
    'q4.q': 'Does it work without internet?',
    'q4.a': 'Absolutely. MamiApp is offline-first, so you can log everything anywhere and it syncs automatically once you’re back online.',
    'q5.q': 'Is my data safe?',
    'q5.a': 'Your data is private and encrypted in transit. You’re fully GDPR-covered: export or permanently delete it whenever you want.',
    'q6.q': 'Is the medical information reliable?',
    'q6.a': 'Guidance follows trusted sources such as the WHO, AAP, CDC and INSP. MamiApp supports you but never replaces professional medical advice.',

    'cta.title': 'Start today, breathe easier tonight',
    'cta.sub': 'Join the mothers who keep pregnancy and the first years beautifully, quietly organised.',
    'cta.btn': 'Download MamiApp free',

    'sticky.msg': 'Free · pregnancy & baby, in one app',
    'sticky.btn': 'Get it',

    'foot.tag': 'Made with care for you and your little one.',
    'foot.product': 'Product',
    'foot.legal': 'Legal',
    'foot.privacy': 'Privacy Policy',
    'foot.terms': 'Terms of Use',
    'foot.get': 'Download',
    'foot.iosweb': 'iOS Web App',
    'foot.made': 'Made with love in Romania',

    'ph.hi': 'Good morning, Ana',
    'ph.sub': 'Here’s Maya’s day so far',
    'ph.feed': 'Feeding',
    'ph.feed_s': 'Last · 2h 10m ago',
    'ph.ontrack': 'on track',
    'ph.sleep': 'Sleep',
    'ph.sleep_s': '3h 40m today',
    'ph.growth': 'Growth',
    'ph.growth_s': 'Weight · 68th percentile',
    'ph.ai': 'Ask the assistant',
    'ph.ai_s': 'Tap for a gentle answer',
    'hero.fb1': 'Vaccine in 7 days',
    'hero.fb2': 'Week 24 · size of a corn cob',
  },
  ro: {
    'nav.features': 'Funcții',
    'nav.ai': 'Asistent',
    'nav.get': 'Descarcă',
    'nav.faq': 'Întrebări',
    'nav.login': 'Autentificare',
    'nav.cta': 'Descarcă',

    'hero.pill': 'Sarcina & primii 5 ani',
    'hero.title_a': 'Cel mai calm mod de a-ți crește',
    'hero.title_b': 'puiul',
    'hero.sub': 'Urmărește sarcina și primii cinci ani ai bebelușului într-o singură aplicație blândă — alăptare, somn, creștere, vaccinuri și etape, plus un asistent care răspunde la 3 dimineața și o comunitate care înțelege.',
    'hero.cta': 'Descarcă gratuit',
    'hero.cta_note': 'Gratuit · Android pe Google Play · iPhone aplicație web',
    'hero.login': 'Am deja cont →',
    'hero.proof': 'Iubită de mame din toată România',
    'auth.create_account_btn': 'Creează Cont',

    'stat.modules': 'module gândite cu grijă',
    'stat.years': 'ani, o aplicație',
    'stat.offline': 'merge offline',

    'std.title': 'Îndrumare bazată pe surse în care ai deja încredere',
    'std.who': 'percentile de creștere',
    'std.aap': 'somn & alăptare',
    'std.cdc': 'repere',
    'std.insp': 'calendar de vaccinare',

    'val.eyebrow': 'De ce rămân mamele',
    'val.title': 'Mai puțină grijă. Mai mult din partea frumoasă.',
    'val.sub': 'MamiApp ține minte în locul tău, ca tu să fii prezentă.',
    'v1.t': 'Totul într-un singur loc',
    'v1.d': 'Gata cu cinci aplicații și un caiet. Sarcina și bebelușul, unul lângă altul.',
    'v2.t': 'Răspunsuri când ai nevoie',
    'v2.d': 'Un asistent cald și o comunitate reală — pentru întrebările pe care Google le face mai înfricoșătoare.',
    'v3.t': 'Nu ratezi ce contează',
    'v3.d': 'Memento-uri blânde pentru vaccinuri, programări și etape, exact la timp.',

    'paths.eyebrow': 'Două capitole, o aplicație',
    'paths.title': 'Fie că aștepți bebelușul, fie că îl ții deja în brațe',
    'paths.sub': 'MamiApp înțelege momentul în care ești — și trece singură de la burtică la copilaș.',
    'paths.preg_tag': 'Sarcină',
    'paths.preg_h': 'Un însoțitor calm pentru toate cele 40 de săptămâni',
    'paths.preg1': 'Timer de contracții cu regula 5-1-1 și istoric de arătat medicului',
    'paths.preg2': 'Numărătoarea loviturilor și jurnal de mișcări fetale',
    'paths.preg3': 'Urmărirea greutății cu repere sănătoase',
    'paths.preg4': 'Programări, întrebări pentru medic și documente într-un singur dosar',
    'paths.preg5': 'Checklist interactiv pentru geanta de maternitate și plan de naștere',
    'paths.baby_tag': 'Copil · 0–5 ani',
    'paths.baby_h': 'Fiecare etapă, păstrată cu blândețe',
    'paths.baby1': 'Alăptare, somn și scutece cu tipare care chiar au sens',
    'paths.baby2': 'Grafice de creștere pe percentile OMS',
    'paths.baby3': 'Calendar de vaccinuri cu notificări (INSP)',
    'paths.baby4': 'Repere de dezvoltare ghidate de CDC',
    'paths.baby5': 'Jurnal de diversificare, dentiție, activități și școală',

    'feat.eyebrow': 'Tot ce ai nevoie',
    'feat.title': 'O aplicație în locul unui sertar plin de ele',
    'feat.sub': 'Peste douăzeci de module, fiecare gândit cu grijă — și cresc odată cu copilul tău.',
    'f1.t': 'Alimentație',
    'f1.d': 'Timer de alăptare pe fiecare sân, biberon (lapte matern sau formulă) și primele mese solide.',
    'f2.t': 'Somn & coaching',
    'f2.d': 'Înregistrează somnul, descoperă ritmul și urmează metode blânde, potrivite vârstei.',
    'f3.t': 'Scutece',
    'f3.d': 'O atingere ține sub ochi hidratarea și digestia.',
    'f4.t': 'Creștere',
    'f4.d': 'Greutate, înălțime și circumferința capului pe grafice automate cu percentile OMS.',
    'f5.t': 'Vaccinuri',
    'f5.d': 'Calendarul complet INSP, cu notificări pentru ce urmează și ce e făcut.',
    'f6.t': 'Achiziții',
    'f6.d': 'Primul zâmbet, primii pași, progres motor și cognitiv — ghidate de CDC.',
    'f7.t': 'Diversificare & nutriție',
    'f7.d': 'Un jurnal al alimentelor noi, reacțiile alergice și idei de mese echilibrate.',
    'f8.t': 'Erupție dentară',
    'f8.d': 'Notează ordinea apariției dințișorilor și urmărește calendarul dentar.',
    'f9.t': 'Activități',
    'f9.d': 'Idei de joacă potrivite vârstei, care trezesc simțurile, mișcarea și emoțiile.',
    'f10.t': 'Bunăstare & emoții',
    'f10.d': 'Exerciții de respirație, screening pentru depresia postnatală și jurnal — pentru tine.',
    'f11.t': 'Documente medicale',
    'f11.d': 'Un dosar digital sigur pentru analize, rețete și ecografii.',
    'f12.t': 'Urgențe',
    'f12.d': 'Informații de prim ajutor offline și apelare rapidă pentru 112 și pediatru.',

    'ai.eyebrow': 'Asistentul',
    'ai.title': 'Răspunsuri la 3 dimineața, fără panică',
    'ai.sub': 'Un asistent cald și bine informat, care înțelege contextul copilului tău — și te îndrumă mereu la medic când contează cu adevărat.',
    'ai1': 'Personalizat pe vârsta bebelușului și pe ce urmărești',
    'ai2': 'Bazat pe recomandările AAP și OMS',
    'ai3': 'Răspunsuri scurte și calme, potrivite pentru serile târzii',
    'ai.q': 'Bebelușul meu de 6 luni nu doarme mai mult de 30 de minute. E normal?',
    'ai.a': 'La șase luni, somnul scurt e foarte frecvent pe măsură ce ciclurile de somn se maturizează. Încearcă o rutină constantă de liniștire și urmărește semnele de oboseală în jurul a 2–2,5h de veghe. Dacă somnul rămâne foarte scurt și bebelușul pare obosit sau agitat, menționează la următorul control. 💛',
    'ai.typing': 'asistentul scrie…',

    'why.eyebrow': 'Făcută să inspire încredere',
    'why.title': 'Construită în jurul tău și al celui mic',
    'p1.t': 'Privată prin design',
    'p1.d': 'Datele tale îți aparțin. Le poți exporta sau șterge oricând (GDPR).',
    'p2.t': 'Merge offline',
    'p2.d': 'Notează o masă în avion sau la țară — se sincronizează când revii online.',
    'p3.t': 'Partajare cu familia',
    'p3.d': 'Invită partenerul sau bunicii cu permisiuni detaliate.',
    'p4.t': 'O comunitate caldă',
    'p4.d': 'Schimbă experiențe și încurajare cu alte mame.',

    'plat.eyebrow': 'Descarcă MamiApp',
    'plat.title': 'Pe Android și pe iPhone',
    'plat.sub': 'Aplicație nativă pe Google Play și aplicație web pe tot ecranul pe iOS — fără App Store.',
    'plat.and_h': 'Android',
    'plat.and_s': 'Aplicație nativă · Google Play',
    'plat.and1': 'Apasă butonul de mai jos pentru a deschide Google Play.',
    'plat.and2': 'Instalează MamiApp ca pe orice altă aplicație.',
    'plat.and3': 'Creează cont în câteva secunde și alege modul.',
    'plat.and_note': 'Descărcare gratuită — fără card.',
    'plat.and_cta': 'Descarcă din Google Play',
    'plat.chip_offline': 'Merge offline',
    'plat.chip_secure': 'Privat & securizat',
    'plat.chip_family': 'Partajare cu familia',
    'plat.ios_h': 'iPhone & iPad',
    'plat.ios_s': 'Aplicație web · Adaugă pe ecran',
    'plat.ios1': 'Deschide example.com în Safari (pe iPhone trebuie neapărat Safari, nu Chrome).',
    'plat.ios2': 'Apasă butonul Partajează — pătratul cu o săgeată în sus — din bara Safari.',
    'plat.ios3': 'Derulează în jos în meniu și apasă „Adaugă pe ecranul principal”.',
    'plat.ios4': 'Apasă „Adaugă” — MamiApp apare pe ecranul principal și se deschide pe tot ecranul.',
    'plat.ios_note': 'Pe iPhone butonul Partajează e jos, pe ecran; pe iPad e sus, în dreapta.',
    'plat.ios_cta': 'Deschide example.com',

    'faq.eyebrow': 'Bine de știut',
    'faq.title': 'Întrebări, cu răspuns',
    'q1.q': 'MamiApp e gratuită?',
    'q1.a': 'Da — poți descărca MamiApp și începe să urmărești gratuit. Este aplicație nativă pe Google Play și aplicație web pe tot ecranul pe iPhone.',
    'q2.q': 'MamiApp e pe iPhone?',
    'q2.a': 'Da. Pe Android este aplicație nativă în Google Play; pe iPhone și iPad rulează ca aplicație web pe tot ecranul — deschide-o în Safari și alege „Adaugă pe ecranul principal”.',
    'q3.q': 'Ce limbi vorbește?',
    'q3.a': 'MamiApp este complet disponibilă în engleză și română, iar limba se schimbă oricând.',
    'q4.q': 'Funcționează fără internet?',
    'q4.a': 'Absolut. MamiApp este offline-first, așa că poți nota totul oriunde, iar datele se sincronizează automat când revii online.',
    'q5.q': 'Datele mele sunt în siguranță?',
    'q5.a': 'Datele tale sunt private și criptate în tranzit. Ești complet acoperită GDPR: le poți exporta sau șterge definitiv oricând.',
    'q6.q': 'Informațiile medicale sunt de încredere?',
    'q6.a': 'Îndrumarea urmează surse de încredere precum OMS, AAP, CDC și INSP. MamiApp te sprijină, dar nu înlocuiește niciodată sfatul medical profesional.',

    'cta.title': 'Începe azi, respiră mai ușor diseară',
    'cta.sub': 'Alătură-te mamelor care își țin sarcina și primii ani frumos și liniștit organizați.',
    'cta.btn': 'Descarcă MamiApp gratuit',

    'sticky.msg': 'Gratuit · sarcina & bebelușul, într-o aplicație',
    'sticky.btn': 'Descarcă',

    'foot.tag': 'Făcută din grijă pentru tine și puiul tău.',
    'foot.product': 'Produs',
    'foot.legal': 'Legal',
    'foot.privacy': 'Politica de confidențialitate',
    'foot.terms': 'Termeni de utilizare',
    'foot.get': 'Descarcă',
    'foot.iosweb': 'Aplicație web iOS',
    'foot.made': 'Făcută cu drag în România',

    'ph.hi': 'Bună dimineața, Ana',
    'ph.sub': 'Iată ziua Mayei până acum',
    'ph.feed': 'Alăptare',
    'ph.feed_s': 'Ultima · acum 2h 10m',
    'ph.ontrack': 'în grafic',
    'ph.sleep': 'Somn',
    'ph.sleep_s': '3h 40m azi',
    'ph.growth': 'Creștere',
    'ph.growth_s': 'Greutate · percentila 68',
    'ph.ai': 'Întreabă asistentul',
    'ph.ai_s': 'Atinge pentru un răspuns blând',
    'hero.fb1': 'Vaccin peste 7 zile',
    'hero.fb2': 'Săptămâna 24 · cât un știulete',
  },
};

const META: Record<string, { title: string; desc: string }> = {
  en: {
    title: 'MamiApp — Your calm companion for pregnancy & the first 5 years',
    desc: "Track pregnancy and your baby's first 5 years, with a caring assistant, community and secure medical records. Free on Google Play and as an iOS web app.",
  },
  ro: {
    title: 'MamiApp — Însoțitorul tău calm pentru sarcină și primii 5 ani',
    desc: 'Urmărește sarcina și primii 5 ani ai bebelușului, cu asistent, comunitate și documente medicale sigure. Gratuit pe Google Play și ca aplicație web pe iOS.',
  },
};

// Small reusable SVG snippets
const ARROW = '<svg class="ar" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STAR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/></svg>';
// iOS Safari "Share" glyph (square with up arrow)
const SHARE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v11M12 3l-3.5 3.5M12 3l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-6a2 2 0 00-2-2h-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// "Add to Home Screen" plus glyph
const PLUSBOX = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

// ---------------------------------------------------------------------------
// Markup + styles (rendered on web via innerHTML; behaviour wired in useEffect)
// ---------------------------------------------------------------------------
const LANDING_HTML = `
<style>
  .mami-lp{
    --coral:#E8997A;--coral-ink:#B15633;--rose:#D88FA8;--rose-ink:#A85E78;
    --sage:#7A9E8C;--plum:#9B7AA8;--amber:#CE9A5B;
    --ink:#2A201B;--ink-soft:#5C4A41;--ink-mute:#8A7064;
    --paper:#FBF3EC;--paper-2:#F4E5D8;--card:#FFFFFF;--line:rgba(120,83,60,.14);
    --aubergine:#241826;
    --grad:linear-gradient(120deg,#E8997A 0%,#DE87A0 55%,#B87AA6 100%);
    --sh-sm:0 1px 3px rgba(42,32,27,.05),0 8px 22px rgba(42,32,27,.06);
    --sh-md:0 2px 6px rgba(42,32,27,.06),0 22px 50px rgba(42,32,27,.11);
    --sh-lg:0 40px 90px rgba(42,32,27,.20);
    --sh-cta:0 12px 28px rgba(216,135,160,.42);
    --sans:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    --serif:'Fraunces',Georgia,'Times New Roman',serif;
    position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;
    scroll-behavior:smooth;background:var(--paper);color:var(--ink);
    font-family:var(--sans);line-height:1.62;font-size:16px;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  }
  .mami-lp *{box-sizing:border-box;margin:0;padding:0}
  .mami-lp::before{
    content:"";position:fixed;inset:0;z-index:0;pointer-events:none;
    background:
      radial-gradient(48vw 42vw at 6% -8%,rgba(232,153,122,.22),transparent 60%),
      radial-gradient(44vw 42vw at 104% 0%,rgba(216,143,168,.20),transparent 58%),
      radial-gradient(56vw 48vw at 92% 108%,rgba(155,122,168,.13),transparent 60%);
  }
  .mami-lp>*{position:relative;z-index:1}
  .mami-lp a{text-decoration:none}
  .mami-lp a:not(.btn){color:inherit}
  .mami-lp img{max-width:100%;display:block}
  .mami-lp button{font-family:inherit}
  .wrap{width:100%;max-width:1180px;margin:0 auto;padding:0 clamp(20px,4.5vw,44px)}
  .serif{font-family:var(--serif);font-weight:500;letter-spacing:-.02em}
  .eyebrow{display:inline-flex;align-items:center;gap:9px;font-size:.76rem;font-weight:700;
    letter-spacing:.16em;text-transform:uppercase;color:var(--coral-ink)}
  .eyebrow::before{content:"";width:24px;height:2px;background:currentColor;border-radius:2px;opacity:.7}
  h2.h{font-family:var(--serif);font-weight:500;font-size:clamp(2.05rem,4.6vw,3.2rem);letter-spacing:-.025em;line-height:1.04}
  .lead{font-size:clamp(1.04rem,1.6vw,1.2rem);color:var(--ink-soft);line-height:1.6}

  /* buttons */
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;border:0;
    font-weight:700;font-size:1rem;border-radius:999px;padding:15px 28px;transition:transform .18s,box-shadow .18s,filter .18s;white-space:nowrap;text-align:center}
  .btn .ar{transition:transform .2s}
  .btn:hover .ar{transform:translateX(3px)}
  .btn-cta{background:var(--grad);color:#fff;box-shadow:var(--sh-cta)}
  .btn-cta:hover{transform:translateY(-2px);box-shadow:0 18px 40px rgba(216,135,160,.52)}
  .btn-dark{background:var(--ink);color:var(--paper);box-shadow:var(--sh-sm)}
  .btn-dark:hover{transform:translateY(-2px);box-shadow:var(--sh-md)}
  .btn-line{background:#fff;color:var(--ink);border:1.5px solid var(--line)}
  .btn-line:hover{transform:translateY(-2px);border-color:rgba(120,83,60,.28)}
  .btn-sm{padding:11px 20px;font-size:.92rem}

  .play-badge{display:inline-flex;transition:transform .18s,filter .18s}
  .play-badge:hover{transform:translateY(-2px)}
  .play-badge img{height:54px;width:auto}
  .ios-link{display:inline-flex;align-items:center;gap:7px;font-weight:600;font-size:.95rem;color:var(--ink-soft);cursor:pointer;border-bottom:1.5px solid transparent;transition:.2s;padding-bottom:1px}
  .ios-link:hover{color:var(--ink);border-color:var(--coral)}

  /* NAV */
  .nav{position:sticky;top:0;z-index:40;backdrop-filter:saturate(150%) blur(12px);
    background:rgba(251,243,236,.82);border-bottom:1px solid var(--line)}
  .nav-in{display:flex;align-items:center;justify-content:space-between;gap:16px;height:68px}
  .brand{display:flex;align-items:center;gap:11px;font-family:var(--serif);font-weight:600;font-size:1.26rem;letter-spacing:-.02em;cursor:pointer}
  .brand img{width:36px;height:36px;border-radius:11px;box-shadow:var(--sh-sm)}
  .nav-links{display:flex;align-items:center;gap:30px}
  .nav-links a{font-size:.95rem;font-weight:500;color:var(--ink-soft);transition:color .2s;cursor:pointer}
  .nav-links a:hover{color:var(--coral-ink)}
  .nav-right{display:flex;align-items:center;gap:14px}
  .seg{display:inline-flex;background:rgba(255,255,255,.7);border:1px solid var(--line);border-radius:999px;padding:3px}
  .seg button{border:0;background:transparent;cursor:pointer;font-weight:700;font-size:.8rem;color:var(--ink-mute);padding:6px 12px;border-radius:999px;transition:.2s}
  .seg button.on{background:var(--ink);color:var(--paper)}
  .login-link{font-size:.95rem;font-weight:600;color:var(--ink);cursor:pointer}
  .nav-cta{display:inline-flex}
  .burger{display:none;width:44px;height:44px;border:1px solid var(--line);background:rgba(255,255,255,.7);border-radius:12px;cursor:pointer;align-items:center;justify-content:center}
  .burger b,.burger b::before,.burger b::after{content:"";display:block;width:19px;height:2px;background:var(--ink);border-radius:2px;position:relative;transition:.25s}
  .burger b::before{position:absolute;top:-6px}.burger b::after{position:absolute;top:6px}
  .m-menu{display:none}

  /* HERO */
  .hero{padding:clamp(44px,6vw,78px) 0 clamp(30px,4vw,52px)}
  .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(30px,5vw,64px);align-items:center}
  .pill{display:inline-flex;align-items:center;gap:9px;font-size:.82rem;font-weight:600;color:var(--coral-ink);
    background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 15px;box-shadow:var(--sh-sm)}
  .pill .dot{width:8px;height:8px;border-radius:50%;background:var(--coral)}
  .hero h1{font-family:var(--serif);font-weight:500;font-size:clamp(2.6rem,6vw,4.4rem);letter-spacing:-.03em;line-height:1.0;margin-top:22px}
  .hero h1 .grad{background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-style:italic;font-weight:400}
  .hero .lead{margin-top:22px;max-width:44ch}
  .hero-cta{display:flex;flex-wrap:wrap;align-items:center;gap:14px 16px;margin-top:32px}
  .hero-cta .btn-cta{font-size:1.05rem;padding:16px 30px}
  .cta-note{font-size:.86rem;color:var(--ink-mute);margin-top:14px;display:flex;align-items:center;gap:7px}
  .cta-note svg{flex:none;color:var(--sage)}
  .proof{display:flex;align-items:center;gap:14px;margin-top:30px;flex-wrap:wrap}
  .avatars{display:flex}
  .avatars span{width:38px;height:38px;border-radius:50%;border:2.5px solid var(--paper);margin-left:-11px;display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:var(--sh-sm)}
  .avatars span:first-child{margin-left:0}
  .proof-txt .stars{display:flex;gap:2px;color:#E8A03A}
  .proof-txt small{display:block;font-size:.84rem;color:var(--ink-mute);margin-top:1px}
  .hero-login-group{display:flex;flex-direction:column;gap:10px;margin-top:20px;align-items:center}
  .hero-login-btn{display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;border:0;font-family:inherit;
    font-weight:700;font-size:.95rem;border-radius:999px;padding:12px 28px;background:var(--ink);color:var(--paper);box-shadow:var(--sh-sm);transition:transform .18s,box-shadow .18s;width:100%;max-width:360px}
  .hero-login-btn:hover{transform:translateY(-2px);box-shadow:var(--sh-md)}
  .hero-login-text{font-size:.92rem;text-align:center}
  .hero-login-text span{color:var(--ink);font-weight:600;cursor:pointer;border-bottom:1.5px solid var(--coral);display:inline}
  @media (max-width:720px){.hero-login-btn{width:100%;max-width:100%}}

  /* phone */
  .stage{position:relative;display:flex;justify-content:center;align-items:center;min-height:560px}
  .halo{position:absolute;width:min(440px,84vw);aspect-ratio:1;border-radius:47% 53% 58% 42%/46% 44% 56% 54%;
    background:conic-gradient(from 130deg,rgba(232,153,122,.6),rgba(216,143,168,.55),rgba(155,122,168,.42),rgba(122,158,140,.48),rgba(232,153,122,.6));
    filter:blur(2px);opacity:.6;animation:morph 16s ease-in-out infinite}
  @keyframes morph{50%{border-radius:56% 44% 42% 58%/58% 56% 44% 42%;transform:rotate(8deg) scale(1.02)}}
  .phone{position:relative;width:min(300px,74vw);aspect-ratio:300/616;background:#1d1510;border-radius:44px;padding:11px;
    box-shadow:var(--sh-lg);border:1px solid rgba(255,255,255,.1);animation:bob 7s ease-in-out infinite}
  @keyframes bob{50%{transform:translateY(-13px)}}
  .screen{width:100%;height:100%;border-radius:34px;overflow:hidden;background:linear-gradient(180deg,#FDF6F0,#F6E7DA);position:relative}
  .notch{position:absolute;top:9px;left:50%;transform:translateX(-50%);width:96px;height:21px;background:#1d1510;border-radius:999px;z-index:3}
  .scr{padding:34px 15px 15px}
  .scr .hi{font-family:var(--serif);font-weight:600;font-size:1.16rem}
  .scr .subhi{font-size:.72rem;color:var(--ink-mute);margin-bottom:13px}
  .tile{background:#fff;border:1px solid rgba(120,83,60,.1);border-radius:17px;padding:12px;box-shadow:var(--sh-sm);margin-bottom:10px}
  .tile .r{display:flex;align-items:center;gap:10px}
  .tic{width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.05rem;flex:none}
  .tile b{font-size:.82rem;display:block}.tile span{font-size:.68rem;color:var(--ink-mute)}
  .chip{margin-left:auto;font-size:.62rem;font-weight:700;color:var(--sage);background:rgba(122,158,140,.16);padding:3px 8px;border-radius:999px}
  .prog{height:6px;border-radius:6px;background:var(--paper-2);margin-top:9px;overflow:hidden}
  .prog i{display:block;height:100%;border-radius:6px;background:var(--grad)}
  .float{position:absolute;z-index:2;background:#fff;border:1px solid rgba(120,83,60,.1);border-radius:15px;padding:9px 13px;
    box-shadow:var(--sh-md);display:flex;align-items:center;gap:9px;font-size:.76rem;font-weight:600}
  .float .d{width:8px;height:8px;border-radius:50%}
  .f-a{top:12%;left:-2%;animation:bob 6s ease-in-out infinite}
  .f-b{bottom:13%;right:-3%;animation:bob 8s ease-in-out infinite .5s}

  /* standards */
  .std{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:rgba(255,255,255,.45)}
  .std .wrap{display:flex;flex-wrap:wrap;gap:12px 36px;align-items:center;justify-content:center;padding:22px 0;text-align:center}
  .std .cap{width:100%;font-size:.74rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute)}
  .std span.i{color:var(--ink-soft);font-size:.92rem}
  .std b{font-family:var(--serif);font-weight:600;color:var(--ink)}

  .sec{padding:clamp(58px,7.5vw,104px) 0}
  .head{max-width:700px}
  .head.center{margin:0 auto;text-align:center}
  .head .h{margin-top:16px}.head .lead{margin-top:16px}

  /* value cards */
  .vals{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(16px,2.4vw,22px);margin-top:48px}
  .vcard{background:var(--card);border:1px solid var(--line);border-radius:26px;padding:32px 28px;box-shadow:var(--sh-sm);transition:transform .2s,box-shadow .2s}
  .vcard:hover{transform:translateY(-5px);box-shadow:var(--sh-md)}
  .vcard .ic{width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin-bottom:18px;background:var(--paper-2)}
  .vcard h3{font-family:var(--serif);font-weight:600;font-size:1.24rem;margin-bottom:9px;letter-spacing:-.01em}
  .vcard p{font-size:.96rem;color:var(--ink-soft)}

  /* paths */
  .paths{display:grid;grid-template-columns:1fr 1fr;gap:clamp(18px,2.5vw,24px);margin-top:48px}
  .path{position:relative;border-radius:30px;padding:clamp(26px,3.4vw,40px);overflow:hidden;box-shadow:var(--sh-md);border:1px solid rgba(255,255,255,.55)}
  .path.p{background:linear-gradient(158deg,#fbe9f0,#f5d5e2)}
  .path.b{background:linear-gradient(158deg,#fbe6d8,#f5d2bc)}
  .path .tg{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:.76rem;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.75);padding:7px 14px;border-radius:999px}
  .path.p .tg{color:var(--rose-ink)}.path.b .tg{color:var(--coral-ink)}
  .path h3{font-family:var(--serif);font-weight:500;font-size:clamp(1.45rem,2.5vw,1.9rem);margin:18px 0 4px;letter-spacing:-.015em}
  .path ul{list-style:none;margin-top:20px;display:grid;gap:13px}
  .path li{display:flex;gap:12px;align-items:flex-start;font-size:.96rem;color:var(--ink-soft)}
  .path li .k{flex:none;width:23px;height:23px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.72rem;color:#fff;margin-top:1px}
  .path.p .k{background:var(--rose)}.path.b .k{background:var(--coral)}

  /* feature grid — stable 3/2/1 columns, each card color-coded to its module */
  .bento{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(16px,2vw,20px);margin-top:48px}
  .cell{
    --ac:var(--coral);--ac-tint:rgba(232,153,122,.16);
    position:relative;background:var(--card);border:1px solid var(--line);border-radius:22px;
    padding:28px 24px 24px;box-shadow:var(--sh-sm);transition:transform .22s,box-shadow .22s;overflow:hidden}
  .cell::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:var(--ac);
    transform:scaleX(.22);transform-origin:left;transition:transform .3s ease}
  .cell:hover{transform:translateY(-6px);box-shadow:0 20px 44px -6px var(--ac-tint),var(--sh-md)}
  .cell:hover::before{transform:scaleX(1)}
  .cell .ic{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-size:1.5rem;margin-bottom:16px;background:var(--ac-tint);box-shadow:inset 0 0 0 1px rgba(0,0,0,.02)}
  .cell h3{font-family:var(--serif);font-weight:600;font-size:1.14rem;margin-bottom:7px;letter-spacing:-.01em}
  .cell p{font-size:.9rem;color:var(--ink-soft);line-height:1.55}

  /* AI spotlight */
  .spot{margin-top:22px;border-radius:34px;overflow:hidden;background:
    radial-gradient(60% 80% at 88% 6%,rgba(232,153,122,.32),transparent 60%),
    radial-gradient(60% 80% at 2% 100%,rgba(216,143,168,.26),transparent 60%),
    linear-gradient(150deg,#2c1f33,#241826);color:#fff;box-shadow:var(--sh-lg)}
  .spot-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(26px,4vw,56px);align-items:center;padding:clamp(32px,5vw,64px)}
  .spot .eyebrow{color:#f6cdb7}
  .spot h2{color:#fff}.spot .lead{color:rgba(255,255,255,.82)}
  .spot ul{list-style:none;margin-top:24px;display:grid;gap:13px}
  .spot li{display:flex;gap:12px;align-items:flex-start;color:rgba(255,255,255,.92);font-size:.98rem}
  .spot li .k{flex:none;width:23px;height:23px;border-radius:8px;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:.72rem;margin-top:1px}
  .chat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.13);border-radius:24px;padding:20px}
  .bub{max-width:88%;padding:13px 16px;border-radius:18px;font-size:.92rem;line-height:1.5;margin-bottom:12px}
  .bub.u{margin-left:auto;background:var(--grad);color:#fff;border-bottom-right-radius:6px}
  .bub.a{background:rgba(255,255,255,.11);color:#fff;border-bottom-left-radius:6px}
  .typ{display:flex;gap:5px;align-items:center;color:rgba(255,255,255,.6);font-size:.78rem}
  .typ i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.6);display:inline-block;animation:bl 1.2s infinite}
  .typ i:nth-child(2){animation-delay:.2s}.typ i:nth-child(3){animation-delay:.4s}
  @keyframes bl{0%,60%,100%{opacity:.3}30%{opacity:1}}

  /* pillars */
  .pill4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:46px}
  .pc{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:28px 24px}
  .pc .ic{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;background:var(--paper-2);margin-bottom:15px}
  .pc h3{font-family:var(--serif);font-weight:600;font-size:1.08rem;margin-bottom:6px}
  .pc p{font-size:.9rem;color:var(--ink-soft)}

  /* platforms */
  .plat{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:46px;align-items:stretch}
  .pcard{background:var(--card);border:1px solid var(--line);border-radius:30px;padding:clamp(26px,3vw,40px);box-shadow:var(--sh-sm);display:flex;flex-direction:column;height:100%}
  .pcard .top{display:flex;align-items:center;gap:14px;margin-bottom:22px}
  .pcard .os{width:54px;height:54px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:var(--ink);color:#fff;flex:none}
  .pcard .os svg{width:29px;height:29px}
  .pcard h3{font-family:var(--serif);font-weight:600;font-size:1.32rem}
  .pcard .os-s{font-size:.84rem;color:var(--ink-mute)}
  .steps{list-style:none;counter-reset:s;display:grid;gap:15px;margin-bottom:22px}
  .steps li{counter-increment:s;display:flex;gap:13px;align-items:center;font-size:.95rem;color:var(--ink-soft);line-height:1.4}
  .steps li::before{content:counter(s);flex:none;width:27px;height:27px;border-radius:50%;background:var(--grad);color:#fff;font-weight:700;font-size:.8rem;display:flex;align-items:center;justify-content:center;align-self:flex-start;margin-top:1px}
  .steps .st-tx{flex:1}
  .steps .st-ic{flex:none;width:30px;height:30px;border-radius:9px;background:var(--paper);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--coral-ink)}
  .steps .st-ic svg{width:16px;height:16px}
  .pcard .note{display:flex;gap:12px;align-items:center;background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:13px 15px;margin-bottom:22px;font-size:.87rem;color:var(--ink-soft);line-height:1.45}
  .pcard .note .ni{flex:none;width:34px;height:34px;border-radius:10px;background:#fff;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--coral-ink)}
  .pcard .note .ni svg{width:18px;height:18px}
  .pcard .chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px}
  .pcard .chip-mini{display:inline-flex;align-items:center;gap:7px;font-size:.82rem;font-weight:600;color:var(--ink-soft);
    background:#fff;border:1px solid var(--line);border-radius:999px;padding:9px 15px}
  .pcard .chip-mini .ci{font-size:.95rem;line-height:1}
  .pcard .cta-row{margin-top:auto;padding-top:24px;border-top:1px solid var(--line);
    display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}
  .pcard .cta-row .btn{width:100%}
  .pcard .cta-row .play-badge img{height:58px}

  /* faq */
  .faq{max-width:820px;margin:42px auto 0;display:grid;gap:12px}
  .faq details{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:2px 24px;box-shadow:var(--sh-sm)}
  .faq summary{cursor:pointer;list-style:none;padding:19px 0;font-weight:600;font-size:1.04rem;display:flex;justify-content:space-between;align-items:center;gap:16px}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:"+";font-family:var(--serif);font-size:1.6rem;color:var(--coral-ink);transition:transform .2s;flex:none}
  .faq details[open] summary::after{transform:rotate(45deg)}
  .faq details p{padding:0 0 20px;color:var(--ink-soft);font-size:.95rem}

  /* final cta band */
  .band{border-radius:36px;padding:clamp(40px,5.6vw,74px) clamp(28px,5vw,64px);text-align:center;position:relative;overflow:hidden;
    background:radial-gradient(70% 130% at 12% 0%,rgba(255,255,255,.18),transparent 58%),var(--grad);
    color:#fff;box-shadow:var(--sh-lg)}
  .band h2{color:#fff;font-size:clamp(2.1rem,4.6vw,3.1rem)}
  .band p{color:rgba(255,255,255,.94);max-width:52ch;margin:16px auto 0;font-size:1.08rem}
  .band .row{display:flex;flex-wrap:wrap;gap:16px 20px;align-items:center;justify-content:center;margin-top:32px}
  .band .btn-white{background:#fff;color:var(--coral-ink)}
  .band .btn-white:hover{transform:translateY(-2px);box-shadow:0 18px 40px rgba(0,0,0,.18)}
  .band .ios-link{color:#fff;border-bottom-color:rgba(255,255,255,.55)}
  .band .ios-link:hover{color:#fff;border-color:#fff}

  /* footer */
  .foot{padding:58px 0 92px;border-top:1px solid var(--line);margin-top:clamp(54px,7vw,92px)}
  .foot-grid{display:flex;justify-content:space-between;flex-wrap:wrap;gap:34px}
  .foot-brand{max-width:300px}
  .foot-brand p{color:var(--ink-mute);font-size:.9rem;margin-top:12px}
  .foot-cols{display:flex;gap:clamp(34px,6vw,70px);flex-wrap:wrap}
  .foot-col h4{font-size:.76rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:14px;font-weight:700}
  .foot-col a{display:block;color:var(--ink-soft);font-size:.92rem;margin-bottom:9px;transition:color .2s;cursor:pointer}
  .foot-col a:hover{color:var(--coral-ink)}
  .foot-bot{margin-top:38px;padding-top:22px;border-top:1px solid var(--line);display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;color:var(--ink-mute);font-size:.84rem}

  /* sticky mobile download bar */
  .dockbar{position:fixed;left:0;right:0;bottom:0;z-index:45;display:none;
    background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-top:1px solid var(--line);
    padding:10px 16px calc(10px + env(safe-area-inset-bottom));align-items:center;gap:12px;box-shadow:0 -8px 30px rgba(42,32,27,.10)}
  .dockbar .msg{flex:1;font-size:.82rem;font-weight:600;color:var(--ink-soft);line-height:1.25}
  .dockbar .btn{flex:none}

  /* reveal (only when JS is ready, so content is visible if JS fails) */
  .mami-lp.ready .reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
  .mami-lp.ready .reveal.in{opacity:1;transform:none}

  @media (max-width:980px){
    .hero-grid{grid-template-columns:1fr;text-align:center}
    .hero .lead{margin-left:auto;margin-right:auto}
    .hero-cta,.proof,.cta-note{justify-content:center}
    .cta-note{justify-content:center}
    .stage{order:-1;min-height:470px}
    .vals{grid-template-columns:1fr}
    .spot-grid{grid-template-columns:1fr}
    .paths{grid-template-columns:1fr}
    .bento{grid-template-columns:repeat(2,1fr)}
    .pill4{grid-template-columns:repeat(2,1fr)}
    .plat{grid-template-columns:1fr}
  }
  @media (max-width:720px){
    .nav-links,.nav-cta,.login-link{display:none}
    .burger{display:flex}
    .m-menu.open{display:flex;flex-direction:column;gap:2px;padding:10px 0 18px;border-top:1px solid var(--line)}
    .m-menu a{padding:12px 4px;font-weight:600;color:var(--ink-soft);cursor:pointer}
    .m-menu .btn{margin-top:10px;justify-content:center}
    .dockbar{display:flex}
    .foot{padding-bottom:110px}
  }
  @media (max-width:560px){
    .bento{grid-template-columns:1fr}
    .pill4{grid-template-columns:1fr}
    .hero-cta .btn-cta{width:100%}
    .hero .play-badge{margin:0 auto}
  }
  @media (prefers-reduced-motion:reduce){
    .mami-lp *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
    .mami-lp.ready .reveal{opacity:1;transform:none}
  }
</style>

<header class="nav">
  <div class="wrap nav-in">
    <div class="brand" data-scroll="#top"><img src="${BRAND_LOGO_URI}" alt="MamiApp" /><span>MamiApp</span></div>
    <nav class="nav-links">
      <a data-scroll="#features" data-i18n="nav.features">Features</a>
      <a data-scroll="#assistant" data-i18n="nav.ai">Assistant</a>
      <a data-scroll="#platforms" data-i18n="nav.get">Download</a>
      <a data-scroll="#faq" data-i18n="nav.faq">FAQ</a>
    </nav>
    <div class="nav-right">
      <div class="seg" role="group" aria-label="Language">
        <button data-lang="en" class="on">EN</button>
        <button data-lang="ro">RO</button>
      </div>
      <span class="login-link" data-nav="/(auth)/login" data-i18n="nav.login">Log in</span>
      <a class="btn btn-cta btn-sm nav-cta" href="${PLAY_STORE_URL}" target="_blank" rel="noopener"><span data-i18n="nav.cta">Get the app</span>${ARROW}</a>
      <button class="burger" aria-label="Menu"><b></b></button>
    </div>
  </div>
  <div class="wrap m-menu">
    <a data-scroll="#features" data-i18n="nav.features">Features</a>
    <a data-scroll="#assistant" data-i18n="nav.ai">Assistant</a>
    <a data-scroll="#platforms" data-i18n="nav.get">Download</a>
    <a data-scroll="#faq" data-i18n="nav.faq">FAQ</a>
    <a data-nav="/(auth)/login" data-i18n="nav.login">Log in</a>
    <a class="btn btn-cta" href="${PLAY_STORE_URL}" target="_blank" rel="noopener"><span data-i18n="nav.cta">Get the app</span>${ARROW}</a>
  </div>
</header>

<span id="top"></span>

<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <span class="pill"><span class="dot"></span><span data-i18n="hero.pill">Pregnancy &amp; the first 5 years</span></span>
      <h1><span data-i18n="hero.title_a">The calmest way to raise</span> <span class="grad" data-i18n="hero.title_b">your little one</span></h1>
      <p class="lead" data-i18n="hero.sub">Track pregnancy and your baby's first five years in one gentle app.</p>
      <div class="hero-cta">
        <a class="btn btn-cta" href="${PLAY_STORE_URL}" target="_blank" rel="noopener"><span data-i18n="hero.cta">Download free</span>${ARROW}</a>
        <a class="play-badge" href="${PLAY_STORE_URL}" target="_blank" rel="noopener" aria-label="Get it on Google Play"><img src="${PLAY_BADGE_URI}" alt="Get it on Google Play" /></a>
      </div>
      <div class="cta-note">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
        <span data-i18n="hero.cta_note">Free · Android on Google Play · iPhone web app</span>
      </div>
      <div class="proof">
        <div class="avatars">
          <span style="background:#F4D9C8">👩🏻</span><span style="background:#F1D2DE">👩🏽</span><span style="background:#E6D6C0">👩🏼</span><span style="background:#D9E4DC">🤰</span>
        </div>
        <div class="proof-txt">
          <div class="stars">${STAR}${STAR}${STAR}${STAR}${STAR}</div>
          <small data-i18n="hero.proof">Loved by mothers across Romania</small>
        </div>
      </div>
      <div class="hero-login-group">
        <button class="hero-login-btn" data-nav="/(auth)/register"><span data-i18n="auth.create_account_btn">Create Account</span></button>
        <div class="hero-login-text"><span data-nav="/(auth)/login" data-i18n="hero.login">I already have an account →</span></div>
      </div>
    </div>
    <div class="stage">
      <div class="halo"></div>
      <div class="float f-a"><span class="d" style="background:var(--sage)"></span><span data-i18n="hero.fb1">Vaccine in 7 days</span></div>
      <div class="float f-b"><span class="d" style="background:var(--rose)"></span><span data-i18n="hero.fb2">Week 24</span></div>
      <div class="phone">
        <div class="screen">
          <div class="notch"></div>
          <div class="scr">
            <div class="hi" data-i18n="ph.hi">Good morning, Ana</div>
            <div class="subhi" data-i18n="ph.sub">Here's Maya's day so far</div>
            <div class="tile"><div class="r"><div class="tic" style="background:var(--paper-2)">🍼</div><div style="flex:1"><b data-i18n="ph.feed">Feeding</b><span data-i18n="ph.feed_s">Last · 2h 10m ago</span></div><span class="chip" data-i18n="ph.ontrack">on track</span></div></div>
            <div class="tile"><div class="r"><div class="tic" style="background:rgba(122,158,140,.18)">💤</div><div style="flex:1"><b data-i18n="ph.sleep">Sleep</b><span data-i18n="ph.sleep_s">3h 40m today</span></div></div><div class="prog"><i style="width:62%"></i></div></div>
            <div class="tile"><div class="r"><div class="tic" style="background:rgba(155,122,168,.18)">📏</div><div style="flex:1"><b data-i18n="ph.growth">Growth</b><span data-i18n="ph.growth_s">Weight · 68th percentile</span></div></div></div>
            <div class="tile" style="background:linear-gradient(120deg,#2c1f33,#241826);border:0"><div class="r"><div class="tic" style="background:rgba(255,255,255,.14)">✨</div><div style="flex:1"><b style="color:#fff" data-i18n="ph.ai">Ask the assistant</b><span style="color:rgba(255,255,255,.68)" data-i18n="ph.ai_s">Tap for a gentle answer</span></div></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="std">
  <div class="wrap">
    <span class="cap" data-i18n="std.title">Guidance rooted in sources you trust</span>
    <span class="i"><b>WHO</b> · <span data-i18n="std.who">growth percentiles</span></span>
    <span class="i"><b>AAP</b> · <span data-i18n="std.aap">sleep &amp; feeding</span></span>
    <span class="i"><b>CDC</b> · <span data-i18n="std.cdc">milestones</span></span>
    <span class="i"><b>INSP</b> · <span data-i18n="std.insp">vaccination schedule</span></span>
  </div>
</section>

<section class="sec" id="value">
  <div class="wrap">
    <div class="head center reveal">
      <span class="eyebrow" data-i18n="val.eyebrow">Why mothers stay</span>
      <h2 class="h" data-i18n="val.title">Less worry. More of the good part.</h2>
      <p class="lead" data-i18n="val.sub">MamiApp quietly does the remembering.</p>
    </div>
    <div class="vals">
      <div class="vcard reveal"><div class="ic" style="background:rgba(232,153,122,.16)">🧺</div><h3 data-i18n="v1.t">Everything in one place</h3><p data-i18n="v1.d">No more juggling five apps and a notebook.</p></div>
      <div class="vcard reveal"><div class="ic" style="background:rgba(155,122,168,.16)">💬</div><h3 data-i18n="v2.t">Answers when you need them</h3><p data-i18n="v2.d">A caring assistant and a real community.</p></div>
      <div class="vcard reveal"><div class="ic" style="background:rgba(122,158,140,.16)">🔔</div><h3 data-i18n="v3.t">Never miss what matters</h3><p data-i18n="v3.d">Gentle reminders, right on time.</p></div>
    </div>
  </div>
</section>

<section class="sec" id="paths" style="padding-top:0">
  <div class="wrap">
    <div class="head center reveal">
      <span class="eyebrow" data-i18n="paths.eyebrow">Two chapters, one app</span>
      <h2 class="h" data-i18n="paths.title">Whether you're expecting or already holding them</h2>
      <p class="lead" data-i18n="paths.sub">MamiApp reads the moment you're in.</p>
    </div>
    <div class="paths">
      <div class="path p reveal">
        <span class="tg">🤰 <span data-i18n="paths.preg_tag">Pregnancy</span></span>
        <h3 data-i18n="paths.preg_h">A calm companion for all 40 weeks</h3>
        <ul>
          <li><span class="k">✓</span><span data-i18n="paths.preg1">Contraction timer with the 5-1-1 rule</span></li>
          <li><span class="k">✓</span><span data-i18n="paths.preg2">Kick counter and fetal-movement log</span></li>
          <li><span class="k">✓</span><span data-i18n="paths.preg3">Weight tracking with healthy-range guidance</span></li>
          <li><span class="k">✓</span><span data-i18n="paths.preg4">Appointments, questions and documents</span></li>
          <li><span class="k">✓</span><span data-i18n="paths.preg5">Hospital-bag checklist and birth plan</span></li>
        </ul>
      </div>
      <div class="path b reveal">
        <span class="tg">👶 <span data-i18n="paths.baby_tag">Baby · 0–5 years</span></span>
        <h3 data-i18n="paths.baby_h">Every little milestone, gently kept</h3>
        <ul>
          <li><span class="k">✓</span><span data-i18n="paths.baby1">Feeding, sleep and diapers with clear patterns</span></li>
          <li><span class="k">✓</span><span data-i18n="paths.baby2">Growth charts on WHO percentiles</span></li>
          <li><span class="k">✓</span><span data-i18n="paths.baby3">Vaccine calendar with reminders (INSP)</span></li>
          <li><span class="k">✓</span><span data-i18n="paths.baby4">Developmental milestones guided by the CDC</span></li>
          <li><span class="k">✓</span><span data-i18n="paths.baby5">Solids diary, teething, activities and school</span></li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="sec" id="features" style="padding-top:0">
  <div class="wrap">
    <div class="head center reveal">
      <span class="eyebrow" data-i18n="feat.eyebrow">Everything you need</span>
      <h2 class="h" data-i18n="feat.title">One app instead of a drawer full of them</h2>
      <p class="lead" data-i18n="feat.sub">More than twenty modules, each designed with care.</p>
    </div>
    <div class="bento">
      <div class="cell reveal" style="--ac:#E8997A;--ac-tint:rgba(232,153,122,.20)"><div class="ic">🍼</div><h3 data-i18n="f1.t">Feeding</h3><p data-i18n="f1.d">Breastfeeding timer per side, bottle and first solids.</p></div>
      <div class="cell reveal" style="--ac:#7A9E8C;--ac-tint:rgba(122,158,140,.22)"><div class="ic">💤</div><h3 data-i18n="f2.t">Sleep &amp; coaching</h3><p data-i18n="f2.d">Log naps, uncover the rhythm, follow gentle methods.</p></div>
      <div class="cell reveal" style="--ac:#9B7AA8;--ac-tint:rgba(155,122,168,.20)"><div class="ic">🧷</div><h3 data-i18n="f3.t">Diapers</h3><p data-i18n="f3.d">A quick tap keeps an eye on hydration.</p></div>
      <div class="cell reveal" style="--ac:#B8935E;--ac-tint:rgba(184,147,94,.20)"><div class="ic">📏</div><h3 data-i18n="f4.t">Growth</h3><p data-i18n="f4.d">Weight, height and head on WHO percentiles.</p></div>
      <div class="cell reveal" style="--ac:#5C8A7A;--ac-tint:rgba(92,138,122,.20)"><div class="ic">💉</div><h3 data-i18n="f5.t">Vaccines</h3><p data-i18n="f5.d">The full INSP schedule with reminders.</p></div>
      <div class="cell reveal" style="--ac:#D4A574;--ac-tint:rgba(212,165,116,.24)"><div class="ic">🏆</div><h3 data-i18n="f6.t">Milestones</h3><p data-i18n="f6.d">Motor and cognitive progress, guided by the CDC.</p></div>
      <div class="cell reveal" style="--ac:#C46B4F;--ac-tint:rgba(196,107,79,.18)"><div class="ic">🥦</div><h3 data-i18n="f7.t">Solids &amp; nutrition</h3><p data-i18n="f7.d">A diary of new foods and reactions.</p></div>
      <div class="cell reveal" style="--ac:#4A5D8C;--ac-tint:rgba(74,93,140,.16)"><div class="ic">🦷</div><h3 data-i18n="f8.t">Teething</h3><p data-i18n="f8.d">Follow the little dental calendar.</p></div>
      <div class="cell reveal" style="--ac:#7A5C8A;--ac-tint:rgba(122,92,138,.20)"><div class="ic">🎨</div><h3 data-i18n="f9.t">Activities</h3><p data-i18n="f9.d">Age-fit play that wakes up the senses.</p></div>
      <div class="cell reveal" style="--ac:#D88FA8;--ac-tint:rgba(216,143,168,.22)"><div class="ic">🧘</div><h3 data-i18n="f10.t">Wellbeing &amp; emotions</h3><p data-i18n="f10.d">Breathing, postnatal mood screening and a journal — for you.</p></div>
      <div class="cell reveal" style="--ac:#5C8A9E;--ac-tint:rgba(92,138,158,.18)"><div class="ic">📄</div><h3 data-i18n="f11.t">Medical documents</h3><p data-i18n="f11.d">A secure folder for analyses and ultrasounds.</p></div>
      <div class="cell reveal" style="--ac:#DC6B5A;--ac-tint:rgba(220,107,90,.16)"><div class="ic">🚨</div><h3 data-i18n="f12.t">Emergency</h3><p data-i18n="f12.d">Offline first-aid and one-tap 112.</p></div>
    </div>
  </div>
</section>

<section class="sec" id="assistant" style="padding-top:0">
  <div class="wrap">
    <div class="spot reveal">
      <div class="spot-grid">
        <div>
          <span class="eyebrow" data-i18n="ai.eyebrow">The assistant</span>
          <h2 class="h" style="margin-top:16px" data-i18n="ai.title">Answers at 3 a.m., without the spiral</h2>
          <p class="lead" data-i18n="ai.sub">A warm, well-read assistant that understands context.</p>
          <ul>
            <li><span class="k">✓</span><span data-i18n="ai1">Personalised to your baby's age and data</span></li>
            <li><span class="k">✓</span><span data-i18n="ai2">Grounded in AAP and WHO recommendations</span></li>
            <li><span class="k">✓</span><span data-i18n="ai3">Short, calm replies for reading half-asleep</span></li>
          </ul>
        </div>
        <div class="chat" aria-hidden="true">
          <div class="bub u" data-i18n="ai.q">My 6-month-old won't nap longer than 30 min. Is that normal?</div>
          <div class="bub a" data-i18n="ai.a">Short naps are common at six months…</div>
          <div class="typ"><i></i><i></i><i></i> <span data-i18n="ai.typing">the assistant is typing…</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="sec" id="why" style="padding-top:0">
  <div class="wrap">
    <div class="head center reveal">
      <span class="eyebrow" data-i18n="why.eyebrow">Made to be trusted</span>
      <h2 class="h" data-i18n="why.title">Built around you and your little one</h2>
    </div>
    <div class="pill4">
      <div class="pc reveal"><div class="ic">🔒</div><h3 data-i18n="p1.t">Private by design</h3><p data-i18n="p1.d">Export or delete everything, any time.</p></div>
      <div class="pc reveal"><div class="ic">📶</div><h3 data-i18n="p2.t">Works offline</h3><p data-i18n="p2.d">Log anywhere; it syncs when you're back.</p></div>
      <div class="pc reveal"><div class="ic">👪</div><h3 data-i18n="p3.t">Share with family</h3><p data-i18n="p3.d">Invite partner or grandparents with permissions.</p></div>
      <div class="pc reveal"><div class="ic">💬</div><h3 data-i18n="p4.t">A warm community</h3><p data-i18n="p4.d">Trade experiences with other mothers.</p></div>
    </div>
  </div>
</section>

<section class="sec" id="platforms" style="padding-top:0">
  <div class="wrap">
    <div class="head center reveal">
      <span class="eyebrow" data-i18n="plat.eyebrow">Get MamiApp</span>
      <h2 class="h" data-i18n="plat.title">On Android, and on iPhone</h2>
      <p class="lead" data-i18n="plat.sub">Native on Google Play, a full-screen web app on iOS.</p>
    </div>
    <div class="plat">
      <div class="pcard reveal">
        <div class="top">
          <div class="os"><svg viewBox="0 0 512 512" fill="currentColor"><path d="M99 176a24 24 0 00-24 24v112a24 24 0 0048 0V200a24 24 0 00-24-24zm314 0a24 24 0 00-24 24v112a24 24 0 0048 0V200a24 24 0 00-24-24zM158 176v168a26 26 0 0026 26h18v54a24 24 0 0048 0v-54h24v54a24 24 0 0048 0v-54h18a26 26 0 0026-26V176zm22-30h152a76 76 0 00-40-58l19-30a5 5 0 00-8-5l-21 32a92 92 0 00-71 0l-21-32a5 5 0 00-8 5l19 30a76 76 0 00-40 58zm31-33a10 10 0 1110-10 10 10 0 01-10 10zm90 0a10 10 0 1110-10 10 10 0 01-10 10z"/></svg></div>
          <div><h3 data-i18n="plat.and_h">Android</h3><div class="os-s" data-i18n="plat.and_s">Native app · Google Play</div></div>
        </div>
        <ol class="steps">
          <li data-i18n="plat.and1">Tap the button below to open Google Play.</li>
          <li data-i18n="plat.and2">Install MamiApp like any other app.</li>
          <li data-i18n="plat.and3">Create an account and choose your mode.</li>
        </ol>
        <div class="note"><span class="ni" style="color:var(--sage)"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span><span data-i18n="plat.and_note">Free to download — no card needed.</span></div>
        <div class="chips">
          <span class="chip-mini"><span class="ci">📶</span><span data-i18n="plat.chip_offline">Works offline</span></span>
          <span class="chip-mini"><span class="ci">🔒</span><span data-i18n="plat.chip_secure">Private &amp; secure</span></span>
          <span class="chip-mini"><span class="ci">👨‍👩‍👧</span><span data-i18n="plat.chip_family">Family sharing</span></span>
        </div>
        <div class="cta-row">
          <a class="play-badge" href="${PLAY_STORE_URL}" target="_blank" rel="noopener" aria-label="Get it on Google Play"><img src="${PLAY_BADGE_URI}" alt="Get it on Google Play" /></a>
        </div>
      </div>
      <div class="pcard reveal">
        <div class="top">
          <div class="os"><svg viewBox="0 0 384 512" fill="currentColor"><path d="M318 268c-1-58 47-86 49-87-27-39-68-44-83-45-35-4-68 21-86 21s-45-20-74-20c-38 1-73 22-93 56-40 69-10 171 28 227 19 27 41 58 70 57 28-1 39-18 73-18s44 18 74 17c30-1 49-28 67-55 21-31 30-61 30-63-1-1-58-22-59-88zM262 84c15-19 26-45 23-71-22 1-49 15-65 34-14 16-27 43-24 68 25 2 50-13 66-31z"/></svg></div>
          <div><h3 data-i18n="plat.ios_h">iPhone &amp; iPad</h3><div class="os-s" data-i18n="plat.ios_s">Web app · Add to Home Screen</div></div>
        </div>
        <ol class="steps ios-steps">
          <li><span class="st-tx" data-i18n="plat.ios1">Open example.com in Safari.</span></li>
          <li><span class="st-tx" data-i18n="plat.ios2">Tap the Share button in Safari.</span><span class="st-ic">${SHARE}</span></li>
          <li><span class="st-tx" data-i18n="plat.ios3">Scroll down and tap Add to Home Screen.</span><span class="st-ic">${PLUSBOX}</span></li>
          <li><span class="st-tx" data-i18n="plat.ios4">Tap Add — it opens full-screen.</span></li>
        </ol>
        <div class="note"><span class="ni">${SHARE}</span><span data-i18n="plat.ios_note">On iPhone the Share button sits at the bottom of the screen; on iPad it’s at the top-right.</span></div>
        <div class="cta-row">
          <a class="btn btn-dark" href="${WEB_APP_URL}" target="_blank" rel="noopener"><span data-i18n="plat.ios_cta">Open example.com</span>${ARROW}</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="sec" id="faq" style="padding-top:0">
  <div class="wrap">
    <div class="head center reveal">
      <span class="eyebrow" data-i18n="faq.eyebrow">Good to know</span>
      <h2 class="h" data-i18n="faq.title">Questions, answered</h2>
    </div>
    <div class="faq">
      <details class="reveal"><summary data-i18n="q1.q">Is MamiApp free?</summary><p data-i18n="q1.a"></p></details>
      <details class="reveal"><summary data-i18n="q2.q">Is MamiApp on iPhone?</summary><p data-i18n="q2.a"></p></details>
      <details class="reveal"><summary data-i18n="q3.q">Which languages?</summary><p data-i18n="q3.a"></p></details>
      <details class="reveal"><summary data-i18n="q4.q">Does it work offline?</summary><p data-i18n="q4.a"></p></details>
      <details class="reveal"><summary data-i18n="q5.q">Is my data safe?</summary><p data-i18n="q5.a"></p></details>
      <details class="reveal"><summary data-i18n="q6.q">Is the info reliable?</summary><p data-i18n="q6.a"></p></details>
    </div>
  </div>
</section>

<section class="sec" style="padding-top:0">
  <div class="wrap">
    <div class="band reveal">
      <h2 class="h" data-i18n="cta.title">Start today, breathe easier tonight</h2>
      <p data-i18n="cta.sub">Join the mothers who keep it beautifully organised.</p>
      <div class="row">
        <a class="btn btn-white" href="${PLAY_STORE_URL}" target="_blank" rel="noopener"><span data-i18n="cta.btn">Download MamiApp free</span>${ARROW}</a>
        <span class="ios-link" data-ios data-i18n="plat.ios_s">iPhone? Add to Home Screen</span>
      </div>
    </div>
  </div>
</section>

<footer class="foot">
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <div class="brand" data-scroll="#top"><img src="${BRAND_LOGO_URI}" alt="MamiApp" /><span>MamiApp</span></div>
      <p data-i18n="foot.tag">Made with care for you and your little one.</p>
    </div>
    <div class="foot-cols">
      <div class="foot-col">
        <h4 data-i18n="foot.product">Product</h4>
        <a data-scroll="#features" data-i18n="nav.features">Features</a>
        <a data-scroll="#assistant" data-i18n="nav.ai">Assistant</a>
        <a data-scroll="#platforms" data-i18n="nav.get">Download</a>
        <a data-scroll="#faq" data-i18n="nav.faq">FAQ</a>
      </div>
      <div class="foot-col">
        <h4 data-i18n="foot.legal">Legal</h4>
        <a data-nav="/privacy" data-i18n="foot.privacy">Privacy Policy</a>
        <a data-nav="/terms" data-i18n="foot.terms">Terms of Use</a>
      </div>
      <div class="foot-col">
        <h4 data-i18n="foot.get">Download</h4>
        <a href="${PLAY_STORE_URL}" target="_blank" rel="noopener">Google Play</a>
        <a href="${WEB_APP_URL}" target="_blank" rel="noopener" data-i18n="foot.iosweb">iOS Web App</a>
      </div>
    </div>
  </div>
  <div class="wrap foot-bot">
    <span>© <span data-year></span> MamiApp</span>
    <span data-i18n="foot.made">Made with love in Romania</span>
  </div>
</footer>

<div class="dockbar">
  <div class="msg" data-i18n="sticky.msg">Free · pregnancy &amp; baby, in one app</div>
  <a class="btn btn-cta btn-sm" href="${PLAY_STORE_URL}" target="_blank" rel="noopener"><span data-i18n="sticky.btn">Get it</span>${ARROW}</a>
</div>
`;

const LANDING_LANG_KEY = '@mamiapp_landing_lang';
const APP_LANG_KEY = '@mamiapp_language';

export default function LandingScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Native: never show the marketing page — go straight into the app.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace(user ? '/(tabs)' : '/(auth)/welcome');
    }
  }, [router, user]);

  // Web: wire up language switching, menu, reveal animations, navigation.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = containerRef.current;
    if (!root) return;

    root.classList.add('ready');

    // Load display + body fonts once (web only).
    if (!document.getElementById('mami-lp-fonts')) {
      const pre1 = document.createElement('link');
      pre1.rel = 'preconnect';
      pre1.href = 'https://fonts.googleapis.com';
      const pre2 = document.createElement('link');
      pre2.rel = 'preconnect';
      pre2.href = 'https://fonts.gstatic.com';
      pre2.crossOrigin = 'anonymous';
      const font = document.createElement('link');
      font.id = 'mami-lp-fonts';
      font.rel = 'stylesheet';
      font.href =
        'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600;700&display=swap';
      document.head.appendChild(pre1);
      document.head.appendChild(pre2);
      document.head.appendChild(font);
    }

    const readStored = (key: string): string | null => {
      try { return window.localStorage.getItem(key); } catch { return null; }
    };
    const writeStored = (key: string, val: string) => {
      try { window.localStorage.setItem(key, val); } catch {}
    };

    const applyLang = (lang: string) => {
      const dict = I18N[lang] || I18N.en;
      root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (key && dict[key] != null) el.textContent = dict[key];
      });
      root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
        const key = el.getAttribute('data-i18n-aria');
        if (key && dict[key] != null) el.setAttribute('aria-label', dict[key]);
      });
      root.querySelectorAll<HTMLElement>('.seg button').forEach((b) =>
        b.classList.toggle('on', b.getAttribute('data-lang') === lang)
      );
      try { document.documentElement.lang = lang; } catch {}
      const meta = META[lang] || META.en;
      try {
        document.title = meta.title;
        const md = document.querySelector('meta[name="description"]');
        if (md) md.setAttribute('content', meta.desc);
      } catch {}
      writeStored(LANDING_LANG_KEY, lang);
      writeStored(APP_LANG_KEY, lang); // keep the app in the chosen language too
    };

    // Default English; honor a previously chosen language.
    const stored = readStored(LANDING_LANG_KEY) || readStored(APP_LANG_KEY);
    applyLang(stored === 'ro' ? 'ro' : 'en');

    const cleanups: Array<() => void> = [];
    const on = (el: Element | Window, ev: string, fn: any) => {
      el.addEventListener(ev, fn);
      cleanups.push(() => el.removeEventListener(ev, fn));
    };

    // Language buttons
    root.querySelectorAll('.seg button').forEach((b) =>
      on(b, 'click', () => applyLang(b.getAttribute('data-lang') || 'en'))
    );

    // Mobile menu
    const menu = root.querySelector('.m-menu');
    const burger = root.querySelector('.burger');
    if (burger && menu) on(burger, 'click', () => menu.classList.toggle('open'));

    // Smooth in-page scrolling + close menu
    root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) =>
      on(el, 'click', (e: Event) => {
        e.preventDefault();
        const sel = el.getAttribute('data-scroll') || '';
        const target = sel === '#top' ? root : root.querySelector(sel);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        menu?.classList.remove('open');
      })
    );

    // In-app navigation (login / privacy / terms) via Expo Router
    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) =>
      on(el, 'click', (e: Event) => {
        e.preventDefault();
        const path = el.getAttribute('data-nav');
        menu?.classList.remove('open');
        if (path) router.push(path as any);
      })
    );

    // iOS "Add to Home Screen" hint
    const iosLang = () => (readStored(LANDING_LANG_KEY) === 'ro' ? 'ro' : 'en');
    root.querySelectorAll('[data-ios]').forEach((el) =>
      on(el, 'click', () => {
        window.alert(
          iosLang() === 'ro'
            ? 'Pe iPhone/iPad: deschide example.com in Safari, apasa butonul Partajeaza si alege „Adauga pe ecranul principal”.'
            : 'On iPhone/iPad: open example.com in Safari, tap the Share button and choose “Add to Home Screen”.'
        );
      })
    );

    // Year
    root.querySelectorAll('[data-year]').forEach((el) => {
      el.textContent = String(new Date().getFullYear());
    });

    // Scroll reveal
    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px', root }
      );
      root.querySelectorAll('.reveal').forEach((el) => observer?.observe(el));
    } else {
      root.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    }

    return () => {
      cleanups.forEach((fn) => fn());
      observer?.disconnect();
    };
  }, [router]);

  if (Platform.OS !== 'web') return null;

  return createElement('div', {
    ref: containerRef,
    className: 'mami-lp',
    dangerouslySetInnerHTML: { __html: LANDING_HTML },
  });
}
