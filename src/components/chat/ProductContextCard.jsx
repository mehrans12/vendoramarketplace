import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ExternalLink, Package, ShieldCheck, Tag } from 'lucide-react';

export default function ProductContextCard({ conversation, compact = false }) {
  if (!conversation) return null;

  const {
    productId,
    productTitle,
    productImage,
    productPrice,
    vendorName,
    orderId,
    status
  } = conversation;

  const titleStr = typeof productTitle === 'object' 
    ? (productTitle.en || Object.values(productTitle)[0] || 'Product') 
    : (productTitle || 'Marketplace Item');

  const getStatusBadge = (st) => {
    switch (st) {
      case 'OPEN':
        return <span className="badge badge-success" style={{ fontSize: '11px' }}>Open</span>;
      case 'PENDING_VENDOR':
        return <span className="badge badge-warning" style={{ fontSize: '11px', background: '#f59e0b', color: '#fff' }}>Awaiting Vendor</span>;
      case 'PENDING_BUYER':
        return <span className="badge badge-info" style={{ fontSize: '11px', background: '#3b82f6', color: '#fff' }}>Awaiting Buyer</span>;
      case 'PENDING_ADMIN':
        return <span className="badge badge-primary" style={{ fontSize: '11px' }}>Support Intervened</span>;
      case 'RESOLVED':
        return <span className="badge badge-success" style={{ fontSize: '11px', background: '#10b981', color: '#fff' }}>Resolved ✅</span>;
      case 'CLOSED':
        return <span className="badge badge-secondary" style={{ fontSize: '11px' }}>Closed</span>;
      case 'BLOCKED':
        return <span className="badge badge-danger" style={{ fontSize: '11px' }}>Blocked 🚫</span>;
      default:
        return <span className="badge badge-secondary" style={{ fontSize: '11px' }}>{st}</span>;
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: compact ? '10px 14px' : '14px 18px',
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      gap: '12px',
      flexWrap: 'wrap'
    }}>
      {/* Left: Product Thumbnail & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: 1 }}>
        <div style={{
          width: compact ? '40px' : '52px',
          height: compact ? '40px' : '52px',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {productImage ? (
            <img 
              src={productImage} 
              alt={titleStr} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <ShoppingBag size={22} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              fontWeight: 700, 
              fontSize: compact ? '13px' : '14px', 
              color: 'var(--text-primary)',
              maxWidth: '280px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {titleStr}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {productPrice > 0 && (
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                Rs. {Number(productPrice).toLocaleString()}
              </span>
            )}
            {vendorName && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                • Merchant: <strong>{vendorName}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Order context tag, Status badge & View link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {orderId && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: '#6366f1',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            fontWeight: 600
          }}>
            <Package size={13} /> Order #{orderId}
          </span>
        )}

        {getStatusBadge(status)}

        {productId && (
          <Link 
            to={`/product/${productId}`} 
            target="_blank" 
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="View Product Page"
          >
            <span>View</span>
            <ExternalLink size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}
