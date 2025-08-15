// screens/TrackWorkoutScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import { palette, spacing } from '../theme';
import ExercisePickerModal from '../components/workout/ExercisePickerModal';
import SetRow from '../components/workout/SetRow';
import RestTimer from '../components/workout/RestTimer';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { saveWorkout, computeSummary, getWorkoutById } from '../store/workoutStore';

export default function TrackWorkoutScreen() {
  const route = useRoute();
  const editingId = route?.params?.workoutId || null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [units, setUnits] = useState('lb');
  const [blocks, setBlocks] = useState([]);
  const [workoutId, setWorkoutId] = useState(editingId || uuidv4());
  const [startedAt, setStartedAt] = useState(Date.now());
  const restRef = useRef(null);

  // Hydrate when editing an existing workout
  useEffect(() => {
    let cancelled = false;
    if (editingId) {
      (async () => {
        const existing = await getWorkoutById(editingId);
        if (existing && !cancelled) {
          setBlocks(existing.blocks || []);
          setUnits(existing.units || 'lb');
          setStartedAt(existing.startedAt || Date.now());
          setWorkoutId(existing.id);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const total = useMemo(() => {
    const volume = blocks.reduce(
      (acc, b) =>
        acc +
        (b.sets || []).reduce(
          (s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0),
          0
        ),
      0
    );
    return { volume };
  }, [blocks]);

  function addExercise(ex) {
    // Create the block with the FIRST EMPTY SET immediately
    setBlocks((prev) => [
      ...prev,
      { id: uuidv4(), exercise: ex, sets: [{ id: uuidv4(), weight: 0, reps: 0 }] },
    ]);
  }

  // Helper: detect an "empty" set
  const isEmptySet = (s) =>
    (Number(s?.weight) || 0) === 0 && (Number(s?.reps) || 0) === 0;

  // When a set is edited:
  // - update its values
  // - if it transitions from invalid -> valid and there is NO existing empty set in this block,
  //   append exactly one trailing empty set
  function patchSet(blockId, setId, patch) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;

        const idx = b.sets.findIndex((s) => s.id === setId);
        if (idx === -1) return b;

        const before = b.sets[idx];
        const after = { ...before, ...patch };

        const wasValid = (Number(before.weight) || 0) > 0 && (Number(before.reps) || 0) > 0;
        const isValid = (Number(after.weight) || 0) > 0 && (Number(after.reps) || 0) > 0;

        const setsUpdated = b.sets.slice();
        setsUpdated[idx] = after;

        let outSets = setsUpdated;

        // If became valid and there is no empty set currently present, add one
        if (!wasValid && isValid) {
          const hasEmpty = setsUpdated.some(isEmptySet);
          if (!hasEmpty) {
            outSets = [...setsUpdated, { id: uuidv4(), weight: 0, reps: 0 }];
          }
          // Start rest timer on first valid completion
          restRef.current?.start?.();
        }

        return { ...b, sets: outSets };
      })
    );
  }

  function removeSet(blockId, setId) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, sets: b.sets.filter((s) => s.id !== setId) }
          : b
      )
    );
  }

  async function finish() {
    // Clean: drop any all-zero sets, then drop any blocks that have no sets left
    const cleanedBlocks = blocks
      .map((b) => ({ ...b, sets: (b.sets || []).filter((s) => !isEmptySet(s)) }))
      .filter((b) => (b.sets || []).length > 0);

    if (cleanedBlocks.length === 0) {
      Alert.alert('Nothing to save', 'Please enter at least one non-zero set.');
      return;
    }

    const payload = {
      id: workoutId,
      startedAt,
      finishedAt: Date.now(),
      units,
      blocks: cleanedBlocks,
    };

    await saveWorkout(payload); // override if same id
    const s = computeSummary(payload);
    Alert.alert(
      'Workout saved',
      `Exercises: ${s.exercises}\nSets: ${s.totalSets}\nVolume: ${s.totalVolume.toFixed(
        0
      )} ${units}\nDuration: ${s.durationMin} min`
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing(2), rowGap: spacing(1.5) }}
        >
          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Exercises</Text>

            {blocks.length === 0 ? (
              <Text style={{ opacity: 0.7 }}>
                No exercises yet. Add one to begin.
              </Text>
            ) : null}

            {blocks.map((b) => (
              <View key={b.id} style={{ marginBottom: spacing(2) }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: spacing(1),
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!!b.exercise?.icon && (
                      <Text style={{ fontSize: 18, marginRight: 8 }}>
                        {b.exercise.icon}
                      </Text>
                    )}
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: palette.text,
                      }}
                    >
                      {b.exercise?.name || 'Exercise'}
                    </Text>
                  </View>

                  {/* Removed the Add set button by request */}
                </View>

                {/* Sets */}
                {b.sets.map((s, i) => (
                  <SetRow
                    key={s.id}
                    index={i}
                    set={s}
                    onChange={(patch) => patchSet(b.id, s.id, patch)}
                    onRemove={() => removeSet(b.id, s.id)}
                  />
                ))}
              </View>
            ))}

            <GradientButton
              title="Add Exercise"
              onPress={() => setPickerOpen(true)}
            />
          </Card>

          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Rest</Text>
            <RestTimer ref={restRef} seconds={90} />
          </Card>

          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Session</Text>
            <Text style={{ opacity: 0.7, marginBottom: spacing(1) }}>
              Total volume: {total.volume.toFixed(0)} {units}
            </Text>
            <GradientButton title="Finish & Save" onPress={finish} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
});
