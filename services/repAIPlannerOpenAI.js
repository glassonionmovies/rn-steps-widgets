// services/repAIPlannerOpenAI.impl.js
// Actual LLM planner implementation used by the compat wrapper.
// Exports: recommendPlanLLM (primary), generatePlanOpenAI (compat alias), buildHistorySummary (optional).
//
// - Uses fetch to call OpenAI's Chat Completions API
// - Expects: { prefs, vitals, historySummary, apiKey, model, endpoint? }
// - Returns: { plan } where plan is STRICT JSON per the required schema

// NOTE: No external OpenAI SDK required. Works in RN via global fetch.

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// System + schema hints (kept concise and stable)
const SYSTEM_MESSAGE =
  "You are a certified personal fitness trainer and an empathetic coach. Use the user's current vitals and preferences, along with their workout history and per-exercise progression, to suggest what they should do today. Match their established workout patterns so the plan feels familiar, sustainable, and safe, while nudging progressive improvement. Celebrate wins, motivate positively, and keep excitement high. CRITICAL OUTPUT RULES: - Output MUST be valid JSON only (no markdown, no comments). - Use the exact schema specified in the user message. - Every exercise must be feasible with the user's available equipment and units. - Keep volume by muscle group within a reasonable band versus recent history (±20% unless justified). - Provide clear reasons in the 'why' field and tie them to history, vitals, and constraints.";

const SCHEMA_HINT =
  'REQUIRED RESPONSE SCHEMA: { "name": "string", "units": "lb | kg", "blocks": [ { "exercise": { "id": "string", "name": "string", "muscleGroup": "string", "equipment": "string", "pattern": "string" }, "sets": [ { "weight": "number", "reps": "number" } ], "notes": "string optional" } ], "why": { "overview": "string", "perExercise": [ { "exerciseName": "string", "reason": "string", "progressionReference": { "bestE1RM": "number optional", "heaviestLoad": "number optional", "avgWeeklyVolume": "number optional", "recentSessionsUsed": ["YYYY-MM-DD","YYYY-MM-DD"] } } ], "volumeCheck": { "byMuscleGroup": [ { "group": "string", "todayVolume": 0, "recentAvg": 0, "deltaPct": 0, "ok": true } ], "notes": "string" }, "safetyAndFeasibility": "string" } }';

// --- small helper to stringify user data safely
function buildUserContent({ prefs, vitals, historySummary, recentAvgVolumeByMuscle, exerciseProgress, last3WeeksByExercise, seedBlocks }) {
  const payload = {
    PREFS: prefs || {},
    VITALS: vitals || {},
    STEPS_AND_SLEEP: undefined, // not wired in this implementation
    RECENT_AVG_VOLUME_BY_MUSCLE: recentAvgVolumeByMuscle || {},
    HISTORY_SUMMARY: historySummary || [],
    EXERCISE_PROGRESS: exerciseProgress || {},
    LAST_3_WEEKS_BY_EXERCISE: last3WeeksByExercise || {},
    SEED_BLOCKS: seedBlocks || [],
  };
  return `${SCHEMA_HINT} DATA FOLLOWS: ${JSON.stringify(payload)}`;
}

// --- core OpenAI call
async function callOpenAIChatJSON({ apiKey, endpoint, model, system, user }) {
  const url = endpoint || DEFAULT_ENDPOINT;
  const body = {
    model: model || DEFAULT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI HTTP ${res.status}: ${txt || res.statusText}`);
  }

  const json = await res.json();
  const choice = json?.choices?.[0];
  const content = choice?.message?.content?.trim();

  if (!content) {
    throw new Error('Empty response from OpenAI.');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('OpenAI returned non-JSON content.');
  }
  return parsed;
}

/**
 * Primary entry point expected by your wrapper.
 * Returns: { plan } where plan already matches the strict JSON schema (not normalized here).
 */
export async function recommendPlanLLM({
  prefs,
  vitals,
  historySummary,
  recentAvgVolumeByMuscle,
  exerciseProgress,
  last3WeeksByExercise,
  seedBlocks,
  apiKey,
  model,
  endpoint,
}) {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key.');
  }

  const userContent = buildUserContent({
    prefs,
    vitals,
    historySummary,
    recentAvgVolumeByMuscle,
    exerciseProgress,
    last3WeeksByExercise,
    seedBlocks,
  });

  const plan = await callOpenAIChatJSON({
    apiKey,
    endpoint,
    model,
    system: SYSTEM_MESSAGE,
    user: userContent,
  });

  // The screen’s normalize step will handle further validation,
  // but we return a wrapped object to satisfy the wrapper’s expectation.
  return { plan };
}

/**
 * Compat alias — some parts of your codebase may still call this name.
 * We forward to recommendPlanLLM and unwrap.
 */
export async function generatePlanOpenAI(args) {
  const { plan } = await recommendPlanLLM(args);
  return plan;
}

/**
 * Optional: If you want to keep a dedicated buildHistorySummary here too,
 * you can export it. The wrapper already provides a fallback,
 * so this is not strictly required.
 */
// export function buildHistorySummary(workouts) { /* your version here if needed */ }

// ----- CommonJS interop -----
try {
  // eslint-disable-next-line no-undef
  if (typeof module !== 'undefined' && module.exports) {
    const api = { recommendPlanLLM, generatePlanOpenAI };
    // eslint-disable-next-line no-undef
    module.exports = api;
    // eslint-disable-next-line no-undef
    module.exports.default = api;
    // eslint-disable-next-line no-undef
    module.exports.recommendPlanLLM = recommendPlanLLM;
    // eslint-disable-next-line no-undef
    module.exports.generatePlanOpenAI = generatePlanOpenAI;
  }
} catch {}
