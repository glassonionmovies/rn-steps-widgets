// components/workout/ExercisePickerModal.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette, spacing } from '../../theme';

const CATALOG_KEY = 'catalog:exercises';
const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs'];

// ---- Default catalog (seed after data wipe) ----
const DEFAULT_EXERCISE_LIST = [
  // Chest
  { id: 'bench_press', name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell', icon: '🏋️‍♂️' },
  { id: 'incline_db_press', name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbells', icon: '💪' },
  { id: 'push_ups', name: 'Push-ups', muscleGroup: 'Chest', equipment: 'Bodyweight', icon: '🤸' },
  { id: 'db_flyes', name: 'Dumbbell Flyes', muscleGroup: 'Chest', equipment: 'Dumbbells', icon: '👐' },
  { id: 'dips_chest', name: 'Dips (Chest Version)', muscleGroup: 'Chest', equipment: 'Bodyweight', icon: '🤸' },

  // Back
  { id: 'deadlift', name: 'Deadlift', muscleGroup: 'Back', equipment: 'Barbell', icon: '🏋️‍♂️' },
  { id: 'pull_ups', name: 'Pull-ups', muscleGroup: 'Back', equipment: 'Bodyweight', icon: '🧗' },
  { id: 'bent_over_row', name: 'Bent-over Row', muscleGroup: 'Back', equipment: 'Barbell', icon: '🏋️‍♂️' },
  { id: 'lat_pulldown', name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable', icon: '🎣' },
  { id: 'seated_row', name: 'Seated Cable Row', muscleGroup: 'Back', equipment: 'Machine', icon: '🧲' },

  // Shoulders
  { id: 'ohp', name: 'Barbell Overhead Press (Standing)', muscleGroup: 'Shoulders', equipment: 'Barbell', icon: '🛠️' },
  { id: 'db_shoulder_press', name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbells', icon: '💪' },
  { id: 'lateral_raise', name: 'Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbells', icon: '↔️' },
  { id: 'rear_delt_fly', name: 'Rear Delt Fly', muscleGroup: 'Shoulders', equipment: 'Dumbbells', icon: '🪽' },

  // Arms
  { id: 'barbell_curl', name: 'Barbell Curl', muscleGroup: 'Arms', equipment: 'Barbell', icon: '💪' },
  { id: 'db_curl', name: 'Dumbbell Curl', muscleGroup: 'Arms', equipment: 'Dumbbells', icon: '💪' },
  { id: 'triceps_pushdown', name: 'Triceps Pushdown', muscleGroup: 'Arms', equipment: 'Cable', icon: '🧵' },
  { id: 'skull_crushers', name: 'Skull Crushers', muscleGroup: 'Arms', equipment: 'Barbell', icon: '💀' },

  // Legs
  { id: 'back_squat', name: 'Back Squat', muscleGroup: 'Legs', equipment: 'Barbell', icon: '🏋️‍♂️' },
  { id: 'front_squat', name: 'Front Squat', muscleGroup: 'Legs', equipment: 'Barbell', icon: '🏋️' },
  { id: 'rdl', name: 'Romanian Deadlift', muscleGroup: 'Legs', equipment: 'Barbell', icon: '🧱' },
  { id: 'leg_press', name: 'Leg Press', muscleGroup: 'Legs', equipment: 'Machine', icon: '🦵' },
  { id: 'lunges', name: 'Lunges', muscleGroup: 'Legs', equipment: 'Dumbbells', icon: '🚶' },
  { id: 'leg_extension', name: 'Leg Extension', muscleGroup: 'Legs', equipment: 'Machine', icon: '🦿' },
  { id: 'hamstring_curl', name: 'Hamstring Curl', muscleGroup: 'Legs', equipment: 'Machine', icon: '🧵' },

  // Abs
  { id: 'plank', name: 'Plank', muscleGroup: 'Abs', equipment: 'Bodyweight', icon: '➖' },
  { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', muscleGroup: 'Abs', equipment: 'Bar', icon: '🪜' },
  { id: 'crunch', name: 'Crunch', muscleGroup: 'Abs', equipment: 'Bodyweight', icon: '🌊' },
];

export default function ExercisePickerModal({
  visible,
  onClose,
  onPick,
  initialGroup, // optional quick scroll target
}) {
  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState('');

  const scrollRef = useRef(null);
  const sectionRefs = useRef({}); // group -> y offset

  // Load/seed catalog
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CATALOG_KEY);
        let list = [];
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed;
        }
        if (!Array.isArray(list) || list.length === 0) {
          list = DEFAULT_EXERCISE_LIST;
          await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(list));
        }
        if (mounted) setCatalog(list);
      } catch {
        if (mounted) setCatalog(DEFAULT_EXERCISE_LIST);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // When opened with an initial group, scroll there
  useEffect(() => {
    if (!visible || !initialGroup) return;
    const y = sectionRefs.current[initialGroup];
    if (y != null && scrollRef.current?.scrollTo) {
      setTimeout(() => {
        scrollRef.current.scrollTo({ y, animated: true });
      }, 50);
    }
  }, [visible, initialGroup]);

  const list = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return catalog;
    return (catalog || []).filter(
      (ex) =>
        (ex.name || '').toLowerCase().includes(q) ||
        (ex.muscleGroup || '').toLowerCase().includes(q) ||
        (ex.equipment || '').toLowerCase().includes(q)
    );
  }, [catalog, query]);

  const grouped = useMemo(() => {
    const groups = new Map();
    GROUPS.forEach((g) => groups.set(g, []));
    (list || []).forEach((ex) => {
      const g = GROUPS.includes(ex.muscleGroup) ? ex.muscleGroup : 'Other';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(ex);
    });
    return Array.from(groups.entries()).filter(([, arr]) => arr.length > 0);
  }, [list]);

  const pick = (ex) => {
    onPick?.(ex);
    onClose?.();
  };

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      transparent={false}
    >
      <SafeAreaView style={styles.container}>
        {/* Search */}
        <View style={{ paddingHorizontal: spacing(2), paddingBottom: spacing(1) }}>
          <TextInput
            placeholder="Search exercises or muscle group"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* List with section headers */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: spacing(2), paddingBottom: spacing(2) }}
        >
          {grouped.length === 0 ? (
            <Text style={{ color: palette.sub, paddingHorizontal: spacing(2) }}>No matches.</Text>
          ) : (
            grouped.map(([g, arr]) => (
              <View
                key={g}
                onLayout={(e) => {
                  sectionRefs.current[g] = e.nativeEvent.layout.y - 8;
                }}
              >
                <Text style={styles.sectionHeader}>{g.toUpperCase()}</Text>
                {arr.map((ex) => (
                  <Pressable
                    key={ex.id}
                    onPress={() => pick(ex)}
                    style={styles.row}
                    android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {!!ex.icon && <Text style={{ fontSize: 18 }}>{ex.icon}</Text>}
                      <View>
                        <Text style={{ color: palette.text, fontWeight: '800' }}>{ex.name}</Text>
                        <Text style={{ color: palette.sub, fontSize: 12 }}>
                          {ex.muscleGroup} • {ex.equipment}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: palette.sub, fontSize: 18 }}>{'›'}</Text>
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </ScrollView>

        {/* Footer Cancel */}
        <Pressable style={styles.cancel} onPress={onClose} hitSlop={8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // full-screen white like native picker
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: palette.text,
    backgroundColor: '#fff',
  },
  sectionHeader: {
    color: palette.sub,
    fontSize: 12,
    marginTop: spacing(1.5),
    marginBottom: spacing(0.5),
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    // subtle shadow (iOS) / border (Android) for card-like rows
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.08)',
      },
    }),
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  cancelText: { color: palette.text, fontWeight: '700' },
});
