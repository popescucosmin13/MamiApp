# Arhitectură

Aplicația folosește Expo Router pentru ecrane și module. Componentele UI și tema sunt separate de servicii, tipuri și store-uri Zustand. Traducerile sunt gestionate prin i18next.

Serviciile Firebase gestionează autentificarea, documentele Firestore și fișierele Storage. Unele fluxuri folosesc actualizări optimiste și sincronizare în fundal. Datele sunt organizate în jurul utilizatorului, sarcinii și copiilor.

Cloud Functions implementează operațiuni de backend pentru AI, conturi, notificări și administrare. Clientul nu conține cheia privată a furnizorului AI. Codul backend inclus folosește SDK Anthropic.

Panoul admin este o aplicație React/Vite separată. Autorizarea trebuie verificată de backend și regulile Firebase ale proiectului de dezvoltare.

RevenueCat gestionează integrarea abonamentelor. Resursele PWA includ manifestul, service workerul și fluxuri web de autentificare.

Configurațiile native și asocierea domeniului se configurează pentru propriul proiect. Codul Data Connect experimental, fișierele native generate și documentația operațională nu fac parte din această copie.
