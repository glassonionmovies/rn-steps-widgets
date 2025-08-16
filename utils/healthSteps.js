// utils/healthSteps.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'health:steps:7d';

// Normalize to an array of 7 numbers
function normalize7(arr) {
  if (!Array.isArray(arr)) return Array(7).fill(0);
  const nums = arr.map(n => Number(n) || 0);
  if (nums.length === 7) return nums;
  // If longer/shorter, take last 7 and left-pad with zeros
  const last7 = nums.slice(-7);
  return Array(7 - last7.length).fill(0).concat(last7);
}

export async function readSteps7() {
  // Primary key
  const primary = await AsyncStorage.getItem(KEY);
  if (primary) {
    try { return normalize7(JSON.parse(primary)); } catch {}
  }
  // Back-compat with likely keys used before
  for (const k of ['WidgetTwoHealth:steps7', 'health:steps7']) {
    const v = await AsyncStorage.getItem(k);
    if (v) {
      try { return normalize7(JSON.parse(v)); } catch {}
    }
  }
  return Array(7).fill(0);
}

export async function writeSteps7(arr) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(normalize7(arr))); } catch {}
}
