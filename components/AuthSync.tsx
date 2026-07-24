'use client';
import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';

/**
 * Keeps the Zustand `user` in lockstep with the real Supabase auth session.
 *
 * The app had TWO sources of truth for "am I signed in?":
 *   - the persisted Zustand `user` (used by MenuDrawer's auth gates + the
 *     messages page via `user.uid`), which was only ever set on the
 *     login/signup/welcome pages, and
 *   - `supabase.auth.getSession()` (used by the dashboard + notifications pages).
 *
 * On return visits — or whenever `createOrUpdateUserProfile` threw during
 * sign-in — these diverged, so a genuinely logged-in user was treated as a
 * guest (Seller/Messages/Notifications blocked by the "Sign In to Continue"
 * modal), or a user whose session had expired was still shown as signed in.
 *
 * Mounting this once at the root subscribes to auth-state changes and hydrates
 * the store from the session, eliminating the desync in both directions.
 */
function profileFromUser(u: User) {
  return {
    uid: u.id,
    email: u.email ?? '',
    displayName:
      (u.user_metadata?.full_name as string | undefined) ??
      u.email?.split('@')[0] ??
      '',
    photoUrl: (u.user_metadata?.avatar_url as string | undefined) ?? undefined,
  };
}

export default function AuthSync() {
  useEffect(() => {
    const { setUser } = useAppStore.getState();

    // Immediate hydration on load.
    supabase.auth.getSession().then(({ data: { session } }) => {
      const current = useAppStore.getState().user;
      if (session?.user) {
        // Preserve any richer fields already in the store; refresh identity.
        setUser({ ...(current ?? {}), ...profileFromUser(session.user) });
      } else if (current) {
        setUser(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = useAppStore.getState().user;
      if (session?.user) {
        setUser({ ...(current ?? {}), ...profileFromUser(session.user) });
      } else if (current) {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
