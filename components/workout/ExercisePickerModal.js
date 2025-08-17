// components/workout/ExercisePickerModal.js
import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { palette, spacing } from '../../theme';

const GROUPS = [
  {
    id: 1,
    name: 'Chest',
    exercises: [
      { name: 'Bench Press', icon: '🏋️‍♂️', equipment: 'Barbell' },
      { name: 'Incline Dumbbell Press', icon: '💪', equipment: 'Dumbbell' },
      { name: 'Push-ups', icon: '🤸‍♂️', equipment: 'Bodyweight' },
      { name: 'Dumbbell Flyes', icon: '👐', equipment: 'Dumbbell' },
      { name: 'Dips (Chest Version)', icon: '🤸‍♂️', equipment: 'Bodyweight' },
    ],
  },
  {
    id: 2,
    name: 'Back',
    exercises: [
      { name: 'Deadlift', icon: '🏋️‍♂️', equipment: 'Barbell' },
      { name: 'Pull-ups', icon: '🤸‍♂️', equipment: 'Bodyweight' },
      { name: 'Bent-over Row', icon: '🏋️‍♂️', equipment: 'Barbell' },
      { name: 'Lat Pulldown', icon: '👇', equipment: 'Bodyweight' },   // non-barbell (cable)
      { name: 'Seated Cable Row', icon: '↔️', equipment: 'Bodyweight' }, // non-barbell (cable)
    ],
  },
  {
    id: 3,
    name: 'Shoulders',
    exercises: [
      { name: 'Barbell Overhead Press (Standing)', icon: '🏋️‍♂️', equipment: 'Barbell' },
      { name: 'Seated Dumbbell Shoulder Press', icon: '💪', equipment: 'Dumbbell' },
      { name: 'Barbell Overhead Press (Seated)', icon: '🏋️‍♂️', equipment: 'Barbell' },
      { name: 'Dumbbell Lateral Raise', icon: '👐', equipment: 'Dumbbell' },
      { name: 'Face Pulls', icon: '🪢', equipment: 'Bodyweight' }, // cable
      { name: 'Arnold Press', icon: '💪', equipment: 'Dumbbell' },
    ],
  },
  {
    id: 4,
    name: 'Arms',
    exercises: [
      { name: 'Barbell Curl', icon: '💪', equipment: 'Barbell' },
      { name: 'Dumbbell Hammer Curl', icon: '🔨', equipment: 'Dumbbell' },
      { name: 'Tricep Pushdown', icon: '👇', equipment: 'Bodyweight' }, // cable
      { name: 'Skull Crushers', icon: '💀', equipment: 'Barbell' },
      { name: 'Close-Grip Bench Press', icon: '🏋️‍♂️', equipment: 'Barbell' },
    ],
  },
  {
    id: 5,
    name: 'Legs',
    exercises: [
      { name: 'Barbell Squat', icon: '🏋️‍♀️', equipment: 'Barbell' },
      { name: 'Leg Press', icon: '🦵', equipment: 'Bodyweight' }, // machine
      { name: 'Romanian Deadlift', icon: '🏋️‍♂️', equipment: 'Barbell' },
      { name: 'Lunges', icon: '🚶‍♂️', equipment: 'Dumbbell' }, // common variant
      { name: 'Calf Raises', icon: '📈', equipment: 'Dumbbell' }, // can vary, keep non-barbell
    ],
  },
  {
    id: 6,
    name: 'Abs',
    exercises: [
      { name: 'Plank', icon: '🧘‍♀️', equipment: 'Bodyweight' },
      { name: 'Leg Raises', icon: '🦵', equipment: 'Bodyweight' },
      { name: 'Crunches', icon: '💪', equipment: 'Bodyweight' },
      { name: 'Russian Twist', icon: '🔄', equipment: 'Bodyweight' },
      { name: 'Hanging Knee Raises', icon: '🤸‍♂️', equipment: 'Bodyweight' },
    ],
  },
];

export default function ExercisePickerModal({ visible, onClose, onPick }) {
  const pick = (group, ex) => {
    // Provide a stable id for exercise based on group + name
    const id = `${group.id}:${ex.name}`;
    onPick?.({ id, name: ex.name, icon: ex.icon, muscleGroup: group.name, equipment: ex.equipment });
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Exercise</Text>
            <Pressable onPress={onClose} hitSlop={10}><Text style={{ color: palette.sub, fontWeight: '700' }}>Close</Text></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: spacing(2) }}>
            {GROUPS.map((g) => (
              <View key={g.id} style={{ marginBottom: spacing(1.5) }}>
                <Text style={styles.groupTitle}>{g.name}</Text>
                <View style={{ marginTop: 6 }}>
                  {g.exercises.map((ex) => (
                    <Pressable
                      key={ex.name}
                      onPress={() => pick(g, ex)}
                      style={styles.row}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {!!ex.icon && <Text style={{ fontSize: 16 }}>{ex.icon}</Text>}
                        <Text style={styles.rowText}>{ex.name}</Text>
                      </View>

                      <View style={styles.equipChip}>
                        <Text style={styles.equipChipText}>{ex.equipment}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing(2),
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1) },
  title: { color: palette.text, fontSize: 18, fontWeight: '900' },

  groupTitle: { color: palette.text, fontSize: 14, fontWeight: '800', opacity: 0.8 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { color: palette.text, fontWeight: '700' },

  equipChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  equipChipText: { color: palette.sub, fontWeight: '700', fontSize: 12 },
});
