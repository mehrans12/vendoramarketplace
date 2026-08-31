import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ShieldCheck, FileText, ArrowRight } from 'lucide-react';

export default function TermsOfService() {
  const sections = [
    { id: 'acceptance', title: '1. Acceptance of Terms', content: 'Welcome to Vendora PK ("the Platform"). By accessing or using our marketplace website, mobile application, or unified admin and seller dashboards, you agree to comply with and be bound by these Terms of Service. These terms constitute a legally binding agreement between you (whether as a Buyer, Vendor, or Administrator) and Vendora PK, under the laws of the Islamic Republic of Pakistan.' },
    { id: 'user-accounts', title: '2. User Accounts & Security', content: 'To access specific sections of the marketplace, including placing orders or listing handicrafts, you must register for an account. You agree to provide true, accurate, and complete information. You are solely responsible for safeguarding your login credentials (username and password) and for any activity under your account. Any suspected unauthorized usage must be reported to support@vendora.pk immediately.' },
    { id: 'roles-restrictions', title: '3. User Roles & Purchase Restrictions', content: 'Vendora PK maintains strict separated roles for buyers, vendors (merchants), and platform administrators. If you register as a Vendor, you are granted authorization to create a merchant shop (e.g., under the "vebndo" brand or verified custom brands), list handmade goods, set pricing, and manage incoming customer order queues. In order to preserve marketplace integrity and avoid conflicts of interest, Vendors are strictly prohibited from placing orders or buying products from their own shops or other active stores on the marketplace. The "Add to Cart" functionality is disabled for accounts carrying the Vendor role.' },
    { id: 'transactions-payments', title: '4. Transactions & Delivery Simulation', content: 'Vendora PK operates as a simulated digital marketplace for local handicrafts. All prices listed on the site are in Pakistani Rupees (PKR). Order transactions and payment steps simulated during checkout are intended for demonstration and academic evaluation. Real-time notifications and synchronized status updates are dispatched to the respective buyer and vendor upon payment approval.' },
    { id: 'cancellation-policy', title: '5. Order Cancellation Policy', content: 'Buyers have the right to request order cancellations prior to dispatch. When a buyer initiates a cancellation, the status shifts to "Cancellation Requested". The respective merchant must review this request under the Vendor Dashboard. If approved, the order status changes to "Cancelled" in both the buyer\'s order history and the merchant\'s queue, triggering automated notifications. Approved cancellations are irreversible once processed.' },
    { id: 'intellectual-property', title: '6. Intellectual Property & Authenticity', content: 'All merchants must list genuine local crafts, apparel, home decor, or art. Listing counterfeits, generic factory-made items masquerading as local handicrafts, or copyrighted content from third parties is strictly prohibited. The administration reserve the rights to audit listings and suspend merchants violating this policy.' },
    { id: 'governing-law', title: '7. Governing Law & Jurisdiction', content: 'These Terms of Service shall be governed by, construed, and enforced in accordance with the laws of Pakistan. Any dispute arising out of or related to these terms shall be subject to the exclusive jurisdiction of the courts located in Karachi and Jamshoro, Sindh, Pakistan.' }
  ];

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Page Title & Hero Header */}
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
              <ShieldCheck size={20} />
              <span style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Legal Information</span>
            </div>
            <h1 style={{ fontSize: '36px', fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)' }}>Terms of Service</h1>
            <p style={{ marginTop: '12px', fontSize: '15px', color: 'rgba(255,255,255,0.8)', maxWidth: '600px' }}>
              Please read these terms carefully before using Vendora PK. Last updated: July 27, 2026.
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
            <FileText size={240} />
          </div>
        </div>

        {/* Content Layout */}
        <div className="policy-layout-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }}>
          {/* Left Sidebar Table of Contents */}
          <aside style={{ position: 'sticky', top: '100px', height: 'fit-content' }}>
            <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>Table of Contents</h4>
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

          {/* Right Main Policy Text */}
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

            {/* Compliance Footer Note */}
            <div className="card" style={{
              marginTop: '40px',
              padding: '24px',
              background: 'var(--bg-tertiary)',
              borderLeft: '4px solid var(--primary)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Need assistance?</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                If you have questions regarding our Terms of Service, merchant obligations, or dispute resolutions, please reach out to our administration desk at <strong style={{ color: 'var(--text-primary)' }}>mehransoomro910@gmail.com</strong> or phone <strong style={{ color: 'var(--text-primary)' }}>+92 3120380415</strong>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
