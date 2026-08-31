import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Trash2, ArrowRight, ShoppingBag, Plus, Minus } from 'lucide-react';
import { FrequentlyBoughtTogether } from '../components/recommendations/widgets';

export default function Cart() {
  const { cartItems, updateQuantity, removeFromCart, cartSubtotal } = useCart();
  
  const shipping = cartItems.length > 0 ? 250 : 0; // Standard shipping rate in PKR
  const total = cartSubtotal + shipping;

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', margin: '0 0 24px', textAlign: 'left', fontWeight: 700 }}>
          Your Shopping Cart
        </h1>

        {cartItems.length === 0 ? (
          <div className="card flex flex-col align-center justify-center" style={{ padding: '60px', textAlign: 'center' }}>
            <ShoppingBag size={64} className="text-muted" style={{ marginBottom: '16px' }} />
            <h3>Your cart is empty</h3>
            <p className="text-muted" style={{ marginBottom: '24px' }}>Looks like you haven't added any products to your cart yet.</p>
            <Link to="/" className="btn btn-primary">Start Shopping</Link>
          </div>
        ) : (
          <div className="cart-layout-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
            {/* Left Column: Cart Items List */}
            <div className="flex flex-col gap-4">
              {cartItems.map((item) => (
                <div key={`${item.id}-${item.variant}`} className="card cart-item-card flex align-center justify-between" style={{ padding: '16px' }}>
                  <div className="flex align-center gap-4">
                    <img src={item.image} alt={item.title} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 600 }}>
                        <Link to={`/product/${item.id}`}>{item.title}</Link>
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Variant: {item.variant}</p>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
                        Rs. {item.price.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex align-center gap-6">
                    {/* Quantity selectors */}
                    <div className="flex align-center gap-2">
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 8px' }}
                        onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 8px' }}
                        onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    
                    {/* Action button */}
                    <button 
                      className="btn-icon" 
                      style={{ borderColor: 'transparent', color: 'var(--danger)' }} 
                      onClick={() => removeFromCart(item.id, item.variant)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: Order Summary */}
            <div>
              <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', position: 'sticky', top: '100px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  Order Summary
                </h3>

                <div className="flex justify-between" style={{ marginBottom: '12px', fontSize: '14px' }}>
                  <span className="text-secondary">Subtotal ({cartItems.length} types)</span>
                  <span style={{ fontWeight: 600 }}>Rs. {cartSubtotal.toLocaleString()}</span>
                </div>

                <div className="flex justify-between" style={{ marginBottom: '20px', fontSize: '14px' }}>
                  <span className="text-secondary">Shipping (Pakistan Standard)</span>
                  <span style={{ fontWeight: 600 }}>Rs. {shipping.toLocaleString()}</span>
                </div>

                <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '24px' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px' }}>Total</span>
                  <span style={{ fontWeight: 800, fontSize: '20px', color: 'var(--primary)' }}>Rs. {total.toLocaleString()}</span>
                </div>

                <Link to="/checkout" className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
                  Proceed to Checkout <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Frequently Bought Together */}
      {cartItems.length > 0 && (
        <div className="container" style={{ paddingBottom: '48px' }}>
          <FrequentlyBoughtTogether limit={6} />
        </div>
      )}

      <Footer />
    </div>
  );
}
