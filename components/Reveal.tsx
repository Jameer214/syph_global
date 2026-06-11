'use client';
import { useEffect, useRef } from 'react';

/**
 * Scroll-triggered reveal: children start hidden and fade/slide up when they
 * enter the viewport. By default the reveal re-arms when the element leaves
 * the viewport, so the animation replays on every pass; set `once` to play
 * only the first time. Pair with `delay` (seconds) to stagger siblings.
 * Styling lives in globals.css (.reveal / .revealed).
 */
export default function Reveal({
  children,
  delay = 0,
  once = false,
  style,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  once?: boolean;
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
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          if (once) io.disconnect();
        } else {
          el.classList.remove('revealed');
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}s`, ...style }}>
      {children}
    </div>
  );
}
