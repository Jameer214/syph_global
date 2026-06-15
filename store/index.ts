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
  homeCountry: string;        // currency anchor: where the user is/their home (GPS or first setup). NEVER the browse country.
  selectedCurrency: string;   // effective display currency code
  isAutoCurrency: boolean;    // true = derived from homeCountry, false = manual override
  selectedLanguage: string;
  sellerMode: boolean;
  locationSet: boolean;
  selectedLocation: string;
  unreadMessages: number;
  setUser: (user: UserProfile | null) => void;
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
  setCountry: (c: string) => void;
  setHomeCountry: (c: string) => void;
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
      homeCountry: '',
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
      // Browsing a country must NOT move the currency. Currency stays anchored
      // to homeCountry until an explicit manual override.
      setCountry: (c) => set({ selectedCountry: c }),
      // The currency anchor (GPS-detected / home). Drives auto currency.
      setHomeCountry: (c) => {
        const { isAutoCurrency } = get();
        set({
          homeCountry: c,
          ...(isAutoCurrency ? { selectedCurrency: getCurrencyForCountry(c) } : {}),
        });
      },
      setRegion: (r) => set({ selectedRegion: r }),
      setCurrency: (c) => set({ selectedCurrency: c }),
      setManualCurrency: (c) => set({ selectedCurrency: c, isAutoCurrency: false }),
      setAutoCurrency: () => {
        const { homeCountry, selectedCountry } = get();
        const anchor = homeCountry || selectedCountry;
        set({ isAutoCurrency: true, selectedCurrency: getCurrencyForCountry(anchor) });
      },
      setLanguage: (l) => set({ selectedLanguage: l }),
      setSellerMode: (v) => set({ sellerMode: v }),
      setLocationSet: (v, location) => {
        const { isAutoCurrency, homeCountry } = get();
        if (!location) {
          set({ locationSet: v });
          return;
        }
        // First location setup establishes the home anchor; later changes are
        // treated as browsing and leave the existing anchor (and currency) intact.
        const anchor = homeCountry || location;
        set({
          locationSet: v,
          selectedLocation: location,
          selectedCountry: location,
          homeCountry: anchor,
          ...(isAutoCurrency ? { selectedCurrency: getCurrencyForCountry(anchor) } : {}),
        });
      },
      setUnreadMessages: (n) => set({ unreadMessages: n }),
    }),
    { name: 'syph-store' }
  )
);
