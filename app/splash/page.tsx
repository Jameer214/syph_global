'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
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
        background: '#F0F4FF',
      }}
    >
      {/* Brand mark — soft rounded tile with the global glyph, gently scaling in. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: 96, height: 96, borderRadius: 28,
          background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 16px 40px rgba(30,77,217,0.28)',
        }}
      >
        <Globe size={46} color="#fff" strokeWidth={2.2} />
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
          letterSpacing: '2px', color: '#0F2B6E', lineHeight: 1,
        }}>
          SYPH
        </h1>
        <p style={{
          margin: '12px 0 0', fontFamily: FONT_STACK, fontSize: 14.5, fontWeight: 700,
          letterSpacing: '0.3px', color: '#6B7A99', textAlign: 'center',
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
          border: '2.4px solid rgba(46,91,255,0.22)', borderTopColor: '#2E5BFF',
          animation: 'spin 0.75s linear infinite',
        }} />
      </motion.div>
    </div>
  );
}
