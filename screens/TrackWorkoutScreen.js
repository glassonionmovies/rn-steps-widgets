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
import { Swipeable } from 'react-native-gesture-handler';
import { recommendNextExercise } from '../utils/realtimeExerciseRecommender';
import { saveWorkoutTemplate } from '../store/templateStore';

function isBarbellExercise(ex) {
  const eq = (ex?.equipment || '').toLowerCase();
  if (eq === 'barbell') return true;
  const name = (ex?.name || '').toLowerCase();
  return /bench|deadlift|squat|barbell|row|press|ohp/.test(name);
}

// ----- helpers for matching/normalizing -----
const isSameExercise = (a, b) => {
  if (!a || !b) return false;
  const ida = a?.id != null ? String(a.id) : null;
  const idb = b?.id != null ? String(b.id) : null;
  if (ida && idb && ida === idb) return true;
  const na = (a?.name || a?.title || '').trim().toLowerCase();
  const nb = (b?.name || b?.title || '').trim().toLowerCase();
  return na && nb && na === nb;
};

const findLastBlockIndexForExercise = (blocks, ex) => {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (isSameExercise(blocks[i]?.exercise, ex)) return i;
  }
  return -1;
};

// Keep at most one empty set (0/0) at the end
function collapseTrailingEmpties(sets) {
  const out = Array.isArray(sets) ? sets.slice() : [];
  let i = out.length - 1;
  let trailing = 0;
  while (
    i >= 0 &&
    ((Number(out[i]?.weight) || 0) === 0 && (Number(out[i]?.reps) || 0) === 0)
  ) {
    trailing += 1;
    i -= 1;
  }
  if (trailing > 1) {
    out.splice(out.length - (trailing - 1), (trailing - 1));
  }
  return out;
}

const hasNonEmptySet = (sets) =>
  (sets || []).some(
    (s) => (Number(s.weight) || 0) > 0 || (Number(s.reps) || 0) > 0
  );

const isSetCompleted = (s) =>
  ((Number(s.weight) || 0) > 0 && (Number(s.reps) || 0) > 0) && !!s.completedAt;

// --------------------------------------------

export default function TrackWorkoutScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const editingId = route?.params?.workoutId || null;
  const isEditing = !!editingId;
  const isFromTemplate = !!route?.params?.template;
  const isFromHistoryReadOnly = !!route?.params?.readOnlyFromHistory; // when opened from Recent Workouts
  const isBlank = !!route?.params?.isBlank;

  // Read-only state when coming from history (until user taps Edit / Start this workout)
  const [readOnly, setReadOnly] = useState(isFromHistoryReadOnly);
  const [dirty, setDirty] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [units, setUnits] = useState('lb');
  const [blocks, setBlocks] = useState([]);
  const [workoutId, setWorkoutId] = useState(isEditing ? editingId : uuidv4());
  const [startedAt, setStartedAt] = useState(Date.now());
  const [title, setTitle] = useState(null);

  const [plateBlockId, setPlateBlockId] = useState(null);

  const restRef = useRef(null);
  const [restTrigger, setRestTrigger] = useState(0);
  useEffect(() => { if (restTrigger) restRef.current?.start?.(); }, [restTrigger]);

  // Header: Templates button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('WorkoutTemplates')} hitSlop={10}>
          <Text style={{ color: '#2563EB', fontWeight: '800' }}>Templates</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  // Seed from template OR from recommended plan (and not editing)
  useEffect(() => {
    if (isEditing) return;
    const t = route?.params?.template || route?.params?.recommendedPlan || null;
    if (!t || (blocks?.length ?? 0) > 0) return;

    const seeded = (t.blocks || []).map(({ exercise, sets }) => ({
      id: uuidv4(),
      exercise,
      sets: collapseTrailingEmpties(
        (sets || []).map((s) => ({
          id: uuidv4(),
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          // coming from template/recommended, nothing is completed yet
        })).concat([{ id: uuidv4(), weight: 0, reps: 0 }])
      ),
      prevSets: [],
    }));
    setBlocks(seeded);
    if (t.units) setUnits(t.units);
    setTitle(t.name || null);
    setReadOnly(false); // starting from a plan is editable
  }, [route?.params, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load workout for editing (attach previous sets)
  useEffect(() => {
    let cancelled = false;
    if (isEditing) {
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
          setWorkoutId(existing.id); // keep same id so we UPDATE, not create
          if (existing.title) setTitle(existing.title);
          // If launched from Recent Workouts read-only, keep readOnly=true until user taps Edit/Start this workout
        }
      })();
    }
    return () => { cancelled = true; };
  }, [isEditing, editingId]);

  const isEmptySet = (s) =>
    (Number(s?.weight) || 0) === 0 && (Number(s?.reps) || 0) === 0;

  /**
   * Append or fill the last set.
   * - When opts.fromAI is true:
   *   - If the last set is empty, fill it (NO trailing empty added).
   *   - If the last set is filled, append ONE new filled set (NO trailing empty).
   * - Otherwise (manual flows): keep the standard UX (ensure exactly one trailing empty).
   */
  function appendOrFillLastSet(block, seed = { weight: 0, reps: 0 }, opts = { fromAI: false }) {
    let sets = Array.isArray(block.sets) ? block.sets.slice() : [];
    sets = collapseTrailingEmpties(sets);

    const nextWeight = Number(seed.weight) || 0;
    const nextReps = Number(seed.reps) || 0;

    const last = sets[sets.length - 1];
    const lastIsEmpty = last && isEmptySet(last);

    if (lastIsEmpty) {
      // Fill the existing empty
      sets[sets.length - 1] = { ...last, weight: nextWeight, reps: nextReps };
      if (!opts.fromAI) {
        // For manual flows, maintain one trailing empty
        sets.push({ id: uuidv4(), weight: 0, reps: 0 });
      }
    } else {
      // Append new filled set
      sets.push({ id: uuidv4(), weight: nextWeight, reps: nextReps });
      if (!opts.fromAI) {
        // For manual flows, add trailing empty
        sets.push({ id: uuidv4(), weight: 0, reps: 0 });
      }
    }

    return { ...block, sets: collapseTrailingEmpties(sets) };
  }

  // Add exercise (seed from previous) — if same exercise already exists, just add a set
  async function addExercise(ex) {
    const idx = findLastBlockIndexForExercise(blocks, ex);
    setDirty(true);

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

    let initialSets =
      setsFromPrev.length > 0
        ? [...setsFromPrev, { id: uuidv4(), weight: 0, reps: 0 }]
        : [{ id: uuidv4(), weight: 0, reps: 0 }];

    initialSets = collapseTrailingEmpties(initialSets);

    setBlocks((prev) => [
      ...prev,
      { id: uuidv4(), exercise: ex, sets: initialSets, prevSets },
    ]);
  }

  // Add AI-recommended exercise — if same exercise exists, append prefilled set; else create a new block with ONLY the filled set (no extra empty)
  function addAiRecommendedExercise() {
    setDirty(true);

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
            ? appendOrFillLastSet(
                b,
                { weight: suggestion.weight, reps: suggestion.reps },
                { fromAI: true }
              )
            : b
        )
      );
      return;
    }

    // New block: only one filled set (no trailing empty).
    const initialSets = [
      { id: uuidv4(), weight: Number(suggestion.weight) || 0, reps: Number(suggestion.reps) || 0 },
    ];

    setBlocks((prev) => [
      ...prev,
      { id: uuidv4(), exercise: suggestion.exercise, sets: initialSets, prevSets: [] },
    ]);
  }

  // Patch set; auto-append & trigger rest when last becomes valid/done (manual flows)
  function patchSet(blockId, setId, patch) {
    setDirty(true);

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

        if (!readOnly && isLastIndex && (becameValid || markedDoneAndValid) && !hasEmptyTrailing) {
          outSets = [...setsUpdated, { id: uuidv4(), weight: 0, reps: 0 }];
          setRestTrigger(Date.now());
        } else if (!readOnly && markedDoneAndValid) {
          setRestTrigger(Date.now());
        }

        // normalize trailing empties to avoid duplicates
        outSets = collapseTrailingEmpties(outSets);

        return { ...b, sets: outSets };
      })
    );
  }

  // Remove set; drop block if no non-empty sets remain; normalize empties
  function removeSet(blockId, setId) {
    setDirty(true);

    setBlocks((prev) => {
      const afterSetRemoval = prev.map((b) => {
        if (b.id !== blockId) return b;
        let sets = (b.sets || []).filter((s) => s.id !== setId);
        sets = collapseTrailingEmpties(sets);
        return { ...b, sets };
      });

      return afterSetRemoval.filter((b) => hasNonEmptySet(b.sets));
    });
  }

  // Apply plate-calculated total to the LAST set of that block
  function applyPlateTotal(blockId, total) {
    setDirty(true);

    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        if (!b.sets || b.sets.length === 0) return b;
        const idx = b.sets.length - 1;
        const sets = b.sets.slice();
        sets[idx] = { ...sets[idx], weight: total };
        return { ...b, sets: collapseTrailingEmpties(sets) };
      })
    );
  }

  async function finishOrUpdate() {
    // Keep only COMPLETED sets (checkbox checked / completedAt present)
    const cleanedBlocks = (blocks || [])
      .map(({ id, exercise, sets }) => {
        const completedSets = (sets || []).filter(isSetCompleted);
        return { id, exercise, sets: completedSets };
      })
      .filter((b) => (b.sets || []).length > 0);

    if (!cleanedBlocks.length) {
      Alert.alert('Nothing to save', 'Please complete at least one set (check mark) before saving.');
      return;
    }

    // For editing: keep original id and startedAt so it UPDATES the same entry.
    // For new/template/blank: we already have a fresh id and current startedAt, so it's a CREATE.
    const payload = {
      id: workoutId,
      startedAt,
      finishedAt: Date.now(),
      units,
      // Persist only completed sets; retain completedAt timestamps
      blocks: cleanedBlocks.map((b) => ({
        ...b,
        sets: b.sets.map((s) => ({
          ...s,
          completedAt: s.completedAt ?? new Date().toISOString(),
        })),
      })),
      title: title || undefined,
    };

    await saveWorkout(payload);

    const s = computeSummary(payload);
    Alert.alert(
      isEditing ? 'Workout updated' : 'Workout saved',
      `Exercises: ${s.exercises}\nSets: ${s.totalSets}\nVolume: ${s.totalVolume.toFixed(0)} ${units}\nDuration: ${s.durationMin} min`
    );

    if (isEditing) {
      setDirty(false);
      setReadOnly(true);
    }
  }

  // Save as Template modal state & handlers
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState('');

  async function confirmSaveTemplate() {
    const cleanedBlocks = (blocks || [])
      .map(({ exercise, sets }) => ({
        exercise,
        sets: (sets || [])
          .filter((s) => !isEmptySet(s) && isSetCompleted(s))
          .map((s) => ({
            weight: Number(s.weight) || 0,
            reps: Number(s.reps) || 0,
          })),
      }))
      .filter((b) => (b.sets || []).length > 0);

    if (!cleanedBlocks.length) {
      Alert.alert('No data', 'Complete at least one set (check) to save a template.');
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
    Alert.alert('Discard workout?', 'Your current entries will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          try {
            const routes = require('../navigation/routes');
            if (routes?.goTrainStarter) {
              routes.goTrainStarter(navigation);
              return;
            }
          } catch {}
          navigation.navigate('Train', { screen: 'TrainStarter' });
        },
      },
    ]);
  }

  // For read-only from history: show "Start this workout" (clone to temp plan)
  function startThisWorkoutFromHistory() {
    // Build a temporary template-like object from COMPLETED sets of the current workout
    const tempTemplate = {
      name: title || 'Previous Session',
      units,
      blocks: (blocks || [])
        .map((b) => ({
          exercise: b.exercise,
          sets: (b.sets || [])
            .filter(isSetCompleted)
            .map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
        }))
        .filter((b) => (b.sets || []).length > 0),
    };

    if (!tempTemplate.blocks.length) {
      Alert.alert('No completed sets', 'This session has no completed sets to start from.');
      return;
    }

    // Re-seed the screen like starting from Templates (do not save template)
    setBlocks(
      tempTemplate.blocks.map(({ exercise, sets }) => ({
        id: uuidv4(),
        exercise,
        sets: collapseTrailingEmpties(
          sets
            .map((s) => ({ id: uuidv4(), weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 }))
            .concat([{ id: uuidv4(), weight: 0, reps: 0 }])
        ),
        prevSets: [],
      }))
    );
    setUnits(tempTemplate.units || 'lb');
    setTitle(tempTemplate.name || null);
    setWorkoutId(uuidv4()); // new workout id
    setStartedAt(Date.now());
    setReadOnly(false); // now editable like a new session
    setDirty(true);
  }

  const primaryBtnLabel = isEditing ? 'Update' : 'Finish & Save';

  const showAddExercise = !readOnly; // hide in read-only (from history)
  const showStartThisWorkout =
    isFromHistoryReadOnly && readOnly; // show when opened from history and still read-only
  const showCancelReturnLink =
    isFromHistoryReadOnly && readOnly; // “Cancel and Return” only in this mode

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: spacing(2), rowGap: spacing(1.5) }}>
          {/* Exercises + Set list */}
          <Card style={{ padding: spacing(2) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.title}>Exercises</Text>
              {readOnly && (
                <Pressable onPress={() => { setReadOnly(false); setDirty(false); }} hitSlop={8}>
                  <Text style={{ color: '#2563EB', fontWeight: '800' }}>Edit</Text>
                </Pressable>
              )}
            </View>

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
                      <Text style={{ fontSize: 18, marginRight: 8 }}>{b.exercise.icon}</Text>
                    )}
                    <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>
                      {b.exercise?.name || 'Exercise'}
                    </Text>

                    {/* Plate calculator only for Barbell */}
                    {!readOnly && isBarbellExercise(b.exercise) && (
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

                {b.sets.map((s, i) => {
                  const setRow = (
                    <SetRow
                      index={i}
                      exercise={b.exercise}
                      set={s}
                      units={units}
                      prevSameIndex={b.prevSets ? b.prevSets[i] : null}
                      readOnly={readOnly}
                      showAllReadOnlyFields={readOnly} // show full details when read-only (from history)
                      onChange={(patch) => patchSet(b.id, s.id, patch)}
                      onRemove={() => removeSet(b.id, s.id)}
                      onToggleComplete={(done) =>
                        patchSet(b.id, s.id, {
                          completedAt: done ? new Date().toISOString() : null,
                        })
                      }
                    />
                  );

                  return readOnly ? (
                    <View key={s.id}>{setRow}</View>
                  ) : (
                    <Swipeable
                      key={s.id}
                      renderRightActions={() => (
                        <View style={styles.swipeActions}>
                          <Pressable
                            onPress={() => removeSet(b.id, s.id)}
                            style={styles.deleteAction}
                            hitSlop={8}
                            accessibilityLabel="Delete set"
                          >
                            <Text style={styles.deleteActionText}>Delete</Text>
                          </Pressable>
                        </View>
                      )}
                      rightThreshold={40}
                      overshootRight={false}
                    >
                      {setRow}
                    </Swipeable>
                  );
                })}
              </View>
            ))}

            {/* Actions row: Add Exercise + small circular AI button (hidden in read-only) */}
            {showAddExercise && (
              <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 10 }}>
                <View style={{ flex: 1 }}>
                  <GradientButton title="Add Exercise" onPress={() => setPickerOpen(true)} />
                </View>

                <Pressable
                  onPress={addAiRecommendedExercise}
                  accessibilityLabel="AI Recommendation"
                  style={styles.aiBtn}
                  hitSlop={6}
                >
                  <Text style={styles.aiBtnText}>AI</Text>
                </Pressable>
              </View>
            )}

            {/* Read-only from history: Start this workout + Cancel and Return */}
            {showStartThisWorkout && (
              <View style={{ marginTop: spacing(1) }}>
                <GradientButton title="Start this workout" onPress={startThisWorkoutFromHistory} />
                <View style={{ alignItems: 'center', marginTop: spacing(1) }}>
                  <Pressable
                    onPress={() => {
                      try {
                        const routes = require('../navigation/routes');
                        if (routes?.goTrainStarter) {
                          routes.goTrainStarter(navigation);
                          return;
                        }
                      } catch {}
                      navigation.navigate('Train', { screen: 'TrainStarter' });
                    }}
                    hitSlop={6}
                  >
                    <Text style={styles.linkPrimary}>Cancel and Return</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Card>

          {/* Prominent Rest Timer */}
          <Card style={{ padding: spacing(2) }}>
            <Text style={styles.title}>Rest Timer</Text>
            <RestTimer ref={restRef} seconds={90} />
          </Card>

          {/* Session Summary + Finish/Update + Links (hidden in read-only) */}
          {!readOnly && (
            <Card style={{ padding: spacing(2) }}>
              <WorkoutSessionSummary
                blocks={blocks}
                units={units}
                showFinish={false}
                showTitle={true}
                titleOverride={title || undefined}
              />
              <View style={{ height: spacing(1) }} />
              <GradientButton title={primaryBtnLabel} onPress={finishOrUpdate} />
              <View style={{ alignItems: 'center', gap: 10, marginTop: spacing(1) }}>
                <Pressable onPress={() => setTplOpen(true)} hitSlop={6}>
                  <Text style={styles.linkPrimary}>Save as Template</Text>
                </Pressable>
                <Pressable onPress={cancelWorkout} hitSlop={6}>
                  <Text style={styles.linkDanger}>Cancel Workout</Text>
                </Pressable>
              </View>
            </Card>
          )}
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

      {/* Save Template Modal */}
      <Modal
        visible={tplOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTplOpen(false)}
      >
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
              <Pressable onPress={() => setTplOpen(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmSaveTemplate}>
                <Text style={[styles.modalBtnText, { fontWeight: '800' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },

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

  linkPrimary: { color: '#2563EB', fontWeight: '800' },
  linkDanger: { color: '#EF4444', fontWeight: '800' },

  swipeActions: {
    width: 88,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  deleteAction: {
    flex: 1,
    height: '100%',
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: {
    color: '#B91C1C',
    fontWeight: '900',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 16,
  },
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
