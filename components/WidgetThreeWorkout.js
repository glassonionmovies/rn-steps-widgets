// components/WidgetThreeWorkout.js
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Keyboard, Platform, Pressable, ScrollView
} from 'react-native';

const DEFAULT_EXERCISES = [
  'Back Squat',
  'Front Squat',
  'Bench Press',
  'Incline Bench',
  'Overhead Press',
  'Deadlift',
  'Romanian Deadlift',
  'Barbell Row',
  'Pull-up (assisted)',
  'Dumbbell Bench',
];

function epley1RM(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return Math.round(w * (1 + r / 30));
}

export default function WidgetThreeWorkout({ initialExercise = 'Back Squat' }) {
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [exercise, setExercise] = useState(initialExercise);
  const [sets, setSets] = useState([{ weight: '', reps: '' }]);

  const rows = useMemo(
    () => sets.map((s) => ({ ...s, oneRM: epley1RM(s.weight, s.reps) })),
    [sets]
  );

  function updateSet(idx, field, value) {
    setSets((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value.replace(/[^0-9.]/g, '') };
      return next;
    });
  }

  function addSet() {
    setSets((prev) => [...prev, { weight: '', reps: '' }]);
    Keyboard.dismiss();
  }

  function removeSet(idx) {
    setSets((prev) => prev.filter((_, i) => i !== idx));
  }

  function pickExercise(name) {
    setExercise(name);
    setExerciseOpen(false);
  }

  const best1RM = rows.length ? Math.max(...rows.map((r) => r.oneRM || 0)) : 0;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Workout Tracker</Text>

        <Pressable
          onPress={() => setExerciseOpen((o) => !o)}
          style={styles.dropdownBtn}
          accessibilityRole="button"
          accessibilityLabel="Choose exercise"
        >
          <Text style={styles.dropdownBtnText} numberOfLines={1}>
            {exercise}
          </Text>
          <Text style={styles.dropdownCaret}>{exerciseOpen ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      {/* Dropdown */}
      {exerciseOpen ? (
        <View style={styles.dropdown}>
          <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
            {DEFAULT_EXERCISES.map((name) => (
              <TouchableOpacity key={name} onPress={() => pickExercise(name)} style={styles.dropdownItem}>
                <Text style={styles.dropdownItemText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 1.1 }]}>Set</Text>
        <Text style={[styles.th, { flex: 1.2 }]}>Weight</Text>
        <Text style={[styles.th, { flex: 1.0 }]}>Reps</Text>
        <Text style={[styles.th, { flex: 1.0 }]}>1RM</Text>
        <Text style={[styles.th, { width: 44, textAlign: 'right' }]}>{' '}</Text>
      </View>

      {/* Rows */}
      <ScrollView keyboardShouldPersistTaps="handled">
        {rows.map((row, idx) => (
          <View key={String(idx)} style={styles.row}>
            <Text style={[styles.td, { flex: 1.1 }]}>{String(idx + 1)}</Text>

            <TextInput
              style={[styles.input, { flex: 1.2 }]}
              keyboardType="decimal-pad"
              placeholder="kg"
              value={String(row.weight)}
              onChangeText={(v) => updateSet(idx, 'weight', v)}
              returnKeyType="next"
            />

            <TextInput
              style={[styles.input, { flex: 1.0 }]}
              keyboardType="number-pad"
              placeholder="reps"
              value={String(row.reps)}
              onChangeText={(v) => updateSet(idx, 'reps', v)}
              returnKeyType="done"
            />

            <Text style={[styles.td, { flex: 1.0 }]}>{row.oneRM ? String(row.oneRM) : '-'}</Text>

            <TouchableOpacity
              onPress={() => removeSet(idx)}
              style={styles.removeBtn}
              accessibilityLabel={`Remove set ${idx + 1}`}
            >
              <Text style={styles.removeBtnText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={addSet} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Add set">
          <Text style={styles.addBtnText}>Add Set</Text>
        </TouchableOpacity>

        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            Sets: {String(rows.length)} • Best 1RM: {String(best1RM)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    padding: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', flex: 1 },

  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f1f5ff',
    borderRadius: 8,
  },
  dropdownBtnText: { fontSize: 14, color: '#1f3d7a' },
  dropdownCaret: { fontSize: 12, color: '#1f3d7a', marginLeft: 6 },

  dropdown: {
    marginTop: 6,
    backgroundColor: '#f9fbff',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dde6ff',
  },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10 },
  dropdownItemText: { fontSize: 14, color: '#1f3d7a' },

  tableHeader: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6e6e6',
  },
  th: { fontSize: 12, fontWeight: '600', color: '#555' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
  },
  td: { fontSize: 14, color: '#222' },

  input: {
    backgroundColor: '#f7f7f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.select({ ios: 8, android: 6 }),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    fontSize: 14,
    color: '#222',
  },

  removeBtn: {
    width: 44,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffecec',
    marginLeft: 6,
  },
  removeBtnText: { color: '#cc2a2a', fontSize: 18, fontWeight: '700', lineHeight: 18 },

  footer: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  addBtn: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#1f7aed', borderRadius: 10 },
  addBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },

  summary: { marginLeft: 'auto' },
  summaryText: { fontSize: 12, color: '#666' },
});
