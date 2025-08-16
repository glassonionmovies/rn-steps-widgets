// components/ui/KPICard.js
import React from 'react';
import { View, Text } from 'react-native';
import Card from './Card';
import { palette, spacing } from '../../theme';

export default function KPICard({ title, value, sub }) {
  return (
    <Card style={{ padding: spacing(1.5), minWidth: 150, flexGrow: 1 }}>
      <Text style={{ color: palette.sub, fontSize: 12, marginBottom: 4 }}>{title}</Text>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: '900' }}>{value}</Text>
      {!!sub && <Text style={{ color: palette.sub, fontSize: 12, marginTop: 4 }}>{sub}</Text>}
    </Card>
  );
}
