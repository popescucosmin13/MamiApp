<div align="center">

<img src="assets/icon.png" alt="Logo MamiApp" width="104" />

# MamiApp

**Un loc pentru toate etapele maternității.**

Sarcină · Îngrijirea copilului · Familie · Comunitate

[**Deschide aplicația**](https://mamiapp.ro) &nbsp; · &nbsp; [**Google Play**](https://play.google.com/store/apps/details?id=ro.mamiapp.app)

React Native &nbsp; · &nbsp; Expo &nbsp; · &nbsp; TypeScript &nbsp; · &nbsp; Firebase

</div>

---

MamiApp reunește jurnale de sarcină și copil, un asistent AI, comunitate și instrumente pentru părinți. Interfața include traduceri în română și engleză și rulează pe Android, iOS și web.

## Funcționalități

- Urmărirea sarcinii: săptămâni, simptome, mișcări fetale, contracții și pregătirea nașterii.
- Jurnale pentru copil: hrănire, somn, scutece, creștere, vaccinuri și dezvoltare.
- Diversificare: alimente, mese, rețete, alergeni și liste de cumpărături.
- Asistent AI prin Firebase Cloud Functions, comunitate și articole.
- Documente, programări, partajare în familie și instrumente pentru starea de bine a mamei.
- Abonamente RevenueCat, notificări și panou de administrare separat.

## Tehnologii

| Componentă | Implementare |
| --- | --- |
| Aplicație | React Native 0.81, React 19, Expo SDK 54, TypeScript strict |
| Navigare | Expo Router 6 |
| Date și autentificare | Firebase Auth, Firestore și Storage |
| State și UI | Zustand, Reanimated, i18next |
| Backend AI | Cloud Functions și SDK Anthropic |
| Abonamente | RevenueCat |
| Administrare | React, Vite, TypeScript și Recharts |

## Structură

`src/` conține ecranele, componentele, serviciile, store-urile și traducerile. `functions/` conține backendul, `mamiapp-admin/` panoul de administrare, iar `public/` resursele PWA. Regulile Firebase și scripturile cu date de referință sunt incluse pentru studierea arhitecturii.

## Pornire pentru dezvoltare

Aceasta este o copie de portofoliu. Folosește un proiect Firebase separat, creat de tine. Valorile demonstrative trebuie completate înainte de autentificare, push sau utilizarea backendului.

```powershell
npm ci
Copy-Item .env.example .env.local
# Completează .env.local cu configurația propriului proiect Firebase.
npm run web
```

Pentru aplicația mobilă: `npm start`. Pentru backend: `cd functions`, `npm ci`, `npm run build`. Pentru panoul admin: `cd mamiapp-admin`, `npm ci`, copiază `.env.example` în `.env.local`, apoi `npm run dev`.

Ghidul de configurare este în [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), iar prezentarea arhitecturii în [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Despre această copie

Repository-ul folosește configurații demonstrative și nu include date ale utilizatorilor, credențiale private sau istoricul aplicației de producție. Integrarea cu servicii externe necesită propriile conturi și configurări. Funcțiile medicale și AI sunt instrumente informative și nu înlocuiesc consultul medical.

Codul și brandingul sunt prezentate pentru portofoliu. Nu este acordată o licență open-source; utilizarea și redistribuirea necesită permisiunea titularului. Licențele fonturilor incluse sunt păstrate lângă resurse.
