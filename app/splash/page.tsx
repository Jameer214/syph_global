'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin } from 'lucide-react';
import { useAppStore } from '@/store';
import { CONTINENTS, CONTINENT_VIEWBOX } from '@/data/continentPaths';

/*
 * SYPH opening — a clean, fast wordmark over a living world map. The slow
 * firefly-morph intro was removed; SYPH now fades straight in while the
 * glowing continents and location pings keep the backdrop alive, then the
 * slogan and Explore CTA rise before the dive-forward handoff to the app.
 */

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Glow palette for the background continents — silver / gold / green outlines
const GLOW: Record<string, { stroke: string; glow: string }> = {
  silver: { stroke: '#CBD6E6', glow: 'rgba(200,214,235,0.75)' },
  gold: { stroke: '#FFCE7A', glow: 'rgba(255,200,110,0.8)' },
  green: { stroke: '#7FE3AA', glow: 'rgba(120,225,160,0.75)' },
};

// Live activity pings across the world-map backdrop — %-coords over each
// continent, staggered so locations keep lighting up around the globe.
const WORLD_PINGS = [
  { x: 22, y: 34, d: 0.0 },   // North America
  { x: 32, y: 70, d: 1.1 },   // South America
  { x: 48, y: 30, d: 0.5 },   // Europe
  { x: 51, y: 58, d: 1.7 },   // Africa
  { x: 62, y: 45, d: 2.3 },   // Middle East / W. Asia
  { x: 76, y: 36, d: 0.9 },   // E. Asia
  { x: 84, y: 74, d: 2.8 },   // Australia
];

// Red location pings scattered over the tilted plane (x/y in % of the plane, d = start delay)
const PINGS = [
  { x: 30, y: 52, d: 0 },
  { x: 53, y: 38, d: 0.7 },
  { x: 45, y: 64, d: 1.3 },
  { x: 71, y: 50, d: 1.9 },
  { x: 84, y: 32, d: 2.5 },
];

// ── Timeline (ms) — snappy; everything is present at once, no word intros ───
const EXIT_AT = 3000;
const ROUTE_AT = 3400;

export default function SplashScreen() {
  const router = useRouter();
  const { selectedCountry, locationSet } = useAppStore();
  const routedRef = useRef(false);
  // Content is shown from the first frame (initial={false} → no entrance
  // transition); only the exit fade animates.
  const [showSlogan] = useState(true);
  const [showCTA] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const goExplore = () => {
    if (routedRef.current) return;
    routedRef.current = true;
    setLeaving(true);
    setTimeout(() => {
      if (locationSet && selectedCountry) router.replace('/home');
      else router.replace('/location');
    }, 350);
  };
  const goExploreRef = useRef(goExplore);
  goExploreRef.current = goExplore;

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setLeaving(true), EXIT_AT));
    timers.push(setTimeout(() => goExploreRef.current(), ROUTE_AT));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ scale: leaving ? 1.08 : 1 }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      style={{
        minHeight: '100dvh', position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(120% 100% at 50% 0%, #0A1838 0%, #050B1E 55%, #02040C 100%)',
      }}
    >
      {/* Background world map — accurate continent silhouettes spanning the
          backdrop, each outline glowing silver / gold / green. */}
      <motion.svg
        viewBox={CONTINENT_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        initial={false}
        animate={{ opacity: leaving ? 0 : 0.5 }}
        transition={{ duration: leaving ? 0.5 : 1.6, ease: 'easeOut' }}
        style={{
          position: 'absolute', left: '50%', top: '41%', width: '134%',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }}
      >
        {CONTINENTS.map((c) => {
          const g = GLOW[c.color];
          return (
            <path
              key={c.key}
              d={c.d}
              fill={g.stroke}
              fillOpacity={0.05}
              stroke={g.stroke}
              strokeWidth={0.7}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: `drop-shadow(0 0 2px ${g.glow}) drop-shadow(0 0 6px ${g.glow})` }}
            />
          );
        })}
      </motion.svg>

      {/* Live activity pings — locations lighting up across the continents,
          keeping the whole backdrop alive. Box matches the world-map layer. */}
      <motion.div
        initial={false}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ duration: leaving ? 0.5 : 1.6, ease: 'easeOut' }}
        style={{
          position: 'absolute', left: '50%', top: '41%', width: '134%',
          aspectRatio: '672 / 315', transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }}
      >
        {WORLD_PINGS.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%` }}>
            {!reducedMotion && (
              <span style={{
                position: 'absolute', left: '50%', top: '50%', width: 26, height: 26,
                marginLeft: -13, marginTop: -13, borderRadius: '50%',
                border: '1.4px solid rgba(255,90,80,0.7)',
                animation: `radarPing 3s ease-out ${p.d}s infinite`,
              }} />
            )}
            <span style={{
              position: 'absolute', left: '50%', top: '50%', width: 6, height: 6,
              marginLeft: -3, marginTop: -3, borderRadius: '50%', background: '#FF5A50',
              boxShadow: '0 0 8px 2px rgba(255,90,80,0.85)',
              animation: reducedMotion ? 'none' : `pulse 3s ease-in-out ${p.d}s infinite`,
            }} />
          </div>
        ))}
      </motion.div>

      {/* Living-map graticule — latitude/longitude grid + contour "landmasses". */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }} preserveAspectRatio="none" viewBox="0 0 100 100">
        {[12, 31, 50, 69, 88].map((x, i) => (
          <path key={`m${i}`} d={`M ${x} 0 Q ${50 + (x - 50) * 0.4} 50 ${x} 100`} fill="none" stroke="#7FA8FF" strokeWidth="0.13" />
        ))}
        {[14, 30, 46, 62, 78, 92].map((y, i) => (
          <line key={`p${i}`} x1="0" y1={y} x2="100" y2={y} stroke="#7FA8FF" strokeWidth="0.09" />
        ))}
        {[20, 34, 50].map((r, i) => (
          <ellipse key={`c${i}`} cx={i % 2 ? 76 : 24} cy={i % 2 ? 26 : 74} rx={r} ry={r * 0.6} fill="none" stroke="#7FA8FF" strokeWidth="0.11" />
        ))}
      </svg>

      {/* Radar sweep — a slow rotating beam centred on the wordmark. */}
      <div
        style={{
          position: 'absolute', top: '44%', left: '50%', width: '160vmax', height: '160vmax',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: leaving ? 0 : 0.55,
          transition: 'opacity 0.5s ease', borderRadius: '50%', mixBlendMode: 'screen',
          background: 'conic-gradient(from 0deg, transparent 0deg, rgba(120,170,255,0.12) 34deg, transparent 62deg)',
          animation: reducedMotion ? 'none' : 'haloSpin 9s linear infinite',
        }}
      />

      {/* Aurora depth layers */}
      <div className="aurora-blob" style={{ width: 420, height: 420, top: '-14%', left: '-12%', background: 'rgba(36,80,220,0.25)' }} />
      <div className="aurora-blob" style={{ width: 340, height: 340, bottom: '-16%', right: '-10%', background: 'rgba(90,70,220,0.20)', animationDelay: '-7s' }} />

      {/* Drifting light fog */}
      <motion.div
        animate={{ x: [0, 50, 0] }}
        transition={{ duration: 26, ease: 'easeInOut', repeat: Infinity }}
        style={{
          position: 'absolute', top: '58%', left: '-12%', width: '80%', height: 160,
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(130,170,255,0.07) 0%, transparent 70%)',
          filter: 'blur(30px)', pointerEvents: 'none',
        }}
      />

      {/* SYPH wordmark — clean, fast fade-in; blooms and dives on exit. */}
      <motion.div
        initial={false}
        animate={leaving ? { opacity: 0, scale: 1.12 } : { opacity: 1, scale: 1 }}
        transition={{ duration: leaving ? 0.5 : 0.7, ease: leaving ? [0.4, 0, 0.2, 1] : [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute', left: 0, right: 0, top: '44%', transform: 'translateY(-50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}
      >
        <span style={{
          fontFamily: FONT_STACK, fontSize: 'clamp(58px, 19vw, 168px)', fontWeight: 900,
          letterSpacing: 'clamp(2px, 1vw, 6px)',
          background: 'linear-gradient(180deg, #F4F8FF 30%, #9DB8FF 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          filter: 'drop-shadow(0 0 24px rgba(120,165,255,0.55))',
        }}>
          SYPH
        </span>
      </motion.div>

      {/* Tilted map surface — a golden-glowing continent plane in perspective
          with red location pings popping up on it. Rises in with the slogan. */}
      <motion.div
        initial={false}
        animate={leaving ? { opacity: 0, y: 10 } : showSlogan ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
        transition={{ duration: leaving ? 0.5 : 1.0, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute', left: '50%', top: '63%', transform: 'translateX(-50%)',
          width: 'min(600px, 94vw)', height: 300, perspective: 820, pointerEvents: 'none',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: 'rotateX(60deg)' }}>
          {/* soft ground glow beneath the landmass */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%', width: '82%', height: '66%',
            transform: 'translate(-50%,-50%)', borderRadius: '50%',
            background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,200,110,0.14) 0%, transparent 72%)',
            filter: 'blur(8px)',
          }} />
          {/* continents — golden glowing outlines */}
          <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            filter: 'drop-shadow(0 0 6px rgba(255,200,110,0.85)) drop-shadow(0 0 18px rgba(255,185,80,0.5))',
          }}>
            <path d="M28,64 C18,44 42,30 66,36 C84,22 116,26 128,44 C158,40 182,60 168,84 C176,102 142,108 116,96 C92,110 56,104 46,86 C30,86 24,78 28,64 Z"
              fill="rgba(255,205,120,0.06)" stroke="#FFCE7A" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M150,24 C161,18 179,23 176,36 C172,47 152,47 149,36 C147,30 146,27 150,24 Z"
              fill="rgba(255,205,120,0.06)" stroke="#FFCE7A" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          {/* red location pings — flat ripples on the ground, upright pin markers */}
          {PINGS.map((p, i) => (
            <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transformStyle: 'preserve-3d' }}>
              {!reducedMotion && [0, 0.55].map((off, k) => (
                <span key={k} style={{
                  position: 'absolute', left: '50%', top: '50%', width: 40, height: 40,
                  marginLeft: -20, marginTop: -20, borderRadius: '50%',
                  border: '1.6px solid rgba(255,72,66,0.75)',
                  animation: `radarPing 2.6s ease-out ${p.d + off}s infinite`,
                }} />
              ))}
              <span style={{
                position: 'absolute', left: '50%', top: '50%',
                transform: 'translate(-50%,-100%) rotateX(-60deg)',
                animation: reducedMotion ? 'none' : `popIn 0.5s ${p.d}s backwards`,
                filter: 'drop-shadow(0 5px 5px rgba(0,0,0,0.45))',
              }}>
                <MapPin size={24} fill="#FF3B30" color="#fff" strokeWidth={2.4} />
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Slogan — large, gradient words with glowing separators */}
      <motion.div
        initial={false}
        animate={leaving ? { opacity: 0, y: -22 } : showSlogan ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
        transition={{ duration: leaving ? 0.5 : 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute', left: 0, right: 0, top: '57%',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 'clamp(10px, 3vw, 18px)', flexWrap: 'wrap', padding: '0 16px',
          pointerEvents: 'none',
        }}
      >
        {['FIND IT', 'LOCATE IT', 'CONNECT'].map((word, i) => (
          <span key={word} style={{ display: 'inline-flex', alignItems: 'center', gap: 'clamp(10px, 3vw, 18px)' }}>
            <motion.span
              initial={false}
              animate={showSlogan ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.6, delay: 0.12 * i, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontSize: 'clamp(17px, 4.6vw, 24px)', fontWeight: 900,
                letterSpacing: 'clamp(3px, 1vw, 6px)', whiteSpace: 'nowrap',
                background: 'linear-gradient(180deg, #FFFFFF 35%, #9DB8FF 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                filter: 'drop-shadow(0 0 16px rgba(120,160,255,0.5))',
              }}
            >
              {word}
            </motion.span>
            {i < 2 && (
              <motion.span
                initial={false}
                animate={showSlogan ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.5, delay: 0.12 * i + 0.08, ease: [0.34, 1.56, 0.64, 1] }}
                style={{
                  color: '#FFCD78', fontSize: 'clamp(8px, 2vw, 11px)',
                  textShadow: '0 0 12px rgba(255,200,110,0.9)',
                }}
              >
                ◆
              </motion.span>
            )}
          </span>
        ))}
      </motion.div>

      {/* Explore CTA — design accent below the slogan; routing is automatic */}
      <motion.div
        initial={false}
        animate={showCTA && !leaving ? { opacity: 1, y: 0 } : { opacity: showCTA ? 0 : 0, y: showCTA ? 0 : 24 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute', left: 0, right: 0, top: '74%',
          display: 'flex', justifyContent: 'center', padding: '0 22px',
          pointerEvents: showCTA ? 'auto' : 'none',
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); goExplore(); }}
          className="btn-tap sweep cta-armed"
          style={{
            width: '100%', maxWidth: 340, height: 54, borderRadius: 27, border: 'none',
            background: 'linear-gradient(135deg, #2E5BFF 0%, #6C63FF 100%)',
            color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            boxShadow: '0 14px 38px rgba(46,91,255,0.5)',
          }}
        >
          Explore SYPH <ArrowRight size={18} />
        </button>
      </motion.div>

      {/* Exit wash — a light bloom (not black) that dissolves seamlessly into
          the light app screen's fade-in, so there's no dark flash between them */}
      <motion.div
        initial={false}
        animate={{ opacity: leaving ? 1 : 0 }}
        transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(120% 90% at 50% 44%, #FFFFFF 0%, #EAF0FF 42%, #F0F4FF 100%)',
        }}
      />
    </motion.div>
  );
}
