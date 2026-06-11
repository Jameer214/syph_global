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
    <div style={{ minHeight: '100dvh', background: '#02040E' }} />
  );
}
