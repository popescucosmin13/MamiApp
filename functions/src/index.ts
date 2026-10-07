import * as functions from 'firebase-functions/v2/https';
import * as scheduledFunctions from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, Query, FieldValue, FieldPath } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';

if (!getApps().length) initializeApp();

export {
  notificationOrchestrator,
  onCommunityCommentCreated,
  onNotificationLogOpened,
  sendSmartTestNotification,
  sendOnboardingDripEmails,
} from './smartNotifications';
const db = getFirestore();
const auth = getAuth();

const EMAIL_VERIFICATION_CONTINUE_URL =
  process.env.EMAIL_VERIFICATION_CONTINUE_URL || 'https://example.com/email-confirmed';
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || 'https://example.com';
const DEFAULT_TRANSACTIONAL_EMAIL = 'MamiApp <noreply@example.com>';
const MAIL_FROM = process.env.MAMIAPP_TRANSACTIONAL_FROM || DEFAULT_TRANSACTIONAL_EMAIL;
const MAIL_REPLY_TO = process.env.MAMIAPP_TRANSACTIONAL_REPLY_TO || 'noreply@example.com';
/** Logo-ul MamiApp folosit în emailuri — servit din Firebase Hosting. */
const EMAIL_LOGO_URL = process.env.MAMIAPP_EMAIL_LOGO_URL || 'https://example.com/assets/icon.png';
const EMAIL_UNSUBSCRIBE_URL =
  process.env.EMAIL_UNSUBSCRIBE_URL ||
  `https://us-central1-${process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'your-firebase-project'}.cloudfunctions.net/unsubscribeEmail`;

type FeatureScope = 'all' | 'admin' | 'beta' | 'premium' | 'none';

const DEFAULT_SERVER_FEATURE_FLAGS: Record<string, { enabled: boolean; enabledFor: FeatureScope }> = {
  enableAiAssistant: { enabled: true, enabledFor: 'all' },
  enableFamilySharing: { enabled: true, enabledFor: 'premium' },
};

function getActivePlan(userData: FirebaseFirestore.DocumentData | undefined): 'free' | 'basic' | 'premium' {
  const subscription = userData?.subscription || {};
  return subscription?.status === 'active' && ['basic', 'premium'].includes(subscription?.plan)
    ? subscription.plan
    : 'free';
}

async function assertFeatureAllowed(uid: string, featureKey: keyof typeof DEFAULT_SERVER_FEATURE_FLAGS) {
  const [userDoc, flagDoc] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`featureFlags/${featureKey}`).get(),
  ]);
  const userData = userDoc.data();
  const plan = getActivePlan(userData);
  const fallback = DEFAULT_SERVER_FEATURE_FLAGS[featureKey];
  const rawFlag = flagDoc.exists ? flagDoc.data() : {};
  const enabled = typeof rawFlag?.enabled === 'boolean' ? rawFlag.enabled : fallback.enabled;
  const enabledFor = (rawFlag?.enabledFor || fallback.enabledFor) as FeatureScope;
  const isBeta = Boolean(userData?.isBetaTester || userData?.betaTester);

  const allowed =
    enabled &&
    (
      enabledFor === 'all' ||
      (enabledFor === 'premium' && plan === 'premium') ||
      (enabledFor === 'beta' && (isBeta || plan === 'premium'))
    );

  if (!allowed) {
    throw new functions.HttpsError('permission-denied', 'Funcția nu este disponibilă pentru acest cont.', {
      reason: 'FEATURE_NOT_ALLOWED',
      featureKey,
      enabled,
      enabledFor,
      plan,
    });
  }

  return { userDoc, userData, plan };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emailUnsubscribeDocId(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function unsubscribeUrl(token: string) {
  return `${EMAIL_UNSUBSCRIBE_URL}?token=${encodeURIComponent(token)}`;
}

function appendUnsubscribeFooter(html: string, url: string) {
  const safeUrl = escapeHtml(url);
  const footer = `
    <div style="margin-top:32px;padding-top:18px;border-top:1px solid #eadfe7;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a7580;text-align:center;">
      Primești acest email pentru că ai cont MamiApp sau ai fost contactată prin platformă.
      <br />
      Dacă nu mai vrei să primești emailuri de la noi, te poți
      <a href="${safeUrl}" style="color:#D88FA8;text-decoration:underline;">dezabona aici</a>.
    </div>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }

  return `${html}${footer}`;
}

function buildVerificationEmailHtml(displayName: string, verificationLink: string) {
  const safeName = escapeHtml(displayName);
  const safeLink = escapeHtml(verificationLink);

  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Confirma adresa de e-mail</title>
</head>
<body style="margin:0;padding:0;background:#f7f3fb;font-family:Arial,Helvetica,sans-serif;color:#2b2233;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3fb;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(96,63,128,0.14);">
          <tr>
            <td style="background:linear-gradient(135deg,#f7b6cf 0%,#b99cff 55%,#7cd4d0 100%);padding:36px 30px;text-align:center;">
              <img src="${EMAIL_LOGO_URL}" width="64" height="64" alt="MamiApp" style="display:block;margin:0 auto 10px;border-radius:18px;" />
              <div style="display:inline-block;background:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.35);border-radius:999px;padding:8px 16px;color:#ffffff;font-size:13px;font-weight:700;">MamiApp</div>
              <h1 style="margin:22px 0 8px;font-size:30px;line-height:1.2;color:#ffffff;font-weight:800;">Confirm&#259; adresa de e-mail</h1>
              <p style="margin:0;color:#ffffff;font-size:16px;line-height:1.6;opacity:0.95;">Ultimul pas pentru activarea contului t&#259;u.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 34px 12px;">
              <p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#2b2233;">Bun&#259;, <strong>${safeName}</strong>,</p>
              <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#594d63;">&#206;&#539;i mul&#539;umim c&#259; ai creat un cont &#238;n <strong>MamiApp</strong>. Pentru siguran&#539;a contului t&#259;u, confirm&#259; adresa de e-mail ap&#259;s&#226;nd butonul de mai jos.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px auto;">
                <tr>
                  <td align="center" style="border-radius:999px;background:#8b5cf6;">
                    <a href="${safeLink}" target="_blank" style="display:inline-block;padding:16px 30px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;background:linear-gradient(135deg,#8b5cf6,#ec4899);box-shadow:0 14px 28px rgba(139,92,246,0.28);">Confirm&#259; adresa de e-mail</a>
                  </td>
                </tr>
              </table>
              <div style="background:#fff7fb;border:1px solid #f8d7e8;border-radius:18px;padding:18px 20px;margin:26px 0;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#75596a;">Dac&#259; nu ai creat tu acest cont, po&#539;i ignora acest email. Adresa nu va fi confirmat&#259; f&#259;r&#259; accesarea linkului.</p>
              </div>
              <p style="margin:22px 0 8px;font-size:14px;line-height:1.6;color:#7a6d82;">Dac&#259; butonul nu func&#539;ioneaz&#259;, copiaz&#259; acest link &#238;n browser:</p>
              <p style="margin:0;background:#f5f0f8;border-radius:14px;padding:14px;font-size:12px;line-height:1.5;color:#7a6d82;word-break:break-all;">${safeLink}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 34px 34px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#594d63;">Cu drag,<br /><strong>Echipa MamiApp</strong></p>
            </td>
          </tr>
          <tr>
            <td style="background:#fbf8fd;padding:22px 30px;text-align:center;border-top:1px solid #eee4f3;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#9b8aa5;">MamiApp - sprijin digital pentru p&#259;rin&#539;i</p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#b0a1b8;">Acest email a fost trimis automat. Te rug&#259;m s&#259; nu r&#259;spunzi direct la acest mesaj.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildCustomEmailActionLink(firebaseActionLink: string) {
  const firebaseUrl = new URL(firebaseActionLink);
  const customUrl = new URL('/email-action', APP_PUBLIC_URL);
  ['mode', 'oobCode', 'apiKey', 'lang'].forEach((key) => {
    const value = firebaseUrl.searchParams.get(key);
    if (value) customUrl.searchParams.set(key, value);
  });
  customUrl.searchParams.set('continueUrl', EMAIL_VERIFICATION_CONTINUE_URL);
  return customUrl.toString();
}

function buildFamilyInvitationEmailHtml(ownerName: string, role: string, inviteLink: string) {
  const safeOwnerName = escapeHtml(ownerName);
  const safeRole = escapeHtml(role);
  const safeInviteLink = escapeHtml(inviteLink);

  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Invitatie MamiApp</title>
</head>
<body style="margin:0;padding:0;background:#f7f3fb;font-family:Arial,Helvetica,sans-serif;color:#2b2233;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3fb;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(96,63,128,0.14);">
          <tr>
            <td style="background:linear-gradient(135deg,#e8997a 0%,#d88fa8 55%,#7a9e8c 100%);padding:34px 30px;text-align:center;">
              <img src="${EMAIL_LOGO_URL}" width="64" height="64" alt="MamiApp" style="display:block;margin:0 auto 10px;border-radius:18px;" />
              <div style="display:inline-block;background:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.35);border-radius:999px;padding:8px 16px;color:#ffffff;font-size:13px;font-weight:700;">MamiApp</div>
              <h1 style="margin:22px 0 8px;font-size:30px;line-height:1.2;color:#ffffff;font-weight:800;">Ai primit o invitatie</h1>
              <p style="margin:0;color:#ffffff;font-size:16px;line-height:1.6;opacity:0.95;">${safeOwnerName} te-a invitat sa faci parte din familie.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 34px 12px;">
              <p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#2b2233;">Buna,</p>
              <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#594d63;">
                Ai fost invitat(a) in <strong>MamiApp</strong> cu rolul <strong>${safeRole}</strong>. Accepta invitatia pentru a vedea informatiile partajate si permisiunile primite.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px auto;">
                <tr>
                  <td align="center" style="border-radius:999px;background:#e8997a;">
                    <a href="${safeInviteLink}" target="_blank" style="display:inline-block;padding:16px 30px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px;background:linear-gradient(135deg,#e8997a,#d88fa8);box-shadow:0 14px 28px rgba(232,153,122,0.28);">Accepta invitatia</a>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 8px;font-size:14px;line-height:1.6;color:#7a6d82;">Daca butonul nu functioneaza, copiaza acest link in browser:</p>
              <p style="margin:0;background:#f5f0f8;border-radius:14px;padding:14px;font-size:12px;line-height:1.5;color:#7a6d82;word-break:break-all;">${safeInviteLink}</p>
            </td>
          </tr>
          <tr>
            <td style="background:#fbf8fd;padding:22px 30px;text-align:center;border-top:1px solid #eee4f3;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9b8aa5;">Invitatia expira in 7 zile.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (html, [key, value]) => html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value),
    template
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getEmailTemplate(type: string) {
  const snap = await db.collection('emailTemplates')
    .where('type', '==', type)
    .limit(10)
    .get();
  const doc = snap.docs.find((item) => item.data().isActive === true);
  return doc ? doc.data() as { subject?: string; text?: string; html?: string } : null;
}

// =========================================================
// sendVerificationEmail - email custom prin extensia mail
// =========================================================
export const sendVerificationEmail = functions.onCall(
  { region: 'europe-west1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.HttpsError('unauthenticated', 'Utilizatorul nu este autentificat.');
    }

    const user = await auth.getUser(uid);
    if (!user.email) {
      throw new functions.HttpsError('failed-precondition', 'Utilizatorul nu are email.');
    }

    if (user.emailVerified) {
      return { ok: true, alreadyVerified: true };
    }

    let verificationLink: string;
    try {
      verificationLink = await auth.generateEmailVerificationLink(user.email, {
        url: EMAIL_VERIFICATION_CONTINUE_URL,
        handleCodeInApp: false,
      });
      verificationLink = buildCustomEmailActionLink(verificationLink);
    } catch (err) {
      console.error('Failed to generate verification link', {
        uid,
        email: user.email,
        continueUrl: EMAIL_VERIFICATION_CONTINUE_URL,
        error: err,
      });
      throw new functions.HttpsError(
        'failed-precondition',
        'Nu am putut genera linkul de verificare. Verifica domeniul autorizat in Firebase Auth.'
      );
    }

    const displayName = user.displayName || 'mamico';
    const templateValues = {
      displayName,
      verificationLink,
    };
    const template = await getEmailTemplate('auth_verify_email');
    const subject = template?.subject || 'Confirma adresa de e-mail pentru MamiApp';
    const text = template?.text
      ? renderTemplate(template.text, templateValues)
      : `Buna, ${displayName}. Confirma adresa de e-mail accesand acest link: ${verificationLink}`;
    const html = template?.html
      ? renderTemplate(template.html, {
          displayName: escapeHtml(displayName),
          verificationLink: escapeHtml(verificationLink),
        })
      : buildVerificationEmailHtml(displayName, verificationLink);

    try {
      await db.collection('mail').add({
        to: [user.email],
        from: MAIL_FROM,
        replyTo: MAIL_REPLY_TO,
        message: {
          subject,
          text,
          html,
        },
        metadata: {
          type: 'auth_verify_email',
          uid: user.uid,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to queue verification email', { uid, email: user.email, error: err });
      throw new functions.HttpsError('internal', 'Nu am putut pune emailul in coada de trimitere.');
    }

    return {
      ok: true,
      email: user.email,
    };
  }
);

// =========================================================
// getUsersAuthStatus - status email verificat pentru admin
// =========================================================
export const getUsersAuthStatus = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const rawUids = Array.isArray(request.data?.uids) ? request.data.uids : [];
    const uids = rawUids
      .filter((uid: unknown): uid is string => typeof uid === 'string' && uid.length > 0)
      .slice(0, 100);

    if (uids.length === 0) return { users: [] };

    const result = await auth.getUsers(uids.map((uid: string) => ({ uid })));
    return {
      users: result.users.map((user) => ({
        uid: user.uid,
        email: user.email || '',
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
      })),
    };
  }
);

// =========================================================
// getAdminChildrenOverview - sumar rapid pentru Copii & Sarcini
// =========================================================
export const getAdminChildrenOverview = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const cacheRef = db.doc('adminCache/childrenOverview');
    const cacheSnap = await cacheRef.get();
    const cachedAt = cacheSnap.data()?.computedAt?.toMillis?.() || 0;
    if (cacheSnap.exists && cacheSnap.data()?.schemaVersion === 2 && Date.now() - cachedAt < 2 * 60 * 1000) return cacheSnap.data()?.result;

    const now = new Date();
    const monthsAgo = (months: number) => {
      const date = new Date(now);
      date.setMonth(date.getMonth() - months);
      return Timestamp.fromDate(date);
    };
    const yearsAgo = (years: number) => {
      const date = new Date(now);
      date.setFullYear(date.getFullYear() - years);
      return Timestamp.fromDate(date);
    };
    const nowTimestamp = Timestamp.fromDate(now);
    const in60Days = Timestamp.fromMillis(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const children = db.collectionGroup('children');
    const safeCount = async (ref: FirebaseFirestore.Query) => {
      try {
        return (await ref.count().get()).data().count;
      } catch (error) {
        console.error('Children overview count failed', error);
        return 0;
      }
    };
    const safeDocs = async (ref: FirebaseFirestore.Query) => {
      try {
        return (await ref.get()).docs;
      } catch (error) {
        console.error('Children overview list failed', error);
        return [] as FirebaseFirestore.QueryDocumentSnapshot[];
      }
    };

    const [
      childrenCount,
      pregnancyCount,
      familyActive,
      familyAccepted,
      age0to3,
      age3to6,
      age6to12,
      age1to2,
      age2to5,
      recentChildrenSnap,
      recentPregnanciesSnap,
      vaccinesSnap,
    ] = await Promise.all([
      safeCount(children),
      safeCount(db.collection('users').where('profileMode', '==', 'pregnancy')),
      safeCount(db.collectionGroup('family_members').where('status', '==', 'active')),
      safeCount(db.collectionGroup('family_members').where('status', '==', 'accepted')),
      safeCount(children.where('birthDate', '>=', monthsAgo(3)).where('birthDate', '<=', nowTimestamp)),
      safeCount(children.where('birthDate', '>=', monthsAgo(6)).where('birthDate', '<', monthsAgo(3))),
      safeCount(children.where('birthDate', '>=', monthsAgo(12)).where('birthDate', '<', monthsAgo(6))),
      safeCount(children.where('birthDate', '>=', yearsAgo(2)).where('birthDate', '<', monthsAgo(12))),
      safeCount(children.where('birthDate', '>=', yearsAgo(5)).where('birthDate', '<', yearsAgo(2))),
      safeDocs(children.orderBy('birthDate', 'desc').limit(8)),
      safeDocs(db.collectionGroup('pregnancy').orderBy('dueDate', 'asc').limit(20)),
      safeDocs(db.collectionGroup('vaccines').where('scheduledDate', '>=', nowTimestamp).where('scheduledDate', '<=', in60Days).orderBy('scheduledDate', 'asc').limit(40)),
    ]);

    // Older profiles may store dates as strings or use a schema written before the
    // collection-group indexes existed. For a small dataset, normalize the real
    // documents instead of reporting a misleading all-zero dashboard.
    const useDocumentFallback = childrenCount <= 1_000;
    const fallbackChildren = useDocumentFallback ? await safeDocs(children.limit(1_000)) : [];
    const fallbackPregnancies = useDocumentFallback ? await safeDocs(db.collectionGroup('pregnancy').limit(1_000)) : [];
    const fallbackVaccines = useDocumentFallback ? await safeDocs(db.collectionGroup('vaccines').limit(2_000)) : [];
    const dateFromValue = (value: any): Date | null => {
      if (!value) return null;
      if (value?.toDate) return value.toDate();
      if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const fallbackAgeGroups = [0, 0, 0, 0, 0];
    fallbackChildren.forEach((doc) => {
      const birthDate = dateFromValue(doc.data().birthDate || doc.data().dateOfBirth || doc.data().birth_date);
      if (!birthDate || birthDate > now) return;
      const ageMonths = (now.getTime() - birthDate.getTime()) / (30.4375 * 24 * 60 * 60 * 1000);
      if (ageMonths < 3) fallbackAgeGroups[0]++;
      else if (ageMonths < 6) fallbackAgeGroups[1]++;
      else if (ageMonths < 12) fallbackAgeGroups[2]++;
      else if (ageMonths < 24) fallbackAgeGroups[3]++;
      else if (ageMonths < 60) fallbackAgeGroups[4]++;
    });
    const useFallbackAgeGroups = [age0to3, age3to6, age6to12, age1to2, age2to5].every((count) => count === 0) && fallbackAgeGroups.some((count) => count > 0);
    const childDocs = recentChildrenSnap.length ? recentChildrenSnap : [...fallbackChildren]
      .sort((left, right) => (dateFromValue(right.data().birthDate || right.data().dateOfBirth)?.getTime() || 0) - (dateFromValue(left.data().birthDate || left.data().dateOfBirth)?.getTime() || 0))
      .slice(0, 8);
    const pregnancyDocs = recentPregnanciesSnap.length ? recentPregnanciesSnap : [...fallbackPregnancies]
      .sort((left, right) => (dateFromValue(left.data().dueDate)?.getTime() || Number.MAX_SAFE_INTEGER) - (dateFromValue(right.data().dueDate)?.getTime() || Number.MAX_SAFE_INTEGER));
    const vaccineDocs = vaccinesSnap.length ? vaccinesSnap : fallbackVaccines
      .filter((doc) => {
        const vaccine = doc.data();
        const scheduled = dateFromValue(vaccine.scheduledDate);
        return vaccine.status !== 'completed' && vaccine.administered !== true && scheduled && scheduled >= now && scheduled <= new Date(in60Days.toMillis());
      })
      .sort((left, right) => (dateFromValue(left.data().scheduledDate)?.getTime() || 0) - (dateFromValue(right.data().scheduledDate)?.getTime() || 0));

    const ownerIds = new Set<string>();
    const userIdForNestedDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.ref.path.split('/')[1] || '';
    childDocs.forEach((doc) => ownerIds.add(userIdForNestedDoc(doc)));
    pregnancyDocs.forEach((doc) => ownerIds.add(userIdForNestedDoc(doc)));
    vaccineDocs.forEach((doc) => ownerIds.add(userIdForNestedDoc(doc)));
    const ownerRefs = [...ownerIds].filter(Boolean).map((uid) => db.doc(`users/${uid}`));
    const ownerSnaps = ownerRefs.length ? await db.getAll(...ownerRefs) : [];
    const ownerById = new Map(ownerSnaps.map((snap) => [snap.id, snap.data() || {}]));
    const ownerLabel = (uid: string) => {
      const owner = ownerById.get(uid) || {};
      return owner.displayName || owner.email || `${uid.slice(0, 8)}...`;
    };
    const iso = (value: any) => value?.toDate?.()?.toISOString() || (typeof value === 'string' ? value : null);
    const vaccineChildRefs = vaccineDocs.slice(0, 10).map((doc) => doc.ref.parent.parent).filter(Boolean) as FirebaseFirestore.DocumentReference[];
    const vaccineChildren = vaccineChildRefs.length ? await db.getAll(...vaccineChildRefs) : [];
    const vaccineChildNameByPath = new Map(vaccineChildren.map((snap) => [snap.ref.path, snap.data()?.name || 'Copil']));

    const result = {
      totalChildren: childrenCount,
      activePregnancies: pregnancyCount,
      sharedFamilyMembers: familyActive + familyAccepted,
      ageGroups: [
        { label: '0-3 luni', count: useFallbackAgeGroups ? fallbackAgeGroups[0] : age0to3, color: '#6366F1' },
        { label: '3-6 luni', count: useFallbackAgeGroups ? fallbackAgeGroups[1] : age3to6, color: '#8B5CF6' },
        { label: '6-12 luni', count: useFallbackAgeGroups ? fallbackAgeGroups[2] : age6to12, color: '#EC4899' },
        { label: '1-2 ani', count: useFallbackAgeGroups ? fallbackAgeGroups[3] : age1to2, color: '#10B981' },
        { label: '2-5 ani', count: useFallbackAgeGroups ? fallbackAgeGroups[4] : age2to5, color: '#F59E0B' },
      ],
      recentChildren: childDocs.map((doc) => {
        const child = doc.data();
        return { id: doc.id, name: child.name || 'Copil', owner: ownerLabel(userIdForNestedDoc(doc)), birthDate: iso(child.birthDate || child.dateOfBirth || child.birth_date), active: child.isActive === true };
      }),
      recentPregnancies: pregnancyDocs
        .filter((doc) => !['completed', 'archived'].includes(String(doc.data().status || 'active')))
        .slice(0, 8)
        .map((doc) => {
          const pregnancy = doc.data();
          return { id: doc.id, owner: ownerLabel(userIdForNestedDoc(doc)), currentWeek: pregnancy.currentWeek || pregnancy.week || null, dueDate: iso(pregnancy.dueDate), status: pregnancy.status || 'active' };
        }),
      upcomingVaccines: vaccineDocs
        .filter((doc) => doc.data().administered !== true)
        .slice(0, 10)
        .map((doc) => {
          const vaccine = doc.data();
          const childPath = doc.ref.parent.parent?.path || '';
          return { id: doc.id, childName: vaccine.childName || vaccineChildNameByPath.get(childPath) || 'Copil', owner: ownerLabel(userIdForNestedDoc(doc)), vaccineName: vaccine.name || vaccine.vaccineName || 'Vaccin', scheduledDate: iso(vaccine.scheduledDate) };
        }),
    };
    await cacheRef.set({ result, computedAt: Timestamp.now(), schemaVersion: 2 });
    return result;
  }
);

// =========================================================
// getAdminUsersPage - pagina de utilizatori pentru consola admin
// Nu citeste intreaga baza si nu parcurge toate conturile Auth.
// =========================================================
type AdminUserCursor = { createdAtMs: number; uid: string };

function serializeAdminUser(profileDoc: FirebaseFirestore.QueryDocumentSnapshot, authRecord?: import('firebase-admin/auth').UserRecord) {
  const profile = profileDoc.data();
  const providers = authRecord?.providerData.map((provider) => provider.providerId) ?? [];
  const usesGoogleAuth = providers.includes('google.com');
  const usesPasswordAuth = providers.includes('password');

  return {
    uid: profileDoc.id,
    email: profile.email || authRecord?.email || '',
    displayName: profile.displayName || authRecord?.displayName || '',
    profileMode: profile.profileMode || 'child',
    subscription: profile.subscription || { plan: 'free', status: 'inactive' },
    createdAt: profile.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: profile.updatedAt?.toDate?.()?.toISOString() || null,
    appLastSeenAt: profile.appLastSeenAt?.toDate?.()?.toISOString() || null,
    onboardingCompleted: profile.onboardingCompleted === true,
    locale: profile.locale || 'ro',
    emailVerified: authRecord?.emailVerified ?? profile.emailVerified ?? false,
    authDisabled: authRecord?.disabled ?? profile.authDisabled ?? false,
    authProviderIds: providers.length ? providers : (profile.authProviderIds || []),
    authProvider: usesGoogleAuth ? 'google.com' : usesPasswordAuth ? 'password' : profile.authProvider || 'unknown',
    authProviderLabel: usesGoogleAuth ? 'Google' : usesPasswordAuth ? 'Email/parola' : profile.authProviderLabel || 'Necunoscut',
    usesGoogleAuth: usesGoogleAuth || profile.usesGoogleAuth === true,
    usesPasswordAuth: usesPasswordAuth || profile.usesPasswordAuth === true,
    isPWA: profile.isPWA === true,
    platform: profile.platform || null,
    appVersion: profile.appVersion || null,
    appBuildVersion: profile.appBuildVersion || null,
    appPlatform: profile.appPlatform || null,
    appInstallSource: profile.appInstallSource || null,
    fcmToken: profile.fcmToken || null,
    webPushToken: profile.webPushToken || null,
    nativePushPlatform: profile.nativePushPlatform || null,
    nativePushRegisteredAt: profile.nativePushRegisteredAt?.toDate?.()?.toISOString() || null,
    serviceWorkerVersion: profile.serviceWorkerVersion || null,
    adminSummary: profile.adminSummary || null,
  };
}

export const getAdminUsersPage = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const pageSize = Math.min(Math.max(Number(request.data?.pageSize) || 50, 10), 100);
    const rawCursor = request.data?.cursor as AdminUserCursor | undefined;
    const cursor = rawCursor && Number.isFinite(rawCursor.createdAtMs) && typeof rawCursor.uid === 'string'
      ? rawCursor
      : null;

    let ref: FirebaseFirestore.Query = db.collection('users')
      .orderBy('createdAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc')
      .limit(pageSize + 1);
    if (cursor) {
      ref = ref.startAfter(Timestamp.fromMillis(cursor.createdAtMs), cursor.uid);
    }

    const snap = await ref.get();
    const pageDocs = snap.docs.slice(0, pageSize);
    const authResult = await auth.getUsers(pageDocs.map((doc) => ({ uid: doc.id })));
    const authByUid = new Map(authResult.users.map((user) => [user.uid, user]));
    const lastDoc = pageDocs.at(-1);
    const createdAt = lastDoc?.data().createdAt;

    return {
      users: pageDocs.map((doc) => serializeAdminUser(doc, authByUid.get(doc.id))),
      nextCursor: snap.docs.length > pageSize && lastDoc && createdAt?.toMillis
        ? { createdAtMs: createdAt.toMillis(), uid: lastDoc.id }
        : null,
      pageSize,
    };
  }
);

// =========================================================
// getAdminUsersOverview - agregate rapide, cache pentru consola admin
// =========================================================
export const getAdminUsersOverview = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const cacheRef = db.doc('adminCache/usersOverview');
    const cacheSnap = await cacheRef.get();
    const cachedAt = cacheSnap.data()?.computedAt?.toMillis?.() || 0;
    if (cacheSnap.exists && Date.now() - cachedAt < 5 * 60 * 1000) return cacheSnap.data()?.result;

    const since = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, premium, child, pregnancy, onboarded, active] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('users').where('subscription.plan', '==', 'premium').count().get(),
      db.collection('users').where('profileMode', '==', 'child').count().get(),
      db.collection('users').where('profileMode', '==', 'pregnancy').count().get(),
      db.collection('users').where('onboardingCompleted', '==', true).count().get(),
      db.collection('users').where('appLastSeenAt', '>=', since).count().get(),
    ]);
    const result = {
      totalUsers: total.data().count,
      premiumUsers: premium.data().count,
      childUsers: child.data().count,
      pregnantUsers: pregnancy.data().count,
      onboardingDone: onboarded.data().count,
      active7d: active.data().count,
    };
    await cacheRef.set({ result, computedAt: Timestamp.now() });
    return result;
  }
);

// =========================================================
// getAdminUsers - lista completa Auth + Firestore pentru administrare bulk
// Foloseste doar pentru exporturi sau selectii explicite, nu pentru lista UI.
// =========================================================
export const getAdminUsers = functions.onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, cors: true },
  async (request) => {
    await requireAdmin(request.auth?.uid);

    const profilesSnap = await db.collection('users').get();
    const profiles = new Map<string, FirebaseFirestore.DocumentData>();
    profilesSnap.docs.forEach((doc) => profiles.set(doc.id, doc.data()));

    const authUsers = [];
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      authUsers.push(...page.users);
      pageToken = page.pageToken;
    } while (pageToken);

    const authUids = new Set(authUsers.map((user) => user.uid));

    const normalizeDate = (value: unknown, fallback?: string) => {
      if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
      }
      if (typeof value === 'string') return value;
      return fallback || null;
    };

    const users: Array<Record<string, unknown> & { uid: string; createdAt: string | null }> = authUsers.map((user) => {
      const profile = profiles.get(user.uid) || {};
      const authProviderIds = user.providerData.map((provider) => provider.providerId);
      const usesGoogleAuth = authProviderIds.includes('google.com');
      const usesPasswordAuth = authProviderIds.includes('password');
      return {
        uid: user.uid,
        ...profile,
        email: profile.email || user.email || '',
        displayName: profile.displayName || user.displayName || '',
        profileMode: profile.profileMode || 'child',
        subscription: profile.subscription || { plan: 'free', status: 'inactive' },
        createdAt: normalizeDate(profile.createdAt, user.metadata.creationTime),
        updatedAt: normalizeDate(profile.updatedAt, user.metadata.lastSignInTime || user.metadata.creationTime),
        onboardingCompleted: profile.onboardingCompleted === true,
        locale: profile.locale || 'ro',
        emailVerified: user.emailVerified,
        authDisabled: user.disabled,
        lastSignInTime: user.metadata.lastSignInTime,
        authProviderIds,
        authProvider: usesGoogleAuth ? 'google.com' : usesPasswordAuth ? 'password' : authProviderIds[0] || 'unknown',
        authProviderLabel: usesGoogleAuth ? 'Google' : usesPasswordAuth ? 'Email/parola' : authProviderIds[0] || 'Necunoscut',
        usesGoogleAuth,
        usesPasswordAuth,
        authOnly: !profiles.has(user.uid),
      };
    });

    profiles.forEach((profile, uid) => {
      if (authUids.has(uid)) return;
      users.push({
        uid,
        ...profile,
        email: profile.email || '',
        displayName: profile.displayName || '',
        profileMode: profile.profileMode || 'child',
        subscription: profile.subscription || { plan: 'free', status: 'inactive' },
        createdAt: normalizeDate(profile.createdAt),
        updatedAt: normalizeDate(profile.updatedAt),
        onboardingCompleted: profile.onboardingCompleted === true,
        locale: profile.locale || 'ro',
        emailVerified: false,
        authDisabled: false,
        lastSignInTime: '',
        authProviderIds: [],
        authProvider: 'missing_auth',
        authProviderLabel: 'Lipseste din Auth',
        usesGoogleAuth: false,
        usesPasswordAuth: false,
        authMissing: true,
      });
    });

    users.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return { users };
  }
);

// =========================================================
// getAdminUserStats — statistici detaliate pentru un utilizator (admin SDK, bypass rules)
// =========================================================
export const getAdminUserStats = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    await requireAdmin(request.auth?.uid);

    const { uid } = request.data as { uid: string };
    if (!uid || typeof uid !== 'string') {
      throw new functions.HttpsError('invalid-argument', 'uid este obligatoriu');
    }

    const today = new Date().toISOString().split('T')[0];

    // Date profil utilizator
    const userDoc = await db.doc(`users/${uid}`).get();
    const userData = userDoc.data() || {};

    // Copilul activ e marcat cu isActive:true — nu există activeChildId pe user doc
    const activeChildSnap = await db.collection(`users/${uid}/children`)
      .where('isActive', '==', true).limit(1).get();
    let activeChildId: string | undefined = activeChildSnap.docs[0]?.id;
    // Fallback: primul copil dacă niciunul nu e marcat activ
    if (!activeChildId) {
      const allKids = await db.collection(`users/${uid}/children`).limit(1).get();
      activeChildId = allKids.docs[0]?.id;
    }

    // Dispozitive înregistrate
    const devicesSnap = await db.collection(`users/${uid}/devices`).get();
    const devices = devicesSnap.docs.map(d => {
      const data = d.data();
      return {
        token: data.token || '',
        platform: data.platform || 'unknown',
        type: data.type || 'unknown',
        registeredAt: data.registeredAt?.toDate?.()?.toISOString() || null,
        lastUsed: data.lastUsed?.toDate?.()?.toISOString() || null,
      };
    });

    // Usage AI azi
    const todayUsageDoc = await db.doc(`users/${uid}/usage/${today}`).get();
    const aiToday = todayUsageDoc.exists ? (todayUsageDoc.data()?.aiRequests || 0) : 0;

    // Usage AI ultimele 7 zile
    const usageSnap = await db.collection(`users/${uid}/usage`).get();
    const aiUsageLast7 = usageSnap.docs
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 7)
      .map(d => ({
      date: d.id,
      aiRequests: d.data().aiRequests || 0,
      }));
    const aiTotal = aiUsageLast7.reduce((s: number, d: { aiRequests: number }) => s + d.aiRequests, 0);

    // Copii
    const childrenSnap = await db.collection(`users/${uid}/children`).get();
    const childrenCount = childrenSnap.size;
    const children = childrenSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || 'Copil',
        birthDate: data.birthDate?.toDate?.()?.toISOString() || null,
        isActive: data.isActive === true,
      };
    });
    const childModules = [
      { key: 'feeds', label: 'Mese' },
      { key: 'sleeps', label: 'Somn' },
      { key: 'diapers', label: 'Scutece' },
      { key: 'measurements', label: 'Crestere' },
      { key: 'vaccines', label: 'Vaccinuri' },
      { key: 'milestones', label: 'Etape' },
      { key: 'cdc_milestones', label: 'CDC' },
      { key: 'foods', label: 'Alimente' },
      { key: 'documents', label: 'Documente' },
      { key: 'teeth', label: 'Dinti' },
      { key: 'school', label: 'Scoala' },
    ];
    const moduleUsage = await Promise.all(children.map(async (child) => {
      const modules = await Promise.all(childModules.map(async (mod) => {
        const snap = await db.collection(`users/${uid}/children/${child.id}/${mod.key}`).count().get()
          .catch(() => null);
        return {
          ...mod,
          count: snap?.data().count || 0,
        };
      }));
      return {
        childId: child.id,
        childName: child.name,
        modules,
      };
    }));

    // Rezumat sarcina: se citeste numai la deschiderea dossier-ului utilizatorului.
    const pregnancyRef = db.doc(`users/${uid}/pregnancy/current`);
    const pregnancyModules = [
      { key: 'weight_logs', label: 'Greutate' },
      { key: 'symptoms', label: 'Simptome' },
      { key: 'movements', label: 'Miscari fetale' },
      { key: 'contractions', label: 'Contractii' },
      { key: 'appointments', label: 'Programari' },
      { key: 'vitals', label: 'Semne vitale' },
      { key: 'journal', label: 'Jurnal' },
      { key: 'questions', label: 'Intrebari medic' },
    ];
    const [pregnancyDoc, ...pregnancyCounts] = await Promise.all([
      pregnancyRef.get(),
      ...pregnancyModules.map((module) => pregnancyRef.collection(module.key).count().get().catch(() => null)),
    ]);
    const pregnancy = pregnancyDoc.exists ? pregnancyDoc.data() || {} : null;
    const lmpDate = pregnancy?.lmpDate?.toDate?.() || null;
    const calculatedWeek = lmpDate
      ? Math.max(0, Math.floor((Date.now() - lmpDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
      : null;
    const currentPregnancyWeek = pregnancy?.currentWeek || pregnancy?.week || calculatedWeek;
    const calculatedTrimester = typeof currentPregnancyWeek === 'number'
      ? currentPregnancyWeek <= 13 ? 1 : currentPregnancyWeek <= 27 ? 2 : 3
      : null;
    const pregnancyModuleUsage = pregnancyModules.map((module, index) => ({
      ...module,
      count: pregnancyCounts[index]?.data().count || 0,
    }));

    // Date tracking copil activ
    let feedsCount = 0, sleepsCount = 0, diapersCount = 0;
    let feedsLast7 = 0, sleepsLast7 = 0, diapersLast7 = 0;
    let totalSleepMinutes = 0;

    if (activeChildId) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const sevenDaysAgoTs = Timestamp.fromDate(sevenDaysAgo);

      const [feedsAllSnap, sleepsAllSnap, diapersAllSnap,
             feedsWeekSnap, sleepsWeekSnap, diapersWeekSnap] = await Promise.all([
        db.collection(`users/${uid}/children/${activeChildId}/feeds`).count().get(),
        db.collection(`users/${uid}/children/${activeChildId}/sleeps`).count().get(),
        db.collection(`users/${uid}/children/${activeChildId}/diapers`).count().get(),
        db.collection(`users/${uid}/children/${activeChildId}/feeds`)
          .where('timestamp', '>=', sevenDaysAgoTs).count().get(),
        db.collection(`users/${uid}/children/${activeChildId}/sleeps`)
          .where('startTime', '>=', sevenDaysAgoTs).get(),
        db.collection(`users/${uid}/children/${activeChildId}/diapers`)
          .where('timestamp', '>=', sevenDaysAgoTs).count().get(),
      ]);

      feedsCount  = feedsAllSnap.data().count;
      sleepsCount = sleepsAllSnap.data().count;
      diapersCount = diapersAllSnap.data().count;
      feedsLast7  = feedsWeekSnap.data().count;
      sleepsLast7 = sleepsWeekSnap.size;
      diapersLast7 = diapersWeekSnap.data().count;
      totalSleepMinutes = sleepsWeekSnap.docs.reduce(
        (s: number, d: FirebaseFirestore.QueryDocumentSnapshot) => s + (d.data().duration || 0), 0
      ) / 60;
    }

    // Sumarele zilnice (ultimele 7)
    const summariesSnap = await db.collection(`users/${uid}/summaries`).get();
    const summaries = summariesSnap.docs
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 7)
      .map(d => {
      const data = d.data() as any;
      return {
        date: d.id,
        feedsCount: data.feedsCount ?? 0,
        sleepMinutes: data.sleepMinutes ?? 0,
        diapersCount: data.diapersCount ?? 0,
      };
      });

    return {
      devices,
      aiToday,
      aiTotal,
      aiUsageLast7,
      feedsCount,
      sleepsCount,
      diapersCount,
      feedsLast7,
      sleepsLast7,
      diapersLast7,
      totalSleepMinutesLast7: Math.round(totalSleepMinutes),
      childrenCount,
      activeChildId: activeChildId || null,
      children,
      moduleUsage,
      pregnancy: pregnancy ? {
        dueDate: pregnancy.dueDate?.toDate?.()?.toISOString() || pregnancy.dueDate || null,
        startDate: pregnancy.startDate?.toDate?.()?.toISOString() || pregnancy.startDate || pregnancy.lmpDate?.toDate?.()?.toISOString() || pregnancy.lmpDate || null,
        currentWeek: currentPregnancyWeek,
        trimester: pregnancy.trimester || calculatedTrimester,
        modules: pregnancyModuleUsage,
      } : null,
      summaries,
      webPushToken: userData.webPushToken || null,
      fcmToken: userData.fcmToken || null,
    };
  }
);

// =========================================================
// setAdminUserAccess — blocheaza/deblocheaza accesul unui utilizator din admin
// =========================================================
export const setAdminUserAccess = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    const adminData = await requireAdmin(request.auth?.uid);
    const { uid, disabled } = request.data as { uid?: string; disabled?: boolean };

    if (!uid || typeof uid !== 'string') {
      throw new functions.HttpsError('invalid-argument', 'uid este obligatoriu');
    }
    if (typeof disabled !== 'boolean') {
      throw new functions.HttpsError('invalid-argument', 'disabled trebuie sa fie boolean');
    }
    if (uid === request.auth?.uid) {
      throw new functions.HttpsError('failed-precondition', 'Nu iti poti modifica propriul acces din admin.');
    }

    await auth.updateUser(uid, { disabled });
    await db.doc(`users/${uid}`).set({
      disabled,
      authDisabled: disabled,
      accessUpdatedAt: Timestamp.now(),
      accessUpdatedBy: adminData?.email || request.auth?.token.email || request.auth?.uid,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    await db.collection('adminAuditLogs').add({
      adminId: request.auth?.uid,
      adminEmail: adminData?.email || request.auth?.token.email || '',
      action: disabled ? 'disable_user' : 'enable_user',
      targetType: 'user',
      targetId: uid,
      timestamp: Timestamp.now(),
      metadata: { disabled },
    });

    return { success: true, uid, disabled };
  }
);

// =========================================================
// deleteAdminUser — stergere utilizator din admin (Auth + Firestore + Storage)
// =========================================================
export const deleteAdminUser = functions.onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 300, cors: true },
  async (request) => {
    const adminData = await requireAdmin(request.auth?.uid);
    const { uid } = request.data as { uid?: string };

    if (!uid || typeof uid !== 'string') {
      throw new functions.HttpsError('invalid-argument', 'uid este obligatoriu');
    }
    if (uid === request.auth?.uid) {
      throw new functions.HttpsError('failed-precondition', 'Nu iti poti sterge propriul cont din admin.');
    }

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    let authEmail = '';
    try {
      const authUser = await auth.getUser(uid);
      authEmail = authUser.email || '';
    } catch {
      // Contul poate exista doar in Firestore; continuam stergerea datelor disponibile.
    }

    try {
      const bucket = getStorage().bucket();
      await bucket.deleteFiles({ prefix: `users/${uid}/` });
    } catch (storageError) {
      console.warn('Failed to delete user storage files from admin delete:', { uid, storageError });
    }

    if (userSnap.exists) {
      await db.recursiveDelete(userRef);
    }

    try {
      await auth.deleteUser(uid);
    } catch (authError: any) {
      if (authError?.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    await db.collection('adminAuditLogs').add({
      adminId: request.auth?.uid,
      adminEmail: adminData?.email || request.auth?.token.email || '',
      action: 'delete_user',
      targetType: 'user',
      targetId: uid,
      timestamp: Timestamp.now(),
      metadata: {
        email: userSnap.data()?.email || authEmail || '',
        hadProfile: userSnap.exists,
      },
    });

    return { success: true, uid };
  }
);

async function requireAdmin(uid?: string) {
  if (!uid) {
    throw new functions.HttpsError('unauthenticated', 'Autentificare necesara');
  }

  const adminSnap = await db.doc(`adminUsers/${uid}`).get();
  if (!adminSnap.exists || adminSnap.data()?.isActive !== true) {
    throw new functions.HttpsError('permission-denied', 'Acces admin necesar');
  }

  return adminSnap.data();
}

function isExpoPushToken(token: unknown): token is string {
  return typeof token === 'string'
    && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

async function sendExpoPushChunk(messages: Array<Record<string, unknown>>) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push failed with ${response.status}`);
  }

  return response.json() as Promise<{ data?: Array<{ status?: string }> }>;
}

async function getCampaignUsers(targetAudience: string, inactiveDays?: number) {
  let ref: Query = db.collection('users');

  if (targetAudience === 'pregnancy' || targetAudience === 'trimester3') {
    ref = ref.where('profileMode', '==', 'pregnancy');
  } else if (targetAudience === 'premium') {
    ref = ref.where('subscription.plan', '==', 'premium');
  } else if (targetAudience === 'child' || targetAudience === 'child_0_6') {
    ref = ref.where('profileMode', '==', 'child');
  } else if (targetAudience === 'romania') {
    ref = ref.where('locale', 'in', ['ro', 'ro-RO']);
  } else if (targetAudience === 'android_native') {
    ref = ref.where('appPlatform', '==', 'android');
  } else if (targetAudience === 'google_play') {
    ref = ref.where('appInstallSource', '==', 'google_play');
  } else if (targetAudience === 'inactive_30' || targetAudience === 'inactive_custom') {
    const days = targetAudience === 'inactive_custom' ? (inactiveDays || 30) : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    ref = ref.where('updatedAt', '<=', Timestamp.fromDate(cutoff));
  }

  return ref.get();
}

// =========================================================
// getModuleStats — statistici agregate module + timp activ (admin)
// =========================================================
const MODULE_ROLLUP_SHARDS = 64;

function moduleRollupShard(uid: string) {
  return [...uid].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0) % MODULE_ROLLUP_SHARDS;
}

function moduleRollupKey(name: string) {
  return Buffer.from(name).toString('base64url');
}

// A shard per day distributes writes and keeps the admin aggregate independent of user count.
export const rollupModuleUsage = onDocumentWritten(
  { document: 'users/{uid}/moduleUsage/{day}', region: 'us-central1', memory: '256MiB' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after) return;

    const beforeModules = (before?.modules || {}) as Record<string, { views?: number; totalMinutes?: number; category?: string }>;
    const afterModules = (after.modules || {}) as Record<string, { views?: number; totalMinutes?: number; category?: string }>;
    const changes = [...new Set([...Object.keys(beforeModules), ...Object.keys(afterModules)])].map((name) => ({
      name,
      category: afterModules[name]?.category || beforeModules[name]?.category || 'general',
      views: (afterModules[name]?.views || 0) - (beforeModules[name]?.views || 0),
      totalMinutes: (afterModules[name]?.totalMinutes || 0) - (beforeModules[name]?.totalMinutes || 0),
    })).filter((change) => change.views !== 0 || change.totalMinutes !== 0);
    const totalMinutesDelta = (after.totalActiveMinutes || 0) - (before?.totalActiveMinutes || 0);
    const userDayDelta = before ? 0 : 1;
    if (changes.length === 0 && totalMinutesDelta === 0 && userDayDelta === 0) return;

    const { uid, day } = event.params;
    const rollupRef = db.doc(`analytics/moduleDaily/${day}/shards/${moduleRollupShard(uid)}`);
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(rollupRef);
      const currentData = current.data() || {};
      const modules = { ...(currentData.modules || {}) } as Record<string, { name: string; category: string; views: number; totalMinutes: number }>;
      for (const change of changes) {
        const key = moduleRollupKey(change.name);
        const existing = modules[key] || { name: change.name, category: change.category, views: 0, totalMinutes: 0 };
        modules[key] = {
          ...existing,
          category: change.category,
          views: Math.max(0, existing.views + change.views),
          totalMinutes: Math.max(0, existing.totalMinutes + change.totalMinutes),
        };
      }
      transaction.set(rollupRef, {
        day,
        modules,
        totalActiveMinutes: Math.max(0, (currentData.totalActiveMinutes || 0) + totalMinutesDelta),
        activeUserDays: Math.max(0, (currentData.activeUserDays || 0) + userDayDelta),
        updatedAt: Timestamp.now(),
      });
    });
    await db.doc('analytics/moduleStats').delete().catch(() => undefined);
  }
);

export const getModuleStats = functions.onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120, cors: true, invoker: 'public' },
  async (request) => {
    await requireAdmin(request.auth?.uid);

    const DAYS = 30;
    const CACHE_TTL_MS = 60 * 60 * 1000; // 1 oră

    // Returnăm cache dacă există și e proaspăt
    const cacheRef = db.collection('analytics').doc('moduleStats');
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      const cached = cacheSnap.data()!;
      const age = Date.now() - (cached.computedAt?.toMillis?.() ?? 0);
      if (age < Math.min(CACHE_TTL_MS, 5 * 60 * 1000)) return cached.result;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - DAYS);
    const startKey = startDate.toISOString().slice(0, 10);

    // Agregatele se citesc exclusiv din shard-urile zilnice (analytics/moduleDaily/...),
    // niciodată prin fan-out în subcollecția fiecărui utilizator.
    const moduleAgg: Record<string, { views: number; totalMinutes: number; category: string }> = {};
    let totalUserDays = 0;
    let totalActiveMinutes = 0;
    let usersWithData = 0;

    let rollupDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      rollupDocs = (await db.collectionGroup('shards').where('day', '>=', startKey).get()).docs;
    } catch (error) {
      console.error('Module roll-up query failed', error);
    }
    rollupDocs.forEach((rollupDoc) => {
      const data = rollupDoc.data();
      const modules = data.modules || {};
      totalUserDays += data.activeUserDays || 0;
      usersWithData += data.activeUserDays || 0;
      totalActiveMinutes += data.totalActiveMinutes || 0;
      Object.values(modules).forEach((stat: any) => {
        const agg = moduleAgg[stat.name] ?? { views: 0, totalMinutes: 0, category: stat.category || 'general' };
        agg.views += stat.views || 0;
        agg.totalMinutes += stat.totalMinutes || 0;
        moduleAgg[stat.name] = agg;
      });
    });

    const topModules = Object.entries(moduleAgg)
      .map(([name, s]) => ({ name, views: Math.round(s.views), totalMinutes: Math.round(s.totalMinutes), category: s.category }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    const result = {
      topModules,
      avgActiveMinutesPerUser: usersWithData > 0 ? Math.round(totalActiveMinutes / usersWithData * 10) / 10 : 0,
      totalActiveMinutes: Math.round(totalActiveMinutes),
      usersWithData,
      totalUsers: null,
      activeTrackingShards: totalUserDays,
      daysAnalyzed: DAYS,
    };

    await cacheRef.set({ result, computedAt: Timestamp.now() });
    return result;
  }
);

// =========================================================
// redeemPremiumVoucher - activeaza Premium prin cod voucher
// =========================================================
export const redeemPremiumVoucher = functions.onCall(
  { memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesara');
    }

    const rawCode = String(request.data?.code || '');
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (code.length < 4) {
      throw new functions.HttpsError('invalid-argument', 'Cod voucher invalid');
    }

    const voucherRef = db.doc(`premiumVouchers/${code}`);
    const userRef = db.doc(`users/${uid}`);
    const redemptionRef = db.doc(`voucherRedemptions/${code}_${uid}`);

    return db.runTransaction(async (tx) => {
      const [voucherSnap, redemptionSnap] = await Promise.all([
        tx.get(voucherRef),
        tx.get(redemptionRef),
      ]);

      if (!voucherSnap.exists) {
        throw new functions.HttpsError('not-found', 'Voucherul nu exista');
      }

      if (redemptionSnap.exists) {
        throw new functions.HttpsError('already-exists', 'Voucherul a fost deja folosit de acest cont');
      }

      const voucher = voucherSnap.data() as {
        isActive?: boolean;
        plan?: string;
        durationDays?: number;
        maxRedemptions?: number;
        redeemedCount?: number;
        expiresAt?: Timestamp;
      };

      if (voucher.isActive !== true) {
        throw new functions.HttpsError('failed-precondition', 'Voucherul este dezactivat');
      }

      if (voucher.expiresAt && voucher.expiresAt.toMillis() < Date.now()) {
        throw new functions.HttpsError('deadline-exceeded', 'Voucherul a expirat');
      }

      const maxRedemptions = Number(voucher.maxRedemptions || 1);
      const redeemedCount = Number(voucher.redeemedCount || 0);
      if (redeemedCount >= maxRedemptions) {
        throw new functions.HttpsError('resource-exhausted', 'Voucherul a atins limita de utilizari');
      }

      const durationDays = Math.max(1, Number(voucher.durationDays || 30));
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + durationDays * 86400000));
      const plan = voucher.plan === 'basic' ? 'basic' : 'premium';

      tx.set(redemptionRef, {
        code,
        userId: uid,
        plan,
        durationDays,
        redeemedAt: Timestamp.now(),
      });

      tx.update(voucherRef, {
        redeemedCount: redeemedCount + 1,
        updatedAt: Timestamp.now(),
      });

      tx.set(userRef, {
        subscription: {
          plan,
          status: 'active',
          source: 'voucher',
          provider: 'voucher',
          voucherCode: code,
          startedAt: Timestamp.now(),
          expiresAt,
          updatedAt: Timestamp.now(),
        },
        isPremium: plan === 'premium',
        updatedAt: Timestamp.now(),
      }, { merge: true });

      return {
        ok: true,
        plan,
        expiresAt: expiresAt.toMillis(),
      };
    });
  }
);

// =========================================================
// revenueCatWebhook - sincronizează abonamentele RevenueCat în Firestore
// FAIL-CLOSED: fără secretul REVENUECAT_WEBHOOK_AUTH setat, respinge orice cerere.
// De configurat DOAR când activezi RevenueCat:
//   1. RevenueCat Dashboard -> Integrations -> Webhooks
//   2. URL: https://us-central1-<project>.cloudfunctions.net/revenueCatWebhook
//   3. Authorization header: valoarea din REVENUECAT_WEBHOOK_AUTH
//   4. Setează variabila: firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH
//      (sau ca env var în deploy). Clientul deja face Purchases.logIn(firebaseUid),
//      deci app_user_id === uid Firebase.
// =========================================================
function safeAuthEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const REVENUECAT_GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
]);
const REVENUECAT_REVOKE_EVENTS = new Set([
  'EXPIRATION',
  'REFUND',
  'CHARGEBACK',
]);

export const revenueCatWebhook = functions.onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 },
  async (request, response) => {
    const expectedAuth = (process.env.REVENUECAT_WEBHOOK_AUTH || '').trim();

    // Fail-closed: fără secret configurat nu procesăm nimic (nimeni nu poate seta premium).
    if (!expectedAuth) {
      console.warn('revenueCatWebhook called but REVENUECAT_WEBHOOK_AUTH is not set — rejecting.');
      response.status(503).json({ error: 'Webhook not configured' });
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const providedAuth = String(request.get('Authorization') || '').trim();
    if (!providedAuth || !safeAuthEquals(providedAuth, expectedAuth)) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const event = (request.body?.event || {}) as Record<string, any>;
    const eventId = String(event.id || '');
    const type = String(event.type || '');
    const rawUserId = String(event.app_user_id || '');
    const aliases: string[] = Array.isArray(event.aliases) ? event.aliases.map(String) : [];

    if (type === 'TEST') {
      response.status(200).json({ ok: true, test: true });
      return;
    }

    // app_user_id poate fi anonim ($RCAnonymousID) înainte de logIn — încearcă aliasurile.
    const candidateIds = [rawUserId, ...aliases].filter(
      (id) => id && !id.startsWith('$RCAnonymousID')
    );
    const uid = candidateIds[0];
    if (!uid) {
      console.warn('revenueCatWebhook: no non-anonymous app_user_id', { eventId, type, rawUserId });
      response.status(200).json({ ok: true, skipped: 'anonymous' });
      return;
    }

    // Idempotență: nu procesa același event de două ori.
    if (eventId) {
      const eventRef = db.doc(`revenueCatEvents/${eventId}`);
      const claimed = await db.runTransaction(async (tx) => {
        const existing = await tx.get(eventRef);
        if (existing.exists) return false;
        tx.set(eventRef, { type, uid, receivedAt: Timestamp.now() });
        return true;
      });
      if (!claimed) {
        response.status(200).json({ ok: true, duplicate: true });
        return;
      }
    }

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.warn('revenueCatWebhook: user not found', { uid, eventId, type });
      response.status(200).json({ ok: true, skipped: 'user_not_found' });
      return;
    }

    const entitlementIds: string[] = Array.isArray(event.entitlement_ids)
      ? event.entitlement_ids.map(String)
      : event.entitlement_id
        ? [String(event.entitlement_id)]
        : [];
    const grantsPremium = entitlementIds.length === 0 || entitlementIds.includes('premium');
    const expirationMs = Number(event.expiration_at_ms || 0);

    let active: boolean;
    if (REVENUECAT_REVOKE_EVENTS.has(type)) {
      active = false;
    } else if (REVENUECAT_GRANT_EVENTS.has(type)) {
      active = true;
    } else {
      // CANCELLATION / BILLING_ISSUE / SUBSCRIPTION_PAUSED etc.: rămâne activ până la expirare.
      active = expirationMs > 0 ? expirationMs > Date.now() : false;
    }

    const isPremium = active && grantsPremium;
    const subscription: Record<string, unknown> = {
      plan: isPremium ? 'premium' : 'free',
      status: active ? 'active' : 'inactive',
      provider: 'revenuecat',
      source: 'revenuecat',
      lastEventType: type,
      updatedAt: Timestamp.now(),
    };
    if (expirationMs > 0) {
      subscription.expiresAt = Timestamp.fromMillis(expirationMs);
    }

    await userRef.set({
      subscription,
      isPremium,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    response.status(200).json({ ok: true, uid, isPremium, active });
  }
);

// =========================================================
// sendNotificationCampaign - trimite campanii create din admin
// =========================================================
export const sendNotificationCampaign = functions.onCall(
  { memory: '256MiB', timeoutSeconds: 120, cors: true },
  async (request) => {
    const adminData = await requireAdmin(request.auth?.uid);
    const { campaignId } = request.data as { campaignId?: string };

    if (!campaignId) {
      throw new functions.HttpsError('invalid-argument', 'campaignId este obligatoriu');
    }

    const campaignRef = db.doc(`notificationCampaigns/${campaignId}`);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) {
      throw new functions.HttpsError('not-found', 'Campania nu exista');
    }

    const campaign = campaignSnap.data() as {
      title?: string;
      body?: string;
      targetAudience?: string;
      status?: string;
      targetUid?: string;
      inactiveDays?: number;
    };

    if (!campaign.title || !campaign.body) {
      throw new functions.HttpsError('failed-precondition', 'Campania nu are titlu sau mesaj');
    }

    if (campaign.status === 'sent') {
      throw new functions.HttpsError('failed-precondition', 'Campania a fost deja trimisa');
    }

    let userDocs: FirebaseFirestore.DocumentSnapshot[];
    if (campaign.targetAudience === 'user_uid') {
      if (!campaign.targetUid) {
        throw new functions.HttpsError('invalid-argument', 'targetUid lipseste pentru audience user_uid');
      }
      const userSnap = await db.doc(`users/${campaign.targetUid}`).get();
      userDocs = userSnap.exists ? [userSnap] : [];
    } else {
      const usersSnap = await getCampaignUsers(campaign.targetAudience || 'all', campaign.inactiveDays);
      userDocs = usersSnap.docs;
    }

    // Separăm utilizatorii după tipul token-ului disponibil:
    // - expoMessages  → native iOS/Android (Expo Push Token)
    // - webPushTokens → PWA Android/iOS (FCM Web Registration Token)
    const expoMessages:    Array<Record<string, unknown>> = [];
    const webPushEntries:  Array<{ token: string; uid: string }> = [];

    userDocs.forEach((userDoc) => {
      const user = userDoc.data() ?? {};
      const notifData = {
        type: 'admin_campaign',
        campaignId,
        screen: '/(tabs)',
      };

      // Native app (Expo Push Token)
      if (isExpoPushToken(user.fcmToken)) {
        expoMessages.push({
          to: user.fcmToken,
          title: campaign.title,
          body: campaign.body,
          sound: 'default',
          priority: 'high',
          channelId: 'campaigns',
          data: notifData,
        });
      }

      // PWA (FCM Web Registration Token — salvat ca webPushToken)
      if (typeof user.webPushToken === 'string' && user.webPushToken.length > 20) {
        webPushEntries.push({ token: user.webPushToken, uid: userDoc.id });
      }
    });

    let sentCount = 0;
    let failedCount = 0;

    // ── Trimite la native (Expo Push API, max 100/chunk) ─────────────────────
    for (let i = 0; i < expoMessages.length; i += 100) {
      const chunk = expoMessages.slice(i, i + 100);
      try {
        const result = await sendExpoPushChunk(chunk);
        const statuses = result.data || [];
        statuses.forEach((ticket) => {
          if (ticket.status === 'ok') sentCount += 1;
          else failedCount += 1;
        });
        if (statuses.length === 0) sentCount += chunk.length;
      } catch (err) {
        console.error('Expo push chunk failed:', err);
        failedCount += chunk.length;
      }
    }

    // ── Trimite la PWA (FCM Web Push via Firebase Admin Messaging) ────────────
    const INVALID_TOKEN_CODES = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument',
    ]);

    for (const { token: webToken, uid } of webPushEntries) {
      try {
        // Data-only: afișarea o face exclusiv service worker-ul (evită dublarea)
        await getMessaging().send({
          token: webToken,
          data: {
            type: 'admin_campaign',
            campaignId,
            screen: '/(tabs)',
            title: campaign.title,
            body: campaign.body,
          },
          webpush: { headers: { Urgency: 'high' } },
        });
        sentCount += 1;
      } catch (webErr: any) {
        const code: string = webErr?.errorInfo?.code || webErr?.code || '';
        console.warn('Web push failed for token:', code || webErr?.message);
        failedCount += 1;

        // Token invalid = PWA dezinstalat sau permisiune revocată → ștergem token-ul
        if (INVALID_TOKEN_CODES.has(code)) {
          try {
            await db.doc(`users/${uid}`).update({
              webPushToken: FieldValue.delete(),
              webPushTokenRevokedAt: Timestamp.now(),
            });
            console.info(`Removed stale webPushToken for user ${uid}`);
          } catch (cleanupErr) {
            console.warn(`Failed to remove stale token for ${uid}:`, cleanupErr);
          }
        }
      }
    }

    await campaignRef.set({
      status: 'sent',
      sentAt: Timestamp.now(),
      sentCount,
      failedCount,
      expoSent: expoMessages.length,
      webSent:  webPushEntries.length,
      sentBy: adminData?.email || request.auth?.token.email || request.auth?.uid,
      audienceSize: userDocs.length,
    }, { merge: true });

    await db.collection('adminAuditLogs').add({
      adminId: request.auth?.uid,
      adminEmail: adminData?.email || request.auth?.token.email || '',
      action: 'send_campaign',
      targetType: 'notification_campaign',
      targetId: campaignId,
      timestamp: Timestamp.now(),
      metadata: { sentCount, failedCount, audienceSize: userDocs.length },
    });

    return { sentCount, failedCount, audienceSize: userDocs.length };
  }
);

// =========================================================
// sendEmailCampaign — trimite emailuri personalizate via mail collection
// =========================================================
export const sendEmailCampaign = functions.onCall(
  { memory: '256MiB', timeoutSeconds: 120, cors: true },
  async (request) => {
    const adminData = await requireAdmin(request.auth?.uid);
    const { campaignId } = request.data as { campaignId?: string };

    if (!campaignId) {
      throw new functions.HttpsError('invalid-argument', 'campaignId este obligatoriu');
    }

    const campaignRef = db.doc(`emailCampaigns/${campaignId}`);
    const campaignSnap = await campaignRef.get();
    if (!campaignSnap.exists) {
      throw new functions.HttpsError('not-found', 'Campania nu exista');
    }

    const campaign = campaignSnap.data() as {
      subject?: string;
      htmlBody?: string;
      targetAudience?: string;
      status?: string;
      sentCount?: number;
      targetUid?: string;
      targetEmail?: string;
      inactiveDays?: number;
      replyTo?: string;
    };

    if (!campaign.subject || !campaign.htmlBody) {
      throw new functions.HttpsError('failed-precondition', 'Campania nu are subiect sau continut');
    }

    if (campaign.status === 'sent' && (campaign.sentCount || 0) > 0) {
      throw new functions.HttpsError('failed-precondition', 'Campania a fost deja trimisa');
    }

    const campaignSubject = campaign.subject;
    const campaignHtml = campaign.htmlBody;
    let userDocs: FirebaseFirestore.DocumentSnapshot[] = [];
    let directEmails: Array<{ email: string; uid?: string }> = [];

    if (campaign.targetAudience === 'target_email') {
      const email = String(campaign.targetEmail || '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new functions.HttpsError('invalid-argument', 'targetEmail lipseste sau este invalid pentru audience target_email');
      }
      directEmails = [{ email }];
    } else if (campaign.targetAudience === 'user_uid') {
      if (!campaign.targetUid) {
        throw new functions.HttpsError('invalid-argument', 'targetUid lipseste pentru audience user_uid');
      }
      const userSnap = await db.doc(`users/${campaign.targetUid}`).get();
      const profileEmail = String(userSnap.data()?.email || '').trim().toLowerCase();
      const campaignEmail = String(campaign.targetEmail || '').trim().toLowerCase();
      if (profileEmail) {
        directEmails = [{ email: profileEmail, uid: campaign.targetUid }];
      } else if (campaignEmail) {
        directEmails = [{ email: campaignEmail, uid: campaign.targetUid }];
      } else {
        try {
          const authUser = await auth.getUser(campaign.targetUid);
          if (authUser.email) directEmails = [{ email: authUser.email.trim().toLowerCase(), uid: campaign.targetUid }];
        } catch (error) {
          console.warn('Could not resolve auth email for email campaign user_uid', {
            uid: campaign.targetUid,
            error,
          });
        }
      }
    } else {
      const usersSnap = await getCampaignUsers(campaign.targetAudience || 'all', campaign.inactiveDays);
      userDocs = usersSnap.docs;
    }

    let sentCount = 0;
    let failedCount = 0;
    let skippedUnsubscribedCount = 0;
    let batch = db.batch();
    let batchSize = 0;
    const MAX_BATCH = 200;

    const flushBatch = async () => {
      if (batchSize > 0) {
        await batch.commit();
        batch = db.batch();
        batchSize = 0;
      }
    };

    const queueEmail = async (emailValue: string, uid?: string) => {
      const email = emailValue.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        failedCount += 1;
        return;
      }

      const unsubscribeSnap = await db.doc(`emailUnsubscribes/${emailUnsubscribeDocId(email)}`).get();
      if (unsubscribeSnap.exists) {
        skippedUnsubscribedCount += 1;
        return;
      }

      if (uid) {
        const userSnap = await db.doc(`users/${uid}`).get();
        const userData = userSnap.data() || {};
        if (userData.emailMarketingUnsubscribed === true || userData.emailPreferences?.marketing === false) {
          skippedUnsubscribedCount += 1;
          return;
        }
      }

      const mailRef = db.collection('mail').doc();
      const token = randomUUID();
      const unsubscribeLink = unsubscribeUrl(token);
      const unsubscribeTokenRef = db.collection('emailUnsubscribeTokens').doc(token);

      batch.set(unsubscribeTokenRef, {
        token,
        email,
        uid: uid || null,
        campaignId,
        createdAt: Timestamp.now(),
        usedAt: null,
      });
      batch.set(mailRef, {
        to: [email],
        from: MAIL_FROM,
        replyTo: campaign.replyTo || MAIL_REPLY_TO,
        message: {
          subject: campaignSubject,
          html: appendUnsubscribeFooter(campaignHtml, unsubscribeLink),
        },
        createdAt: Timestamp.now(),
        campaignId,
        unsubscribeToken: token,
      });
      sentCount += 1;
      batchSize += 2;

      if (batchSize >= MAX_BATCH) {
        await flushBatch();
      }
    };

    for (const recipient of directEmails) {
      await queueEmail(recipient.email, recipient.uid);
    }

    for (const userDoc of userDocs) {
      const userData = userDoc.data();
      await queueEmail(userData?.email || '', userDoc.id);
    }

    await flushBatch();
    const audienceSize = directEmails.length > 0 ? directEmails.length : userDocs.length;

    await campaignRef.set({
      status: 'sent',
      sentAt: Timestamp.now(),
      sentCount,
      failedCount,
      skippedUnsubscribedCount,
      audienceSize,
      sentBy: adminData?.email || request.auth?.token.email || request.auth?.uid,
    }, { merge: true });

    await db.collection('adminAuditLogs').add({
      adminId: request.auth?.uid,
      adminEmail: adminData?.email || request.auth?.token.email || '',
      action: 'send_email_campaign',
      targetType: 'email_campaign',
      targetId: campaignId,
      timestamp: Timestamp.now(),
      metadata: { sentCount, failedCount, skippedUnsubscribedCount, audienceSize },
    });

    return { sentCount, failedCount, skippedUnsubscribedCount, audienceSize };
  }
);

// =========================================================
// unsubscribeEmail — link public pentru dezabonare email marketing
// =========================================================
export const manageMedicalReminders = functions.onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request, response) => {
    const token = String(request.query.token || '').trim();
    response.set('Content-Type', 'text/html; charset=utf-8');
    const render = (title: string, message: string) => response.status(200).send(`<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fff7fb;color:#4b3340;font-family:Arial,sans-serif}main{width:min(520px,calc(100% - 32px));background:#fff;border:1px solid #eadfe7;border-radius:18px;padding:32px;box-shadow:0 20px 60px rgba(75,51,64,.10)}h1{margin:0 0 12px;color:#8b5cf6;font-size:24px}p{line-height:1.6}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>`);
    if (!token) { render('Link invalid', 'Linkul pentru gestionarea reminderelor lipseste sau este invalid.'); return; }
    const tokenRef = db.doc(`medicalReminderPreferenceTokens/${token}`);
    const snapshot = await tokenRef.get();
    if (!snapshot.exists || !snapshot.data()?.uid) { render('Link invalid', 'Nu am gasit acest link sau a fost deja folosit.'); return; }
    const { uid, email } = snapshot.data() as { uid: string; email?: string };
    await db.doc(`users/${uid}`).set({
      medicalReminderPreferences: { enabled: false, email: false, push: false, updatedAt: Timestamp.now() },
      preferences: { notifications: { medical: false } },
      updatedAt: Timestamp.now(),
    }, { merge: true });
    await tokenRef.set({ usedAt: Timestamp.now() }, { merge: true });
    render('Remindere medicale oprite', `Nu vei mai primi emailuri sau notificari push medicale${email ? ` pentru ${email}` : ''}. Poti reactiva preferinta din aplicatie.`);
  }
);

export const unsubscribeEmail = functions.onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request, response) => {
    const token = String(request.query.token || '').trim();
    response.set('Content-Type', 'text/html; charset=utf-8');

    const render = (title: string, body: string) => response.status(200).send(`
      <!doctype html>
      <html lang="ro">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>
            body { margin:0; min-height:100vh; display:grid; place-items:center; background:#fff7fb; color:#4b3340; font-family:Arial,sans-serif; }
            main { width:min(520px, calc(100% - 32px)); background:white; border:1px solid #eadfe7; border-radius:16px; padding:32px; box-shadow:0 20px 60px rgba(75,51,64,.10); }
            h1 { margin:0 0 12px; font-size:24px; color:#D88FA8; }
            p { margin:0; line-height:1.6; }
          </style>
        </head>
        <body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></main></body>
      </html>
    `);

    if (!token) {
      render('Link invalid', 'Linkul de dezabonare lipseste sau este invalid.');
      return;
    }

    const tokenRef = db.collection('emailUnsubscribeTokens').doc(token);
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) {
      render('Link invalid', 'Nu am gasit acest link de dezabonare. Este posibil sa fi expirat sau sa fi fost deja sters.');
      return;
    }

    const data = tokenSnap.data() || {};
    const email = String(data.email || '').trim().toLowerCase();
    const uid = typeof data.uid === 'string' ? data.uid : null;
    if (!email || !email.includes('@')) {
      render('Link invalid', 'Nu am putut identifica adresa de email pentru acest link.');
      return;
    }

    const unsubscribeRef = db.collection('emailUnsubscribes').doc(emailUnsubscribeDocId(email));
    await unsubscribeRef.set({
      email,
      uid,
      campaignId: data.campaignId || null,
      unsubscribedAt: Timestamp.now(),
      source: 'email_link',
    }, { merge: true });

    if (uid) {
      await db.doc(`users/${uid}`).set({
        emailMarketingUnsubscribed: true,
        emailMarketingUnsubscribedAt: Timestamp.now(),
        emailPreferences: {
          marketing: false,
        },
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }

    await tokenRef.set({ usedAt: Timestamp.now() }, { merge: true });

    render('Te-ai dezabonat', 'Nu vei mai primi emailuri de campanie de la MamiApp. Emailurile strict necesare contului pot fi trimise in continuare.');
  }
);

// =========================================================
// articlePage — pagină publică de articol pentru linkuri partajate
// Servită prin Firebase Hosting rewrite pe /modules/articles/**.
//  • Boți sociali (Facebook/WhatsApp/Twitter) → primesc Open Graph corect.
//  • Oameni fără cont → citesc un preview + CTA „Deschide în aplicație".
//  • Pe mobil cu app instalată, universal/app links interceptează linkul
//    ÎNAINTE să ajungă aici (vezi app.json + .well-known/), deci deschide nativ.
// =========================================================
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.example.mamiapp';
const APP_STORE_URL = 'https://apps.apple.com/app/mamiapp/id0000000000';
const ARTICLE_CATEGORY_META: Record<string, { emoji: string; label: string; color: string }> = {
  pregnancy: { emoji: '🌸', label: 'Sarcină',   color: '#C4708F' },
  child:     { emoji: '👶', label: 'Copil',     color: '#D07B55' },
  nutrition: { emoji: '🥗', label: 'Nutriție',  color: '#5E8272' },
  wellbeing: { emoji: '💜', label: 'Wellbeing', color: '#7E5C8C' },
};

/** Text simplu dintr-un body markdown SAU html (fără taguri, fără sintaxă). */
function articleBodyToPlain(body: string | undefined): string {
  if (!body) return '';
  return body
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!video\([^)]*\)/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_>`#]/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function articleExcerpt(body: string | undefined, maxLen: number): string {
  const plain = articleBodyToPlain(body);
  return plain.length > maxLen ? `${plain.slice(0, maxLen).trimEnd()}…` : plain;
}

export const articlePage = functions.onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 },
  async (request, response) => {
    // Path-ul vine ca /modules/articles/<id> (via hosting rewrite). Ultimul segment = id.
    const rawPath = String(request.path || request.url || '').split('?')[0];
    const segments = rawPath.split('/').filter(Boolean);
    const id = segments[segments.length - 1] || '';
    const base = APP_PUBLIC_URL.replace(/\/$/, '');
    const canonicalUrl = `${base}/modules/articles/${encodeURIComponent(id)}`;
    const deepLink = `mamiapp://modules/articles/${encodeURIComponent(id)}`;

    response.set('Content-Type', 'text/html; charset=utf-8');
    response.set('Cache-Control', 'public, max-age=300, s-maxage=600');

    let article: FirebaseFirestore.DocumentData | null = null;
    try {
      const snap = await db.collection('articles').doc(id).get();
      if (snap.exists && snap.data()?.published !== false) article = snap.data() || null;
    } catch {
      article = null;
    }

    const title = article ? String(article.title || 'Articol MamiApp') : 'MamiApp';
    const catKey = article ? String(article.category || '') : '';
    const cat = ARTICLE_CATEGORY_META[catKey];
    const isPremium = Boolean(article?.isPremium);
    const cover = article?.coverImage ? String(article.coverImage) : `${base}/assets/icon.png`;
    const accent = cat?.color || '#D88FA8';

    // Descriere OG: teaser scurt. Premium → doar ademenim, nu dăm tot conținutul.
    const ogDesc = article
      ? (isPremium
          ? `${articleExcerpt(article.body, 140)}  ·  Articol Premium — deblochează-l în MamiApp.`
          : articleExcerpt(article.body, 180)) || 'Citește articolul în MamiApp — aplicația ta pentru maternitate.'
      : 'MamiApp — aplicația ta pentru sarcină, bebeluș și maternitate.';

    // Corp preview pentru oameni: liber → arătăm mai mult text; premium → teaser + lacăt.
    const readingBody = article
      ? (isPremium ? articleExcerpt(article.body, 320) : articleExcerpt(article.body, 900))
      : '';

    const notFound = !article;

    const html = `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · MamiApp</title>
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<meta name="description" content="${escapeHtml(ogDesc)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="MamiApp" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(ogDesc)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta property="og:image" content="${escapeHtml(cover)}" />
<meta property="og:locale" content="ro_RO" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(ogDesc)}" />
<meta name="twitter:image" content="${escapeHtml(cover)}" />
<meta name="apple-itunes-app" content="app-id=0000000000, app-argument=${escapeHtml(deepLink)}" />
<style>
  :root { --accent: ${accent}; }
  * { box-sizing: border-box; }
  body { margin:0; background:#FDF6F0; color:#3A2B33; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; line-height:1.6; }
  .wrap { max-width:640px; margin:0 auto; padding:0 20px 64px; }
  header.hero { position:relative; }
  .cover { width:100%; height:240px; object-fit:cover; display:block; }
  .cover-fallback { width:100%; height:180px; background:linear-gradient(135deg, var(--accent), #E8997A); }
  .badge { display:inline-flex; align-items:center; gap:6px; background:var(--accent); color:#fff; font-size:13px; font-weight:700; padding:5px 12px; border-radius:999px; margin:20px 0 10px; }
  h1 { font-size:27px; line-height:1.25; margin:6px 0 14px; }
  .body { font-size:17px; color:#4b3a44; }
  .lock { margin-top:20px; padding:18px 16px; border:1px dashed var(--accent); border-radius:14px; background:#fff; font-size:15px; }
  .cta { position:sticky; bottom:0; background:rgba(253,246,240,.96); backdrop-filter:blur(6px); border-top:1px solid #f0e2da; padding:14px 20px; }
  .cta-inner { max-width:640px; margin:0 auto; display:flex; gap:10px; flex-wrap:wrap; }
  a.btn { flex:1; min-width:180px; text-align:center; text-decoration:none; font-weight:700; font-size:16px; padding:14px 18px; border-radius:14px; }
  a.btn-primary { background:var(--accent); color:#fff; }
  a.btn-ghost { background:#fff; color:var(--accent); border:1.5px solid var(--accent); }
  .stores { display:flex; gap:10px; justify-content:center; margin-top:16px; flex-wrap:wrap; }
  .stores a { font-size:13px; color:#8a7680; text-decoration:none; }
  .brand { display:flex; align-items:center; gap:8px; padding:16px 20px; font-weight:800; color:var(--accent); }
  footer { text-align:center; color:#a8969f; font-size:12px; margin-top:32px; }
</style>
</head>
<body>
  <div class="brand">🌸 MamiApp</div>
  ${notFound ? '' : (article!.coverImage
      ? `<header class="hero"><img class="cover" src="${escapeHtml(cover)}" alt="" /></header>`
      : `<header class="hero"><div class="cover-fallback"></div></header>`)}
  <main class="wrap">
    ${notFound ? `
      <h1>Articolul nu este disponibil</h1>
      <p class="body">Linkul poate fi expirat sau articolul a fost retras. Descoperă restul articolelor în aplicația MamiApp.</p>
    ` : `
      ${cat ? `<span class="badge">${cat.emoji} ${escapeHtml(cat.label)}</span>` : ''}
      <h1>${escapeHtml(title)}</h1>
      <div class="body">${escapeHtml(readingBody).replace(/\n/g, '<br/>')}</div>
      ${isPremium ? `<div class="lock">🔒 Acesta este un articol <b>Premium</b>. Deschide-l în aplicația MamiApp pentru a-l citi integral.</div>` : ''}
    `}
    <div class="stores">
      <a href="${escapeHtml(PLAY_STORE_URL)}">📱 Google Play</a>
      <a href="${escapeHtml(APP_STORE_URL)}">🍎 App Store</a>
    </div>
    <footer>MamiApp — aplicația ta pentru sarcină, bebeluș și maternitate.</footer>
  </main>
  <div class="cta">
    <div class="cta-inner">
      <a class="btn btn-primary" id="open-app" href="${escapeHtml(deepLink)}">Deschide în aplicație</a>
      <a class="btn btn-ghost" href="${escapeHtml(PLAY_STORE_URL)}">Descarcă MamiApp</a>
    </div>
  </div>
  <script>
    // Încearcă să deschidă app-ul nativ; dacă nu se instalează în ~1.2s, trimite la store.
    (function () {
      var btn = document.getElementById('open-app');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var deep = ${JSON.stringify(deepLink)};
        var store = /android/i.test(navigator.userAgent) ? ${JSON.stringify(PLAY_STORE_URL)}
                  : /iphone|ipad|ipod/i.test(navigator.userAgent) ? ${JSON.stringify(APP_STORE_URL)}
                  : ${JSON.stringify(PLAY_STORE_URL)};
        var t = setTimeout(function () { window.location.href = store; }, 1200);
        window.addEventListener('pagehide', function () { clearTimeout(t); });
        window.location.href = deep;
      });
    })();
  </script>
</body>
</html>`;

    response.status(notFound ? 404 : 200).send(html);
  }
);

// =========================================================
// askAI — Claude API proxy (autentificat, cu rate limiting)
// =========================================================
export const askAI = functions.onCall(
  { secrets: ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'], memory: '256MiB', timeoutSeconds: 60, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesară');
    }

    const uid = request.auth.uid;
    const rawData = request.data as {
      messages: unknown;
      childContext?: unknown;
      mode: unknown;
      conversationId?: unknown;
    };

    // Validare strictă input
    if (!Array.isArray(rawData.messages) || rawData.messages.length === 0) {
      throw new functions.HttpsError('invalid-argument', 'messages este obligatoriu');
    }
    if (!['pregnancy', 'child'].includes(String(rawData.mode || ''))) {
      throw new functions.HttpsError('invalid-argument', 'mode trebuie să fie pregnancy sau child');
    }

    const rawChildContext = typeof rawData.childContext === 'string' ? rawData.childContext : '';
    const childContext = rawChildContext.slice(0, 1000);

    const messages = (rawData.messages as unknown[])
      .slice(-10)
      .filter((m): m is { role: 'user' | 'assistant'; content: string } => {
        if (typeof m !== 'object' || m === null) return false;
        const msg = m as Record<string, unknown>;
        return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string';
      })
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (messages.length === 0) {
      throw new functions.HttpsError('invalid-argument', 'Niciun mesaj valid');
    }

    const mode = rawData.mode as 'pregnancy' | 'child';
    const conversationId = typeof rawData.conversationId === 'string' ? rawData.conversationId : undefined;

    // Rate limiting configurabil din Admin:
    // - Settings -> Limite AI pe nivel (free/basic/premium)
    // - Billing -> Access -> AI / zi pentru planurile basic/premium
    const access = await assertFeatureAllowed(uid, 'enableAiAssistant');
    const [configDoc, basicPlanDoc, premiumPlanDoc] = await Promise.all([
      db.doc('appConfig/global').get(),
      db.doc('planConfigs/basic').get(),
      db.doc('planConfigs/premium').get(),
    ]);
    const activePlan = access.plan;
    const config = configDoc.exists ? configDoc.data() : {};
    const basicPlan = basicPlanDoc.exists ? basicPlanDoc.data() : {};
    const premiumPlan = premiumPlanDoc.exists ? premiumPlanDoc.data() : {};
    const legacyLimits = {
      free: Number(config?.aiLimitFreePerDay ?? 50),
      basic: Number(config?.aiLimitBasicPerDay ?? basicPlan?.aiLimitPerDay ?? config?.aiLimitFreePerDay ?? 50),
      premium: Number(config?.aiLimitPremiumPerDay ?? premiumPlan?.aiLimitPerDay ?? 500),
    };
    const configuredLimits = config?.aiLimitsByPlan || {};
    const dailyLimit = Math.max(0, Number(configuredLimits[activePlan] ?? legacyLimits[activePlan as keyof typeof legacyLimits]));

    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.doc(`users/${uid}/usage/${today}`);
    const resetAt = new Date();
    resetAt.setUTCDate(resetAt.getUTCDate() + 1);
    resetAt.setUTCHours(0, 0, 0, 0);

    // Incrementare atomică cu tranzacție — previne bypass prin cereri paralele
    let currentCount: number;
    try {
      currentCount = await db.runTransaction(async (tx) => {
        const usageDoc = await tx.get(usageRef);
        const count = usageDoc.exists ? (usageDoc.data()?.aiRequests || 0) : 0;
        if (count >= dailyLimit) {
          throw new functions.HttpsError(
            'resource-exhausted',
            activePlan === 'premium'
              ? `Limita zilnică de ${dailyLimit} mesaje a fost atinsă.`
              : `Limita de ${dailyLimit} mesaje/zi a fost atinsă pentru planul tău.`,
            {
              reason: 'AI_DAILY_LIMIT_REACHED',
              requests: count,
              limit: dailyLimit,
              plan: activePlan,
              resetAt: resetAt.toISOString(),
            }
          );
        }
        tx.set(usageRef, { aiRequests: count + 1, lastUpdated: Timestamp.now() }, { merge: true });
        return count;
      });
    } catch (err: any) {
      if (err?.code === 'resource-exhausted') throw err;
      throw new functions.HttpsError('internal', 'Eroare la verificarea limitei.');
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('askAI missing ANTHROPIC_API_KEY secret');
      throw new functions.HttpsError('failed-precondition', 'AI nu este configurat corect.');
    }

    const anthropic = new Anthropic({ apiKey });
    const romanianLanguageRules = `LIMBA ROMÂNĂ — REGULI STRICTE, FĂRĂ EXCEPȚII:

Diacritice obligatorii (folosește MEREU forma corectă):
• ă: mâncăm, bebeluș, îngrijire, alăptare, sănătate, vârstă — niciodată "a" neaccentuat
• â/î: în, înțărcare, încearcă, înainte, împreună, sânul, mâncare, mâine
• ș (virgulă jos, nu sedilă): bebeluș, alăptare, înțărcare, dușul, masaj
• ț (virgulă jos, nu sedilă): alăptați, nutriție, dentiție, porție, băițe, sfaturi

Cuvinte frecvente — forma corectă obligatorie:
• "cereale" nu "cereal" | "porții" nu "portii" | "piureuri" nu "piuri"
• "alăptare" nu "alapare" | "sân" nu "san" | "bebeluș" nu "babelus"
• "scutece" nu "diapers" | "lapte matern" nu "breastmilk"
• "înțărcare" nu "intarcare" | "dentiție" nu "dentitie"
• Articol hotărât: "bebelușul" "mâncarea" "sânul" "copilul" "somnul"

Gramatică:
• Acorduri gen-număr obligatorii: "un bebeluș sănătos", "o mamă obosită"
• Plurale corecte: "dinți" nu "dinti"; nu folosi articol dublu greșit
• Verbe reflexive: "se alăptează", "se hrănește", "se trezește"

INTERDICȚII ABSOLUTE:
• Niciun cuvânt fără diacriticele necesare — niciodată "copilul tau" în loc de "copilul tău"
• Niciun cuvânt englezesc în răspunsuri
• Nicio formă inventată sau neatestată în română

VERIFICARE FINALĂ OBLIGATORIE: Înainte de a trimite, recitește mental răspunsul cuvânt cu cuvânt și corectează orice diacritic lipsă, plural greșit sau acord incorect.`;

    const systemPrompt = mode === 'pregnancy'
      ? `Ești MamiApp AI, asistent specializat în sarcină și maternitate pentru mame din România. Răspunzi EXCLUSIV în română literară corectă, cu toate diacriticele.

${romanianLanguageRules}

FORMAT RĂSPUNS (chat mobil):
• Scurt și cald — maxim 3-5 propoziții sau 3-5 bullets
• Maximum un subtitlu scurt dacă e cu adevărat necesar
• Fără linii "---", fără felicitări generice, fără Markdown excesiv

${childContext ? `Context utilizator:
${childContext}
` : ''}Dacă situația necesită asistență medicală urgentă, îndrumă imediat la medic. Nu ești un substituent pentru sfatul medical profesional.`
      : `Ești MamiApp AI, asistent specializat în îngrijirea bebelușilor și copiilor mici pentru părinți din România. Răspunzi EXCLUSIV în română literară corectă, cu toate diacriticele.

${romanianLanguageRules}

FORMAT RĂSPUNS (chat mobil):
• Scurt și cald — maxim 3-5 propoziții sau 3-5 bullets
• Maximum un subtitlu scurt dacă e cu adevărat necesar
• Fără linii "---", fără felicitări generice, fără Markdown excesiv
• Sfaturile se bazează pe recomandările AAP și OMS

${childContext ? `Date despre copil:
${childContext}
` : ''}Îndrumă întotdeauna la pediatru pentru probleme medicale.`;

    const model = (process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001').trim();
    console.info('askAI request', { uid, model, messageCount: messages.length });

    let response;
    let lastAnthropicError: any;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await anthropic.messages.create({
          model,
          max_tokens: 1024,
          temperature: 0.2,
          system: systemPrompt,
          messages: messages.slice(-10), // Ultimele 10 mesaje pentru context
        });
        break;
      } catch (err: any) {
        lastAnthropicError = err;
        const status = Number(err?.status || 0);
        const type = String(err?.error?.type || err?.type || '');
        const transient = status === 429 || status === 529 || status >= 500 || type.includes('overloaded');
        if (!transient || attempt === 2) break;
        await wait(700 * (attempt + 1));
      }
    }

    if (!response) {
      const err = lastAnthropicError;
      console.error('Anthropic request failed', {
        status: err?.status,
        type: err?.error?.type || err?.type,
        message: err?.message,
      });
      await db.collection('aiUsageLogs').add({
        userId: uid,
        conversationId: conversationId || null,
        type: 'assistant',
        module: mode || 'child',
        model,
        success: false,
        errorType: err?.error?.type || err?.type || null,
        errorStatus: err?.status || null,
        messageCount: messages.length,
        plan: activePlan,
        dailyLimit,
        createdAt: Timestamp.now(),
      }).catch((logErr) => console.error('aiUsageLogs error-write failed', logErr));
      throw new functions.HttpsError('internal', 'AI nu a putut raspunde acum.');
    }

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new functions.HttpsError('internal', 'Răspuns neașteptat de la AI');
    }

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const estimatedCostUsd = ((inputTokens * 0.0008) + (outputTokens * 0.004)) / 1000;

    await db.collection('aiUsageLogs').add({
      userId: uid,
      conversationId: conversationId || null,
      type: 'assistant',
      module: mode || 'child',
      model,
      success: true,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      requestTokens: inputTokens,
      responseTokens: outputTokens,
      costUsd: Number(estimatedCostUsd.toFixed(6)),
      messageCount: messages.length,
      plan: activePlan,
      dailyLimit,
      createdAt: Timestamp.now(),
    }).catch((logErr) => console.error('aiUsageLogs write failed', logErr));

    return {
      message: content.text,
      model,
      usage: { requests: currentCount + 1, limit: dailyLimit, plan: activePlan },
    };
  }
);

// =========================================================
// generateDailySummary — sumar zilnic pentru notificări
// =========================================================
export const generateDailySummary = scheduledFunctions.onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Europe/Bucharest', memory: '256MiB' },
  async () => {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);
    const periodStartTs = Timestamp.fromDate(periodStart);
    const periodEndTs = Timestamp.fromDate(periodEnd);

    // Parcurge toți utilizatorii activi care au aiSummary enabled
    const usersSnap = await db.collection('users').where('preferences.notifications.aiSummary', '==', true).get();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data();

      try {
        // Copilul activ e marcat cu isActive:true — nu există activeChildId pe user doc
        const activeChildSnap = await db.collection(`users/${uid}/children`)
          .where('isActive', '==', true).limit(1).get();
        const activeChildId = activeChildSnap.docs[0]?.id;
        if (!activeChildId) continue; // skip user fără copil activ

        const todayTs = periodStartTs;

        // Obține date din ultima zi
        const [
          feedsSnap,
          sleepsSnap,
          diapersSnap,
          measurementsSnap,
          childDocumentsSnap,
          userDocumentsSnap,
          foodMealsSnap,
          introducedFoodsSnap,
          foodReactionsSnap,
        ] = await Promise.all([
          db.collection(`users/${uid}/children/${activeChildId}/feeds`)
            .where('timestamp', '>=', todayTs).where('timestamp', '<=', periodEndTs).get(),
          db.collection(`users/${uid}/children/${activeChildId}/sleeps`)
            .where('startTime', '>=', todayTs).where('startTime', '<=', periodEndTs).get(),
          db.collection(`users/${uid}/children/${activeChildId}/diapers`)
            .where('timestamp', '>=', todayTs).where('timestamp', '<=', periodEndTs).get(),
          db.collection(`users/${uid}/children/${activeChildId}/measurements`)
            .where('date', '>=', todayTs).where('date', '<=', periodEndTs).get(),
          db.collection(`users/${uid}/children/${activeChildId}/documents`)
            .where('uploadedAt', '>=', todayTs).where('uploadedAt', '<=', periodEndTs).get(),
          db.collection(`users/${uid}/documents`)
            .where('uploadedAt', '>=', todayTs).where('uploadedAt', '<=', periodEndTs).get(),
          db.collection(`users/${uid}/diversification/${activeChildId}/meals`)
            .orderBy('date', 'desc').limit(50).get(),
          db.collection(`users/${uid}/diversification/${activeChildId}/foods`)
            .orderBy('introducedAt', 'desc').limit(50).get(),
          db.collection(`users/${uid}/diversification/${activeChildId}/reactions`)
            .orderBy('reactionAt', 'desc').limit(50).get(),
        ]);

        const isInPeriod = (value: unknown) => {
          const date =
            value instanceof Timestamp ? value.toDate() :
            typeof value === 'string' || value instanceof Date ? new Date(value) :
            null;
          if (!date || Number.isNaN(date.getTime())) return false;
          return date >= periodStart && date <= periodEnd;
        };
        const foodMealsCount = foodMealsSnap.docs.filter((doc) => isInPeriod(doc.data().date)).length;
        const introducedFoodsCount = introducedFoodsSnap.docs.filter((doc) => isInPeriod(doc.data().introducedAt)).length;
        const foodReactionsCount = foodReactionsSnap.docs.filter((doc) => isInPeriod(doc.data().reactionAt)).length;
        const documentsCount = childDocumentsSnap.size + userDocumentsSnap.size;

        const sleepMinutes = sleepsSnap.docs.reduce((s, d) => s + (d.data().duration || 0), 0) / 60;
        const summary = {
          date: Timestamp.now(),
          periodStart: periodStartTs,
          periodEnd: periodEndTs,
          feedsCount: feedsSnap.size,
          sleepMinutes,
          diapersCount: diapersSnap.size,
          measurementsCount: measurementsSnap.size,
          foodMealsCount,
          introducedFoodsCount,
          foodReactionsCount,
          documentsCount,
        };

        const summaryRef = db.doc(`users/${uid}/summaries/${periodEnd.toISOString().split('T')[0]}`);
        await summaryRef.set(summary, { merge: true });

        // Trimite notificare sumar zilnic — UN singur canal per utilizator
        // Prioritate: web push (PWA) > Expo (native). Nu trimitem la ambele simultan.
        const sleepHours = Math.round(sleepMinutes / 60 * 10) / 10;
        const summaryTitle = '☀️ Rezumatul zilei de ieri';
        const summaryBody  = `${feedsSnap.size} mese · ${sleepHours}h somn · ${diapersSnap.size} scutece`;
        const summaryData  = { type: 'daily_summary', screen: '/(tabs)' };
        const summaryExtras = [
          measurementsSnap.size ? `${measurementsSnap.size} masuratori` : '',
          foodMealsCount ? `${foodMealsCount} mese diversificare` : '',
          introducedFoodsCount ? `${introducedFoodsCount} alimente noi` : '',
          foodReactionsCount ? `${foodReactionsCount} reactii` : '',
          documentsCount ? `${documentsCount} documente` : '',
        ].filter(Boolean).join(' - ');
        const summaryBaseBody = `${feedsSnap.size} mese - ${sleepHours}h somn - ${diapersSnap.size} scutece`;
        const summaryBodyWithExtras = summaryExtras ? `${summaryBaseBody} - ${summaryExtras}` : summaryBaseBody;

        const webPushToken = userData.webPushToken;
        const expoPushToken = userData.fcmToken;

        if (typeof webPushToken === 'string' && webPushToken.length > 20) {
          // Data-only: afișarea o face exclusiv service worker-ul (evită dublarea)
          getMessaging().send({
            token: webPushToken,
            data: { ...summaryData, title: summaryTitle, body: summaryBodyWithExtras },
            webpush: { headers: { Urgency: 'high' } },
          }).catch(() => {});
        } else if (isExpoPushToken(expoPushToken)) {
          sendExpoPushChunk([{
            to: expoPushToken, title: summaryTitle, body: summaryBodyWithExtras,
            sound: 'default', priority: 'high', channelId: 'reminders', data: summaryData,
          }]).catch(() => {});
        }
      } catch {
        // Skip users with errors
      }
    }

    console.log(`Generated daily summaries for ${usersSnap.size} users`);
  }
);

// =========================================================
// sendVaccineNotifications — alerte vaccinuri
// =========================================================
type MedicalReminderRule = {
  enabled: boolean;
  daysBefore: number[];
  sendPush: boolean;
  sendEmail: boolean;
  emailSubject: string;
  emailHtml: string;
};

type MedicalReminderSettings = {
  vaccine: MedicalReminderRule;
  appointment: MedicalReminderRule;
};

const DEFAULT_MEDICAL_REMINDER_SETTINGS: MedicalReminderSettings = {
  vaccine: {
    enabled: true,
    daysBefore: [7],
    sendPush: true,
    sendEmail: true,
    emailSubject: 'Vaccin programat: {{eventName}}',
    emailHtml: '<h2>Buna, {{parentName}}!</h2><p>Pentru {{childName}} urmeaza <strong>{{eventName}}</strong> pe <strong>{{eventDate}}</strong>.</p><p>Mai sunt {{daysBefore}} zile. Verifica detaliile in MamiApp.</p>',
  },
  appointment: {
    enabled: true,
    daysBefore: [2, 1],
    sendPush: true,
    sendEmail: true,
    emailSubject: 'Programare medicala in {{daysBefore}} zile',
    emailHtml: '<h2>Buna, {{parentName}}!</h2><p>Ai programarea <strong>{{eventName}}</strong> pe <strong>{{eventDate}}</strong>.</p><p>Mai sunt {{daysBefore}} zile. Gasesti detaliile in MamiApp.</p>',
  },
};

function normalizeMedicalRule(value: Partial<MedicalReminderRule> | undefined, fallback: MedicalReminderRule): MedicalReminderRule {
  const days = Array.isArray(value?.daysBefore)
    ? [...new Set(value.daysBefore.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 30))].sort((a, b) => b - a)
    : fallback.daysBefore;
  return {
    enabled: value?.enabled !== false,
    daysBefore: days.length ? days : fallback.daysBefore,
    sendPush: value?.sendPush !== false,
    sendEmail: value?.sendEmail !== false,
    emailSubject: String(value?.emailSubject || fallback.emailSubject).slice(0, 180),
    emailHtml: String(value?.emailHtml || fallback.emailHtml).slice(0, 20_000),
  };
}

async function loadMedicalReminderSettings(): Promise<MedicalReminderSettings> {
  const snapshot = await db.doc('medicalReminderSettings/default').get();
  const data = snapshot.data() || {};
  return {
    vaccine: normalizeMedicalRule(data.vaccine, DEFAULT_MEDICAL_REMINDER_SETTINGS.vaccine),
    appointment: normalizeMedicalRule(data.appointment, DEFAULT_MEDICAL_REMINDER_SETTINGS.appointment),
  };
}

function medicalReminderPreferencesUrl(token: string) {
  const base = `https://us-central1-${process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'your-firebase-project'}.cloudfunctions.net/manageMedicalReminders`;
  return `${base}?token=${encodeURIComponent(token)}`;
}

function appendMedicalReminderFooter(html: string, url: string) {
  const footer = `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #eadfe7;font-family:Arial,sans-serif;font-size:12px;line-height:1.55;color:#7a6d82;">Nu mai doresti remindere medicale prin MamiApp? <a href="${escapeHtml(url)}" style="color:#8b5cf6;">Opreste reminderele medicale</a>.</div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}</body>`) : `${html}${footer}`;
}

/**
 * Împachetează un fragment HTML de email în shell-ul vizual MamiApp (logo + card alb).
 * Dacă HTML-ul e deja un document complet (are <body>), îl lasă neatins.
 */
function wrapBrandedEmailShell(contentHtml: string) {
  if (/<body[\s>]/i.test(contentHtml)) return contentHtml;
  return `
  <div style="background:#FAF6F2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;">
      <img src="${EMAIL_LOGO_URL}" width="56" height="56" alt="MamiApp" style="display:block;margin:0 auto 8px;border-radius:16px;" />
      <div style="text-align:center;font-size:12px;letter-spacing:2px;color:#B96F87;font-weight:bold;margin-bottom:18px;">MAMIAPP</div>
      <div style="font-size:14px;line-height:1.7;color:#5C5254;">${contentHtml}</div>
    </div>
  </div>`;
}

export const getMedicalReminderSettings = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    return loadMedicalReminderSettings();
  }
);

export const saveMedicalReminderSettings = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    const admin = await requireAdmin(request.auth?.uid);
    const input = request.data as Partial<MedicalReminderSettings>;
    const settings: MedicalReminderSettings = {
      vaccine: normalizeMedicalRule(input.vaccine, DEFAULT_MEDICAL_REMINDER_SETTINGS.vaccine),
      appointment: normalizeMedicalRule(input.appointment, DEFAULT_MEDICAL_REMINDER_SETTINGS.appointment),
    };
    await db.doc('medicalReminderSettings/default').set({
      ...settings,
      updatedAt: Timestamp.now(),
      updatedBy: admin?.email || request.auth?.token.email || request.auth?.uid,
    });
    return settings;
  }
);

export const sendMedicalReminderTest = functions.onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, cors: true },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const { email, kind, rule } = request.data as { email?: string; kind?: 'vaccine' | 'appointment'; rule?: Partial<MedicalReminderRule> };
    const recipient = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new functions.HttpsError('invalid-argument', 'Adresa de test nu este valida.');
    if (kind !== 'vaccine' && kind !== 'appointment') throw new functions.HttpsError('invalid-argument', 'Tipul reminderului nu este valid.');
    const normalizedRule = normalizeMedicalRule(rule, DEFAULT_MEDICAL_REMINDER_SETTINGS[kind]);
    const values = {
      parentName: 'Ana Popescu',
      childName: 'Mara Popescu',
      eventName: kind === 'vaccine' ? 'Vaccinul ROR' : 'Consult obstetric',
      eventDate: '18 iulie 2026',
      daysBefore: kind === 'vaccine' ? '7' : '2',
    };
    await db.collection('mail').add({
      to: [recipient],
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      message: {
        subject: `[TEST] ${renderTemplate(normalizedRule.emailSubject, values)}`,
        html: `${wrapBrandedEmailShell(renderTemplate(normalizedRule.emailHtml, values))}<div style="margin-top:28px;padding-top:16px;border-top:1px solid #eadfe7;font-family:Arial,sans-serif;font-size:12px;color:#7a6d82;">Acesta este un email de test. Nu modifica preferintele de notificare.</div>`,
      },
      metadata: { type: 'medical_reminder_test', kind, createdBy: request.auth?.uid },
      createdAt: Timestamp.now(),
    });
    return { ok: true, email: recipient };
  }
);

function reminderDayDifference(eventDate: Date, now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const event = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();
  return Math.round((event - start) / 86_400_000);
}

async function queueMedicalReminder(input: {
  uid: string;
  kind: 'vaccine' | 'appointment';
  eventId: string;
  eventName: string;
  eventDate: Date;
  daysBefore: number;
  childName?: string;
  rule: MedicalReminderRule;
  screen: string;
}) {
  const deliveryId = createHash('sha256').update(`${input.uid}:${input.kind}:${input.eventId}:${input.daysBefore}`).digest('hex');
  const deliveryRef = db.doc(`medicalReminderDeliveries/${deliveryId}`);
  const claimed = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(deliveryRef);
    if (existing.exists) return false;
    transaction.set(deliveryRef, { ...input, eventDate: Timestamp.fromDate(input.eventDate), status: 'queued', createdAt: Timestamp.now() });
    return true;
  });
  if (!claimed) return { queued: false, push: false, email: false };

  const user = (await db.doc(`users/${input.uid}`).get()).data() || {};
  const medicalEnabled = user.medicalReminderPreferences?.enabled !== false && user.preferences?.notifications?.medical !== false;
  if (!medicalEnabled) {
    await deliveryRef.set({ status: 'skipped_preferences', processedAt: Timestamp.now() }, { merge: true });
    return { queued: false, push: false, email: false };
  }
  const parentName = user.displayName || 'mamico';
  const eventDate = input.eventDate.toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' });
  const values = {
    parentName: escapeHtml(parentName),
    childName: escapeHtml(input.childName || 'copilul tau'),
    eventName: escapeHtml(input.eventName),
    eventDate,
    daysBefore: String(input.daysBefore),
  };
  let emailQueued = false;
  let pushQueued = false;
  if (input.rule.sendEmail && user.medicalReminderPreferences?.email !== false && typeof user.email === 'string' && user.email.includes('@')) {
    const preferenceToken = randomUUID();
    const preferenceUrl = medicalReminderPreferencesUrl(preferenceToken);
    await db.doc(`medicalReminderPreferenceTokens/${preferenceToken}`).set({
      uid: input.uid,
      email: user.email,
      createdAt: Timestamp.now(),
      usedAt: null,
    });
    await db.collection('mail').add({
      to: [user.email],
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      message: {
        subject: renderTemplate(input.rule.emailSubject, values),
        html: appendMedicalReminderFooter(wrapBrandedEmailShell(renderTemplate(input.rule.emailHtml, values)), preferenceUrl),
      },
      metadata: { type: `medical_${input.kind}_reminder`, uid: input.uid, eventId: input.eventId, daysBefore: input.daysBefore },
      createdAt: Timestamp.now(),
    });
    emailQueued = true;
  }
  if (input.rule.sendPush && user.medicalReminderPreferences?.push !== false) {
    const title = input.kind === 'vaccine' ? 'Vaccin programat' : 'Programare medicala';
    const body = `${input.eventName} - peste ${input.daysBefore} zile (${eventDate})`;
    if (typeof user.webPushToken === 'string' && user.webPushToken.length > 20) {
      // Data-only: afișarea o face exclusiv service worker-ul (evită dublarea)
      await getMessaging().send({ token: user.webPushToken, data: { type: `medical_${input.kind}_reminder`, screen: input.screen, title, body }, webpush: { headers: { Urgency: 'high' } } }).catch(() => undefined);
      pushQueued = true;
    } else if (isExpoPushToken(user.fcmToken)) {
      await sendExpoPushChunk([{ to: user.fcmToken, title, body, sound: 'default', priority: 'high', data: { type: `medical_${input.kind}_reminder`, screen: input.screen } }]).catch(() => undefined);
      pushQueued = true;
    }
  }
  await deliveryRef.set({ status: 'processed', emailQueued, pushQueued, processedAt: Timestamp.now() }, { merge: true });
  return { queued: true, push: pushQueued, email: emailQueued };
}

async function runMedicalReminders() {
  const settings = await loadMedicalReminderSettings();
  const now = new Date();
  const maxDays = Math.max(...settings.vaccine.daysBefore, ...settings.appointment.daysBefore, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + maxDays);
  end.setHours(23, 59, 59, 999);
  const [vaccines, appointments] = await Promise.all([
    db.collectionGroup('vaccines').where('scheduledDate', '>=', Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))).where('scheduledDate', '<=', Timestamp.fromDate(end)).get(),
    db.collectionGroup('appointments').where('date', '>=', Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))).where('date', '<=', Timestamp.fromDate(end)).get(),
  ]);
  let queued = 0;
  for (const vaccineDoc of vaccines.docs) {
    const vaccine = vaccineDoc.data();
    if (vaccine.status === 'completed' || vaccine.administered === true || !settings.vaccine.enabled) continue;
    const date = vaccine.scheduledDate?.toDate?.();
    const daysBefore = date ? reminderDayDifference(date, now) : -1;
    if (!settings.vaccine.daysBefore.includes(daysBefore)) continue;
    const parts = vaccineDoc.ref.path.split('/');
    const uid = parts[1];
    const childRef = vaccineDoc.ref.parent.parent;
    const child = childRef ? (await childRef.get()).data() || {} : {};
    const result = await queueMedicalReminder({ uid, kind: 'vaccine', eventId: vaccineDoc.id, eventName: vaccine.name || vaccine.vaccineName || 'Vaccin', eventDate: date, daysBefore, childName: child.name, rule: settings.vaccine, screen: '/modules/vaccines' });
    if (result.queued) queued++;
  }
  for (const appointmentDoc of appointments.docs) {
    const appointment = appointmentDoc.data();
    if (['completed', 'missed', 'cancelled'].includes(String(appointment.status || 'scheduled')) || !settings.appointment.enabled) continue;
    const date = appointment.date?.toDate?.();
    const daysBefore = date ? reminderDayDifference(date, now) : -1;
    if (!settings.appointment.daysBefore.includes(daysBefore)) continue;
    const uid = appointmentDoc.ref.path.split('/')[1];
    const result = await queueMedicalReminder({ uid, kind: 'appointment', eventId: appointmentDoc.id, eventName: appointment.type || appointment.title || 'Programare medicala', eventDate: date, daysBefore, rule: settings.appointment, screen: '/modules/pregnancy' });
    if (result.queued) queued++;
  }
  return { queued };
}

// Legacy scheduler retained for its deployed name; medical reminder settings now control both vaccines and appointments.
export const sendVaccineNotifications = scheduledFunctions.onSchedule(
  { schedule: '0 9 * * *', timeZone: 'Europe/Bucharest', memory: '256MiB' },
  async () => {
    await runMedicalReminders();
  }
);

// =========================================================
// exportUserData — GDPR export (callable)
// =========================================================
export const exportUserData = functions.onCall(
  { memory: '512MiB', timeoutSeconds: 300, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesară');
    }

    const uid = request.auth.uid;
    const { categories, format } = request.data as {
      categories: string[];
      format: 'json' | 'csv' | 'pdf';
    };

    const exportData: Record<string, unknown> = {
      exportDate: new Date().toISOString(),
      userId: uid,
    };

    // Colectează datele solicitate
    const childrenSnap = await db.collection(`users/${uid}/children`).get();
    const children = childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (categories.includes('profile')) {
      const userSnap = await db.doc(`users/${uid}`).get();
      exportData.profile = userSnap.data();
    }

    for (const child of children) {
      const childData: Record<string, unknown> = { profile: child };

      if (categories.includes('feeding')) {
        const snap = await db.collection(`users/${uid}/children/${child.id}/feeds`).get();
        childData.feeds = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      if (categories.includes('sleep')) {
        const snap = await db.collection(`users/${uid}/children/${child.id}/sleeps`).get();
        childData.sleeps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      if (categories.includes('diapers')) {
        const snap = await db.collection(`users/${uid}/children/${child.id}/diapers`).get();
        childData.diapers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      if (categories.includes('growth')) {
        const snap = await db.collection(`users/${uid}/children/${child.id}/measurements`).get();
        childData.measurements = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      if (categories.includes('vaccines')) {
        const snap = await db.collection(`users/${uid}/children/${child.id}/vaccines`).get();
        childData.vaccines = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      if (categories.includes('milestones')) {
        const snap = await db.collection(`users/${uid}/children/${child.id}/milestones`).get();
        childData.milestones = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      exportData[`child_${child.id}`] = childData;
    }

    if (categories.includes('appointments')) {
      const snap = await db.collection(`users/${uid}/pregnancy/current/appointments`).get();
      exportData.appointments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    // Salvează exportul în Storage și trimite email.
    // Serverul livrează întotdeauna JSON (format complet, fără pierderi). Conversia
    // în CSV se face în aplicație. Extensia și contentType reflectă fidel conținutul.
    void format;
    const exportJson = JSON.stringify(exportData, null, 2);
    const fileName = `exports/${uid}/${Date.now()}_export.json`;

    const bucket = getStorage().bucket();
    const file = bucket.file(fileName);
    await file.save(exportJson, { metadata: { contentType: 'application/json' } });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 48 * 60 * 60 * 1000, // 48 ore
    });

    // TODO: Send email via SendGrid / Firebase Extensions
    // await sendEmail(userEmail, 'Export date MamiApp', `Link descărcare: ${url}`);

    return { success: true, downloadUrl: url, expiresIn: '48 ore' };
  }
);

// =========================================================
// deleteAccount — GDPR ștergere cont (callable)
// =========================================================
export const deleteAccount = functions.onCall(
  { memory: '256MiB', timeoutSeconds: 120, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesară');
    }

    const uid = request.auth.uid;

    try {
      // 1. Curăță referințele lăsate în conturile ALTOR utilizatori (partajare familie),
      //    altfel rămân orfane după ștergerea documentului principal.
      await cleanupCrossUserFamilyReferences(uid);

      // 2. Șterge întreg arborele utilizatorului (document + toate subcollecțiile, recursiv).
      await db.recursiveDelete(db.doc(`users/${uid}`));

      // 3. Șterge fișierele din Storage
      try {
        const bucket = getStorage().bucket();
        await bucket.deleteFiles({ prefix: `users/${uid}/` });
      } catch (storageError) {
        console.warn('deleteAccount storage cleanup failed:', { uid, storageError });
      }

      // 4. Șterge contul Firebase Auth
      try {
        await auth.deleteUser(uid);
      } catch (authError: any) {
        if (authError?.code !== 'auth/user-not-found') throw authError;
      }

      return { success: true };
    } catch (err) {
      console.error('deleteAccount error:', err);
      throw new functions.HttpsError('internal', 'Eroare la ștergerea contului');
    }
  }
);

// Elimină legăturile de partajare familie care trăiesc în ALTE conturi și ar rămâne
// orfane după ștergerea utilizatorului curent:
//  - family_members/{uid} din conturile owner-ilor care l-au invitat
//  - shared_children/... din conturile membrilor cu care el a partajat un copil
async function cleanupCrossUserFamilyReferences(uid: string): Promise<void> {
  try {
    const [membershipsElsewhere, sharesFromThisUser] = await Promise.all([
      // Documente family_members create de alți owneri, având ID egal cu uid-ul curent
      db.collectionGroup('family_members').where('uid', '==', uid).get(),
      // Copii partajați de utilizatorul curent, aflați în conturile membrilor
      db.collectionGroup('shared_children').where('ownerId', '==', uid).get(),
    ]);

    const refs = [
      ...membershipsElsewhere.docs.map((d) => d.ref),
      ...sharesFromThisUser.docs.map((d) => d.ref),
    ].filter((ref) => ref.path.split('/')[1] !== uid); // documentele proprii sunt șterse de recursiveDelete

    for (let i = 0; i < refs.length; i += 400) {
      const batch = db.batch();
      refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  } catch (error) {
    // Best-effort: dacă lipsește un index de collection-group nu blocăm ștergerea contului.
    console.warn('cleanupCrossUserFamilyReferences failed (non-critical):', { uid, error });
  }
}

// =========================================================
// completePregnancy — tranziție sarcină → copil
// =========================================================
export const completePregnancy = functions.onCall(
  { memory: '256MiB', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesară');
    }

    const uid = request.auth.uid;
    const { childData } = request.data as {
      childData: {
        name: string;
        gender: string;
        birthDate: string;
        birthWeight: number;
        birthHeight: number;
      };
    };

    if (!childData || typeof childData.name !== 'string' || !childData.birthDate) {
      throw new functions.HttpsError('invalid-argument', 'Datele copilului sunt incomplete.');
    }
    const parsedBirthDate = new Date(childData.birthDate);
    if (Number.isNaN(parsedBirthDate.getTime())) {
      throw new functions.HttpsError('invalid-argument', 'Data nașterii este invalidă.');
    }

    const batch = db.batch();

    // Marchează sarcina ca finalizată (set+merge: nu crapă dacă documentul nu există)
    batch.set(db.doc(`users/${uid}/pregnancy/current`), {
      isActive: false,
      completedAt: Timestamp.now(),
    }, { merge: true });

    // Creează profilul copilului
    const childRef = db.collection(`users/${uid}/children`).doc();
    batch.set(childRef, {
      ...childData,
      birthDate: Timestamp.fromDate(parsedBirthDate),
      isActive: true,
      createdAt: Timestamp.now(),
    });

    // Actualizează profilul utilizatorului
    batch.set(db.doc(`users/${uid}`), {
      profileMode: 'child',
      activeChildId: childRef.id,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    await batch.commit();

    return { success: true, childId: childRef.id };
  }
);

// =========================================================
// inviteFamilyMember — trimitere invitație familie
// =========================================================
export const inviteFamilyMember = functions.onCall(
  { memory: '256MiB', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesară');
    }

    const uid = request.auth.uid;
    const { email, role, permissions, childId } = request.data as {
      email: string;
      role: string;
      permissions: Record<string, boolean>;
      childId: string;
    };

    const inviteEmail = String(email || '').trim().toLowerCase();
    if (!inviteEmail || !inviteEmail.includes('@')) {
      throw new functions.HttpsError('invalid-argument', 'Email invalid');
    }
    if (!childId) {
      throw new functions.HttpsError('invalid-argument', 'childId este obligatoriu');
    }
    await assertFeatureAllowed(uid, 'enableFamilySharing');
    const owner = await auth.getUser(uid);
    const ownerName = owner.displayName || owner.email || 'Un membru MamiApp';

    // Generează token de invitație (expiră în 7 zile)
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const inviteLink = `${APP_PUBLIC_URL}/family-invite?token=${encodeURIComponent(token)}&owner=${encodeURIComponent(uid)}`;

    await db.doc(`users/${uid}/invitations/${token}`).set({
      email: inviteEmail,
      ownerName,
      ownerEmail: owner.email || '',
      role,
      permissions,
      childId,
      status: 'pending',
      createdAt: Timestamp.now(),
      expiresAt,
    });

    const template = await getEmailTemplate('family_invitation');
    const templateValues = {
      ownerName,
      role,
      inviteLink,
    };
    const subject = template?.subject
      ? renderTemplate(template.subject, templateValues)
      : `${ownerName} te-a invitat in MamiApp`;
    const text = template?.text
      ? renderTemplate(template.text, templateValues)
      : `Buna. ${ownerName} te-a invitat in MamiApp. Accepta invitatia aici: ${inviteLink}`;
    const html = template?.html
      ? renderTemplate(template.html, {
          ownerName: escapeHtml(ownerName),
          role: escapeHtml(role),
          inviteLink: escapeHtml(inviteLink),
        })
      : buildFamilyInvitationEmailHtml(ownerName, role, inviteLink);

    await db.collection('mail').add({
      to: [inviteEmail],
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      message: { subject, text, html },
      metadata: {
        type: 'family_invitation',
        uid,
        childId,
        token,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true, token };
  }
);

// =========================================================
// acceptFamilyInvitation - acceptare invitatie familie
// =========================================================
export const acceptFamilyInvitation = functions.onCall(
  { memory: '256MiB', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesara');
    }

    const memberUid = request.auth.uid;
    const ownerUid = String(request.data?.owner || '').trim();
    const token = String(request.data?.token || '').trim();

    if (!ownerUid || !token) {
      throw new functions.HttpsError('invalid-argument', 'Invitatia este invalida.');
    }
    if (ownerUid === memberUid) {
      throw new functions.HttpsError('failed-precondition', 'Nu poti accepta propria invitatie.');
    }

    const member = await auth.getUser(memberUid);
    const memberEmail = (member.email || '').trim().toLowerCase();
    if (!memberEmail) {
      throw new functions.HttpsError('failed-precondition', 'Contul tau nu are email.');
    }
    if (!member.emailVerified) {
      throw new functions.HttpsError('failed-precondition', 'Confirma emailul inainte sa accepti invitatia.');
    }

    const invitationRef = db.doc(`users/${ownerUid}/invitations/${token}`);
    const invitationSnap = await invitationRef.get();
    if (!invitationSnap.exists) {
      throw new functions.HttpsError('not-found', 'Invitatia nu mai exista.');
    }

    const invitation = invitationSnap.data() || {};
    const invitedEmail = String(invitation.email || '').trim().toLowerCase();
    if (invitedEmail !== memberEmail) {
      throw new functions.HttpsError('permission-denied', 'Invitatia a fost trimisa catre alta adresa de email.');
    }
    if (invitation.status && invitation.status !== 'pending') {
      if (invitation.status !== 'accepted') {
        throw new functions.HttpsError('failed-precondition', 'Invitatia nu mai este activa.');
      }
    }

    const expiresAt = invitation.expiresAt as Timestamp | undefined;
    if (invitation.status !== 'accepted' && expiresAt?.toMillis && expiresAt.toMillis() < Date.now()) {
      await invitationRef.update({ status: 'expired', expiredAt: FieldValue.serverTimestamp() });
      throw new functions.HttpsError('deadline-exceeded', 'Invitatia a expirat.');
    }

    const childId = String(invitation.childId || '').trim();
    if (!childId) {
      throw new functions.HttpsError('failed-precondition', 'Invitatia nu are copil asignat.');
    }
    const childSnap = await db.doc(`users/${ownerUid}/children/${childId}`).get();
    if (!childSnap.exists) {
      throw new functions.HttpsError('not-found', 'Copilul partajat nu mai exista.');
    }
    const owner = await auth.getUser(ownerUid);
    const ownerName = invitation.ownerName || owner.displayName || owner.email || 'Familie MamiApp';

    const memberRef = db.doc(`users/${ownerUid}/family_members/${memberUid}`);
    const sharedChildRef = db.doc(`users/${memberUid}/shared_children/${ownerUid}_${childId}`);
    const batch = db.batch();
    batch.set(memberRef, {
      uid: memberUid,
      email: memberEmail,
      name: member.displayName || memberEmail.split('@')[0],
      role: invitation.role || 'parent',
      permissions: invitation.permissions || {},
      childId,
      status: 'active',
      inviteStatus: 'accepted',
      invitedAt: invitation.createdAt || FieldValue.serverTimestamp(),
      acceptedAt: FieldValue.serverTimestamp(),
      invitationToken: token,
    }, { merge: true });
    batch.set(sharedChildRef, {
      ownerId: ownerUid,
      ownerName,
      ownerEmail: invitation.ownerEmail || owner.email || '',
      childId,
      role: invitation.role || 'parent',
      permissions: invitation.permissions || {},
      status: 'active',
      inviteStatus: 'accepted',
      invitationToken: token,
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(invitationRef, {
      status: 'accepted',
      acceptedBy: memberUid,
      acceptedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    return { success: true, alreadyAccepted: invitation.status === 'accepted', childId, ownerId: ownerUid };
  }
);

// =========================================================
// deleteFamilyInvitation - stergere invitatie trimisa
// =========================================================
export const deleteFamilyInvitation = functions.onCall(
  { memory: '256MiB', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesara');
    }

    const ownerUid = request.auth.uid;
    const token = String(request.data?.token || '').trim();
    if (!token) {
      throw new functions.HttpsError('invalid-argument', 'Token invalid.');
    }

    const invitationRef = db.doc(`users/${ownerUid}/invitations/${token}`);
    const snap = await invitationRef.get();
    if (!snap.exists) return { success: true };
    const invitation = snap.data() || {};
    if (invitation.status === 'accepted' && invitation.acceptedBy) {
      throw new functions.HttpsError('failed-precondition', 'Invitatia acceptata trebuie revocata, nu stearsa.');
    }

    await invitationRef.delete();
    return { success: true };
  }
);

// =========================================================
// revokeFamilyAccess - revocare acces membru familie
// =========================================================
export const revokeFamilyAccess = functions.onCall(
  { memory: '256MiB', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesara');
    }

    const ownerUid = request.auth.uid;
    const memberUid = String(request.data?.memberUid || '').trim();
    const token = String(request.data?.token || '').trim();
    if (!memberUid) {
      throw new functions.HttpsError('invalid-argument', 'Membru invalid.');
    }

    const memberRef = db.doc(`users/${ownerUid}/family_members/${memberUid}`);
    const memberSnap = await memberRef.get();
    const memberData = memberSnap.data() || {};
    const childId = String(request.data?.childId || memberData.childId || '').trim();

    const batch = db.batch();
    batch.delete(memberRef);
    if (childId) {
      batch.delete(db.doc(`users/${memberUid}/shared_children/${ownerUid}_${childId}`));
    }

    if (token) {
      batch.set(db.doc(`users/${ownerUid}/invitations/${token}`), {
        status: 'revoked',
        revokedAt: FieldValue.serverTimestamp(),
        revokedBy: ownerUid,
      }, { merge: true });
    } else {
      const acceptedInvites = await db.collection(`users/${ownerUid}/invitations`)
        .where('acceptedBy', '==', memberUid)
        .where('status', '==', 'accepted')
        .limit(10)
        .get();
      acceptedInvites.docs.forEach((doc) => {
        batch.set(doc.ref, {
          status: 'revoked',
          revokedAt: FieldValue.serverTimestamp(),
          revokedBy: ownerUid,
        }, { merge: true });
      });
    }

    await batch.commit();
    return { success: true };
  }
);

// =========================================================
// syncSharedFamilyMetadata - completeaza ownerName/ownerEmail pentru familii primite
// =========================================================
export const syncSharedFamilyMetadata = functions.onCall(
  { memory: '256MiB', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError('unauthenticated', 'Autentificare necesara');
    }

    const memberUid = request.auth.uid;
    const sharedSnap = await db.collection(`users/${memberUid}/shared_children`).get();
    const batch = db.batch();
    let updated = 0;

    for (const sharedDoc of sharedSnap.docs) {
      const data = sharedDoc.data() || {};
      const ownerId = String(data.ownerId || '').trim();
      const childId = String(data.childId || '').trim();
      if (!ownerId || !childId) continue;

      const owner = await auth.getUser(ownerId).catch(() => null);
      const memberSnap = await db.doc(`users/${ownerId}/family_members/${memberUid}`).get();
      const memberData = memberSnap.data() || {};
      const ownerEmail = owner?.email || data.ownerEmail || '';
      const ownerName = data.ownerName || owner?.displayName || ownerEmail || 'Familie MamiApp';

      batch.set(sharedDoc.ref, {
        ownerName,
        ownerEmail,
        role: memberData.role || data.role || 'parent',
        permissions: memberData.permissions || data.permissions || {},
        status: memberData.status || data.status || 'active',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      updated += 1;
    }

    if (updated > 0) {
      await batch.commit();
    }

    return { success: true, updated };
  }
);
