import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppleHealthKit from 'react-native-health';

const PERMS = {
  permissions: {
    read: [AppleHealthKit?.Constants?.Permissions?.Steps].filter(Boolean),
    write: [],
  },
};

function dayStart(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function dayEnd(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }

export default function WidgetTwoHealth() {
  const [state, setState] = useState({ ready:false, error:null, days:[] });

  const range = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - 2);
    return { startDate: dayStart(start).toISOString(), endDate: dayEnd(now).toISOString() };
  }, []);

  useEffect(() => {
    console.log('[W2H] mount');

    // 1) Native module presence check
    if (!AppleHealthKit || typeof AppleHealthKit.initHealthKit !== 'function') {
      console.log('[W2H] ERROR: AppleHealthKit native module missing. Are you running in Expo Go? Did you rebuild after installing?');
      setState(s => ({ ...s, error: 'HealthKit native module not linked. Use Xcode/dev client and rebuild.' }));
      return;
    }

    // 2) Availability check (handle API name differences)
    const hasIsAvailable = typeof AppleHealthKit.isAvailable === 'function';
    const hasIsHealthDataAvailable = typeof AppleHealthKit.isHealthDataAvailable === 'function';
    console.log('[W2H] hasIsAvailable:', hasIsAvailable, 'hasIsHealthDataAvailable:', hasIsHealthDataAvailable);

    const continueInit = () => {
      console.log('[W2H] initHealthKit perms:', PERMS);
      AppleHealthKit.initHealthKit(PERMS, (err) => {
        if (err) {
          console.log('[W2H] init error:', err);
          setState(s => ({ ...s, error: String(err) }));
          return;
        }
        console.log('[W2H] init ok, fetching steps', range);
        fetchSteps();
      });
    };

    if (hasIsAvailable) {
      AppleHealthKit.isAvailable((err, available) => {
        console.log('[W2H] isAvailable err ->', err, 'available ->', available);
        if (err) {
          setState(s => ({ ...s, error: String(err) }));
          return;
        }
        if (available === false) {
          setState(s => ({ ...s, error: 'Health not available on this device.' }));
          return;
        }
        continueInit(); // proceed to initHealthKit
      });
    } else if (hasIsHealthDataAvailable) {
      const avail = AppleHealthKit.isHealthDataAvailable();
      console.log('[W2H] isHealthDataAvailable ->', avail);
      if (!avail) {
        setState(s => ({ ...s, error: 'Health not available on this device.' }));
      } else {
        continueInit();
      }
    } else {
      console.log('[W2H] No availability method found, attempting init anyway…');
      continueInit();
    }
  }, []);

  function fetchSteps() {
    const opts = { startDate: range.startDate, endDate: range.endDate, includeManuallyAdded: true };
    console.log('[W2H] getDailyStepCountSamples opts:', opts);

    if (typeof AppleHealthKit.getDailyStepCountSamples !== 'function') {
      console.log('[W2H] ERROR: getDailyStepCountSamples not available on this version.');
      setState(s => ({ ...s, error: 'Steps API not available (library version mismatch?)' }));
      return;
    }

    AppleHealthKit.getDailyStepCountSamples(opts, (err, results = []) => {
      if (err) {
        console.log('[W2H] steps error:', err);
        setState(s => ({ ...s, error: String(err) }));
        return;
      }
      console.log('[W2H] raw results:', results);

      const d0 = new Date();            // today
      const d1 = new Date(); d1.setDate(d1.getDate()-1);
      const d2 = new Date(); d2.setDate(d2.getDate()-2);
      const isSameDay = (a,b)=>a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
      const buckets = { d2:0, d1:0, d0:0 };

      results.forEach(r => {
        const ds = new Date(r.startDate);
        if (isSameDay(ds, d2)) buckets.d2 += r.value;
        else if (isSameDay(ds, d1)) buckets.d1 += r.value;
        else if (isSameDay(ds, d0)) buckets.d0 += r.value;
      });

      const days = [
        { label:'D-2', value: Math.round(buckets.d2) },
        { label:'D-1', value: Math.round(buckets.d1) },
        { label:'Today', value: Math.round(buckets.d0) },
      ];
      console.log('[W2H] folded days:', days);
      setState({ ready:true, error:null, days });
    });
  }

  const max = Math.max(1, ...state.days.map(d=>d.value));

  if (state.error) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Steps (Last 3 Days)</Text>
        <Text style={styles.err}>Error: {state.error}</Text>
        <Text style={styles.hint}>
          If on a dev build, ensure: prebuild, pods, HealthKit capability, rebuild. In Settings → Health → Data Access, enable “Steps”.
        </Text>
      </View>
    );
  }
  if (!state.ready) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Steps (Last 3 Days)</Text>
        <Text style={styles.sub}>Initializing… watch console logs</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Steps (Last 3 Days)</Text>
      <View style={styles.chart}>
        {state.days.map((d, i) => {
          const heightPct = (d.value / max) * 100;
          return (
            <View key={i} style={styles.barBlock}>
              <View style={[styles.bar, { height: `${heightPct}%` }]} />
              <Text style={styles.label}>{d.label}</Text>
              <Text style={styles.value}>{d.value.toLocaleString()}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card:{ flex:1, backgroundColor:'white', borderRadius:12, padding:12,
    shadowColor:'#000', shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:3}, elevation:2 },
  title:{ fontSize:18, fontWeight:'600', marginBottom:8 },
  sub:{ fontSize:13, color:'#666' }, err:{ fontSize:13, color:'#b00020' }, hint:{ marginTop:6, fontSize:12, color:'#666' },
  chart:{ height:140, flexDirection:'row', alignItems:'flex-end', justifyContent:'space-around', marginTop:6 },
  barBlock:{ alignItems:'center', width:64 },
  bar:{ width:28, backgroundColor:'#6bc56b', borderTopLeftRadius:6, borderTopRightRadius:6 },
  label:{ marginTop:6, fontSize:12, color:'#333' }, value:{ fontSize:12, color:'#666' },
});
