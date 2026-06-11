'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ArrowRight, Store } from 'lucide-react';
import { useAppStore } from '@/store';

/*
 * SYPH cinematic opening — "a digital ecosystem wakes up and connects itself".
 * Fireflies (each one a listing / business / opportunity) drift in darkness,
 * discover each other, weave a living golden-blue network, then the network
 * morphs into the SYPH wordmark formed entirely of connected nodes.
 * Slogan, search and CTAs rise in beneath. Click anywhere to skip ahead.
 */

// ── Timeline (ms) ──────────────────────────────────────────────────────────
const APPEAR_END = 2000;   // fireflies fade in
const NET_RAMP_START = 900;    // first connection lines
const NET_FULL = 2600;   // network fully alive
const MORPH_START = 3100;   // network begins forming SYPH
const MORPH_DUR = 1400;
const SLOGAN_AT = 4650;
const CTA_AT = 5150;
const SKIP_TO = MORPH_START + MORPH_DUR; // where a skip-click lands

const PLACEHOLDERS = [
  'Find products...',
  'Locate services...',
  'Discover businesses...',
  'Connect with opportunities...',
];

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Firefly {
  x: number; y: number;       // current position
  vx: number; vy: number;     // wander velocity
  r: number;                  // core radius
  gold: boolean;              // gold vs cyan firefly
  flicker: number;            // flicker phase
  appearAt: number;           // when this firefly fades in
  tx: number; ty: number;     // morph target (letterform node), -1 if ambient
  mx: number; my: number;     // frozen wander position at morph start
}

// Sample the SYPH letterform into node targets from an offscreen canvas
function sampleWordTargets(width: number, height: number): { x: number; y: number }[] {
  const off = document.createElement('canvas');
  const W = 1200, H = 360;
  off.width = W; off.height = H;
  const c = off.getContext('2d');
  if (!c) return [];
  c.fillStyle = '#fff';
  c.font = '900 250px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('SYPH', W / 2, H / 2);
  const data = c.getImageData(0, 0, W, H).data;
  const pts: { x: number; y: number }[] = [];
  const step = 9;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 128) pts.push({ x, y });
    }
  }
  // Scale the sampled word into the main canvas, centered ~42% up
  const wordW = Math.min(width * 0.86, 600);
  const scale = wordW / W;
  const ox = (width - W * scale) / 2;
  const oy = height * 0.40 - (H * scale) / 2;
  return pts.map(p => ({ x: ox + p.x * scale, y: oy + p.y * scale }));
}

export default function SplashScreen() {
  const router = useRouter();
  const { selectedCountry, locationSet } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(0);
  const skippedRef = useRef(false);

  const [showSlogan, setShowSlogan] = useState(false);
  const [showCTAs, setShowCTAs] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [phIndex, setPhIndex] = useState(0);

  // Rotating search placeholder
  useEffect(() => {
    if (!showCTAs) return;
    const id = setInterval(() => setPhIndex(i => (i + 1) % PLACEHOLDERS.length), 2600);
    return () => clearInterval(id);
  }, [showCTAs]);

  // Mouse-reactive glow (transform only — no re-renders)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${e.clientX - 260}px, ${e.clientY - 260}px)`;
      }
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // ── The firefly network ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0, height = 0;
    let flies: Firefly[] = [];
    let raf = 0;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setup = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const targets = sampleWordTargets(width, height);
      const ambientCount = Math.round(Math.min(70, width / 14));
      const total = targets.length + ambientCount;

      flies = Array.from({ length: total }, (_, i) => {
        const isNode = i < targets.length;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          r: isNode ? 1.6 + Math.random() * 1.2 : 0.8 + Math.random() * 1.0,
          gold: Math.random() < 0.3,
          flicker: Math.random() * Math.PI * 2,
          appearAt: Math.random() * APPEAR_END,
          tx: isNode ? targets[i].x : -1,
          ty: isNode ? targets[i].y : -1,
          mx: 0, my: 0,
        };
      });
    };

    setup();
    startRef.current = performance.now() - (reducedMotion ? SKIP_TO : 0);
    if (reducedMotion) { setShowSlogan(true); setShowCTAs(true); }

    let morphFrozen = false;

    const frame = (now: number) => {
      const t = now - startRef.current;
      ctx.clearRect(0, 0, width, height);

      // slow cinematic zoom-through during the discovery phase
      const zoom = 1 + 0.06 * (1 - Math.min(t / NET_FULL, 1));
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);
      ctx.globalCompositeOperation = 'lighter';

      const mpRaw = Math.min(Math.max((t - MORPH_START) / MORPH_DUR, 0), 1);
      const mp = easeInOutCubic(mpRaw);
      const netAlpha = Math.min(Math.max((t - NET_RAMP_START) / (NET_FULL - NET_RAMP_START), 0), 1);
      const formed = mpRaw >= 1;

      // freeze wander positions the moment the morph starts
      if (mpRaw > 0 && !morphFrozen) {
        morphFrozen = true;
        for (const f of flies) { f.mx = f.x; f.my = f.y; }
      }

      // update + draw fireflies
      for (const f of flies) {
        const alive = t > f.appearAt;
        if (!alive) continue;
        const fadeIn = Math.min((t - f.appearAt) / 600, 1);
        f.flicker += 0.04;

        if (mpRaw === 0) {
          // ant-colony wander: gentle persistent paths with soft turns
          f.vx += (Math.random() - 0.5) * 0.04;
          f.vy += (Math.random() - 0.5) * 0.04;
          const sp = Math.hypot(f.vx, f.vy);
          if (sp > 0.6) { f.vx *= 0.6 / sp; f.vy *= 0.6 / sp; }
          f.x += f.vx; f.y += f.vy;
          if (f.x < 0) f.x += width; if (f.x > width) f.x -= width;
          if (f.y < 0) f.y += height; if (f.y > height) f.y -= height;
        } else if (f.tx >= 0) {
          // glide to letterform node, tiny shimmer once formed
          const jx = formed ? Math.sin(f.flicker * 1.3) * 0.7 : 0;
          const jy = formed ? Math.cos(f.flicker) * 0.7 : 0;
          f.x = f.mx + (f.tx - f.mx) * mp + jx;
          f.y = f.my + (f.ty - f.my) * mp + jy;
        } else {
          // ambient fireflies keep drifting as background dust
          f.x += f.vx * 0.4; f.y += f.vy * 0.4;
          if (f.x < 0) f.x += width; if (f.x > width) f.x -= width;
          if (f.y < 0) f.y += height; if (f.y > height) f.y -= height;
        }

        const flick = 0.65 + 0.35 * Math.sin(f.flicker);
        const dim = mpRaw > 0 && f.tx < 0 ? 0.35 : 1;
        const a = fadeIn * flick * dim;
        const color = f.gold ? '255, 205, 120' : '140, 200, 255';

        // halo + core
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, ${a * 0.10})`;
        ctx.arc(f.x, f.y, f.r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, ${a * 0.9})`;
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // connection lines — wide web while wandering, tight web inside letters
      const reach = mpRaw > 0 ? 26 : 95;
      const lineBase = mpRaw > 0 ? 0.5 : 0.28;
      if (netAlpha > 0) {
        for (let i = 0; i < flies.length; i++) {
          const a = flies[i];
          if (t < a.appearAt || (mpRaw > 0 && a.tx < 0)) continue;
          for (let j = i + 1; j < flies.length; j++) {
            const b = flies[j];
            if (t < b.appearAt || (mpRaw > 0 && b.tx < 0)) continue;
            const dx = a.x - b.x, dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > reach * reach) continue;
            const d = Math.sqrt(d2);
            const alpha = (1 - d / reach) * lineBase * netAlpha;
            const goldLine = a.gold && b.gold;
            ctx.beginPath();
            ctx.strokeStyle = goldLine
              ? `rgba(255, 200, 110, ${alpha})`
              : `rgba(110, 170, 255, ${alpha})`;
            ctx.lineWidth = mpRaw > 0 ? 0.9 : 0.6;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // soft bloom behind the formed wordmark
      if (mpRaw > 0.5) {
        const bloom = (mpRaw - 0.5) * 2 * (0.5 + 0.12 * Math.sin(t / 600));
        const g = ctx.createRadialGradient(width / 2, height * 0.40, 10, width / 2, height * 0.40, width * 0.32);
        g.addColorStop(0, `rgba(80, 130, 255, ${0.16 * bloom})`);
        g.addColorStop(1, 'rgba(80, 130, 255, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.restore();

      // reveal DOM overlays on schedule
      if (t > SLOGAN_AT) setShowSlogan(true);
      if (t > CTA_AT) setShowCTAs(true);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    const onResize = () => setup();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  // Click anywhere during the intro fast-forwards to the formed wordmark
  const handleSkip = () => {
    if (skippedRef.current || showCTAs) return;
    const elapsed = performance.now() - startRef.current;
    if (elapsed < SKIP_TO) {
      skippedRef.current = true;
      startRef.current = performance.now() - SKIP_TO;
      setShowSlogan(true);
      setShowCTAs(true);
    }
  };

  const goExplore = () => {
    if (locationSet && selectedCountry) router.push('/home');
    else router.push('/location');
  };

  const goSell = () => router.push('/welcome');

  const submitSearch = () => {
    const q = searchValue.trim();
    if (!q) return;
    sessionStorage.setItem('syph-pending-search', q);
    router.push('/home');
  };

  return (
    <div
      onClick={handleSkip}
      style={{
        minHeight: '100dvh', position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(120% 100% at 50% 0%, #0A1838 0%, #050B1E 55%, #02040C 100%)',
      }}
    >
      {/* Digital topography — faint contour rings */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05 }} preserveAspectRatio="none" viewBox="0 0 100 100">
        {[18, 30, 44, 60, 78].map((r, i) => (
          <ellipse key={i} cx={i % 2 ? 78 : 22} cy={i % 2 ? 24 : 76} rx={r} ry={r * 0.62} fill="none" stroke="#7FA8FF" strokeWidth="0.15" />
        ))}
      </svg>

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

      {/* Mouse-reactive glow */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: 520, height: 520,
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(70,120,255,0.07) 0%, transparent 70%)',
          pointerEvents: 'none', willChange: 'transform',
        }}
      />

      {/* The living network */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      {/* ── Hero overlay ── */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '54%', bottom: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0 22px', pointerEvents: 'none',
      }}>
        {/* Slogan */}
        <motion.p
          initial={false}
          animate={showSlogan ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{
            margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '4px',
            color: 'rgba(255,255,255,0.85)', textAlign: 'center',
            textShadow: '0 0 18px rgba(120,160,255,0.45)',
          }}
        >
          FIND IT. LOCATE IT. CONNECT.
        </motion.p>

        <div style={{ height: 26 }} />

        {/* Search — floating glass card with rotating placeholder */}
        <motion.div
          initial={false}
          animate={showCTAs ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card"
          style={{
            width: '100%', maxWidth: 460, borderRadius: 30, padding: '4px 4px 4px 20px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 18px 50px rgba(2,6,20,0.55)',
            pointerEvents: showCTAs ? 'auto' : 'none',
          }}
        >
          <Search size={17} color="rgba(255,255,255,0.55)" style={{ flexShrink: 0 }} />
          <input
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitSearch(); }}
            placeholder={PLACEHOLDERS[phIndex]}
            className="input-anim-dark"
            style={{
              flex: 1, height: 48, background: 'none', border: 'none', outline: 'none',
              color: '#fff', fontSize: 14.5, fontWeight: 600, minWidth: 0,
            }}
          />
          <button
            onClick={submitSearch}
            className="btn-tap"
            style={{
              height: 44, padding: '0 18px', borderRadius: 24, border: 'none', flexShrink: 0,
              background: 'linear-gradient(135deg, #2E5BFF, #5E8BFF)',
              color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(46,91,255,0.45)',
            }}
          >
            Search
          </button>
        </motion.div>

        <div style={{ height: 16 }} />

        {/* CTAs */}
        <motion.div
          initial={false}
          animate={showCTAs ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'flex', gap: 12, width: '100%', maxWidth: 460,
            pointerEvents: showCTAs ? 'auto' : 'none',
          }}
        >
          <button
            onClick={goExplore}
            className="btn-tap sweep"
            style={{
              flex: 1.2, height: 52, borderRadius: 26, border: 'none',
              background: 'linear-gradient(135deg, #2E5BFF 0%, #6C63FF 100%)',
              color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 14px 36px rgba(46,91,255,0.45)',
            }}
          >
            Explore SYPH <ArrowRight size={17} />
          </button>
          <button
            onClick={goSell}
            className="btn-tap glass-card"
            style={{
              flex: 1, height: 52, borderRadius: 26,
              color: 'rgba(255,255,255,0.92)', fontWeight: 800, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Store size={16} color="#FFCD78" /> Start Selling
          </button>
        </motion.div>

        {/* Skip hint during the intro */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: showCTAs ? 0 : 0.45 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          style={{
            position: 'absolute', bottom: 18, margin: 0,
            fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', color: '#fff',
          }}
        >
          TAP TO SKIP
        </motion.p>
      </div>
    </div>
  );
}
