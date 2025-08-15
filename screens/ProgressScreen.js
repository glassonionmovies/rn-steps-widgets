import React, { useState, useCallback } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Card from '../components/ui/Card';
import LineChart from '../components/LineChart';
import DonutChart from '../components/DonutChart';
import WorkoutHistoryList from '../components/workout/WorkoutHistoryList';
import { getAllWorkouts } from '../store/workoutStore';
import { palette, spacing, layout } from '../theme';

const GROUP_COLORS = {
  Chest: '#ef4444',
  Back: '#3b82f6',
  Legs: '#22c55e',
  Shoulders: '#f59e0b',
  Arms: '#a855f7',
  Core: '#10b981',
  Other: '#9ca3af',
};

function aggregateWeekly(workouts) {
  // Sun..Sat counts
  const arr = [0, 0, 0, 0, 0, 0, 0];
  workouts.forEach((w) => {
    const d = new Date(w.startedAt || Date.now());
    arr[d.getDay()] += 1;
  });
  return arr;
}

function aggregateMuscle(workouts) {
  const tally = {};
  (workouts || []).forEach((w) =>
    (w.blocks || []).forEach((b) => {
      const g = b.exercise?.muscleGroup || 'Other';
      const vol = (b.sets || []).reduce(
        (s, set) => s + (Number(set.weight) || 0) * (Number(set.reps) || 0),
        0
      );
      tally[g] = (tally[g] || 0) + vol;
    })
  );
  return Object.entries(tally).map(([g, value]) => ({
    value: Math.round(value),
    color: GROUP_COLORS[g] || GROUP_COLORS.Other,
  }));
}

export default function ProgressScreen() {
  const [weekly, setWeekly] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [muscle, setMuscle] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const all = await getAllWorkouts();
        if (!mounted) return;
        setWeekly(aggregateWeekly(all));
        setMuscle(aggregateMuscle(all));
      })();
      return () => {
        mounted = false;
      };
    }, [])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: layout.screenHMargin, gap: spacing(2) }}
    >
      <WorkoutHistoryList />

      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>Weekly Trend</Text>
        <LineChart points={weekly} />
      </Card>

      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>Muscle Group Split</Text>
        <DonutChart segments={muscle} centerLabel="Volume" />
      </Card>

      <View style={{ height: spacing(1) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: spacing(1) },
});
