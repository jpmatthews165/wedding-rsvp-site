import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// The web config is public by design; access is controlled by firestore.rules.
const firebaseConfig = {
  apiKey: "AIzaSyCmYELIaWbAQa_a3FwSbGTQ6vwM5yMjAzw",
  authDomain: "wedding-rsvp-a2263.firebaseapp.com",
  projectId: "wedding-rsvp-a2263",
  storageBucket: "wedding-rsvp-a2263.firebasestorage.app",
  messagingSenderId: "417073252983",
  appId: "1:417073252983:web:bc60809d4adef451905472",
  measurementId: "G-JT22Q0515D"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
