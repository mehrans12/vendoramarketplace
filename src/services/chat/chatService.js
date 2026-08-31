import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { db, hasFirebaseKeys } from '../firebase';
import { trackEvent } from '../analytics/eventTracker';
import { EventTypes } from '../analytics/eventTypes';

// Local storage key for offline conversation synchronization
const LOCAL_CONVERSATIONS_KEY = 'vendora_marketplace_conversations';
const LOCAL_MESSAGES_KEY_PREFIX = 'vendora_chat_msgs_';

/**
 * Deterministically generates a conversation ID based on context.
 */
export function generateConversationId(buyerId, vendorId, productId, orderId = null) {
  const base = `conv_${buyerId}_${vendorId}_${productId}`;
  return orderId ? `${base}_${orderId}` : base;
}

/**
 * Helper to get local mock conversations
 */
function getLocalConversations() {
  try {
    const raw = localStorage.getItem(LOCAL_CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Helper to save local mock conversations
 */
function saveLocalConversations(convs) {
  try {
    localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(convs));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}
}

/**
 * Helper to get local mock messages for a conversation
 */
function getLocalMessages(conversationId) {
  try {
    const raw = localStorage.getItem(`${LOCAL_MESSAGES_KEY_PREFIX}${conversationId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Helper to save local mock messages
 */
function saveLocalMessages(conversationId, msgs) {
  try {
    localStorage.setItem(`${LOCAL_MESSAGES_KEY_PREFIX}${conversationId}`, JSON.stringify(msgs));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}
}

/**
 * Fallback local conversation generator.
 */
function getOrCreateLocalConversation({
  conversationId,
  buyerId,
  buyerName,
  buyerEmail,
  vendorId,
  vendorName,
  productId,
  productTitle,
  productImage,
  productPrice,
  orderId = null,
  initialMessageText = null
}) {
  const localConvs = getLocalConversations();
  let existing = localConvs.find(c => c.id === conversationId || c.conversationId === conversationId);

  if (!existing) {
    existing = {
      id: conversationId,
      conversationId,
      buyerId,
      buyerName: buyerName || 'Buyer',
      buyerEmail: buyerEmail || '',
      vendorId,
      vendorName: vendorName || 'Artisan Merchant',
      productId,
      productTitle: typeof productTitle === 'object' ? (productTitle.en || Object.values(productTitle)[0]) : (productTitle || 'Product'),
      productImage: productImage || '',
      productPrice: Number(productPrice) || 0,
      orderId: orderId || null,
      status: 'OPEN',
      assignedAdminId: 'admin-support-1',
      assignedAdminEmail: 'support@vendora.pk',
      buyerUnreadCount: 0,
      vendorUnreadCount: initialMessageText ? 1 : 0,
      adminUnreadCount: 0,
      lastMessageText: initialMessageText || 'Conversation started.',
      lastMessageSenderId: buyerId,
      lastMessageSenderRole: 'BUYER',
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localConvs.unshift(existing);
    saveLocalConversations(localConvs);

    // Initial system message
    const initialMsgs = [
      {
        id: `msg-sys-${Date.now()}`,
        conversationId,
        senderId: 'SYSTEM',
        senderName: 'Vendora Marketplace',
        senderRole: 'SYSTEM',
        text: `Conversation initialized regarding: ${existing.productTitle}${orderId ? ` (Order #${orderId})` : ''}.`,
        messageType: 'SYSTEM',
        isRead: true,
        createdAt: new Date(Date.now() - 1000).toISOString()
      }
    ];

    if (initialMessageText) {
      initialMsgs.push({
        id: `msg-${Date.now()}`,
        conversationId,
        senderId: buyerId,
        senderName: buyerName || 'Buyer',
        senderRole: 'BUYER',
        text: initialMessageText,
        messageType: 'TEXT',
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }

    saveLocalMessages(conversationId, initialMsgs);
  }

  return existing;
}

/**
 * Creates or retrieves an existing deterministic conversation between Buyer and Vendor.
 */
export async function getOrCreateConversation({
  buyerId,
  buyerName,
  buyerEmail,
  vendorId,
  vendorName,
  productId,
  productTitle,
  productImage,
  productPrice,
  orderId = null,
  initialMessageText = null
}) {
  const safeBuyerId = buyerId || 'guest-buyer';
  const safeVendorId = vendorId || 'vendor-default';
  const safeProductId = productId || 'prod-general';

  const conversationId = generateConversationId(safeBuyerId, safeVendorId, safeProductId, orderId);

  // 1. Always create / sync local conversation first for immediate resilience
  const localConv = getOrCreateLocalConversation({
    conversationId,
    buyerId: safeBuyerId,
    buyerName,
    buyerEmail,
    vendorId: safeVendorId,
    vendorName,
    productId: safeProductId,
    productTitle,
    productImage,
    productPrice,
    orderId,
    initialMessageText
  });

  // 2. If Firebase is not configured, return local immediately
  if (!hasFirebaseKeys || !db) {
    trackEvent(EventTypes.CHAT_OPEN || 'CHAT_OPEN', {
      conversationId,
      productId: safeProductId,
      vendorId: safeVendorId,
      buyerId: safeBuyerId
    });
    return localConv;
  }

  // 3. Attempt Firestore Sync with graceful catch
  try {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);

    if (convSnap.exists()) {
      const data = { id: convSnap.id, ...convSnap.data() };
      // Sync local
      const localConvs = getLocalConversations();
      const idx = localConvs.findIndex(c => c.id === conversationId);
      if (idx !== -1) localConvs[idx] = data;
      else localConvs.unshift(data);
      saveLocalConversations(localConvs);
      return data;
    }

    const newConversation = {
      conversationId,
      buyerId: safeBuyerId,
      buyerName: buyerName || 'Buyer',
      buyerEmail: buyerEmail || '',
      vendorId: safeVendorId,
      vendorName: vendorName || 'Artisan Merchant',
      productId: safeProductId,
      productTitle: typeof productTitle === 'object' ? (productTitle.en || Object.values(productTitle)[0]) : (productTitle || 'Product'),
      productImage: productImage || '',
      productPrice: Number(productPrice) || 0,
      orderId: orderId || null,
      status: 'OPEN',
      assignedAdminId: 'admin-default',
      assignedAdminEmail: 'support@vendora.pk',
      buyerUnreadCount: 0,
      vendorUnreadCount: initialMessageText ? 1 : 0,
      adminUnreadCount: 0,
      lastMessageText: initialMessageText || 'Conversation started.',
      lastMessageSenderId: safeBuyerId,
      lastMessageSenderRole: 'BUYER',
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(convRef, newConversation);

    // Add initial system message
    const msgColRef = collection(db, 'conversations', conversationId, 'messages');
    await addDoc(msgColRef, {
      conversationId,
      senderId: 'SYSTEM',
      senderName: 'Vendora Marketplace',
      senderRole: 'SYSTEM',
      text: `Conversation initialized regarding product: ${newConversation.productTitle}${orderId ? ` (Order #${orderId})` : ''}.`,
      messageType: 'SYSTEM',
      isRead: true,
      createdAt: new Date(Date.now() - 1000).toISOString()
    });

    if (initialMessageText) {
      await addDoc(msgColRef, {
        conversationId,
        senderId: safeBuyerId,
        senderName: buyerName || 'Buyer',
        senderRole: 'BUYER',
        text: initialMessageText,
        messageType: 'TEXT',
        isRead: false,
        createdAt: new Date().toISOString()
      });
    }

    trackEvent(EventTypes.CHAT_OPEN || 'CHAT_OPEN', {
      conversationId,
      productId: safeProductId,
      vendorId: safeVendorId,
      buyerId: safeBuyerId
    });

    return { id: conversationId, ...newConversation };
  } catch (err) {
    console.warn('Firestore conversation creation fallback to local:', err.message);
    return localConv;
  }
}

/**
 * Subscribes in real-time to conversations for a user based on their role (Buyer, Vendor, or Admin).
 */
export function subscribeToUserConversations({ userId, role }, onData, onError) {
  if (!userId) return () => {};

  const fetchLocal = () => {
    const all = getLocalConversations();
    let filtered = [];
    if (role === 'admin') {
      filtered = all;
    } else if (role === 'vendor') {
      filtered = all.filter(c => c.vendorId === userId);
    } else {
      filtered = all.filter(c => c.buyerId === userId);
    }
    filtered.sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt));
    return filtered;
  };

  // 1. If Firebase is offline or not configured
  if (!hasFirebaseKeys || !db) {
    onData(fetchLocal());
    const handleStorage = () => onData(fetchLocal());
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(() => onData(fetchLocal()), 1500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }

  // 2. Real-time Firestore Listener with local fallback
  try {
    let q;
    if (role === 'admin') {
      q = query(
        collection(db, 'conversations'),
        orderBy('lastMessageAt', 'desc'),
        limit(100)
      );
    } else if (role === 'vendor') {
      q = query(
        collection(db, 'conversations'),
        where('vendorId', '==', userId),
        orderBy('lastMessageAt', 'desc'),
        limit(100)
      );
    } else {
      q = query(
        collection(db, 'conversations'),
        where('buyerId', '==', userId),
        orderBy('lastMessageAt', 'desc'),
        limit(100)
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const convs = [];
      snapshot.forEach(doc => {
        convs.push({ id: doc.id, ...doc.data() });
      });

      // Merge with any local offline conversations
      const local = fetchLocal();
      const mergedMap = new Map();
      convs.forEach(c => mergedMap.set(c.id || c.conversationId, c));
      local.forEach(c => {
        const id = c.id || c.conversationId;
        if (!mergedMap.has(id)) mergedMap.set(id, c);
      });

      const mergedList = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt)
      );

      onData(mergedList);
    }, (err) => {
      console.warn('Conversations listener error, using local fallback:', err.message);
      onData(fetchLocal());
    });

    const handleStorage = () => onData(fetchLocal());
    window.addEventListener('storage', handleStorage);

    return () => {
      unsub();
      window.removeEventListener('storage', handleStorage);
    };
  } catch (err) {
    console.warn('Failed to subscribe to conversations, using local:', err);
    onData(fetchLocal());
    const handleStorage = () => onData(fetchLocal());
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }
}

/**
 * Subscribes in real-time to a specific conversation document.
 */
export function subscribeToConversation(conversationId, onData, onError) {
  if (!conversationId) return () => {};

  const fetchLocal = () => {
    const all = getLocalConversations();
    return all.find(c => c.id === conversationId || c.conversationId === conversationId);
  };

  if (!hasFirebaseKeys || !db) {
    const found = fetchLocal();
    if (found) onData(found);

    const handleStorage = () => {
      const f = fetchLocal();
      if (f) onData(f);
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 1500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }

  try {
    const docRef = doc(db, 'conversations', conversationId);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        onData({ id: docSnap.id, ...docSnap.data() });
      } else {
        const f = fetchLocal();
        if (f) onData(f);
      }
    }, (err) => {
      const f = fetchLocal();
      if (f) onData(f);
    });
  } catch (err) {
    const f = fetchLocal();
    if (f) onData(f);
    return () => {};
  }
}

/**
 * Subscribes in real-time to messages of a conversation.
 */
export function subscribeToMessages(conversationId, onData, onError, messageLimit = 50) {
  if (!conversationId) return () => {};

  const fetchLocal = () => {
    const msgs = getLocalMessages(conversationId);
    return msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  };

  if (!hasFirebaseKeys || !db) {
    onData(fetchLocal());
    const handleStorage = () => onData(fetchLocal());
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(() => onData(fetchLocal()), 1200);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }

  try {
    const msgCol = collection(db, 'conversations', conversationId, 'messages');
    const q = query(msgCol, orderBy('createdAt', 'asc'), limit(messageLimit));

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach(doc => {
        msgs.push({ id: doc.id, ...doc.data() });
      });

      // Merge local and firestore
      const local = fetchLocal();
      const msgMap = new Map();
      local.forEach(m => msgMap.set(m.id, m));
      msgs.forEach(m => msgMap.set(m.id, m));

      const merged = Array.from(msgMap.values()).sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      onData(merged);
    }, (err) => {
      console.warn('Messages snapshot listener error, using local fallback:', err.message);
      onData(fetchLocal());
    });

    const handleStorage = () => onData(fetchLocal());
    window.addEventListener('storage', handleStorage);

    return () => {
      unsub();
      window.removeEventListener('storage', handleStorage);
    };
  } catch (err) {
    onData(fetchLocal());
    const handleStorage = () => onData(fetchLocal());
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }
}

/**
 * Sends a message in a conversation.
 */
export async function sendMessage({
  conversationId,
  senderId,
  senderName,
  senderRole, // 'BUYER' | 'VENDOR' | 'ADMIN' | 'SYSTEM'
  text,
  attachmentUrls = [],
  messageType = 'TEXT'
}) {
  if (!conversationId || !senderId || (!text && attachmentUrls.length === 0)) {
    throw new Error('Invalid message payload: text or attachments required.');
  }

  const cleanText = (text || '').trim();
  const now = new Date().toISOString();

  // Always update local state first
  const newMsg = {
    id: `msg-${Date.now()}`,
    conversationId,
    senderId,
    senderName: senderName || (senderRole === 'ADMIN' ? 'Vendora Support' : senderRole),
    senderRole,
    text: cleanText,
    attachmentUrls,
    messageType,
    isRead: false,
    createdAt: now,
    editedAt: null,
    deletedAt: null
  };

  const msgs = getLocalMessages(conversationId);
  msgs.push(newMsg);
  saveLocalMessages(conversationId, msgs);

  // Update local conversation metadata
  const convs = getLocalConversations();
  const idx = convs.findIndex(c => c.id === conversationId || c.conversationId === conversationId);
  if (idx !== -1) {
    const c = convs[idx];
    c.lastMessageText = cleanText || (attachmentUrls.length > 0 ? '📷 Attachment' : 'Message');
    c.lastMessageSenderId = senderId;
    c.lastMessageSenderRole = senderRole;
    c.lastMessageAt = now;
    c.updatedAt = now;

    if (senderRole === 'BUYER') {
      c.vendorUnreadCount = (c.vendorUnreadCount || 0) + 1;
      c.status = c.status === 'CLOSED' ? 'OPEN' : 'PENDING_VENDOR';
    } else if (senderRole === 'VENDOR') {
      c.buyerUnreadCount = (c.buyerUnreadCount || 0) + 1;
      c.status = 'PENDING_BUYER';
    } else if (senderRole === 'ADMIN') {
      c.buyerUnreadCount = (c.buyerUnreadCount || 0) + 1;
      c.vendorUnreadCount = (c.vendorUnreadCount || 0) + 1;
      c.status = 'PENDING_ADMIN';
    }

    convs.splice(idx, 1);
    convs.unshift(c);
    saveLocalConversations(convs);
  }

  trackEvent(EventTypes.MESSAGE_SENT || 'MESSAGE_SENT', {
    conversationId,
    senderId,
    senderRole
  });

  // Attempt Firestore sync if configured
  if (hasFirebaseKeys && db) {
    try {
      const msgColRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(msgColRef, newMsg);

      const convRef = doc(db, 'conversations', conversationId);
      const updatePayload = {
        lastMessageText: cleanText || (attachmentUrls.length > 0 ? '📷 Attachment' : 'Message'),
        lastMessageSenderId: senderId,
        lastMessageSenderRole: senderRole,
        lastMessageAt: now,
        updatedAt: now
      };

      if (senderRole === 'BUYER') {
        updatePayload.vendorUnreadCount = increment(1);
        updatePayload.status = 'PENDING_VENDOR';
      } else if (senderRole === 'VENDOR') {
        updatePayload.buyerUnreadCount = increment(1);
        updatePayload.status = 'PENDING_BUYER';
      } else if (senderRole === 'ADMIN') {
        updatePayload.buyerUnreadCount = increment(1);
        updatePayload.vendorUnreadCount = increment(1);
        updatePayload.status = 'PENDING_ADMIN';
      }

      await updateDoc(convRef, updatePayload);
    } catch (err) {
      console.warn('Firestore sendMessage sync notice (kept locally):', err.message);
    }
  }

  return newMsg;
}

/**
 * Marks conversation unread counts as 0 for the viewing user's role.
 */
export async function markConversationAsRead({ conversationId, userId, role }) {
  if (!conversationId || !userId) return;

  const convs = getLocalConversations();
  const c = convs.find(c => c.id === conversationId || c.conversationId === conversationId);
  if (c) {
    if (role === 'buyer') c.buyerUnreadCount = 0;
    else if (role === 'vendor') c.vendorUnreadCount = 0;
    else if (role === 'admin') c.adminUnreadCount = 0;
    saveLocalConversations(convs);
  }

  if (hasFirebaseKeys && db) {
    try {
      const convRef = doc(db, 'conversations', conversationId);
      const updatePayload = {};
      if (role === 'buyer') updatePayload.buyerUnreadCount = 0;
      else if (role === 'vendor') updatePayload.vendorUnreadCount = 0;
      else if (role === 'admin') updatePayload.adminUnreadCount = 0;
      await updateDoc(convRef, updatePayload);
    } catch (err) {}
  }
}

/**
 * Administrative: Updates conversation status (e.g. RESOLVED, CLOSED, BLOCKED, OPEN).
 */
export async function updateConversationStatus({ conversationId, status, adminId, adminEmail, notes = '' }) {
  if (!conversationId || !status) throw new Error('conversationId and status are required');

  const now = new Date().toISOString();

  const convs = getLocalConversations();
  const c = convs.find(c => c.id === conversationId || c.conversationId === conversationId);
  if (c) {
    c.status = status;
    c.updatedAt = now;
    if (status === 'RESOLVED' || status === 'CLOSED') c.closedAt = now;
    saveLocalConversations(convs);

    const msgs = getLocalMessages(conversationId);
    msgs.push({
      id: `msg-sys-${Date.now()}`,
      conversationId,
      senderId: 'SYSTEM',
      senderName: 'Vendora Support',
      senderRole: 'SYSTEM',
      text: `Conversation status updated to ${status}${notes ? `: "${notes}"` : '.'}`,
      messageType: 'SYSTEM',
      isRead: true,
      createdAt: now
    });
    saveLocalMessages(conversationId, msgs);
  }

  if (hasFirebaseKeys && db) {
    try {
      const convRef = doc(db, 'conversations', conversationId);
      const payload = { status, updatedAt: now };
      if (status === 'RESOLVED' || status === 'CLOSED') payload.closedAt = now;
      await updateDoc(convRef, payload);

      const msgCol = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(msgCol, {
        conversationId,
        senderId: 'SYSTEM',
        senderName: 'Vendora Support',
        senderRole: 'SYSTEM',
        text: `Conversation status updated to ${status}${notes ? `: "${notes}"` : '.'}`,
        messageType: 'SYSTEM',
        isRead: true,
        createdAt: now
      });
    } catch (err) {
      console.warn('Firestore update status notice:', err.message);
    }
  }
}

/**
 * Administrative: Assigns support staff / admin to a conversation.
 */
export async function assignAdminToConversation({ conversationId, adminId, adminEmail }) {
  if (!conversationId || !adminId) throw new Error('conversationId and adminId are required');

  const now = new Date().toISOString();
  const convs = getLocalConversations();
  const c = convs.find(c => c.id === conversationId || c.conversationId === conversationId);
  if (c) {
    c.assignedAdminId = adminId;
    c.assignedAdminEmail = adminEmail || 'support@vendora.pk';
    c.assignedAt = now;
    saveLocalConversations(convs);
  }

  if (hasFirebaseKeys && db) {
    try {
      const convRef = doc(db, 'conversations', conversationId);
      await updateDoc(convRef, {
        assignedAdminId: adminId,
        assignedAdminEmail: adminEmail || 'support@vendora.pk',
        assignedAt: now
      });
    } catch (err) {}
  }
}

/**
 * Report an abusive conversation to Marketplace Safety & Trust.
 */
export async function reportConversation({
  conversationId,
  reporterId,
  reporterRole,
  reason,
  details = ''
}) {
  if (!conversationId || !reporterId) throw new Error('conversationId and reporterId required');

  const now = new Date().toISOString();
  const convs = getLocalConversations();
  const c = convs.find(c => c.id === conversationId || c.conversationId === conversationId);
  if (c) {
    c.isReported = true;
    c.reportReason = reason;
    c.reportedAt = now;
    saveLocalConversations(convs);
  }

  if (hasFirebaseKeys && db) {
    try {
      const convRef = doc(db, 'conversations', conversationId);
      await updateDoc(convRef, {
        isReported: true,
        reportReason: reason,
        reportedBy: reporterId,
        reportedByRole: reporterRole,
        reportDetails: details,
        reportedAt: now
      });

      await addDoc(collection(db, 'fraud_events'), {
        eventId: `chat-rep-${Date.now()}`,
        entityId: conversationId,
        entityType: 'conversation',
        entityName: `Chat Report: ${reason}`,
        riskScore: 75,
        level: 'HIGH',
        flags: ['USER_CHAT_REPORT', reason],
        status: 'UNDER_REVIEW',
        reporterId,
        details,
        createdAt: now
      });
    } catch (err) {}
  }

  return true;
}

/**
 * Soft deletes a message (displays "Message deleted").
 */
export async function softDeleteMessage({ conversationId, messageId, userId }) {
  if (!conversationId || !messageId) return;

  const now = new Date().toISOString();
  const msgs = getLocalMessages(conversationId);
  const m = msgs.find(msg => msg.id === messageId);
  if (m && (m.senderId === userId || userId === 'admin')) {
    m.deletedAt = now;
    m.text = 'This message was deleted.';
    saveLocalMessages(conversationId, msgs);
  }

  if (hasFirebaseKeys && db) {
    try {
      const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(msgRef, {
        deletedAt: now,
        text: 'This message was deleted.'
      });
    } catch (err) {}
  }
}
