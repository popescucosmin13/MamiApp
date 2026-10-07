# Configurare pentru dezvoltare

Folosește Node.js 22 și npm. Fiecare subproiect are propriul package-lock.json.

## Aplicație

1. Rulează `npm ci`.
2. Copiază `.env.example` în `.env.local` și completează configurația propriului proiect Firebase. Variabilele `EXPO_PUBLIC_` sunt vizibile în client: nu pune chei private în ele.
3. Activează furnizorii de autentificare folosiți și configurează domeniile și clienții OAuth pentru propriul proiect.
4. Rulează `npm run web` sau `npm start`.

`npm run build:web` generează exportul web. `npx tsc --noEmit` verifică tipurile aplicației.

## Backend

În `functions/`, rulează `npm ci` și `npm run build`. Valorile din `.env.example` sunt demonstrative. Configurează separat secretele backendului, inclusiv `ANTHROPIC_API_KEY` și secretul webhookului RevenueCat, folosind propriul proiect Firebase. Nu include valorile lor în Git.

Regulile și funcțiile incluse sunt surse de portofoliu. Instalarea backendului, configurarea secretelor, conturilor și rolurilor și verificarea regulilor în emulator trebuie făcute înainte de folosirea cu date reale. Nu publica această copie direct peste aplicația existentă.

## Panou admin

În `mamiapp-admin/`, rulează `npm ci`, copiază `.env.example` în `.env.local`, completează configurația Firebase și rulează `npm run dev`. `npm run build` verifică tipurile și generează bundle-ul. Nu sunt incluse conturi sau credențiale administrative.

## PWA și builduri native

În `public/sw-custom.js` și `public/reset-password.html`, înlocuiește valorile `YOUR_...` cu configurația publică a propriului proiect Firebase. Pushul PWA rămâne dezactivat până la configurare. Actualizează domeniile demonstrative și linkurile de autentificare pentru mediul tău.

Configurația Expo folosește un identificator de aplicație demonstrativ. Pentru EAS, creează propriul proiect și configurează-l cu `eas init`. Generează proiectele native cu Expo; adaugă propriul `google-services.json` local dacă ai nevoie de push Android și configurează `android.googleServicesFile`. OTA, App Links și trimiterea în magazine trebuie configurate în propriile conturi.

Scripturile `scripts/populate-master-data.ts` și `scripts/populate-notification-content.ts` conțin date de referință, nu exporturi ale utilizatorilor. Necesită configurarea unui cont de serviciu local pentru propriul proiect; fișierul este exclus din Git.
