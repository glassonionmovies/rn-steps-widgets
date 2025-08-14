import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient'; // ✅ new import

import Card from '../components/ui/Card';
import GradientButton from '../components/ui/GradientButton';
import StepsBarChart from '../components/StepsBarChart';
import StatCard from '../components/StatCard';
import WidgetTwoHealth from '../components/WidgetTwoHealth'; // your working health widget
import { palette, spacing, layout } from '../theme';

const LABELS = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

export default function HomeScreen() {
  const sample = [5, 4, 6, 3, 7, 5, 6]; // fallback if Health not granted

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{
        paddingHorizontal: layout.screenHMargin,
        paddingTop: spacing(2),
        paddingBottom: spacing(4),
      }}
    >
      <Text style={styles.title}>FitTracker</Text>
      <Text style={styles.subtitle}>Track your workouts, crush your goals</Text>

      {/* Daily Steps Card */}
      <Card style={{ marginTop: spacing(2) }}>
        <Text style={styles.cardTitle}>Daily Steps (Last 7 Days)</Text>
        <StepsBarChart data={sample} labels={LABELS} />
        <Text style={styles.hint}>
          Health access handled below — showing live or sample data.
        </Text>
      </Card>

      {/* Live Health widget */}
      <Card style={{ marginTop: spacing(2) }}>
        <WidgetTwoHealth />
      </Card>

      {/* Stats grid */}
      <View style={styles.grid}>
        <StatCard
          label="Workouts"
          value="15"
          sublabel="This week"
          footer="+12% from last week"
        />
        <StatCard label="Duration" value="720" sublabel="Minutes" />
      </View>
      <View style={styles.grid}>
        <StatCard
          label="Streak"
          value="7"
          sublabel="Days"
          footer="+8% from last week"
        />
        <StatCard label="Avg/Week" value="4.2" sublabel="Workouts" />
      </View>

      <View style={{ marginTop: spacing(2) }}>
        <GradientButton title="Start New Workout" onPress={() => {}} />
      </View>

      {/* Recent Workouts */}
      <Card style={{ marginTop: spacing(2) }}>
        <Text style={styles.sectionTitle}>Recent Workouts</Text>
        <View style={{ height: spacing(1) }} />
        <Card style={{ backgroundColor: 'rgba(124,58,237,0.1)' }}>
          <Text style={styles.itemTitle}>Push Day</Text>
          <Text style={styles.itemMeta}>6 exercises · 45 min · Today</Text>
          <View style={{ height: spacing(1) }} />
          <GradientButton title="Start Workout" onPress={() => {}} />
        </Card>
        <View style={{ height: spacing(2) }} />
        <Card>
          <Text style={styles.itemTitle}>Leg Blast</Text>
          <Text style={styles.itemMeta}>8 exercises · 60 min · Yesterday</Text>
          <View style={{ height: spacing(1) }} />
          <GradientButton title="Start Workout" onPress={() => {}} />
        </Card>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.accent2, fontSize: 34, fontWeight: '900' },
  subtitle: { color: palette.sub, marginTop: 4, fontSize: 16 },
  cardTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing(1),
  },
  sectionTitle: { color: palette.text, fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', marginTop: spacing(2) },
  itemTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },
  itemMeta: { color: palette.sub, marginTop: 4 },
  hint: { color: palette.sub, marginTop: spacing(1) },
});
