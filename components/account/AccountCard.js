// components/account/AccountCard.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Card from '../ui/Card';
import GradientButton from '../ui/GradientButton';
import { palette, spacing } from '../../theme';

WebBrowser.maybeCompleteAuthSession();

const ACCT_KEY = 'account:profile';
const PKCE_VERIFIER_KEY = 'auth.google.pkce.code_verifier';

async function loadAccount() {
  try {
    const raw = await AsyncStorage.getItem(ACCT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function saveAccount(acct) {
  try { await AsyncStorage.setItem(ACCT_KEY, JSON.stringify(acct)); } catch {}
}
async function clearAccount() {
  try { await AsyncStorage.removeItem(ACCT_KEY); } catch {}
}

export default function AccountCard() {
  const [loading, setLoading] = useState(true);
  const [acct, setAcct] = useState(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  // guards to prevent double exchange of the same code
  const handledCodeRef = useRef(null);
  const exchangingRef = useRef(false);

  // Google config (from app.json → extra)
  const iosClientId =
    Constants?.expoConfig?.extra?.GOOGLE_CLIENT_ID_IOS ||
    Constants?.manifestExtra?.GOOGLE_CLIENT_ID_IOS;

  const scheme =
    Constants?.expoConfig?.scheme ||
    Constants?.manifest?.scheme ||
    undefined;

  const redirectUri = `${scheme}:/oauth2redirect/google`;

  // Google PKCE hook
  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      clientId: iosClientId,
      responseType: 'code',         // may still return inline tokens (hybrid)
      usePKCE: true,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      scopes: ['openid', 'email', 'profile'],
      redirectUri,
      extraParams: { prompt: 'select_account' },
    },
    { useProxy: false }
  );

  // init
  useEffect(() => {
    (async () => {
      const a = await loadAccount();
      setAcct(a);
      try { setAppleAvailable(await AppleAuthentication.isAvailableAsync()); }
      catch { setAppleAvailable(false); }
      setLoading(false);
    })();
  }, []);

  // Google response handler (handles both inline tokens and code exchange)
  useEffect(() => {
    (async () => {
      if (!response) return;
      if (response.type !== 'success') {
        setAuthBusy(false);
        return;
      }

      // Prefer inline token if present (hybrid responses)
      const inlineAccessToken = response?.authentication?.accessToken || null;
      const inlineIdToken = response?.authentication?.idToken || null;
      if (inlineAccessToken) {
        try {
          const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${inlineAccessToken}` },
          });
          if (!r.ok) throw new Error(`Profile fetch failed (${r.status})`);
          const profile = await r.json();
          const mapped = {
            provider: 'google',
            name: profile?.name || 'Google User',
            email: profile?.email || '',
            picture: profile?.picture || '',
            id: profile?.sub || '',
            raw: { profile, inlineIdToken },
          };
          await saveAccount(mapped);
          setAcct(mapped);
        } catch {
          Alert.alert('Google Sign-In', 'Signed in, but failed to fetch your profile.');
        } finally {
          setAuthBusy(false);
          try { await AsyncStorage.removeItem(PKCE_VERIFIER_KEY); } catch {}
        }
        return;
      }

      // Otherwise, exchange the authorization code
      const code = response.params?.code || '';
      if (!code) {
        setAuthBusy(false);
        Alert.alert('Google Sign-In', 'Missing authorization code.');
        return;
      }
      if (handledCodeRef.current === code || exchangingRef.current) {
        setAuthBusy(false);
        return;
      }
      handledCodeRef.current = code;
      exchangingRef.current = true;

      try {
        const codeVerifier =
          (await AsyncStorage.getItem(PKCE_VERIFIER_KEY)) ||
          request?.codeVerifier ||
          '';
        if (!codeVerifier) throw new Error('Missing PKCE code_verifier.');

        const body = new URLSearchParams({
          code,
          client_id: iosClientId,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString();

        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        if (!tokenResp.ok) throw new Error(`Token exchange failed (${tokenResp.status})`);
        const tokenRes = await tokenResp.json();

        const accessToken = tokenRes?.access_token || tokenRes?.accessToken;
        if (!accessToken) throw new Error('No access token returned.');

        const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!r.ok) throw new Error(`Profile fetch failed (${r.status})`);
        const profile = await r.json();

        const mapped = {
          provider: 'google',
          name: profile?.name || 'Google User',
          email: profile?.email || '',
          picture: profile?.picture || '',
          id: profile?.sub || '',
          raw: { profile, tokenRes },
        };
        await saveAccount(mapped);
        setAcct(mapped);
      } catch {
        Alert.alert(
          'Google Sign-In',
          'Signed in, but failed to finish token exchange or fetch profile.'
        );
      } finally {
        setAuthBusy(false);
        exchangingRef.current = false;
        try { await AsyncStorage.removeItem(PKCE_VERIFIER_KEY); } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  // Start Google
  const onGoogle = useCallback(async () => {
    if (!iosClientId || !scheme) {
      Alert.alert('Google Sign-In not configured', 'Missing GOOGLE_CLIENT_ID_IOS or app scheme.');
      return;
    }
    if (!request) {
      Alert.alert('Google Sign-In', 'Auth request is not ready yet.');
      return;
    }
    if (authBusy) return;
    setAuthBusy(true);
    try {
      if (request?.codeVerifier) await AsyncStorage.setItem(PKCE_VERIFIER_KEY, request.codeVerifier);
      handledCodeRef.current = null;
      exchangingRef.current = false;
      await promptAsync();
    } catch {
      setAuthBusy(false);
      Alert.alert('Google Sign-In', 'Could not start sign-in.');
    }
  }, [iosClientId, scheme, request, promptAsync, authBusy]);

  // Start Apple
  const onApple = useCallback(async () => {
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        Alert.alert('Apple Sign-In', 'Not available on this device.');
        return;
      }

      // Nonce recommended (binds request/response; verify on backend if you have one)
      const rawNonce = Math.random().toString(36).slice(2);
      const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });

      const fullName =
        (credential?.fullName?.givenName || '') +
        (credential?.fullName?.familyName ? ' ' + credential.fullName.familyName : '');

      const mapped = {
        provider: 'apple',
        id: credential?.user || '',
        name: (fullName || '').trim() || 'Apple User',
        email: credential?.email || '', // only present on first consent
        picture: '',
        raw: credential, // contains identityToken + authorizationCode
      };

      await saveAccount(mapped);
      setAcct(mapped);

      // OPTIONAL: send { identityToken, authorizationCode, rawNonce } to your backend for verification
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') {
        Alert.alert('Apple Sign-In', 'Could not sign in.');
      }
    }
  }, []);

  const onSignOut = useCallback(async () => {
    await clearAccount();
    setAcct(null);
  }, []);

  return (
    <Card style={{ padding: spacing(2) }}>
      <Text style={styles.title}>Account</Text>

      {loading ? (
        <View style={{ paddingVertical: spacing(2), alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : acct ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {acct.picture ? (
              <Image
                source={{ uri: acct.picture }}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' }}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={{ color: 'white', fontWeight: '900' }}>
                  {(acct.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{acct.name || 'User'}</Text>
              {!!acct.email && <Text style={styles.sub}>{acct.email}</Text>}
              <Text style={styles.sub}>Signed in with {acct.provider}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <GradientButton title="Sign Out" onPress={onSignOut} />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {/* Google */}
          <View>
            <Text style={[styles.sub, { marginBottom: 6 }]}>Sign in with Google</Text>
            {!iosClientId ? (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>
                  Missing GOOGLE_CLIENT_ID_IOS in app.json → extra.
                </Text>
              </View>
            ) : null}
            <GradientButton
              title={authBusy ? 'Opening…' : 'Continue with Google'}
              onPress={onGoogle}
              disabled={!iosClientId || !request || authBusy}
            />
          </View>

          {/* Apple */}
          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={10}
              style={{ width: '100%', height: 44 }}
              onPress={onApple}
            />
          ) : null}

          <Text style={[styles.sub, { marginTop: 8 }]}>
            We’ll use your name and email to personalize your Rep.AI experience.
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: spacing(1) },
  sub: { color: palette.sub, fontSize: 12 },
  name: { color: palette.text, fontSize: 16, fontWeight: '900' },

  warnBox: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  warnText: { color: '#92400E', fontSize: 12, fontWeight: '700' },

  avatarFallback: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6a5cff',
  },
});
