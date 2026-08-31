import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, Store, User, Shield, Package, Clock, Filter, MessageSquare, AlertCircle } from 'lucide-react';

export default function ConversationList({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  loading = false
}) {
  const { currentUser, role: userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const q = searchTerm.toLowerCase().trim();
      const title = typeof c.productTitle === 'object' 
        ? (c.productTitle.en || Object.values(c.productTitle)[0] || '') 
        : (c.productTitle || '');
      
      const matchesSearch = !q || 
        title.toLowerCase().includes(q) ||
        (c.vendorName && c.vendorName.toLowerCase().includes(q)) ||
        (c.buyerName && c.buyerName.toLowerCase().includes(q)) ||
        (c.orderId && c.orderId.toLowerCase().includes(q)) ||
        (c.lastMessageText && c.lastMessageText.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'UNREAD') {
        const unread = userRole === 'vendor' ? c.vendorUnreadCount : userRole === 'admin' ? c.adminUnreadCount : c.buyerUnreadCount;
        return (unread || 0) > 0;
      }
      if (statusFilter === 'OPEN') return c.status === 'OPEN' || c.status === 'PENDING_VENDOR' || c.status === 'PENDING_BUYER';
      if (statusFilter === 'RESOLVED') return c.status === 'RESOLVED';
      if (statusFilter === 'BLOCKED') return c.status === 'BLOCKED';

      return true;
    });
  }, [conversations, searchTerm, statusFilter, userRole]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)'
    }}>
      {/* Search & Filter Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '34px', margin: 0, fontSize: '13px', height: '36px' }}
          />
        </div>

        {/* Status Filter Chips */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {['ALL', 'UNREAD', 'OPEN', 'RESOLVED'].map((filterKey) => (
            <button
              key={filterKey}
              type="button"
              onClick={() => setStatusFilter(filterKey)}
              style={{
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid',
                borderColor: statusFilter === filterKey ? 'var(--primary)' : 'var(--border-color)',
                backgroundColor: statusFilter === filterKey ? 'var(--primary-light)' : 'transparent',
                color: statusFilter === filterKey ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: statusFilter === filterKey ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {filterKey === 'ALL' ? 'All Chats' : filterKey.charAt(0) + filterKey.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations Scrollable List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
            <p style={{ fontSize: '13.5px', margin: 0, fontWeight: 600 }}>No conversations found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              {searchTerm ? 'Try a different search term.' : 'Direct product inquiries will appear here.'}
            </p>
          </div>
        ) : (
          filteredConversations.map((c) => {
            const convId = c.id || c.conversationId;
            const isSelected = convId === activeConversationId;
            const unreadCount = userRole === 'vendor' 
              ? (c.vendorUnreadCount || 0) 
              : userRole === 'admin' 
                ? (c.adminUnreadCount || 0) 
                : (c.buyerUnreadCount || 0);

            const title = typeof c.productTitle === 'object' 
              ? (c.productTitle.en || Object.values(c.productTitle)[0] || 'Product') 
              : (c.productTitle || 'Marketplace Item');

            return (
              <div
                key={convId}
                onClick={() => onSelectConversation(c)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-primary)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* Product Thumbnail */}
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {c.productImage ? (
                    <img 
                      src={c.productImage} 
                      alt="" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <Store size={20} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>

                {/* Conversation Meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                    <span style={{
                      fontWeight: unreadCount > 0 ? 800 : 600,
                      fontSize: '13.5px',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {userRole === 'vendor' ? (c.buyerName || 'Buyer') : (c.vendorName || 'Artisan Merchant')}
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📦 {title}
                  </div>

                  <div style={{
                    fontSize: '12px',
                    color: unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: unreadCount > 0 ? 600 : 'normal',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {c.lastMessageText || 'No messages yet'}
                  </div>
                </div>

                {/* Unread Counter Badge */}
                {unreadCount > 0 && (
                  <span style={{
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    minWidth: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px',
                    flexShrink: 0
                  }}>
                    {unreadCount}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
