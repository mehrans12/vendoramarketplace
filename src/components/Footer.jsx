import React from 'react';
import { Link } from 'react-router-dom';
import { Store, ShieldCheck, Truck, RefreshCw, MessageSquareCode } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="main-footer">
      <div className="container">
        {/* Core Value Props (Alibaba Style Trust Indicators) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '30px',
          paddingBottom: '40px',
          borderBottom: '1px solid var(--bg-dark-secondary)',
          marginBottom: '50px'
        }}>
          <div className="flex gap-4 align-center">
            <div style={{ color: 'var(--primary)', background: 'var(--bg-dark-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h4 style={{ color: 'var(--text-light)', fontSize: '15px' }}>Secure Payments</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>100% security with cash on delivery & local portals.</p>
            </div>
          </div>
          <div className="flex gap-4 align-center">
            <div style={{ color: 'var(--primary)', background: 'var(--bg-dark-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <Truck size={24} />
            </div>
            <div>
              <h4 style={{ color: 'var(--text-light)', fontSize: '15px' }}>Nationwide Shipping</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Fast logistics across all major cities of Pakistan.</p>
            </div>
          </div>
          <div className="flex gap-4 align-center">
            <div style={{ color: 'var(--primary)', background: 'var(--bg-dark-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <RefreshCw size={24} />
            </div>
            <div>
              <h4 style={{ color: 'var(--text-light)', fontSize: '15px' }}>Easy Buyer Protection</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Hassle-free dispute resolution and returns support.</p>
            </div>
          </div>
        </div>

        {/* Footer links grid */}
        <div className="footer-grid">
          <div>
            <Link to="/" className="logo-container" style={{ marginBottom: '16px' }}>
              <Store size={26} className="logo-accent" />
              <span>VEND<span className="logo-accent">ORA</span></span>
            </Link>
            <p className="footer-text">
              Pakistan's modern multi-vendor marketplace connecting passionate local merchants, home creators, and micro-brands directly to buyers nationwide.
            </p>
          </div>

          <div>
            <h4 className="footer-col-title">Shop</h4>
            <ul className="footer-links">
              <li><Link to="/category/all" className="footer-link">All Products</Link></li>
              <li><Link to="/category/handicrafts" className="footer-link">Handicrafts</Link></li>
              <li><Link to="/category/fashion" className="footer-link">Fashion & Textiles</Link></li>
              <li><Link to="/category/home-decor" className="footer-link">Home Decor</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">For Vendors</h4>
            <ul className="footer-links">
              <li><Link to="/signup?role=vendor" className="footer-link">Onboard as Vendor</Link></li>
              <li><Link to="/login" className="footer-link">Seller Dashboard Login</Link></li>
              <li><Link to="/policies/vendor" className="footer-link">Merchant Guidelines</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">Contact Us</h4>
            <ul className="footer-links">
              <li className="footer-text" style={{ margin: 0 }}>IMCS, University Of Sindh: Jamshoro, Sindh, Pakistan</li>
              <li className="footer-text" style={{ margin: 0 }}>Support: mehransoomro910@gmail.com</li>
              <li className="footer-text" style={{ margin: 0 }}>Hotline: +92 3120380415</li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="footer-bottom flex justify-between align-center">
          <div>© {new Date().getFullYear()} Vendora PK. All Rights Reserved.</div>
          <div className="flex gap-4">
            <Link to="/terms" className="footer-link">Terms of Service</Link>
            <Link to="/privacy" className="footer-link">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
