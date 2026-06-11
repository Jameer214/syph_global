'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Always go to splash first — splash handles the routing logic
    router.replace('/splash');
  }, [router]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(130% 100% at 50% 30%, #15378C 0%, #0C2161 50%, #060F2E 100%)' }}>
      <span style={{ color: '#fff', fontSize: 48, fontWeight: 900, letterSpacing: 8 }}>SYPH</span>
    </div>
  );
}
