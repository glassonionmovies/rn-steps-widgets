// screens/ProgressScreen.js
import React, { useMemo, useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import Card from '../components/ui/Card';
import DonutChart from '../components/DonutChart';
import RecentWorkoutsPanel from '../components/workout/RecentWorkoutsPanel';
import VolumeReportCard from '../components/charts/VolumeReportCard';
import ActivityReportCard from '../components/charts/ActivityReportCard';

import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';

// ---- Constants
const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs'];
const GROUP_COLORS = {
  Chest: '#ef4444',
  Back: '#3b82f6',
  Shoulders: '#f59e0b',
  Arms: '#a855f7',
  Legs: '#22c55e',
  Abs: '#10b981',
};

// ---- Helpers
const isValidSet = (s) => (Number(s?.weight) || 0) > 0 && (Number(s?.reps) || 0) > 0;
const epley = (w, r) => (Number(w) || 0) * (1 + (Number(r) || 0) / 30);

function RangeChips({ value, onChange, options = [30, 90, 180, 9999] }) {
  const label = (d) => (d === 9999 ? 'All' : `${d}D`);
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
            <Text
              style={{
                color: active ? '#4f46e5' : palette.text,
                fontWeight: active ? '800' : '600',
              }}
            >
              {label(d)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProgressScreen() {
  const navigation = useNavigation();
  const [rangeDays, setRangeDays] = useState(90);
  const [workouts, setWorkouts] = useState([]);

  // Load workouts whenever screen focuses
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const all = await getAllWorkouts();
        if (mounted) setWorkouts(all || []);
      })();
      return () => {
        mounted = false;
      };
    }, [])
  );

  const now = Date.now();
  const since = rangeDays === 9999 ? 0 : now - rangeDays * 24 * 60 * 60 * 1000;
  const prevStart = rangeDays === 9999 ? 0 : since - rangeDays * 24 * 60 * 60 * 1000;
  const prevEnd = rangeDays === 9999 ? 0 : since - 1;

  const inRange = (w) =>
    (w.startedAt || 0) >= since && (rangeDays === 9999 || (w.startedAt || 0) <= now);
  const inPrevRange = (w) =>
    rangeDays !== 9999 && (w.startedAt || 0) >= prevStart && (w.startedAt || 0) <= prevEnd;

  // ---- KPI cards (Total Volume, Workouts, New PRs)
  const kpis = useMemo(() => {
    const ws = (workouts || [])
      .filter(inRange)
      .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));

    let totalVolume = 0;
    const byExercisePR = new Map(); // exercise name -> best e1RM before/within range
    let newPRs = 0;

    // Seed bests with history BEFORE the current range so only true PRs in range are counted
    (workouts || [])
      .filter((w) => (w.startedAt || 0) < since)
      .forEach((w) => {
        (w.blocks || []).forEach((b) => {
          const name = b.exercise?.name || 'Exercise';
          (b.sets || [])
            .filter(isValidSet)
            .forEach((s) => {
              const e1 = epley(s.weight, s.reps);
              byExercisePR.set(name, Math.max(byExercisePR.get(name) || 0, e1));
            });
        });
      });

    // Tally volume + PRs inside the range
    ws.forEach((w) => {
      (w.blocks || []).forEach((b) => {
        (b.sets || [])
          .filter(isValidSet)
          .forEach((s) => {
            totalVolume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
            const name = b.exercise?.name || 'Exercise';
            const e1 = epley(s.weight, s.reps);
            const prevBest = byExercisePR.get(name) || 0;
            if (e1 > prevBest) {
              newPRs += 1;
              byExercisePR.set(name, e1);
            }
          });
      });
    });

    return { totalVolume, workouts: ws.length, newPRs };
  }, [workouts, rangeDays, since]);

  // ---- Volume Split by Muscle Group (current vs previous for trend)
  const split = useMemo(() => {
    const current = Object.fromEntries(GROUPS.map((g) => [g, 0]));
    const previous = Object.fromEntries(GROUPS.map((g) => [g, 0]));

    (workouts || []).forEach((w) => {
      const target = inRange(w) ? current : inPrevRange(w) ? previous : null;
      if (!target) return;

      (w.blocks || []).forEach((b) => {
        const g = b.exercise?.muscleGroup;
        if (!GROUPS.includes(g)) return;

        const vol = (b.sets || [])
          .filter(isValidSet)
          .reduce(
            (s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0),
            0
          );
        target[g] += vol;
      });
    });

    const totalCur = Object.values(current).reduce((a, b) => a + b, 0) || 1;
    const totalPrev = Object.values(previous).reduce((a, b) => a + b, 0) || 1;

    const segments = GROUPS.map((g) => {
      const curPct = (current[g] / totalCur) * 100;
      const prevPct = (previous[g] / totalPrev) * 100;
      const diff = Math.round(curPct - prevPct);
      return {
        group: g,
        value: current[g],
        pct: Math.round(curPct),
        trend: diff, // positive uptick, negative downtick, 0 flat
        color: GROUP_COLORS[g],
      };
    }).sort((a, b) => b.pct - a.pct);

    return {
      segments,
      donutValues: segments.map((s) => ({ value: s.value || 0, color: s.color, key: s.group })),
    };
  }, [workouts, rangeDays, since]);

  // ---- Navigation helper (works with nested stacks/tabs)
  const goMuscle = (group) => {
    try {
      const { goMuscleInsights } = require('../navigation/routes');
      if (goMuscleInsights) return goMuscleInsights(navigation, { group });
    } catch {}
    // common fallbacks
    navigation.navigate('Progress', { screen: 'MuscleInsights', params: { group } });
    navigation.navigate('MuscleInsights', { group });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        padding: layout.screenHMargin,
        gap: spacing(2),
        paddingBottom: spacing(4),
      }}
    >
      {/* Header + Range */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.heading}>Progress</Text>
        <RangeChips value={rangeDays} onChange={setRangeDays} />
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>Total Volume</Text>
          <Text style={styles.kpiValue}>{Math.round(kpis.totalVolume).toLocaleString()} lbs</Text>
          <Text style={styles.kpiSub}>this period</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>Workouts</Text>
          <Text style={styles.kpiValue}>{kpis.workouts}</Text>
          <Text style={styles.kpiSub}>this period</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiTitle}>New PRs</Text>
          <Text style={styles.kpiValue}>{kpis.newPRs}</Text>
          <Text style={styles.kpiSub}>this period</Text>
        </Card>
      </View>

      {/* STACKED charts */}
      <VolumeReportCard workouts={workouts} rangeDays={rangeDays} />
      <ActivityReportCard />

      {/* Volume Split by Muscle Group */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.largeTitle}>Volume Split by Muscle Group</Text>
        <Text style={{ color: palette.sub, marginTop: 2, marginBottom: spacing(1) }}>
          Tap a segment for detailed insights.
        </Text>

        {kpis.workouts === 0 ? (
          <Text style={{ color: palette.sub }}>
            No workouts in this period. Complete a session to see your split.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing(1) }}>
            {/* Donut (left) */}
            <View style={{ flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center' }}>
              <DonutChart
                segments={split.donutValues.map((s) => ({ value: s.value, color: s.color }))}
                centerLabel="Volume share"
                onSegmentPress={(idx) => {
                  const seg = split.segments[idx];
                  if (seg) goMuscle(seg.group);
                }}
              />
            </View>

            {/* Legend (right) */}
            <View style={{ flex: 1, justifyContent: 'center', gap: 10 }}>
              {split.segments.map((s) => (
                <Pressable
                  key={s.group}
                  onPress={() => goMuscle(s.group)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                    <Text style={{ color: palette.text, fontWeight: '800' }}>{s.group}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: palette.text, fontWeight: '800' }}>{s.pct}%</Text>
                    <Text
                      style={{
                        color: s.trend > 0 ? '#16a34a' : s.trend < 0 ? '#dc2626' : palette.sub,
                        fontWeight: '900',
                      }}
                    >
                      {s.trend > 0 ? '▲' : s.trend < 0 ? '▼' : '–'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Card>

      {/* Recent Workouts */}
      <RecentWorkoutsPanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { color: palette.text, fontSize: 24, fontWeight: '900' },

  kpiRow: { flexDirection: 'row', gap: spacing(1) },
  kpiCard: { flex: 1, padding: spacing(2), alignItems: 'flex-start' },
  kpiTitle: { color: palette.text, opacity: 0.9, fontWeight: '800', marginBottom: 6 },
  kpiValue: { color: palette.text, fontSize: 24, fontWeight: '900' },
  kpiSub: { color: palette.sub, marginTop: 2, fontSize: 12 },

  largeTitle: { color: palette.text, fontSize: 20, fontWeight: '900' },
});
