'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store';

export default function SplashScreen() {
  const router = useRouter();
  const { user, selectedCountry, locationSet } = useAppStore();
  const routed = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (routed.current) return;
      routed.current = true;
      const hasUser = !!user;
      const hasCountry = locationSet && !!selectedCountry;
      if (!hasUser) {
        router.replace('/welcome');
      } else if (!hasCountry) {
        router.replace('/location');
      } else {
        router.replace('/home');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [router, user, selectedCountry, locationSet]);

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #0F2B6E 0%, #1E4DD9 50%, #0F2B6E 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', position: 'relative', overflow: 'hidden',
    }}>
      {/* Dark overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 45%, rgba(0,0,0,0.7) 100%)',
      }} />

      <div style={{ position: 'relative', textAlign: 'center' }}>
        {/* SYPH title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.72, letterSpacing: '2px' }}
          animate={{ opacity: 1, scale: 1, letterSpacing: '16px' }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{
            fontSize: 64, fontWeight: 900, color: '#fff',
            textShadow: '0 0 24px rgba(255,255,255,0.3), 0 0 48px rgba(170,204,255,0.2)',
          }}
        >
          SYPH
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.9, duration: 0.7, ease: 'easeInOut' }}
          style={{
            height: 1, width: 180, margin: '24px auto',
            background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.7), transparent)',
            transformOrigin: 'center',
          }}
        />

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.6, ease: 'easeOut' }}
          style={{
            fontSize: 11, color: 'rgba(255,255,255,0.73)',
            fontWeight: 600, letterSpacing: '3.5px',
          }}
        >
          FIND IT.&nbsp;&nbsp;LOCATE IT.&nbsp;&nbsp;CONNECT.
        </motion.div>
      </div>
    </div>
  );
}
