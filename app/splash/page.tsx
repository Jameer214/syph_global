'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store';

/*
 * SYPH opening — the wandering-fireflies intro is skipped: the experience
 * starts at the converged wordmark. Firefly nodes sit on the letterforms and
 * melt into solid glowing SYPH type within the first moments, ambient
 * fireflies keep drifting as background dust, then the slogan and the
 * Explore SYPH CTA rise in before auto-routing to select-location.
 */

// ── Timeline (ms) ──────────────────────────────────────────────────────────
const APPEAR_END = 1200;   // fireflies fade in
const NET_RAMP_START = 600;    // first connection lines
const NET_FULL = 2000;   // network fully alive
const MORPH_START = 2300;   // network begins forming SYPH
const MORPH_DUR = 1100;
const SOLIDIFY_DUR = 600;    // nodes melt into solid type after forming
const SLOGAN_AT = 3500;
const CTA_AT = 4000;   // Explore button rises (design accent — routing is automatic)
const EXIT_AT = 5300;   // fade out begins
const ROUTE_AT = 5700;   // navigate to select-location

// Clock starts here: the wandering/convergence intro is skipped entirely and
// the scene opens on the already-formed word solidifying.
const START_AT = MORPH_START + MORPH_DUR;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Firefly {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  gold: boolean;
  flicker: number;
  appearAt: number;
  tx: number; ty: number;     // morph target (letterform node), -1 if ambient
  mx: number; my: number;     // frozen wander position at morph start
}

const WORD = 'SYPH';
const OFF_W = 1200, OFF_H = 360, OFF_FONT = 250;
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Sample the wordmark into node targets from an offscreen canvas
function sampleWordTargets(width: number, height: number, wordY: number): { pts: { x: number; y: number }[]; scale: number } {
  const off = document.createElement('canvas');
  off.width = OFF_W; off.height = OFF_H;
  const c = off.getContext('2d');
  if (!c) return { pts: [], scale: 1 };
  c.fillStyle = '#fff';
  c.font = `900 ${OFF_FONT}px ${FONT_STACK}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(WORD, OFF_W / 2, OFF_H / 2);
  const data = c.getImageData(0, 0, OFF_W, OFF_H).data;
  const pts: { x: number; y: number }[] = [];
  const step = 7;
  for (let y = 0; y < OFF_H; y += step) {
    for (let x = 0; x < OFF_W; x += step) {
      if (data[(y * OFF_W + x) * 4 + 3] > 128) pts.push({ x, y });
    }
  }
  const wordW = Math.min(width * 0.86, 600);
  const scale = wordW / OFF_W;
  const ox = (width - OFF_W * scale) / 2;
  const oy = wordY - (OFF_H * scale) / 2;
  return { pts: pts.map(p => ({ x: ox + p.x * scale, y: oy + p.y * scale })), scale };
}

export default function SplashScreen() {
  const router = useRouter();
  const { selectedCountry, locationSet } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startRef = useRef<number>(0);
  const routedRef = useRef(false);
  const [showSlogan, setShowSlogan] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [leaving, setLeaving] = useState(false);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0, height = 0, wordY = 0, textScale = 1;
    let flies: Firefly[] = [];
    let raf = 0;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setup = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      wordY = height * 0.44;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { pts: targets, scale } = sampleWordTargets(width, height, wordY);
      textScale = scale;
      const ambientCount = Math.round(Math.min(60, width / 16));

      flies = Array.from({ length: targets.length + ambientCount }, (_, i) => {
        const isNode = i < targets.length;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          r: isNode ? 1.4 + Math.random() * 1.0 : 0.8 + Math.random() * 1.0,
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
    startRef.current = performance.now() - (reducedMotion ? CTA_AT : START_AT);
    if (reducedMotion) { setShowSlogan(true); setShowCTA(true); }

    let morphFrozen = false;

    const frame = (now: number) => {
      const t = now - startRef.current;
      ctx.clearRect(0, 0, width, height);

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

      if (mpRaw > 0 && !morphFrozen) {
        morphFrozen = true;
        for (const f of flies) { f.mx = f.x; f.my = f.y; }
      }

      // The wordmark fades in as the fireflies converge, then solidifies:
      // clean readable type with only a faint glow once the nodes melt away.
      const solidify = Math.min(Math.max((t - (MORPH_START + MORPH_DUR)) / SOLIDIFY_DUR, 0), 1);
      if (mpRaw > 0.55) {
        const textAlpha = Math.min((mpRaw - 0.55) / 0.45, 1);
        ctx.save();
        ctx.font = `900 ${OFF_FONT * textScale}px ${FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // halo — strong while forming, settles to a faint glow once solid
        ctx.shadowColor = 'rgba(110, 165, 255, 0.7)';
        ctx.shadowBlur = (26 - 16 * solidify) * textScale;
        ctx.fillStyle = `rgba(160, 200, 255, ${(0.4 - 0.28 * solidify) * textAlpha})`;
        ctx.fillText(WORD, width / 2, wordY);
        // solid core — fully opaque once formed
        ctx.shadowBlur = (6 - 3 * solidify) * textScale;
        ctx.fillStyle = `rgba(244, 248, 255, ${(0.85 + 0.15 * solidify) * textAlpha})`;
        ctx.fillText(WORD, width / 2, wordY);
        ctx.restore();
      }

      // update + draw fireflies
      for (const f of flies) {
        if (t < f.appearAt) continue;
        const fadeIn = Math.min((t - f.appearAt) / 600, 1);
        f.flicker += 0.04;

        if (mpRaw === 0) {
          f.vx += (Math.random() - 0.5) * 0.04;
          f.vy += (Math.random() - 0.5) * 0.04;
          const sp = Math.hypot(f.vx, f.vy);
          if (sp > 0.6) { f.vx *= 0.6 / sp; f.vy *= 0.6 / sp; }
          f.x += f.vx; f.y += f.vy;
          if (f.x < 0) f.x += width; if (f.x > width) f.x -= width;
          if (f.y < 0) f.y += height; if (f.y > height) f.y -= height;
        } else if (f.tx >= 0) {
          const jx = formed ? Math.sin(f.flicker * 1.3) * 0.6 : 0;
          const jy = formed ? Math.cos(f.flicker) * 0.6 : 0;
          f.x = f.mx + (f.tx - f.mx) * mp + jx;
          f.y = f.my + (f.ty - f.my) * mp + jy;
        } else {
          f.x += f.vx * 0.4; f.y += f.vy * 0.4;
          if (f.x < 0) f.x += width; if (f.x > width) f.x -= width;
          if (f.y < 0) f.y += height; if (f.y > height) f.y -= height;
        }

        const flick = 0.65 + 0.35 * Math.sin(f.flicker);
        // ambient dust dims during the morph; letter nodes melt away once
        // the solid wordmark has taken over
        const dim = mpRaw > 0 && f.tx < 0 ? 0.3 : f.tx >= 0 ? 1 - solidify : 1;
        if (dim <= 0.01) continue;
        const a = fadeIn * flick * dim;
        const color = f.gold ? '255, 205, 120' : '140, 200, 255';

        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, ${a * 0.10})`;
        ctx.arc(f.x, f.y, f.r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, ${a * 0.9})`;
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // connection lines while the swarm is wandering / converging
      if (netAlpha > 0 && !formed) {
        const reach = mpRaw > 0 ? 30 : 95;
        const lineBase = mpRaw > 0 ? 0.4 : 0.28;
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
            ctx.beginPath();
            ctx.strokeStyle = a.gold && b.gold
              ? `rgba(255, 200, 110, ${alpha})`
              : `rgba(110, 170, 255, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.restore();

      if (t > SLOGAN_AT) setShowSlogan(true);
      if (t > CTA_AT) setShowCTA(true);
      if (t > EXIT_AT) setLeaving(true);
      if (t > ROUTE_AT) { goExploreRef.current(); return; }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    const onResize = () => setup();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <div
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

      {/* The living network */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Slogan — large, gradient words with glowing separators */}
      <motion.div
        initial={false}
        animate={showSlogan ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
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

      {/* Exit fade to ease the cut into the next screen */}
      <motion.div
        initial={false}
        animate={{ opacity: leaving ? 1 : 0 }}
        transition={{ duration: 0.4, ease: 'easeIn' }}
        style={{ position: 'absolute', inset: 0, background: '#02040C', pointerEvents: 'none' }}
      />
    </div>
  );
}
