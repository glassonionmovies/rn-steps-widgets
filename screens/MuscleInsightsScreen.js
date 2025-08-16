// screens/MuscleInsightsScreen.js
import React, { useMemo, useCallback, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Card from '../components/ui/Card';
import MultiLineChart from '../components/charts/MultiLineChart';
import ContributionCalendar from '../components/workout/ContributionCalendar';
import KPICard from '../components/ui/KPICard';
import { palette, spacing, layout } from '../theme';
import { getAllWorkouts } from '../store/workoutStore';
import coach from '../utils/coach';

const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs'];
const GROUP_ICONS = { Chest: '💪', Back: '🧷', Shoulders: '🧱', Arms: '🦾', Legs: '🦵', Abs: '🧘‍♀️' };
const GROUP_COLORS = { Chest: '#ef4444', Back: '#3b82f6', Shoulders: '#f59e0b', Arms: '#a855f7', Legs: '#22c55e', Abs: '#10b981' };

function RangeChips({ value, onChange, options = [30, 90, 180, 'All'] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={String(opt)}
            onPress={() => onChange?.(opt)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
              borderColor: active ? '#6366f1' : '#e5e7eb', backgroundColor: active ? '#eef2ff' : '#fff',
            }}
          >
            <Text style={{ color: active ? '#4f46e5' : palette.text, fontWeight: active ? '800' : '600' }}>
              {typeof opt === 'number' ? `Last ${opt}D` : 'All Time'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function MuscleInsightsScreen() {
  const nav = useNavigation();
  const route = useRoute();
  const initialGroup = route?.params?.group && GROUPS.includes(route.params.group) ? route.params.group : 'Chest';

  const [workouts, setWorkouts] = useState([]);
  const [group, setGroup] = useState(initialGroup);
  const [range, setRange] = useState(90);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    (async () => {
      const all = await getAllWorkouts();
      if (mounted) setWorkouts(all || []);
    })();
    return () => { mounted = false; };
  }, []));

  const agg = useMemo(() => {
    const r = typeof range === 'number' ? range : undefined;
    return coach.aggregateGroup(workouts, group, r ?? 36500); // "All" => very large window
  }, [workouts, group, range]);

  // Week sparkline (group volume)
  const weekLabels = useMemo(() => {
    const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
      arr.push(names[d.getDay()]);
    }
    return arr;
  }, []);
  const vol7 = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      arr.push(Math.round(agg.byDayVolume.get(k) || 0));
    }
    return arr;
  }, [agg.byDayVolume]);

  const navigationToExercise = (ex) => {
    if (!ex?.id && !ex?.name) return Alert.alert('Missing exercise info');
    nav.navigate('ExerciseProgression', { exercise: ex });
  };

  // Compose Rep.Ai text using coach outputs
  const insights = useMemo(() => {
    const out = [];
    if (agg.deltaPct != null) {
      if (agg.deltaPct > 5) out.push(`Volume up ${agg.deltaPct.toFixed(0)}% vs previous period—great trajectory.`);
      else if (agg.deltaPct < -5) out.push(`Volume down ${Math.abs(agg.deltaPct).toFixed(0)}% vs previous period—plan a focused block.`);
      else out.push('Volume is steady vs previous period—consistency is solid.');
    }
    if (agg.balance?.message) out.push(agg.balance.message);
    if (agg.e1rmTrend?.message) out.push(agg.e1rmTrend.message);
    if (agg.acwr?.ratio != null) {
      const r = agg.acwr.ratio.toFixed(2);
      if (agg.acwr.status === 'high') out.push(`ACWR ${r}: recent load is high vs baseline—watch fatigue.`);
      else if (agg.acwr.status === 'low') out.push(`ACWR ${r}: consider nudging volume up to drive adaptation.`);
      else out.push(`ACWR ${r}: load is in a good range.`);
    }
    (agg.noteTips || []).forEach((t) => out.push(t));
    return out;
  }, [agg]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: layout.screenHMargin, gap: spacing(2) }}
    >
      {/* Header: title + range + sparkline */}
      <Card style={{ padding: spacing(2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1) }}>
          <Text style={styles.title}>
            {GROUP_ICONS[group] || '🏋️‍♂️'} {group} Insights
          </Text>
          <RangeChips value={range} onChange={setRange} />
        </View>
        <MultiLineChart
          labels={weekLabels}
          series={[{ label: `${group} Volume`, color: GROUP_COLORS[group], points: vol7, format: (n) => Math.round(n).toLocaleString() }]}
          showValues
          yMode="joint"
        />
      </Card>

      {/* Group selector */}
      <Card style={{ padding: spacing(1.5) }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GROUPS.map((g) => {
            const active = g === group;
            return (
              <Pressable
                key={g}
                onPress={() => setGroup(g)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
                  borderColor: active ? GROUP_COLORS[g] : '#e5e7eb',
                  backgroundColor: '#fff',
                }}
              >
                <Text style={{ fontWeight: '800', color: active ? GROUP_COLORS[g] : palette.text }}>
                  {(GROUP_ICONS[g] || '') + ' ' + g}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* KPIs */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) }}>
        <KPICard
          title="Total Volume"
          value={`${Math.round(agg.totalVolume).toLocaleString()} lbs`}
          sub={agg.deltaPct == null ? '—' : `${agg.deltaPct >= 0 ? '+' : ''}${agg.deltaPct.toFixed(0)}% vs prev`}
        />
        <KPICard
          title="Workouts"
          value={`${agg.workoutsCount}`}
          sub={`Avg ${(agg.avgPerWeek).toFixed(1)} / week`}
        />
        <KPICard
          title="ACWR"
          value={agg.acwr?.ratio != null ? agg.acwr.ratio.toFixed(2) : '—'}
          sub={agg.acwr?.message || '—'}
        />
      </View>

      {/* Top Exercises */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>Top Exercises</Text>
        <View style={{ gap: 12 }}>
          {agg.topExercises.length === 0 && <Text style={{ color: palette.sub }}>No data in this range.</Text>}
          {agg.topExercises.slice(0, 6).map((x) => (
            <Pressable
              key={x.exercise?.id || x.exercise?.name}
              onPress={() => navigationToExercise(x.exercise)}
              style={{ paddingVertical: 6 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {!!x.exercise?.icon && <Text style={{ fontSize: 18 }}>{x.exercise.icon}</Text>}
                  <Text style={{ fontWeight: '700', color: palette.text }}>{x.exercise?.name || 'Exercise'}</Text>
                </View>
                <Text style={{ color: palette.sub }}>›</Text>
              </View>
              <Text style={{ marginTop: 4, color: palette.sub }}>
                Volume: {Math.round(x.volume).toLocaleString()} lbs  •  Sessions: {x.sessions}  •  Best: {x.bestSet.reps} reps @ {x.bestSet.weight} lbs
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* AI Coach */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>🧠 Rep.Ai Analysis</Text>
        {insights.length === 0 && <Text style={{ color: palette.sub }}>Do a couple more workouts to unlock insights.</Text>}
        {insights.map((t, i) => (
          <Text key={i} style={{ color: palette.text, marginTop: 4 }}>{t}</Text>
        ))}
      </Card>

      {/* Consistency / Contribution calendar */}
      <Card style={{ padding: spacing(2) }}>
        <Text style={styles.sectionTitle}>Workout Consistency</Text>
        <ContributionCalendar
          days={typeof range === 'number' ? range : 180}
          dayValues={agg.byDayVolume}
          color={GROUP_COLORS[group]}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { color: palette.text, fontSize: 22, fontWeight: '900' },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: spacing(1) },
});
