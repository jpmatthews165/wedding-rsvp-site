// Firebase SDK — used by the admin dashboard and website editor only.
// The public site reads its few public documents over plain HTTPS instead
// (src/content/publicRead.js) so guests don't download the SDK.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
