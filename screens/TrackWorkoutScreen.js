// screens/TrackWorkoutScreen.js
import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
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
  Modal,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
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

// AI recommender
import { recommendNextExercise } from '../utils/realtimeExerciseRecommender';

// Templates store
import { saveWorkoutTemplate } from '../store/templateStore';

function isBarbellExercise(ex) {
  const eq = (ex?.equipment || '').toLowerCase();
  if (eq === 'barbell') return true;
  const name = (ex?.name || '').toLowerCase();
  return /bench|deadlift|squat|barbell|row|press|ohp/.test(name);
}

// Identify same exercise by id, then by name/title
const isSameExercise = (a, b) => {
  if (!a || !b) return false;
  const ida = a?.id != null ? String(a.id) : null;
  const idb = b?.id != null ? String(b.id) : null;
  if (ida && idb && ida === idb) return true;
  const na = (a?.name || a?.title || '').trim().toLowerCase();
  const nb = (b?.name || b?.title || '').trim().toLowerCase();
  return na && nb && na === nb;
};

// Find the most recent block with the same exercise
const findLastBlockIndexForExercise = (blocks, ex) => {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (isSameExercise(blocks[i]?.exercise, ex)) return i;
  }
  return -1;
};

export default function TrackWorkoutScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const editingId = route?.params?.workoutId || null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [units, setUnits] = useState('lb');
  const [blocks, setBlocks] = useState([]);
  const [workoutId, setWorkoutId] = useState(editingId || uuidv4());
  const [startedAt, setStartedAt] = useState(Date.now());
  const [title, setTitle] = useState(null); // NEW: auto-title from template

  const [plateBlockId, setPlateBlockId] = useState(null);

  const restRef = useRef(null);
  const [restTrigger, setRestTrigger] = useState(0);
  useEffect(() => { if (restTrigger) restRef.current?.start?.(); }, [restTrigger]);

  // Header: "Templates" button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('WorkoutTemplates')}
          hitSlop={10}
        >
          <Text style={{ color: '#2563EB', fontWeight: '800' }}>Templates</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  // Seed from template if provided (and not editing)
  useEffect(() => {
    if (editingId) return;
    const t = route?.params?.template;
    if (!t || (blocks?.length ?? 0) > 0) return;
    const seeded = (t.blocks || []).map(({ exercise, sets }) => ({
      id: uuidv4(),
      exercise,
      sets: (sets || [])
        .map(s => ({ id: uuidv4(), weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }))
        .concat([{ id: uuidv4(), weight: 0, reps: 0 }]),
      prevSets: [],
    }));
    setBlocks(seeded);
    if (t.units) setUnits(t.units);
    setTitle(t.name || null); // NEW: capture template name as workout title
  }, [route?.params, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

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
          if (existing.title) setTitle(existing.title);
        }
      })();
    }
    return () => { cancelled = true; };
  }, [editingId]);

  const isEmptySet = (s) =>
    (Number(s?.weight) || 0) === 0 && (Number(s?.reps) || 0) === 0;

  // Fill trailing empty set if present; otherwise append a new set (and ensure trailing empty if valid)
  function appendOrFillLastSet(block, seed = { weight: 0, reps: 0 }) {
    const sets = Array.isArray(block.sets) ? block.sets.slice() : [];
    const hasSets = sets.length > 0;
    const lastIdx = hasSets ? sets.length - 1 : -1;
    const last = hasSets ? sets[lastIdx] : null;

    const nextWeight = Number(seed.weight) || 0;
    const nextReps = Number(seed.reps) || 0;

    if (last && (Number(last.weight) || 0) === 0 && (Number(last.reps) || 0) === 0) {
      sets[lastIdx] = { ...last, weight: nextWeight, reps: nextReps };
    } else {
      sets.push({ id: uuidv4(), weight: nextWeight, reps: nextReps });
    }

    const end = sets[sets.length - 1];
    const endValid = (Number(end?.weight) || 0) > 0 && (Number(end?.reps) || 0) > 0;
    if (endValid) {
      sets.push({ id: uuidv4(), weight: 0, reps: 0 });
    }
    return { ...block, sets };
  }

  // Add exercise (seed from previous) — if same exercise already exists, just add a set
  async function addExercise(ex) {
    const idx = findLastBlockIndexForExercise(blocks, ex);
    if (idx >= 0) {
      setBlocks((prev) =>
        prev.map((b, i) => (i === idx ? appendOrFillLastSet(b, { weight: 0, reps: 0 }) : b))
      );
      return;
    }

    const prevSets = await getPrevSetsForExercise(ex.id, startedAt, workoutId);
    const setsFromPrev = (prevSets || []).map((ps) => ({
      id: uuidv4(),
      weight: Number(ps.weight) || 0,
      reps: Number(ps.reps) || 0,
    }));
    const initialSets =
      setsFromPrev.length > 0
        ? [...setsFromPrev, { id: uuidv4(), weight: 0, reps: 0 }]
        : [{ id: uuidv4(), weight: 0, reps: 0 }];

    setBlocks((prev) => [
      ...prev,
      { id: uuidv4(), exercise: ex, sets: initialSets, prevSets },
    ]);
  }

  // Add AI-recommended exercise — if same exercise exists, append prefilled set instead
  function addAiRecommendedExercise() {
    const suggestion = recommendNextExercise({ blocks, units, startedAt, workoutId });
    if (!suggestion || !suggestion.exercise) {
      Alert.alert('Need more data', 'Complete at least one set to get AI recommendations.');
      return;
    }

    const idx = findLastBlockIndexForExercise(blocks, suggestion.exercise);

    if (idx >= 0) {
      setBlocks((prev) =>
        prev.map((b, i) =>
          i === idx
            ? appendOrFillLastSet(b, { weight: suggestion.weight, reps: suggestion.reps })
            : b
        )
      );
      return;
    }

    const initialSets = [
      { id: uuidv4(), weight: Number(suggestion.weight) || 0, reps: Number(suggestion.reps) || 0 },
      { id: uuidv4(), weight: 0, reps: 0 },
    ];

    setBlocks((prev) => [
      ...prev,
      { id: uuidv4(), exercise: suggestion.exercise, sets: initialSets, prevSets: [] },
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

        const wasValid = (Number(before.weight) || 0) > 0 && (Number(before.reps) || 0) > 0;
        const isValid  = (Number(after.weight)  || 0) > 0 && (Number(after.reps)  || 0) > 0;

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
      title: title || undefined, // NEW: persist title when present
    };

    await saveWorkout(payload);
    const s = computeSummary(payload);
    Alert.alert(
      'Workout saved',
      `Exercises: ${s.exercises}\nSets: ${s.totalSets}\nVolume: ${s.totalVolume.toFixed(0)} ${units}\nDuration: ${s.durationMin} min`
    );
  }

  // ---- Save as Template modal state & handlers ----
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState('');

  async function confirmSaveTemplate() {
    const cleanedBlocks = (blocks || [])
      .map(({ exercise, sets }) => ({
        exercise,
        sets: (sets || [])
          .filter(s => !isEmptySet(s))
          .map(s => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
      }))
      .filter(b => (b.sets || []).length > 0);

    if (!cleanedBlocks.length) {
      Alert.alert('No data', 'Enter at least one non-zero set to save a template.');
      return;
    }
    const name = tplName.trim() || `Template ${new Date().toLocaleDateString()}`;
    await saveWorkoutTemplate(name, { units, blocks: cleanedBlocks });
    setTplOpen(false);
    setTplName('');
    Alert.alert('Saved', `Template “${name}” saved.`);
  }

  // Cancel workout: confirm, then discard and go to Wellness tab
  function cancelWorkout() {
    Alert.alert(
      'Discard workout?',
      'Your current entries will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            try {
              const routes = require('../navigation/routes');
              if (routes?.goHome) { routes.goHome(navigation); return; }
            } catch {}
            navigation.navigate('Wellness');
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing(2), rowGap: spacing(1.5) }}>
          {/* Exercises + Set list */}
          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Exercises</Text>

            {blocks.length === 0 ? (
              <Text style={{ opacity: 0.7 }}>No exercises yet. Add one to begin.</Text>
            ) : null}

            {blocks.map((b) => (
              <View key={b.id} style={{ marginBottom: spacing(2) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(1) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!!b.exercise?.icon && <Text style={{ fontSize: 18, marginRight: 8 }}>{b.exercise.icon}</Text>}
                    <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>
                      {b.exercise?.name || 'Exercise'}
                    </Text>

                    {/* Plate calculator only for Barbell */}
                    {isBarbellExercise(b.exercise) && (
                      <Pressable
                        onPress={() => setPlateBlockId(b.id)}
                        hitSlop={8}
                        style={{ marginLeft: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6' }}
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
                    onToggleComplete={(done) => patchSet(b.id, s.id, { completedAt: done ? new Date().toISOString() : null })}
                  />
                ))}
              </View>
            ))}

            {/* Actions row: Add Exercise + small circular AI button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10 }}>
              <View style={{ flex: 1 }}>
                <GradientButton title="Add Exercise" onPress={() => setPickerOpen(true)} />
              </View>

              <Pressable onPress={addAiRecommendedExercise} accessibilityLabel="AI Recommendation" style={styles.aiBtn} hitSlop={6}>
                <Text style={styles.aiBtnText}>AI</Text>
              </Pressable>
            </View>
          </Card>

          {/* Prominent Rest Timer */}
          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Rest Timer</Text>
            <RestTimer ref={restRef} seconds={90} />
          </Card>

          {/* Session Summary + Finish & Save + Links all in one Card */}
          <Card style={{ padding: spacing(2) }}>
            <WorkoutSessionSummary
              blocks={blocks}
              units={units}
              showFinish={false}   // hide built-in button so we can place ours + links together
              showTitle={true}
              titleOverride={title || undefined}
            />
            <View style={{ height: spacing(1) }} />
            <GradientButton title="Finish & Save" onPress={finish} />

            {/* Links directly under the button */}
            <View style={{ alignItems: 'center', gap: 10, marginTop: spacing(1) }}>
              <Pressable onPress={() => setTplOpen(true)} hitSlop={6}>
                <Text style={styles.linkPrimary}>Save as Template</Text>
              </Pressable>
              <Pressable onPress={cancelWorkout} hitSlop={6}>
                <Text style={styles.linkDanger}>Cancel Workout</Text>
              </Pressable>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} />

      {/* Shared Plate Calculator modal */}
      <PlateCalculatorModal
        visible={!!plateBlockId}
        onClose={() => setPlateBlockId(null)}
        onDone={(total) => { if (plateBlockId) applyPlateTotal(plateBlockId, total); }}
        initialBarWeight={45}
        unit={units === 'kg' ? 'kg' : 'lb'}
      />

      {/* Save Template Modal */}
      <Modal visible={tplOpen} transparent animationType="fade" onRequestClose={() => setTplOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Template Name</Text>
            <TextInput
              value={tplName}
              onChangeText={setTplName}
              placeholder="e.g., Push Day A"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <Pressable onPress={() => setTplOpen(false)}><Text style={styles.modalBtnText}>Cancel</Text></Pressable>
              <Pressable onPress={confirmSaveTemplate}><Text style={[styles.modalBtnText, { fontWeight: '800' }]}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

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

  // circular AI button
  aiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6a5cff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  aiBtnText: { color: 'white', fontWeight: '900', letterSpacing: 0.5 },

  // links under Finish & Save
  linkPrimary: { color: '#2563EB', fontWeight: '800' },
  linkDanger: { color: '#EF4444', fontWeight: '800' },

  // modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 14, backgroundColor: '#fff', padding: 16 },
  modalTitle: { color: palette.text, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
  },
  modalBtnText: { color: '#2563EB', fontWeight: '700' },
});
