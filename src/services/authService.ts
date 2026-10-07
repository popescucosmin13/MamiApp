import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  limit,
} from 'firebase/firestore';
import { auth, db, getFirebaseFunctions } from './firebase';
import { UserProfile, UserSubscription } from '../types/auth';
import { getCurrentLanguage } from '../i18n';

const AUTH_RETRY_DELAYS_MS = [400, 900, 1600];
let verificationAuthBypass = false;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshUser(user: User) {
  await user.getIdToken(true).catch(() => {});
  await user.reload();
}

function isTransientFunctionError(err: any) {
  return [
    'functions/unavailable',
    'functions/deadline-exceeded',
    'functions/internal',
    'functions/unknown',
  ].includes(err?.code);
}

async function callWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      if (!isTransientFunctionError(err) || attempt === AUTH_RETRY_DELAYS_MS.length) {
        throw err;
      }
      await wait(AUTH_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

async function callSendVerificationEmail() {
  const [{ httpsCallable }, functionsEurope] = await Promise.all([
    import('firebase/functions'),
    getFirebaseFunctions('europe-west1'),
  ]);
  return httpsCallable(functionsEurope, 'sendVerificationEmail')();
}

export function isVerificationAuthBypassActive() {
  return verificationAuthBypass;
}

function setVerificationAuthBypass(active: boolean) {
  verificationAuthBypass = active;
}

async function waitForVerifiedEmail(user: User) {
  await refreshUser(user);
  if (user.emailVerified) return true;

  for (const delay of AUTH_RETRY_DELAYS_MS) {
    await wait(delay);
    await refreshUser(user);
    if (user.emailVerified) return true;
  }

  return false;
}

export type RegisterWithEmailResult = {
  user: User;
  verificationEmailQueued: boolean;
  verificationEmailError?: string;
};

export const authService = {
  // Înregistrare cu email și parolă
  async registerWithEmail(
    email: string,
    password: string,
    displayName: string
  ): Promise<RegisterWithEmailResult> {
    setVerificationAuthBypass(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });
      await authService.createUserProfile(credential.user, displayName);
      let verificationEmailQueued = true;
      let verificationEmailError: string | undefined;

      try {
        await refreshUser(credential.user);
        await callWithRetry(() => callSendVerificationEmail());
      } catch (err: any) {
        verificationEmailQueued = false;
        verificationEmailError = err?.code || err?.message || 'unknown';
        console.warn('Custom verification email failed', verificationEmailError, err?.message);
      } finally {
        await signOut(auth);
      }

      return {
        user: credential.user,
        verificationEmailQueued,
        verificationEmailError,
      };
    } finally {
      setVerificationAuthBypass(false);
    }
  },

  // Login cu email și parolă
  async loginWithEmail(email: string, password: string): Promise<User> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const isVerified = await waitForVerifiedEmail(credential.user);
    if (!isVerified) {
      await signOut(auth);
      const error = new Error('Email address is not verified.') as Error & { code: string };
      error.code = 'auth/email-not-verified';
      throw error;
    }
    return credential.user;
  },

  async loginWithGoogleIdToken(idToken: string): Promise<User> {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    const existingProfile = await authService.getUserProfile(result.user.uid);

    if (!existingProfile) {
      await authService.createUserProfile(
        result.user,
        result.user.displayName || result.user.email?.split('@')[0] || 'MamiApp'
      );
    }

    return result.user;
  },

  async sendVerificationEmail(user?: User | null): Promise<void> {
    user = user ?? auth.currentUser;
    if (!user) {
      const error = new Error('No authenticated user.') as Error & { code: string };
      error.code = 'auth/no-current-user';
      throw error;
    }
    await callWithRetry(() => callSendVerificationEmail());
  },

  async resendVerificationEmail(email: string, password: string): Promise<void> {
    setVerificationAuthBypass(true);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    try {
      await refreshUser(credential.user);
      if (credential.user.emailVerified) {
        const error = new Error('Email is already verified.') as Error & { code: string };
        error.code = 'auth/email-already-verified';
        throw error;
      }
      await callWithRetry(() => callSendVerificationEmail());
    } finally {
      await signOut(auth);
      setVerificationAuthBypass(false);
    }
  },

  // Logout
  async logout(): Promise<void> {
    await signOut(auth);
  },

  // Reset parolă — trimite email cu link către pagina custom de resetare
  async resetPassword(email: string): Promise<void> {
    // Pagina custom de resetare parolă (public/reset-password.html).
    // Firebase redirecționează utilizatorul aici cu ?mode=resetPassword&oobCode=...
    // Înlocuiește domeniul dacă aplicația e găzduită pe alt URL.
    const continueUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password.html`
      : 'https://your-firebase-project.web.app/reset-password.html';

    await sendPasswordResetEmail(auth, email, {
      url: continueUrl,
      handleCodeInApp: false,
    });
  },

  // Creează profilul utilizatorului în Firestore
  async createUserProfile(user: User, displayName: string): Promise<void> {
    const userRef = doc(db, 'users', user.uid);
    const defaultSubscription: UserSubscription = {
      plan: 'free',
      status: 'active',
    };
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName,
      locale: getCurrentLanguage(),
      timezone: 'Europe/Bucharest',
      subscription: defaultSubscription,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      onboardingCompleted: false,
      profileMode: 'child',
      preferences: {
        notifications: {
          vaccines: true,
          meals: true,
          sleep: true,
          appointments: true,
          aiSummary: true,
          community: true,
          milestones: true,
          dailyContent: true,
        },
        theme: 'auto',
        appearance: {
          accent: 'coral',
          textSize: 'medium',
          compact: false,
        },
        quietHoursStart: 22,
        quietHoursEnd: 7,
      },
    });
  },

  // Obține profilul utilizatorului
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    return snap.exists() ? (snap.data() as UserProfile) : null;
  },

  // Actualizează profilul
  async updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const includesAppInfo =
      data.appVersion !== undefined ||
      data.appBuildVersion !== undefined ||
      data.appPlatform !== undefined ||
      data.appOwnership !== undefined ||
      data.appInstallSource !== undefined ||
      data.appInstallSourceDetail !== undefined ||
      data.serviceWorkerVersion !== undefined;

    await updateDoc(userRef, {
      ...data,
      ...(includesAppInfo ? { appLastSeenAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
  },

  // Verifică dacă userul are deja date de setup (copii sau sarcina)
  async checkUserHasSetupData(userId: string): Promise<boolean> {
    const childrenSnap = await getDocs(query(collection(db, 'users', userId, 'children'), limit(1)));
    if (!childrenSnap.empty) return true;
    const pregnancySnap = await getDoc(doc(db, 'users', userId, 'pregnancy', 'current'));
    return pregnancySnap.exists();
  },

  // Observă starea autentificării
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },
};
