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
import { saveWorkout, computeSummary, getWorkoutById, getPrevSetsForExercise } from '../store/workoutStore';

export default function TrackWorkoutScreen() {
  const route = useRoute();
  const editingId = route?.params?.workoutId || null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [units, setUnits] = useState('lb');
  const [blocks, setBlocks] = useState([]);
  const [workoutId, setWorkoutId] = useState(editingId || uuidv4());
  const [startedAt, setStartedAt] = useState(Date.now());
  const restRef = useRef(null);

  // NEW: trigger rest timer via effect (avoids setState-in-render warning)
  const [restTrigger, setRestTrigger] = useState(0);
  useEffect(() => {
    if (restTrigger) {
      restRef.current?.start?.();
    }
  }, [restTrigger]);

  // Hydrate when editing an existing workout + attach prev sets
  useEffect(() => {
    let cancelled = false;
    if (editingId) {
      (async () => {
        const existing = await getWorkoutById(editingId);
        if (existing && !cancelled) {
          const enriched = await Promise.all(
            (existing.blocks || []).map(async (b) => {
              const prevSets = await getPrevSetsForExercise(b.exercise?.id, existing.startedAt, existing.id);
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
    return () => { cancelled = true; };
  }, [editingId]);

  const total = useMemo(() => {
    const volume = blocks.reduce(
      (acc, b) => acc + (b.sets || []).reduce((s, x) => s + (Number(x.weight) || 0)*(Number(x.reps) || 0), 0),
      0
    );
    return { volume };
  }, [blocks]);

  // Add exercise: pre-populate from previous workout (matched exercise), else one empty set
  async function addExercise(ex) {
    const prevSets = await getPrevSetsForExercise(ex.id, startedAt, workoutId);
    const setsFromPrev = (prevSets || []).map(ps => ({
      id: uuidv4(),
      weight: Number(ps.weight) || 0,
      reps: Number(ps.reps) || 0,
    }));
    const initialSets = setsFromPrev.length ? setsFromPrev : [{ id: uuidv4(), weight: 0, reps: 0 }];

    setBlocks(prev => [...prev, { id: uuidv4(), exercise: ex, sets: initialSets, prevSets }]);
  }

  const isEmptySet = (s) => (Number(s?.weight)||0) === 0 && (Number(s?.reps)||0) === 0;

  // Append only when the LAST set becomes valid or is marked done, and there is no empty TRAILING set
  function patchSet(blockId, setId, patch) {
    setBlocks(prev =>
      prev.map(b => {
        if (b.id !== blockId) return b;

        const idx = b.sets.findIndex(s => s.id === setId);
        if (idx === -1) return b;

        const before = b.sets[idx];
        const after = { ...before, ...patch };

        const wasValid = (Number(before.weight)||0) > 0 && (Number(before.reps)||0) > 0;
        const isValid  = (Number(after.weight) ||0) > 0 && (Number(after.reps) ||0) > 0;

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
          setRestTrigger(Date.now()); // start rest AFTER render
        } else if (markedDoneAndValid) {
          // still start rest on completion
          setRestTrigger(Date.now());
        }

        return { ...b, sets: outSets };
      })
    );
  }

  function removeSet(blockId, setId) {
    setBlocks(prev =>
      prev.map(b => b.id === blockId ? { ...b, sets: b.sets.filter(s => s.id !== setId) } : b)
    );
  }

  async function finish() {
    // Drop zero sets & transient props before saving
    const cleanedBlocks = blocks
      .map(({ id, exercise, sets }) => ({
        id,
        exercise,
        sets: (sets || []).filter(s => !isEmptySet(s)),
      }))
      .filter(b => (b.sets || []).length > 0);

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
      `Exercises: ${s.exercises}\nSets: ${s.totalSets}\nVolume: ${s.totalVolume.toFixed(0)} ${units}\nDuration: ${s.durationMin} min`
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing(2), rowGap: spacing(1.5) }}>
          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Exercises</Text>

            {blocks.length === 0 ? (
              <Text style={{ opacity: 0.7 }}>No exercises yet. Add one to begin.</Text>
            ) : null}

            {blocks.map(b => (
              <View key={b.id} style={{ marginBottom: spacing(2) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(1) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!!b.exercise?.icon && <Text style={{ fontSize: 18, marginRight: 8 }}>{b.exercise.icon}</Text>}
                    <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>
                      {b.exercise?.name || 'Exercise'}
                    </Text>
                  </View>
                </View>

                + {b.sets.map((s, i) => {
   const prevDoneAt = i > 0 ? b.sets[i - 1]?.completedAt : null;
   return (
                  <SetRow
                    key={s.id}
                    index={i}
                    set={s}
                    prev={b.prevSets ? b.prevSets[i] : null}
                    prevDoneAt={prevDoneAt}
                    units={units}
                    onChange={(patch) => patchSet(b.id, s.id, patch)}
                    onRemove={() => removeSet(b.id, s.id)}
                  />
                );
              })}
              </View>
            ))}

            <GradientButton title="Add Exercise" onPress={() => setPickerOpen(true)} />
          </Card>

          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Rest</Text>
            <RestTimer ref={restRef} seconds={90} />
          </Card>

          <Card style={{ padding: spacing(2) }}>
           {/* Session summary */}
<WorkoutSessionSummary
  blocks={blocks}
  units={units}
  onFinish={finish}
/>

          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
});
