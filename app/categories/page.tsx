'use client';
import { useState, useEffect, Suspense } from 'react';
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
  leisure_activities: '#14b8a6',
  business_industrial: '#64748b',
  baby_kids: '#facc15',
  pets: '#a16207',
  raw_materials: '#78716c',
};

// Curated subcategory thumbnails live in our own Supabase Storage bucket
// (category-images/<sub_id>.jpg) — the same source syph's Flutter app uses, so
// both show identical realistic photos. The emoji below is only a fallback for
// any thumbnail that hasn't been uploaded yet.
const CATEGORY_IMAGE_BASE =
  'https://phkkmxlkvflozsyxafsq.supabase.co/storage/v1/object/public/category-images';
const subImageUrl = (subId: string) => `${CATEGORY_IMAGE_BASE}/${subId}.jpg`;

// ── Thumbnail prefetch ────────────────────────────────────────────────────────
// The tiles are tiny (~15 KB) JPGs that Supabase serves with a long cache
// lifetime, so the only wait is the first network fetch. We warm the browser
// cache — the open category immediately, the rest quietly during idle time, and
// any category the moment its rail item is hovered/focused — so tiles show up
// instantly instead of streaming in on first view or category switch.
const prefetchedCats = new Set<string>();
function prefetchCategoryImages(catId: string) {
  if (typeof window === 'undefined' || prefetchedCats.has(catId)) return;
  prefetchedCats.add(catId);
  const cat = CATEGORIES.find((c) => c.id === catId);
  if (!cat) return;
  for (const sub of cat.children) {
    const img = new window.Image();
    img.decoding = 'async';
    img.src = subImageUrl(sub.id);
  }
}

// Subcategory emoji icons by sub id
const SUB_ICONS: Record<string, string> = {
  // real estate
  land: '🏞️', plots_estates: '📐', houses_sale: '🏠', apartments_sale: '🏢',
  commercial_sale: '🏪', warehouses: '🏭', office_space: '🏗️', farmland: '🌿',
  student_housing: '🎓',
  // accommodation
  rentals: '🔑', vacation_rentals: '🌴', hotels: '🏨', lodges: '🏕️',
  guest_houses: '🏡', hostels: '🛏️', resorts: '🌊', serviced_apartments: '🛎️',
  camping_sites: '⛺',
  // vehicles
  sedans: '🚗', suvs: '🚙', pickup_trucks: '🛻', vans_buses: '🚌',
  trucks: '🚛', motorcycles: '🏍️', bicycles: '🚲', boats: '⛵', spare_parts: '⚙️',
  tuk_tuks: '🛺', electric_vehicles: '🔋',
  // phones
  smartphones: '📱', feature_phones: '📟', tablets: '📲', phone_accessories: '🎧',
  smartwatches: '⌚', chargers_cables: '🔌', earbuds_headsets: '🎵', phone_repairs: '🔧',
  screen_protectors: '🛡️',
  // electronics
  laptops: '💻', desktops: '🖥️', tv_audio: '📺', gaming: '🎮',
  cameras: '📸', printers: '🖨️', networking: '📡', computer_accessories: '🖱️',
  drones: '🛸', solar_power: '☀️',
  // fashion
  mens_clothing: '👔', womens_clothing: '👗', kids_clothing: '👕', shoes: '👟',
  bags: '👜', jewelry_watches: '💍', beauty_products: '💄', salon_equipment: '✂️',
  wigs_extensions: '💇', perfumes: '🌸', sunglasses: '🕶️',
  // home
  sofas: '🛋️', beds_mattresses: '🛏️', tables_chairs: '🪑', wardrobes_storage: '🗄️',
  appliances: '🍳', kitchen_dining: '🍽️', home_decor: '🖼️', lighting: '💡',
  curtains_blinds: '🪟', garden_outdoor: '🌳',
  // food
  restaurants: '🍴', cafes: '☕', bakeries: '🥖', takeaways: '🥡',
  street_food: '🌮', catering: '🎂', bars_lounges: '🍹', water_drinks: '💧',
  groceries: '🛒', juices_smoothies: '🥤',
  // services
  transport_delivery: '🚚', cleaning: '🧹', laundry: '🧺', construction: '🏗️',
  repair_maintenance: '🔨', plumbing: '🔧', electrical: '⚡', carpentry: '🪚',
  it_services: '💻', graphics_design: '🎨', printing_branding: '🖨️',
  photography_video: '📷', beauty_spa: '💆', barber_salon: '💈', moving_services: '📦',
  digital_marketing: '📈', consulting: '🗣️', legal: '⚖️', accounting: '🧮',
  insurance: '🛡️', security_services: '🔒', tutoring: '📖', event_planning: '🎊',
  catering_services: '🍱', pest_control: '🐜', interior_design: '🎨', tailoring: '🧵',
  courier: '🛵', welding: '🔥', gardening: '🌿',
  // jobs
  full_time: '💼', part_time: '⏰', contract: '📋', internships: '🎓',
  remote: '🏠', hospitality_jobs: '🍽️', driver_jobs: '🚗', sales_jobs: '📊',
  tech_jobs: '💻', healthcare_jobs: '⚕️', teaching_jobs: '👩‍🏫',
  // events
  concerts: '🎸', conferences: '🎤', workshops: '🛠️', weddings: '💒',
  parties: '🎉', nightlife: '🌙', sports_events: '⚽', tickets: '🎟️',
  comedy_shows: '😂', exhibitions: '🖼️', cultural_events: '🎭', religious_events: '⛪',
  kids_events: '🎈', food_festivals: '🍢', fashion_shows: '💃', film_screenings: '🎬',
  charity_events: '🤝', graduation_events: '🎓',
  // agriculture
  farm_inputs: '🌱', livestock: '🐄', poultry: '🐓', fresh_produce: '🥦',
  agri_equipment: '🚜', animal_feed: '🌾', seeds_seedlings: '🌿', dairy_products: '🥛',
  fish_aquaculture: '🐟', honey_beeswax: '🍯',
  // health
  pharmacy: '💊', medical_services: '🏥', fitness: '💪', sports: '🏃',
  wellness_products: '🧴', nutrition: '🥗', therapy_support: '🧘', gym_equipment: '🏋️',
  mental_health: '🧠', dental: '🦷', optical: '👓',
  // leisure
  travel: '✈️', hotspots: '📍', entertainment: '🎭', outdoor: '🏔️',
  gaming_centers: '🕹️', tour_packages: '🗺️', beaches_resorts: '🏖️', clubs_hangouts: '🎵',
  hiking_camping: '🥾', water_sports: '🏄', cycling_tours: '🚴', kids_activities: '🛝',
  kids_parties: '🎂', theme_parks: '🎢', swimming_pools: '🏊', art_crafts: '🎨',
  music_dance: '🎶', spa_relaxation: '💆', cinema: '🎬', escape_rooms: '🔐',
  // business & industrial
  machinery: '⚙️', tools: '🔧', safety_equipment: '🦺', industrial_supplies: '🏭',
  office_supplies: '📎', shops_showrooms: '🏬', wholesale: '📦', retail_stock: '🛍️',
  packaging: '📦', cleaning_supplies: '🧴',
  // baby
  baby_products: '👶', toys_games: '🧸', kids_fashion: '👗', school_items: '📚',
  strollers: '🛺', baby_furniture: '🪑', kids_electronics: '📱', kids_books: '📖',
  kids_sports: '⚽', baby_food: '🍼', diapers_hygiene: '🧷', maternity: '🤰',
  // pets
  pets_for_sale: '🐕', pet_food: '🦴', pet_accessories: '🎀', pet_services: '🐾',
  aquariums: '🐠', bird_supplies: '🦜', vet_services: '💉', pet_grooming: '✂️',
  // raw materials
  chemicals: '🧪', fuels_energy: '🛢️', wood_forestry: '🪵', textile_fibers: '🧵',
  plastics_polymers: '♳', agri_raw_materials: '🌾', minerals_ores: '⛏️',
  glass_ceramics: '🏺', water_natural: '💧', recyclable_materials: '♻️',
};

// Circular subcategory thumbnail: shows the curated Supabase photo, falling
// back to the coloured emoji tile if the image is missing or fails to load.
// Mirrors the syph Flutter SubcategoriesScreen look.
function SubThumb({ subId, icon, color }: { subId: string; icon: string; color: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{
      width: 82,
      height: 82,
      borderRadius: '50%',
      overflow: 'hidden',
      backgroundColor: color + '1F',
      border: `2px solid ${color}4D`,
      boxShadow: `0 2px 8px ${color}40`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 36,
    }}>
      {failed ? (
        icon
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={subImageUrl(subId)}
          alt=""
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </div>
  );
}

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

  // Warm thumbnails: the open category first, then the rest during idle time so
  // switching to any other category is instant. Runs once on mount.
  useEffect(() => {
    prefetchCategoryImages(CATEGORIES[initialIndex]?.id ?? CATEGORIES[0].id);
    const ric: ((cb: () => void) => number) | undefined =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    let i = 0;
    let handle: number | undefined;
    const warmNext = () => {
      if (i >= CATEGORIES.length) return;
      prefetchCategoryImages(CATEGORIES[i++].id);
      handle = ric ? ric(warmNext) : (setTimeout(warmNext, 150) as unknown as number);
    };
    warmNext();
    return () => {
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (handle == null) return;
      if (ric && cancel) cancel(handle); else clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wide-page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--desktop-nav-h))', overflow: 'hidden', backgroundColor: '#D6ECFF' }} dir={getDir(selectedLanguage)}>
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
                onMouseEnter={() => prefetchCategoryImages(cat.id)}
                onFocus={() => prefetchCategoryImages(cat.id)}
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

            {/* subcategory grid — 3 cols on phone, more on wider screens */}
            <div className="subcat-grid">
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
                    <SubThumb subId={sub.id} icon={icon} color={color} />
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
