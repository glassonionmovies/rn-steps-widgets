// screens/TrackWorkoutScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import WorkoutSessionSummary from '../components/workout/WorkoutSessionSummary';

import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import { palette, spacing } from '../theme';
import ExercisePickerModal from '../components/workout/ExercisePickerModal';
import SetRow from '../components/workout/SetRow';
import RestTimer from '../components/workout/RestTimer';
import PlateCalculatorModal from '../components/workout/PlateCalculatorModal';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import {
  saveWorkout,
  computeSummary,
  getWorkoutById,
  getPrevSetsForExercise,
} from '../store/workoutStore';

function isBarbellExercise(ex) {
  const eq = (ex?.equipment || '').toLowerCase();
  if (eq === 'barbell') return true;
  // fallback for legacy entries without `equipment`
  const name = (ex?.name || '').toLowerCase();
  return /bench|deadlift|squat|barbell|row|press|ohp/.test(name);
}

export default function TrackWorkoutScreen() {
  const route = useRoute();
  const editingId = route?.params?.workoutId || null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [units, setUnits] = useState('lb');
  const [blocks, setBlocks] = useState([]);
  const [workoutId, setWorkoutId] = useState(editingId || uuidv4());
  const [startedAt, setStartedAt] = useState(Date.now());

  const [plateBlockId, setPlateBlockId] = useState(null);

  const restRef = useRef(null);
  const [restTrigger, setRestTrigger] = useState(0);
  useEffect(() => {
    if (restTrigger) restRef.current?.start?.();
  }, [restTrigger]);

  // Load workout for editing (attach previous sets)
  useEffect(() => {
    let cancelled = false;
    if (editingId) {
      (async () => {
        const existing = await getWorkoutById(editingId);
        if (existing && !cancelled) {
          const enriched = await Promise.all(
            (existing.blocks || []).map(async (b) => {
              const prevSets = await getPrevSetsForExercise(
                b.exercise?.id,
                existing.startedAt,
                existing.id
              );
              return { ...b, prevSets };
            })
          );
          setBlocks(enriched);
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

  const isEmptySet = (s) =>
    (Number(s?.weight) || 0) === 0 && (Number(s?.reps) || 0) === 0;

  // Add exercise (seed from previous)
  async function addExercise(ex) {
    const prevSets = await getPrevSetsForExercise(ex.id, startedAt, workoutId);
    const setsFromPrev = (prevSets || []).map((ps) => ({
      id: uuidv4(),
      weight: Number(ps.weight) || 0,
      reps: Number(ps.reps) || 0,
    }));
    const initialSets =
      setsFromPrev.length > 0
        ? setsFromPrev
        : [{ id: uuidv4(), weight: 0, reps: 0 }];

    setBlocks((prev) => [
      ...prev,
      { id: uuidv4(), exercise: ex, sets: initialSets, prevSets },
    ]);
  }

  // Patch set; auto-append & trigger rest when last becomes valid/done
  function patchSet(blockId, setId, patch) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;

        const idx = b.sets.findIndex((s) => s.id === setId);
        if (idx === -1) return b;

        const before = b.sets[idx];
        const after = { ...before, ...patch };

        const wasValid =
          (Number(before.weight) || 0) > 0 &&
          (Number(before.reps) || 0) > 0;
        const isValid =
          (Number(after.weight) || 0) > 0 &&
          (Number(after.reps) || 0) > 0;

        const setsUpdated = b.sets.slice();
        setsUpdated[idx] = after;

        const isLastIndex = idx === setsUpdated.length - 1;
        const becameValid = !wasValid && isValid;
        const markedDoneAndValid = !!patch.completedAt && isValid;

        let outSets = setsUpdated;

        const last = setsUpdated[setsUpdated.length - 1];
        const hasEmptyTrailing = last ? isEmptySet(last) : false;

        if (isLastIndex && (becameValid || markedDoneAndValid) && !hasEmptyTrailing) {
          outSets = [...setsUpdated, { id: uuidv4(), weight: 0, reps: 0 }];
          setRestTrigger(Date.now());
        } else if (markedDoneAndValid) {
          setRestTrigger(Date.now());
        }

        return { ...b, sets: outSets };
      })
    );
  }

  function removeSet(blockId, setId) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, sets: b.sets.filter((s) => s.id !== setId) } : b
      )
    );
  }

  // Apply plate-calculated total to the LAST set of that block
  function applyPlateTotal(blockId, total) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        if (!b.sets || b.sets.length === 0) return b;
        const idx = b.sets.length - 1;
        const sets = b.sets.slice();
        sets[idx] = { ...sets[idx], weight: total };
        return { ...b, sets };
      })
    );
  }

  async function finish() {
    const cleanedBlocks = blocks
      .map(({ id, exercise, sets }) => ({
        id,
        exercise,
        sets: (sets || []).filter((s) => !isEmptySet(s)),
      }))
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

    await saveWorkout(payload);
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
          {/* Exercises + Set list */}
          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Exercises</Text>

            {blocks.length === 0 ? (
              <Text style={{ opacity: 0.7 }}>No exercises yet. Add one to begin.</Text>
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
                      style={{ fontSize: 18, fontWeight: '700', color: palette.text }}
                    >
                      {b.exercise?.name || 'Exercise'}
                    </Text>

                    {/* Plate calculator only for Barbell */}
                    {isBarbellExercise(b.exercise) && (
                      <Pressable
                        onPress={() => setPlateBlockId(b.id)}
                        hitSlop={8}
                        style={{
                          marginLeft: 10,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: '#F3F4F6',
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>🏋️‍♂️</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {b.sets.map((s, i) => (
                  <SetRow
                    key={s.id}
                    index={i}
                    exercise={b.exercise}
                    set={s}
                    units={units}
                    prevSameIndex={b.prevSets ? b.prevSets[i] : null}
                    onChange={(patch) => patchSet(b.id, s.id, patch)}
                    onRemove={() => removeSet(b.id, s.id)}
                    onToggleComplete={(done) =>
                      patchSet(b.id, s.id, {
                        completedAt: done ? new Date().toISOString() : null,
                      })
                    }
                  />
                ))}
              </View>
            ))}

            <GradientButton title="Add Exercise" onPress={() => setPickerOpen(true)} />
          </Card>

          {/* Prominent Rest Timer */}
          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Rest Timer</Text>
            <RestTimer ref={restRef} seconds={90} />
          </Card>

          {/* Session Summary */}
          <WorkoutSessionSummary blocks={blocks} units={units} onFinish={finish} />
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
      />

      {/* Shared Plate Calculator modal */}
      <PlateCalculatorModal
        visible={!!plateBlockId}
        onClose={() => setPlateBlockId(null)}
        onDone={(total) => {
          if (plateBlockId) applyPlateTotal(plateBlockId, total);
        }}
        initialBarWeight={45}
        unit={units === 'kg' ? 'kg' : 'lb'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
});
