import { Timestamp } from 'firebase/firestore';

function localeFromLanguage(language?: string): string {
  return language === 'en' ? 'en-US' : 'ro-RO';
}

export function formatTime(timestamp: Timestamp | Date | null | undefined, language = 'ro'): string {
  if (!timestamp) return '';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return date.toLocaleTimeString(localeFromLanguage(language), { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(timestamp: Timestamp | Date | null | undefined, language = 'ro'): string {
  if (!timestamp) return '';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return date.toLocaleDateString(localeFromLanguage(language), { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatDateShort(timestamp: Timestamp | Date | null | undefined, language = 'ro'): string {
  if (!timestamp) return '';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return date.toLocaleDateString(localeFromLanguage(language), { day: '2-digit', month: '2-digit' });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}min`
    : `${hours}h`;
}

export function formatWeight(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(1)} kg`;
  return `${grams} g`;
}

export function formatRelativeTime(timestamp: Timestamp | Date | null | undefined, language = 'ro'): string {
  if (!timestamp) return '';
  const isEnglish = language === 'en';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return isEnglish ? 'now' : 'acum';
  if (diffMinutes < 60) return isEnglish ? `${diffMinutes} min ago` : `acum ${diffMinutes} min`;
  if (diffHours < 24) return isEnglish ? `${diffHours}h ago` : `acum ${diffHours}h`;
  if (diffDays === 1) return isEnglish ? 'yesterday' : 'ieri';
  if (diffDays < 7) return isEnglish ? `${diffDays} days ago` : `acum ${diffDays} zile`;
  return formatDate(date, language);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
