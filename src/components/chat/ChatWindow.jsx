import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  subscribeToMessages, 
  sendMessage, 
  markConversationAsRead, 
  updateConversationStatus, 
  reportConversation, 
  softDeleteMessage 
} from '../../services/chat/chatService';
import ProductContextCard from './ProductContextCard';
import { 
  Send, 
  Image as ImageIcon, 
  Shield, 
  Store, 
  User, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Trash2, 
  Clock, 
  Check, 
  CheckCheck, 
  Flag, 
  Lock, 
  RotateCcw,
  Loader
} from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function ChatWindow({ conversation, onStatusChange }) {
  const { currentUser, role: userRole } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [attachedImages, setAttachedImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Modals & Administrative Actions
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('suspicious_request');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const conversationId = conversation?.id || conversation?.conversationId;

  // 1. Subscribe to real-time message stream
  useEffect(() => {
    if (!conversationId) return;

    setLoadingMessages(true);
    const unsubscribe = subscribeToMessages(
      conversationId,
      (newMsgs) => {
        setMessages(newMsgs);
        setLoadingMessages(false);
      },
      (err) => {
        console.warn('Chat messages subscription warning:', err);
        setLoadingMessages(false);
      }
    );

    // Mark as read for the viewing participant
    if (currentUser?.uid) {
      markConversationAsRead({
        conversationId,
        userId: currentUser.uid,
        role: userRole
      });
    }

    return () => unsubscribe();
  }, [conversationId, currentUser?.uid, userRole]);

  // 2. Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Handle Message Submission
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean && attachedImages.length === 0) return;

    if (conversation?.status === 'BLOCKED' || conversation?.status === 'CLOSED') {
      alert(`This conversation is ${conversation.status.toLowerCase()} and cannot receive new messages.`);
      return;
    }

    setSending(true);

    try {
      let roleTag = 'BUYER';
      let senderName = currentUser?.displayName || currentUser?.email || 'User';

      if (userRole === 'admin') {
        roleTag = 'ADMIN';
        senderName = 'Vendora Support';
      } else if (userRole === 'vendor' || currentUser?.uid === conversation?.vendorId) {
        roleTag = 'VENDOR';
        senderName = conversation?.vendorName || 'Artisan Merchant';
      }

      await sendMessage({
        conversationId,
        senderId: currentUser?.uid || 'guest-uid',
        senderName,
        senderRole: roleTag,
        text: clean,
        attachmentUrls: attachedImages,
        messageType: attachedImages.length > 0 ? 'IMAGE' : 'TEXT'
      });

      setInputText('');
      setAttachedImages([]);
    } catch (err) {
      console.error('Failed sending message:', err);
      alert('Message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // 4. Handle KeyPress for Enter to Send
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 5. Image Attachment Handling
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingImage(true);
    try {
      const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1200,
        useWebWorker: true
      };

      const compressedBase64List = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const compressedFile = await imageCompression(file, options);
        const reader = new FileReader();
        const b64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(compressedFile);
        });
        compressedBase64List.push(b64);
      }

      setAttachedImages(prev => [...prev, ...compressedBase64List]);
    } catch (err) {
      console.error('Image compression error:', err);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 6. Handle Conversation Status Change (Admin / Participants)
  const handleStatusChange = async (newStatus, notes = '') => {
    if (!conversationId) return;
    try {
      await updateConversationStatus({
        conversationId,
        status: newStatus,
        adminId: currentUser?.uid || 'admin',
        adminEmail: currentUser?.email || 'admin@vendora.pk',
        notes
      });
      if (onStatusChange) onStatusChange(newStatus);
    } catch (err) {
      alert(`Could not update status: ${err.message}`);
    }
  };

  // 7. Submit Conversation Report
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!conversationId) return;

    try {
      await reportConversation({
        conversationId,
        reporterId: currentUser?.uid || 'user',
        reporterRole: userRole || 'buyer',
        reason: reportReason,
        details: reportDetails
      });
      setReportSuccess(true);
      setTimeout(() => {
        setIsReportModalOpen(false);
        setReportSuccess(false);
        setReportDetails('');
      }, 2000);
    } catch (err) {
      alert(`Failed to submit report: ${err.message}`);
    }
  };

  if (!conversation) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        color: 'var(--text-muted)',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <Store size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <h4 style={{ margin: 0, color: 'var(--text-secondary)' }}>Select a conversation to start chatting</h4>
        <p style={{ fontSize: '13px', marginTop: '6px' }}>View inquiries, product queries, and order discussions in real time.</p>
      </div>
    );
  }

  const isBlocked = conversation.status === 'BLOCKED';
  const isClosed = conversation.status === 'CLOSED';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-primary)',
      position: 'relative'
    }}>
      {/* Top: Product & Order Context Header */}
      <ProductContextCard conversation={conversation} />

      {/* Admin Action Bar (Visible to Admin or Support) */}
      {userRole === 'admin' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
          fontSize: '12px',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontWeight: 600 }}>
            <Shield size={15} style={{ color: '#f59e0b' }} />
            <span>Admin Oversight Mode</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {conversation.status !== 'RESOLVED' && (
              <button 
                onClick={() => handleStatusChange('RESOLVED', 'Issue resolved by support')}
                className="btn btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '11px', color: '#10b981', borderColor: '#10b981' }}
              >
                Mark Resolved
              </button>
            )}
            {conversation.status !== 'BLOCKED' ? (
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to block this conversation? Messaging will be disabled.')) {
                    handleStatusChange('BLOCKED', 'Violated marketplace safety guidelines');
                  }
                }}
                className="btn btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '11px', color: '#ef4444', borderColor: '#ef4444' }}
              >
                Block Chat
              </button>
            ) : (
              <button 
                onClick={() => handleStatusChange('OPEN', 'Unblocked by administrator')}
                className="btn btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '11px', color: '#3b82f6', borderColor: '#3b82f6' }}
              >
                Unblock
              </button>
            )}
            <button
              onClick={() => handleStatusChange(isClosed ? 'OPEN' : 'CLOSED')}
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: '11px' }}
            >
              {isClosed ? 'Reopen' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Messages Stream Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {loadingMessages ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
            <Loader className="spin" size={24} style={{ color: 'var(--primary)' }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No messages in this conversation yet. Send the first message below!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.uid;
            const isSystem = msg.senderRole === 'SYSTEM' || msg.messageType === 'SYSTEM';
            const isAdminMsg = msg.senderRole === 'ADMIN';
            const isVendorMsg = msg.senderRole === 'VENDOR';

            if (isSystem) {
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '11.5px',
                    color: 'var(--text-secondary)',
                    textAlign: 'center',
                    maxWidth: '85%'
                  }}>
                    ℹ️ {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div 
                key={msg.id} 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  alignSelf: isMe ? 'flex-end' : 'flex-start'
                }}
              >
                {/* Sender Header Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  marginBottom: '3px',
                  color: 'var(--text-secondary)'
                }}>
                  {isAdminMsg ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      color: '#b45309',
                      fontWeight: 700,
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      <Shield size={11} fill="#f59e0b" /> Vendora Support
                    </span>
                  ) : isVendorMsg ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      color: 'var(--primary)',
                      fontWeight: 700
                    }}>
                      <Store size={11} /> {msg.senderName || 'Merchant'}
                    </span>
                  ) : (
                    <span style={{ fontWeight: 600 }}>
                      <User size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                      {isMe ? 'You' : (msg.senderName || 'Buyer')}
                    </span>
                  )}

                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>

                {/* Message Bubble Body */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  backgroundColor: isMe 
                    ? 'var(--primary)' 
                    : isAdminMsg 
                      ? 'rgba(245, 158, 11, 0.12)' 
                      : 'var(--bg-secondary)',
                  color: isMe 
                    ? '#ffffff' 
                    : isAdminMsg 
                      ? 'var(--text-primary)' 
                      : 'var(--text-primary)',
                  border: isMe 
                    ? 'none' 
                    : isAdminMsg 
                      ? '1px solid rgba(245, 158, 11, 0.3)' 
                      : '1px solid var(--border-color)',
                  fontSize: '13.5px',
                  lineHeight: '1.45',
                  wordBreak: 'break-word',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  position: 'relative'
                }}>
                  {msg.deletedAt ? (
                    <em style={{ opacity: 0.6, fontSize: '12px' }}>This message was deleted.</em>
                  ) : (
                    <>
                      {msg.text && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.text}</p>}

                      {/* Attachments rendering */}
                      {msg.attachmentUrls && msg.attachmentUrls.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: msg.text ? '8px' : 0 }}>
                          {msg.attachmentUrls.map((url, idx) => (
                            <img 
                              key={idx} 
                              src={url} 
                              alt="Attachment" 
                              style={{
                                maxWidth: '180px',
                                maxHeight: '180px',
                                borderRadius: 'var(--radius-sm)',
                                objectFit: 'cover',
                                cursor: 'pointer',
                                border: '1px solid rgba(0,0,0,0.1)'
                              }}
                              onClick={() => window.open(url, '_blank')}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Status & Action Footnotes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  {isMe && !msg.deletedAt && (
                    <button
                      type="button"
                      onClick={() => softDeleteMessage({ conversationId, messageId: msg.id, userId: currentUser?.uid })}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '10px', padding: 0 }}
                      title="Delete message"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attached Images Preview Bar */}
      {attachedImages.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '8px 16px',
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          alignItems: 'center'
        }}>
          {attachedImages.map((b64, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={b64} alt="Preview" style={{ width: '44px', height: '44px', borderRadius: '4px', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))}
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px'
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Message Input Bar */}
      {isBlocked ? (
        <div style={{
          padding: '14px 20px',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderTop: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#ef4444',
          fontSize: '13px',
          textAlign: 'center',
          fontWeight: 600
        }}>
          🚫 This conversation has been blocked by marketplace moderation.
        </div>
      ) : isClosed ? (
        <div style={{
          padding: '14px 20px',
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          color: 'var(--text-muted)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <span>This conversation is closed.</span>
          <button 
            type="button" 
            onClick={() => handleStatusChange('OPEN')}
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            Reopen Conversation
          </button>
        </div>
      ) : (
        <form 
          onSubmit={handleSendMessage}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 18px',
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-color)'
          }}
        >
          {/* Attachment Button */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            multiple 
            style={{ display: 'none' }} 
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Attach Photo"
            disabled={uploadingImage}
          >
            {uploadingImage ? <Loader className="spin" size={18} /> : <ImageIcon size={18} />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            className="form-input"
            placeholder={userRole === 'admin' ? "Reply officially as Vendora Support..." : "Type your message here..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ margin: 0, flex: 1, fontSize: '13.5px' }}
            disabled={sending}
          />

          {/* Send Button */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || (!inputText.trim() && attachedImages.length === 0)}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            {sending ? <Loader className="spin" size={16} /> : <Send size={16} />}
            <span>Send</span>
          </button>

          {/* Report Button */}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
            title="Report this conversation"
          >
            <Flag size={16} />
          </button>
        </form>
      )}

      {/* Safety Report Modal */}
      {isReportModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px', backgroundColor: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', color: '#ef4444' }}>
                <AlertTriangle size={20} /> Report Conversation
              </h3>
              <button 
                type="button" 
                onClick={() => setIsReportModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {reportSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CheckCircle size={36} style={{ color: '#10b981', marginBottom: '8px' }} />
                <p style={{ fontWeight: 600 }}>Report Submitted</p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Our marketplace trust & safety team has been notified and will audit this conversation.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport}>
                <div className="form-group">
                  <label className="form-label">Reason for reporting:</label>
                  <select 
                    className="form-input" 
                    value={reportReason} 
                    onChange={e => setReportReason(e.target.value)}
                  >
                    <option value="spam">Spam or Unsolicited Advertisements</option>
                    <option value="harassment">Harassment or Offensive Language</option>
                    <option value="scam">Scam / Fraudulent Activity</option>
                    <option value="off_platform_payment">Suspicious Request for Off-Platform Payment</option>
                    <option value="inappropriate_content">Inappropriate Content / Photos</option>
                    <option value="other">Other Concern</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Additional Details:</label>
                  <textarea 
                    className="form-input" 
                    rows={3} 
                    placeholder="Provide context on what occurred..." 
                    value={reportDetails}
                    onChange={e => setReportDetails(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    onClick={() => setIsReportModalOpen(false)}
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-accent" 
                    style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
