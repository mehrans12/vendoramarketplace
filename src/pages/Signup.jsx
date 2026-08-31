import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, sanitizeText } from '../utils/validation'; // Input security
import { Store, Globe, Mail, Lock, User, Loader, Eye, EyeOff } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, signInWithGoogle } = useAuth();
  
  const initialRole = searchParams.get('role') || 'buyer';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(initialRole);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Strict validations
    const cleanName = sanitizeText(name.trim());
    if (!cleanName) {
      setError('Please enter a valid name.');
      return;
    }
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
      await signup(cleanName, email, password, role);
      setSuccessMsg(`Account created! A verification link was dispatched to ${email}. Redirecting...`);
      setTimeout(() => {
        if (role === 'vendor') {
          navigate('/vendor/dashboard');
        } else {
          navigate('/');
        }
      }, 2200);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create account. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Google sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center align-center" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '40px', background: 'var(--bg-secondary)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link to="/" className="logo-container" style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '8px', color: 'var(--text-primary)' }}>
            <Store size={32} className="logo-accent" />
            <span>VEND<span className="logo-accent">ORA</span></span>
          </Link>
          <p className="text-muted" style={{ fontSize: '14px' }}>Create an account and start trading</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'block', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div className="badge badge-success" style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'block', textAlign: 'center' }}>
            {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label flex align-center gap-2">
              <User size={16} style={{ color: 'var(--primary)' }} /> Full Name
            </label>
            <input 
              type="text" 
              className="form-input" 
              required 
              placeholder="e.g. Mehran Ahmed"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

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
            />
          </div>

          <div className="form-group">
            <label className="form-label flex align-center gap-2">
              <Lock size={16} style={{ color: 'var(--primary)' }} /> Password
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                className="form-input" 
                required 
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{ paddingRight: '40px' }}
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

          {/* Role selector */}
          <div className="form-group">
            <label className="form-label">Account Type</label>
            <div className="flex gap-4">
              <label 
                className="card flex align-center gap-2" 
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  cursor: 'pointer', 
                  border: role === 'buyer' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: role === 'buyer' ? 'var(--primary-light)' : 'transparent'
                }}
              >
                <input 
                  type="radio" 
                  name="role" 
                  checked={role === 'buyer'} 
                  onChange={() => setRole('buyer')}
                  style={{ accentColor: 'var(--primary)' }} 
                  disabled={loading}
                />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Buyer Account</span>
              </label>

              <label 
                className="card flex align-center gap-2" 
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  cursor: 'pointer', 
                  border: role === 'vendor' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: role === 'vendor' ? 'var(--primary-light)' : 'transparent'
                }}
              >
                <input 
                  type="radio" 
                  name="role" 
                  checked={role === 'vendor'} 
                  onChange={() => setRole('vendor')}
                  style={{ accentColor: 'var(--primary)' }} 
                  disabled={loading}
                />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Vendor Account</span>
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', marginTop: '12px', fontSize: '15px' }}
            disabled={loading}
          >
            {loading ? (
              <span className="flex align-center gap-2 justify-center">
                <Loader className="spin" size={16} /> Creating Account...
              </span>
            ) : (
              'Register Account'
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="flex align-center gap-4" style={{ margin: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)', borderStyle: 'solid', borderWidth: '0.5px' }} />
          <span>OR</span>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)', borderStyle: 'solid', borderWidth: '0.5px' }} />
        </div>

        {/* Google Signup */}
        <button 
          className="btn btn-secondary" 
          style={{ width: '100%', padding: '12px', fontSize: '14px', gap: '10px' }}
          onClick={handleGoogleSignup}
          disabled={loading}
        >
          <Globe size={18} style={{ color: '#ea4335' }} /> Register with Google
        </button>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
