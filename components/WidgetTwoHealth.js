// components/WidgetTwoHealth.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import AppleHealthKit from 'react-native-health';

// helpers
const dkey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const dayStart = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const dayEnd   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

export default function WidgetTwoHealth() {
  const [state, setState] = useState({
    ready: false,
    error: null,
    days: [],            // [{ key, label, value }]
    loading: false,
    lastUpdated: null,   // Date
  });

  // 7-day fixed window ending today
  const window7 = useMemo(() => {
    const today = dayStart(new Date());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({
        date: d,
        key: dkey(d),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      });
    }
    return {
      days,
      startISO: dayStart(days[0].date).toISOString(),
      endISO: dayEnd(days[6].date).toISOString(),
    };
  }, []);

  const initOnceRef = useRef(false);

  // ---- HealthKit init on mount
  useEffect(() => {
    if (initOnceRef.current) return;
    initOnceRef.current = true;

    if (!AppleHealthKit || typeof AppleHealthKit.initHealthKit !== 'function') {
      setState((s) => ({ ...s, error: 'HealthKit native module not linked. Build from Xcode/dev client.' }));
      return;
    }

    const perms = {
      permissions: { read: [AppleHealthKit.Constants.Permissions.Steps], write: [] },
    };

    const hasIsAvailable = typeof AppleHealthKit.isAvailable === 'function';
    const hasIsHealthDataAvailable = typeof AppleHealthKit.isHealthDataAvailable === 'function';

    const continueInit = () => {
      AppleHealthKit.initHealthKit(perms, (err) => {
        if (err) { setState((s) => ({ ...s, error: String(err) })); return; }
        fetchSteps(true); // first load
      });
    };

    if (hasIsAvailable) {
      AppleHealthKit.isAvailable((err, available) => {
        if (err) { setState((s) => ({ ...s, error: String(err) })); return; }
        if (available === false) { setState((s) => ({ ...s, error: 'Health not available on this device.' })); return; }
        continueInit();
      });
    } else if (hasIsHealthDataAvailable) {
      const available = AppleHealthKit.isHealthDataAvailable();
      if (!available) { setState((s) => ({ ...s, error: 'Health not available on this device.' })); return; }
      continueInit();
    } else {
      continueInit();
    }
  }, []);

  // ---- Fetch steps (can be called by button or timer)
  const fetchSteps = useCallback((firstLoad = false) => {
    setState((s) => ({ ...s, loading: true, error: firstLoad ? s.error : null }));

    const opts = {
      startDate: window7.startISO,
      endDate: window7.endISO,
      includeManuallyAdded: true,
    };

    if (typeof AppleHealthKit.getDailyStepCountSamples !== 'function') {
      setState((s) => ({
        ...s,
        loading: false,
        error: 'Steps API not available (library version mismatch?)',
      }));
      return;
    }

    AppleHealthKit.getDailyStepCountSamples(opts, (err, results = []) => {
      if (err) {
        setState((s) => ({ ...s, loading: false, error: String(err) }));
        return;
      }

      const map = Object.create(null);
      results.forEach((r) => {
        const k = r.startDate?.slice(0, 10);
        if (!k) return;
        map[k] = (map[k] || 0) + (typeof r.value === 'number' ? r.value : 0);
      });

      const days = window7.days.map(({ key, label }) => ({
        key,
        label,
        value: Math.round(map[key] || 0),
      }));

      setState({
        ready: true,
        error: null,
        loading: false,
        days,
        lastUpdated: new Date(),
      });
    });
  }, [window7]);

  // ---- Auto-refresh every 2 hours (pauses in background)
  useEffect(() => {
    let timer = setInterval(() => fetchSteps(false), 2 * 60 * 60 * 1000); // 2h
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        // refresh when app returns to foreground
        fetchSteps(false);
        if (!timer) timer = setInterval(() => fetchSteps(false), 2 * 60 * 60 * 1000);
      } else {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [fetchSteps]);

  const max = Math.max(1, ...state.days.map((d) => d.value));
  const total = state.days.reduce((a, b) => a + b.value, 0);

  // ---- UI
  if (state.error) {
    return (
      <View style={styles.card}>
        <Header onRefresh={() => fetchSteps(false)} loading={state.loading} />
        <Text style={styles.err}>Error: {state.error}</Text>
        <Text style={styles.hint}>Settings → Health → Data Access → enable “Steps” for this app.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Header onRefresh={() => fetchSteps(false)} loading={state.loading} lastUpdated={state.lastUpdated} />

      {!state.ready ? (
        <Text style={styles.sub}>Loading…</Text>
      ) : (
        <>
          <View style={styles.chart}>
            {state.days.map((d) => {
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
        </>
      )}
    </View>
  );
}

// Small header with Refresh button + last updated
function Header({ onRefresh, loading, lastUpdated }) {
  return (
    <View style={styles.headerRow}>
      <Text style={styles.title}>Steps (Last 7 Days)</Text>
      <TouchableOpacity
        onPress={onRefresh}
        disabled={loading}
        style={[styles.refreshBtn, loading && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Refresh steps"
      >
        <Text style={styles.refreshText}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
      </TouchableOpacity>
      {lastUpdated ? (
        <Text style={styles.updated}>Updated {formatTime(lastUpdated)}</Text>
      ) : null}
    </View>
  );
}

function formatTime(d) {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent', // let Card provide the surface
    padding: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8, flexGrow: 1 },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1f7aed',
  },
  refreshText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  updated: { marginLeft: 'auto', fontSize: 11, color: '#666' },

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
