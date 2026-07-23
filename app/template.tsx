'use client';

/**
 * Route transition wrapper. Unlike layout.tsx, template.tsx re-mounts on every
 * navigation, so this gives each page a soft fade-in as you move between screens.
 * Opacity-only (no transform) so sticky headers don't jump; disabled under
 * prefers-reduced-motion via the .anim-fade-in rule in globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="anim-fade-in">{children}</div>;
}
