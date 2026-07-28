'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { tr, getDir } from '@/lib/i18n';
import { getSavedSearches, deleteSavedSearch, type SavedSearch } from '@/lib/firestore';
import { sanitizeText } from '@/lib/sanitize';
import BottomNav from '@/components/BottomNav';

export default function SavedSearchesPage() {
  const router = useRouter();
  const { user, selectedLanguage } = useAppStore();
  const uid = user?.uid ?? '';

  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) { setLoading(false); setSearches([]); return; }
    setLoading(true);
    try {
      setSearches(await getSavedSearches(uid));
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  // Re-run a saved search: open the whole-catalog results scoped to the saved
  // country/region.
  function runSearch(s: SavedSearch) {
    const params = new URLSearchParams();
    params.set('q', s.keyword);
    if (s.filters?.country) params.set('country', s.filters.country);
    if (s.filters?.region) params.set('region', s.filters.region);
    router.push(`/home?${params.toString()}`);
  }

  async function remove(id: string) {
    if (!uid) return;
    // Optimistic removal.
    const previous = searches;
    setSearches((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteSavedSearch(uid, id);
    } catch {
      setSearches(previous);
    }
  }

  function filterSummary(s: SavedSearch): string {
    const parts: string[] = [];
    if (s.filters?.country) parts.push(s.filters.country);
    if (s.filters?.region) parts.push(s.filters.region);
    if (s.filters?.openNow) parts.push(tr('openNow', selectedLanguage));
    if (s.filters?.nearMe) parts.push(tr('nearMeGps', selectedLanguage));
    return parts.join(' • ');
  }

  if (!uid) {
    return (
      <div dir={getDir(selectedLanguage)} className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
        <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('savedSearches', selectedLanguage)}</span>
        </div>
        <div style={{ padding: '16px 16px 80px' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <Search size={40} color="#9ca3af" />
            <p style={{ fontWeight: 900, margin: '10px 0 6px', color: '#0f172a' }}>{tr('signInToViewSavedSearches', selectedLanguage)}</p>
            <p style={{ margin: 0, color: '#6B7A99', fontSize: 13 }}>{tr('savedSearchesSyncedDesc', selectedLanguage)}</p>
            <button onClick={() => router.push('/login')} style={{ marginTop: 16, padding: '12px 24px', background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, cursor: 'pointer' }}>{tr('signIn', selectedLanguage)}</button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div dir={getDir(selectedLanguage)} className="app-shell" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('savedSearches', selectedLanguage)}</span>
      </div>

      <div style={{ padding: '12px 16px', paddingBottom: 80 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6B7A99' }}>{tr('loading', selectedLanguage)}</div>
        ) : searches.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <Search size={40} color="#9ca3af" />
            <p style={{ fontWeight: 900, margin: '10px 0 6px', color: '#0f172a' }}>{tr('noSavedSearches', selectedLanguage)}</p>
            <p style={{ margin: '0 0 16px', color: '#6B7A99', fontSize: 13 }}>{tr('tapSaveSearchDesc', selectedLanguage)}</p>
            <button onClick={() => router.push('/home')} style={{ padding: '12px 24px', background: '#2E5BFF', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, cursor: 'pointer' }}>{tr('browseListings', selectedLanguage)}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searches.map((s) => {
              const summary = filterSummary(s);
              return (
                <div key={s.id} onClick={() => runSearch(s)} style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: '#eef3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Search size={18} color="#2E5BFF" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 3px', fontWeight: 900, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeText(s.keyword)}</p>
                    {summary && (
                      <p style={{ margin: 0, fontSize: 12.5, color: '#6B7A99', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(s.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0, color: '#ef4444', display: 'flex' }}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
