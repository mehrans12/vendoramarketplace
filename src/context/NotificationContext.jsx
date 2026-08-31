import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db, hasFirebaseKeys } from '../services/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  writeBatch 
} from 'firebase/firestore';

import { 
  fetchUserPreferences, 
  saveUserPreferences, 
  dispatchIntelligentNotification, 
  DEFAULT_PREFERENCES 
} from '../services/notifications/notificationService';

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]); // Array of { id, title, message, type }
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  // Load preferences when currentUser changes
  useEffect(() => {
    if (currentUser) {
      fetchUserPreferences(currentUser.uid).then(setPreferences);
    }
  }, [currentUser]);

  const updatePreferences = async (newPrefs) => {
    if (!currentUser) return false;
    const merged = { ...preferences, ...newPrefs };
    setPreferences(merged);
    return await saveUserPreferences(currentUser.uid, merged);
  };

  // 1. Trigger a sliding Toast Notification Alert
  const triggerToast = (title, message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, title, message, type }]);

    // Dismiss toast after 4.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // 2. Real-time Subscription to user notifications
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    if (!hasFirebaseKeys) {
      const getLocalNotifications = () => {
        try {
          const key = `vendora_notifs_${currentUser.uid}`;
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          
          // Seed initial welcome notification if empty
          if (list.length === 0) {
            const welcome = {
              id: 'notif-mock-1',
              title: 'Welcome to Vendora!',
              message: 'Explore local artisans and support small businesses across Pakistan.',
              type: 'info',
              read: false,
              createdAt: new Date().toISOString()
            };
            list.push(welcome);
            localStorage.setItem(key, JSON.stringify(list));
          }
          return list;
        } catch (e) {
          return [];
        }
      };

      setNotifications(getLocalNotifications());

      // Periodically poll/check for new notifications from storage to simulate real-time updates
      const interval = setInterval(() => {
        const currentNotifs = getLocalNotifications();
        setNotifications(prev => {
          if (currentNotifs.length > prev.length) {
            const newOnes = currentNotifs.filter(n => !prev.some(p => p.id === n.id));
            newOnes.forEach(newNotif => {
              if (!newNotif.read) {
                triggerToast(newNotif.title, newNotif.message, newNotif.type);
              }
            });
          }
          return currentNotifs;
        });
      }, 1500);

      return () => clearInterval(interval);
    }

    const notifQuery = query(
      collection(db, 'users', currentUser.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      const list = [];
      let triggerNewToast = false;
      let newestNotif = null;

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data });
      });

      // Scan changes to detect new unread notifications and trigger toast alert
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const ageInMs = Date.now() - new Date(data.createdAt).getTime();
          // If notification was created in the last 6 seconds, trigger toast
          if (ageInMs < 6000 && !data.read) {
            triggerNewToast = true;
            newestNotif = data;
          }
        }
      });

      setNotifications(list);

      if (triggerNewToast && newestNotif) {
        triggerToast(newestNotif.title, newestNotif.message, newestNotif.type);
      }
    }, (error) => {
      console.warn("Failed to subscribe to user notifications:", error);
    });

    return unsubscribe;
  }, [currentUser]);

  // 3. Expose action triggers
  const sendNotification = async (targetUid, notifData) => {
    const payload = {
      title: notifData.title,
      message: notifData.message,
      type: notifData.type || 'info',
      orderId: notifData.orderId || null,
      read: false,
      createdAt: new Date().toISOString()
    };

    if (!hasFirebaseKeys) {
      try {
        const key = `vendora_notifs_${targetUid}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const newNotif = { id: `notif-mock-${Date.now()}-${Math.floor(Math.random()*1000)}`, ...payload };
        existing.unshift(newNotif);
        localStorage.setItem(key, JSON.stringify(existing));
      } catch (e) {}

      // In mock mode, if target is current user, push locally and trigger toast
      if (currentUser && targetUid === currentUser.uid) {
        const mockId = `notif-mock-${Date.now()}`;
        setNotifications(prev => [{ id: mockId, ...payload }, ...prev]);
        triggerToast(payload.title, payload.message, payload.type);
      }
      return;
    }

    try {
      const userNotifRef = collection(db, 'users', targetUid, 'notifications');
      await addDoc(userNotifRef, payload);
    } catch (err) {
      console.error("Failed to save notification record:", err);
    }
  };

  const markAsRead = async (notificationId) => {
    if (!hasFirebaseKeys || !currentUser) {
      setNotifications(prev => {
        const updated = prev.map(n => n.id === notificationId ? { ...n, read: true } : n);
        try {
          localStorage.setItem(`vendora_notifs_${currentUser.uid}`, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      return;
    }

    try {
      const docRef = doc(db, 'users', currentUser.uid, 'notifications', notificationId);
      await updateDoc(docRef, { read: true });
    } catch (err) {
      console.error("Mark notification as read failed:", err);
    }
  };

  const markAllAsRead = async () => {
    if (notifications.length === 0) return;

    if (!hasFirebaseKeys || !currentUser) {
      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, read: true }));
        try {
          localStorage.setItem(`vendora_notifs_${currentUser.uid}`, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      return;
    }

    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        if (!n.read) {
          const docRef = doc(db, 'users', currentUser.uid, 'notifications', n.id);
          batch.update(docRef, { read: true });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Mark all notifications as read failed:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const value = {
    notifications,
    toasts,
    unreadCount,
    sendNotification,
    dispatchNotification: dispatchIntelligentNotification,
    preferences,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    triggerToast
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {/* Floating sliding toast list container */}
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none',
        maxWidth: '360px',
        width: '100%'
      }}>
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            style={{
              padding: '16px 20px',
              borderRadius: '10px',
              backgroundColor: '#0f172a', // Dark charcoal theme match
              color: '#fff',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              pointerEvents: 'auto',
              borderLeft: `5px solid ${
                toast.type === 'success' ? 'var(--success)' : 
                toast.type === 'warning' ? 'var(--secondary)' : 
                toast.type === 'danger' ? 'var(--danger)' : 'var(--primary)'
              }`,
              animation: 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '14px', fontWeight: 700 }}>{toast.title}</strong>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: '0 0 0 8px' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>{toast.message}</p>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
