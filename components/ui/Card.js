// components/ui/Card.js
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

function wrapStringsDeep(node) {
  // Recursively convert any string/number child (at any depth) into <Text>
  if (node == null || typeof node === 'boolean') return null;

  if (typeof node === 'string' || typeof node === 'number') {
    return <Text>{String(node)}</Text>;
  }

  if (Array.isArray(node)) {
    return node.map((c, i) => <React.Fragment key={i}>{wrapStringsDeep(c)}</React.Fragment>);
  }

  if (React.isValidElement(node)) {
    const { children, ...rest } = node.props || {};
    // Only dive if there are children; preserve other props
    if (children !== undefined) {
      return React.cloneElement(node, rest, wrapStringsDeep(children));
    }
    return node;
  }

  // Functions, objects, etc. are left as-is
  return node;
}

export default function Card({ children, style, noShadow = false }) {
  const flat = StyleSheet.flatten(style) || {};

  // Ensure a solid background (fixes "cannot calculate shadow efficiently" warning)
  const bg =
    flat.backgroundColor && flat.backgroundColor !== 'transparent'
      ? flat.backgroundColor
      : '#fff';

  const safeChildren = wrapStringsDeep(children);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bg },
        flat,
        !noShadow && styles.shadow,
      ]}
    >
      {safeChildren}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    // callers can control padding via `style`
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
});
