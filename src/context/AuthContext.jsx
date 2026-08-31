import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, hasFirebaseKeys } from '../services/firebase';
import { trackEvent, mergeAnonymousHistory } from '../services/analytics/eventTracker';
import { EventTypes } from '../services/analytics/eventTypes';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Helper to persist role session locally so browser refreshes maintain user state
const saveRoleSession = (uid, roleName, profileObj = null) => {
  try {
    if (uid && roleName) {
      localStorage.setItem(`vendora_role_${uid}`, roleName);
      if (profileObj) {
        localStorage.setItem(`vendora_profile_${uid}`, JSON.stringify(profileObj));
      }
    }
  } catch (e) {
    console.warn("LocalStorage session save error:", e);
  }
};

const getCachedRoleSession = (uid) => {
  try {
    if (!uid) return null;
    const role = localStorage.getItem(`vendora_role_${uid}`);
    const profileStr = localStorage.getItem(`vendora_profile_${uid}`);
    const profile = profileStr ? JSON.parse(profileStr) : null;
    return { role, profile };
  } catch (e) {
    return null;
  }
};

const clearRoleSession = (uid) => {
  try {
    if (uid) {
      localStorage.removeItem(`vendora_role_${uid}`);
      localStorage.removeItem(`vendora_profile_${uid}`);
    }
  } catch (e) {}
};

const ADMIN_EMAIL = 'iphoneuser0312@gmail.com';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [role, setRole] = useState('buyer');
  const [loading, setLoading] = useState(true);

  // Telemetry page tracking trigger
  useEffect(() => {
    trackEvent(EventTypes.DEVICE_SEEN, {
      metadata: {
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language
      }
    });
  }, []);

  // Sign up a new user
  const signup = async (name, email, password, chosenRole) => {
    let effectiveRole = chosenRole;
    if (email.toLowerCase() === ADMIN_EMAIL || email.toLowerCase().includes('admin')) {
      effectiveRole = 'admin';
    }

    if (!hasFirebaseKeys) {
      // Mock signup flow
      const mockUser = { uid: 'mock-uid-123', email, displayName: name, emailVerified: false };
      const mockProfile = { uid: 'mock-uid-123', name: name || 'Platform Administrator', email, role: effectiveRole };
      saveRoleSession(mockUser.uid, effectiveRole, mockProfile);
      setCurrentUser(mockUser);
      setUserProfile(mockProfile);
      setRole(effectiveRole);
      return mockUser;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update Firebase Auth user's displayName to the user provided Name
      if (name) {
        try {
          await updateProfile(user, { displayName: name });
        } catch (updateErr) {
          console.warn("Could not update Firebase Auth user displayName:", updateErr);
        }
      }

      // Automatically send Firebase Auth email verification
      try {
        await sendEmailVerification(user);
      } catch (verificationErr) {
        console.warn("Could not dispatch verification email immediately:", verificationErr);
      }

      const userDocRef = doc(db, 'users', user.uid);
      const userProfileData = {
        uid: user.uid,
        name: effectiveRole === 'admin' ? 'Platform Administrator' : (name || user.displayName || email.split('@')[0]),
        email,
        role: effectiveRole,
        createdAt: new Date().toISOString()
      };
      
      try {
        await setDoc(userDocRef, userProfileData);
      } catch (dbErr) {
        console.warn("Failed to write user profile document to Firestore (possibly due to locked security rules):", dbErr);
      }

      if (effectiveRole === 'vendor') {
        const vendorDocRef = doc(db, 'vendors', user.uid);
        try {
          await setDoc(vendorDocRef, {
            vendorId: user.uid,
            businessName: '',
            description: '',
            city: '',
            phone: '',
            nationalIdUrl: '',
            verified: false,
            status: 'pending',
            rating: 5.0,
            createdAt: new Date().toISOString()
          });
        } catch (vendorDbErr) {
          console.warn("Failed to write vendor document to Firestore (possibly due to locked security rules):", vendorDbErr);
        }
      }

      saveRoleSession(user.uid, effectiveRole, userProfileData);
      setCurrentUser(user);
      setUserProfile(userProfileData);
      setRole(effectiveRole);
      trackEvent(EventTypes.SECURITY_EVENT, { metadata: { action: 'signup', email } });
      mergeAnonymousHistory(user.uid);
      return user;
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    }
  };

  // Login existing user
  const login = async (email, password) => {
    let effectiveRole = 'buyer';
    if (email.toLowerCase() === ADMIN_EMAIL || email.toLowerCase().includes('admin')) {
      effectiveRole = 'admin';
    }

    if (!hasFirebaseKeys) {
      // Mock login flow
      const mockUser = { uid: 'mock-uid-123', email, displayName: effectiveRole === 'admin' ? 'Platform Administrator' : 'Mock User' };
      if (email.includes('vendor')) effectiveRole = 'vendor';

      const mockProfile = { uid: 'mock-uid-123', name: effectiveRole === 'admin' ? 'Platform Administrator' : 'Mock User', email, role: effectiveRole };
      saveRoleSession(mockUser.uid, effectiveRole, mockProfile);
      setCurrentUser(mockUser);
      setUserProfile(mockProfile);
      setRole(effectiveRole);
      return mockUser;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      let userDocSnap = null;
      try {
        userDocSnap = await getDoc(userDocRef);
      } catch (dbErr) {
        console.warn("Failed to retrieve user profile from Firestore (possibly due to locked security rules):", dbErr);
      }
      
      let finalRole = effectiveRole !== 'buyer' ? effectiveRole : 'buyer';
      let finalProfile = null;

      if (userDocSnap && userDocSnap.exists()) {
        finalProfile = userDocSnap.data();
        if (effectiveRole === 'admin') {
          finalProfile.role = 'admin';
          finalRole = 'admin';
          try {
            await setDoc(userDocRef, { role: 'admin' }, { merge: true });
          } catch (writeErr) {
            console.warn("Failed to set admin role in Firestore during login:", writeErr);
          }
        } else {
          finalRole = finalProfile.role || 'buyer';
        }
      } else {
        // Check if vendor doc exists
        if (finalRole !== 'admin') {
          try {
            const vSnap = await getDoc(doc(db, 'vendors', user.uid));
            if (vSnap.exists()) {
              finalRole = 'vendor';
            }
          } catch (vErr) {}
        }

        const cached = getCachedRoleSession(user.uid);
        if (finalRole === 'buyer') {
          if (cached && cached.role) {
            finalRole = cached.role;
          } else if (email.toLowerCase().includes('vendor')) {
            finalRole = 'vendor';
          }
        }

        if (email.toLowerCase() === ADMIN_EMAIL) {
          finalRole = 'admin';
        }

        const resolvedName = (cached && cached.profile && cached.profile.name) || user.displayName || (email ? email.split('@')[0] : 'User');

        finalProfile = { 
          uid: user.uid, 
          email, 
          role: finalRole, 
          name: finalRole === 'admin' ? 'Platform Administrator' : resolvedName 
        };
        try {
          await setDoc(userDocRef, finalProfile);
        } catch (err) {
          console.warn("Failed to write user profile in Firestore (possibly due to locked security rules):", err);
        }
      }

      saveRoleSession(user.uid, finalRole, finalProfile);
      setCurrentUser(user);
      setUserProfile(finalProfile);
      setRole(finalRole);
      trackEvent(EventTypes.LOGIN, { metadata: { email } });
      mergeAnonymousHistory(user.uid);
      return user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    if (!hasFirebaseKeys) {
      const mockUser = { uid: 'mock-google-uid', email: 'googleuser@example.com', displayName: 'Google Mock User' };
      const mockProfile = { uid: 'mock-google-uid', name: 'Google Mock User', email: 'googleuser@example.com', role: 'buyer' };
      saveRoleSession(mockUser.uid, 'buyer', mockProfile);
      setCurrentUser(mockUser);
      setUserProfile(mockProfile);
      setRole('buyer');
      return mockUser;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDocRef = doc(db, 'users', user.uid);
      let userDocSnap = null;
      try {
        userDocSnap = await getDoc(userDocRef);
      } catch (dbErr) {
        console.warn("Failed to retrieve user profile from Firestore during Google Sign-in:", dbErr);
      }

      let chosenRole = 'buyer';
      if (user.email && (user.email.toLowerCase() === ADMIN_EMAIL || user.email.toLowerCase().includes('admin'))) {
        chosenRole = 'admin';
      } else {
        const cached = getCachedRoleSession(user.uid);
        if (cached && cached.role) {
          chosenRole = cached.role;
        } else if (user.email && user.email.toLowerCase().includes('vendor')) {
          chosenRole = 'vendor';
        }
      }

      let profile;
      if (userDocSnap && userDocSnap.exists()) {
        profile = userDocSnap.data();
        if (chosenRole === 'admin') {
          profile.role = 'admin';
        }
      } else {
        profile = {
          uid: user.uid,
          name: chosenRole === 'admin' ? 'Platform Administrator' : (user.displayName || 'Google User'),
          email: user.email,
          role: chosenRole,
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(userDocRef, profile);
        } catch (err) {
          console.warn("Failed to write Google user profile to Firestore (possibly due to locked security rules):", err);
        }
      }

      saveRoleSession(user.uid, profile.role || chosenRole, profile);
      setCurrentUser(user);
      setUserProfile(profile);
      setRole(profile.role || chosenRole);
      trackEvent(EventTypes.LOGIN, { metadata: { method: 'google', email: user.email } });
      mergeAnonymousHistory(user.uid);
      return user;
    } catch (error) {
      console.error("Google sign in error:", error);
      throw error;
    }
  };

  // Sign out
  const logout = async () => {
    const prevUid = currentUser?.uid;
    if (currentUser?.uid) {
      clearRoleSession(currentUser.uid);
    }

    if (!hasFirebaseKeys) {
      trackEvent(EventTypes.LOGOUT, { metadata: { userId: prevUid } });
      setCurrentUser(null);
      setUserProfile(null);
      setRole('buyer');
      return;
    }

    try {
      trackEvent(EventTypes.LOGOUT, { metadata: { userId: prevUid } });
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setRole('buyer');
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  // Auth observer
  useEffect(() => {
    if (!hasFirebaseKeys) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        let fetchedRole = null;
        let fetchedProfile = null;

        if (user.email && (user.email.toLowerCase() === ADMIN_EMAIL || user.email.toLowerCase().includes('admin'))) {
          fetchedRole = 'admin';
        }

        // 1. Try reading profile from Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            fetchedProfile = userDocSnap.data();
            if (user.email && user.email.toLowerCase() === ADMIN_EMAIL && fetchedProfile.role !== 'admin') {
              fetchedProfile.role = 'admin';
              try {
                await setDoc(userDocRef, { role: 'admin' }, { merge: true });
              } catch (writeErr) {
                console.warn("Failed to set admin role in Firestore on auth change:", writeErr);
              }
            }
            if (fetchedRole !== 'admin') {
              fetchedRole = fetchedProfile.role;
            }
          }
        } catch (err) {
          console.warn("Firestore profile fetch skipped/failed on auth change:", err);
        }

        // 2. Check vendor doc in Firestore
        if (!fetchedRole) {
          try {
            const vSnap = await getDoc(doc(db, 'vendors', user.uid));
            if (vSnap.exists()) {
              fetchedRole = 'vendor';
            }
          } catch (vErr) {}
        }

        // 3. Check cached LocalStorage session
        const cached = getCachedRoleSession(user.uid);
        if (cached) {
          if (!fetchedRole && cached.role) {
            fetchedRole = cached.role;
          }
          if (!fetchedProfile && cached.profile) {
            fetchedProfile = cached.profile;
          }
        }

        // 4. Fallback checks
        if (!fetchedRole) {
          if (user.email && user.email.toLowerCase().includes('vendor')) {
            fetchedRole = 'vendor';
          } else {
            fetchedRole = 'buyer';
          }
        }

        if (!fetchedProfile) {
          const fallbackName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
          fetchedProfile = { 
            uid: user.uid, 
            email: user.email, 
            role: fetchedRole, 
            name: fetchedRole === 'admin' ? 'Platform Administrator' : fallbackName
          };
        }

        saveRoleSession(user.uid, fetchedRole, fetchedProfile);
        setUserProfile(fetchedProfile);
        setRole(fetchedRole);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setRole('buyer');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Resend verification email
  const sendVerificationEmail = async () => {
    if (!hasFirebaseKeys || !auth.currentUser) {
      console.log("Simulated verification email dispatch (Demo Mode)");
      return true;
    }
    try {
      await sendEmailVerification(auth.currentUser);
      return true;
    } catch (error) {
      console.error("Resend verification email error:", error);
      throw error;
    }
  };

  // Send password reset email
  const resetPassword = async (userEmail) => {
    if (!hasFirebaseKeys) {
      console.log("Simulated password reset email dispatch to:", userEmail);
      return true;
    }
    try {
      await sendPasswordResetEmail(auth, userEmail);
      return true;
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  };

  // Deactivate user account
  const deactivateAccount = async () => {
    if (!currentUser) return;

    const uid = currentUser.uid;

    // 1. Mark account as deactivated in LocalStorage
    try {
      localStorage.setItem(`vendora_deactivated_${uid}`, 'true');
      if (role === 'vendor') {
        const storedVendor = localStorage.getItem(`vendora_vendordoc_${uid}`);
        if (storedVendor) {
          const parsed = JSON.parse(storedVendor);
          localStorage.setItem(`vendora_vendordoc_${uid}`, JSON.stringify({ ...parsed, status: 'deactivated', verified: false }));
        }
      }
    } catch (e) {}

    // 2. Mark profile as deactivated in Firestore if available
    if (hasFirebaseKeys) {
      try {
        await updateDoc(doc(db, 'users', uid), { status: 'deactivated', active: false });
        if (role === 'vendor') {
          await updateDoc(doc(db, 'vendors', uid), { status: 'deactivated', verified: false });
        }
      } catch (err) {
        console.warn("Firestore deactivate update skipped/locked:", err);
      }
    }

    // 3. Clear session and logout
    await logout();
    return true;
  };

  // Update profile details
  const updateUserProfile = async (updatedData) => {
    if (!currentUser) return;
    const uid = currentUser.uid;

    const newName = updatedData.name || userProfile?.name || currentUser.displayName;

    // 1. Update Firebase Auth displayName if available
    if (newName && hasFirebaseKeys && auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: newName });
      } catch (err) {
        console.warn("Firebase Auth updateProfile warning:", err);
      }
    }

    const mergedProfile = {
      ...(userProfile || {}),
      ...updatedData,
      uid,
      email: currentUser.email,
      name: newName,
      role
    };

    // 2. Persist to LocalStorage
    saveRoleSession(uid, role, mergedProfile);

    // 3. Persist vendor document updates if vendor fields provided
    if (role === 'vendor' && (updatedData.businessName || updatedData.phone || updatedData.city || updatedData.description)) {
      try {
        const storedVendorStr = localStorage.getItem(`vendora_vendordoc_${uid}`);
        const storedVendor = storedVendorStr ? JSON.parse(storedVendorStr) : {};
        const updatedVendor = {
          ...storedVendor,
          vendorId: uid,
          businessName: updatedData.businessName !== undefined ? updatedData.businessName : storedVendor.businessName,
          phone: updatedData.phone !== undefined ? updatedData.phone : storedVendor.phone,
          city: updatedData.city !== undefined ? updatedData.city : storedVendor.city,
          description: updatedData.description !== undefined ? updatedData.description : storedVendor.description
        };
        localStorage.setItem(`vendora_vendordoc_${uid}`, JSON.stringify(updatedVendor));

        if (hasFirebaseKeys) {
          try {
            await setDoc(doc(db, 'vendors', uid), updatedVendor, { merge: true });
          } catch (vErr) {
            console.warn("Firestore vendor doc update warning:", vErr);
          }
        }
      } catch (e) {}
    }

    // 4. Update Firestore user document
    if (hasFirebaseKeys) {
      try {
        await setDoc(doc(db, 'users', uid), mergedProfile, { merge: true });
      } catch (err) {
        console.warn("Firestore user profile update warning:", err);
      }
    }

    setUserProfile(mergedProfile);
    setCurrentUser(prev => prev ? { ...prev, displayName: newName } : prev);
    return mergedProfile;
  };

  const value = {
    currentUser,
    userProfile,
    role,
    loading,
    login,
    signup,
    logout,
    signInWithGoogle,
    sendVerificationEmail,
    resetPassword,
    deactivateAccount,
    updateUserProfile,
    isMock: !hasFirebaseKeys
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
