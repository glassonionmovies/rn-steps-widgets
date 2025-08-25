// services/llmCompat.js
// Unified compatibility layer for Rep.AI LLM calls, optimized for token savings.
//
// Compact mode details:
// ------------------------------------------------------
// NxYr@Zlb means:
//   N sets of Y reps at Z pounds (e.g., 2x6r@80lb → two sets of six reps at 80 lb).
// ------------------------------------------------------
//
// Changes in compact mode:
// - Shapes vitals robustly (energy/sleep/mode/weight preserved, aliases handled).
// - Deduplicates exercise details into `exercise_map`.
// - Converts bulky arrays into CSV:
//     * last3WeeksByExercise -> last3WeeksCsv (date,exerciseId,reps,weight)
//     * exerciseProgress -> exerciseProgressCsv (id,bestE1RM,heaviestLoad,avgWeeklyVolume)
//     * recentAvgVolumeByMuscle -> recentAvgVolumeByMuscleCsv (muscleGroup,avgVolume)
// - Keeps `recentWorkoutSummary` as concise NxYr@Zlb strings.
// - Drops repeated metadata and empty fields.
// - Automatic fallback to original full JSON if compact call fails.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRepAIContext } from './repAIContextBuilder';

const COMPACT_MODE = true;

let openaiClient = {};
let repAIPlannerOpenAI = {};
try { openaiClient = require('./openaiClient'); } catch {}
try { repAIPlannerOpenAI = require('./repAIPlannerOpenAI'); } catch {}

/* ------------------------------
 * Settings
 * ------------------------------ */
async function readKey(k) { try { const v = await AsyncStorage.getItem(k); return v ?? ''; } catch { return ''; } }

export async function loadOpenAISettings() {
  if (openaiClient && typeof openaiClient.loadOpenAISettings === 'function') {
    return await openaiClient.loadOpenAISettings();
  }
  if (repAIPlannerOpenAI && typeof repAIPlannerOpenAI.loadOpenAISettings === 'function') {
    return await repAIPlannerOpenAI.loadOpenAISettings();
  }

  const storedKey = await readKey('openai:apiKey');
  const storedModel = (await readKey('openai:model')) || '';
  let extraKey = '', extraModel = '';
  try {
    const Constants = require('expo-constants').default;
    const extra =
      (Constants?.expoConfig && Constants.expoConfig.extra) ||
      (Constants?.manifest2 && Constants.manifest2.extra) ||
      {};
    extraKey = extra.OPENAI_API_KEY || '';
    extraModel = extra.OPENAI_MODEL || '';
  } catch {}
  const apiKey = storedKey || extraKey || '';
  const model = storedModel || extraModel || 'gpt-4o-mini';
  return { apiKey, model, endpoint: undefined };
}

/* ------------------------------
 * Legacy helper: buildHistorySummary
 * ------------------------------ */
function isValidSet(s) { return Number(s?.weight) > 0 && Number(s?.reps) > 0; }
function toISODate(d) { return new Date(d).toISOString().slice(0, 10); }
function canon(x) { return String(x || '').toLowerCase(); }

export function buildHistorySummary(workouts) {
  if (repAIPlannerOpenAI && typeof repAIPlannerOpenAI.buildHistorySummary === 'function') {
    return repAIPlannerOpenAI.buildHistorySummary(workouts);
  }
  const rows = [];
  (workouts || []).forEach((w) => {
    const when = w?.finishedAt || w?.startedAt;
    if (!when) return;
    const dateIso = toISODate(when);
    const units = w?.units === 'kg' ? 'kg' : 'lb';
    (w?.blocks || []).forEach((b) => {
      const ex = b?.exercise || {};
      const exName = ex?.name || 'Unknown';
      const muscleGroup = ex?.muscleGroup || 'Other';
      const equipment = ex?.equipment || 'bodyweight';
      const pattern = ex?.pattern || '';
      (b?.sets || []).forEach((s) => {
        if (!isValidSet(s)) return;
        rows.push({
          date: dateIso,
          exercise: exName,
          exerciseId: ex?.id || exName,
          muscleGroup,
          equipment: canon(equipment),
          pattern: canon(pattern),
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          units,
        });
      });
    });
  });
  return rows;
}

/* ------------------------------
 * Vitals shaping
 * ------------------------------ */
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o ?? {}, k);
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };

function shapeVitals(v = {}) {
  const out = {};
  const r = v?.readiness ?? {};
  for (const cand of [v.energy, v.energyScore, r.energy]) {
    const n = toNum(cand); if (n !== undefined) { out.energy = n; break; }
  }
  for (const cand of [v.sleep, v.sleepQuality, v.sleepScore, r.sleep, r.sleepQuality]) {
    const n = toNum(cand); if (n !== undefined) { out.sleep = n; break; }
  }
  if (typeof v.mode === 'string' && v.mode.trim()) out.mode = v.mode.trim();
  else if (typeof r.mode === 'string' && r.mode.trim()) out.mode = r.mode.trim();
  for (const cand of [v.weightLb, r.weightLb]) {
    const n = toNum(cand); if (n !== undefined) { out.weightLb = n; break; }
  }
  return out;
}

/* ------------------------------
 * Compact helpers
 * ------------------------------ */
function exerciseIdOf(nameOrId) {
  return String(nameOrId || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function buildExerciseMap({ historySummary = [], seedBlocks = [] } = {}) {
  const map = {};
  const upsert = (id, meta) => {
    if (!id) return;
    if (!map[id]) map[id] = {};
    if (meta.name && !map[id].name) map[id].name = meta.name;
    if (meta.muscleGroup && !map[id].muscleGroup) map[id].muscleGroup = meta.muscleGroup;
    if (meta.equipment && !map[id].equipment) map[id].equipment = meta.equipment;
  };
  for (const r of historySummary) {
    const id = r.exerciseId || exerciseIdOf(r.exercise);
    upsert(id, { name: r.exercise, muscleGroup: r.muscleGroup, equipment: r.equipment });
  }
  for (const blk of seedBlocks) {
    const ex = blk.exercise || {};
    const id = ex.id || exerciseIdOf(ex.name);
    upsert(id, { name: ex.name, muscleGroup: ex.muscleGroup, equipment: ex.equipment });
  }
  return map;
}

function compressSetsString(rows, units = 'lb') {
  const parts = [];
  let last = null;
  const flush = () => {
    if (!last) return;
    parts.push(last.count > 1 ? `${last.count}x${last.reps}r@${last.weight}${units}` : `${last.reps}r@${last.weight}${units}`);
    last = null;
  };
  for (const s of rows) {
    const reps = Number(s.reps) || 0, weight = Number(s.weight) || 0;
    if (!last) last = { reps, weight, count: 1 };
    else if (last.reps === reps && last.weight === weight) last.count += 1;
    else { flush(); last = { reps, weight, count: 1 }; }
  }
  flush();
  return parts.join(', ');
}

function buildRecentWorkoutSummary({ historySummary = [], units = 'lb' }) {
  const byId = new Map(), order = [];
  for (const r of historySummary) {
    const id = r.exerciseId || exerciseIdOf(r.exercise);
    if (!byId.has(id)) { byId.set(id, []); order.push(id); }
    byId.get(id).push({ reps: r.reps, weight: r.weight });
  }
  return order.map((id) => ({ id, sets: compressSetsString(byId.get(id), units) }));
}

function compactSeedBlocks(seedBlocks) {
  return seedBlocks.map((blk) => {
    const id = blk.exercise?.id || exerciseIdOf(blk.exercise?.name);
    return { id, sets: blk.sets.map((s) => ({ weight: s.weight, reps: s.reps })) };
  });
}

function trimEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v == null || (typeof v === 'string' && !v.trim())) continue;
    out[k] = v;
  }
  return out;
}

/* ------------------------------
 * CSV builders
 * ------------------------------ */
function buildExerciseProgressCsv(progress = {}) {
  const lines = ['id,bestE1RM,heaviestLoad,avgWeeklyVolume'];
  for (const [id, p] of Object.entries(progress)) {
    lines.push([id, p.bestE1RM ?? '', p.heaviestLoad ?? '', p.avgWeeklyVolume ?? ''].join(','));
  }
  return lines.join('\n');
}

function buildRecentAvgVolumeCsv(map = {}) {
  const lines = ['muscleGroup,avgVolume'];
  for (const [mg, vol] of Object.entries(map)) {
    lines.push([mg, vol].join(','));
  }
  return lines.join('\n');
}

function buildLast3WeeksCsv(last3 = {}) {
  const lines = ['date,exerciseId,reps,weight'];
  for (const [id, rows] of Object.entries(last3)) {
    for (const r of rows) lines.push([r.date, id, r.reps, r.weight].join(','));
  }
  return lines.join('\n');
}

/* ------------------------------
 * Planner resolver
 * ------------------------------ */
function resolvePlannerFn() {
  if (repAIPlannerOpenAI.recommendPlanLLM) return repAIPlannerOpenAI.recommendPlanLLM;
  if (repAIPlannerOpenAI.generatePlanOpenAI) return repAIPlannerOpenAI.generatePlanOpenAI;
  return null;
}

/* ------------------------------
 * Compact args builder
 * ------------------------------ */
function buildCompactArgs({ args, preferUnits }) {
  const {
    prefs = {}, vitals = {}, historySummary = [], exerciseProgress = {},
    seedBlocks = [], recentAvgVolumeByMuscle, last3WeeksByExercise
  } = args;

  const units = preferUnits || prefs.units || 'lb';
  return {
    formatNotes: "NxYr@Zlb means: N sets of Y reps at Z pounds (e.g., 2x6r@80lb → two sets of six reps at 80 lb).",
    prefs: trimEmpty({ goal: prefs.goal, split: prefs.split, timeBudgetMin: prefs.timeBudgetMin, equipment: prefs.equipment, units, intensity: prefs.intensity }),
    vitals: trimEmpty(vitals),
    exercise_map: buildExerciseMap({ historySummary, seedBlocks }),
    recentWorkoutSummary: buildRecentWorkoutSummary({ historySummary, units }),
    seedBlocks: compactSeedBlocks(seedBlocks),
    exerciseProgressCsv: buildExerciseProgressCsv(exerciseProgress),
    recentAvgVolumeByMuscleCsv: buildRecentAvgVolumeCsv(recentAvgVolumeByMuscle),
    last3WeeksCsv: buildLast3WeeksCsv(last3WeeksByExercise),
  };
}

/* ------------------------------
 * recommendPlan
 * ------------------------------ */
export async function recommendPlan({ prefs, vitals, stepsAndSleep, apiKey, model, endpoint }) {
  const planner = resolvePlannerFn();
  if (!planner) throw new Error('Planner not found');

  const vitalsInputShaped = shapeVitals(vitals);
  const ctx = await buildRepAIContext({ prefs, vitals: vitalsInputShaped, stepsAndSleep });

  const original = {
    prefs: ctx.PREFS,
    vitals: shapeVitals({ ...(ctx.VITALS || {}), ...(vitalsInputShaped || {}) }),
    historySummary: ctx.HISTORY_SUMMARY,
    recentAvgVolumeByMuscle: ctx.RECENT_AVG_VOLUME_BY_MUSCLE,
    exerciseProgress: ctx.EXERCISE_PROGRESS,
    last3WeeksByExercise: ctx.LAST_3_WEEKS_BY_EXERCISE,
    seedBlocks: ctx.SEED_BLOCKS,
    apiKey, model, endpoint,
  };

  const compactArgs = buildCompactArgs({ args: original, preferUnits: original.prefs.units });
  console.log('[llmCompat] ARGS (compact):', JSON.stringify(compactArgs, null, 2));

  try {
    if (COMPACT_MODE) return await planner(compactArgs);
  } catch (e) {
    console.warn('Compact failed, retrying full payload:', e.message);
  }
  return await planner(original);
}

/* ------------------------------
 * Default export
 * ------------------------------ */
export default { loadOpenAISettings, buildHistorySummary, recommendPlan };
