import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sliders, X, ArrowRight, Trash2 } from 'lucide-react';

const CompareContext = createContext();

export function useCompare() {
  return useContext(CompareContext);
}

export function CompareProvider({ children }) {
  const [compareItems, setCompareItems] = useState(() => {
    try {
      const saved = localStorage.getItem('vendora_compare_items');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const navigate = useNavigate ? null : null; // Will use Link or direct navigation in drawer

  useEffect(() => {
    try {
      localStorage.setItem('vendora_compare_items', JSON.stringify(compareItems));
    } catch (e) {}
  }, [compareItems]);

  const addToCompare = (product) => {
    if (!product || !product.id) return false;
    if (compareItems.some(item => item.id === product.id)) {
      // Already in comparison tray, toggle off
      removeFromCompare(product.id);
      return false;
    }

    if (compareItems.length >= 4) {
      alert("You can compare up to 4 products at a time. Please remove one before adding another.");
      return false;
    }

    setCompareItems(prev => [...prev, product]);
    return true;
  };

  const removeFromCompare = (productId) => {
    setCompareItems(prev => prev.filter(item => item.id !== productId));
  };

  const isInCompare = (productId) => {
    return compareItems.some(item => item.id === productId);
  };

  const clearCompare = () => {
    setCompareItems([]);
  };

  return (
    <CompareContext.Provider value={{
      compareItems,
      addToCompare,
      removeFromCompare,
      isInCompare,
      clearCompare
    }}>
      {children}

      {/* Floating Comparison Drawer (Phase 10) */}
      {compareItems.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9990,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          maxWidth: '90vw'
        }}>
          <div className="flex align-center gap-2">
            <Sliders size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Compare ({compareItems.length}/4):
            </span>
          </div>

          {/* Thumbnails */}
          <div className="flex align-center gap-2">
            {compareItems.map(item => (
              <div 
                key={item.id} 
                style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid var(--primary)' }}
                title={typeof item.title === 'object' ? item.title.en : item.title}
              >
                <img 
                  src={item.images?.[0] || 'https://placehold.co/40x40?text=Item'} 
                  alt="" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <button
                  type="button"
                  onClick={() => removeFromCompare(item.id)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                  title="Remove from comparison"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex align-center gap-2">
            <a
              href={`/compare?ids=${compareItems.map(i => i.id).join(',')}`}
              className="btn btn-primary flex align-center gap-1"
              style={{
                padding: '6px 16px',
                fontSize: '12px',
                borderRadius: 'var(--radius-full)',
                textDecoration: 'none',
                color: '#fff'
              }}
            >
              Compare Now <ArrowRight size={14} />
            </a>

            <button
              type="button"
              onClick={clearCompare}
              className="btn btn-secondary flex align-center"
              style={{
                padding: '6px',
                borderRadius: '50%',
                color: 'var(--text-muted)'
              }}
              title="Clear comparison tray"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </CompareContext.Provider>
  );
}
