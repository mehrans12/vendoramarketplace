import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext'; // Alerts integration
import { db, hasFirebaseKeys } from '../services/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import Header from '../components/Header';
import { Package, Clock, MapPin, Loader, Info, Star, X, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { trackEvent } from '../services/analytics/eventTracker';
import { EventTypes } from '../services/analytics/eventTypes';
import ChatModal from '../components/chat/ChatModal';

export default function MyOrders() {
  const { currentUser, userProfile } = useAuth();
  const { sendNotification } = useNotifications(); // Real-time notification dispatch
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review Modal States
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null); // { productId, title, orderId }
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [activeChatOrder, setActiveChatOrder] = useState(null);

  // Mock buyer order history
  const MOCK_ORDERS = [
    {
      id: 'ord-mock-201',
      vendorId: 'mock-vendor-1',
      vendorName: 'Multani Blue Crafts',
      items: [
        { productId: 'prod-1', title: 'Authentic Multani Hand-Painted Blue Pottery Vase', quantity: 1, price: 3450 }
      ],
      total: 3450,
      shippingCost: 250,
      status: 'pending',
      createdAt: new Date().toISOString(),
      shippingAddress: {
        fullName: 'Mehran Ahmed',
        phone: '+92 300 1234567',
        streetAddress: 'Flat 4B, Clifton Heights',
        city: 'Karachi'
      }
    }
  ];

  // 1. Fetch buyer orders in real-time
  useEffect(() => {
    if (!currentUser) return;

    const getLocalOrders = () => {
      const list = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vendora_order_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && data.buyerId === currentUser.uid) {
              list.push(data);
            }
          } catch (e) {}
        }
      }
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    if (!hasFirebaseKeys) {
      setOrders(getLocalOrders());
      setLoading(false);

      const handleStorageChange = () => {
        setOrders(getLocalOrders());
      };
      window.addEventListener('storage', handleStorageChange);

      const interval = setInterval(() => {
        setOrders(getLocalOrders());
      }, 1500);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(interval);
      };
    }

    const ordersQuery = query(
      collection(db, 'orders'),
      where('buyerId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, (querySnap) => {
      const fetched = [];
      querySnap.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() });
      });

      const local = getLocalOrders();
      const merged = [...fetched];
      local.forEach(lo => {
        const exists = merged.some(m => m.id === lo.id || m.orderId === lo.orderId);
        if (!exists) {
          merged.push(lo);
        }
      });
      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setOrders(merged);
      setLoading(false);
    }, (error) => {
      console.error("Error loading buyer orders:", error);
      setOrders(getLocalOrders());
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  // 2. Request cancellation for pending orders
  const handleRequestCancel = async (orderId) => {
    const orderObj = orders.find(o => o.id === orderId);
    if (!orderObj) return;

    if (window.confirm("Do you want to request cancellation for this order?")) {
      trackEvent(EventTypes.ORDER_CANCELLED, {
        productId: orderObj.items?.[0]?.productId || null,
        metadata: {
          orderId,
          total: orderObj.total
        }
      });

      const notifPayload = {
        title: "Cancellation Request",
        message: `Customer requested cancellation for order #${orderId.slice(0, 8)}.`,
        type: "warning",
        orderId
      };

      const updatedOrder = { ...orderObj, status: 'cancellation_requested' };
      try {
        localStorage.setItem(`vendora_order_${orderId}`, JSON.stringify(updatedOrder));
      } catch (e) {}

      if (!hasFirebaseKeys) {
        setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
        alert("Cancellation request sent to vendor!");
        // Simulate sending alert to mock vendor
        sendNotification(orderObj.vendorId || 'mock-vendor-1', notifPayload);
        return;
      }
      try {
        await updateDoc(doc(db, 'orders', orderId), { status: 'cancellation_requested' });
        alert("Cancellation request sent to vendor!");
        
        // Dispatch alert to live vendor
        await sendNotification(orderObj.vendorId, notifPayload);
      } catch (err) {
        console.error("Cancellation request failed:", err);
      }
    }
  };

  // 3. Review trigger dialogs
  const handleOpenReview = (product, orderId) => {
    setSelectedProduct({ ...product, orderId });
    setReviewRating(5);
    setReviewComment('');
    setIsReviewOpen(true);
  };

  const handleCloseReview = () => {
    setIsReviewOpen(false);
    setSelectedProduct(null);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmittingReview(true);

    const reviewData = {
      productId: selectedProduct.productId,
      buyerId: currentUser ? currentUser.uid : 'mock-uid-123',
      buyerName: currentUser ? (userProfile?.name || currentUser.displayName || currentUser.email) : 'Buyer',
      rating: Number(reviewRating),
      comment: reviewComment,
      createdAt: new Date().toISOString()
    };

    if (!hasFirebaseKeys) {
      setTimeout(() => {
        alert("Review submitted successfully in Demo Mode!");
        
        trackEvent(EventTypes.REVIEW_SUBMITTED, {
          productId: selectedProduct.productId,
          metadata: {
            rating: Number(reviewRating),
            comment: reviewComment,
            mode: "demo"
          }
        });

        // Mark order item as reviewed in local state
        setOrders(prev => prev.map(o => {
          if (o.id === selectedProduct.orderId) {
            return {
              ...o,
              items: o.items.map(it => it.productId === selectedProduct.productId ? { ...it, reviewed: true } : it)
            };
          }
          return o;
        }));
        setSubmittingReview(false);
        handleCloseReview();
      }, 1000);
      return;
    }

    try {
      // 1. Save review in reviews collection
      await addDoc(collection(db, 'reviews'), reviewData);

      // 2. Mark order item as reviewed
      const orderRef = doc(db, 'orders', selectedProduct.orderId);
      const orderToUpdate = orders.find(o => o.id === selectedProduct.orderId);
      if (orderToUpdate) {
        const updatedItems = orderToUpdate.items.map(it => 
          it.productId === selectedProduct.productId ? { ...it, reviewed: true } : it
        );
        await updateDoc(orderRef, { items: updatedItems });
      }

      // 3. Track Review Submission
      trackEvent(EventTypes.REVIEW_SUBMITTED, {
        productId: selectedProduct.productId,
        metadata: {
          rating: Number(reviewRating),
          comment: reviewComment
        }
      });

      alert("Thank you for your feedback! Review published.");
      handleCloseReview();
    } catch (err) {
      console.error("Error submitting review:", err);
      alert("Failed to submit review. Try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Helper: Get step active index
  const getStepIndex = (status) => {
    switch (status) {
      case 'pending': return 0;
      case 'confirmed': return 1;
      case 'packaging': return 2;
      case 'shipped': return 3;
      case 'delivered': return 4;
      default: return -1; // cancelled/cancellation_requested
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col align-center justify-center" style={{ minHeight: '100vh', gap: '16px' }}>
        <Loader className="spin" size={48} style={{ color: 'var(--primary)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading order history...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />

      <main className="container flex-grow" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, margin: 0 }}>My Purchase History</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track and manage your incoming marketplace shipments.</p>
        </div>

        {orders.length === 0 ? (
          <div className="card flex flex-col align-center justify-center" style={{ padding: '60px', textAlign: 'center' }}>
            <Package size={64} className="text-muted" style={{ marginBottom: '16px' }} />
            <h3>No orders placed yet</h3>
            <p className="text-muted" style={{ marginBottom: '24px' }}>Once you buy items, your shipment cards will appear here.</p>
            <Link to="/" className="btn btn-primary">Start Shopping</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6" style={{ maxWidth: '850px' }}>
            {orders.map((ord) => {
              const activeIndex = getStepIndex(ord.status);
              const steps = ['Pending', 'Confirmed', 'Packaging', 'Shipped', 'Delivered'];
              
              return (
                <div key={ord.id} className="card" style={{ padding: '24px' }}>
                  {/* Header row */}
                  <div className="flex justify-between align-center flex-wrap gap-2" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
                    <div>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Order ID:</span>
                      <strong style={{ marginLeft: '4px', fontSize: '14px' }}>#{ord.id.slice(0, 8)}</strong>
                      <span style={{ margin: '0 8px', color: 'var(--border-color)' }}>|</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Date: {new Date(ord.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className={`badge ${
                        ord.status === 'pending' ? 'badge-warning' : 
                        ord.status === 'confirmed' ? 'badge-secondary' :
                        ord.status === 'packaging' ? 'badge-info' : 
                        ord.status === 'shipped' ? 'badge-primary' : 
                        ord.status === 'cancellation_requested' ? 'badge-danger' : 
                        ord.status === 'cancelled' ? 'badge-danger' : 'badge-success'
                      }`} style={{ textTransform: 'capitalize' }}>
                        {ord.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* 1. VISUAL TIMELINE TRACKER (Alibaba Premium Style) */}
                  {activeIndex >= 0 && (
                    <div style={{ padding: '0 20px', marginBottom: '32px' }}>
                      <div className="flex justify-between" style={{ position: 'relative', width: '100%' }}>
                        {/* Connecting Line background */}
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          left: '5%',
                          right: '5%',
                          height: '4px',
                          backgroundColor: 'var(--border-color)',
                          zIndex: 0
                        }} />
                        
                        {/* Progress Highlight Line */}
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          left: '5%',
                          width: `${(activeIndex / 4) * 90}%`,
                          height: '4px',
                          backgroundColor: 'var(--primary)',
                          transition: 'width 0.4s ease',
                          zIndex: 0
                        }} />

                        {/* Step Nodes */}
                        {steps.map((step, idx) => {
                          const isActive = idx <= activeIndex;
                          return (
                            <div key={step} className="flex flex-col align-center" style={{ zIndex: 1, position: 'relative' }}>
                              <div style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-secondary)',
                                border: `3px solid ${isActive ? 'var(--primary-light)' : 'var(--border-color)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.3s ease'
                              }}>
                                {isActive && <CheckCircle size={10} style={{ color: '#fff' }} />}
                              </div>
                              <span style={{
                                fontSize: '12px',
                                fontWeight: isActive ? '600' : 'normal',
                                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                marginTop: '8px'
                              }}>
                                {step}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 2. Items & Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
                    {/* Left side: Items */}
                    <div>
                      <h5 style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Merchant: {ord.vendorName}</h5>
                      <div className="flex flex-col gap-4">
                        {ord.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between align-center" style={{ fontSize: '14px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{item.title}</span>
                              {item.variant && <span className="text-muted" style={{ fontSize: '12px', display: 'block' }}>Variant: {item.variant}</span>}
                            </div>
                            
                            <div className="flex align-center gap-4">
                              <span style={{ color: 'var(--text-secondary)' }}>
                                Rs. {item.price.toLocaleString()} x {item.quantity}
                              </span>
                              {/* Trigger Review Prompt for Delivered items */}
                              {ord.status === 'delivered' && (
                                !item.reviewed ? (
                                  <button 
                                    className="btn btn-primary" 
                                    style={{ padding: '4px 10px', fontSize: '11px', borderRadius: 'var(--radius-sm)' }}
                                    onClick={() => handleOpenReview(item, ord.id)}
                                  >
                                    Review
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reviewed</span>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: '16px', paddingTop: '12px', fontSize: '14px' }} className="flex justify-between">
                        <span className="text-secondary">Shipping fee:</span>
                        <span>Rs. {ord.shippingCost || 250}</span>
                      </div>

                      <div style={{ marginTop: '8px', fontSize: '16px' }} className="flex justify-between">
                        <strong style={{ fontWeight: 700 }}>Total Paid (COD):</strong>
                        <strong style={{ color: 'var(--primary)', fontWeight: 800 }}>Rs. {(ord.total + (ord.shippingCost || 250)).toLocaleString()}</strong>
                      </div>
                    </div>

                    {/* Right side: Shipping details & cancellation */}
                    <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                      <h5 className="flex align-center gap-2" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        <MapPin size={16} style={{ color: 'var(--primary)' }} /> Delivery Details
                      </h5>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{ord.shippingAddress?.fullName}</p>
                        <p>{ord.shippingAddress?.streetAddress}</p>
                        <p style={{ textTransform: 'capitalize' }}>{ord.shippingAddress?.city}</p>
                        <p>Phone: {ord.shippingAddress?.phone}</p>
                      </div>

                      {/* Contact Vendor Button */}
                      <button 
                        type="button"
                        className="btn btn-secondary" 
                        style={{ width: '100%', padding: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}
                        onClick={() => setActiveChatOrder(ord)}
                        title="Chat with merchant regarding this order"
                      >
                        <MessageSquare size={14} style={{ color: 'var(--primary)' }} />
                        <span>Contact Vendor</span>
                      </button>

                      {/* Buyer cancellation triggers */}
                      {ord.status === 'pending' && (
                        <button 
                          className="btn btn-secondary" 
                          style={{ width: '100%', padding: '8px', fontSize: '13px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={() => handleRequestCancel(ord.id)}
                        >
                          Cancel Order
                        </button>
                      )}

                      {ord.status === 'cancellation_requested' && (
                        <div className="flex align-center gap-2 text-muted" style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                          <AlertTriangle size={14} style={{ color: 'var(--secondary)' }} />
                          <span>Cancellation review pending.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. SUBMIT REVIEW MODAL OVERLAY */}
        {isReviewOpen && selectedProduct && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '32px', background: 'var(--bg-secondary)', position: 'relative' }}>
              <button 
                onClick={handleCloseReview} 
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>

              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Rate Product</h2>
              <p className="text-muted" style={{ fontSize: '14px', marginBottom: '24px' }}>
                Share your feedback for: <strong>{selectedProduct.title}</strong>
              </p>

              <form onSubmit={handleReviewSubmit}>
                {/* Rating selection (Stars) */}
                <div className="form-group" style={{ alignItems: 'center', marginBottom: '24px' }}>
                  <label className="form-label">Overall Rating</label>
                  <div className="flex gap-2" style={{ color: 'var(--secondary)', cursor: 'pointer', marginTop: '8px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        size={28} 
                        fill={star <= reviewRating ? 'var(--secondary)' : 'none'} 
                        onClick={() => setReviewRating(star)}
                      />
                    ))}
                  </div>
                </div>

                {/* Comment input */}
                <div className="form-group">
                  <label className="form-label">Review Comment</label>
                  <textarea 
                    className="form-textarea" 
                    required 
                    rows="4" 
                    placeholder="Write details about the product quality, shipping, merchant support..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    disabled={submittingReview}
                  />
                </div>

                <div className="flex gap-4" style={{ marginTop: '24px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px' }} disabled={submittingReview}>
                    {submittingReview ? 'Publishing...' : 'Submit Review'}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '12px' }} onClick={handleCloseReview} disabled={submittingReview}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Real-time Order Context Chat Modal */}
        <ChatModal
          isOpen={!!activeChatOrder}
          onClose={() => setActiveChatOrder(null)}
          vendorId={activeChatOrder?.vendorId || 'vendor-default'}
          vendorName={activeChatOrder?.vendorName || 'Artisan Merchant'}
          productId={activeChatOrder?.items?.[0]?.productId || 'prod-general'}
          productTitle={activeChatOrder?.items?.[0]?.title || 'Marketplace Item'}
          productImage={activeChatOrder?.items?.[0]?.image || ''}
          productPrice={activeChatOrder?.items?.[0]?.price || activeChatOrder?.total || 0}
          orderId={activeChatOrder?.id}
        />
      </main>

      <Footer />
    </div>
  );
}
