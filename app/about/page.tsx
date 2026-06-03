'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Compass, Users, Globe, ShoppingBag, Info } from 'lucide-react';

export default function AboutPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>About SYPH</div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {/* Hero card */}
        <div style={{ background: 'linear-gradient(135deg, #1E4DD9, #4A7AFF, #80A5FF)', borderRadius: 32, padding: 24, marginBottom: 24, minHeight: 180, position: 'relative', overflow: 'hidden', boxShadow: '0 10px 24px rgba(30,77,217,0.3)' }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ position: 'absolute', left: -30, bottom: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ position: 'relative', marginTop: 40 }}>
            {['Find it.', 'Locate it.', 'Connect.'].map((line, i) => (
              <div key={i} style={{ color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1 }}>{line}</div>
            ))}
          </div>
        </div>

        {/* Mission card */}
        <div style={{ background: '#fff', borderRadius: 28, padding: 24, marginBottom: 20, boxShadow: '0 8px 20px rgba(30,77,217,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 52, height: 52, background: '#E8F0FF', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Compass size={28} color="#1E4DD9" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#0F2B6E', letterSpacing: -0.3 }}>Our Mission</div>
              <div style={{ color: '#6B7A99', fontSize: 14, fontWeight: 600, marginTop: 4 }}>Connecting communities</div>
            </div>
          </div>
          {[
            'Discover items, services, and opportunities around you — fast.',
            'Search what you need, filter by country/region, and connect with the right people.',
            'For sellers and service providers, list offerings, reach local buyers, and boost visibility through sponsored placement.',
            'Our goal is simple: help people find things nearby and connect quicker.',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg, #1E4DD9, #4A7AFF)', flexShrink: 0, marginTop: 7 }} />
              <span style={{ color: '#2D3A5E', fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { value: '10K+', label: 'Active Users', Icon: Users, color: '#1E4DD9' },
            { value: '50+', label: 'Countries', Icon: Globe, color: '#4A7AFF' },
            { value: '100K+', label: 'Listings', Icon: ShoppingBag, color: '#80A5FF' },
          ].map(({ value, label, Icon, color }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 22, padding: 16, boxShadow: `0 4px 12px ${color}1A`, textAlign: 'center' }}>
              <div style={{ width: 38, height: 38, background: `${color}1A`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <Icon size={22} color={color} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7A99', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Version card */}
        <div style={{ background: '#fff', borderRadius: 20, border: '2px solid #E8F0FF', padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 36, height: 36, background: '#E8F0FF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Info size={20} color="#1E4DD9" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#0F2B6E', fontSize: 15 }}>Version 1.0.0</div>
            <div style={{ color: '#6B7A99', fontWeight: 600, fontSize: 13, marginTop: 4 }}>Last updated: March 2026</div>
          </div>
          <div style={{ background: '#E1F5E8', borderRadius: 30, padding: '6px 12px', color: '#2DBE7F', fontWeight: 800, fontSize: 12 }}>Latest</div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#9AA0B2', fontWeight: 600, fontSize: 13 }}>Made with ♥ for communities</div>
      </div>
    </div>
  );
}
