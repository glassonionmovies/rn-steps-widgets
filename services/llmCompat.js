// services/llmCompat.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRepAIContext } from './repAIContextBuilder';

let openaiClient = {};
let repAIPlannerOpenAI = {};
try { openaiClient = require('./openaiClient'); } catch {}
try { repAIPlannerOpenAI = require('./repAIPlannerOpenAI'); } catch {}

async function readKey(k) { try { const v = await AsyncStorage.getItem(k); return v ?? ''; } catch { return ''; } }

export async function loadOpenAISettings() {
  if (openaiClient?.loadOpenAISettings) return await openaiClient.loadOpenAISettings();
  if (repAIPlannerOpenAI?.loadOpenAISettings) return await repAIPlannerOpenAI.loadOpenAISettings();

  const storedKey = await readKey('openai:apiKey');
  const storedModel = (await readKey('openai:model')) || '';

  let extraKey = '', extraModel = '';
  try {
    const Constants = require('expo-constants').default;
    const extra = (Constants?.expoConfig?.extra) || (Constants?.manifest2?.extra) || {};
    extraKey = extra.OPENAI_API_KEY || '';
    extraModel = extra.OPENAI_MODEL || '';
  } catch {}
  const apiKey = storedKey || extraKey || '';
  const model = storedModel || extraModel || 'gpt-4o-mini';
  return { apiKey, model, endpoint: undefined };
}

// history summary fallback (unchanged)
function isValidSet(s){ return Number(s?.weight) > 0 && Number(s?.reps) > 0; }
function toISODate(d){ return new Date(d).toISOString().slice(0, 10); }
function canon(x){ return String(x || '').toLowerCase(); }

export function buildHistorySummary(workouts) {
  if (repAIPlannerOpenAI?.buildHistorySummary) return repAIPlannerOpenAI.buildHistorySummary(workouts);
  const rows = [];
  (workouts || []).forEach(w => {
    const when = w?.finishedAt || w?.startedAt; if (!when) return;
    const dateIso = toISODate(when);
    const units = w?.units === 'kg' ? 'kg' : 'lb';
    (w?.blocks || []).forEach(b => {
      const ex = b?.exercise || {};
      const exName = ex?.name || 'Unknown';
      const muscleGroup = ex?.muscleGroup || 'Other';
      const equipment = ex?.equipment || 'bodyweight';
      const pattern = ex?.pattern || '';
      (b?.sets || []).forEach(s => {
        if (!isValidSet(s)) return;
        rows.push({ date: dateIso, exercise: exName, exerciseId: ex?.id || exName, muscleGroup, equipment: canon(equipment), pattern: canon(pattern), weight: Number(s.weight)||0, reps: Number(s.reps)||0, units });
      });
    });
  });
  return rows;
}

// vitals shaping
const hasOwn = (o,k)=>Object.prototype.hasOwnProperty.call(o ?? {}, k);
const toNum = v => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
function shapeVitals(v = {}) {
  const r = v?.readiness ?? {};
  const out = {};
  const takeNum = (src, key, to=key) => { if (hasOwn(src,key)) { const n = toNum(src[key]); if (n !== undefined) out[to] = n; } };

  // energy candidates
  takeNum(v,'energy'); takeNum(v,'energyScore','energy'); takeNum(r,'energy');

  // sleep candidates
  takeNum(v,'sleep'); takeNum(v,'sleepQuality','sleep'); takeNum(v,'sleepScore','sleep');
  takeNum(r,'sleep'); takeNum(r,'sleepQuality','sleep');

  if (typeof v.mode === 'string' && v.mode.trim()) out.mode = v.mode.trim();
  else if (typeof r.mode === 'string' && r.mode.trim()) out.mode = r.mode.trim();

  if (hasOwn(v,'weightLb')) { const n = toNum(v.weightLb); if (n !== undefined) out.weightLb = n; }
  else if (hasOwn(r,'weightLb')) { const n = toNum(r.weightLb); if (n !== undefined) out.weightLb = n; }

  return out;
}

function resolvePlannerFn() {
  if (repAIPlannerOpenAI?.recommendPlanLLM) return repAIPlannerOpenAI.recommendPlanLLM;
  if (repAIPlannerOpenAI?.generatePlanOpenAI) return repAIPlannerOpenAI.generatePlanOpenAI;
  return null;
}

export async function recommendPlan({ prefs, vitals, stepsAndSleep, apiKey, model, endpoint }) {
  const planner = resolvePlannerFn();
  if (!planner) throw new Error('LLM planner function not found (recommendPlanLLM / generatePlanOpenAI missing).');

  // Log exactly what came in
  try {
    console.log('[llmCompat] RAW VITALS IN:', JSON.stringify(vitals, null, 2));
  } catch {}

  // Normalize vitals now
  const vitalsInputShaped = shapeVitals(vitals || {});

  // Build context with our shaped vitals
  const ctx = await buildRepAIContext({ prefs, vitals: vitalsInputShaped, stepsAndSleep });

  // Final vitals = our shaped input overlaid on any ctx-provided fields (and reshaped)
  const vitalsFinal = shapeVitals({ ...(ctx?.VITALS || {}), ...(vitalsInputShaped || {}) });

  const argsForPlanner = {
    prefs: ctx.PREFS,
    vitals: vitalsFinal,
    historySummary: ctx.HISTORY_SUMMARY,
    recentAvgVolumeByMuscle: ctx.RECENT_AVG_VOLUME_BY_MUSCLE,
    exerciseProgress: ctx.EXERCISE_PROGRESS,
    last3WeeksByExercise: ctx.LAST_3_WEEKS_BY_EXERCISE,
    seedBlocks: ctx.SEED_BLOCKS,
    apiKey, model, endpoint,
  };

  try {
    console.log('[llmCompat] ARGS TO PLANNER (lowercase):', JSON.stringify({
      ...argsForPlanner,
      apiKey: argsForPlanner.apiKey ? `${String(argsForPlanner.apiKey).slice(0, 6)}…` : '',
    }, null, 2));
  } catch {}

  const out = await planner(argsForPlanner);
  return out?.plan ? out : { plan: out };
}

const api = { loadOpenAISettings, buildHistorySummary, recommendPlan };
export default api;

try {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    module.exports.default = api;
    module.exports.loadOpenAISettings = loadOpenAISettings;
    module.exports.buildHistorySummary = buildHistorySummary;
    module.exports.recommendPlan = recommendPlan;
  }
} catch {}
