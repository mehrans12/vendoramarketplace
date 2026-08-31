import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, CheckCircle, AlertTriangle, X, Loader } from 'lucide-react';

export default function EmailVerificationBanner() {
  const { currentUser, sendVerificationEmail } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');

  // If user is not logged in, or already emailVerified, or dismissed, do not render banner
  if (!currentUser || currentUser.emailVerified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    setFeedback('');
    try {
      await sendVerificationEmail();
      setFeedback('Verification link sent! Check your inbox/spam folder.');
    } catch (err) {
      console.error(err);
      setFeedback(err.message || 'Failed to send verification email. Try again shortly.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(90deg, #78350f 0%, #92400e 100%)',
      color: '#fef3c7',
      padding: '10px 16px',
      fontSize: '13px',
      borderBottom: '1px solid #b45309',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      position: 'relative',
      zIndex: 99
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <AlertTriangle size={18} style={{ color: '#fde68a', flexShrink: 0 }} />
        <span>
          <strong>Email Unverified:</strong> A verification link was sent to <u>{currentUser.email}</u>. Please verify your address.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {feedback ? (
          <span style={{ fontSize: '12px', color: '#fef08a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={14} /> {feedback}
          </span>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            style={{
              background: '#f59e0b',
              color: '#451a03',
              border: 'none',
              borderRadius: 'var(--radius-sm, 4px)',
              padding: '4px 12px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: sending ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {sending ? <Loader size={12} className="spin" /> : <Mail size={12} />}
            {sending ? 'Sending...' : 'Resend Link'}
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fde68a',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Dismiss notice"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
