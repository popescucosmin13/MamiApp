import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export function useGreeting(): string {
  const { t } = useTranslation();

  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t('home.greeting_morning');
    if (h < 18) return t('home.greeting_day');
    return t('home.greeting_evening');
  }, [t]);
}
