'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store';

// Deterministic star field (fixed values — random would break SSR hydration).
// Kept to the upper sky area so they sit above the mountain line.
const STARS = [
  { top: '5%', left: '12%', size: 2, delay: 0 },
  { top: '9%', left: '70%', size: 3, delay: 0.7 },
  { top: '14%', left: '38%', size: 2, delay: 1.4 },
  { top: '7%', left: '88%', size: 2, delay: 0.3 },
  { top: '19%', left: '8%', size: 3, delay: 1.9 },
  { top: '23%', left: '57%', size: 2, delay: 1.1 },
  { top: '12%', left: '25%', size: 2, delay: 2.3 },
  { top: '27%', left: '80%', size: 3, delay: 0.5 },
  { top: '31%', left: '18%', size: 2, delay: 1.6 },
  { top: '21%', left: '93%', size: 2, delay: 0.9 },
];

const LETTERS = ['S', 'Y', 'P', 'H'];
const GLYPHS = '◇◆△▽◈ΞΛΣΦΨΩ※01∆▣';
// Each letter locks into place left-to-right while the others still cycle
const LOCK_AT_MS = [420, 560, 700, 840];
const TAGLINE_WORDS = ['FIND IT', 'LOCATE IT', 'CONNECT'];

// Same overall duration as the original splash
const SPLASH_MS = 2000;
const EXIT_MS = 1600;

export default function SplashScreen() {
  const router = useRouter();
  const { selectedCountry, locationSet } = useAppStore();
  const routed = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [display, setDisplay] = useState(['◇', '◇', '◇', '◇']);
  const [locked, setLocked] = useState([false, false, false, false]);

  // Cipher decode: letters flicker through glyphs, then lock left-to-right
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const t = performance.now() - start;
      setDisplay(LETTERS.map((ch, i) =>
        t >= LOCK_AT_MS[i] ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      ));
      setLocked(LETTERS.map((_, i) => t >= LOCK_AT_MS[i]));
      if (t > LOCK_AT_MS[3] + 60) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const exitTimer = setTimeout(() => setLeaving(true), EXIT_MS);
    const routeTimer = setTimeout(() => {
      if (routed.current) return;
      routed.current = true;
      const hasCountry = locationSet && !!selectedCountry;
      if (!hasCountry) {
        router.replace('/location');
      } else {
        router.replace('/home');
      }
    }, SPLASH_MS);
    return () => { clearTimeout(exitTimer); clearTimeout(routeTimer); };
  }, [router, selectedCountry, locationSet]);

  return (
    <div style={{
      minHeight: '100dvh', background: '#060F2E',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', position: 'relative', overflow: 'hidden',
    }}>
      {/* Mountain photo — slow cinematic Ken Burns push-in */}
      <motion.div
        initial={{ scale: 1.18, y: 14 }}
        animate={{ scale: 1.04, y: 0 }}
        transition={{ duration: 3.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash-mountain.jpg"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </motion.div>

      {/* Brand color grade + readability vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(6,15,46,0.62) 0%, rgba(12,33,97,0.30) 42%, rgba(6,15,46,0.82) 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(85% 70% at 50% 45%, transparent 55%, rgba(4,10,32,0.55) 100%)',
      }} />

      {/* Drifting mist banks along the peaks */}
      <motion.div
        animate={{ x: [0, 48, 0] }}
        transition={{ duration: 14, ease: 'easeInOut', repeat: Infinity }}
        style={{
          position: 'absolute', bottom: '24%', left: '-15%', width: '75%', height: 110,
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(190,210,255,0.16) 0%, transparent 70%)',
          filter: 'blur(22px)', pointerEvents: 'none',
        }}
      />
      <motion.div
        animate={{ x: [0, -56, 0] }}
        transition={{ duration: 17, ease: 'easeInOut', repeat: Infinity, delay: -6 }}
        style={{
          position: 'absolute', bottom: '14%', right: '-20%', width: '85%', height: 130,
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(170,195,255,0.13) 0%, transparent 70%)',
          filter: 'blur(26px)', pointerEvents: 'none',
        }}
      />

      {/* Twinkling stars layered over the photo's sky */}
      {STARS.map((s, i) => (
        <span key={i} className="star" style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}

      <motion.div
        animate={leaving ? { opacity: 0, scale: 1.08, filter: 'blur(6px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.4, ease: 'easeIn' }}
        style={{ position: 'relative', textAlign: 'center' }}
      >
        {/* Glow bloom behind the letters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0.5] }}
          transition={{ duration: 1.2, times: [0, 0.6, 1], ease: 'easeOut' }}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 320, height: 170, marginTop: -118, marginLeft: -160,
            background: 'radial-gradient(50% 50% at 50% 50%, rgba(72,118,255,0.45) 0%, transparent 70%)',
            filter: 'blur(14px)', pointerEvents: 'none',
          }}
        />

        {/* SYPH — cipher decode: glyphs flicker then lock with a chrome snap */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, position: 'relative' }}>
          {display.map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 30, rotateX: 75 }}
              animate={{
                opacity: 1, y: 0, rotateX: 0,
                scale: locked[i] ? [1.22, 1] : 1,
              }}
              transition={{
                opacity: { delay: 0.08 + i * 0.07, duration: 0.35 },
                y: { delay: 0.08 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                rotateX: { delay: 0.08 + i * 0.07, duration: 0.45 },
                scale: { duration: 0.28, ease: [0.34, 1.56, 0.64, 1] },
              }}
              style={{
                display: 'inline-block', width: 58, fontSize: 62, fontWeight: 900, lineHeight: 1,
                fontFamily: locked[i] ? 'inherit' : 'monospace',
                color: locked[i] ? 'transparent' : 'rgba(141,200,255,0.55)',
                background: locked[i] ? 'linear-gradient(180deg, #ffffff 25%, #9DB8FF 80%)' : 'none',
                WebkitBackgroundClip: locked[i] ? 'text' : undefined,
                backgroundClip: locked[i] ? 'text' : undefined,
                textShadow: locked[i]
                  ? '0 0 28px rgba(141,176,255,0.55)'
                  : '0 0 14px rgba(141,200,255,0.4)',
                filter: locked[i] ? 'none' : 'blur(0.6px)',
              }}
            >
              {ch}
            </motion.span>
          ))}
        </div>

        {/* Shine sweep across the assembled wordmark */}
        <motion.div
          initial={{ x: '-120%', opacity: 0 }}
          animate={{ x: '160%', opacity: [0, 1, 0] }}
          transition={{ delay: 0.9, duration: 0.6, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: -8, bottom: 48, width: 90,
            background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.4), transparent)',
            transform: 'skewX(-18deg)', pointerEvents: 'none',
          }}
        />

        {/* Energy line draws outward, then the slogan wipes through it */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.45, ease: 'easeInOut' }}
          style={{
            height: 1.5, width: 210, margin: '22px auto',
            background: 'linear-gradient(to right, transparent, #8FB0FF, transparent)',
            boxShadow: '0 0 12px rgba(120,160,255,0.7)',
            transformOrigin: 'center',
          }}
        />

        {/* Slogan — futuristic wipe-in with cyan separators */}
        <motion.div
          initial={{ clipPath: 'inset(0 50% 0 50%)', opacity: 0 }}
          animate={{ clipPath: 'inset(0 0% 0 0%)', opacity: 1 }}
          transition={{ delay: 1.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}
        >
          {TAGLINE_WORDS.map((word, i) => (
            <span key={word} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 11, color: 'rgba(255,255,255,0.88)', fontWeight: 800,
                letterSpacing: '3.5px', textShadow: '0 1px 8px rgba(0,0,0,0.5)',
              }}>
                {word}
              </span>
              {i < TAGLINE_WORDS.length - 1 && (
                <span style={{ color: '#6FA0FF', fontSize: 10, fontWeight: 900, textShadow: '0 0 8px rgba(111,160,255,0.8)' }}>◆</span>
              )}
            </span>
          ))}
        </motion.div>

        {/* Loading bar fills across the splash duration */}
        <div style={{
          width: 150, height: 3, borderRadius: 2, margin: '30px auto 0',
          background: 'rgba(255,255,255,0.18)', overflow: 'hidden',
        }}>
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ delay: 0.2, duration: (SPLASH_MS - 250) / 1000, ease: 'easeInOut' }}
            style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, #4876FF, #8FB0FF)',
              boxShadow: '0 0 10px rgba(120,160,255,0.8)',
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
