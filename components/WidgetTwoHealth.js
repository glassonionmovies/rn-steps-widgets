// components/WidgetTwoHealth.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppleHealthKit from 'react-native-health';

// Format yyyy-mm-dd for map keys
const dkey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
// Start/end of a day
const dayStart = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const dayEnd   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

export default function WidgetTwoHealth() {
  const [state, setState] = useState({
    ready: false,
    error: null,
    days: [], // [{label, value, key}]
  });

  // Build a fixed 7-day window ending today
  const window7 = useMemo(() => {
    const today = dayStart(new Date());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({
        date: d,
        key: dkey(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }), // Sun, Mon, ...
      });
    }
    const startISO = dayStart(new Date(days[0].date)).toISOString();
    const endISO = dayEnd(new Date(days[6].date)).toISOString();
    return { days, startISO, endISO };
  }, []);

  useEffect(() => {
    console.log('[W2H] mount');

    if (!AppleHealthKit || typeof AppleHealthKit.initHealthKit !== 'function') {
      console.log('[W2H] missing native module (use dev client/Xcode, not Expo Go)');
      setState((s) => ({ ...s, error: 'HealthKit native module not linked.' }));
      return;
    }

    const perms = {
      permissions: {
        read: [AppleHealthKit.Constants.Permissions.Steps],
        write: [],
      },
    };

    const hasIsAvailable = typeof AppleHealthKit.isAvailable === 'function';
    const hasIsHealthDataAvailable = typeof AppleHealthKit.isHealthDataAvailable === 'function';
    console.log('[W2H] hasIsAvailable:', hasIsAvailable, 'hasIsHealthDataAvailable:', hasIsHealthDataAvailable);

    const continueInit = () => {
      console.log('[W2H] initHealthKit perms:', perms);
      AppleHealthKit.initHealthKit(perms, (err) => {
        console.log('[W2H] init callback err:', err);
        if (err) { setState((s) => ({ ...s, error: String(err) })); return; }
        fetchSteps();
      });
    };

    if (hasIsAvailable) {
      AppleHealthKit.isAvailable((err, available) => {
        console.log('[W2H] isAvailable err ->', err, 'available ->', available);
        if (err) { setState((s) => ({ ...s, error: String(err) })); return; }
        if (available === false) { setState((s) => ({ ...s, error: 'Health not available on this device.' })); return; }
        continueInit();
      });
    } else if (hasIsHealthDataAvailable) {
      const available = AppleHealthKit.isHealthDataAvailable();
      console.log('[W2H] isHealthDataAvailable ->', available);
      if (!available) { setState((s) => ({ ...s, error: 'Health not available on this device.' })); return; }
      continueInit();
    } else {
      console.log('[W2H] no availability method; proceeding…');
      continueInit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fetchSteps() {
    const options = {
      startDate: window7.startISO,
      endDate: window7.endISO,
      includeManuallyAdded: true,
    };
    console.log('[W2H] getDailyStepCountSamples opts:', options);

    if (typeof AppleHealthKit.getDailyStepCountSamples !== 'function') {
      console.log('[W2H] ERROR: getDailyStepCountSamples not available.');
      setState((s) => ({ ...s, error: 'Steps API not available (library version mismatch?)' }));
      return;
    }

    AppleHealthKit.getDailyStepCountSamples(options, (err, results = []) => {
      if (err) {
        console.log('[W2H] steps error:', err);
        setState((s) => ({ ...s, error: String(err) }));
        return;
      }
      console.log('[W2H] raw results:', results);

      // Sum values by day key
      const map = Object.create(null);
      results.forEach((r) => {
        const k = r.startDate?.slice(0, 10); // yyyy-mm-dd at start of day
        if (!k) return;
        map[k] = (map[k] || 0) + (typeof r.value === 'number' ? r.value : 0);
      });

      // Build the fixed 7-day array (fill missing with 0)
      const days = window7.days.map(({ key, label }) => ({
        key,
        label,
        value: Math.round(map[key] || 0),
      }));

      console.log('[W2H] folded 7-day steps:', days);
      setState({ ready: true, error: null, days });
    });
  }

  const max = Math.max(1, ...state.days.map((d) => d.value));
  const total = state.days.reduce((a, b) => a + b.value, 0);

  if (state.error) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Steps (Last 7 Days)</Text>
        <Text style={styles.err}>Error: {state.error}</Text>
        <Text style={styles.hint}>Settings → Health → Data Access → enable “Steps” for this app.</Text>
      </View>
    );
  }

  if (!state.ready) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Steps (Last 7 Days)</Text>
        <Text style={styles.sub}>Loading… (watch Metro/Xcode logs starting with [W2H])</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Steps (Last 7 Days)</Text>

      <View style={styles.chart}>
        {state.days.map((d, i) => {
          const heightPct = (d.value / max) * 100;
          return (
            <View key={d.key} style={styles.barBlock}>
              <View
                style={[styles.bar, { height: `${heightPct}%` }]}
                accessibilityLabel={`${d.label}: ${d.value} steps`}
              />
              <Text style={styles.barLabel}>{d.label}</Text>
              <Text style={styles.barValue}>{d.value.toLocaleString()}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Total: {total.toLocaleString()}</Text>
        <Text style={styles.footerText}>Avg: {(total / 7).toFixed(0)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  sub: { fontSize: 13, color: '#666' },
  err: { fontSize: 13, color: '#b00020' },
  hint: { marginTop: 6, fontSize: 12, color: '#666' },

  chart: {
    height: 160,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 6,
  },
  barBlock: { alignItems: 'center', width: 40 },
  bar: {
    width: 28,
    backgroundColor: '#6bc56b',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barLabel: { marginTop: 6, fontSize: 12, color: '#333' },
  barValue: { fontSize: 11, color: '#666' },

  footer: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 12, color: '#666' },
});
