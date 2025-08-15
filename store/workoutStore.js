// store/workoutStore.js (add helpers)
import AsyncStorage from '@react-native-async-storage/async-storage';

const WORKOUTS_KEY = 'rnsteps.workouts.v1';

export async function getAllWorkouts(){
  const raw = await AsyncStorage.getItem(WORKOUTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function getWorkoutById(id){
  const all = await getAllWorkouts();
  return all.find(w => w.id === id) || null;
}

export async function saveWorkout(w){
  const all = await getAllWorkouts();
  const idx = all.findIndex(x => x.id === w.id);
  if (idx >= 0) all[idx] = w; else all.unshift(w);
  await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(all));
}

export function computeSummary(w){
  const totalVolume = (w.blocks||[]).reduce((acc, b) => acc + (b.sets||[]).reduce((s, set) => s + (set.weight * set.reps), 0), 0);
  const totalSets = (w.blocks||[]).reduce((acc, b) => acc + (b.sets||[]).length, 0);
  const durationMin = Math.max(1, Math.round(((w.finishedAt ?? Date.now()) - w.startedAt) / 60000));
  return {
    id: w.id,
    date: new Date(w.startedAt).toISOString().slice(0,10),
    durationMin,
    totalSets,
    totalVolume,
    exercises: (w.blocks||[]).length,
  };
}
