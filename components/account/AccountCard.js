// components/account/AccountCard.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
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
  try {
    await AsyncStorage.setItem(ACCT_KEY, JSON.stringify(acct));
  } catch {}
}

async function clearAccount() {
  try {
    await AsyncStorage.removeItem(ACCT_KEY);
  } catch {}
}

export default function AccountCard() {
  const [loading, setLoading] = useState(true);
  const [acct, setAcct] = useState(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  // guards to prevent double exchange of the same code
  const handledCodeRef = useRef(null);
  const exchangingRef = useRef(false);

  // iOS Client ID from app.json -> extra.GOOGLE_CLIENT_ID_IOS
  const iosClientId =
    Constants?.expoConfig?.extra?.GOOGLE_CLIENT_ID_IOS ||
    Constants?.manifestExtra?.GOOGLE_CLIENT_ID_IOS;

  // Build the redirect URI **with a single slash** after the scheme
  const scheme =
    Constants?.expoConfig?.scheme ||
    Constants?.manifest?.scheme ||
    undefined;

  // IMPORTANT: single slash (:)/
  const redirectUri = `${scheme}:/oauth2redirect/google`;

  // Google PKCE auth hook (Authorization Code flow)
  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      clientId: iosClientId,
      responseType: 'code', // request code; provider may still return tokens inline
      usePKCE: true,
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      scopes: ['openid', 'email', 'profile'],
      redirectUri,
      extraParams: { prompt: 'select_account' },
    },
    { useProxy: false }
  );

  // Init (load existing account + Apple availability)
  useEffect(() => {
    (async () => {
      const a = await loadAccount();
      setAcct(a);
      try {
        const avail = await AppleAuthentication.isAvailableAsync();
        setAppleAvailable(!!avail);
      } catch {
        setAppleAvailable(false);
      }
      setLoading(false);
    })();
  }, []);

  // Handle the Google auth response
  useEffect(() => {
    (async () => {
      if (!response) return;
      if (response.type !== 'success') {
        setAuthBusy(false);
        return;
      }

      // Prefer inline token (hybrid response) if present
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
        return; // do not attempt code exchange if inline token existed
      }

      // Otherwise, exchange the authorization code manually
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
        // use the SAME verifier saved before opening the browser
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

  const onGoogle = useCallback(async () => {
    if (!iosClientId || !scheme) {
      Alert.alert(
        'Google Sign-In not configured',
        'Missing GOOGLE_CLIENT_ID_IOS or app scheme in app.json.'
      );
      return;
    }
    if (!request) {
      Alert.alert('Google Sign-In', 'Auth request is not ready yet.');
      return;
    }
    if (authBusy) return;
    setAuthBusy(true);
    try {
      if (request?.codeVerifier) {
        await AsyncStorage.setItem(PKCE_VERIFIER_KEY, request.codeVerifier);
      }
      handledCodeRef.current = null;
      exchangingRef.current = false;
      await promptAsync();
    } catch {
      setAuthBusy(false);
      Alert.alert('Google Sign-In', 'Could not start sign-in.');
    }
  }, [iosClientId, scheme, request, promptAsync, authBusy]);

  const onApple = useCallback(async () => {
    try {
      if (!appleAvailable) {
        Alert.alert('Apple Sign-In', 'Not available on this device.');
        return;
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const fullName =
        (credential?.fullName?.givenName || '') +
        (credential?.fullName?.familyName ? ' ' + credential.fullName.familyName : '');
      const mapped = {
        provider: 'apple',
        name: (fullName || '').trim() || 'Apple User',
        email: credential?.email || '',
        picture: '',
        id: credential?.user || '',
        raw: credential,
      };
      await saveAccount(mapped);
      setAcct(mapped);
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') {
        Alert.alert('Apple Sign-In', 'Could not sign in.');
      }
    }
  }, [appleAvailable]);

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
            <View>
              <Text style={[styles.sub, { marginBottom: 6 }]}>Or continue with Apple</Text>
              <Pressable
                onPress={onApple}
                style={({ pressed }) => [
                  styles.appleBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                accessibilityLabel="Continue with Apple"
              >
                <Text style={styles.appleBtnText}>  Sign in with Apple</Text>
              </Pressable>
            </View>
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

  appleBtn: {
    backgroundColor: '#000',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleBtnText: { color: 'white', fontWeight: '900', letterSpacing: 0.3 },

  avatarFallback: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6a5cff',
  },
});
