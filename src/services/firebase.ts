import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  connectAuthEmulator,
  type Persistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  CACHE_SIZE_UNLIMITED,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { Platform } from 'react-native';

// Configurare Firebase — înlocuiește cu datele din consola Firebase
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'your-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'your-auth-domain',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'your-storage-bucket',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'your-sender-id',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'your-app-id',
};

// Inițializează app o singură dată
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─── Auth cu persistență corectă per platformă ───────────────────────────────
//
// Web → browserLocalPersistence  (localStorage, supraviețuiește refresh-ului)
// Android/iOS → getReactNativePersistence(AsyncStorage)
//
let auth: ReturnType<typeof getAuth>;
try {
  let persistence: Persistence;

  if (Platform.OS === 'web') {
    // Pe web folosim IndexedDB cu fallback la localStorage
    persistence = indexedDBLocalPersistence;
  } else {
    // Pe native importăm dinamic ca să nu crape web bundle-ul
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    persistence = getReactNativePersistence(AsyncStorage);
  }

  auth = initializeAuth(app, { persistence });
} catch {
  // Dacă initializeAuth a fost deja apelat (hot reload) folosim instanța existentă
  auth = getAuth(app);
}

// Firestore cu offline persistence activată
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: Platform.OS === 'android',
});

let storageInstance: any;
let functionsInstance: any;
let functionsEuropeInstance: any;
let lazyEmulatorsConnected = false;

// ─── Emulatori locali ────────────────────────────────────────────────────────
// Setează EXPO_PUBLIC_USE_EMULATOR=true în .env.local pentru dezvoltare locală
if (process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
  const EMULATOR_HOST = '10.0.2.2'; // Android emulator → localhost al PC-ului
  //                    '127.0.0.1' // iOS simulator sau web
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  console.log('🔧 Firebase Emulators conectați');
}

async function connectLazyEmulatorsIfNeeded() {
  if (process.env.EXPO_PUBLIC_USE_EMULATOR !== 'true' || lazyEmulatorsConnected) return;
  const EMULATOR_HOST = '10.0.2.2';
  const [{ connectStorageEmulator }, { connectFunctionsEmulator }] = await Promise.all([
    import('firebase/storage'),
    import('firebase/functions'),
  ]);
  if (storageInstance) connectStorageEmulator(storageInstance, EMULATOR_HOST, 9199);
  if (functionsInstance) connectFunctionsEmulator(functionsInstance, EMULATOR_HOST, 5001);
  if (functionsEuropeInstance) connectFunctionsEmulator(functionsEuropeInstance, EMULATOR_HOST, 5001);
  lazyEmulatorsConnected = true;
}

export async function getFirebaseStorage() {
  if (!storageInstance) {
    const { getStorage } = await import('firebase/storage');
    storageInstance = getStorage(app);
    await connectLazyEmulatorsIfNeeded();
  }
  return storageInstance;
}

export async function getFirebaseFunctions(region = 'us-central1') {
  if (region === 'europe-west1') {
    if (!functionsEuropeInstance) {
      const { getFunctions } = await import('firebase/functions');
      functionsEuropeInstance = getFunctions(app, 'europe-west1');
      await connectLazyEmulatorsIfNeeded();
    }
    return functionsEuropeInstance;
  }

  if (!functionsInstance) {
    const { getFunctions } = await import('firebase/functions');
    functionsInstance = getFunctions(app, 'us-central1');
    await connectLazyEmulatorsIfNeeded();
  }
  return functionsInstance;
}

export { app, auth, db };
