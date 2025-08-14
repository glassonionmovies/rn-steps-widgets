import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProgressChart({ data = [] }) {
  const max = Math.max(1, ...data);
  const bars = useMemo(() => data.map((v, i) => ({
    key: String(i),
    h: (v / max) * 100,
    v,
  })), [data, max]);

  return (
    <View>
      <View style={styles.chart}>
        {bars.map(b => (
          <View key={b.key} style={styles.barWrap}>
            <View style={[styles.bar, { height: `${b.h}%` }]} />
          </View>
        ))}
      </View>
      <Text style={styles.caption}>
        Best: {Math.max(...data).toFixed(0)} • Last: {data.length ? data[data.length-1].toFixed(0) : 0}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 12,
    backgroundColor: '#10b981',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  caption: { marginTop: 6, color: '#666' },
});
