'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store';
import { translate as tr } from '@/lib/i18n';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: [
      'We collect the following categories of personal data:',
      'Account & Identity Data: Full name, email address, and password (hashed) when you register with email. If you sign in via Google, we receive your name, email, and profile photo from Google.',
      'Profile & Location Data: Country, region or city, and profile photo you choose to upload.',
      'Listing Data: Title, description, price, category, images, and any other details you enter when creating a listing.',
      'Messages: Chat content sent between users within the platform.',
      'Device & Technical Data: IP address, browser type, operating system, referring URLs, and pages visited, collected automatically by our hosting and infrastructure providers.',
      'Usage Data: App activity, search queries, listing views, and feature interactions.',
    ].join('\n\n'),
  },
  {
    title: '2. Why We Collect This Data (Legal Basis)',
    body: [
      'We process your personal data for the following purposes and on the following legal bases:',
      'Providing the Service (Contract): To create and manage your account, display your listings, enable messaging between users, and allow you to discover products and services near you.',
      'Authentication (Contract): To verify your identity and secure your account through our secure authentication system.',
      'Location & Search Relevance (Legitimate Interest): To show you listings relevant to your selected country or region, improving your marketplace experience.',
      'Safety & Fraud Prevention (Legitimate Interest): To detect abuse, enforce our policies, prevent fraud, and keep the platform safe for all users.',
      'Legal Compliance (Legal Obligation): To comply with applicable laws, regulations, and lawful requests from authorities.',
    ].join('\n\n'),
  },
  {
    title: '3. Third-Party Services We Use',
    body: [
      'SYPH relies on the following third-party services that may process your data:',
      'Cloud Infrastructure (Authentication, Database, Storage): We use trusted, industry-standard cloud infrastructure providers for sign-in, our database, and image storage. These providers process data solely on our behalf under strict privacy and security commitments. If you sign in with Google, Google processes that sign-in under its own privacy policy at https://policies.google.com/privacy.',
      'Vercel (Hosting): Our website is hosted on Vercel\'s Edge Network. Vercel may process request logs including IP addresses. See https://vercel.com/legal/privacy-policy.',
      'Nominatim / OpenStreetMap (Location): We use Nominatim, the geocoding service by OpenStreetMap, to resolve location names. No personal data is sent to Nominatim beyond the location search term. See https://wiki.osmfoundation.org/wiki/Privacy_Policy.',
      'None of these providers sell your personal data to third parties.',
    ].join('\n\n'),
  },
  {
    title: '4. Cookies and Local Storage',
    body: [
      'Authentication: When you sign in, our authentication system sets a session cookie or uses browser local storage to persist your authentication state. This is strictly necessary for the service to function — you cannot opt out while signed in.',
      'Preferences: Your selected language, country, and UI preferences are stored in browser local storage so they persist between sessions. No advertising or tracking cookies are used.',
      'We do not use Google Analytics, Meta Pixel, or any third-party advertising trackers.',
    ].join('\n\n'),
  },
  {
    title: '5. Sharing of Personal Data',
    body: [
      'We do not sell your personal data.',
      'We share your data only in the following limited circumstances:',
      'Other users: Listing content, your display name, and profile photo are visible to other users as necessary for marketplace interactions. Private messages are visible only to the parties in the conversation.',
      'Service providers: our cloud infrastructure, hosting, and geocoding providers as described in Section 3, solely to operate the platform.',
      'Legal requirements: If required by law, court order, or lawful governmental authority.',
      'Business transfers: If SYPH is acquired or merges with another entity, your data may be transferred as part of that transaction.',
    ].join('\n\n'),
  },
  {
    title: '6. Data Retention',
    body: [
      'Account data is retained for as long as your account is active.',
      'If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it longer by law (e.g., for fraud prevention or legal obligations).',
      'Listing data and messages associated with deleted accounts may be anonymised rather than deleted where removal would affect other users.',
      'Server logs and backups are retained for up to 90 days before automatic deletion.',
    ].join('\n\n'),
  },
  {
    title: '7. Data Security',
    body: [
      'We take reasonable technical and organisational steps to protect your personal data, including:',
      'All data in transit is encrypted using TLS/HTTPS.',
      'Our database and file storage enforce strict access-control rules so that users can only access their own data or publicly listed content.',
      'Passwords are never stored in plain text — our authentication system handles credential security using industry-standard hashing.',
      'Despite these measures, no system is 100% secure. You are responsible for keeping your login credentials confidential.',
    ].join('\n\n'),
  },
  {
    title: '8. Your Rights (GDPR & Global)',
    body: [
      'Depending on your location, you may have the following rights:',
      'Right of Access: You can request a copy of the personal data we hold about you.',
      'Right to Rectification: You can update inaccurate information via your account settings.',
      'Right to Erasure ("Right to be Forgotten"): You can request deletion of your account and associated personal data.',
      'Right to Data Portability: You can request your data in a machine-readable format.',
      'Right to Restrict Processing: You can ask us to limit how we process your data in certain circumstances.',
      'Right to Object: You can object to processing based on legitimate interests.',
      'Right to Withdraw Consent: Where processing is based on consent, you may withdraw it at any time.',
      'To exercise any of these rights, contact us at hassanjameer3@gmail.com. We will respond within 30 days.',
    ].join('\n\n'),
  },
  {
    title: '9. Children\'s Privacy',
    body: 'SYPH is not intended for children under the age of 13. We do not knowingly collect personal data from anyone under 13. If we become aware that a child under 13 has provided us with personal data, we will delete that data immediately. If you believe a child under 13 has registered on SYPH, please contact us at hassanjameer3@gmail.com.',
  },
  {
    title: '10. International Data Transfers',
    body: 'SYPH operates globally. Your data may be processed on servers located outside your country, including in the United States, by our cloud infrastructure and hosting providers. These transfers are made in compliance with applicable data protection laws, and our providers operate under recognised data-protection frameworks.',
  },
  {
    title: '11. Location and Market Relevance',
    body: 'SYPH uses the country and region you select to show relevant listings and marketplace results. You choose your location manually — we do not access your device\'s GPS location without your explicit action. You can change your selected location at any time within the app.',
  },
  {
    title: '12. User-to-User Interactions',
    body: 'SYPH is a connector platform. Messages you send to other users are stored securely in our database and are accessible to the sender and recipient. Do not share sensitive personal or financial information in chats. SYPH staff do not routinely read private messages, but may access them if required for safety investigations or legal compliance.',
  },
  {
    title: '13. Policy Updates',
    body: 'We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last updated" date below and, where appropriate, by sending a notice to your registered email address. Continued use of the platform after updates constitutes acceptance of the revised policy.',
  },
  {
    title: '14. Contact Us',
    body: 'If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at:\n\nEmail: hassanjameer3@gmail.com\n\nWe aim to respond to all privacy-related enquiries within 30 days.',
  },
];

export default function PrivacyPage() {
  const router = useRouter();
  const { selectedLanguage: lang } = useAppStore();

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{tr('privacyPolicy', lang)}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Intro card */}
        <div style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#0F2B6E', marginBottom: 8 }}>{tr('privacyIntroTitle', lang)}</div>
          <div style={{ color: '#4A5878', fontWeight: 600, fontSize: 13.5, lineHeight: 1.5 }}>
            {tr('privacyIntroDesc', lang)}
          </div>
        </div>

        {SECTIONS.map(({ title, body }) => (
          <div key={title} style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.025)' }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#0F2B6E', marginBottom: 8 }}>{title}</div>
            <div style={{ color: '#4A5878', fontWeight: 500, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{body}</div>
          </div>
        ))}

        <div style={{ color: '#6B7A99', fontWeight: 700, fontSize: 13, marginTop: 4 }}>{tr('lastUpdatedLabel', lang)} June 9, 2026</div>
      </div>
    </div>
  );
}
