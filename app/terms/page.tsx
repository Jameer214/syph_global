'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Gavel, Info, Shield } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. What SYPH Is',
    body: 'SYPH is a digital platform that helps connect consumers with sellers, producers, service providers, and other market participants. SYPH mainly acts as a connector, discovery tool, and communication channel. SYPH is not generally the direct seller, supplier, producer, shipper, employer, agent, broker, or guarantor of goods, services, rentals, opportunities, promotions, or happenings listed by users unless SYPH clearly states otherwise for a specific offering.',
  },
  {
    title: '2. User Responsibility',
    body: 'You are responsible for the information you post, the decisions you make, and the interactions you enter into through SYPH. You must provide truthful, accurate, and lawful information. You must not use SYPH to mislead, defraud, harass, impersonate others, post prohibited goods or services, or violate any law, regulation, or third-party right.',
  },
  {
    title: '3. Marketplace Role and Liability Limit',
    body: "SYPH's main duty is to link consumers to producers, sellers, and service providers. Because of this, SYPH is not responsible for the quality, safety, legality, authenticity, delivery, condition, pricing, accuracy, availability, promises, conduct, or outcome of transactions or interactions between users. Any agreement, payment, delivery, dispute, loss, damage, injury, or misunderstanding that happens between a consumer and a seller or provider is primarily between those parties, not SYPH.",
  },
  {
    title: '4. No Guarantee of Transactions',
    body: 'SYPH does not guarantee that any listing is genuine, complete, safe, available, fairly priced, or suitable for your needs. SYPH does not guarantee that buyers will pay, that sellers will deliver, that service providers will perform as promised, or that users will behave honestly. Users must perform their own checks, judgment, and caution before making any payment, booking, agreement, or commitment.',
  },
  {
    title: '5. Payments and Dealings Between Users',
    body: 'Where users make payments, deposits, bookings, purchases, rentals, or other financial arrangements, those dealings are generally between the parties involved unless SYPH expressly provides a direct payment service for that transaction. SYPH is not automatically liable for failed deliveries, poor quality goods, fake listings, non-performance, overcharging, underdelivery, scams, or disputes arising from user-to-user dealings.',
  },
  {
    title: '6. Listings, Promotions, Sponsored Posts, and Flash Sales',
    body: 'Users who create listings, sponsor items, post happenings, or run flash sales are solely responsible for those listings and promotions, including their truthfulness, legal compliance, pricing, stock, timing, availability, and fulfillment. SYPH may display promoted or sponsored content, but such display does not mean SYPH guarantees or endorses the seller, provider, item, or event. SYPH may remove, reject, limit, or suspend any listing or promotion at its discretion.',
  },
  {
    title: '7. Prohibited Use',
    body: 'You must not use SYPH for illegal, harmful, deceptive, unsafe, exploitative, or abusive purposes. This includes but is not limited to:\n\n• Illegal items: stolen goods, counterfeit or fake branded products, items requiring a licence you do not hold.\n• Weapons: firearms, ammunition, explosives, or any weapon regulated or prohibited by law.\n• Controlled substances: unlawful drugs, drug paraphernalia, or prescription medicines without authorisation.\n• Fraud: fake listings, non-existent goods, advance-fee scams, phishing, or impersonating other people or businesses.\n• Harassment & abuse: threatening, bullying, or harassing other users.\n• Spam: sending unsolicited bulk messages or posting duplicate listings.\n• Hate content: content that promotes discrimination based on race, ethnicity, religion, gender, sexual orientation, disability, or nationality.\n\nSYPH may remove such content and restrict or permanently ban related accounts without notice.',
  },
  {
    title: '8. Safety and Due Diligence',
    body: "Users are expected to use caution, verify identities where appropriate, inspect goods or services, confirm terms independently, and avoid unsafe transactions. Meeting in safe public places, verifying payment, confirming details, and requesting proof where relevant are the user's responsibility. SYPH may provide tools, filters, and information, but these do not replace your own due diligence.",
  },
  {
    title: '9. Account Access and Suspension',
    body: 'SYPH may suspend, restrict, or permanently remove accounts, listings, chats, promotions, or access to the platform where there is suspected abuse, fraud, policy violation, safety risk, legal risk, or misuse of the platform. SYPH may also update platform features, remove content, or change access rules when necessary for safety, legal, or operational reasons.',
  },
  {
    title: '10. Intellectual Property and Content',
    body: "You keep responsibility for the content you upload, but by posting on SYPH you allow SYPH to display, distribute, format, promote, and use that content as reasonably necessary to operate and market the platform. You must only upload content that you have the right to use. You must not upload content that infringes another person's copyright, trademark, privacy, or other rights.",
  },
  {
    title: '11. Service Availability',
    body: 'SYPH may change, pause, limit, or stop parts of the platform at any time. Features may be unavailable due to maintenance, technical issues, moderation, upgrades, third-party outages, or other reasons. SYPH does not guarantee uninterrupted or error-free service at all times.',
  },
  {
    title: '12. Limitation of Liability',
    body: 'To the fullest extent allowed by applicable law, SYPH and its owners, operators, team, and affiliates are not liable for indirect, incidental, special, consequential, reputational, or economic losses arising out of your use of the platform, your reliance on listings, your communications with other users, or transactions and disputes between users. Where liability cannot legally be excluded, it will be limited to the minimum extent allowed by law.',
  },
  {
    title: '13. Indemnity',
    body: 'If your actions, listings, communications, or transactions cause claims, losses, complaints, damages, or legal issues against SYPH, you agree to be responsible for those consequences and to indemnify SYPH to the extent allowed by law.',
  },
  {
    title: '14. Changes to These Terms',
    body: 'SYPH may update these Terms & Conditions from time to time. Continued use of the platform after updates means you accept the revised terms. It is your responsibility to review the latest version when using the app.',
  },
  {
    title: '15. Eligibility',
    body: 'You must be at least 13 years old to use SYPH. By creating an account, you confirm that you meet this age requirement and that you are legally permitted to enter into these Terms in your jurisdiction. If you are under 18, you should review these Terms with a parent or guardian.',
  },
  {
    title: '16. Governing Law',
    body: 'These Terms are governed by and construed in accordance with applicable law. In the event of a dispute, we encourage you to first contact us to seek an informal resolution. Where formal proceedings are required, disputes will be submitted to the competent courts or arbitration bodies in accordance with the applicable law of the jurisdiction involved.',
  },
  {
    title: '17. Contact and Disputes',
    body: 'If you have concerns about a listing, user, or platform issue, you may contact SYPH at:\n\nEmail: hassanjameer3@gmail.com\n\nWhile SYPH may review complaints and take moderation action, SYPH is not automatically the decision-maker or liable party in private disputes between users unless required by law. We aim to respond to all enquiries within 30 days.',
  },
];

export default function TermsPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100dvh', background: '#F0F4FF', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0F2B6E 0%, #1E4DD9 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>Terms & Conditions</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Top info */}
        <div style={{ background: 'linear-gradient(135deg, #1D49C6, #2E67F5)', borderRadius: 20, padding: 20, marginBottom: 12, boxShadow: '0 6px 16px rgba(46,103,245,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Gavel size={40} color="#fff" />
            <div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 17 }}>Terms & Conditions</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
                By using SYPH, you agree to these terms. Please read them carefully.
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, border: '1px solid #E0E8F0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Info size={18} color="#2E5BFF" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ color: '#4A5878', fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>
            SYPH mainly helps connect consumers to sellers, producers, and service providers. Transactions and agreements between users remain primarily their responsibility.
          </div>
        </div>

        <button onClick={() => router.push('/privacy')} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: '1.5px solid #2E5BFF', background: '#fff', color: '#2E5BFF', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Shield size={16} /> View Privacy Policy
        </button>

        {/* Sections */}
        {SECTIONS.map(({ title, body }) => (
          <div key={title} style={{ background: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.025)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 4, height: 18, background: '#2E5BFF', borderRadius: 4, flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontWeight: 900, fontSize: 15, color: '#0F2B6E' }}>{title}</div>
            </div>
            <div style={{ color: '#4A5878', fontWeight: 500, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{body}</div>
          </div>
        ))}

        {/* Footer card */}
        <div style={{ background: '#F0F4FF', borderRadius: 16, padding: 16, border: '1px solid #E0E8F0', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Shield size={20} color="#2E5BFF" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 900, color: '#0F2B6E', fontSize: 14, marginBottom: 6 }}>Important Note</div>
            <div style={{ color: '#4A5878', fontWeight: 500, fontSize: 13, lineHeight: 1.45 }}>
              SYPH may review complaints, moderate listings, and restrict misuse, but this does not make SYPH the direct seller, producer, service provider, or automatic liable party in disputes between users unless required by law.
            </div>
          </div>
        </div>

        <div style={{ color: '#6B7A99', fontWeight: 700, fontSize: 13 }}>Last updated: June 9, 2026</div>
      </div>
    </div>
  );
}
