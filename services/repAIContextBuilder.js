// services/repAIContextBuilder.js
// Builds the full, history-aware payload for Rep.AI LLM planning.
// - Reads workout history
// - Computes RECENT_AVG_VOLUME_BY_MUSCLE, EXERCISE_PROGRESS, LAST_3_WEEKS_BY_EXERCISE
// - Creates a familiar SEED_BLOCKS scaffold based on user prefs + history
// - Returns a ready-to-send object for the LLM call
//
// Usage:
//   const ctx = await buildRepAIContext({ prefs, vitals, stepsAndSleep });
//   // ctx has: PREFS, VITALS, STEPS_AND_SLEEP, RECENT_AVG_VOLUME_BY_MUSCLE,
//   //          HISTORY_SUMMARY, EXERCISE_PROGRESS, LAST_3_WEEKS_BY_EXERCISE, SEED_BLOCKS
//
// Notes:
// - We canonicalize equipment/muscleGroup/pattern fields for consistency
// - We compute recent averages over a 3-week window (21 days)
// - We print detailed console logs for debugging

import { getAllWorkouts } from '../store/workoutStore';

const DAY_MS = 24 * 60 * 60 * 1000;

const MUSCLE_CANON = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  delts: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  quads: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  calves: 'Legs',
  core: 'Core',
  abs: 'Core',
  full: 'Full Body',
  other: 'Other',
};

const EQUIP_CANON = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  dumbbells: 'dumbbell',
  machine: 'machine',
  cable: 'cable',
  bodyweight: 'bodyweight',
  kettlebell: 'kettlebell',
  band: 'band',
};

const PATTERN_CANON = {
  horizontal_press: 'push_horizontal',
  bench_press: 'push_horizontal',
  vertical_press: 'push_vertical',
  overhead_press: 'push_vertical',
  horizontal_pull: 'pull_horizontal',
  row: 'pull_horizontal',
  vertical_pull: 'pull_vertical',
  pulldown: 'pull_vertical',
  pullup: 'pull_vertical',
  squat: 'squat',
  hinge: 'hinge',
  deadlift: 'hinge',
  lunge: 'lunge',
  isolation: 'isolation',
};

function toISODate(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function weeksAgo(n) {
  return new Date(Date.now() - n * 7 * DAY_MS);
}
function isValidSet(s) {
  return Number(s?.weight) > 0 && Number(s?.reps) > 0;
}
function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}
function round(n, p = 0) {
  const f = Math.pow(10, p);
  return Math.round((Number(n) || 0) * f) / f;
}
function epley(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  return w * (1 + r / 30);
}

function canonMuscleGroup(x) {
  if (!x) return 'Other';
  const k = String(x).toLowerCase().trim();
  return MUSCLE_CANON[k] || MUSCLE_CANON[k.replace(/s$/, '')] || capitalize(k);
}
function canonEquipment(x) {
  if (!x) return 'bodyweight';
  const k = String(x).toLowerCase().trim();
  return EQUIP_CANON[k] || k;
}
function canonPattern(x) {
  if (!x) return '';
  const k = String(x).toLowerCase().trim();
  return PATTERN_CANON[k] || k;
}
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Flatten history into rows of completed sets (last N days)
 */
function buildHistorySummaryRows(workouts, { lookbackDays = 28 }) {
  const cutoff = new Date(Date.now() - lookbackDays * DAY_MS);
  const rows = [];
  (workouts || []).forEach(w => {
    const when = w?.finishedAt || w?.startedAt;
    if (!when) return;
    const d = new Date(when);
    if (d < cutoff) return;

    const units = (w?.units === 'kg') ? 'kg' : 'lb';
    (w?.blocks || []).forEach(block => {
      const ex = block?.exercise || {};
      const exName = ex?.name || 'Unknown';
      const exId = ex?.id || exName;
      const muscleGroup = canonMuscleGroup(ex?.muscleGroup);
      const equipment = canonEquipment(ex?.equipment);
      const pattern = canonPattern(ex?.pattern);

      (block?.sets || []).forEach(s => {
        if (!isValidSet(s)) return;
        rows.push({
          date: toISODate(d),
          exercise: exName,
          exerciseId: exId,
          muscleGroup,
          equipment,
          pattern,
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          units,
        });
      });
    });
  });
  return rows;
}

/**
 * Compute recent average (per week) tonnage by muscle group over last `weeks` weeks
 */
function computeRecentAvgVolumeByMuscle(workouts, { weeks = 3 }) {
  const cutoff = weeksAgo(weeks);
  const byWeekTotals = {}; // { group: total_tonnage_across_window }
  (workouts || []).forEach(w => {
    const when = new Date(w?.finishedAt || w?.startedAt);
    if (!when || when < cutoff) return;
    (w?.blocks || []).forEach(b => {
      const ex = b?.exercise || {};
      const group = canonMuscleGroup(ex?.muscleGroup);
      const tonnage = sum((b?.sets || []).filter(isValidSet).map(s => Number(s.weight) * Number(s.reps)));
      byWeekTotals[group] = (byWeekTotals[group] || 0) + tonnage;
    });
  });
  const avg = {};
  Object.entries(byWeekTotals).forEach(([g, total]) => {
    avg[g] = total / weeks;
  });
  return avg;
}

/**
 * Group rows by exercise and compute progression metrics
 */
function computeExerciseProgress(historyRows) {
  const map = {}; // exKey -> rows
  historyRows.forEach(r => {
    const key = r.exerciseId || r.exercise;
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });

  const progress = {};
  Object.entries(map).forEach(([key, rows]) => {
    let best = 0;
    let heaviest = 0;
    let volumeTotal = 0;
    const dates = new Set();
    rows.forEach(r => {
      best = Math.max(best, epley(r.weight, r.reps));
      heaviest = Math.max(heaviest, r.weight);
      volumeTotal += r.weight * r.reps;
      dates.add(r.date);
    });
    progress[key] = {
      bestE1RM: round(best, 1),
      heaviestLoad: heaviest,
      avgWeeklyVolume: round(volumeTotal / 3, 0), // approximate per 3 weeks
      recentSessionsUsed: Array.from(dates).sort().slice(-3),
    };
  });

  return { byExercise: map, metrics: progress };
}

/**
 * Build SEED_BLOCKS: familiar exercises from history, filtered by prefs/equipment, scaled sets.
 * For 'upper' split: aim for Chest, Back (horizontal/vertical), Shoulders, Biceps/Triceps.
 */
function buildSeedBlocks({ prefs, historyRows, exerciseProgress }) {
  const allowed = new Set((prefs?.equipment || []).map(e => canonEquipment(e)));
  const byEx = {};
  historyRows.forEach(r => {
    const key = r.exerciseId || r.exercise;
    if (!byEx[key]) byEx[key] = [];
    byEx[key].push(r);
  });

  // pick the latest instance per exercise
  const latestByEx = Object.values(byEx).map(arr => arr[arr.length - 1]);

  // focus on upper groups
  const upperGroups = new Set(['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps']);
  const candidates = latestByEx.filter(r => upperGroups.has(r.muscleGroup) && allowed.has(canonEquipment(r.equipment)));

  // bucket by muscle group
  const byGroup = {};
  candidates.forEach(r => {
    const g = r.muscleGroup;
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(r);
  });

  function pickLatest(group) {
    const arr = byGroup[group] || [];
    if (!arr.length) return null;
    return arr[arr.length - 1]; // latest
  }

  const picksOrdered = [
    pickLatest('Chest'),
    pickLatest('Back'), // could be horizontal; we’ll accept any back pattern here
    pickLatest('Shoulders'),
    pickLatest('Back'), // try to get a second back angle if available
    pickLatest('Biceps'),
    pickLatest('Triceps'),
  ].filter(Boolean);

  // Deduplicate by exercise name
  const seen = new Set();
  const picks = [];
  for (const p of picksOrdered) {
    const key = p.exerciseId || p.exercise;
    if (!seen.has(key)) {
      seen.add(key);
      picks.push(p);
    }
    if (picks.length >= 5) break;
  }

  // sets scaled from recent heaviest
  function setsFromProgress(exKey) {
    const metric = exerciseProgress?.metrics?.[exKey];
    const base = metric?.heaviestLoad ? Math.max(0, Math.round(metric.heaviestLoad * 0.9)) : 95;
    const r = (prefs?.intensity || 'medium') === 'high' ? [8, 8, 6] : (prefs?.intensity === 'low' ? [12, 12, 10] : [10, 10, 8]);
    return r.map((reps, i) => ({
      weight: Math.max(0, Math.round(base * (i === 2 ? 0.95 : 1))),
      reps,
    }));
  }

  const blocks = picks.map(p => {
    const exKey = p.exerciseId || p.exercise;
    return {
      exercise: {
        id: exKey,
        name: p.exercise,
        muscleGroup: p.muscleGroup,
        equipment: canonEquipment(p.equipment),
        pattern: canonPattern(p.pattern),
      },
      sets: setsFromProgress(exKey),
    };
  });

  return blocks;
}

/**
 * Clamp today’s per-group tonnage near recent average (±20%), by scaling weights.
 */
function clampBlocksToRecentVolume(blocks, recentAvgByGroup, maxDeltaPct = 20) {
  const todayByGroup = {};
  blocks.forEach(b => {
    const g = b.exercise.muscleGroup;
    const tonnage = sum(b.sets.filter(isValidSet).map(s => s.weight * s.reps));
    todayByGroup[g] = (todayByGroup[g] || 0) + tonnage;
  });

  const adjusted = blocks.map(b => ({
    ...b,
    sets: b.sets.map(s => ({ ...s })),
  }));

  adjusted.forEach(b => {
    const g = b.exercise.muscleGroup;
    const today = todayByGroup[g] || 0;
    const recent = recentAvgByGroup[g] || 0;
    if (!recent) return;
    const deltaPct = ((today - recent) / Math.max(1, recent)) * 100;
    if (Math.abs(deltaPct) > maxDeltaPct) {
      const cappedTotal = recent * (1 + Math.sign(deltaPct) * (maxDeltaPct / 100));
      const factor = Math.max(0, cappedTotal / Math.max(1, today));
      b.sets = b.sets.map(s => ({ ...s, weight: Math.max(0, Math.round(s.weight * factor)) }));
    }
  });

  return adjusted;
}

/**
 * Public: Build the full context object to send to the LLM.
 */
export async function buildRepAIContext({ prefs = {}, vitals = {}, stepsAndSleep } = {}) {
  const workouts = await getAllWorkouts();

  const unitsFromHistory = (workouts?.[0]?.units === 'kg') ? 'kg' : 'lb';
  const PREFS = {
    ...prefs,
    units: prefs?.units || unitsFromHistory || 'lb',
  };

  const HISTORY_SUMMARY = buildHistorySummaryRows(workouts, { lookbackDays: 28 });
  const RECENT_AVG_VOLUME_BY_MUSCLE = computeRecentAvgVolumeByMuscle(workouts, { weeks: 3 });
  const exerciseData = computeExerciseProgress(HISTORY_SUMMARY);
  const EXERCISE_PROGRESS = exerciseData.metrics;
  const LAST_3_WEEKS_BY_EXERCISE = exerciseData.byExercise;

  let SEED_BLOCKS = buildSeedBlocks({ prefs: PREFS, historyRows: HISTORY_SUMMARY, exerciseProgress: exerciseData });
  SEED_BLOCKS = clampBlocksToRecentVolume(SEED_BLOCKS, RECENT_AVG_VOLUME_BY_MUSCLE, 20);

  const payload = {
    PREFS,
    VITALS: vitals || {},
    STEPS_AND_SLEEP: stepsAndSleep ?? undefined,
    RECENT_AVG_VOLUME_BY_MUSCLE,
    HISTORY_SUMMARY,
    EXERCISE_PROGRESS,
    LAST_3_WEEKS_BY_EXERCISE,
    SEED_BLOCKS,
  };

  // Debug logs
  try {
    console.log('[RepAIContext] PREFS:', JSON.stringify(PREFS, null, 2));
    console.log('[RepAIContext] VITALS:', JSON.stringify(payload.VITALS, null, 2));
    console.log('[RepAIContext] RECENT_AVG_VOLUME_BY_MUSCLE:', JSON.stringify(RECENT_AVG_VOLUME_BY_MUSCLE, null, 2));
    console.log('[RepAIContext] HISTORY_SUMMARY count:', HISTORY_SUMMARY.length);
    console.log('[RepAIContext] EXERCISE_PROGRESS keys:', Object.keys(EXERCISE_PROGRESS || {}).length);
    console.log('[RepAIContext] LAST_3_WEEKS_BY_EXERCISE keys:', Object.keys(LAST_3_WEEKS_BY_EXERCISE || {}).length);
    console.log('[RepAIContext] SEED_BLOCKS:', JSON.stringify(SEED_BLOCKS, null, 2));
    console.log('[RepAIContext] FULL PAYLOAD:', JSON.stringify(payload, null, 2));
  } catch {
    // ignore console stringify errors
  }

  return payload;
}

export default buildRepAIContext;

