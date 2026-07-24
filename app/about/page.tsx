'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Compass, Users, Globe, ShoppingBag, Info,
  Navigation, MapPin, MessageCircle, Coins, BadgeCheck, Heart,
} from 'lucide-react';
import Reveal from '@/components/Reveal';

// ── Count-up number that animates when scrolled into view ──────────────────────
function CountUp({ target, suffix = '', duration = 1400 }: { target: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setVal(target); return; }

    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !done.current) {
        done.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          setVal(Math.round(eased * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  const formatted = target >= 1000 ? `${Math.round(val / 1000)}K` : `${val}`;
  return <span ref={ref}>{formatted}{suffix}</span>;
}

const REGIONS = [
  '🇺🇬 Uganda', '🇰🇪 Kenya', '🇹🇿 Tanzania', '🇷🇼 Rwanda', '🇳🇬 Nigeria',
  '🇬🇭 Ghana', '🇿🇦 South Africa', '🇪🇹 Ethiopia', '🇪🇬 Egypt', '🇲🇦 Morocco',
  '🇬🇧 UK', '🇩🇪 Germany', '🇫🇷 France', '🌍 & everywhere',
];

const FEATURES = [
  { Icon: Navigation, color: '#1E4DD9', title: 'GPS Directions', desc: 'Turn-by-turn navigation straight to the business’s door — no more getting lost.' },
  { Icon: MapPin, color: '#2E9B55', title: 'Near Me', desc: 'See what’s around you, ranked by real distance from where you stand.', radar: true },
  { Icon: MessageCircle, color: '#7A5AF8', title: 'Chat Direct', desc: 'Message any seller instantly. You talk to the business — never a middleman.' },
  { Icon: Globe, color: '#4A7AFF', title: 'Any Country', desc: 'Search and filter by country and region, anywhere on the map.' },
  { Icon: Coins, color: '#E08A00', title: 'Your Currency', desc: 'Every price auto-converted into the money you actually use.' },
  { Icon: BadgeCheck, color: '#E25A2C', title: 'Trusted & Boosted', desc: 'Discover verified and sponsored businesses you can rely on.' },
];

export default function AboutPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 40, overflowX: 'hidden' }}>
      <style>{`
        @keyframes aboutOrb { 0%,100%{ transform: translate(0,0) scale(1);} 50%{ transform: translate(24px,-18px) scale(1.15);} }
        @keyframes aboutSpin { to { transform: rotate(360deg); } }
        .about-hero-title {
          background: linear-gradient(100deg,#fff 20%,#BFD4FF 45%,#fff 70%);
          background-size: 200% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: textShimmer 4.5s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .about-hero-title { animation: none; -webkit-text-fill-color: #fff; }
          .about-orb, .about-globe { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} className="btn-tap" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>About SYPH</div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {/* Hero card */}
        <div className="anim-fade-up sweep" style={{ background: 'linear-gradient(135deg, #0F2B6E, #1E4DD9 55%, #4A7AFF)', borderRadius: 32, padding: 24, marginBottom: 24, minHeight: 210, position: 'relative', overflow: 'hidden', boxShadow: '0 14px 30px rgba(30,77,217,0.35)' }}>
          {/* floating orbs */}
          <div className="about-orb" style={{ position: 'absolute', right: -24, top: -24, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', animation: 'aboutOrb 7s ease-in-out infinite' }} />
          <div className="about-orb" style={{ position: 'absolute', left: -34, bottom: -34, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', animation: 'aboutOrb 9s ease-in-out infinite reverse' }} />

          {/* spinning globe badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontWeight: 800, fontSize: 11.5, borderRadius: 999, padding: '5px 11px', backdropFilter: 'blur(4px)' }}>
              <span className="about-globe" style={{ display: 'inline-block', animation: 'aboutSpin 6s linear infinite' }}>🌍</span>
              GLOBAL MARKETPLACE
            </span>
          </div>

          <div style={{ position: 'relative', marginTop: 26 }}>
            {['Find it.', 'Locate it.', 'Connect.'].map((line, i) => (
              <div key={i} className="anim-fade-up about-hero-title" style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.6, lineHeight: 1.12, animationDelay: `${0.15 + i * 0.12}s` }}>{line}</div>
            ))}
            <div className="anim-fade-up" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, marginTop: 12, maxWidth: 300, animationDelay: '0.55s' }}>
              Your pocket broker — connecting you to the businesses you want, in any country, any region.
            </div>
          </div>
        </div>

        {/* Broker relief — old way vs SYPH way */}
        <Reveal>
          <div style={{ background: '#fff', borderRadius: 28, padding: 22, marginBottom: 20, boxShadow: '0 8px 20px rgba(30,77,217,0.08)' }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#0F2B6E', letterSpacing: -0.3 }}>Skip the middleman hustle</div>
            <div style={{ color: '#6B7A99', fontSize: 13.5, fontWeight: 600, marginTop: 6, lineHeight: 1.5 }}>
              No more roaming markets, asking around, or paying a physical broker to find a business. SYPH <b>is</b> the broker — right in your pocket.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div style={{ background: '#FFF1F0', border: '1px solid #F3D2CF', borderRadius: 18, padding: '14px 14px' }}>
                <div style={{ fontSize: 22 }}>😩</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#C0392B', marginTop: 6 }}>The old way</div>
                {['Roam market to market', 'Pay a broker’s cut', 'Endless asking around'].map((t) => (
                  <div key={t} style={{ fontSize: 12, color: '#8a4a44', fontWeight: 600, marginTop: 6, lineHeight: 1.35 }}>• {t}</div>
                ))}
              </div>
              <div className="lift" style={{ background: 'linear-gradient(135deg,#E9F7EF,#DFF4E8)', border: '1px solid #BEE7CE', borderRadius: 18, padding: '14px 14px' }}>
                <div style={{ fontSize: 22 }} className="lift-emoji">⚡</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1F8B4C', marginTop: 6 }}>The SYPH way</div>
                {['Search & tap', 'GPS to their door', 'Chat the business direct'].map((t) => (
                  <div key={t} style={{ fontSize: 12, color: '#2f6b47', fontWeight: 600, marginTop: 6, lineHeight: 1.35 }}>• {t}</div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* Global reach marquee */}
        <Reveal>
          <div style={{ background: 'linear-gradient(135deg,#0F2B6E,#1E4DD9)', borderRadius: 24, padding: '18px 0 18px', marginBottom: 20, overflow: 'hidden', position: 'relative' }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 15, padding: '0 20px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={17} color="#BFD4FF" /> Connecting people across borders
            </div>
            <div style={{ display: 'flex', width: 'max-content', animation: 'scrollLeft 22s linear infinite' }} className="ticker-row">
              {[...REGIONS, ...REGIONS].map((r, i) => (
                <span key={i} style={{ flexShrink: 0, margin: '0 6px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700, fontSize: 12.5, borderRadius: 999, padding: '7px 13px', whiteSpace: 'nowrap' }}>{r}</span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* How SYPH connects you — feature grid */}
        <Reveal>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#0F2B6E', letterSpacing: -0.3, margin: '4px 4px 14px' }}>How SYPH connects you</div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
          {FEATURES.map(({ Icon, color, title, desc, radar }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div className="lift" style={{ height: '100%', background: '#fff', borderRadius: 22, padding: 16, boxShadow: `0 6px 16px ${color}14`, border: '1px solid #EEF2FF' }}>
                <div className={radar ? 'radar' : undefined} style={{ width: 44, height: 44, background: `${color}18`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon size={22} color={color} />
                </div>
                <div style={{ fontWeight: 900, fontSize: 14.5, color: '#0F2B6E' }}>{title}</div>
                <div style={{ color: '#6B7A99', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45, marginTop: 6 }}>{desc}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Mission card (kept content, revealed) */}
        <Reveal>
          <div style={{ background: '#fff', borderRadius: 28, padding: 24, marginBottom: 20, boxShadow: '0 8px 20px rgba(30,77,217,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <div className="bob" style={{ width: 52, height: 52, background: '#E8F0FF', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Compass size={28} color="#1E4DD9" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#0F2B6E', letterSpacing: -0.3 }}>Our Mission</div>
                <div style={{ color: '#6B7A99', fontSize: 14, fontWeight: 600, marginTop: 4 }}>Connecting the world, locally</div>
              </div>
            </div>
            {[
              'Discover items, services, and opportunities around you — fast.',
              'Search what you need, filter by country/region, and connect with the right people.',
              'For sellers and service providers, list offerings, reach local buyers, and boost visibility through sponsored placement.',
              'Our goal is simple: help people find things nearby and connect quicker — no broker required.',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg, #1E4DD9, #4A7AFF)', flexShrink: 0, marginTop: 7 }} />
                <span style={{ color: '#2D3A5E', fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{text}</span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Stats row — count up */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { node: <CountUp target={10000} suffix="+" />, label: 'Active Users', Icon: Users, color: '#1E4DD9' },
            { node: <CountUp target={50} suffix="+" />, label: 'Countries', Icon: Globe, color: '#4A7AFF' },
            { node: <CountUp target={100000} suffix="+" />, label: 'Listings', Icon: ShoppingBag, color: '#80A5FF' },
          ].map(({ node, label, Icon, color }, i) => (
            <Reveal key={label} delay={i * 0.08}>
              <div className="lift" style={{ background: '#fff', borderRadius: 22, padding: 16, boxShadow: `0 4px 12px ${color}1A`, textAlign: 'center' }}>
                <div style={{ width: 38, height: 38, background: `${color}1A`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <Icon size={22} color={color} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color }}>{node}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7A99', marginTop: 4 }}>{label}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Version card */}
        <Reveal>
          <div style={{ background: '#fff', borderRadius: 20, border: '2px solid #E8F0FF', padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 36, height: 36, background: '#E8F0FF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Info size={20} color="#1E4DD9" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#0F2B6E', fontSize: 15 }}>Version 1.0.0</div>
              <div style={{ color: '#6B7A99', fontWeight: 600, fontSize: 13, marginTop: 4 }}>Last updated: July 2026</div>
            </div>
            <div style={{ background: '#E1F5E8', borderRadius: 30, padding: '6px 12px', color: '#2DBE7F', fontWeight: 800, fontSize: 12 }}>Latest</div>
          </div>
        </Reveal>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#9AA0B2', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          Made with <Heart size={13} color="#E25A2C" fill="#E25A2C" className="bob" /> to connect the world
        </div>
      </div>
    </div>
  );
}
