import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, hasFirebaseKeys } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { MessageSquare, X, Send, Sparkles, HelpCircle, Loader, Sliders } from 'lucide-react';
import { trackEvent } from '../services/analytics/eventTracker';
import { EventTypes } from '../services/analytics/eventTypes';
import { useLanguage } from '../context/LanguageContext';

// Helper inline markdown parser (bold, links, etc.)
function parseInlineMarkdown(text) {
  if (typeof text !== 'string') return text;
  
  const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let parts = [];
  let lastIndex = 0;
  let key = 0;
  
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) return text;
  
  for (const match of matches) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }
    
    if (match[0].startsWith('**')) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else {
      const label = match[3];
      const url = match[4];
      if (url.startsWith('/product/') || url.includes('vendora.pk/product/')) {
        const productId = url.split('/product/')[1];
        parts.push(
          <Link key={key++} to={`/product/${productId}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
            {label}
          </Link>
        );
      } else {
        parts.push(
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
            {label}
          </a>
        );
      }
    }
    
    lastIndex = matchIndex + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts;
}

// Renders markdown tables side-by-side
function renderTableHTML(rows, keyIdx) {
  if (rows.length === 0) return null;
  const headers = rows[0];
  const bodyRows = rows.slice(1);
  
  return (
    <div key={`table-${keyIdx}`} style={{ overflowX: 'auto', margin: '12px 0', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-color)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '8px 12px', fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ padding: '8px 12px' }}>{parseInlineMarkdown(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Renders lists or general text lines
function renderLineHTML(line, keyIdx) {
  if (!line) return <div key={keyIdx} style={{ height: '8px' }} />;
  
  // Bullet lists
  if (line.startsWith('- ') || line.startsWith('* ')) {
    const content = line.substring(2);
    return (
      <ul key={keyIdx} style={{ margin: '4px 0 4px 16px', paddingLeft: 0, listStyleType: 'disc' }}>
        <li style={{ fontSize: '13px', lineHeight: 1.5 }}>{parseInlineMarkdown(content)}</li>
      </ul>
    );
  }
  
  // Subheadings
  if (line.startsWith('### ')) {
    return <h4 key={keyIdx} style={{ fontSize: '14px', fontWeight: 700, margin: '12px 0 6px' }}>{parseInlineMarkdown(line.substring(4))}</h4>;
  }
  if (line.startsWith('## ')) {
    return <h3 key={keyIdx} style={{ fontSize: '15px', fontWeight: 700, margin: '16px 0 8px' }}>{parseInlineMarkdown(line.substring(3))}</h3>;
  }
  
  return (
    <p key={keyIdx} style={{ fontSize: '13px', margin: '4px 0', lineHeight: 1.5 }}>
      {parseInlineMarkdown(line)}
    </p>
  );
}

// Aggregated markdown parser
function RenderMarkdown({ content }) {
  if (!content) return null;
  
  const lines = content.split('\n');
  let inTable = false;
  let tableRows = [];
  const elements = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Skip separator row |---|---|
      if (cells.every(c => c.match(/^-+$/))) {
        continue;
      }
      
      tableRows.push(cells);
    } else {
      if (inTable) {
        elements.push(renderTableHTML(tableRows, i));
        inTable = false;
      }
      elements.push(renderLineHTML(line, i));
    }
  }
  if (inTable) {
    elements.push(renderTableHTML(tableRows, lines.length));
  }
  
  return <div>{elements}</div>;
}

export default function ChatWidget() {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('product_discovery'); // 'product_discovery' | 'buyer_support'
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Salam! I am your Vendora AI assistant. Ask me anything about products, comparison, or orders!',
      createdAt: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleOpenWidget = () => {
    setIsOpen(true);
    trackEvent(EventTypes.AI_ASSISTANT_OPEN).catch(err => console.warn(err));
  };

  const handleProductCardClick = (prod) => {
    trackEvent(EventTypes.AI_PRODUCT_CLICK, {
      productId: prod.id || prod.productId,
      metadata: { name: prod.name, price: prod.price }
    }).catch(err => console.warn(err));
    setIsOpen(false);
  };

  const handleChipClick = (chipText) => {
    setInput(chipText);
    setTimeout(() => {
      const btn = document.getElementById('chat-submit-btn');
      if (btn) btn.click();
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Save user message in Firestore if logged in & Firebase is configured
    if (currentUser && hasFirebaseKeys) {
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'chats'), {
          ...userMessage,
          mode
        });
      } catch (err) {
        console.error("Failed to save chat message:", err);
      }
    }

    try {
      let assistantResponse = {};

      if (!hasFirebaseKeys) {
        // MOCK AI SYSTEM RESPONSE FOR OFFLINE DEMO
        await new Promise(resolve => setTimeout(resolve, 1200));
        const searchKeywords = userMessage.content.toLowerCase();
        
        if (searchKeywords.includes("compare")) {
          assistantResponse = {
            content: "Here is a comparison table comparing our top products:\n\n| Feature | Blue Pottery Vase | Leather Chappal |\n|---|---|---|\n| Price | Rs. 3,450 | Rs. 4,200 |\n| Origin | Multan | Peshawar |\n| Material | Clay & Glaze | Genuine Leather |\n| Rating | ⭐ 4.8 | ⭐ 4.7 |\n| Stock | In Stock | In Stock |\n\nBoth items represent premium Pakistani craftsmanship. The pottery is great for home decor, while the chappal is perfect for traditional attire.",
            products: [
              { id: 'prod-1', name: 'Hand-Painted Blue Pottery Vase', price: 3450, images: ['https://placehold.co/100x100?text=Pottery'], rating: 4.8, reviews: 12, vendor: 'Multani Blue Crafts', stock: 10 },
              { id: 'prod-3', name: 'Leather Peshawari Chappal', price: 4200, images: ['https://placehold.co/100x100?text=Chappal'], rating: 4.7, reviews: 8, vendor: 'Khan Peshawari Shoe', stock: 5 }
            ]
          };
        } else if (searchKeywords.includes("order") || searchKeywords.includes("where is my")) {
          assistantResponse = {
            content: "Sure! I found your latest order details:\n\n**Order ID**: `#ord-mock-201`\n**Merchant**: Multani Blue Crafts\n**Status**: `pending`\n**Total Paid**: Rs. 3,700 (includes Rs. 250 shipping)\n**Delivery address**: Flat 4B, Clifton Heights, Karachi.",
            products: []
          };
        } else if (searchKeywords.includes("recommend") || searchKeywords.includes("should i buy")) {
          assistantResponse = {
            content: "Based on your interest in local crafts, I highly recommend checking out these trending items:",
            products: [
              { id: 'prod-1', name: 'Hand-Painted Blue Pottery Vase', price: 3450, images: ['https://placehold.co/100x100?text=Pottery'], rating: 4.8, reviews: 12, vendor: 'Multani Blue Crafts', stock: 10 },
              { id: 'prod-3', name: 'Leather Peshawari Chappal', price: 4200, images: ['https://placehold.co/100x100?text=Chappal'], rating: 4.7, reviews: 8, vendor: 'Khan Peshawari Shoe', stock: 5 }
            ]
          };
        } else {
          assistantResponse = {
            content: "I searched our local merchant catalog and found these matches for you:",
            products: [
              { id: 'prod-1', name: 'Hand-Painted Blue Pottery Vase', price: 3450, images: ['https://placehold.co/100x100?text=Pottery'], rating: 4.8, reviews: 12, vendor: 'Multani Blue Crafts', stock: 10 },
              { id: 'prod-3', name: 'Leather Peshawari Chappal', price: 4200, images: ['https://placehold.co/100x100?text=Chappal'], rating: 4.7, reviews: 8, vendor: 'Khan Peshawari Shoe', stock: 5 }
            ]
          };
        }
      } else {
        // CALL REAL CLOUD FUNCTION VIA REST API
        let token = "";
        if (currentUser) {
          try {
            token = await currentUser.getIdToken();
          } catch (e) {
            console.warn("Could not get auth token", e);
          }
        }

        const historyPayload = messages
          .concat(userMessage)
          .map(m => ({ role: m.role, content: m.content }));

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            messages: historyPayload,
            mode,
            language
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${response.status}`);
        }

        const result = await response.json();
        assistantResponse = result;
      }

      const assistantMessage = {
        role: 'assistant',
        content: assistantResponse.content,
        products: assistantResponse.products || [],
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant message in Firestore
      if (currentUser && hasFirebaseKeys) {
        try {
          await addDoc(collection(db, 'users', currentUser.uid, 'chats'), {
            ...assistantMessage,
            mode
          });
        } catch (err) {
          console.error("Failed to save assistant chat message:", err);
        }
      }

    } catch (err) {
      console.warn("Cloud Function failed:", err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an issue connecting to the server. Please try again later.',
        createdAt: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setMessages([
      {
        role: 'assistant',
        content: newMode === 'product_discovery' 
          ? 'Describe what you are looking for (e.g. "shawl under 10000 rupees" or "Peshawari chappals"), and I will find matching items from our real merchant catalog!'
          : 'Ask me anything about shipping fees, delivery times, return policies, or payment methods.',
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const SUGGESTED_CHIPS = [
    "Find products under Rs. 5000",
    "Show me gaming laptops",
    "Compare Peshawari Chappal and Pottery",
    "What do you recommend for me?"
  ];

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
      {/* 1. FLOATING CHAT BALLOON BUTTON */}
      {!isOpen && (
        <button 
          onClick={handleOpenWidget}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: '#fff',
            border: 'none',
            boxShadow: 'var(--shadow-hover)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageSquare size={26} />
        </button>
      )}

      {/* 2. CHAT OVERLAY WINDOW */}
      {isOpen && (
        <div className="card flex flex-col" style={{
          width: '380px',
          height: '540px',
          background: 'var(--bg-secondary)',
          boxShadow: 'var(--shadow-hover)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)'
        }}>
          {/* Header */}
          <div style={{
            background: 'var(--bg-dark)',
            color: '#fff',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div className="flex align-center gap-2">
              <div style={{ background: 'var(--primary)', padding: '6px', borderRadius: '50%' }}>
                <Sparkles size={16} />
              </div>
              <div>
                <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700 }}>Vendora AI</h4>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Online Shop Assistant</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.8 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Mode Toggles */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            padding: '8px'
          }}>
            <button
              onClick={() => handleModeChange('product_discovery')}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                backgroundColor: mode === 'product_discovery' ? 'var(--primary)' : 'transparent',
                color: mode === 'product_discovery' ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Sparkles size={12} /> Product Finder
            </button>
            <button
              onClick={() => handleModeChange('buyer_support')}
              style={{
                flex: 1,
                padding: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                backgroundColor: mode === 'buyer_support' ? 'var(--primary)' : 'transparent',
                color: mode === 'buyer_support' ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <HelpCircle size={12} /> Help Center
            </button>
          </div>

          {/* Messages Feed */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: 'var(--bg-primary)'
          }}>
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div key={idx} style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    fontSize: '13.5px',
                    fontFamily: "'Inter', 'Outfit', sans-serif",
                    lineHeight: 1.5,
                    letterSpacing: '-0.01em',
                    color: isUser ? '#fff' : 'var(--text-primary)',
                    backgroundColor: isUser ? 'var(--primary)' : 'var(--bg-secondary)',
                    boxShadow: 'var(--shadow-sm)',
                    border: isUser ? 'none' : '1px solid var(--border-color)',
                    borderBottomRightRadius: isUser ? '2px' : '12px',
                    borderBottomLeftRadius: isUser ? '12px' : '2px'
                  }}>
                    <RenderMarkdown content={msg.content} />
                  </div>
                  
                  {/* Premium Horizontal Carousel for product cards */}
                  {msg.products && msg.products.length > 0 && (
                    <>
                      <div style={{
                        marginTop: '8px',
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '10px',
                        overflowX: 'auto',
                        padding: '4px 2px 8px',
                        width: '320px',
                        scrollbarWidth: 'thin',
                        msOverflowStyle: 'none'
                      }}>
                        {msg.products.map((prod) => (
                          <Link 
                            to={`/product/${prod.id || prod.productId}`} 
                            key={prod.id || prod.productId}
                            onClick={() => handleProductCardClick(prod)} 
                            style={{ textDecoration: 'none', display: 'block' }}
                          >
                            <div className="chat-product-card" style={{ width: '140px', flexShrink: 0 }}>
                              <img src={prod.image || 'https://placehold.co/100x100?text=Product'} alt={prod.name} style={{ height: '90px', objectFit: 'cover' }} />
                              <h5 className="product-name" style={{ fontSize: '11px', margin: '4px 0' }}>{prod.name}</h5>
                              <div className="product-meta" style={{ fontSize: '9px' }}>
                                {prod.vendor && <span>by {prod.vendor}</span>}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                                <span className="price-badge" style={{ fontSize: '11px' }}>Rs. {prod.price.toLocaleString()}</span>
                              </div>
                              <div className="view-btn" style={{ fontSize: '10px', padding: '4px 0' }}>View Details</div>
                            </div>
                          </Link>
                        ))}
                      </div>

                      {msg.products.length >= 2 && (
                        <Link
                          to={`/compare?ids=${msg.products.map(p => p.id || p.productId).join(',')}`}
                          onClick={() => setIsOpen(false)}
                          className="btn btn-secondary flex align-center justify-center gap-1"
                          style={{
                            marginTop: '6px',
                            padding: '5px 12px',
                            fontSize: '11px',
                            borderRadius: 'var(--radius-full)',
                            textDecoration: 'none',
                            color: 'var(--primary)',
                            borderColor: 'var(--primary)',
                            background: 'var(--primary-light)',
                            fontWeight: 600,
                            width: '100%'
                          }}
                        >
                          <Sliders size={12} /> Compare these {msg.products.length} products
                        </Link>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            
            {loading && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Loader className="spin" size={16} />
                <span style={{ fontSize: '11px' }}>AI is typing...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Chips */}
          {messages.length <= 2 && (
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '8px 12px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)'
            }}>
              {SUGGESTED_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--primary-light)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Text Input Footer */}
          <form onSubmit={handleSendMessage} style={{
            padding: '12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            gap: '8px',
            background: 'var(--bg-secondary)'
          }}>
            <input
              type="text"
              placeholder="Ask a question..."
              className="form-input"
              style={{ padding: '8px 12px', fontSize: '13px', borderRadius: 'var(--radius-sm)' }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button 
              id="chat-submit-btn"
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}
              disabled={loading}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
