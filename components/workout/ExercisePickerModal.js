// components/workout/ExercisePickerModal.js
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  SectionList,
  Pressable,
} from 'react-native';
import Card from '../ui/Card';
import { palette, spacing } from '../../theme';

// ---- Your catalog (grouped) ----
const CATALOG = [
  {
    id: 1,
    name: 'Chest',
    exercises: [
      { name: 'Bench Press', icon: '🏋️‍♂️' },
      { name: 'Incline Dumbbell Press', icon: '💪' },
      { name: 'Push-ups', icon: '🤸‍♂️' },
      { name: 'Dumbbell Flyes', icon: '👐' },
      { name: 'Dips (Chest Version)', icon: '🤸‍♂️' },
    ],
  },
  {
    id: 2,
    name: 'Back',
    exercises: [
      { name: 'Deadlift', icon: '🏋️‍♂️' },
      { name: 'Pull-ups', icon: '🤸‍♂️' },
      { name: 'Bent-over Row', icon: '🏋️‍♂️' },
      { name: 'Lat Pulldown', icon: '👇' },
      { name: 'Seated Cable Row', icon: '↔️' },
    ],
  },
  {
    id: 3,
    name: 'Shoulders',
    exercises: [
      { name: 'Barbell Overhead Press (Standing)', icon: '🏋️‍♂️' },
      { name: 'Seated Dumbbell Shoulder Press', icon: '💪' },
      { name: 'Barbell Overhead Press (Seated)', icon: '🏋️‍♂️' },
      { name: 'Dumbbell Lateral Raise', icon: '👐' },
      { name: 'Face Pulls', icon: '🪢' },
      { name: 'Arnold Press', icon: '💪' },
    ],
  },
  {
    id: 4,
    name: 'Arms',
    exercises: [
      { name: 'Barbell Curl', icon: '💪' },
      { name: 'Dumbbell Hammer Curl', icon: '🔨' },
      { name: 'Tricep Pushdown', icon: '👇' },
      { name: 'Skull Crushers', icon: '💀' },
      { name: 'Close-Grip Bench Press', icon: '🏋️‍♂️' },
    ],
  },
  {
    id: 5,
    name: 'Legs',
    exercises: [
      { name: 'Barbell Squat', icon: '🏋️‍♀️' },
      { name: 'Leg Press', icon: '🦵' },
      { name: 'Romanian Deadlift', icon: '🏋️‍♂️' },
      { name: 'Lunges', icon: '🚶‍♂️' },
      { name: 'Calf Raises', icon: '📈' },
    ],
  },
  {
    id: 6,
    name: 'Abs',
    exercises: [
      { name: 'Plank', icon: '🧘‍♀️' },
      { name: 'Leg Raises', icon: '🦵' },
      { name: 'Crunches', icon: '💪' },
      { name: 'Russian Twist', icon: '🔄' },
      { name: 'Hanging Knee Raises', icon: '🤸‍♂️' },
    ],
  },
];

// ---- Helpers ----
function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function ExercisePickerModal({ visible, onClose, onPick }) {
  const [q, setQ] = useState('');

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = CATALOG.map(group => {
      let data = group.exercises.map(ex => ({
        id: `${slugify(group.name)}__${slugify(ex.name)}`,
        name: ex.name,
        icon: ex.icon,
        muscleGroup: group.name, // <-- used by TrackWorkout
        _search: `${group.name} ${ex.name}`.toLowerCase(),
      }));
      if (needle) data = data.filter(x => x._search.includes(needle));
      return { title: group.name, data };
    });
    // If searching, drop empty sections
    return needle ? base.filter(s => s.data.length > 0) : base;
  }, [q]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, padding: spacing(2), backgroundColor: '#fff' }}>
        <TextInput
          placeholder="Search exercises or muscle group"
          value={q}
          onChangeText={setQ}
          style={{
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: spacing(1.5),
          }}
          autoFocus
          returnKeyType="search"
        />

        {/* SectionList is fine (we're not inside a ScrollView) */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                color: palette.sub,
                fontSize: 12,
                textTransform: 'uppercase',
                marginTop: spacing(1),
                marginBottom: spacing(0.5),
              }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onPick?.({
                  id: item.id,
                  name: item.name,
                  muscleGroup: item.muscleGroup,
                  icon: item.icon,
                });
                onClose?.();
              }}
            >
              <Card style={{ padding: spacing(1.5), marginBottom: spacing(1) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: palette.text }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: palette.sub }}>{item.muscleGroup}</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          stickySectionHeadersEnabled={false}
        />

        <Pressable onPress={onClose} style={{ alignSelf: 'center', marginTop: spacing(1) }}>
          <Text style={{ fontSize: 16 }}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
