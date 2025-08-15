// screens/TrackWorkoutScreen.js
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import { palette, spacing, layout } from '../theme';

const EXERCISES = [
  'Bench Press',
  'Back Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Dumbbell Bench',
  'Lat Pulldown',
  'Leg Press',
  'Bicep Curl',
  'Tricep Pushdown',
];

const epley1RM = (w, r) => {
  const weight = Number(w) || 0;
  const reps = Number(r) || 0;
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
};

export default function TrackWorkoutScreen({ navigation }) {
  const [exercise, setExercise] = useState(EXERCISES[0]);
  const [sets, setSets] = useState([{ id: 1, weight: '', reps: '' }]);

  const addSet = () => {
    setSets((s) => [...s, { id: Date.now(), weight: '', reps: '' }]);
  };

  const updateSet = (id, field, value) => {
    setSets((s) => s.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const removeSet = (id) => setSets((s) => s.filter((row) => row.id !== id));

  const totals = useMemo(() => {
    const numbers = sets.map((s) => ({
      w: Number(s.weight) || 0,
      r: Number(s.reps) || 0,
      rm: epley1RM(s.weight, s.reps),
    }));
    const volume = numbers.reduce((sum, x) => sum + x.w * x.r, 0);
    const best1RM = numbers.reduce((max, x) => Math.max(max, x.rm), 0);
    return { volume, best1RM };
  }, [sets]);

  const saveWorkout = () => {
    // TODO: persist to storage or backend
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: layout.screenHMargin,
            paddingTop: spacing(2),
            paddingBottom: spacing(4),
            gap: spacing(2),
          }}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Ionicons name="barbell-outline" size={24} color={palette.accent2} />
            <Text style={styles.title}>Track Workout</Text>
          </View>
          <Text style={styles.subtitle}>Log sets and we’ll estimate your 1RM automatically.</Text>

          {/* Exercise Picker */}
          <Card>
            <Text style={styles.sectionTitle}>Exercise</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ columnGap: 8 }}
            >
              {EXERCISES.map((name) => {
                const active = name === exercise;
                return (
                  <GradientButton
                    key={name}
                    title={name}
                    onPress={() => setExercise(name)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 12,
                      transform: [{ scale: active ? 1 : 0.98 }],
                      opacity: active ? 1 : 0.75,
                    }}
                  />
                );
              })}
            </ScrollView>
          </Card>

          {/* Sets Table */}
          <Card>
            <Text style={styles.sectionTitle}>Sets</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1 }]}>#</Text>
              <Text style={[styles.th, { flex: 2 }]}>Weight</Text>
              <Text style={[styles.th, { flex: 2 }]}>Reps</Text>
              <Text style={[styles.th, { flex: 2 }]}>Est. 1RM</Text>
              <Text style={[styles.th, { width: 28 }]}></Text>
            </View>

            {sets.map((s, idx) => {
              const rm = epley1RM(s.weight, s.reps);
              return (
                <View key={s.id} style={styles.row}>
                  <Text style={[styles.cell, { flex: 1 }]}>{idx + 1}</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="kg"
                    value={String(s.weight)}
                    onChangeText={(t) => updateSet(s.id, 'weight', t.replace(/[^0-9.]/g, ''))}
                    style={[styles.input, { flex: 2 }]}
                  />
                  <TextInput
                    keyboardType="numeric"
                    placeholder="reps"
                    value={String(s.reps)}
                    onChangeText={(t) => updateSet(s.id, 'reps', t.replace(/[^0-9]/g, ''))}
                    style={[styles.input, { flex: 2 }]}
                  />
                  <Text style={[styles.cell, { flex: 2, fontWeight: '700' }]}>{rm || '-'}</Text>
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color="#999"
                    onPress={() => removeSet(s.id)}
                    style={{ width: 28, textAlign: 'right', padding: 4 }}
                    accessibilityLabel={`Remove set ${idx + 1}`}
                  />
                </View>
              );
            })}

            <View style={{ marginTop: spacing(1) }}>
              <GradientButton title="Add Set" onPress={addSet} />
            </View>
          </Card>

          {/* Summary */}
          <Card>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Exercise</Text>
              <Text style={styles.summaryValue}>{exercise}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Volume</Text>
              <Text style={styles.summaryValue}>{totals.volume} kg⋅reps</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Best Est. 1RM</Text>
              <Text style={styles.summaryValue}>{totals.best1RM} kg</Text>
            </View>

            <View style={{ marginTop: spacing(1) }}>
              <GradientButton title="Save Workout" onPress={saveWorkout} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: palette.accent2, fontSize: 28, fontWeight: '900' },
  subtitle: { color: palette.sub, marginTop: 4, fontSize: 14 },

  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing(1),
  },

  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  th: { color: palette.sub, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  cell: { color: palette.text, fontSize: 16 },

  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: palette.text,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: { color: palette.sub, fontSize: 14 },
  summaryValue: { color: palette.text, fontSize: 16, fontWeight: '700' },
});
