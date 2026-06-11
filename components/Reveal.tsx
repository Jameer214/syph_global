'use client';
import { useEffect, useRef } from 'react';

/**
 * Scroll-triggered reveal: children start hidden and fade/slide up the first
 * time they enter the viewport. Pair with `delay` (seconds) to stagger
 * siblings. Styling lives in globals.css (.reveal / .revealed).
 */
export default function Reveal({
  children,
  delay = 0,
  style,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('revealed');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          el.classList.add('revealed');
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}s`, ...style }}>
      {children}
    </div>
  );
}
