import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getOrCreateConversation } from '../../services/chat/chatService';
import ChatWindow from './ChatWindow';
import { X, MessageSquare, Loader, Maximize2, Minimize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ChatModal({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  productId,
  productTitle,
  productImage,
  productPrice,
  orderId = null,
  initialMessage = null
}) {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setConversation(null);
      return;
    }

    if (!currentUser) {
      onClose();
      navigate('/login');
      return;
    }

    const initChat = async () => {
      setLoading(true);
      setError('');
      try {
        const conv = await getOrCreateConversation({
          buyerId: currentUser.uid,
          buyerName: userProfile?.name || currentUser.displayName || currentUser.email || 'Buyer',
          buyerEmail: currentUser.email || '',
          vendorId: vendorId || 'vendor-default',
          vendorName: vendorName || 'Vendor Merchant',
          productId: productId || 'prod-general',
          productTitle: productTitle || 'Marketplace Item',
          productImage: productImage || '',
          productPrice: productPrice || 0,
          orderId,
          initialMessageText: initialMessage
        });
        setConversation(conv);
      } catch (err) {
        console.error('Failed to initialize conversation modal:', err);
        setError('Could not connect to conversation. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [isOpen, currentUser, vendorId, productId, orderId, navigate, userProfile, vendorName, productTitle, productImage, productPrice, initialMessage]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div 
        className="card" 
        style={{
          width: '100%',
          maxWidth: '680px',
          height: '80vh',
          maxHeight: '750px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-secondary)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} style={{ color: 'var(--primary)' }} />
            <strong style={{ fontSize: '15px' }}>Chat with {vendorName || 'Merchant'}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (conversation) {
                  navigate(`/messages?convId=${conversation.id || conversation.conversationId}`);
                } else {
                  navigate('/messages');
                }
              }}
              className="btn-icon"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              title="Open full page"
            >
              <Maximize2 size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-icon"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
              <Loader className="spin" size={28} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Opening chat channel...</span>
            </div>
          ) : error ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--danger)' }}>
              {error}
            </div>
          ) : (
            <ChatWindow conversation={conversation} />
          )}
        </div>
      </div>
    </div>
  );
}
