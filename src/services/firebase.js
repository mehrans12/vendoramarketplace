import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if keys are actually provided
const hasFirebaseKeys = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_firebase_api_key_here';

let app = null;
let auth = null;
let db = null;
let storage = null;
let googleProvider = null;

if (hasFirebaseKeys) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  console.warn("VENDORA: Running in mock mode because Firebase configuration keys are missing in .env.");
}

export { app, auth, db, storage, googleProvider, hasFirebaseKeys };
