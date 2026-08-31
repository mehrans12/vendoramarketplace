import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext'; // Real-time Toasts & Feeds
import { LanguageProvider } from './context/LanguageContext';
import { CompareProvider } from './context/CompareContext';
import ProtectedRoute from './components/ProtectedRoute';
import ChatWidget from './components/ChatWidget';

import { Loader } from 'lucide-react';

// Pages imports (Lazy Loaded)
const Home = React.lazy(() => import('./pages/Home'));
const CategoryListing = React.lazy(() => import('./pages/CategoryListing'));
const ProductDetail = React.lazy(() => import('./pages/ProductDetail'));
const Compare = React.lazy(() => import('./pages/Compare'));
const Cart = React.lazy(() => import('./pages/Cart'));
const Checkout = React.lazy(() => import('./pages/Checkout'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const VendorDashboard = React.lazy(() => import('./pages/VendorDashboard'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const Profile = React.lazy(() => import('./pages/Profile'));
const MyOrders = React.lazy(() => import('./pages/MyOrders'));
const Messages = React.lazy(() => import('./pages/Messages'));
const NotFound = React.lazy(() => import('./pages/NotFound'));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const MerchantGuidelines = React.lazy(() => import('./pages/MerchantGuidelines'));

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <NotificationProvider>
            <CompareProvider>
              <Router>
                <React.Suspense fallback={
                  <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                    <Loader className="spin" size={48} style={{ color: 'var(--primary)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading Vendora...</p>
                  </div>
                }>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/category/:slug" element={<CategoryListing />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/compare" element={<Compare />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              
              {/* Protected User Profile (Buyer & Vendor Unified View) */}
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute allowedRoles={['buyer', 'vendor', 'admin']}>
                    <Profile />
                  </ProtectedRoute>
                } 
              />

              {/* Protected Buyer Orders */}
              <Route 
                path="/my-orders" 
                element={
                  <ProtectedRoute allowedRoles={['buyer', 'vendor', 'admin']}>
                    <MyOrders />
                  </ProtectedRoute>
                } 
              />

              {/* Protected Real-Time Messages */}
              <Route 
                path="/messages" 
                element={
                  <ProtectedRoute allowedRoles={['buyer', 'vendor', 'admin']}>
                    <Messages />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/messages/:conversationId" 
                element={
                  <ProtectedRoute allowedRoles={['buyer', 'vendor', 'admin']}>
                    <Messages />
                  </ProtectedRoute>
                } 
              />

              {/* Protected Vendor Dashboard */}
              <Route 
                path="/vendor/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['vendor']}>
                    <VendorDashboard />
                  </ProtectedRoute>
                } 
              />
              
              {/* Protected Admin Dashboard */}
              <Route 
                path="/admin/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              
              {/* Policy & Legal Pages */}
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/policies/vendor" element={<MerchantGuidelines />} />

              {/* Fallback 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </React.Suspense>
            
            {/* Floating Chat Widget for AI Assistant */}
            <ChatWidget />
          </Router>
          </CompareProvider>
        </NotificationProvider>
      </CartProvider>
    </AuthProvider>
  </LanguageProvider>
  );
}

export default App;
