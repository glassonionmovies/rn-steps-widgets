// screens/ProgressScreen.js
import React, { useMemo, useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Alert, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Card from '../components/ui/Card';
import DonutChart from '../components/DonutChart';
import MultiLineChart from '../components/charts/MultiLineChart';
import RecentWorkoutsPanel from '../components/workout/RecentWorkoutsPanel';
import GradientButton from '../components/ui/GradientButton';
import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';
import { goMuscleInsights } from '../navigation/routes';

const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs'];
const GROUP_COLORS = {
  Chest: '#ef4444',
  Back: '#3b82f6',
  Shoulders: '#f59e0b',
  Arms: '#a855f7',
  Legs: '#22c55e',
  Abs: '#10b981',
};
const GROUP_ICONS = { Chest:'💪', Back:'🧷', Shoulders:'🧱', Arms:'🦾', Legs:'🦵', Abs:'🧘‍♀️' };

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
const isValidSet = (s) => (Number(s?.weight) || 0) > 0 && (Number(s?.reps) || 0) > 0;

function RangeChips({ value, onChange, options = [7, 30, 90] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((d) => {
        const active = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => onChange?.(d)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? '#6366f1' : '#e5e7eb',
              backgroundColor: active ? '#eef2ff' : '#fff',
            }}
          >
            <Text style={{ color: active ? '#4f46e5' : palette.text, fontWeight: active ? '800' : '600' }}>
              {d}D
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProgressScreen() {
  const navigation = useNavigation();
  const [workouts, setWorkouts] = useState([]);
  const [steps7, setSteps7] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [splitDays, setSplitDays] = useState(90); // date-range picker controls Muscle Split
  const [selectedGroup, setSelectedGroup] = useState('Chest'); // for Muscle Group Performance card

  // Load data when focused
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const all = await getAllWorkouts();
        if (mounted) setWorkouts(all || []);

        // Steps last 7 days: try common keys used by health widgets
        try {
          const s = (await AsyncStorage.getItem('WidgetTwoHealth:steps7')) ||
                    (await AsyncStorage.getItem('health:steps7'));
          if (s && mounted) {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed) && parsed.length >= 7) {
              setSteps7(parsed.slice(-7).map(n => Number(n) || 0));
            }
          }
        } catch {}
      })();
      return () => { mounted = false; };
    }, [])
  );

  // --- Weekly Trend (7 days) ---
  const weekLabels = useMemo(() => {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const arr = [];
    for (let i = 6; i >= 0; i--) arr.push(names[new Date(daysAgo(i)).getDay()]);
    return arr;
  }, []);

  const volume7 = useMemo(() => {
    const map = new Map();
    workouts.forEach(w => {
      const d = startOfDay(w.startedAt || Date.now());
      const vol = (w.blocks || []).reduce((acc, b) =>
        acc + (b.sets || []).reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0)
      , 0);
      map.set(d, (map.get(d) || 0) + vol);
    });
    const arr = [];
    for (let i = 6; i >= 0; i--) arr.push(Math.round(map.get(daysAgo(i)) || 0));
    return arr;
  }, [workouts]);

  const steps7k = useMemo(() => steps7.map(n => Number(n) / 1000), [steps7]);

  // --- Muscle Split (selected range): avg volume per *exercise occurrence* ---
  const split = useMemo(() => {
    const cutoff = Date.now() - splitDays * 24 * 60 * 60 * 1000;

    // Totals for the average (per exercise occurrence)
    const totalVol = Object.fromEntries(GROUPS.map(g => [g, 0]));
    const exerciseCount = Object.fromEntries(GROUPS.map(g => [g, 0]));

    // Workouts count (for the legend tap)
    const workoutCount = Object.fromEntries(GROUPS.map(g => [g, 0]));

    (workouts || [])
      .filter(w => (w.startedAt || 0) >= cutoff)
      .forEach(w => {
        const hitThisWorkout = new Set(); // track if a group appeared in this workout (for workoutCount)
        (w.blocks || []).forEach(b => {
          const g = b.exercise?.muscleGroup;
          if (!GROUPS.includes(g)) return;

          // Compute volume for this *exercise occurrence* (block)
          const blockVol = (b.sets || []).filter(isValidSet)
            .reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0);

          if (blockVol > 0) {
            totalVol[g] += blockVol;
            exerciseCount[g] += 1;   // <-- count occurrences
            hitThisWorkout.add(g);   // <-- remember that this workout hit g
          }
        });
        hitThisWorkout.forEach(g => { workoutCount[g] += 1; });
      });

    const segments = GROUPS.map(g => {
      const countOcc = exerciseCount[g] || 0;
      const avg = countOcc ? totalVol[g] / countOcc : 0;
      return {
        group: g,
        value: Math.round(avg),     // for donut
        color: GROUP_COLORS[g],
        countOcc,
        workouts: workoutCount[g] || 0,
      };
    });

    return { segments, workoutCount, exerciseCount };
  }, [workouts, splitDays]);

  const handleLegendPress = (g) => {
    const item = split.segments.find(s => s.group === g);
    Alert.alert(
      g,
      `${item.workouts} workout${item.workouts === 1 ? '' : 's'} in last ${splitDays} days`
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: layout.screenHMargin, gap: spacing(2) }}
    >
      {/* 1) Weekly Trend (fixed 7 days) */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>Weekly Trend</Text>
        <MultiLineChart
          labels={weekLabels}
          yMode="dual"
          series={[
            { label: 'Volume (lbs)', color: '#2563eb', points: volume7 },
            { label: 'Steps (k)',     color: '#ef4444', points: steps7k, format: (n) => n.toFixed(1) },
          ]}
          showValues
        />
        {steps7.every(n => n === 0) && (
          <Text style={{ color: palette.sub, marginTop: 6, fontSize: 12 }}>
            Connect Health to see steps here.
          </Text>
        )}
      </Card>

      {/* 2) Muscle Group Split (range picker) */}
      <Card style={{ padding: spacing(2) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(1) }}>
          <Text style={styles.sectionTitle}>Muscle Group Split</Text>
          <RangeChips value={splitDays} onChange={setSplitDays} options={[7, 30, 90]} />
        </View>

        <DonutChart
          segments={split.segments.map(s => ({ value: s.value, color: s.color }))}
          centerLabel="Avg / exercise"
        />

        {/* Legend with press -> workout count */}
        <View style={{ marginTop: spacing(1), gap: 8 }}>
          {split.segments.map(s => (
            <View
              key={s.group}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                <Text style={{ color: palette.text, fontWeight: '700' }}>{s.group}</Text>
              </View>
              <Text
                onPress={() => handleLegendPress(s.group)}
                style={{ color: palette.sub }}
              >
                {s.value} avg • tap for workout count
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* 2.5) Muscle Group Performance — moved here from Home */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>Muscle Group Performance</Text>
        <Text style={{ color: palette.sub, marginBottom: spacing(1) }}>
          Deep insights, PRs, and trends by muscle group
        </Text>

        {/* Group chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GROUPS.map((g) => {
            const active = g === selectedGroup;
            return (
              <Pressable
                key={g}
                onPress={() => setSelectedGroup(g)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
                  borderColor: active ? '#6366f1' : '#e5e7eb',
                  backgroundColor: active ? '#eef2ff' : '#fff',
                }}
              >
                <Text style={{ fontWeight: '800', color: active ? '#4f46e5' : palette.text }}>
                  {(GROUP_ICONS[g] || '') + ' ' + g}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: spacing(1) }} />
        <GradientButton
          title={`Open ${selectedGroup} Insights`}
          onPress={() => goMuscleInsights(navigation, selectedGroup)}
        />
      </Card>

      {/* 3) Recent Workouts (date + session summary) */}
      <RecentWorkoutsPanel workouts={workouts} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: spacing(1) },
});
