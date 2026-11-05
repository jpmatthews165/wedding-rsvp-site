// Verifies that a request comes from a signed-in admin (Google account on the list).
import { getAuth } from 'firebase-admin/auth';
import { getDb } from './_lib.js';
import { isAdminEmail } from '../src/adminConfig.js';

export const verifyAdminToken = async (token) => {
  if (typeof token !== 'string' || !token) throw new Error('Not signed in');
  getDb(); // makes sure the Admin SDK is initialized
  const decoded = await getAuth().verifyIdToken(token);
  if (!decoded.email_verified || !isAdminEmail(decoded.email)) throw new Error('Not an admin');
  return decoded;
};

export const bearerToken = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
