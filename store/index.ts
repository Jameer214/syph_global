'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@/types';
import { getCurrencyForCountry } from '@/lib/currency';

interface AppStore {
  user: UserProfile | null;
  savedIds: string[];
  selectedCountry: string;
  selectedRegion: string;
  selectedCurrency: string;   // effective display currency code
  isAutoCurrency: boolean;    // true = derived from country, false = manual override
  selectedLanguage: string;
  sellerMode: boolean;
  locationSet: boolean;
  selectedLocation: string;
  unreadMessages: number;
  setUser: (user: UserProfile | null) => void;
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
  setCountry: (c: string) => void;
  setRegion: (r: string) => void;
  setCurrency: (c: string) => void;
  setManualCurrency: (c: string) => void;
  setAutoCurrency: () => void;
  setLanguage: (l: string) => void;
  setSellerMode: (v: boolean) => void;
  setLocationSet: (v: boolean, location?: string) => void;
  setUnreadMessages: (n: number) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      user: null,
      savedIds: [],
      selectedCountry: '',
      selectedRegion: '',
      selectedCurrency: 'USD',
      isAutoCurrency: true,
      selectedLanguage: 'en',
      sellerMode: false,
      locationSet: false,
      selectedLocation: '',
      unreadMessages: 0,
      setUser: (user) => set({ user }),
      toggleSaved: (id) => {
        const current = get().savedIds;
        set({
          savedIds: current.includes(id)
            ? current.filter((s) => s !== id)
            : [...current, id],
        });
      },
      isSaved: (id) => get().savedIds.includes(id),
      setCountry: (c) => {
        const { isAutoCurrency } = get();
        set({
          selectedCountry: c,
          ...(isAutoCurrency ? { selectedCurrency: getCurrencyForCountry(c) } : {}),
        });
      },
      setRegion: (r) => set({ selectedRegion: r }),
      setCurrency: (c) => set({ selectedCurrency: c }),
      setManualCurrency: (c) => set({ selectedCurrency: c, isAutoCurrency: false }),
      setAutoCurrency: () => {
        const country = get().selectedCountry;
        set({ isAutoCurrency: true, selectedCurrency: getCurrencyForCountry(country) });
      },
      setLanguage: (l) => set({ selectedLanguage: l }),
      setSellerMode: (v) => set({ sellerMode: v }),
      setLocationSet: (v, location) => {
        const { isAutoCurrency } = get();
        set({
          locationSet: v,
          ...(location ? {
            selectedLocation: location,
            selectedCountry: location,
            ...(isAutoCurrency ? { selectedCurrency: getCurrencyForCountry(location) } : {}),
          } : {}),
        });
      },
      setUnreadMessages: (n) => set({ unreadMessages: n }),
    }),
    { name: 'syph-store' }
  )
);
