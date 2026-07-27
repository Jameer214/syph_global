'use client';
import { useEffect, useReducer } from 'react';
import { batchGetSellerHoursMap } from '@/lib/firestore';
import { useAppStore } from '@/store';
import { tr } from '@/lib/i18n';
import type { SellerHoursInfo } from '@/types';

/**
 * "Open now" / "Closed" pill for listing cards — the card-level companion to
 * DistanceChip. Uses the SAME open/closed rule as the seller shop page
 * (`isOpen` in app/shop/[uid]/page.tsx): working days + opening/closing time +
 * open-24h, from the seller's setup. Renders nothing until the hours are known
 * or when the seller never set any, so it's safe to drop into any card.
 *
 * Seller hours are looked up by ownerUid (= listings.seller_id = the seller's
 * auth user_id) and BATCHED across every chip on the page into one query via
 * `batchGetSellerHoursMap`, so a grid of cards costs a single request.
 */

// ─── Shared, batched seller-hours cache (module-level) ──────────────────────
const cache = new Map<string, SellerHoursInfo | null>(); // null = looked up, none on file
const listeners = new Set<() => void>();
let pending = new Set<string>();
let scheduled = false;

function flush() {
  scheduled = false;
  const ids = [...pending].filter((id) => !cache.has(id));
  pending = new Set();
  if (ids.length === 0) return;
  batchGetSellerHoursMap(ids)
    .then((map) => {
      for (const id of ids) cache.set(id, map.get(id) ?? null);
    })
    .catch(() => {
      for (const id of ids) cache.set(id, null); // fail safe: treat as no hours
    })
    .finally(() => listeners.forEach((l) => l()));
}

function requestHours(uid: string) {
  if (cache.has(uid) || pending.has(uid)) return;
  pending.add(uid);
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
}

function useSellerHours(uid?: string): SellerHoursInfo | null | undefined {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (!uid || cache.has(uid)) return;
    requestHours(uid);
    const l = () => force();
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [uid]);
  return uid ? cache.get(uid) : undefined;
}

// ─── Open/closed rule — mirrors isOpen() on the shop page ────────────────────
function hasHours(h: SellerHoursInfo): boolean {
  return h.open24Hours || !!h.openingTime?.trim() || !!h.closingTime?.trim();
}

function isOpenNow(h: SellerHoursInfo): boolean {
  const today = (new Date().getDay() + 6) % 7; // JS 0=Sun → 0=Mon
  if (h.workingDays.length > 0 && !h.workingDays.includes(today)) return false;
  if (h.open24Hours) return true;
  const open = (h.openingTime ?? '').trim();
  const close = (h.closingTime ?? '').trim();
  if (!open || !close) return false;
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  return closeM > openM ? nowM >= openM && nowM < closeM : nowM >= openM || nowM < closeM;
}

export default function OpenStatusChip({
  ownerUid,
  size = 'sm',
  variant = 'soft',
}: {
  ownerUid?: string;
  size?: 'sm' | 'xs';
  /** 'soft' pastel pill for on-white body rows; 'solid' high-contrast badge
   *  for overlaying on a photo corner (paid/cramped cards). */
  variant?: 'soft' | 'solid';
}) {
  const { selectedLanguage } = useAppStore();
  const hours = useSellerHours(ownerUid);
  // Re-evaluate each minute so the pill flips at opening/closing boundaries.
  const [, tick] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, []);

  if (!hours || !hasHours(hours)) return null; // unknown / never set → render nothing
  const open = isOpenNow(hours);
  const solid = variant === 'solid';

  const fs = size === 'xs' ? 9.5 : 11;
  const dot = size === 'xs' ? 6 : 7;
  const bg = solid ? (open ? '#1F7A3D' : '#E53935') : open ? '#E6F6EC' : '#FDEBEC';
  const fg = solid ? '#fff' : open ? '#1F7A3D' : '#C0392B';
  const dotColor = solid ? '#fff' : open ? '#1F7A3D' : '#C0392B';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: bg,
        color: fg,
        fontWeight: solid ? 800 : 700,
        fontSize: fs,
        borderRadius: 999,
        padding: size === 'xs' ? '2px 7px' : '2px 8px',
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...(solid ? { boxShadow: '0 1px 4px rgba(0,0,0,0.25)' } : null),
      }}
    >
      <span
        style={{
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />
      {open ? tr('openNow', selectedLanguage) : tr('closed', selectedLanguage)}
    </span>
  );
}
