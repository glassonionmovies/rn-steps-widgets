// components/ui/Card.js
import React from 'react';
import { View, StyleSheet, Platform, StyleSheet as RNStyleSheet } from 'react-native';

export default function Card({ children, style, noShadow = false }) {
  // Flatten and strip backgroundColor so callers can't remove the solid bg on the shadowed view
  const flat = RNStyleSheet.flatten(style) || {};
  const { backgroundColor: _ignoreBg, ...rest } = flat;

  return (
    <View style={[styles.outer, !noShadow && styles.shadow]}>
      <View style={[styles.inner, rest]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shadow lives on THIS view and it ALWAYS has a solid bg
  outer: {
    backgroundColor: '#fff',   // solid color = efficient shadow path
    borderRadius: 12,
    // (No padding here—put padding on inner so the shadowed view's bg stays solid)
  },
  // Content wrapper: gets user styles (minus backgroundColor)
  inner: {
    borderRadius: 12,
    padding: 12,
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    ...(Platform.OS === 'android' ? { elevation: 4 } : null),
  },
});
