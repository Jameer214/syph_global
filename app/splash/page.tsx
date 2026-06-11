'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store';

// One easing for every transition — this is what makes the sequence feel
// like a single camera move instead of separate effects.
const EASE = [0.22, 1, 0.36, 1] as const;

// Faint early-evening stars, upper sky only (deterministic for SSR hydration)
const STARS = [
  { top: '6%', left: '16%', size: 2, delay: 0.4 },
  { top: '10%', left: '64%', size: 2, delay: 1.2 },
  { top: '5%', left: '84%', size: 2, delay: 0.1 },
  { top: '15%', left: '36%', size: 2, delay: 1.8 },
  { top: '19%', left: '78%', size: 2, delay: 0.8 },
  { top: '12%', left: '8%', size: 2, delay: 2.2 },
];

const LETTERS = ['S', 'Y', 'P', 'H'];
const TAGLINE_WORDS = ['FIND IT', 'LOCATE IT', 'CONNECT'];

const SPLASH_MS = 2400;
const EXIT_MS = 1950;

export default function SplashScreen() {
  const router = useRouter();
  const { selectedCountry, locationSet } = useAppStore();
  const routed = useRef(false);
  const [leaving, setLeaving] = useState(false);

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
      minHeight: '100dvh', background: '#0B1030',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', position: 'relative', overflow: 'hidden',
    }}>
      {/* Sunset peaks — camera pans across the ridge, left to right */}
      <motion.div
        initial={{ x: '0%' }}
        animate={{ x: '-14%' }}
        transition={{ duration: SPLASH_MS / 1000 + 0.4, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '125%' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash-mountain.jpg"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.05)' }}
        />
      </motion.div>

      {/* Sunset grade: warm tint above, deep navy below for text contrast */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(60,25,70,0.38) 0%, rgba(30,20,60,0.22) 40%, rgba(7,12,38,0.88) 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(85% 70% at 50% 42%, transparent 52%, rgba(6,10,32,0.5) 100%)',
      }} />

      {/* Warm mist drifting with the pan direction */}
      <motion.div
        animate={{ x: [0, 60] }}
        transition={{ duration: SPLASH_MS / 1000 + 0.4, ease: 'easeInOut' }}
        style={{
          position: 'absolute', bottom: '26%', left: '-10%', width: '70%', height: 110,
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,205,160,0.14) 0%, transparent 70%)',
          filter: 'blur(24px)', pointerEvents: 'none',
        }}
      />
      <motion.div
        animate={{ x: [0, 40] }}
        transition={{ duration: SPLASH_MS / 1000 + 0.4, ease: 'easeInOut' }}
        style={{
          position: 'absolute', bottom: '15%', right: '-15%', width: '80%', height: 130,
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,180,130,0.10) 0%, transparent 70%)',
          filter: 'blur(28px)', pointerEvents: 'none',
        }}
      />

      {/* First stars of dusk */}
      {STARS.map((s, i) => (
        <span key={i} className="star" style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: `${s.delay}s`, opacity: 0.5 }} />
      ))}

      {/* Cinema letterbox bars frame the scene */}
      <motion.div
        initial={{ y: '-100%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.7, ease: EASE }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '7dvh', background: '#02040E', zIndex: 2 }}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 0.7, ease: EASE }}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '7dvh', background: '#02040E', zIndex: 2 }}
      />

      {/* Film opening: fade up from black */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ position: 'absolute', inset: 0, background: '#02040E', zIndex: 3, pointerEvents: 'none' }}
      />

      {/* Composition exits drifting right — continuing the camera's motion */}
      <motion.div
        animate={leaving ? { opacity: 0, x: 26, filter: 'blur(5px)' } : { opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.45, ease: 'easeIn' }}
        style={{ position: 'relative', textAlign: 'center' }}
      >
        {/* Warm glow bloom behind the wordmark */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0.5] }}
          transition={{ duration: 1.4, times: [0, 0.6, 1], ease: 'easeOut' }}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 330, height: 170, marginTop: -120, marginLeft: -165,
            background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,160,90,0.28) 0%, transparent 70%)',
            filter: 'blur(16px)', pointerEvents: 'none',
          }}
        />

        {/* SYPH — letters rise out of a baseline mask, one after another */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, position: 'relative', overflow: 'hidden', paddingBottom: 6 }}>
          {LETTERS.map((ch, i) => (
            <span key={i} style={{ display: 'inline-block', overflow: 'hidden' }}>
              <motion.span
                initial={{ y: '112%' }}
                animate={{ y: '0%' }}
                transition={{ delay: 0.18 + i * 0.09, duration: 0.65, ease: EASE }}
                style={{
                  display: 'inline-block', fontSize: 62, fontWeight: 900, lineHeight: 1.05,
                  background: 'linear-gradient(180deg, #FFFFFF 30%, #FFD9A8 95%)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  filter: 'drop-shadow(0 2px 14px rgba(0,0,0,0.45)) drop-shadow(0 0 22px rgba(255,190,120,0.35))',
                }}
              >
                {ch}
              </motion.span>
            </span>
          ))}

          {/* Light sweep travels through the letters, left to right */}
          <motion.div
            initial={{ x: '-130%', opacity: 0 }}
            animate={{ x: '480%', opacity: [0, 1, 0] }}
            transition={{ delay: 0.85, duration: 0.65, ease: EASE }}
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: 70,
              background: 'linear-gradient(105deg, transparent, rgba(255,235,210,0.45), transparent)',
              transform: 'skewX(-18deg)', pointerEvents: 'none',
            }}
          />
        </div>

        {/* Sunset line draws left to right, handing off from the sweep */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.05, duration: 0.45, ease: EASE }}
          style={{
            height: 1.5, width: 210, margin: '20px auto',
            background: 'linear-gradient(to right, transparent, #FFC98F, transparent)',
            boxShadow: '0 0 12px rgba(255,180,120,0.6)',
            transformOrigin: 'left center',
          }}
        />

        {/* Slogan words ride in left to right, continuing the line's motion */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
          {TAGLINE_WORDS.map((word, i) => (
            <span key={word} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <motion.span
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + i * 0.12, duration: 0.45, ease: EASE }}
                style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.92)', fontWeight: 800,
                  letterSpacing: '3.5px', textShadow: '0 1px 8px rgba(0,0,0,0.55)',
                }}
              >
                {word}
              </motion.span>
              {i < TAGLINE_WORDS.length - 1 && (
                <motion.span
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.26 + i * 0.12, duration: 0.45, ease: EASE }}
                  style={{ color: '#FFB45F', fontSize: 9, fontWeight: 900, textShadow: '0 0 8px rgba(255,180,95,0.8)' }}
                >
                  ◆
                </motion.span>
              )}
            </span>
          ))}
        </div>

        {/* Loading bar fills left to right — same direction as everything else */}
        <div style={{
          width: 150, height: 3, borderRadius: 2, margin: '30px auto 0',
          background: 'rgba(255,255,255,0.16)', overflow: 'hidden',
        }}>
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ delay: 0.18, duration: (SPLASH_MS - 250) / 1000, ease: 'easeInOut' }}
            style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, #FF9E5E, #FFD9A8)',
              boxShadow: '0 0 10px rgba(255,180,120,0.8)',
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
