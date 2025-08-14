import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './ui/Card';
import { palette, spacing } from '../theme';

export default function StatCard({ label, value, sublabel, footer }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {!!sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
      {!!footer && <Text style={styles.footer}>{footer}</Text>}
    </Card>
  );
}
const styles = StyleSheet.create({
  card:{ flex:1, margin: spacing(1) },
  label:{ color: palette.sub, fontSize:16, marginBottom: 4 },
  value:{ color: palette.text, fontSize:36, fontWeight:'800' },
  sublabel:{ color: palette.sub, marginTop:4 },
  footer:{ color: '#22c55e', marginTop: spacing(1), fontWeight:'600' },
});

