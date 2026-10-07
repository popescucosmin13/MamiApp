/**
 * Populare conținut zilnic pentru notificările smart (colecția notificationContent).
 * Rulați cu: npx ts-node scripts/populate-notification-content.ts
 *
 * Necesită: GOOGLE_APPLICATION_CREDENTIALS sau service-account.json în directorul curent
 * (același setup ca populate-master-data.ts).
 *
 * Structura documentelor:
 *   notificationContent/pregnancy_w{week}_{order} → { audience: 'pregnancy', week, order, body, enabled }
 *   notificationContent/child_m{month}_{order}    → { audience: 'child', month, order, body, enabled }
 *
 * Orchestratorul rotește zilnic itemii din bucket-ul curent (săptămâna de sarcină /
 * luna de vârstă), deci mai multe intrări per bucket = varietate mai mare.
 * Conținutul poate fi editat ulterior din admin panel (pagina Notificări smart).
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json'),
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
});

const db = getFirestore();

// =========================================================
// Sarcină — conținut per săptămână (5–41)
// =========================================================
const PREGNANCY_CONTENT: Record<number, string[]> = {
  5: [
    'Inima bebelușului începe să bată chiar în această săptămână — de două ori mai repede decât a ta. 💓',
    'Oboseala intensă e normală acum: corpul tău construiește placenta. Odihnește-te fără vinovăție.',
  ],
  6: [
    'Bebe e cât un bob de linte, dar creierul și măduva spinării se formează deja.',
    'Grețurile matinale? Încearcă biscuiți simpli înainte să te ridici din pat.',
  ],
  7: [
    'Mâinile și picioarele bebelușului apar acum ca niște mici vâsle. Crește cu 1 mm pe zi!',
    'Acidul folic e crucial în aceste săptămâni — nu sări peste el.',
  ],
  8: [
    'Coada embrionară dispare — de acum bebe arată tot mai uman. Are deja degete!',
    'Sânii sensibili și urinarea frecventă sunt semne bune: hormonii lucrează.',
  ],
  9: [
    'Toate organele vitale ale bebelușului sunt formate. De acum doar cresc și se maturizează.',
    'Programează prima ecografie dacă nu ai făcut-o încă.',
  ],
  10: [
    'Bebe își poate deschide și închide pumnii. Unghiile încep să crească.',
    'Între săptămânile 10–13 se face testul dublu markeri — întreabă medicul.',
  ],
  11: [
    'Bebe poate să caște și să sughită deja. Mugurii dinților de lapte se formează.',
    'Dacă grețurile scad, e semn că placenta preia controlul hormonal.',
  ],
  12: [
    'Reflexele bebelușului se dezvoltă: dacă îi atingi palma, o strânge.',
    'Ecografia de 12 săptămâni + translucența nucală — cel mai important consult al trimestrului.',
  ],
  13: [
    'Amprentele bebelușului sunt deja formate — unice pentru totdeauna.',
    'Bine ai venit în trimestrul 2! Energia revine, grețurile scad.',
  ],
  14: [
    'Bebe face expresii faciale: se încruntă și schițează zâmbete.',
    'E un moment bun pentru mișcare blândă: plimbări, înot, yoga prenatală.',
  ],
  15: [
    'Bebe percepe lumina prin pleoapele închise și se mișcă activ, chiar dacă nu-l simți încă.',
    'Dormitul pe partea stângă îmbunătățește fluxul de sânge spre placentă.',
  ],
  16: [
    'Urechile s-au format — bebe începe să audă bătăile inimii tale.',
    'Pielea ta poate „străluci” acum — e fluxul sanguin crescut al sarcinii.',
  ],
  17: [
    'Bebe exersează suptul și înghițitul — se pregătește pentru alăptare.',
    'Începe să hidratezi pielea burticii: previi mâncărimile de la întindere.',
  ],
  18: [
    'Bebe cântărește cât o ceapă și poate face tumbe în lichidul amniotic.',
    'Primele mișcări se simt ca niște fluturași sau bule. Fii atentă azi!',
  ],
  19: [
    'Vernix caseosa — stratul protector cremos — acoperă acum pielea bebelușului.',
    'Junghiurile laterale la mișcări bruște sunt durerile de ligamente rotunde — normale.',
  ],
  20: [
    'Jumătatea sarcinii! Bebe are mărimea unei banane și papile gustative funcționale.',
    'Ecografia morfologică (18–22 săpt.) — poți afla și sexul, dacă vrei.',
  ],
  21: [
    'Bebe înghite lichid amniotic și simte gustul a ceea ce mănânci tu.',
    'Mănânci variat acum = bebe acceptă mai ușor gusturi noi la diversificare.',
  ],
  22: [
    'Bebe are sprâncene, gene și poate auzi vocea ta clar. Vorbește-i!',
    'Picioarele umflate seara? Ridică-le 15 minute și bea multă apă.',
  ],
  23: [
    'Auzul bebelușului se rafinează: recunoaște muzica pe care o asculți des.',
    'Mișcările devin tot mai clare. Un moment bun să implici partenerul.',
  ],
  24: [
    'Plămânii produc surfactant — pragul viabilității a fost atins. 🎉',
    'Testul de glucoză (24–28 săpt.) depistează diabetul gestațional la timp.',
  ],
  25: [
    'Bebe are un ciclu de somn și veghe — s-ar putea să-l simți activ exact când te culci tu.',
    'Arsuri la stomac? Mese mici și dese și nu te întinde imediat după masă.',
  ],
  26: [
    'Ochii bebelușului se deschid pentru prima dată în această săptămână. 👀',
    'Observă momentele de activitate ale bebelușului — un obicei util pentru trimestrul 3.',
  ],
  27: [
    'Bebe sughite des acum — simți mici zvâcniri ritmice? El e!',
    'Ultima săptămână de trimestru 2. Începe să te gândești la cursul de naștere.',
  ],
  28: [
    'Bebe visează! Somnul REM a apărut. Cântărește aproape 1 kg.',
    'De acum: numără zilnic mișcările — 10 în 2 ore e regula de aur.',
  ],
  29: [
    'Mușchii și plămânii se maturizează rapid. Bebe dă din picioare cu putere reală.',
    'Crampe nocturne la picioare? Magneziul și stretchingul înainte de culcare ajută.',
  ],
  30: [
    'Creierul bebelușului își formează circumvoluțiunile — suprafața creierului se pliază.',
    'Respirația scurtă e normală: uterul apasă pe diafragmă. Ia pauze.',
  ],
  31: [
    'Toate cele 5 simțuri funcționează: bebe distinge lumina și urmărește sunetele.',
    'Colostrul poate apărea deja — corpul tău se pregătește de alăptare.',
  ],
  32: [
    'Bebe exersează respirația: mișcă diafragma ritmic, deși nu respiră încă aer.',
    'Ecografia de trimestru 3 verifică poziția și creșterea. Programeaz-o.',
  ],
  33: [
    'Oasele bebelușului se întăresc — doar cele ale craniului rămân moi pentru naștere.',
    'Dormi cu o pernă între genunchi — spatele îți va mulțumi.',
  ],
  34: [
    'Unghiile au ajuns la vârful degetelor. Bebe are propriul program de somn.',
    'Contracțiile Braxton-Hicks se intensifică — neregulate și nedureroase = normale.',
  ],
  35: [
    'Bebe câștigă ~250 g pe săptămână. Spațiul e strâmt: mișcări mai lente, dar puternice.',
    'Geanta de maternitate: e momentul să o pregătești. Checklist-ul te așteaptă în aplicație.',
  ],
  36: [
    'Bebe coboară în pelvis — respiri mai ușor, dar vezica e tot mai presată.',
    'De acum consulturile sunt săptămânale. Monitorizează mișcările zilnic.',
  ],
  37: [
    'La termen timpuriu! Plămânii sunt gata. Bebe exersează suptul intens.',
    'Regula 5-1-1: contracții la 5 min, de 1 min, timp de 1 oră = pleci la maternitate.',
  ],
  38: [
    'Bebe are păr, unghii complete și strat de grăsime pentru termoreglare.',
    'Dopul gelatinos se poate elimina zilele acestea — semn că se apropie momentul.',
  ],
  39: [
    'Creierul bebelușului crește accelerat — va continua așa până la 3 ani.',
    'Odihnește-te, hidratează-te și ține geanta la ușă. Poate fi oricând!',
  ],
  40: [
    'Termenul a sosit! Doar ~5% dintre bebeluși vin exact la termen — răbdare.',
    'Contracții regulate care se intensifică = travaliu real. Suni maternitatea când vin la 5 minute.',
  ],
  41: [
    'Peste 41 de săptămâni medicul discută inducerea — ești monitorizată atent.',
    'Membrane rupte sau mișcări reduse = mergi imediat la maternitate.',
  ],
};

// =========================================================
// Copil — conținut per lună de vârstă (0–24)
// =========================================================
const CHILD_CONTENT: Record<number, string[]> = {
  0: [
    'Nou-născutul vede clar doar la 20–30 cm — exact distanța până la fața ta când îl hrănești.',
    'Plânsul e singurul lui limbaj. Răspunsul tău rapid nu îl „răsfață” — îi construiește încrederea.',
    'Câteva minute de tummy time pe zi, sub supraveghere, întăresc gâtul și umerii.',
  ],
  1: [
    'La 1 lună bebe recunoaște vocea ta dintre toate. E sunetul lui preferat.',
    'Primul zâmbet social apare între 4 și 8 săptămâni. Fii pe fază!',
    'Bebe vede acum contrastele: alb-negru îl fascinează mai mult decât pastelurile.',
  ],
  2: [
    'Bebe gângurește! Răspunde-i cu aceleași sunete — e prima voastră conversație.',
    'Ține capul la 45° pe burtică. Tummy time zilnic accelerează progresul.',
    'La 2 luni vine un vaccin important — verifică calendarul în aplicație.',
  ],
  3: [
    'Bebe își descoperă mâinile — le privește fascinat minute în șir.',
    'Râsul zgomotos poate apărea acum. Unul dintre cele mai frumoase momente!',
    'Somnul de noapte se poate consolida: 5–6 ore continue devin posibile.',
  ],
  4: [
    'Bebe apucă obiecte intenționat și le duce la gură — așa explorează lumea.',
    'Se poate rostogoli de pe burtă pe spate curând. Nu-l lăsa singur pe locuri înalte!',
    'Regresia de somn de la 4 luni e reală — ciclurile de somn se maturizează. Trece.',
  ],
  5: [
    'Bebe își recunoaște numele și întoarce capul când îl strigi.',
    'Sunetele repetate — ba-ba, ma-ma — sunt fundația vorbirii. Repetă-le cu el!',
    'Semnele pregătirii pentru diversificare: stă sprijinit și urmărește mâncarea cu privirea.',
  ],
  6: [
    'Jumătate de an! Bebe stă în șezut cu sprijin și mută obiecte dintr-o mână în alta.',
    'Diversificarea începe acum: un aliment nou la 3 zile, ca să depistezi alergiile.',
    'Anxietatea de separare poate apărea — bebe înțelege că exiști și când nu te vede.',
  ],
  7: [
    'Bebe aruncă jucăriile pe jos intenționat — nu te necăjește, învață cauza și efectul!',
    'Stă în șezut fără sprijin tot mai stabil. Pune perne în jur pentru siguranță.',
    'Texturile diferite dezvoltă mestecatul — treci de la pasat la zdrobit.',
  ],
  8: [
    'Bebe poate începe să se târască — unii sar direct la mers. Ambele sunt normale.',
    'Joacă cucu-bau! La 8 luni înțelege permanența obiectelor și jocul devine magic.',
    'Securizează casa acum: prize, colțuri, sertare. Mobilitatea vine repede.',
  ],
  9: [
    'Pensa digitală se dezvoltă: bebe apucă firimituri cu două degete.',
    'Bebe înțelege „nu” și cuvinte simple. Vorbește-i constant — vocabularul pasiv explodează.',
    'Se ridică în picioare ținându-se de mobilă. Primii pași se apropie!',
  ],
  10: [
    'Bebe imită gesturi: pa-pa, bravo, bezele. Oglinda socială funcționează!',
    'Primele cuvinte cu sens pot apărea: mama, tata, apa.',
    'Rutina de seară previzibilă = somn mai bun. Baie, carte, cântec — aceeași ordine zilnic.',
  ],
  11: [
    'Bebe merge ținut de o mână sau împingând un premergător. Echilibrul se construiește.',
    'Îi place să bage și să scoată obiecte din cutii — joc simplu, dezvoltare enormă.',
    'Citește-i zilnic: la 11 luni urmărește imaginile și întoarce paginile.',
  ],
  12: [
    'La mulți ani! 🎂 Un an de creștere incredibilă: greutatea s-a triplat de la naștere.',
    'Primii pași independenți vin în medie între 9 și 15 luni. Fiecare copil are ritmul lui.',
    'De la 1 an poate trece treptat la lapte de vacă integral și 3 mese + 2 gustări.',
  ],
  13: [
    'Mersul se stabilizează. Copilul cară obiecte în timp ce merge — multitasking de expert!',
    'Arată cu degetul ce vrea — răspunde-i numind obiectul: construiești vocabularul.',
    'Trecerea la un singur pui de somn se apropie — programul se reașază.',
  ],
  14: [
    'Copilul folosește lingurița singur — cu dezastru, dar cu progres. Lasă-l să exerseze!',
    'Înțelege comenzi simple: „adu mingea”, „vino la mama”.',
    'Imitația e la apogeu: mătură, vorbește la telefon, te copiază. Ești modelul lui total.',
  ],
  15: [
    'Vocabularul activ: 3–10 cuvinte. Cel pasiv: de 10 ori mai mare.',
    'Urcă scările de-a bușilea. Supraveghează, dar lasă-l să încerce.',
    'Crizele de frustrare încep — emoțiile cresc înaintea autocontrolului. E normal.',
  ],
  16: [
    'Copilul rezolvă probleme simple: trage scaunul ca să ajungă sus. Ingeniozitatea e inteligență!',
    'Cititul zilnic de acum dublează vocabularul de la 2 ani.',
    'Jocul paralel: se joacă lângă alți copii, nu încă împreună. E etapa firească.',
  ],
  17: [
    'Poate construi un turn din 3 cuburi și mâzgălește cu creionul. Motricitatea fină înflorește.',
    'Numiți împreună părțile corpului: „unde e nasul?” — învățare prin joacă.',
    'Rutinele previzibile reduc crizele: copilul e liniștit când știe ce urmează.',
  ],
  18: [
    'Explozia vocabularului începe: poate învăța un cuvânt nou pe zi de acum!',
    'La 18 luni apare empatia: te mângâie când ești tristă.',
    'Evaluarea de 18 luni la pediatru e importantă — include screening de dezvoltare.',
  ],
  19: [
    'Aleargă! Cu căzături, dar aleargă. Mișcarea liberă zilnică e esențială acum.',
    'Sortează forme și culori simple. Jocurile de sortare sunt fascinante la această vârstă.',
    '„Nu” devine cuvântul lui preferat — testarea limitelor e sănătoasă. Rămâi calmă și consecventă.',
  ],
  20: [
    'Propoziții din 2 cuvinte: „mama apa”, „vreau sus”. Limbajul devine instrument.',
    'Urcă și coboară scările ținându-se de balustradă.',
    'Implică-l în treburi mici: pune șosetele în coș. Se simte important și capabil.',
  ],
  21: [
    'Jocul simbolic apare: hrănește păpușa, conduce mașinuța. Imaginația s-a aprins!',
    'Poate sări pe loc cu ambele picioare — coordonarea face salturi mari.',
    'Anticipează tranzițiile: „încă 5 minute și mergem” reduce crizele de la plecare.',
  ],
  22: [
    'Copilul își spune numele. Identitatea de sine se conturează.',
    'Desenează linii verticale și cercuri. Fiecare mâzgălitură e antrenament pentru scris.',
    'Somnul la această vârstă: 11–14 ore în total pe zi, inclusiv puiul de somn.',
  ],
  23: [
    'Înțelege concepte opuse: mare-mic, sus-jos, cald-rece.',
    'Pedalatul pe tricicletă poate începe curând — echilibrul e aproape gata.',
    'Vorbește-i despre emoții: „ești supărat pentru că...”. Numirea emoțiilor le îmblânzește.',
  ],
  24: [
    'Doi ani! Vocabular de 50–200 de cuvinte și propoziții scurte. Conversațiile adevărate încep.',
    'Poate urma instrucțiuni din 2 pași: „ia cana și pune-o pe masă”.',
    '„Terrible twos” = independență în formare. În spatele fiecărui „nu” e un „pot singur”.',
  ],
};

// =========================================================
// Populare
// =========================================================
async function populate() {
  type ContentDoc = {
    id: string;
    audience: 'pregnancy' | 'child';
    week?: number;
    month?: number;
    order: number;
    body: string;
    enabled: boolean;
  };

  const docs: ContentDoc[] = [];

  for (const [week, items] of Object.entries(PREGNANCY_CONTENT)) {
    items.forEach((body, order) => {
      docs.push({
        id: `pregnancy_w${week}_${order}`,
        audience: 'pregnancy',
        week: Number(week),
        order,
        body,
        enabled: true,
      });
    });
  }

  for (const [month, items] of Object.entries(CHILD_CONTENT)) {
    items.forEach((body, order) => {
      docs.push({
        id: `child_m${month}_${order}`,
        audience: 'child',
        month: Number(month),
        order,
        body,
        enabled: true,
      });
    });
  }

  // Batch-uri de max 450 (limita Firestore e 500)
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    for (const { id, ...data } of docs.slice(i, i + 450)) {
      batch.set(db.doc(`notificationContent/${id}`), data, { merge: true });
    }
    await batch.commit();
  }

  console.log(`✓ Populated ${docs.length} notification content items`);
  console.log(`  - pregnancy: ${Object.values(PREGNANCY_CONTENT).flat().length} items (weeks 5-41)`);
  console.log(`  - child: ${Object.values(CHILD_CONTENT).flat().length} items (months 0-24)`);
}

populate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Populate failed:', error);
    process.exit(1);
  });
