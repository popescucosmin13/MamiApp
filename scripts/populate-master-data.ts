/**
 * Script pentru popularea datelor master în Firestore.
 * Rulați cu: npx ts-node scripts/populate-master-data.ts
 *
 * Necesită: FIREBASE_SERVICE_ACCOUNT variabilă de mediu sau
 * serviciu-cont.json în directorul curent.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json'),
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
});

const db = getFirestore();

// =========================================================
// Săptămâni sarcină (date pentru modulul pregnancy)
// =========================================================
const PREGNANCY_WEEKS = [
  {
    week: 6,
    babySize: 'Linte',
    babyWeight: '< 1g',
    babyLength: '0.6 cm',
    motherChanges: 'Grețuri matinale frecvente, sâni sensibili',
    development: 'Inima bate! Creierul și măduva spinării se formează.',
    emoji: '🫘',
    tips: ['Luați acid folic zilnic', 'Beți apă la trezire pentru grețuri', 'Evitați alimentele care declanșează grețurile'],
  },
  {
    week: 8,
    babySize: 'Zmeură',
    babyWeight: '1g',
    babyLength: '1.6 cm',
    motherChanges: 'Sânii mai mari, urinare frecventă, oboseală',
    development: 'Degetele se formează, coada dispare. Embrionul devine făt.',
    emoji: '🫐',
    tips: ['Prima ecografie recomandată', 'Programați la medicul ginecolog', 'Odihnă suficientă'],
  },
  {
    week: 10,
    babySize: 'Prună',
    babyWeight: '4g',
    babyLength: '3.1 cm',
    motherChanges: 'Uterul crește, pantalonii pot strânge',
    development: 'Organele vitale formate. Își poate deschide și închide mâinile.',
    emoji: '🍑',
    tips: ['Testul dublu markeri (săpt. 10-13)', 'Evitați băile fierbinți', 'Exerciții blânde de yoga'],
  },
  {
    week: 12,
    babySize: 'Lime',
    babyWeight: '14g',
    babyLength: '5.4 cm',
    motherChanges: 'Grețurile pot scădea, energie mai multă',
    development: 'Reflexele se dezvoltă. Poate înghiți lichid amniotic.',
    emoji: '🍈',
    tips: ['Ecografia de la 12 săptămâni', 'Testul translucenței nucale', 'Anunțați vestea dacă doriți'],
  },
  {
    week: 16,
    babySize: 'Avocado',
    babyWeight: '100g',
    babyLength: '11.6 cm',
    motherChanges: 'Burtica devine vizibilă. Pielea poate sclipi.',
    development: 'Aude sunete! Fața expresivă, sprâncene și gene.',
    emoji: '🥑',
    tips: ['Cremă anti-vergeturi', 'Cumpărați haine de sarcină', 'Testul quad screening (opțional)'],
  },
  {
    week: 20,
    babySize: 'Banana',
    babyWeight: '300g',
    babyLength: '16.4 cm',
    motherChanges: 'Mișcările fătului simțite (quickening)',
    development: 'Jumătatea sarcinii! Sexul poate fi determinat la ecografie.',
    emoji: '🍌',
    tips: ['Ecografia morfologică (18-22 săptămâni)', 'Cursuri prenatale', 'Dosar maternitate'],
  },
  {
    week: 24,
    babySize: 'Porumb',
    babyWeight: '600g',
    babyLength: '21 cm',
    motherChanges: 'Dureri de spate, picioare umflate seara',
    development: 'Plămânii se maturizează, surfactant se produce. Supraviețuire posibilă la naștere prematură.',
    emoji: '🌽',
    tips: ['Testul glucoză (24-28 săptămâni)', 'Cursuri naștere', 'Discutați opțiunile de naștere'],
  },
  {
    week: 28,
    babySize: 'Vânătă',
    babyWeight: '1 kg',
    babyLength: '25 cm',
    motherChanges: 'Trimestrul 3 — mai greu de dormit, arsuri',
    development: 'Ochii se deschid! Creierul se dezvoltă rapid.',
    emoji: '🍆',
    tips: ['Vaccinul whooping cough recomandat', 'Numărați mișcările (10 în 2h)', 'Pregătiți geanta pentru maternitate'],
  },
  {
    week: 32,
    babySize: 'Squash',
    babyWeight: '1.7 kg',
    babyLength: '28.9 cm',
    motherChanges: 'Respirație dificilă, urinare frecventă crescută',
    development: 'Practică respirația. Unghiile și părul cresc.',
    emoji: '🎃',
    tips: ['Ecografia la 32 săptămâni', 'Plan naștere', 'Instalați scaunul auto'],
  },
  {
    week: 36,
    babySize: 'Pepene galben',
    babyWeight: '2.6 kg',
    babyLength: '33.2 cm',
    motherChanges: 'Lightening (fătul coboară). Falsele contracții Braxton-Hicks.',
    development: 'Aproape complet dezvoltat. Practică suptul.',
    emoji: '🍈',
    tips: ['Geanta pregătită', 'Monitorizați mișcările zilnic', 'Consult anestezie dacă doriți epidurală'],
  },
  {
    week: 40,
    babySize: 'Pepene verde',
    babyWeight: '3.4 kg',
    babyLength: '36 cm',
    motherChanges: 'Termenul a sosit! Contracțiile pot începe oricând.',
    development: 'Complet matur și pregătit pentru lume!',
    emoji: '🍉',
    tips: ['Semnele travaliului real: contracții regulate, scurgere mucoasă, ruperea membranelor', 'Apelați spitalul când contracțiile vin la 5 min', 'Aveți răbdare — termenul este o estimare'],
  },
];

// =========================================================
// Funcție populare
// =========================================================
async function populatePregnancyWeeks() {
  console.log('Populating pregnancy weeks...');
  const batch = db.batch();
  for (const week of PREGNANCY_WEEKS) {
    const ref = db.doc(`pregnancy_weeks/${week.week}`);
    batch.set(ref, week);
  }
  await batch.commit();
  console.log(`✓ Populated ${PREGNANCY_WEEKS.length} pregnancy weeks`);
}

async function populateVaccinesMaster() {
  console.log('Populating vaccines master...');
  const VACCINES = [
    { id: 'bcg', name: 'BCG (Tuberculoză)', scheduledAt: 0, notes: 'La naștere, o doză', category: 'obligatoriu' },
    { id: 'hbv_0', name: 'Hepatita B - doza 1', scheduledAt: 0, notes: 'La naștere', category: 'obligatoriu' },
    { id: 'hbv_2', name: 'Hepatita B - doza 2', scheduledAt: 2, notes: 'La 2 luni', category: 'obligatoriu' },
    { id: 'dtap_2', name: 'DTPa (Difterie, Tetanos, Pertussis) - doza 1', scheduledAt: 2, notes: 'La 2 luni', category: 'obligatoriu' },
    { id: 'ipv_2', name: 'VPI (Poliomielită) - doza 1', scheduledAt: 2, notes: 'La 2 luni', category: 'obligatoriu' },
    { id: 'hib_2', name: 'Hib (Haemophilus influenzae) - doza 1', scheduledAt: 2, notes: 'La 2 luni', category: 'obligatoriu' },
    { id: 'pcv_2', name: 'PCV13 (Pneumococ) - doza 1', scheduledAt: 2, notes: 'La 2 luni', category: 'obligatoriu' },
    { id: 'rv_2', name: 'Rotavirus - doza 1', scheduledAt: 2, notes: 'La 2 luni', category: 'recomandat' },
    { id: 'dtap_4', name: 'DTPa - doza 2', scheduledAt: 4, notes: 'La 4 luni', category: 'obligatoriu' },
    { id: 'ipv_4', name: 'VPI - doza 2', scheduledAt: 4, notes: 'La 4 luni', category: 'obligatoriu' },
    { id: 'hib_4', name: 'Hib - doza 2', scheduledAt: 4, notes: 'La 4 luni', category: 'obligatoriu' },
    { id: 'pcv_4', name: 'PCV13 - doza 2', scheduledAt: 4, notes: 'La 4 luni', category: 'obligatoriu' },
    { id: 'rv_4', name: 'Rotavirus - doza 2', scheduledAt: 4, notes: 'La 4 luni', category: 'recomandat' },
    { id: 'dtap_11', name: 'DTPa - doza 3', scheduledAt: 11, notes: 'La 11 luni', category: 'obligatoriu' },
    { id: 'ipv_11', name: 'VPI - doza 3', scheduledAt: 11, notes: 'La 11 luni', category: 'obligatoriu' },
    { id: 'hib_11', name: 'Hib - doza 3', scheduledAt: 11, notes: 'La 11 luni', category: 'obligatoriu' },
    { id: 'pcv_11', name: 'PCV13 - doza 3', scheduledAt: 11, notes: 'La 11 luni', category: 'obligatoriu' },
    { id: 'hbv_11', name: 'Hepatita B - doza 3', scheduledAt: 11, notes: 'La 11 luni', category: 'obligatoriu' },
    { id: 'mmr_12', name: 'RRO (Rujeolă, Rubeolă, Oreion) - doza 1', scheduledAt: 12, notes: 'La 12 luni', category: 'obligatoriu' },
    { id: 'var_12', name: 'Varicelă - doza 1', scheduledAt: 12, notes: 'La 12 luni', category: 'recomandat' },
    { id: 'mmr_5y', name: 'RRO - doza 2', scheduledAt: 60, notes: 'La 5 ani', category: 'obligatoriu' },
    { id: 'dtap_5y', name: 'DTPa-VPI rapel', scheduledAt: 60, notes: 'La 5 ani', category: 'obligatoriu' },
  ];

  const batch = db.batch();
  for (const v of VACCINES) {
    const ref = db.doc(`vaccines_master/${v.id}`);
    batch.set(ref, v);
  }
  await batch.commit();
  console.log(`✓ Populated ${VACCINES.length} vaccines`);
}

async function populateFoodsMaster() {
  console.log('Populating foods master...');
  const FOODS = [
    { id: 'orez', name_ro: 'Orez', minAgeMonths: 4, allergenRisk: 'low', category: 'cereale', preparationTips: 'Pastă subțire de orez fiert bine, diluat cu lapte matern sau formulă.', emoji: '🍚' },
    { id: 'mar', name_ro: 'Măr', minAgeMonths: 4, allergenRisk: 'low', category: 'fructe', preparationTips: 'Piure de măr copt, fără coajă și semințe.', emoji: '🍎' },
    { id: 'para', name_ro: 'Pară', minAgeMonths: 4, allergenRisk: 'low', category: 'fructe', preparationTips: 'Piure de pară coaptă, cernută fin.', emoji: '🍐' },
    { id: 'banana', name_ro: 'Banană', minAgeMonths: 5, allergenRisk: 'low', category: 'fructe', preparationTips: 'Piure sau zdrobită cu furculița. Nu necesită gătire.', emoji: '🍌' },
    { id: 'cartofi_dulci', name_ro: 'Cartofi dulci', minAgeMonths: 4, allergenRisk: 'low', category: 'legume', preparationTips: 'Fierți la abur și pasați. Consistență cremoasă naturală.', emoji: '🍠' },
    { id: 'morcov', name_ro: 'Morcov', minAgeMonths: 4, allergenRisk: 'low', category: 'legume', preparationTips: 'Fierți și pasați fin. Pot fi amestecați cu alte legume.', emoji: '🥕' },
    { id: 'dovleac', name_ro: 'Dovleac', minAgeMonths: 4, allergenRisk: 'low', category: 'legume', preparationTips: 'Copt sau fiert la abur, pasat. Dulce natural.', emoji: '🎃' },
    { id: 'spanac', name_ro: 'Spanac', minAgeMonths: 6, allergenRisk: 'low', category: 'legume', preparationTips: 'Opărit și blendat. Nu oferiți sub 6 luni (nitrați).', emoji: '🥬' },
    { id: 'pui', name_ro: 'Pui', minAgeMonths: 6, allergenRisk: 'low', category: 'proteine', preparationTips: 'Piept de pui fiert și procesat fin sau BLISS (bucăți moi).', emoji: '🍗' },
    { id: 'vita', name_ro: 'Vită', minAgeMonths: 6, allergenRisk: 'low', category: 'proteine', preparationTips: 'Tocată și bine gătită sau pasat cu legume.', emoji: '🥩' },
    { id: 'linte', name_ro: 'Linte', minAgeMonths: 6, allergenRisk: 'low', category: 'proteine', preparationTips: 'Fiartă bine, pasată sau oferită în bucăți moi la BLW.', emoji: '🫘' },
    { id: 'ou', name_ro: 'Ou', minAgeMonths: 6, allergenRisk: 'high', category: 'proteine', preparationTips: 'Bine gătit (omletă, ou fiert). Introduce în special gălbenușul mai întâi.', emoji: '🥚' },
    { id: 'lapte_vaca', name_ro: 'Lapte de vacă', minAgeMonths: 12, allergenRisk: 'high', category: 'lactate', preparationTips: 'Nu ca băutură principală sub 12 luni. Poate fi ingredient în preparate de la 6 luni.', emoji: '🥛' },
    { id: 'iaurt', name_ro: 'Iaurt natural', minAgeMonths: 6, allergenRisk: 'medium', category: 'lactate', preparationTips: 'Iaurt natural integral, fără zahăr adăugat. Bun cu fructe.', emoji: '🥣' },
    { id: 'branza', name_ro: 'Brânză', minAgeMonths: 6, allergenRisk: 'medium', category: 'lactate', preparationTips: 'Brânză proaspătă din lapte pasteurizat. Evitați brânzeturile moi nematurate.', emoji: '🧀' },
    { id: 'arahide', name_ro: 'Arahide', minAgeMonths: 6, allergenRisk: 'high', category: 'alergeni', preparationTips: 'Unt de arahide diluat (1 linguriță cu apă). Introducere timpurie reduce riscul alergiei.', emoji: '🥜' },
    { id: 'peste', name_ro: 'Pește', minAgeMonths: 6, allergenRisk: 'high', category: 'proteine', preparationTips: 'Pește alb (cod, biban) fiert. Verificați cu atenție oasele.', emoji: '🐟' },
    { id: 'grau', name_ro: 'Grâu (gluten)', minAgeMonths: 6, allergenRisk: 'medium', category: 'cereale', preparationTips: 'Biscuiți sau paste bine fierte. Introduceți treptat.', emoji: '🌾' },
    { id: 'kiwi', name_ro: 'Kiwi', minAgeMonths: 8, allergenRisk: 'medium', category: 'fructe', preparationTips: 'Pasat sau în bucăți mici moi. Poate fi iritant în cantități mari.', emoji: '🥝' },
    { id: 'capsuni', name_ro: 'Căpșuni', minAgeMonths: 8, allergenRisk: 'medium', category: 'fructe', preparationTips: 'Proaspete sau pasate. Introduceți cu atenție, pot cauza reacție.', emoji: '🍓' },
    { id: 'miere', name_ro: 'Miere', minAgeMonths: 12, allergenRisk: 'high', category: 'altele', preparationTips: 'INTERZIS sub 12 luni (botulism infantil). Evitați complet.', emoji: '🍯' },
    { id: 'nuci', name_ro: 'Nuci întregi', minAgeMonths: 48, allergenRisk: 'high', category: 'alergeni', preparationTips: 'Risc de înec sub 4 ani. Macinați sau ca unt de nuci.', emoji: '🫘' },
  ];

  const batch = db.batch();
  for (const food of FOODS) {
    const ref = db.doc(`foods_master/${food.id}`);
    batch.set(ref, food);
  }
  await batch.commit();
  console.log(`✓ Populated ${FOODS.length} foods`);
}

async function main() {
  console.log('Starting master data population...\n');
  await populatePregnancyWeeks();
  await populateVaccinesMaster();
  await populateFoodsMaster();
  console.log('\n✅ All master data populated successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
