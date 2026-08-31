import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { validatePakPhone, validatePostalCode, sanitizeText } from '../utils/validation'; // Sanitizer & Checks
import { db, hasFirebaseKeys } from '../services/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { CreditCard, CheckCircle2, Loader, ArrowLeft } from 'lucide-react';
import { trackEvent } from '../services/analytics/eventTracker';
import { EventTypes } from '../services/analytics/eventTypes';
const PAKISTAN_CITIES = [
  "Karachi", "Lahore", "Faisalabad", "Rawalpindi", "Gujranwala", 
  "Peshawar", "Multan", "Hyderabad", "Islamabad", "Quetta", 
  "Abbottabad", "Attock", "Badin", "Bagh", "Bahawalnagar", 
  "Bahawalpur", "Bannu", "Barkhan", "Bhimber", "Burewala", 
  "Chakwal", "Chaman", "Chiniot", "Chitral", "Dadu", 
  "Dera Ghazi Khan", "Dera Ismail Khan", "Dera Murad Jamali", 
  "Gilgit", "Ghotki", "Gojra", "Gujrat", "Gwadar", 
  "Hafizabad", "Hangu", "Haripur", "Hub", "Jacobabad", 
  "Jhang", "Jhelum", "Jaranwala", "Jauharabad", "Kamoke", 
  "Kalat", "Kamalia", "Karak", "Kasur", "Khairpur", 
  "Khanewal", "Kharan", "Khushab", "Khuzdar", "Kohat", 
  "Kotli", "Kotri", "Larkana", "Loralai", "Mandi Bahauddin", 
  "Mansehra", "Mardan", "Mastung", "Mingora", "Mirpur (AJK)", 
  "Mirpur Khas", "Muridke", "Murree", "Muzaffarabad", 
  "Muzaffargarh", "Nawabshah", "New Mirpur City", "Nowshera", 
  "Nushki", "Okara", "Pakpattan", "Panjgur", "Parachinar", 
  "Pasni", "Rahim Yar Khan", "Rawalakot", "Risalpur", 
  "Sadiqabad", "Sahiwal", "Sargodha", "Sheikhupura", 
  "Shikarpur", "Sialkot", "Sibi", "Skardu", "Sukkur", 
  "Swabi", "Tando Adam", "Tank", "Taxila", "Thatta", 
  "Turbat", "Wah Cantonment", "Zhob"
];

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, cartSubtotal, clearCart } = useCart();
  const { currentUser } = useAuth();
  const { sendNotification } = useNotifications();

  // Form States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('Karachi');
  const [postalCode, setPostalCode] = useState('');
  const [error, setError] = useState(''); // Form validation error
  const [loading, setLoading] = useState(false);

  const shipping = cartItems.length > 0 ? 250 : 0;
  const total = cartSubtotal + shipping;

  // Track Checkout Start
  useEffect(() => {
    trackEvent(EventTypes.CHECKOUT_START, {
      metadata: {
        cartItemsCount: cartItems.length,
        subtotal: cartSubtotal,
        productIds: cartItems.map(item => item.id)
      }
    });
  }, []);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    setError('');

    // Strict input checks
    if (!validatePakPhone(phone)) {
      setError('Please enter a valid Pakistani mobile number (e.g. +92 300 1234567 or 03001234567).');
      return;
    }
    if (!validatePostalCode(postalCode)) {
      setError('Please enter a valid 5-digit postal code (e.g. 75500).');
      return;
    }

    const cleanFullName = sanitizeText(fullName.trim());
    const cleanStreetAddress = sanitizeText(streetAddress.trim());
    const cleanPhone = sanitizeText(phone.trim());
    const cleanPostalCode = sanitizeText(postalCode.trim());

    setLoading(true);

    const shippingAddress = {
      fullName: cleanFullName,
      phone: cleanPhone,
      streetAddress: cleanStreetAddress,
      city,
      postalCode: cleanPostalCode
    };

    // If running in mock mode, simulate order placement
    // If running in mock mode, simulate order placement
    if (!hasFirebaseKeys || !currentUser) {
      setTimeout(() => {
        const itemsByVendor = {};
        cartItems.forEach(item => {
          if (!itemsByVendor[item.vendorId]) {
            itemsByVendor[item.vendorId] = [];
          }
          itemsByVendor[item.vendorId].push(item);
        });

        Object.keys(itemsByVendor).forEach(vendorId => {
          const vendorItems = itemsByVendor[vendorId];
          const vendorSubtotal = vendorItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
          const orderId = `ord-mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          const orderData = {
            id: orderId,
            orderId,
            buyerId: currentUser ? currentUser.uid : 'mock-uid-123',
            buyerEmail: currentUser ? currentUser.email : 'buyer@example.com',
            vendorId,
            vendorName: vendorItems[0].vendorName || 'Verified Merchant',
            items: vendorItems.map(it => ({
              productId: it.id,
              title: it.title,
              price: it.price,
              quantity: it.quantity,
              variant: it.variant
            })),
            total: vendorSubtotal,
            shippingCost: 250,
            status: 'pending',
            shippingAddress,
            paymentMethod: 'cod',
            createdAt: new Date().toISOString()
          };

          try {
            localStorage.setItem(`vendora_order_${orderId}`, JSON.stringify(orderData));
          } catch (e) {}

          sendNotification(vendorId, {
            title: "New Order Received",
            message: `You have received a new order #${orderId.slice(0, 8)} from ${cleanFullName}.`,
            type: "success",
            orderId
          });
        });

        alert("Order placed successfully in Demo Mode (Cash on Delivery)!");
        clearCart();
        setLoading(false);
        navigate('/my-orders');
      }, 1200);
      return;
    }

    try {
      // 1. Group items by vendorId to split orders
      const itemsByVendor = {};
      cartItems.forEach(item => {
        if (!itemsByVendor[item.vendorId]) {
          itemsByVendor[item.vendorId] = [];
        }
        itemsByVendor[item.vendorId].push(item);
      });

      // 2. Create an order document per vendor
      const orderPromises = Object.keys(itemsByVendor).map(async (vendorId) => {
        const vendorItems = itemsByVendor[vendorId];
        const vendorSubtotal = vendorItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
        
        // Generate unique order ID
        const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const orderRef = doc(db, 'orders', orderId);

        const orderData = {
          id: orderId,
          orderId,
          buyerId: currentUser.uid,
          buyerEmail: currentUser.email,
          vendorId,
          vendorName: vendorItems[0].vendorName || 'Verified Merchant',
          items: vendorItems.map(it => ({
            productId: it.id,
            title: it.title,
            price: it.price,
            quantity: it.quantity,
            variant: it.variant
          })),
          total: vendorSubtotal,
          shippingCost: 250, // Shipping per vendor package
          status: 'pending',
          shippingAddress,
          paymentMethod: 'cod',
          createdAt: new Date().toISOString()
        };

        try {
          localStorage.setItem(`vendora_order_${orderId}`, JSON.stringify(orderData));
        } catch (e) {}

        await setDoc(orderRef, orderData);
        await sendNotification(vendorId, {
          title: "New Order Received",
          message: `You have received a new order #${orderId.slice(0, 8)} from ${cleanFullName}.`,
          type: "success",
          orderId
        });
      });

      await Promise.all(orderPromises);
      
      // 3. Track Purchase Event
      trackEvent(EventTypes.PURCHASE, {
        metadata: {
          orderIds: orderResults.map(o => o.orderId),
          subtotal: cartSubtotal,
          totalPaid: total,
          itemsCount: cartItems.reduce((acc, item) => acc + item.quantity, 0)
        }
      });

      // 3. Clear shopping cart and redirect
      clearCart();
      alert("Your order has been placed successfully! Vendors will confirm shipment soon.");
      navigate('/my-orders');
    } catch (err) {
      console.error("Order checkout failed:", err);
      alert("Checkout failed. Ensure Firestore rules are deployed.");
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col" style={{ minHeight: '100vh' }}>
        <Header />
        <main className="container flex-grow flex flex-col align-center justify-center" style={{ padding: '80px 0', textAlign: 'center' }}>
          <h3>Checkout is empty</h3>
          <p className="text-muted" style={{ marginBottom: '24px' }}>Please add products to your cart before checking out.</p>
          <Link to="/" className="btn btn-primary">Back to Shop</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        {/* Back Link */}
        <Link to="/cart" className="flex align-center gap-2 text-muted" style={{ marginBottom: '24px', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to cart
        </Link>

        <h1 style={{ fontSize: '28px', margin: '0 0 24px', textAlign: 'left', fontWeight: 700 }}>
          Checkout Securely
        </h1>

        <form onSubmit={handlePlaceOrder} className="checkout-layout-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
          {/* Left Column: Shipping & Payment Form */}
          <div className="flex flex-col gap-6">
            {/* Delivery Address */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                1. Delivery Information
              </h3>

              {error && (
                <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'block', textAlign: 'center' }}>
                  {error}
                </div>
              )}
              
              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="e.g. Mehran Ahmed" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    required 
                    placeholder="e.g. +92 300 1234567" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Street Address</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="Apartment, suite, unit, building, floor, street..." 
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <select 
                    className="form-select" 
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={loading}
                  >
                    {PAKISTAN_CITIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Postal Code (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. 75500" 
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                2. Payment Method
              </h3>

              <div style={{ background: 'var(--primary-light)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'var(--primary)', color: '#fff', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, display: 'block', fontSize: '15px', color: 'var(--primary-hover)' }}>Cash on Delivery (COD)</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>We exclusively provide secure Cash on Delivery nationwide.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Checkout Summary */}
          <div>
            <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                Review Order
              </h3>

              <div className="flex flex-col gap-3" style={{ marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
                {cartItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between" style={{ fontSize: '13px' }}>
                    <span className="text-secondary" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title} (x{item.quantity})
                    </span>
                    <span>Rs. {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '12px', fontSize: '14px' }}>
                <span className="text-secondary">Subtotal</span>
                <span style={{ fontWeight: 600 }}>Rs. {cartSubtotal.toLocaleString()}</span>
              </div>

              <div className="flex justify-between" style={{ marginBottom: '20px', fontSize: '14px' }}>
                <span className="text-secondary">Shipping Cost</span>
                <span style={{ fontWeight: 600 }}>Rs. {shipping.toLocaleString()}</span>
              </div>

              <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '24px' }}>
                <span style={{ fontWeight: 700, fontSize: '16px' }}>Total Amount</span>
                <span style={{ fontWeight: 800, fontSize: '20px', color: 'var(--primary)' }}>Rs. {total.toLocaleString()}</span>
              </div>

              <button type="submit" className="btn btn-accent" style={{ width: '100%', padding: '14px', fontSize: '15px' }} disabled={loading}>
                {loading ? (
                  <span className="flex align-center gap-2 justify-center">
                    <Loader className="spin" size={16} /> Creating Orders...
                  </span>
                ) : (
                  'Confirm & Place Order'
                )}
              </button>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
