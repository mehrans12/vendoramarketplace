const admin = require('firebase-admin');

// In-memory rate limiting map for chat messages: userId -> array of timestamps
const messageRateMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 35;

/**
 * Checks rate limiting for chat messaging.
 */
function isRateLimited(userId) {
  const now = Date.now();
  const timestamps = messageRateMap.get(userId) || [];
  const validTimestamps = timestamps.filter(ts => (now - ts) < RATE_LIMIT_WINDOW_MS);
  
  if (validTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
    messageRateMap.set(userId, validTimestamps);
    return true;
  }

  validTimestamps.push(now);
  messageRateMap.set(userId, validTimestamps);
  return false;
}

/**
 * Deterministic conversation ID generator.
 */
function generateConversationId(buyerId, vendorId, productId, orderId = null) {
  const base = `conv_${buyerId}_${vendorId}_${productId}`;
  return orderId ? `${base}_${orderId}` : base;
}

/**
 * Cloud Function Handler: Create or get conversation with server-side validation.
 */
async function handleCreateOrGetConversation(data, context) {
  if (!context.auth) {
    throw new Error('Authentication required.');
  }

  const buyerId = context.auth.uid;
  const { vendorId, productId, orderId, productTitle, productImage, productPrice, vendorName, initialMessage } = data;

  if (!vendorId || !productId) {
    throw new Error('vendorId and productId are required.');
  }

  const db = admin.firestore();
  const convId = generateConversationId(buyerId, vendorId, productId, orderId);
  const convRef = db.collection('conversations').doc(convId);
  const convSnap = await convRef.get();

  if (convSnap.exists) {
    return { success: true, conversation: { id: convSnap.id, ...convSnap.data() } };
  }

  // Fetch buyer profile
  let buyerName = 'Buyer';
  let buyerEmail = context.auth.token?.email || '';
  try {
    const userSnap = await db.collection('users').doc(buyerId).get();
    if (userSnap.exists) {
      const uData = userSnap.data();
      buyerName = uData.name || uData.displayName || buyerName;
    }
  } catch (e) {}

  const now = new Date().toISOString();
  const newConversation = {
    conversationId: convId,
    buyerId,
    buyerName,
    buyerEmail,
    vendorId,
    vendorName: vendorName || 'Vendor Merchant',
    productId,
    productTitle: typeof productTitle === 'object' ? (productTitle.en || Object.values(productTitle)[0]) : (productTitle || 'Product'),
    productImage: productImage || '',
    productPrice: Number(productPrice) || 0,
    orderId: orderId || null,
    status: 'OPEN',
    assignedAdminId: 'admin-default',
    assignedAdminEmail: 'support@vendora.pk',
    buyerUnreadCount: 0,
    vendorUnreadCount: initialMessage ? 1 : 0,
    adminUnreadCount: 0,
    lastMessageText: initialMessage || 'Conversation started.',
    lastMessageSenderId: buyerId,
    lastMessageSenderRole: 'BUYER',
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now
  };

  await convRef.set(newConversation);

  // Add system message
  const msgCol = convRef.collection('messages');
  await msgCol.add({
    conversationId: convId,
    senderId: 'SYSTEM',
    senderName: 'Vendora Marketplace',
    senderRole: 'SYSTEM',
    text: `Conversation initialized regarding product: ${newConversation.productTitle}${orderId ? ` (Order #${orderId})` : ''}.`,
    messageType: 'SYSTEM',
    isRead: true,
    createdAt: now
  });

  if (initialMessage) {
    await msgCol.add({
      conversationId: convId,
      senderId: buyerId,
      senderName: buyerName,
      senderRole: 'BUYER',
      text: String(initialMessage).trim().slice(0, 2000),
      messageType: 'TEXT',
      isRead: false,
      createdAt: now
    });
  }

  return { success: true, conversation: { id: convId, ...newConversation } };
}

/**
 * Cloud Function Handler: Send message with rate limiting and server validation.
 */
async function handleSendChatMessage(data, context) {
  if (!context.auth) {
    throw new Error('Authentication required.');
  }

  const senderId = context.auth.uid;
  if (isRateLimited(senderId)) {
    throw new Error('Rate limit exceeded. Please wait before sending more messages.');
  }

  const { conversationId, text, attachmentUrls, messageType } = data;
  if (!conversationId || (!text && (!attachmentUrls || attachmentUrls.length === 0))) {
    throw new Error('Invalid message parameters.');
  }

  const db = admin.firestore();
  const convRef = db.collection('conversations').doc(conversationId);
  const convSnap = await convRef.get();

  if (!convSnap.exists) {
    throw new Error('Conversation not found.');
  }

  const conv = convSnap.data();

  // Validate sender authorization
  const isAdmin = context.auth.token?.email?.toLowerCase() === 'iphoneuser0312@gmail.com' || context.auth.token?.role === 'admin';
  const isBuyer = conv.buyerId === senderId;
  const isVendor = conv.vendorId === senderId;

  if (!isAdmin && !isBuyer && !isVendor) {
    throw new Error('Permission denied: You are not a participant in this conversation.');
  }

  if (conv.status === 'BLOCKED') {
    throw new Error('This conversation is blocked by marketplace safety.');
  }

  const now = new Date().toISOString();
  let senderRole = 'BUYER';
  let senderName = conv.buyerName || 'Buyer';

  if (isAdmin) {
    senderRole = 'ADMIN';
    senderName = 'Vendora Support';
  } else if (isVendor) {
    senderRole = 'VENDOR';
    senderName = conv.vendorName || 'Artisan Merchant';
  }

  const cleanText = (text || '').trim().slice(0, 3000);

  const newMsg = {
    conversationId,
    senderId,
    senderName,
    senderRole,
    text: cleanText,
    attachmentUrls: Array.isArray(attachmentUrls) ? attachmentUrls.slice(0, 5) : [],
    messageType: messageType || (attachmentUrls?.length ? 'IMAGE' : 'TEXT'),
    isRead: false,
    createdAt: now,
    editedAt: null,
    deletedAt: null
  };

  const msgDocRef = await convRef.collection('messages').add(newMsg);

  // Update conversation counters and last message
  const updatePayload = {
    lastMessageText: cleanText || 'Attachment',
    lastMessageSenderId: senderId,
    lastMessageSenderRole: senderRole,
    lastMessageAt: now,
    updatedAt: now
  };

  if (senderRole === 'BUYER') {
    updatePayload.vendorUnreadCount = admin.firestore.FieldValue.increment(1);
    updatePayload.status = 'PENDING_VENDOR';
  } else if (senderRole === 'VENDOR') {
    updatePayload.buyerUnreadCount = admin.firestore.FieldValue.increment(1);
    updatePayload.status = 'PENDING_BUYER';
  } else if (senderRole === 'ADMIN') {
    updatePayload.buyerUnreadCount = admin.firestore.FieldValue.increment(1);
    updatePayload.vendorUnreadCount = admin.firestore.FieldValue.increment(1);
    updatePayload.status = 'PENDING_ADMIN';
  }

  await convRef.update(updatePayload);

  return { success: true, message: { id: msgDocRef.id, ...newMsg } };
}

/**
 * Cloud Function Handler: Admin status changes, assignment & moderation.
 */
async function handleAdminManageChat(data, context) {
  if (!context.auth) throw new Error('Authentication required.');

  const isAdmin = context.auth.token?.email?.toLowerCase() === 'iphoneuser0312@gmail.com' || context.auth.token?.role === 'admin';
  if (!isAdmin) throw new Error('Admin authorization required.');

  const { conversationId, action, status, assignedAdminId, assignedAdminEmail, notes } = data;
  const db = admin.firestore();
  const convRef = db.collection('conversations').doc(conversationId);
  const now = new Date().toISOString();

  if (action === 'UPDATE_STATUS') {
    await convRef.update({ status, updatedAt: now });
    await convRef.collection('messages').add({
      conversationId,
      senderId: 'SYSTEM',
      senderName: 'Vendora Support',
      senderRole: 'SYSTEM',
      text: `Conversation status updated to ${status}${notes ? `: "${notes}"` : '.'}`,
      messageType: 'SYSTEM',
      isRead: true,
      createdAt: now
    });
  } else if (action === 'ASSIGN_ADMIN') {
    await convRef.update({ assignedAdminId, assignedAdminEmail, assignedAt: now });
  }

  return { success: true };
}

module.exports = {
  handleCreateOrGetConversation,
  handleSendChatMessage,
  handleAdminManageChat
};
