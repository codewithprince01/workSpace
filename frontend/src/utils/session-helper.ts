import { ILocalSession } from '@/types/auth/local-session.types';

export const WORKLENZ_SESSION_ID = import.meta.env.VITE_WORKLENZ_SESSION_ID;
const storage: Storage = localStorage;

export function setSession(user: ILocalSession): void {
  // Validate user before storing - prevent storing undefined/null
  if (!user || typeof user !== 'object' || !user.email) {
    console.error('[SESSION] Attempted to store invalid session:', user);
    return;
  }
  console.log('[SESSION DEBUG] Setting session for user:', user?.email);
  storage.setItem(WORKLENZ_SESSION_ID, btoa(unescape(encodeURIComponent(JSON.stringify(user)))));
  console.log('[SESSION DEBUG] Session key:', WORKLENZ_SESSION_ID);
}

export function getUserSession(): ILocalSession | null {
  try {
    const rawSession = storage.getItem(WORKLENZ_SESSION_ID);
    console.log('[SESSION DEBUG] Getting session, key:', WORKLENZ_SESSION_ID, 'exists:', !!rawSession);
    if (!rawSession) return null;
    
    const decoded = JSON.parse(atob(rawSession));
    // Validate decoded session
    if (!decoded || typeof decoded !== 'object' || !decoded.email) {
      console.error('[SESSION] Corrupted session data detected, clearing...');
      storage.removeItem(WORKLENZ_SESSION_ID);
      return null;
    }
    console.log('[SESSION DEBUG] Decoded session:', decoded?.email);
    return decoded;
  } catch (e) {
    console.error('[SESSION DEBUG] Error parsing session, clearing corrupted data:', e);
    // Clear corrupted session data
    storage.removeItem(WORKLENZ_SESSION_ID);
    return null;
  }
}

export function hasSession() {
  return !!storage.getItem(WORKLENZ_SESSION_ID);
}

export function deleteSession() {
  storage.removeItem(WORKLENZ_SESSION_ID);
}

export function getRole() {
  const session = getUserSession();
  if (!session) return 'Unknown';
  if (session.owner) return 'Owner';
  if (session.is_admin) return 'Admin';
  return 'Member';
}
