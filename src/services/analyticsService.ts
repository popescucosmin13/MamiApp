import { Platform } from 'react-native';

const GA_SCRIPT_ID = 'mamiapp-google-analytics';
const DEFAULT_MEASUREMENT_ID = 'G-8L11Q9LM7W';

type GtagCommand = 'config' | 'event' | 'js' | 'set';
type Gtag = (command: GtagCommand, target: string | Date, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

function getMeasurementId() {
  return process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID || DEFAULT_MEASUREMENT_ID;
}

function isUserWebApp() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;

  return !window.location.pathname.startsWith('/admin');
}

export const analyticsService = {
  init() {
    if (!isUserWebApp()) return;

    const measurementId = getMeasurementId();
    if (!measurementId) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args) {
      window.dataLayer?.push(args);
    };

    if (!document.getElementById(GA_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = GA_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);
    }

    window.gtag('js', new Date());
    window.gtag('config', measurementId, { send_page_view: false });
  },

  trackPageView(pathname: string) {
    if (!isUserWebApp()) return;

    const measurementId = getMeasurementId();
    if (!measurementId || !window.gtag) return;

    window.gtag('event', 'page_view', {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title || 'MamiApp',
      send_to: measurementId,
    });
  },
};
