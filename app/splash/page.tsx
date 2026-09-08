'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useAppStore } from '@/store';
import { translate as tr, getDir } from '@/lib/i18n';

/*
 * SYPH opening — deliberately simple and gentle for a professional feel
 * (mirrors the Scervi web splash): the mark scales/fades in, then the SYPH
 * wordmark and tagline, with a soft spinner. After a short beat it routes on
 * to Home (once a country is set) or the location picker.
 */

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Show briefly, then continue to the next screen.
const ROUTE_AT = 2000;

export default function SplashScreen() {
  const router = useRouter();
  const { selectedCountry, locationSet, selectedLanguage: lang } = useAppStore();
  const routedRef = useRef(false);

  const goNext = () => {
    if (routedRef.current) return;
    routedRef.current = true;
    if (locationSet && selectedCountry) router.replace('/home');
    else router.replace('/location');
  };
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  useEffect(() => {
    const t = setTimeout(() => goNextRef.current(), ROUTE_AT);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      dir={getDir(lang)}
      style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 24px',
        background: 'radial-gradient(125% 100% at 50% 0%, #12336E 0%, #0A1C44 55%, #061024 100%)',
      }}
    >
      {/* Brand mark — the real SYPH app logo, gently scaling in. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          src="/syph-logo.png"
          alt="SYPH"
          width={132}
          height={132}
          priority
          style={{ width: 132, height: 132, objectFit: 'contain' }}
        />
      </motion.div>

      {/* Wordmark + tagline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginTop: 26, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <h1 style={{
          margin: 0, fontFamily: FONT_STACK, fontSize: 46, fontWeight: 900,
          letterSpacing: '2px', color: '#FFFFFF', lineHeight: 1,
        }}>
          SYPH
        </h1>
        <p style={{
          margin: '12px 0 0', fontFamily: FONT_STACK, fontSize: 14.5, fontWeight: 700,
          letterSpacing: '0.3px', color: 'rgba(255,255,255,0.72)', textAlign: 'center',
        }}>
          {tr('tagline', lang)}
        </p>
      </motion.div>

      {/* Soft spinner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        style={{ marginTop: 44 }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '2.4px solid rgba(255,255,255,0.2)', borderTopColor: '#8FB4FF',
          animation: 'spin 0.75s linear infinite',
        }} />
      </motion.div>
    </div>
  );
}
