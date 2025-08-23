// utils/repAIPlanner.js
// Full implementation: history-aware planner + LLM orchestration
// Exports: buildPlannerInput, generatePlanWithHistory, generatedPlan
// Default export for convenience + CommonJS interop for require()

import { getAllWorkouts } from '../store/workoutStore';
import { normalizePlan } from './planNormalize';
import { recommendPlanLLM } from '../services/repAIPlannerOpenAI';

// ------------------ helpers ------------------
const DAY_MS = 24 * 60 * 60 * 1000;
const epley = (w, r) => (Number(w) || 0) * (1 + (Number(r) || 0) / 30);
const isValidSet = (s) => Number(s?.weight) > 0 && Number(s?.reps) > 0;

const nowUtc = () => new Date();
const toISODate = (d) => new Date(d).toISOString().slice(0, 10);
const weeksAgo = (n) => new Date(nowUtc().getTime() - n * 7 * DAY_MS);

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const mg = (ex) => ex?.muscleGroup || 'Other';
const eq = (ex) => ex?.equipment || 'bodyweight';

function blockVolume(block) {
  const group = mg(block?.exercise);
  const volume = sum((block?.sets || []).filter(isValidSet).map(s => Number(s.weight) * Number(s.reps)));
  return { group, volume };
}

function workoutVolumeByGroup(workout) {
  const by = {};
  (workout?.blocks || []).forEach(b => {
    const { group, volume } = blockVolume(b);
    by[group] = (by[group] || 0) + volume;
  });
  return by;
}

function flattenHistory(workouts, { lookbackDays = 28 } = {}) {
  const cutoff = new Date(nowUtc().getTime() - lookbackDays * DAY_MS);
  const rows = [];
  (workouts || []).forEach(w => {
    const when = w?.finishedAt || w?.startedAt;
    if (!when) return;
    const d = new Date(when);
    if (d < cutoff) return;

    (w?.blocks || []).forEach(block => {
      const ex = block?.exercise || {};
      (block?.sets || []).forEach(s => {
        if (!isValidSet(s)) return;
        rows.push({
          date: toISODate(d),
          exercise: ex?.name || 'Unknown',
          exerciseId: ex?.id || ex?.name || '',
          muscleGroup: mg(ex),
          equipment: eq(ex),
          pattern: ex?.pattern || '',
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          units: w?.units || 'lb',
        });
      });
    });
  });
  return rows;
}

function computeRecentAvgVolumeByMuscle(workouts, { weeks = 3 } = {}) {
  const cutoff = weeksAgo(weeks);
  const inRange = (workouts || []).filter(
    w => new Date(w?.finishedAt || w?.startedAt) >= cutoff
  );
  const totals = {};
  inRange.forEach(w => {
    const by = workoutVolumeByGroup(w);
    Object.entries(by).forEach(([g, v]) => { totals[g] = (totals[g] || 0) + v; });
  });
  const avg = {};
  Object.entries(totals).forEach(([g, v]) => { avg[g] = v / weeks; });
  return avg;
}

function last3WeeksByExercise(historyRows) {
  const by = {};
  historyRows.forEach(r => {
    const key = r.exerciseId || r.exercise;
    if (!by[key]) by[key] = [];
    by[key].push(r);
  });
  return by;
}

function progressionByExercise(historyRows) {
  const per = {};
  const by = last3WeeksByExercise(historyRows);
  Object.entries(by).forEach(([key, rows]) => {
    let best = 0; let heavy = 0; let volumeTotal = 0;
    const dateSet = new Set();
    rows.forEach(r => {
      best = Math.max(best, epley(r.weight, r.reps));
      heavy = Math.max(heavy, r.weight);
      volumeTotal += Number(r.weight) * Number(r.reps);
      dateSet.add(r.date);
    });
    const avgWeeklyVolume = volumeTotal / 3;
    const recentDates = Array.from(dateSet).sort().slice(-3);
    per[key] = {
      bestE1RM: Number(best.toFixed(1)),
      heaviestLoad: heavy,
      avgWeeklyVolume,
      recentSessionsUsed: recentDates,
    };
  });
  return per;
}

function chooseUpperPlan(historyRows, prefs) {
  const byEx = last3WeeksByExercise(historyRows);
  const catalog = Object.values(byEx)
    .map(arr => arr[arr.length - 1])
    .reduce((acc, r) => {
      const key = r.exerciseId || r.exercise;
      acc[key] = r;
      return acc;
    }, {});

  const candidates = Object.values(catalog).filter(r => {
    const g = (r.muscleGroup || '').toLowerCase();
    return ['chest', 'back', 'shoulders', 'biceps', 'triceps'].includes(g);
  });

  const byGroup = {};
  candidates.forEach(r => {
    const g = r.muscleGroup;
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(r);
  });

  const pickLatest = (group) => {
    const arr = byGroup[group] || [];
    return arr.length ? arr[arr.length - 1] : null;
  };

  const chest = pickLatest('Chest');
  const back = pickLatest('Back');
  const shoulders = pickLatest('Shoulders');
  const biceps = pickLatest('Biceps');
  const triceps = pickLatest('Triceps');

  const picks = [chest, back, shoulders, biceps, triceps].filter(Boolean);
  if (picks.length >= 3) return picks;

  const allowBarbell = (prefs?.equipment || []).includes('barbell');
  const allowDumbbell = (prefs?.equipment || []).includes('dumbbell');

  const fallback = [];
  if (allowBarbell) {
    fallback.push({ exerciseId: 'bench_press_barbell', exercise: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'barbell', pattern: 'push_horizontal' });
    fallback.push({ exerciseId: 'barbell_row', exercise: 'Barbell Row', muscleGroup: 'Back', equipment: 'barbell', pattern: 'pull_horizontal' });
  }
  if (allowDumbbell) {
    fallback.push({ exerciseId: 'dumbbell_shoulder_press', exercise: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'dumbbell', pattern: 'push_vertical' });
    fallback.push({ exerciseId: 'dumbbell_bicep_curl', exercise: 'Dumbbell Bicep Curl', muscleGroup: 'Biceps', equipment: 'dumbbell', pattern: 'isolation' });
    fallback.push({ exerciseId: 'dumbbell_tricep_kickback', exercise: 'Dumbbell Tricep Kickback', muscleGroup: 'Triceps', equipment: 'dumbbell', pattern: 'isolation' });
  }

  return fallback.slice(0, 5);
}

function scaleSetsFromHistory(exKey, exProgress) {
  const m = exProgress[exKey];
  const base = m?.heaviestLoad ? Math.max(0, Math.round(m.heaviestLoad * 0.9)) : 95;
  return [
    { weight: base, reps: 10 },
    { weight: base, reps: 10 },
    { weight: Math.max(0, Math.round(base * 0.95)), reps: 8 },
  ];
}

function clampVolumeByGroup(blocks, recentAvgByGroup, { maxDeltaPct = 20 }) {
  const totals = {};
  blocks.forEach(b => {
    const g = b.exercise.muscleGroup;
    const v = sum(b.sets.filter(isValidSet).map(s => s.weight * s.reps));
    totals[g] = (totals[g] || 0) + v;
  });

  const adjusted = blocks.map(b => ({ ...b, sets: b.sets.map(s => ({ ...s })) }));
  adjusted.forEach(b => {
    const g = b.exercise.muscleGroup;
    const today = totals[g] || 0;
    const avg = recentAvgByGroup[g] || 0;
    if (!avg) return;
    const delta = ((today - avg) / Math.max(1, avg)) * 100;
    if (Math.abs(delta) > maxDeltaPct) {
      const cappedTotal = avg * (1 + Math.sign(delta) * (maxDeltaPct / 100));
      const factor = Math.max(0, cappedTotal / Math.max(1, today));
      b.sets = b.sets.map(s => ({ ...s, weight: Math.max(0, Math.round(s.weight * factor)) }));
    }
  });

  return adjusted;
}

// ------------------ exports ------------------
export async function buildPlannerInput({ prefs, vitals = {}, stepsAndSleep } = {}) {
  const workouts = await getAllWorkouts();
  const HISTORY_SUMMARY = flattenHistory(workouts, { lookbackDays: 28 });
  const RECENT_AVG_VOLUME_BY_MUSCLE = computeRecentAvgVolumeByMuscle(workouts, { weeks: 3 });
  const EXERCISE_PROGRESS = progressionByExercise(HISTORY_SUMMARY);
  const LAST_3_WEEKS_BY_EXERCISE = last3WeeksByExercise(HISTORY_SUMMARY);

  const split = (prefs?.split || 'upper').toLowerCase();
  const picks = (split === 'upper' || split === 'full')
    ? chooseUpperPlan(HISTORY_SUMMARY, prefs)
    : chooseUpperPlan(HISTORY_SUMMARY, prefs);

  const blocks = picks.map(p => {
    const key = p.exerciseId || p.exercise;
    const sets = scaleSetsFromHistory(key, EXERCISE_PROGRESS);
    return {
      exercise: {
        id: p.exerciseId || key,
        name: p.exercise,
        muscleGroup: p.muscleGroup,
        equipment: p.equipment,
        pattern: p.pattern,
      },
      sets,
    };
  });

  const suggestedBlocks = clampVolumeByGroup(blocks, RECENT_AVG_VOLUME_BY_MUSCLE, { maxDeltaPct: 20 });

  return {
    plannerData: {
      PREFS: prefs,
      VITALS: vitals,
      STEPS_AND_SLEEP: stepsAndSleep ?? undefined,
      RECENT_AVG_VOLUME_BY_MUSCLE,
      HISTORY_SUMMARY,
      EXERCISE_PROGRESS,
      LAST_3_WEEKS_BY_EXERCISE,
    },
    suggestedBlocks,
  };
}

export async function generatePlanWithHistory({ prefs, vitals = {}, stepsAndSleep, apiKey, model, endpoint }) {
  const { plannerData, suggestedBlocks } = await buildPlannerInput({ prefs, vitals, stepsAndSleep });

  const { plan } = await recommendPlanLLM({
    prefs,
    vitals,
    historySummary: plannerData.HISTORY_SUMMARY,
    recentAvgVolumeByMuscle: plannerData.RECENT_AVG_VOLUME_BY_MUSCLE,
    exerciseProgress: plannerData.EXERCISE_PROGRESS,
    last3WeeksByExercise: plannerData.LAST_3_WEEKS_BY_EXERCISE,
    seedBlocks: suggestedBlocks,
    apiKey,
    model,
    endpoint,
  });

  const normalized = normalizePlan(plan);
  return { plan: normalized };
}

export async function generatedPlan(args) {
  const { plan } = await generatePlanWithHistory(args);
  return plan;
}

const api = { buildPlannerInput, generatePlanWithHistory, generatedPlan };
export default api;

try {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    module.exports.default = api;
    module.exports.buildPlannerInput = buildPlannerInput;
    module.exports.generatePlanWithHistory = generatePlanWithHistory;
    module.exports.generatedPlan = generatedPlan;
  }
} catch {}

