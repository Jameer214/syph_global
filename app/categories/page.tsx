'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { CATEGORIES } from '@/data/categories';
import { useAppStore } from '@/store';
import { tr, getDir, trCategory } from '@/lib/i18n';

// ── Category color map (emoji-based fallback icons per category) ──────────────
const CATEGORY_COLORS: Record<string, string> = {
  real_estate: '#10b981',
  accommodation: '#0ea5e9',
  vehicles: '#f97316',
  phones_accessories: '#8b5cf6',
  electronics: '#06b6d4',
  fashion_beauty: '#ec4899',
  home_furniture: '#f59e0b',
  food_drinks: '#84cc16',
  services: '#64748b',
  jobs: '#6366f1',
  events_tickets: '#d946ef',
  agriculture: '#22c55e',
  health_wellness: '#ef4444',
  leisure_travel: '#14b8a6',
  baby_kids: '#facc15',
  pets: '#a16207',
};

// Subcategory emoji icons by sub id
const SUB_ICONS: Record<string, string> = {
  // real estate
  land: '🏞️', plots_estates: '📐', houses_sale: '🏠', apartments_sale: '🏢',
  commercial_sale: '🏪', warehouses: '🏭', office_space: '🏗️', farmland: '🌿',
  // accommodation
  rentals: '🔑', vacation_rentals: '🌴', hotels: '🏨', lodges: '🏕️',
  guest_houses: '🏡', hostels: '🛏️', resorts: '🌊',
  // vehicles
  sedans: '🚗', suvs: '🚙', pickup_trucks: '🛻', vans_buses: '🚌',
  trucks: '🚛', motorcycles: '🏍️', bicycles: '🚲', boats: '⛵', spare_parts: '⚙️',
  // phones
  smartphones: '📱', feature_phones: '📟', tablets: '📲', phone_accessories: '🎧',
  smartwatches: '⌚', chargers_cables: '🔌', earbuds_headsets: '🎵', phone_repairs: '🔧',
  // electronics
  laptops: '💻', desktops: '🖥️', tv_audio: '📺', gaming: '🎮',
  cameras: '📸', printers: '🖨️', networking: '📡', computer_accessories: '🖱️',
  // fashion
  mens_clothing: '👔', womens_clothing: '👗', kids_clothing: '👕', shoes: '👟',
  bags: '👜', jewelry_watches: '💍', beauty_products: '💄', salon_equipment: '✂️',
  // home
  sofas: '🛋️', beds_mattresses: '🛏️', tables_chairs: '🪑', wardrobes_storage: '🗄️',
  appliances: '🍳', kitchen_dining: '🍽️', home_decor: '🖼️', lighting: '💡',
  // food
  restaurants: '🍴', cafes: '☕', bakeries: '🥖', takeaways: '🥡',
  street_food: '🌮', catering: '🎂', bars_lounges: '🍹', water_drinks: '💧',
  // services
  transport_delivery: '🚚', cleaning: '🧹', construction: '🏗️', repair_maintenance: '🔨',
  plumbing: '🔧', electrical: '⚡', it_services: '💻', graphics_design: '🎨',
  photography_video: '📷',
  // jobs
  full_time: '💼', part_time: '⏰', contract: '📋', internships: '🎓',
  remote: '🏠', hospitality_jobs: '🍽️', driver_jobs: '🚗', sales_jobs: '📊',
  // events
  concerts: '🎸', conferences: '🎤', workshops: '🛠️', weddings: '💒',
  parties: '🎉', nightlife: '🌙', sports_events: '⚽', tickets: '🎟️',
  // agriculture
  farm_inputs: '🌱', livestock: '🐄', poultry: '🐓', fresh_produce: '🥦',
  agri_equipment: '🚜', animal_feed: '🌾', seeds_seedlings: '🌿', dairy_products: '🥛',
  // health
  pharmacy: '💊', medical_services: '🏥', fitness: '💪', sports: '🏃',
  wellness_products: '🧴', nutrition: '🥗', therapy_support: '🧘', gym_equipment: '🏋️',
  // leisure
  travel: '✈️', hotspots: '📍', entertainment: '🎭', outdoor: '🏔️',
  gaming_centers: '🕹️', tour_packages: '🗺️', beaches_resorts: '🏖️', clubs_hangouts: '🎵',
  // baby
  baby_products: '👶', toys_games: '🧸', kids_fashion: '👗', school_items: '📚',
  strollers: '🛺', baby_furniture: '🪑',
  // pets
  pets_for_sale: '🐕', pet_food: '🦴', pet_accessories: '🎀', pet_services: '🐾',
  aquariums: '🐠', bird_supplies: '🦜',
};

export default function CategoriesPage() {
  return (
    <Suspense fallback={null}>
      <CategoriesBrowser />
    </Suspense>
  );
}

function CategoriesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?cat=<id> preselects a category (used by the location-screen cards)
  const initialIndex = Math.max(0, CATEGORIES.findIndex(c => c.id === searchParams.get('cat')));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const { selectedLanguage } = useAppStore();

  const selectedMain = CATEGORIES[selectedIndex];
  const mainColor = CATEGORY_COLORS[selectedMain.id] ?? '#2E5BFF';

  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#D6ECFF' }} dir={getDir(selectedLanguage)}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
        padding: '0 16px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', padding: 4 }}
        >
          <ArrowLeft size={22} />
        </button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>{tr('categories', selectedLanguage)}</span>
      </div>

      {/* Body: rail + panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left rail */}
        <div style={{
          width: 96,
          backgroundColor: '#F8F9FA',
          borderRight: '0.8px solid #e2e8f0',
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          {CATEGORIES.map((cat, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedIndex(index)}
                style={{
                  width: '100%',
                  minHeight: 72,
                  padding: '11px 9px',
                  background: isSelected ? '#fff' : '#F8F9FA',
                  border: 'none',
                  borderLeft: `3px solid ${isSelected ? '#2E5BFF' : 'transparent'}`,
                  borderBottom: '0.6px solid #e2e8f0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
              >
                <span style={{
                  fontSize: 20, lineHeight: 1, display: 'inline-block',
                  transition: 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: isSelected ? 'scale(1.22)' : 'scale(1)',
                }}>{cat.icon}</span>
                <span style={{
                  fontSize: 11.8,
                  lineHeight: 1.12,
                  fontWeight: isSelected ? 800 : 600,
                  color: isSelected ? '#2E5BFF' : '#4D5968',
                }}>
                  {trCategory(cat.id, cat.title, selectedLanguage)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right panel — keyed by category so the grid re-animates on switch */}
        <div style={{ flex: 1, backgroundColor: '#fff', overflowY: 'auto' }}>
          <div key={selectedMain.id} style={{ padding: '12px 12px 16px' }}>
            {/* Category title + description */}
            <p className="anim-fade-up" style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', lineHeight: 1.1, margin: 0, animationDuration: '0.3s' }}>
              {trCategory(selectedMain.id, selectedMain.title, selectedLanguage)}
            </p>
            {selectedMain.description && (
              <p className="anim-fade-up" style={{ fontSize: 12.4, color: '#6B7A99', fontWeight: 600, lineHeight: 1.24, margin: '6px 0 0', animationDuration: '0.3s', animationDelay: '0.04s' }}>
                {selectedMain.description}
              </p>
            )}

            <div style={{ height: 14 }} />

            {/* 3-col subcategory grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px 8px',
            }}>
              {/* View all — everything in this category */}
              <button
                onClick={() => router.push(`/category/${selectedMain.id}`)}
                className="btn-tap anim-fade-up"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 8, padding: 4, animationDuration: '0.35s',
                }}
              >
                <div style={{
                  width: 82, height: 82, borderRadius: '50%',
                  backgroundColor: mainColor + '14',
                  border: `2px dashed ${mainColor}66`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LayoutGrid size={26} color={mainColor} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: mainColor, lineHeight: 1.15, textAlign: 'center', maxWidth: 82 }}>
                  {tr('viewAll', selectedLanguage)}
                </span>
              </button>

              {selectedMain.children.map((sub, i) => {
                const color = CATEGORY_COLORS[sub.id] ?? mainColor;
                const icon = SUB_ICONS[sub.id] ?? '📦';
                return (
                  <button
                    key={sub.id}
                    onClick={() => router.push(`/category/${selectedMain.id}/${sub.id}`)}
                    className="btn-tap anim-fade-up"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      padding: 4,
                      animationDuration: '0.35s',
                      animationDelay: `${(i + 1) * 0.04}s`,
                    }}
                  >
                    <div style={{
                      width: 82,
                      height: 82,
                      borderRadius: '50%',
                      backgroundColor: color + '1F',
                      border: `2px solid ${color}4D`,
                      boxShadow: `0 2px 8px ${color}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 36,
                    }}>
                      {icon}
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#0f172a',
                      lineHeight: 1.15,
                      textAlign: 'center',
                      maxWidth: 82,
                      wordBreak: 'break-word',
                    }}>
                      {sub.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
