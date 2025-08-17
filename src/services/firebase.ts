import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBo9nBP2CXhTNLav8hrvHk3mpjfjzIq-B8",
  authDomain: "project-hamza-351611.firebaseapp.com",
  projectId: "project-hamza-351611",
  storageBucket: "project-hamza-351611.appspot.com",
  messagingSenderId: "249220913074",
  appId: "1:249220913074:web:b9487b19ce33816ddcb6ab",
  measurementId: "G-XLWXV5ZV1L"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Initialize Functions with optional region/custom domain from env
// Use Vite env var VITE_FIREBASE_FUNCTIONS_REGION (e.g., 'europe-west1') if provided
const FUNCTIONS_REGION = (import.meta as any)?.env?.VITE_FIREBASE_FUNCTIONS_REGION as string | undefined;
export const functions = FUNCTIONS_REGION ? getFunctions(app, FUNCTIONS_REGION) : getFunctions(app);

// Enable persistence for Firestore
enableMultiTabIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support persistence.');
    }
  });

// Set up offline persistence for authentication
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });