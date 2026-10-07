// src/lib/audit.ts — Loghează acțiunile adminului în Firestore
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAdminStore } from '../store/adminStore';

export async function logAudit(
  action: string,
  targetType: string,
  targetId: string,
  reason?: string,
  metadata?: Record<string, any>
) {
  const admin = useAdminStore.getState().adminUser;
  if (!admin) return;
  try {
    await addDoc(collection(db, 'adminAuditLogs'), {
      adminId: admin.uid,
      adminEmail: admin.email,
      action,
      targetType,
      targetId,
      reason: reason || null,
      metadata: metadata || null,
      timestamp: serverTimestamp(),
    });
  } catch {
    // Non-critical — don't block the action
  }
}

// src/lib/format.ts
export function fmtDate(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ro-RO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtRelative(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'acum';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days}z`;
  return fmtDate(ts);
}

export function fmtNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function fmtCurrency(usd: number): string {
  return '$' + usd.toFixed(2);
}
