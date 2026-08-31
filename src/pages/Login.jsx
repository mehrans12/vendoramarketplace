import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword } from '../utils/validation'; // Input checks
import { Store, Globe, Mail, Lock, ArrowRight, Loader, Eye, EyeOff, KeyRound, X, CheckCircle, Shield } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, signInWithGoogle, resetPassword } = useAuth();

  const isAdminParam = searchParams.get('admin') === '1';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modal states
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Strict format validations
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      if (email.toLowerCase() === 'iphoneuser0312@gmail.com' || email.toLowerCase().includes('admin')) {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!validateEmail(resetEmail)) {
      setResetError('Please enter a valid email address.');
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setResetSuccess(`Password reset link dispatched to ${resetEmail}. Check your inbox!`);
    } catch (err) {
      console.error(err);
      setResetError(err.message || 'Failed to send password reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center align-center" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '20px' }}>
      {/* Centered card */}
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '40px', background: 'var(--bg-secondary)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link to="/" className="logo-container" style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '8px', color: 'var(--text-primary)' }}>
            <Store size={32} className="logo-accent" />
            <span>VEND<span className="logo-accent">ORA</span></span>
          </Link>
          <p className="text-muted" style={{ fontSize: '14px' }}>
            {isAdminParam ? 'Administrative Portal Authentication' : 'Welcome back! Sign in to your account'}
          </p>
        </div>

        {/* Admin Portal Notice Banner (Secure - No Autofill) */}
        {isAdminParam && (
          <div 
            className="flex align-center gap-2" 
            style={{ 
              padding: '10px 14px', 
              background: 'rgba(245, 158, 11, 0.08)', 
              border: '1px solid rgba(245, 158, 11, 0.25)', 
              borderRadius: 'var(--radius-sm)', 
              marginBottom: '20px',
              fontSize: '12.5px',
              color: '#b45309',
              fontWeight: 600
            }}
          >
            <Shield size={16} style={{ color: '#f59e0b', flexShrink: 0 }} /> Secure Administrative Access
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'block', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label flex align-center gap-2">
              <Mail size={16} style={{ color: 'var(--primary)' }} /> Email Address
            </label>
            <input 
              type="email" 
              className="form-input" 
              required 
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
              <label className="form-label flex align-center gap-2" style={{ margin: 0 }}>
                <Lock size={16} style={{ color: 'var(--primary)' }} /> Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setIsResetModalOpen(true);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Forgot Password?
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                className="form-input" 
                required 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{ paddingRight: '40px' }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', fontSize: '15px' }}
            disabled={loading}
          >
            {loading ? (
              <span className="flex align-center gap-2 justify-center">
                <Loader className="spin" size={16} /> Signing In...
              </span>
            ) : (
              <span className="flex align-center gap-2 justify-center" style={{ width: '100%' }}>
                Sign In <ArrowRight size={16} />
              </span>
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="flex align-center gap-4" style={{ margin: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)', borderStyle: 'solid', borderWidth: '0.5px' }} />
          <span>OR</span>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)', borderStyle: 'solid', borderWidth: '0.5px' }} />
        </div>

        {/* Social logins */}
        <button 
          className="btn btn-secondary" 
          style={{ width: '100%', padding: '12px', fontSize: '14px', gap: '10px' }}
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <Globe size={18} style={{ color: '#ea4335' }} /> Continue with Google
        </button>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Create one now
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isResetModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '32px', background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between align-center" style={{ marginBottom: '20px' }}>
              <h3 className="flex align-center gap-2" style={{ fontSize: '18px', fontWeight: 700 }}>
                <KeyRound size={20} style={{ color: 'var(--primary)' }} /> Reset Password
              </h3>
              <button 
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetError('');
                  setResetSuccess('');
                }} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Enter your account email address below. We'll send you a link to reset your password.
            </p>

            {resetError && (
              <div className="badge badge-danger" style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', display: 'block', textAlign: 'center' }}>
                {resetError}
              </div>
            )}

            {resetSuccess && (
              <div className="badge badge-success flex align-center justify-center gap-2" style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                <CheckCircle size={16} /> {resetSuccess}
              </div>
            )}

            <form onSubmit={handleResetSubmit}>
              <div className="form-group">
                <label className="form-label">Account Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  required
                  placeholder="name@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={resetLoading}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={resetLoading}>
                {resetLoading ? 'Sending Link...' : 'Send Reset Link'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
