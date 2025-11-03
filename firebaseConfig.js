// firebaseConfig.js
// Safe Firebase initialization for React Native / HMR

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCkdcyDoT33S_zxB2HrfZWXBHYRvGkuXMw",
  authDomain: "mesupervisme.firebaseapp.com",
  projectId: "mesupervisme",
  storageBucket: "mesupervisme.appspot.com",
  messagingSenderId: "230702471270",
  appId: "1:230702471270:android:42bdcb147c16c1cecf35a7",
};

// Initialize or reuse existing app (prevents "already exists" on reload)
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth with React Native persistence (uses AsyncStorage)
import AsyncStorage from '@react-native-async-storage/async-storage';
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
