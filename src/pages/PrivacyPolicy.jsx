import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Eye, Shield, ArrowRight } from 'lucide-react';

export default function PrivacyPolicy() {
  const sections = [
    { id: 'collection', title: '1. Information We Collect', content: 'Vendora PK collects information to ensure a safe, efficient, and authenticated experience for buyers and merchants. The data we collect includes: (a) Personal details provided during signup, such as full name, email address, contact phone number, and city; (b) Merchant Verification details, specifically CNIC card images or document links uploaded by shop owners to request store activation; (c) Transaction history details, including purchased items, order totals, and shipping/billing information.' },
    { id: 'usage', title: '2. How We Use Your Information', content: 'We process collected data to: (a) Validate merchant identities and CNIC documentation through our central administrator audit dashboard; (b) Process transaction requests and update status streams from pending to shipped or cancelled; (c) Route automated notification logs specifically to the corresponding buyer and seller to verify delivery and cancel requests; (d) Calculate aggregate marketplace metrics and KPI analytics (monthly sales trends, category performance charts) on the administrator dashboard.' },
    { id: 'storage', title: '3. Data Security & Simulated Storage', content: 'We prioritize the safety of your personal details and CNIC credentials. Vendora PK combines Google Firebase Firestore database collections with browser LocalStorage configurations. To maintain system reliability when active networks are offline, verification tokens, merchant registries, and order histories are safely mirrored across local storage keys (e.g. "vendora_products_", "vendora_order_") so your sessions remain stable across page refreshes.' },
    { id: 'sharing', title: '4. Third-Party Disclosure', content: 'We do not sell, trade, or distribute your personal details, transaction logs, or CNIC credentials to outside marketers or third-party brokers. Data is accessible solely to authorized administrators of the Vendora PK platform for merchant verification and support operations.' },
    { id: 'rights', title: '5. Account Control & Data Access', content: 'You maintain full control over your profile records. Users can review, edit, or update their account details, email addresses, and phone numbers directly from the Unified Profile Page. If you want to request complete removal of your account, transaction logs, or uploaded verification records, please write to our support desk.' }
  ];

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Hero Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
          color: 'var(--text-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '48px 32px',
          marginBottom: '40px',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="flex align-center gap-2" style={{ color: 'var(--secondary)', marginBottom: '12px' }}>
              <Shield size={20} />
              <span style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Data Protection</span>
            </div>
            <h1 style={{ fontSize: '36px', fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)' }}>Privacy Policy</h1>
            <p style={{ marginTop: '12px', fontSize: '15px', color: 'rgba(255,255,255,0.8)', maxWidth: '600px' }}>
              Understand how we protect your personal identification records, CNIC documentation, and transactions.
            </p>
          </div>
          <div style={{
            position: 'absolute',
            right: '-5%',
            bottom: '-10%',
            color: 'rgba(255,255,255,0.05)',
            transform: 'rotate(-15deg)',
            pointerEvents: 'none'
          }}>
            <Eye size={240} />
          </div>
        </div>

        {/* Content Section */}
        <div className="policy-layout-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }}>
          {/* Sidebar Navigation */}
          <aside style={{ position: 'sticky', top: '100px', height: 'fit-content' }}>
            <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>Policy Directory</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sections.map(sec => (
                  <li key={sec.id}>
                    <a
                      href={`#${sec.id}`}
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        fontWeight: 500,
                        transition: 'color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={e => e.target.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
                    >
                      <ArrowRight size={12} style={{ color: 'var(--primary)' }} />
                      {sec.title.substring(3)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Right Main Text Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {sections.map(sec => (
              <section key={sec.id} id={sec.id} style={{ scrollMarginTop: '100px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px' }}>
                  {sec.title}
                </h3>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.7', textAlign: 'justify' }}>
                  {sec.content}
                </p>
              </section>
            ))}

            <div className="card" style={{
              marginTop: '40px',
              padding: '24px',
              background: 'var(--bg-tertiary)',
              borderLeft: '4px solid var(--primary)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Need Data Assistance?</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                If you have questions regarding our privacy rules, want to access your profile data or request a CNIC document cleanup, please email our support at <strong style={{ color: 'var(--text-primary)' }}>mehransoomro910@gmail.com</strong>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
