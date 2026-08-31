import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />

      <main className="container flex-grow flex flex-col align-center justify-center" style={{ padding: '80px 0', textAlign: 'center' }}>
        <Compass size={80} className="text-muted" style={{ marginBottom: '24px', animation: 'spin 10s linear infinite' }} />
        <h1 style={{ fontSize: '72px', color: 'var(--primary)', fontWeight: 800, margin: 0 }}>404</h1>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '12px 0' }}>Lost in the Marketplace?</h2>
        <p className="text-muted" style={{ marginBottom: '32px', maxWidth: '400px' }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Link to="/" className="btn btn-primary" style={{ padding: '12px 24px' }}>
          Back to Home
        </Link>
      </main>

      <Footer />
    </div>
  );
}
