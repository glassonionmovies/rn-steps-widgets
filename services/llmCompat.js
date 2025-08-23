// services/llmCompat.js
// Unified compatibility layer for Rep.AI LLM calls.
// - Builds a rich, history-aware planning payload via repAIContextBuilder
// - Resolves OpenAI settings from openaiClient (or safe fallback)
// - Calls whichever planner export exists (recommendPlanLLM or generatePlanOpenAI)
// - **FIX**: Maps uppercase ctx keys -> lowercase arg names expected by impl
// - Exposes helper shims so legacy imports keep working

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRepAIContext } from './repAIContextBuilder';

// Safe requires so we don't crash if module shape changes
let openaiClient = {};
let repAIPlannerOpenAI = {};
try { openaiClient = require('./openaiClient'); } catch {}
try { repAIPlannerOpenAI = require('./repAIPlannerOpenAI'); } catch {}

/* ------------------------------
 * Settings resolution
 * ------------------------------ */
async function readKey(k) {
  try {
    const v = await AsyncStorage.getItem(k);
    return v ?? '';
  } catch {
    return '';
  }
}

/**
 * loadOpenAISettings
 * Tries openaiClient.loadOpenAISettings first, then safe fallback (AsyncStorage + Expo extras).
 */
export async function loadOpenAISettings() {
  if (openaiClient && typeof openaiClient.loadOpenAISettings === 'function') {
    return await openaiClient.loadOpenAISettings();
  }
  if (repAIPlannerOpenAI && typeof repAIPlannerOpenAI.loadOpenAISettings === 'function') {
    return await repAIPlannerOpenAI.loadOpenAISettings();
  }

  // Fallback: AsyncStorage + Expo Constants
  const storedKey = await readKey('openai:apiKey');
  const storedModel = (await readKey('openai:model')) || '';

  let extraKey = '';
  let extraModel = '';
  try {
    const Constants = require('expo-constants').default;
    const extra =
      (Constants?.expoConfig && Constants.expoConfig.extra) ||
      (Constants?.manifest2 && Constants.manifest2.extra) ||
      {};
    extraKey = extra.OPENAI_API_KEY || '';
    extraModel = extra.OPENAI_MODEL || '';
  } catch {
    // ignore if expo-constants not available
  }

  const apiKey = storedKey || extraKey || '';
  const model = storedModel || extraModel || 'gpt-4o-mini';
  return { apiKey, model, endpoint: undefined };
}

/* ------------------------------
 * Legacy helper (optional): buildHistorySummary
 * Some older code may still import this from llmCompat.
 * Prefer using buildRepAIContext instead for full payloads.
 * ------------------------------ */
function isValidSet(s) {
  return Number(s?.weight) > 0 && Number(s?.reps) > 0;
}
function toISODate(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function canon(x) {
  return String(x || '').toLowerCase();
}

/**
 * buildHistorySummary(workouts)
 * Minimal fallback row builder if callers still use it.
 */
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
          muscleGroup: muscleGroup,
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
 * Planner resolver
 * ------------------------------ */
function resolvePlannerFn() {
  if (repAIPlannerOpenAI && typeof repAIPlannerOpenAI.recommendPlanLLM === 'function') {
    return repAIPlannerOpenAI.recommendPlanLLM;
  }
  if (repAIPlannerOpenAI && typeof repAIPlannerOpenAI.generatePlanOpenAI === 'function') {
    // some builds still export this name
    return repAIPlannerOpenAI.generatePlanOpenAI;
  }
  return null;
}

/**
 * recommendPlan
 * High-level call that:
 *  - builds a rich context (history, progression, recent volume, seed blocks)
 *  - logs it for debugging
 *  - **maps uppercase ctx keys -> lowercase names** expected by the impl
 *  - calls the available planner function
 *  - returns { plan } or the plan itself wrapped as { plan }
 *
 * Params:
 *  { prefs, vitals, stepsAndSleep, apiKey, model, endpoint }
 */
export async function recommendPlan({ prefs, vitals, stepsAndSleep, apiKey, model, endpoint }) {
  const planner = resolvePlannerFn();
  if (!planner) {
    throw new Error('LLM planner function not found (recommendPlanLLM / generatePlanOpenAI missing).');
  }

  // 1) Build full, rich context (uppercase keys)
  const ctx = await buildRepAIContext({ prefs, vitals, stepsAndSleep });

  // 2) Map to the exact arg names your impl expects (lowercase keys)
  const argsForPlanner = {
    prefs: ctx.PREFS,
    vitals: ctx.VITALS,
    historySummary: ctx.HISTORY_SUMMARY,
    recentAvgVolumeByMuscle: ctx.RECENT_AVG_VOLUME_BY_MUSCLE,
    exerciseProgress: ctx.EXERCISE_PROGRESS,
    last3WeeksByExercise: ctx.LAST_3_WEEKS_BY_EXERCISE,
    seedBlocks: ctx.SEED_BLOCKS,

    apiKey,
    model,
    endpoint,
  };

  // 3) Debug: log both the context and the final args we actually send
  try {
    console.log('[llmCompat] CONTEXT (uppercase):', JSON.stringify(ctx, null, 2));
    console.log(
      '[llmCompat] ARGS TO PLANNER (lowercase):',
      JSON.stringify(
        {
          ...argsForPlanner,
          apiKey: argsForPlanner.apiKey ? `${String(argsForPlanner.apiKey).slice(0, 6)}…` : '',
        },
        null,
        2
      )
    );
  } catch {
    console.log('[llmCompat] Context ready (stringify failed).');
  }

  // 4) Call planner
  const out = await planner(argsForPlanner);

  // 5) Normalize output to { plan }
  return out?.plan ? out : { plan: out };
}

/* ------------------------------
 * Default export (so wildcard/default imports keep working)
 * ------------------------------ */
const api = {
  loadOpenAISettings,
  buildHistorySummary,
  recommendPlan,
};

export default api;

/* ------------------------------
 * CommonJS interop for require() users
 * ------------------------------ */
try {
  // eslint-disable-next-line no-undef
  if (typeof module !== 'undefined' && module.exports) {
    // eslint-disable-next-line no-undef
    module.exports = api;
    // eslint-disable-next-line no-undef
    module.exports.default = api;
    // eslint-disable-next-line no-undef
    module.exports.loadOpenAISettings = loadOpenAISettings;
    // eslint-disable-next-line no-undef
    module.exports.buildHistorySummary = buildHistorySummary;
    // eslint-disable-next-line no-undef
    module.exports.recommendPlan = recommendPlan;
  }
} catch {}
