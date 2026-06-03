'use client';
import { useAppStore } from '@/store';
import { translate } from '@/lib/i18n';

export function useT(): (key: string) => string {
  const lang = useAppStore((s) => s.selectedLanguage);
  return (key: string) => translate(key, lang);
}
