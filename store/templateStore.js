// store/templateStore.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const TEMPLATES_KEY = 'workout:templates';

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeAll(arr) {
  try {
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(arr || []));
  } catch {}
}

export async function getAllWorkoutTemplates() {
  return await readAll();
}

export async function saveWorkoutTemplate(name, payload /* { units, blocks } */) {
  const all = await readAll();
  const item = {
    id: uuidv4(),
    name: String(name || `Template ${new Date().toISOString()}`),
    createdAt: new Date().toISOString(),
    units: payload?.units || 'lb',
    blocks: (payload?.blocks || []).map(b => ({
      exercise: b.exercise,
      sets: (b.sets || []).map(s => ({
        weight: Number(s.weight) || 0,
        reps: Number(s.reps) || 0,
      })),
    })),
  };
  all.push(item);
  await writeAll(all);
  return item;
}

export async function deleteWorkoutTemplate(id) {
  const all = await readAll();
  const next = all.filter(t => t.id !== id);
  await writeAll(next);
  return true;
}

export async function renameWorkoutTemplate(id, newName) {
  const all = await readAll();
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], name: String(newName || '').trim() || all[idx].name };
  await writeAll(all);
  return all[idx];
}
