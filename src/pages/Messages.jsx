import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeToUserConversations } from '../services/chat/chatService';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import { MessageSquare, ArrowLeft, Loader } from 'lucide-react';

export default function Messages() {
  const { currentUser, role: userRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const selectedConvIdParam = searchParams.get('convId');

  // 1. Subscribe to conversations for user
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const unsubscribe = subscribeToUserConversations(
      { userId: currentUser.uid, role: userRole },
      (convList) => {
        setConversations(convList);
        setLoading(false);

        // Auto-select conversation based on URL query param or maintain active selection
        if (selectedConvIdParam) {
          const match = convList.find(c => (c.id === selectedConvIdParam || c.conversationId === selectedConvIdParam));
          if (match) {
            setActiveConversation(match);
            setShowMobileChat(true);
          }
        } else if (!activeConversation && convList.length > 0 && window.innerWidth > 768) {
          setActiveConversation(convList[0]);
        }
      },
      (err) => {
        console.warn('Error loading conversations:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, userRole, selectedConvIdParam]);

  // 2. Select conversation handler
  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    setShowMobileChat(true);
    const id = conv.id || conv.conversationId;
    setSearchParams({ convId: id });
  };

  // 3. Back to list on mobile
  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <Header />

      <main className="container flex-grow" style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
        {/* Page Title & Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {showMobileChat && (
              <button
                type="button"
                onClick={handleBackToList}
                className="btn btn-secondary md-hidden"
                style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={22} style={{ color: 'var(--primary)' }} />
              <span>Marketplace Messages</span>
            </h2>
          </div>

          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
          </span>
        </div>

        {/* Dual-Pane Chat Hub Container */}
        <div 
          className="card" 
          style={{
            flex: 1,
            minHeight: '620px',
            maxHeight: '800px',
            padding: 0,
            display: 'flex',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)'
          }}
        >
          {/* Left Pane: Conversation List */}
          <div style={{
            width: '340px',
            minWidth: '280px',
            display: showMobileChat && window.innerWidth <= 768 ? 'none' : 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversation?.id || activeConversation?.conversationId}
              onSelectConversation={handleSelectConversation}
              loading={loading}
            />
          </div>

          {/* Right Pane: Active Chat Window */}
          <div style={{
            flex: 1,
            display: !showMobileChat && window.innerWidth <= 768 ? 'none' : 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: 'var(--bg-primary)'
          }}>
            <ChatWindow 
              conversation={activeConversation} 
              onStatusChange={(newStatus) => {
                setActiveConversation(prev => prev ? { ...prev, status: newStatus } : null);
              }}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
