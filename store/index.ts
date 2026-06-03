'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@/types';

interface AppStore {
  user: UserProfile | null;
  savedIds: string[];
  selectedCountry: string;
  selectedCurrency: string;
  selectedLanguage: string;
  sellerMode: boolean;
  locationSet: boolean;
  selectedLocation: string;
  unreadMessages: number;
  setUser: (user: UserProfile | null) => void;
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
  setCountry: (c: string) => void;
  setCurrency: (c: string) => void;
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
      selectedCurrency: 'USD',
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
      setCountry: (c) => set({ selectedCountry: c }),
      setCurrency: (c) => set({ selectedCurrency: c }),
      setLanguage: (l) => set({ selectedLanguage: l }),
      setSellerMode: (v) => set({ sellerMode: v }),
      setLocationSet: (v, location) =>
        set({
          locationSet: v,
          ...(location ? { selectedLocation: location, selectedCountry: location } : {}),
        }),
      setUnreadMessages: (n) => set({ unreadMessages: n }),
    }),
    { name: 'syph-store' }
  )
);
