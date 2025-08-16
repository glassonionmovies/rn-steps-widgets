// components/ui/Card.js
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

function wrapStringsDeep(node) {
  if (node == null || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return <Text>{String(node)}</Text>;
  if (Array.isArray(node)) {
    return node.map((c, i) => <React.Fragment key={i}>{wrapStringsDeep(c)}</React.Fragment>);
  }
  if (React.isValidElement(node)) {
    const { children, ...rest } = node.props || {};
    return children !== undefined ? React.cloneElement(node, rest, wrapStringsDeep(children)) : node;
  }
  return node;
}

function isOpaque(color) {
  if (typeof color !== 'string') return false;
  const c = color.trim().toLowerCase();
  if (c === 'transparent') return false;

  // rgba()/hsla()
  const m = c.match(/^(rgba|hsla?)\(([^)]+)\)$/);
  if (m) {
    const parts = m[2].split(',').map(s => s.trim());
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    return a >= 1;
  }
  // #rrggbbaa
  if (c.startsWith('#') && c.length === 9) {
    const aa = parseInt(c.slice(7, 9), 16) / 255;
    return aa >= 1;
  }
  // #rgb, #rrggbb, named colors -> treat as opaque
  return true;
}

export default function Card({ children, style, noShadow = false }) {
  const flat = StyleSheet.flatten(style) || {};
  const { backgroundColor: callerBg, borderRadius: callerRadius, ...rest } = flat;

  // Solid background for proper iOS shadow rasterization
  const bg = callerBg && isOpaque(callerBg) ? callerBg : '#fff';
  const radius = callerRadius ?? 16;

  const safeChildren = wrapStringsDeep(children);

  if (noShadow) {
    return (
      <View style={[styles.inner, { backgroundColor: bg, borderRadius: radius }, rest]}>
        {safeChildren}
      </View>
    );
  }

  // Shadow lives on an outer wrapper that ALSO has a solid bg & same radius
  return (
    <View
      style={[
        styles.shadowWrap,
        styles.shadow,
        { backgroundColor: bg, borderRadius: radius },
      ]}
    >
      <View style={[styles.inner, { backgroundColor: bg, borderRadius: radius }, rest]}>
        {safeChildren}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    // solid bg + radius set dynamically
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  inner: {
    // padding controlled by caller via `style`
  },
});
