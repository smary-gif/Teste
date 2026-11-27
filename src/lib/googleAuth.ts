import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { canonicalPersonKey } from '../data/defaults';

export interface GoogleAuthProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
}

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

// In-memory access token cache (never persisted in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

function toProfile(user: User): GoogleAuthProfile {
  const email = user.email || '';
  const fallbackName = email ? email.split('@')[0] : 'Colaboradora';
  return {
    uid: user.uid,
    displayName: (user.displayName || fallbackName).trim(),
    email,
    photoURL: user.photoURL || null,
  };
}

export function initGoogleAuth(
  onUserSignedIn: (profile: GoogleAuthProfile, token: string | null) => void,
  onUserSignedOut: () => void
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onUserSignedIn(toProfile(user), cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onUserSignedOut();
    }
  });
}

export async function signInWithGoogle(): Promise<{
  profile: GoogleAuthProfile;
  accessToken: string | null;
}> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return {
      profile: toProfile(result.user),
      accessToken: cachedAccessToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogle(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function resolveCollaboratorFromGoogle(
  profile: Pick<GoogleAuthProfile, 'displayName' | 'email'>,
  existingCollaborators: string[]
): string {
  const rawName = (profile.displayName || '').trim();
  const emailLocal = (profile.email || '').split('@')[0]?.trim() || '';

  const byKey = new Map<string, string>();
  existingCollaborators.forEach((name) => {
    byKey.set(canonicalPersonKey(name), name);
  });

  if (rawName) {
    const fullMatch = byKey.get(canonicalPersonKey(rawName));
    if (fullMatch) return fullMatch;
  }

  if (emailLocal) {
    const localMatch = byKey.get(canonicalPersonKey(emailLocal));
    if (localMatch) return localMatch;
  }

  const firstWord = rawName.split(/\s+/)[0] || '';
  if (firstWord) {
    const firstMatch = byKey.get(canonicalPersonKey(firstWord));
    if (firstMatch) return firstMatch;
  }

  if (rawName) return rawName;
  if (emailLocal) {
    return emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1);
  }
  return 'Colaboradora';
}
