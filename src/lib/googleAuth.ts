import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import { canonicalPersonKey } from '../data/defaults';

export interface GoogleAuthProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
}

interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

// In-memory access token cache (never persisted in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedAuth: Auth | null = null;

interface EnsureAuthResult {
  auth: Auth | null;
  issueCode?: string | null;
  issueMessage?: string | null;
}

async function ensureAuth(): Promise<EnsureAuthResult> {
  if (cachedAuth) {
    return { auth: cachedAuth };
  }
  try {
    const resp = await fetch('/api/auth/firebase-config');
    if (!resp.ok) {
      return {
        auth: null,
        issueCode: 'CONFIG_FETCH_ERROR',
        issueMessage: 'Não foi possível consultar a configuração de acesso no servidor.',
      };
    }
    const data = (await resp.json()) as {
      configured?: boolean;
      config?: FirebaseWebConfig | null;
      issueCode?: string | null;
      issueMessage?: string | null;
    };
    if (!data.configured || !data.config?.apiKey) {
      return {
        auth: null,
        issueCode: data.issueCode || 'MISSING_API_KEY',
        issueMessage:
          data.issueMessage ||
          'Configure a chave FIREBASE_API_KEY em Settings > Secrets para ativar o Login com Google.',
      };
    }
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(data.config);
    cachedAuth = getAuth(app);
    return { auth: cachedAuth };
  } catch {
    return {
      auth: null,
      issueCode: 'CONFIG_FETCH_ERROR',
      issueMessage: 'Erro de conexão ao verificar a autenticação Google.',
    };
  }
}

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
  let active = true;
  let innerUnsub: Unsubscribe | null = null;

  void ensureAuth().then(({ auth }) => {
    if (!active || !auth) return;
    innerUnsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        onUserSignedIn(toProfile(user), cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onUserSignedOut();
      }
    });
  });

  return () => {
    active = false;
    innerUnsub?.();
  };
}

export async function signInWithGoogle(): Promise<{
  profile: GoogleAuthProfile;
  accessToken: string | null;
}> {
  const { auth, issueCode, issueMessage } = await ensureAuth();
  if (!auth) {
    const err = new Error(issueMessage || 'Firebase Auth não configurado') as Error & {
      code?: string;
    };
    err.code =
      issueCode === 'INVALID_API_KEY_FORMAT' ? 'auth/invalid-api-key' : 'auth/not-configured';
    throw err;
  }
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
  const { auth } = await ensureAuth();
  if (auth) {
    await signOut(auth);
  }
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
