'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Rocket, Megaphone, Zap, Calendar, Lightbulb } from 'lucide-react';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';

interface PolicySection {
  icon: React.ReactNode;
  color: string;
  titleKey: string;
  bulletKeys: string[];
}

const SECTIONS: PolicySection[] = [
  {
    icon: <Package size={22} />,
    color: '#2F6BFF',
    titleKey: 'policyNormalTitle',
    bulletKeys: ['policyNormalB1', 'policyNormalB2', 'policyNormalB3'],
  },
  {
    icon: <Rocket size={22} />,
    color: '#6A5AE0',
    titleKey: 'policyUpgradedTitle',
    bulletKeys: ['policyUpgradedB1', 'policyUpgradedB2', 'policyUpgradedB3', 'policyUpgradedB4'],
  },
  {
    icon: <Megaphone size={22} />,
    color: '#2F6BFF',
    titleKey: 'policySponsoredTitle',
    bulletKeys: ['policySponsoredB1', 'policyActivePeriod', 'policyAutoRemoved', 'policyNotConnected'],
  },
  {
    icon: <Zap size={22} />,
    color: '#E53935',
    titleKey: 'policyFlashTitle',
    bulletKeys: ['policyFlashB1', 'policyActivePeriod', 'policyAutoRemoved', 'policyNotConnected'],
  },
  {
    icon: <Calendar size={22} />,
    color: '#00897B',
    titleKey: 'happenings',
    bulletKeys: ['policyHappeningsB1', 'policyActivePeriod', 'policyAutoRemoved', 'policyHappeningsB4'],
  },
];

export default function ListingPolicyPage() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('listingPolicies', lang)}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Hero banner */}
        <div style={{ background: 'linear-gradient(135deg, #1D49C6, #2E67F5)', borderRadius: 24, padding: 20, marginBottom: 16, boxShadow: '0 10px 22px rgba(36,83,212,0.22)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={24} color="#fff" />
            </div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{tr('howListingsWork', lang)}</div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, fontWeight: 500, lineHeight: 1.5 }}>
            {tr('policyHeroDesc', lang)}
          </div>
        </div>

        {/* Sections */}
        {SECTIONS.map(({ icon, color, titleKey, bulletKeys }) => (
          <div key={titleKey} style={{ background: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, border: `1px solid ${color}30`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, background: `${color}1A`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                {icon}
              </div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#0F2B6E' }}>{tr(titleKey, lang)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bulletKeys.map((k, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }} />
                  <span style={{ color: '#4A5878', fontWeight: 600, fontSize: 13.5, lineHeight: 1.45 }}>{tr(k, lang)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Pro tip */}
        <div style={{ background: '#FFF8E1', borderRadius: 20, padding: 16, border: '1px solid rgba(255,202,40,0.5)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Lightbulb size={22} color="#E6A000" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ color: '#5A4000', fontWeight: 600, fontSize: 13.5, lineHeight: 1.45 }}>
              <strong>{tr('proTipLabel', lang)}</strong> {tr('proTipText', lang)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
