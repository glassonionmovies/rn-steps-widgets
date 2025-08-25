// utils/useRepAIPlan.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllWorkouts } from '../store/workoutStore';

const CHECKIN_KEY = 'wellness:checkins';

// Match HomeScreen's "sameDay" behavior (UTC ISO slice)
function isoToday() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC (to match how 'at' is saved)
}
function sameDay(isoA, isoB) {
  return (isoA || '').slice(0, 10) === (isoB || '').slice(0, 10);
}

async function loadPrefs() {
  try {
    const raw = await AsyncStorage.getItem('prefs');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Read today's vitals from the single array stored at 'wellness:checkins'
async function loadTodayVitalsFromCheckins() {
  try {
    const raw = await AsyncStorage.getItem(CHECKIN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr) || !arr.length) return {};
    const today = isoToday();
    // Find most recent entry for today (if multiple, take the last)
    for (let i = arr.length - 1; i >= 0; i--) {
      const entry = arr[i];
      if (entry?.at && sameDay(entry.at, today)) {
        const { energy, sleep, mode, weightLb } = entry;
        const out = {};
        if (typeof energy === 'number') out.energy = energy;
        if (typeof sleep === 'number') out.sleep = sleep;
        if (typeof mode === 'string') out.mode = mode;
        if (typeof weightLb === 'number') out.weightLb = weightLb;
        return out;
      }
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Hook hydrates pieces the screen wants:
 *  - loading, error
 *  - payload: { dateKey, prefs: { ...prefs, split }, vitals, units }
 *  - refresh()
 *  - setSplitOverride()
 *
 * Policy:
 *  - If the user didn't pick a split, we set split to "No preference".
 *  - Vitals are read from 'wellness:checkins' for today's ISO date (UTC slice), matching HomeScreen.
 */
export default function useRepAIPlan({ splitOverride = null, routeVitals = null } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);

  const splitOverrideRef = useRef(splitOverride);
  const routeVitalsRef = useRef(routeVitals);

  useEffect(() => { splitOverrideRef.current = splitOverride; }, [splitOverride]);
  useEffect(() => { routeVitalsRef.current = routeVitals; }, [routeVitals]);

  const setSplitOverride = useCallback((val) => { splitOverrideRef.current = val; }, []);

  const build = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateKey = isoToday();

      const [prefs, history, todayVitals] = await Promise.all([
        loadPrefs(),
        getAllWorkouts(),
        loadTodayVitalsFromCheckins(),
      ]);

      // Merge any vitals passed via route on top of storage
      const vitals = { ...(todayVitals || {}), ...(routeVitalsRef.current || {}) };

      const units = (history?.[0]?.units === 'kg') ? 'kg' : 'lb';

      // Split: "No preference" if no UI selection
      const uiSplit = splitOverrideRef.current;
      const split = uiSplit ? uiSplit : 'No preference';

      const nextPayload = {
        dateKey,
        prefs: { ...prefs, split },
        vitals,
        units,
      };

      // Debug
      console.log('[useRepAIPlan] payload', JSON.stringify(nextPayload, null, 2));

      setPayload(nextPayload);
      setLoading(false);
      return nextPayload;
    } catch (e) {
      setError(e);
      setLoading(false);
      throw e;
    }
  }, []);

  useEffect(() => { build(); }, [build]);

  const refresh = useCallback(async () => build(), [build]);

  return useMemo(
    () => ({ loading, error, payload, refresh, setSplitOverride }),
    [loading, error, payload, refresh, setSplitOverride]
  );
}
