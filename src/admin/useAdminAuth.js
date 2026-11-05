import { useCallback, useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { isAdminEmail } from '../adminConfig.js';

// Google sign-in for /admin. `isAdmin` is only a UI check — Firestore rules and the
// /api functions enforce the same email list on the server.
export default function useAdminAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); }), []);

  const signIn = useCallback(async () => {
    setError('');
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      if (!isAdminEmail(result.user.email)) {
        setError(`${result.user.email} is not on the admin list.`);
        await signOut(auth);
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(err.message);
    }
  }, []);

  const logOut = useCallback(() => signOut(auth), []);
  const getToken = useCallback(() => auth.currentUser?.getIdToken(), []);

  return { user, ready, error, setError, isAdmin: isAdminEmail(user?.email), signIn, signOut: logOut, getToken };
}
