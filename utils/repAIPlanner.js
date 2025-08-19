// utils/repAIPlanner.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllWorkouts } from '../store/workoutStore';

const SETTINGS_KEY = 'settings:training';

const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs'];
const DEFAULT_PRIMARY = {
  Chest: { id: 'bench_press', name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell', icon: '🏋️‍♂️' },
  Back: { id: 'bent_over_row', name: 'Bent-over Row', muscleGroup: 'Back', equipment: 'Barbell', icon: '🏋️‍♂️' },
  Shoulders: { id: 'ohp', name: 'Overhead Press', muscleGroup: 'Shoulders', equipment: 'Barbell', icon: '🛠️' },
  Arms: { id: 'barbell_curl', name: 'Barbell Curl', muscleGroup: 'Arms', equipment: 'Barbell', icon: '💪' },
  Legs: { id: 'back_squat', name: 'Back Squat', muscleGroup: 'Legs', equipment: 'Barbell', icon: '🏋️‍♂️' },
  Abs: { id: 'plank', name: 'Plank', muscleGroup: 'Abs', equipment: 'Bodyweight', icon: '➖' },
};

const ACCESSORY_POOL = {
  Chest: [
    { id: 'incline_db_press', name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbells', icon: '💪' },
    { id: 'db_flyes', name: 'Dumbbell Flyes', muscleGroup: 'Chest', equipment: 'Dumbbells', icon: '👐' },
    { id: 'push_ups', name: 'Push-ups', muscleGroup: 'Chest', equipment: 'Bodyweight', icon: '🤸' },
  ],
  Back: [
    { id: 'lat_pulldown', name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable', icon: '🎣' },
    { id: 'seated_row', name: 'Seated Row', muscleGroup: 'Back', equipment: 'Machine', icon: '🪑' },
    { id: 'pull_ups', name: 'Pull-ups', muscleGroup: 'Back', equipment: 'Bodyweight', icon: '🧗' },
  ],
  Shoulders: [
    { id: 'db_shoulder_press', name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbells', icon: '💪' },
    { id: 'lateral_raise', name: 'Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbells', icon: '↔️' },
    { id: 'rear_delt_fly', name: 'Rear Delt Fly', muscleGroup: 'Shoulders', equipment: 'Dumbbells', icon: '🪽' },
  ],
  Arms: [
    { id: 'triceps_pushdown', name: 'Triceps Pushdown', muscleGroup: 'Arms', equipment: 'Cable', icon: '🧵' },
    { id: 'db_curl', name: 'Dumbbell Curl', muscleGroup: 'Arms', equipment: 'Dumbbells', icon: '💪' },
    { id: 'skull_crushers', name: 'Skull Crushers', muscleGroup: 'Arms', equipment: 'Barbell', icon: '💀' },
  ],
  Legs: [
    { id: 'front_squat', name: 'Front Squat', muscleGroup: 'Legs', equipment: 'Barbell', icon: '🏋️' },
    { id: 'rdl', name: 'Romanian Deadlift', muscleGroup: 'Legs', equipment: 'Barbell', icon: '🧱' },
    { id: 'leg_press', name: 'Leg Press', muscleGroup: 'Legs', equipment: 'Machine', icon: '🦵' },
  ],
  Abs: [
    { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', muscleGroup: 'Abs', equipment: 'Bar', icon: '🪜' },
    { id: 'crunch', name: 'Crunch', muscleGroup: 'Abs', equipment: 'Bodyweight', icon: '🌊' },
    { id: 'plank', name: 'Plank', muscleGroup: 'Abs', equipment: 'Bodyweight', icon: '➖' },
  ],
};

const epley = (w, r) => (Number(w)||0) * (1 + (Number(r)||0)/30);
const backSolveWeightForReps = (e1, reps) => {
  const denom = 1 + (Number(reps)||0)/30;
  return denom > 0 ? e1/denom : 0;
};

const roundPlate = (lbs, rounding) => {
  // rounding: 'lb5' or 'kg2.5'
  const step = rounding === 'kg2.5' ? 2.5 : 5;
  return Math.round((lbs || 0) / step) * step;
};

async function getSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      plateRounding: parsed.plateRounding || 'lb5',
      adoptRestHints: !!parsed.adoptRestHints,
    };
  } catch {
    return { plateRounding: 'lb5', adoptRestHints: false };
  }
}

function daysSince(ts) {
  if (!ts) return 999;
  const d = (Date.now() - ts) / (24*60*60*1000);
  return Math.max(0, Math.floor(d));
}

function summarizeHistory(workouts) {
  const byGroup = new Map(); // group -> { lastDayTs, totalVolumeRecent }
  (workouts || []).forEach(w => {
    (w.blocks || []).forEach(b => {
      const g = b.exercise?.muscleGroup;
      if (!GROUPS.includes(g)) return;
      const v = (b.sets || []).reduce((a,s)=>a+(Number(s.weight)||0)*(Number(s.reps)||0),0);
      const rec = byGroup.get(g) || { last: 0, vol: 0, sessions: 0 };
      rec.last = Math.max(rec.last, w.startedAt || 0);
      rec.vol += v;
      rec.sessions += 1;
      byGroup.set(g, rec);
    });
  });
  return byGroup;
}

function chooseFocusGroup(byGroup) {
  // Gap score = days since last trained (bigger is higher priority)
  const scored = GROUPS.map(g => {
    const rec = byGroup.get(g) || { last: 0, vol: 0, sessions: 0 };
    return { group: g, gap: daysSince(rec.last), vol: rec.vol };
  });
  scored.sort((a,b) => (b.gap - a.gap) || (a.vol - b.vol)); // larger gap first; lower volume gets priority on tie
  return scored[0]?.group || 'Back';
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
}

function last3MedianForExercise(workouts, exName, targetReps) {
  const sets = [];
  (workouts || []).forEach(w => {
    (w.blocks || []).forEach(b => {
      const name = b.exercise?.name || '';
      if (name.toLowerCase() !== (exName||'').toLowerCase()) return;
      (b.sets || []).forEach(s => {
        const r = Number(s.reps)||0;
        const wgt = Number(s.weight)||0;
        if (r>0 && wgt>0 && Math.abs(r - targetReps) <= 2) sets.push(wgt);
      });
    });
  });
  return median(sets);
}

function bestE1ForExercise(workouts, exName) {
  let best = 0;
  (workouts || []).forEach(w => {
    (w.blocks || []).forEach(b => {
      const name = b.exercise?.name || '';
      if (name.toLowerCase() !== (exName||'').toLowerCase()) return;
      (b.sets || []).forEach(s => {
        best = Math.max(best, epley(s.weight, s.reps));
      });
    });
  });
  return best;
}

function readinessMultiplier(energy=6, sleep=6) {
  const score = 0.6*(Number(energy)||0) + 0.4*(Number(sleep)||0); // ~0..10
  if (score >= 7) return 1.03; // +3%
  if (score <= 3) return 0.92; // -8%
  return 1.0;
}

function goalVolumeBias(goalMode) {
  const g = (goalMode||'maintenance').toLowerCase();
  if (g.startsWith('fast')) return 0.9;
  if (g.startsWith('bulk')) return 1.12;
  return 1.0;
}

function dynamicPlanName(focus) {
  const map = { Back: 'Upper Pull', Chest: 'Upper Push', Legs: 'Lower', Shoulders: 'Shoulders', Arms: 'Arms', Abs: 'Core' };
  return `${map[focus] || focus} (Rep.AI)`;
}

export async function generateRecommendedPlan({ readiness, goalMode }) {
  const [workouts, settings] = await Promise.all([getAllWorkouts(), getSettings()]);

  const byGroup = summarizeHistory(workouts);
  const focus = chooseFocusGroup(byGroup);

  // Primary & 1–2 accessories
  const primary = DEFAULT_PRIMARY[focus];
  const accessories = (ACCESSORY_POOL[focus] || []).slice(0, 2);

  // Targets
  const baseCompoundReps = 8;
  const baseAccessoryReps = 12;
  let compoundSets = 3;
  let accessorySets = 2;

  // Volume bias by goal + readiness
  const rMult = readinessMultiplier(readiness?.energy, readiness?.sleep);
  const vMult = goalVolumeBias(goalMode);

  if (rMult > 1.02) compoundSets += 1; // extra set if high readiness
  if (vMult > 1.1) accessorySets += 1; // bulking bump

  // Weights from last-3 median; fallback to best e1RM → back-solve
  const rounding = settings.plateRounding || 'lb5';
  const compMedian = last3MedianForExercise(workouts, primary.name, baseCompoundReps);
  let compW = compMedian || backSolveWeightForReps(bestE1ForExercise(workouts, primary.name), baseCompoundReps);
  compW = roundPlate(compW * rMult, rounding);

  const accWeights = accessories.map(acc => {
    const m = last3MedianForExercise(workouts, acc.name, baseAccessoryReps);
    let w = m || backSolveWeightForReps(bestE1ForExercise(workouts, acc.name), baseAccessoryReps);
    return roundPlate(w * rMult * 0.9, rounding); // accessories a bit lighter
  });

  const blocks = [
    {
      exercise: primary,
      sets: Array.from({ length: compoundSets }, () => ({ weight: compW, reps: baseCompoundReps })),
    },
    ...accessories.map((acc, i) => ({
      exercise: acc,
      sets: Array.from({ length: accessorySets }, () => ({ weight: accWeights[i], reps: baseAccessoryReps })),
    })),
  ];

  const restHints = { compound: 150, accessory: 75 }; // seconds

  const name = dynamicPlanName(focus);
  const rationale = [
    `Gap focus: ${focus} (${daysSince(byGroup.get(focus)?.last)} days)`,
    `Readiness adj: ${(Math.round((rMult-1)*100))}%`,
    `${(goalMode||'Maintenance')} volume bias`,
  ];

  return {
    name,
    units: 'lb',
    rationale,
    blocks,
    restHints,
    plateRounding: rounding,
    meta: { focus, rMult, vMult },
  };
}
