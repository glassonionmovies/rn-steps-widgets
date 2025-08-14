import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

const GROUPS = [
  'Full Body','Chest','Back','Shoulders','Arms','Legs','Glutes','Core'
];

export default function MuscleGroupSelector({ value, onChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {GROUPS.map((g) => {
        const active = g === value;
        return (
          <TouchableOpacity
            key={g}
            onPress={() => onChange(g)}
            style={[styles.pill, active && styles.pillActive]}
            accessibilityRole="button"
            accessibilityLabel={`Select ${g}`}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{g}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#c7d2fe',
  },
  pillActive: {
    backgroundColor: '#1f7aed',
    borderColor: '#1f7aed',
  },
  pillText: { color: '#1e3a8a', fontWeight: '600' },
  pillTextActive: { color: 'white' },
});
