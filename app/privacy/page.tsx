'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'SYPH may collect information you provide directly, such as your name, email address, login details, selected country, region, listing details, images, messages, support requests, and profile information. SYPH may also collect technical and usage information such as app activity, device information, approximate location-related data, preferences, and interactions within the platform.',
  },
  {
    title: '2. Why We Collect Information',
    body: 'SYPH collects information to operate the platform, create and manage accounts, connect consumers with producers and service providers, improve search and discovery, save preferences, support communication between users, detect abuse, maintain safety, process promotions, and improve the overall user experience.',
  },
  {
    title: '3. Location and Market Relevance',
    body: 'SYPH may use selected country, region, or location-related information to show relevant listings, services, happenings, and marketplace results near you or in the area you choose. Location-related features help SYPH connect consumers to producers and sellers more effectively, but users remain responsible for verifying the parties they choose to deal with.',
  },
  {
    title: '4. User-to-User Interactions',
    body: 'SYPH provides tools that allow users to discover listings and communicate, but SYPH is primarily a connector platform. Information shared between users as part of listings, chats, or transactions may be visible to other users as necessary for marketplace interactions. Users should avoid sharing unnecessary sensitive information and should use caution when dealing with others.',
  },
  {
    title: '5. How We Use Your Information',
    body: 'SYPH may use collected information to run the app, personalize marketplace content, show relevant search results, support listings, improve platform performance, respond to support requests, enforce policies, investigate abuse, and maintain account and platform security.',
  },
  {
    title: '6. Sharing of Information',
    body: "SYPH may share limited information where necessary to operate the platform, comply with law, protect safety, investigate fraud, respond to lawful requests, or support essential third-party services such as hosting, analytics, authentication, notifications, storage, or payment-related operations where applicable. SYPH does not treat user data as public beyond what users themselves choose to publish in listings or profiles.",
  },
  {
    title: '7. Data Storage and Security',
    body: 'SYPH takes reasonable technical and organizational steps to protect user information, but no system can guarantee absolute security. Users are also responsible for keeping login details secure and for protecting their own accounts and devices.',
  },
  {
    title: '8. Retention of Data',
    body: 'SYPH may retain user information for as long as needed to operate the platform, comply with legal obligations, resolve disputes, enforce policies, maintain records, or support security and fraud prevention. Some data may remain in backups or logs for a reasonable period even after account changes or deletion requests.',
  },
  {
    title: '9. Children and Restricted Use',
    body: 'SYPH is not intended for unlawful use or for users who are not legally permitted to use the platform in their jurisdiction. If SYPH becomes aware of inappropriate or unauthorized use, it may remove related content or accounts.',
  },
  {
    title: '10. Your Choices',
    body: 'You may update some of your account or profile information within the app. You may also choose what information to publish in listings or share with other users. Some information, however, may still be required for core functionality, safety, moderation, legal compliance, or account integrity.',
  },
  {
    title: '11. Third-Party Services',
    body: "SYPH may rely on third-party tools and services for authentication, cloud storage, analytics, crash reporting, maps, notifications, or platform infrastructure. Those providers may process data as needed to support SYPH's services under their own legal terms and policies.",
  },
  {
    title: '12. Policy Updates',
    body: 'SYPH may update this Privacy Policy from time to time. Continued use of the platform after updates means you accept the updated policy to the extent permitted by law.',
  },
  {
    title: '13. Contact',
    body: 'If you have questions about privacy, data use, or platform safety, you may contact SYPH using the support options provided in the app.',
  },
];

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>Privacy Policy</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Intro card */}
        <div style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#0F2B6E', marginBottom: 8 }}>SYPH Privacy Policy</div>
          <div style={{ color: '#4A5878', fontWeight: 600, fontSize: 13.5, lineHeight: 1.45 }}>
            This Privacy Policy explains how SYPH collects, uses, stores, and protects information when you use the platform.
          </div>
        </div>

        {SECTIONS.map(({ title, body }) => (
          <div key={title} style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.025)' }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#0F2B6E', marginBottom: 8 }}>{title}</div>
            <div style={{ color: '#4A5878', fontWeight: 500, fontSize: 13.5, lineHeight: 1.45 }}>{body}</div>
          </div>
        ))}

        <div style={{ color: '#6B7A99', fontWeight: 700, fontSize: 13 }}>Last updated: 2026</div>
      </div>
    </div>
  );
}
