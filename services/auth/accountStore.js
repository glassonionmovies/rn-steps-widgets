// services/auth/accountStore.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ACCOUNT_KEY = 'account:profile';         // non-sensitive: name/email/avatar/provider/userId
const TOKEN_PROVIDER = 'auth:provider';        // 'apple' | 'google'
const TOKEN_ID = 'auth:idToken';               // id_token or identityToken
const TOKEN_REFRESH = 'auth:refreshToken';     // google only (optional)

// ----- profile shape -----
// {
//   provider: 'apple' | 'google',
//   userId: string,
//   fullName: string,
//   email: string,
//   avatarUrl: string|null
// }

export async function getAccount() {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setAccount(profile) {
  const existing = await getAccount();
  // Apple may return null name/email after first sign-in; preserve existing when incoming is empty.
  const merged = {
    provider: profile?.provider ?? existing?.provider ?? null,
    userId: profile?.userId ?? existing?.userId ?? null,
    fullName: profile?.fullName || existing?.fullName || '',
    email: profile?.email || existing?.email || '',
    avatarUrl: profile?.avatarUrl ?? existing?.avatarUrl ?? null,
  };
  await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(merged));
  return merged;
}

export async function clearAccount() {
  try { await AsyncStorage.removeItem(ACCOUNT_KEY); } catch {}
}

export async function setTokens({ provider, idToken = null, refreshToken = null }) {
  try {
    if (provider) await SecureStore.setItemAsync(TOKEN_PROVIDER, provider);
    if (idToken !== null) await SecureStore.setItemAsync(TOKEN_ID, idToken);
    if (refreshToken !== null) await SecureStore.setItemAsync(TOKEN_REFRESH, refreshToken);
  } catch {}
}

export async function clearTokens() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_PROVIDER);
    await SecureStore.deleteItemAsync(TOKEN_ID);
    await SecureStore.deleteItemAsync(TOKEN_REFRESH);
  } catch {}
}

export async function isSignedIn() {
  const account = await getAccount();
  return !!(account?.userId && (account.email || account.fullName));
}

export async function signOutAll() {
  await clearTokens();
  await clearAccount();
}

