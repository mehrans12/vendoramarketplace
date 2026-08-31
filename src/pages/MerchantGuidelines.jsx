import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Store, CheckCircle, ArrowRight } from 'lucide-react';

export default function MerchantGuidelines() {
  const sections = [
    { id: 'onboarding', title: '1. Merchant Onboarding & CNIC Audits', content: 'To sell on Vendora PK, you must create a Vendor account and submit your store registration request. You must provide a valid business name (e.g. "vebndo"), physical shop details, and upload clear photos of your National Identity Card (CNIC) front and back. New stores remain in a "Pending" state until the platform administrator reviews your application, verifies your CNIC document, and approves the activation of your shop.' },
    { id: 'listings', title: '2. Product Listing Standards', content: 'Vendora PK is a specialized marketplace for authentic local crafts and products. Merchants must list genuine handmade items, hand-loomed fabrics, traditional arts, local apparel, or home decor. (a) Counterfeit or generic factory duplicates are strictly prohibited; (b) Product pricing must be listed clearly in Pakistani Rupees (PKR); (c) High-quality product images and detailed description fields must be used to ensure customer clarity; (d) Inaccurate, misleading, or deceptive descriptions will result in immediate removal of listings.' },
    { id: 'fulfillment', title: '3. Order Management SLA', content: 'Merchants must keep their customer order queues updated in real-time. When a buyer makes a purchase, the order status defaults to "Pending". Vendors must review their orders regularly under the "Customer Orders" section in the Vendor Dashboard and update status flags to "Shipped" or "Delivered" once dispatched. Delay in processing orders or persistent delays will negatively affect shop ratings.' },
    { id: 'cancellation', title: '4. Handling Order Cancel Requests', content: 'If a buyer requests to cancel an order, the request appears in the dedicated "Cancel Order" dashboard section. The merchant is expected to review and process this request promptly. Approving the request changes the status to "Cancelled" in both the buyer and merchant dashboards. Approved cancellations are immediate and irreversible.' },
    { id: 'notifications', title: '5. Targeted Alert Communications', content: 'Vendora PK maintains strict targeted communication rules. Notifications regarding purchases or order status transitions (Shipped, Delivered, Cancellation Approvals) must be dispatched solely to the corresponding buyer. Broadcast notification alerts to the entire marketplace userbase are strictly prohibited. The platform automatically restricts notification visibility to relevant participants.' },
    { id: 'suspension', title: '6. Store Suspension & Reactivation', content: 'The central administration desk monitors store compliance. Stores violating listing policies, submitting fake CNICs, displaying high cancellation rates, or getting poor customer ratings may be suspended. Suspended merchants will have their listings hidden and lose order management access. Suspended merchants can contact administration at mehransoomro910@gmail.com for review and store reactivation.' }
  ];

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Banner */}
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
              <CheckCircle size={20} />
              <span style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Seller Guidelines</span>
            </div>
            <h1 style={{ fontSize: '36px', fontWeight: 800, margin: 0, fontFamily: 'var(--font-heading)' }}>Merchant Guidelines</h1>
            <p style={{ marginTop: '12px', fontSize: '15px', color: 'rgba(255,255,255,0.8)', maxWidth: '600px' }}>
              Guidelines for verified vendors to sell crafts and maintain quality operations on Vendora PK.
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
            <Store size={240} />
          </div>
        </div>

        {/* Content Layout */}
        <div className="policy-layout-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }}>
          {/* Sidebar */}
          <aside style={{ position: 'sticky', top: '100px', height: 'fit-content' }}>
            <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>Guidelines Menu</h4>
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

          {/* Right Text */}
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
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Need Seller Support?</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                If you have questions about listing configurations, audit steps, order processing, or payouts, contact vendor support at <strong style={{ color: 'var(--text-primary)' }}>mehransoomro910@gmail.com</strong> or call <strong style={{ color: 'var(--text-primary)' }}>+92 3120380415</strong>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
